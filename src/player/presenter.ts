import { type EncodedTrace, type Frame, TraceCursor, type VarValue, type ViewSpec } from '@/core';
import { ease, interpolate } from '../scene/interpolate';
import { EMPTY_SCENE, type Renderer, type Scene, type ViewDefinition, type Viewport } from '../scene/types';
import { keyOf, viewFor } from '../views/registry';
import { createPlayerStore, type PlayerStore } from './store';

/** Durante la reproducción, los paneles de React se refrescan como mucho a 20 Hz. */
const PANEL_REFRESH_MS = 50;

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

/** Lo que necesitan los lienzos y los paneles: dónde montarse y el frame publicado. */
export interface FrameSource {
  readonly trace: EncodedTrace;
  readonly store: PlayerStore;
  mount(spec: ViewSpec, renderer: Renderer): ViewHandle;
}

export interface PresenterOptions {
  readonly prefersReducedMotion: () => boolean;
  /** Hay una transición en curso: quien lleva el reloj debe llamar a `tick` en cada fotograma. */
  readonly requestFrames: () => void;
  /** Valor inicial de `speed` en el store; solo lo usa quien tenga reproducción propia. */
  readonly speed?: number;
}

/**
 * Pinta un frame de una traza en todas sus vistas y publica lo que muestran los paneles. No decide qué
 * frame toca: eso lo hace un reloj, el del reproductor o el de la comparación.
 */
export class FramePresenter implements FrameSource {
  readonly trace: EncodedTrace;
  readonly store: PlayerStore;
  readonly last: number;

  private readonly cursor: TraceCursor;
  private readonly prefersReducedMotion: () => boolean;
  private readonly requestFrames: () => void;
  private readonly views = new Set<MountedView>();

  private finalState: Frame['state'] | null = null;
  private current = 0;
  private live = false;
  private transition: { elapsed: number; duration: number } | null = null;
  private sincePublish = 0;
  private publishedVars: Readonly<Record<string, VarValue>> = {};

  constructor(trace: EncodedTrace, options: PresenterOptions) {
    this.trace = trace;
    this.prefersReducedMotion = options.prefersReducedMotion;
    this.requestFrames = options.requestFrames;
    this.cursor = new TraceCursor(trace);
    this.last = trace.header.frameCount - 1;
    this.store = createPlayerStore(trace.header.frameCount, options.speed ?? 1);
    if (this.last >= 0) this.publish(this.cursor.seek(0));
  }

  get index(): number {
    return this.current;
  }

  get animating(): boolean {
    return this.transition !== null;
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
        const scene = view.definition.build(this.cursor.seek(this.current), spec, viewport, view.prepared);
        view.from = scene;
        view.to = scene;
        view.renderer.paint(scene);
        this.publish(this.cursor.seek(this.current));
      },
      unmount: () => {
        this.views.delete(view);
        renderer.destroy();
      },
    };
  }

  /** Muestra ese frame. Con duración, interpola desde lo que hay pintado; sin ella, salta. */
  show(target: number, duration: number): void {
    if (this.last < 0) return;
    const frame = this.cursor.seek(target);
    this.current = target;

    for (const view of this.views) {
      if (view.viewport.width <= 0) continue;
      view.from = view.to;
      view.to = view.definition.build(frame, view.spec, view.viewport, view.prepared);
    }

    if (duration > 0 && !this.prefersReducedMotion()) {
      this.transition = { elapsed: 0, duration };
      this.requestFrames();
    } else {
      this.transition = null;
      this.paintAt(1);
    }

    if (!this.live || this.sincePublish >= PANEL_REFRESH_MS) {
      this.sincePublish = 0;
      this.publish(frame);
    }
  }

  /** Avanza la transición en curso. Quien lleva el reloj lo llama en cada fotograma. */
  tick(deltaMs: number): void {
    this.sincePublish += deltaMs;
    if (!this.transition) return;
    this.transition.elapsed += deltaMs;
    const progress = Math.min(1, this.transition.elapsed / this.transition.duration);
    this.paintAt(ease(progress));
    if (progress >= 1) this.transition = null;
  }

  /**
   * Con reproducción en marcha, los paneles se refrescan a 20 Hz y no se describen las vistas. Al
   * pararse se publica el frame exacto, con su descripción para lectores de pantalla.
   */
  setLive(live: boolean): void {
    if (live === this.live) return;
    this.live = live;
    if (live) {
      this.sincePublish = 0;
      this.store.setState({ playing: true });
    } else if (this.last >= 0) {
      this.publish(this.cursor.seek(this.current));
    }
  }

  /** Corta la transición en curso: lo pintado se queda donde está. */
  stopTransition(): void {
    this.transition = null;
  }

  private getFinalState(): Frame['state'] {
    // Un cursor aparte: no debe mover la posición del que reconstruye los frames que se ven.
    this.finalState ??= new TraceCursor(this.trace).seek(this.last).state;
    return this.finalState;
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
    if (!this.live) {
      for (const view of this.views) {
        descriptions[keyOf(view.spec)] = view.definition.describe(frame, view.spec);
      }
    }

    this.store.setState({
      index: frame.index,
      playing: this.live,
      explain: frame.explain,
      anchor: frame.anchor,
      phase: frame.phase,
      counters: frame.counters,
      vars,
      changedVars,
      ...(this.live ? {} : { descriptions }),
    });
  }
}
