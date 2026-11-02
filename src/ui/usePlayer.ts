import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { EncodedTrace } from '@/core';
import { createRafClock } from '../player/clock';
import { PlayerEngine } from '../player/engine';
import { bindKeyboard } from '../player/keyboard';
import type { PlayerState } from '../player/store';
import { requestTrace, TraceCancelled } from '../worker/client';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface TraceRequestState {
  readonly trace: EncodedTrace | null;
  readonly error: string | null;
  readonly loading: boolean;
}

/** Pide la traza al worker. Mientras llega la nueva se sigue mostrando la anterior. */
export function useTrace(algorithmId: string, input: unknown): TraceRequestState {
  const [state, setState] = useState<TraceRequestState>({ trace: null, error: null, loading: true });

  useEffect(() => {
    let current = true;
    setState((previous) => ({ ...previous, loading: true }));

    requestTrace(algorithmId, input).then(
      (trace) => {
        if (current) setState({ trace, error: null, loading: false });
      },
      (error: unknown) => {
        if (!current || error instanceof TraceCancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState((previous) => ({ ...previous, error: message, loading: false }));
      },
    );

    return () => {
      current = false;
    };
  }, [algorithmId, input]);

  return state;
}

export function useEngine(
  trace: EncodedTrace | null,
  initialFrame: number,
  onHelp: () => void,
): PlayerEngine | null {
  const start = useRef(initialFrame);

  const engine = useMemo(() => {
    if (!trace) return null;
    const created = new PlayerEngine(trace, { clock: createRafClock(), prefersReducedMotion });
    // El paso del enlace solo vale para la primera traza; una entrada nueva empieza por el principio.
    if (start.current > 0) created.seek(start.current);
    start.current = 0;
    return created;
  }, [trace]);

  // Antes de pintar: en cuanto se ve el reproductor, las teclas ya tienen que funcionar.
  useLayoutEffect(() => {
    if (!engine) return;
    const unbind = bindKeyboard(engine, onHelp);
    return () => {
      unbind();
      engine.stop();
    };
  }, [engine, onHelp]);

  return engine;
}

export function usePlayerState<T>(engine: PlayerEngine, selector: (state: PlayerState) => T): T {
  return useStore(engine.store, selector);
}
