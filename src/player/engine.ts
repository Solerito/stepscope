import { type EncodedTrace, type Frame, type Level, TraceCursor, type VarValue, type ViewSpec } from '@/core';
import { ease, interpolate } from '../scene/interpolate';
import { EMPTY_SCENE, type Renderer, type Scene, type ViewDefinition, type Viewport } from '../scene/types';
import { keyOf, viewFor } from '../views/registry';
import type { Clock } from './clock';
import { createPlayerStore, type PlayerStore } from './store';

export const SPEEDS = [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1200] as const;

const STEP_DURATION_MS = 220;
/** Por encima de esta frecuencia una transición no se llega a percibir: se salta directamente. */
const MAX_ANIMATED_SPEED = 30;
const PANEL_REFRESH_MS = 50;
const TARGET_PLAY_SECONDS = 20;

/** La velocidad que recorre la traza en unos 20 s, sin llegar a ser un parpadeo ni una espera. */
export function defaultSpeed(frameCount: number): number {
  const wanted = Math.min(120, Math.max(1, frameCount / TARGET_PLAY_SECONDS));
  return SPEEDS.find((speed) => speed >= wanted) ?? 120;
}

interface MountedView {
  readonly spec: ViewSpec;
  readonly definition: ViewDefinition;
  readonly renderer: Renderer;
  viewport: Viewport;
  prepared: unknown;
  from: Scene;
  to: Scene;
}

export interface ViewHandle {
  resize(viewport: Viewport): void;
  unmount(): void;
}

export interface EngineOptions {
  readonly clock: Clock;
  readonly prefersReducedMotion: () => boolean;
}

/**
 * El reproductor. No sabe qué algoritmo está mostrando ni usa React: lleva el reloj y, en cada instante,
 * reconstruye el frame, construye la escena de cada vista y se la pasa a su pintor.
 */
export class PlayerEngine {
  readonly store: PlayerStore;
  readonly trace: EncodedTrace;

  private readonly cursor: TraceCursor;
  private readonly clock: Clock;
  private readonly prefersReducedMotion: () => boolean;
  private readonly views = new Set<MountedView>();
  private readonly last: number;

  private finalState: Frame['state'] | null = null;
  private index = 0;
  private playing = false;
  private speed: number;
  private granularity: Level = 2;
  private transition: { elapsed: number; duration: number } | null = null;
  private sinceStep = 0;
  private sincePublish = 0;
  private publishedVars: Readonly<Record<string, VarValue>> = {};

  constructor(trace: EncodedTrace, options: EngineOptions) {
    this.trace = trace;
    this.clock = options.clock;
    this.prefersReducedMotion = options.prefersReducedMotion;
    this.cursor = new TraceCursor(trace);
    this.last = trace.header.frameCount - 1;
    this.speed = defaultSpeed(trace.header.frameCount);
    this.store = createPlayerStore(trace.header.frameCount, this.speed);
    if (this.last >= 0) this.publish(this.cursor.seek(0));
  }

  mount(spec: ViewSpec, renderer: Renderer): ViewHandle {
    const view: MountedView = {
      spec,
      definition: viewFor(spec.view),
      renderer,
      viewport: { width: 0, height: 0 },
      prepared: undefined,
      from: EMPTY_SCENE,
      to: EMPTY_SCENE,
    };
    this.views.add(view);

    return {
      resize: (viewport) => {
        if (viewport.width <= 0 || viewport.height <= 0 || this.last < 0) return;
        view.viewport = viewport;
        view.renderer.resize(viewport);
        view.prepared = view.definition.prepare?.(this.trace.header, this.getFinalState(), viewport, spec);
        const scene = view.definition.build(this.cursor.seek(this.index), spec, viewport, view.prepared);
        view.from = scene;
        view.to = scene;
        view.renderer.paint(scene);
        this.publish(this.cursor.seek(this.index));
      },
      unmount: () => {
        this.views.delete(view);
        renderer.destroy();
      },
    };
  }

  play(): void {
    if (this.playing || this.last < 0) return;
    if (this.index >= this.last) this.jumpTo(0);
    this.playing = true;
    this.sinceStep = 0;
    this.store.setState({ playing: true });
    this.clock.start(this.onFrame);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.store.setState({ playing: false });
    if (this.last >= 0) this.publish(this.cursor.seek(this.index));
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Avanza o retrocede con transición, saltando los frames por encima de la granularidad elegida. */
  step(delta: number): void {
    this.pause();
    const target = this.advance(this.index, delta > 0 ? 1 : -1, Math.abs(delta));
    if (target !== this.index) this.goTo(target, STEP_DURATION_MS);
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
    this.jumpTo(Math.max(0, Math.min(this.last, index)));
  }

  /** Salta al siguiente hito (nivel 0) en esa dirección, o al extremo si no quedan. */
  jumpToMilestone(direction: 1 | -1): void {
    this.pause();
    const { level } = this.trace;
    for (let i = this.index + direction; i >= 0 && i <= this.last; i += direction) {
      if (level[i] === 0) {
        this.goTo(i, STEP_DURATION_MS);
        return;
      }
    }
    this.goTo(direction === 1 ? this.last : 0, STEP_DURATION_MS);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.sinceStep = 0;
    this.store.setState({ speed });
  }

  stop(): void {
    this.pause();
    this.transition = null;
    this.clock.stop();
  }

  private getFinalState(): Frame['state'] {
    // Un cursor aparte: no debe mover la posición del que usa el reproductor.
    this.finalState ??= new TraceCursor(this.trace).seek(this.last).state;
    return this.finalState;
  }

  private readonly onFrame = (deltaMs: number): void => {
    if (this.playing) this.advancePlayback(deltaMs);

    if (this.transition) {
      this.transition.elapsed += deltaMs;
      const progress = Math.min(1, this.transition.elapsed / this.transition.duration);
      this.paintAt(ease(progress));
      if (progress >= 1) this.transition = null;
    }

    if (!this.playing && !this.transition) this.clock.stop();
  };

  private advancePlayback(deltaMs: number): void {
    const period = 1000 / this.speed;
    this.sinceStep += deltaMs;
    this.sincePublish += deltaMs;
    if (this.sinceStep < period) return;

    // A mucha velocidad caben varios pasos en un tick: se pinta solo el último.
    const steps = Math.floor(this.sinceStep / period);
    this.sinceStep -= steps * period;
    const target = this.advance(this.index, 1, steps);
    const duration = this.speed <= MAX_ANIMATED_SPEED ? Math.min(STEP_DURATION_MS, period * 0.8) : 0;
    this.goTo(target, duration);

    if (target >= this.last) this.pause();
  }

  private jumpTo(target: number): void {
    this.goTo(target, 0);
  }

  private goTo(target: number, duration: number): void {
    if (this.last < 0) return;
    const frame = this.cursor.seek(target);
    this.index = target;

    for (const view of this.views) {
      if (view.viewport.width <= 0) continue;
      view.from = view.to;
      view.to = view.definition.build(frame, view.spec, view.viewport, view.prepared);
    }

    if (duration > 0 && !this.prefersReducedMotion()) {
      this.transition = { elapsed: 0, duration };
      this.clock.start(this.onFrame);
    } else {
      this.transition = null;
      this.paintAt(1);
    }

    if (!this.playing || this.sincePublish >= PANEL_REFRESH_MS) {
      this.sincePublish = 0;
      this.publish(frame);
    }
  }

  private paintAt(t: number): void {
    for (const view of this.views) {
      if (view.viewport.width > 0) view.renderer.paint(interpolate(view.from, view.to, t));
    }
  }

  private publish(frame: Frame): void {
    const vars = { ...(frame.state.stack.at(-1)?.vars ?? {}) };
    const changedVars = Object.keys(vars).filter(
      (name) => JSON.stringify(vars[name]) !== JSON.stringify(this.publishedVars[name]),
    );
    this.publishedVars = vars;

    const descriptions: Record<string, string> = {};
    if (!this.playing) {
      for (const view of this.views) {
        descriptions[keyOf(view.spec)] = view.definition.describe(frame, view.spec);
      }
    }

    this.store.setState({
      index: frame.index,
      explain: frame.explain,
      anchor: frame.anchor,
      phase: frame.phase,
      counters: frame.counters,
      vars,
      changedVars,
      ...(this.playing ? {} : { descriptions }),
    });
  }
}
