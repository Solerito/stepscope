import type { EncodedTrace, Level, ViewSpec } from '@/core';
import type { Renderer } from '../scene/types';
import type { Clock } from './clock';
import { FramePresenter, type FrameSource, type ViewHandle } from './presenter';
import type { PlayerStore } from './store';

export type { FrameSource, ViewHandle } from './presenter';

export const SPEEDS = [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1200] as const;

export const STEP_DURATION_MS = 220;
/** Por encima de esta frecuencia una transición no se llega a percibir: se salta directamente. */
export const MAX_ANIMATED_SPEED = 30;
const TARGET_PLAY_SECONDS = 20;

/** La velocidad que recorre `length` pasos en unos 20 s, sin llegar a ser un parpadeo ni una espera. */
export function defaultSpeed(length: number): number {
  const wanted = Math.min(120, Math.max(1, length / TARGET_PLAY_SECONDS));
  return SPEEDS.find((speed) => speed >= wanted) ?? 120;
}

/** Cuánto dura la transición de un paso de reproducción: nunca más que el propio paso. */
export function playbackDuration(speed: number): number {
  return speed <= MAX_ANIMATED_SPEED ? Math.min(STEP_DURATION_MS, (1000 / speed) * 0.8) : 0;
}

export interface EngineOptions {
  readonly clock: Clock;
  readonly prefersReducedMotion: () => boolean;
}

/**
 * El reproductor. No sabe qué algoritmo está mostrando ni usa React: lleva el reloj y decide qué frame
 * toca en cada instante. Pintarlo es cosa de su `FramePresenter`.
 */
export class PlayerEngine implements FrameSource {
  readonly presenter: FramePresenter;

  private readonly clock: Clock;
  private readonly last: number;

  private playing = false;
  private speed: number;
  private granularity: Level = 2;
  private sinceStep = 0;

  constructor(trace: EncodedTrace, options: EngineOptions) {
    this.clock = options.clock;
    this.last = trace.header.frameCount - 1;
    this.speed = defaultSpeed(trace.header.frameCount);
    this.presenter = new FramePresenter(trace, {
      prefersReducedMotion: options.prefersReducedMotion,
      requestFrames: () => this.clock.start(this.onFrame),
      speed: this.speed,
    });
  }

  get trace(): EncodedTrace {
    return this.presenter.trace;
  }

  get store(): PlayerStore {
    return this.presenter.store;
  }

  mount(spec: ViewSpec, renderer: Renderer): ViewHandle {
    return this.presenter.mount(spec, renderer);
  }

  play(): void {
    if (this.playing || this.last < 0) return;
    if (this.presenter.index >= this.last) this.presenter.show(0, 0);
    this.playing = true;
    this.sinceStep = 0;
    this.presenter.setLive(true);
    this.clock.start(this.onFrame);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.presenter.setLive(false);
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Avanza o retrocede con transición, saltando los frames por encima de la granularidad elegida. */
  step(delta: number): void {
    this.pause();
    const target = this.advance(this.presenter.index, delta > 0 ? 1 : -1, Math.abs(delta));
    if (target !== this.presenter.index) this.presenter.show(target, STEP_DURATION_MS);
  }

  setGranularity(granularity: Level): void {
    this.granularity = granularity;
    this.store.setState({ granularity });
  }

  /** Recorre la columna de niveles sin decodificar nada. Si no quedan frames de ese nivel, va al extremo. */
  private advance(from: number, direction: 1 | -1, count: number): number {
    const { level } = this.trace;
    let index = from;
    for (let remaining = count; remaining > 0; remaining--) {
      let next = index + direction;
      while (next >= 0 && next <= this.last && (level[next] as number) > this.granularity) next += direction;
      if (next < 0 || next > this.last) return direction === 1 ? this.last : 0;
      index = next;
    }
    return index;
  }

  /** Salta sin transición: arrastrar la barra, ir al inicio o al final. */
  seek(index: number): void {
    this.pause();
    if (this.last >= 0) this.presenter.show(Math.max(0, Math.min(this.last, index)), 0);
  }

  /** Salta al siguiente hito (nivel 0) en esa dirección, o al extremo si no quedan. */
  jumpToMilestone(direction: 1 | -1): void {
    this.pause();
    const { level } = this.trace;
    for (let i = this.presenter.index + direction; i >= 0 && i <= this.last; i += direction) {
      if (level[i] === 0) {
        this.presenter.show(i, STEP_DURATION_MS);
        return;
      }
    }
    this.presenter.show(direction === 1 ? this.last : 0, STEP_DURATION_MS);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.sinceStep = 0;
    this.store.setState({ speed });
  }

  stop(): void {
    this.pause();
    this.presenter.stopTransition();
    this.clock.stop();
  }

  private readonly onFrame = (deltaMs: number): void => {
    if (this.playing) this.advancePlayback(deltaMs);
    this.presenter.tick(deltaMs);
    if (!this.playing && !this.presenter.animating) this.clock.stop();
  };

  private advancePlayback(deltaMs: number): void {
    const period = 1000 / this.speed;
    this.sinceStep += deltaMs;
    if (this.sinceStep < period) return;

    // A mucha velocidad caben varios pasos en un tick: se pinta solo el último.
    const steps = Math.floor(this.sinceStep / period);
    this.sinceStep -= steps * period;
    const target = this.advance(this.presenter.index, 1, steps);
    this.presenter.show(target, playbackDuration(this.speed));

    if (target >= this.last) this.pause();
  }
}
