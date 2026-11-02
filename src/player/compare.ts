import { createStore, type StoreApi } from 'zustand/vanilla';
import { COUNTER_NAMES, type CounterName, type EncodedTrace } from '@/core';
import type { Clock } from './clock';
import { defaultSpeed, type EngineOptions, playbackDuration, STEP_DURATION_MS } from './engine';
import { FramePresenter } from './presenter';

/**
 * Un tic del reloj de la comparación: una comparación, una escritura o una llamada. Así un algoritmo
 * que explica más pasos no parece más lento: lo que avanza a la par es el trabajo, no los frames.
 */
export const COST_COUNTERS = ['comparisons', 'writes', 'calls'] as const satisfies readonly CounterName[];

const PANEL_REFRESH_MS = 50;

/** Operaciones acumuladas hasta cada frame. Sale de la columna de contadores, sin decodificar nada. */
export function costColumn(trace: EncodedTrace): Float64Array {
  const width = COUNTER_NAMES.length;
  const offsets = COST_COUNTERS.map((name) => COUNTER_NAMES.indexOf(name));
  const costs = new Float64Array(trace.header.frameCount);
  for (let frame = 0; frame < costs.length; frame++) {
    let total = 0;
    for (const offset of offsets) total += trace.counters[frame * width + offset] as number;
    costs[frame] = total;
  }
  return costs;
}

/** Último frame que ha gastado como mucho `cost` operaciones, o -1 si ninguno. Búsqueda binaria. */
function lastWithin(costs: Float64Array, cost: number): number {
  let low = 0;
  let high = costs.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((costs[middle] as number) <= cost) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/**
 * Qué frame enseña un algoritmo cuando el reloj marca `cost`: hasta dónde ha llegado sin gastar más.
 * Los frames que no cuestan nada (abrir una pasada, guardar una variable) se ven de camino al siguiente.
 */
export function frameAtCost(costs: Float64Array, cost: number): number {
  return Math.max(0, lastWithin(costs, cost));
}

export interface CompareSide {
  /** Operaciones que lleva hechas este lado. */
  readonly cost: number;
  /** Las que hará en total. */
  readonly total: number;
}

export interface CompareState {
  readonly cost: number;
  /** El reloj termina cuando termina el más lento de los dos. */
  readonly total: number;
  readonly playing: boolean;
  /** Operaciones por segundo. */
  readonly speed: number;
  readonly sides: readonly [CompareSide, CompareSide];
}

export type CompareStore = StoreApi<CompareState>;

type Pair<T> = readonly [T, T];
const BOTH = [0, 1] as const;

/**
 * Dos trazas con un mismo reloj que cuenta operaciones. Cada lado enseña lo que ha hecho con ese
 * trabajo; el que termina antes se queda quieto en su último frame. Tampoco sabe qué algoritmos son.
 */
export class CompareEngine {
  readonly sides: Pair<FramePresenter>;
  readonly costs: Pair<Float64Array>;
  readonly totals: Pair<number>;
  readonly total: number;
  readonly store: CompareStore;

  private readonly clock: Clock;
  private cost = 0;
  private playing = false;
  private speed: number;
  private sinceStep = 0;
  private sincePublish = 0;

  constructor(traces: Pair<EncodedTrace>, options: EngineOptions) {
    this.clock = options.clock;
    const presenter = (trace: EncodedTrace) =>
      new FramePresenter(trace, {
        prefersReducedMotion: options.prefersReducedMotion,
        requestFrames: () => this.clock.start(this.onFrame),
      });
    this.sides = [presenter(traces[0]), presenter(traces[1])];
    this.costs = [costColumn(traces[0]), costColumn(traces[1])];
    this.totals = [this.costs[0].at(-1) ?? 0, this.costs[1].at(-1) ?? 0];
    this.total = Math.max(...this.totals);
    this.speed = defaultSpeed(this.total);
    this.store = createStore<CompareState>()(() => this.snapshot());
    this.moveTo(0, 0);
  }

  play(): void {
    if (this.playing || this.total <= 0) return;
    if (this.cost >= this.total) this.moveTo(0, 0);
    this.playing = true;
    this.sinceStep = 0;
    for (const side of this.sides) side.setLive(true);
    this.publish();
    this.clock.start(this.onFrame);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    for (const side of this.sides) side.setLive(false);
    this.publish();
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Va al siguiente (o anterior) momento en el que alguno de los dos cambia de frame. */
  step(direction: 1 | -1): void {
    this.pause();
    const target = direction === 1 ? this.nextChange() : this.previousChange();
    if (target !== this.cost) this.moveTo(target, STEP_DURATION_MS);
  }

  /** Salta sin transición: arrastrar la barra, ir al inicio o al final. */
  seek(cost: number): void {
    this.pause();
    this.moveTo(Math.max(0, Math.min(this.total, Math.round(cost))), 0);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.sinceStep = 0;
    this.publish();
  }

  stop(): void {
    this.pause();
    for (const side of this.sides) side.stopTransition();
    this.clock.stop();
  }

  private nextChange(): number {
    let next = this.total;
    for (const k of BOTH) {
      const costs = this.costs[k];
      const shown = this.sides[k].index;
      if (shown < costs.length - 1) next = Math.min(next, costs[shown + 1] as number);
    }
    return next;
  }

  /** El último cambio estrictamente anterior al que ha dejado los frames que se ven ahora. */
  private previousChange(): number {
    const latest = (cost: number) =>
      Math.max(
        ...this.costs.map((costs) => {
          const frame = lastWithin(costs, cost);
          return frame < 0 ? -1 : (costs[frame] as number);
        }),
      );
    const current = latest(this.cost);
    return current <= 0 ? 0 : Math.max(0, latest(current - 1));
  }

  private readonly onFrame = (deltaMs: number): void => {
    if (this.playing) this.advancePlayback(deltaMs);
    for (const side of this.sides) side.tick(deltaMs);
    if (!this.playing && !this.sides.some((side) => side.animating)) this.clock.stop();
  };

  private advancePlayback(deltaMs: number): void {
    const period = 1000 / this.speed;
    this.sinceStep += deltaMs;
    this.sincePublish += deltaMs;
    if (this.sinceStep < period) return;

    const steps = Math.floor(this.sinceStep / period);
    this.sinceStep -= steps * period;
    const target = Math.min(this.total, this.cost + steps);
    this.moveTo(target, playbackDuration(this.speed));

    if (target >= this.total) this.pause();
  }

  private moveTo(cost: number, duration: number): void {
    this.cost = cost;
    for (const k of BOTH) {
      const target = frameAtCost(this.costs[k], cost);
      if (target !== this.sides[k].index) this.sides[k].show(target, duration);
    }
    if (!this.playing || this.sincePublish >= PANEL_REFRESH_MS) this.publish();
  }

  private snapshot(): CompareState {
    const side = (k: 0 | 1): CompareSide => ({
      cost: this.costs[k][this.sides[k].index] ?? 0,
      total: this.totals[k],
    });
    return {
      cost: this.cost,
      total: this.total,
      playing: this.playing,
      speed: this.speed,
      sides: [side(0), side(1)],
    };
  }

  private publish(): void {
    this.sincePublish = 0;
    this.store.setState(this.snapshot());
  }
}
