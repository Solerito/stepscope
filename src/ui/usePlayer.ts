import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { EncodedTrace } from '@/core';
import { createRafClock } from '../player/clock';
import { CompareEngine, type CompareState } from '../player/compare';
import { PlayerEngine } from '../player/engine';
import { bindKeys, compareCommands, playerCommands } from '../player/keyboard';
import type { PlayerState, PlayerStore } from '../player/store';
import { mainChannel, TraceCancelled, type TraceChannel } from '../worker/client';

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface TraceRequestState {
  readonly trace: EncodedTrace | null;
  readonly error: string | null;
  readonly loading: boolean;
}

/** Pide la traza al worker. Mientras llega la nueva se sigue mostrando la anterior. */
export function useTrace(
  algorithmId: string,
  input: unknown,
  channel: TraceChannel = mainChannel,
): TraceRequestState {
  const [state, setState] = useState<TraceRequestState>({ trace: null, error: null, loading: true });

  useEffect(() => {
    let current = true;
    setState((previous) => ({ ...previous, loading: true }));

    channel.request(algorithmId, input).then(
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
  }, [algorithmId, input, channel]);

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
    const unbind = bindKeys(playerCommands(engine), onHelp);
    return () => {
      unbind();
      engine.stop();
    };
  }, [engine, onHelp]);

  return engine;
}

/** Dos trazas, un reloj. Hasta que llegan las dos no hay nada que comparar. */
export function useCompareEngine(
  traces: readonly [EncodedTrace | null, EncodedTrace | null],
  initialCost: number,
  onHelp: () => void,
): CompareEngine | null {
  const start = useRef(initialCost);
  const [left, right] = traces;

  const engine = useMemo(() => {
    if (!left || !right) return null;
    const created = new CompareEngine([left, right], { clock: createRafClock(), prefersReducedMotion });
    if (start.current > 0) created.seek(start.current);
    start.current = 0;
    return created;
  }, [left, right]);

  useLayoutEffect(() => {
    if (!engine) return;
    const unbind = bindKeys(compareCommands(engine), onHelp);
    return () => {
      unbind();
      engine.stop();
    };
  }, [engine, onHelp]);

  return engine;
}

export function usePlayerState<T>(
  source: { readonly store: PlayerStore },
  selector: (state: PlayerState) => T,
): T {
  return useStore(source.store, selector);
}

export function useCompareState<T>(engine: CompareEngine, selector: (state: CompareState) => T): T {
  return useStore(engine.store, selector);
}

/** Un canal de worker propio, que se libera al desmontar. */
export function useTraceChannel(create: () => TraceChannel): TraceChannel {
  const [channel] = useState(create);
  useEffect(() => () => channel.dispose(), [channel]);
  return channel;
}
