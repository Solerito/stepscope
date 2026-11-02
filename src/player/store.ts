import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Counters, Level, Phase, VarValue } from '@/core';

/** Lo que necesitan los paneles de React. La escena no pasa por aquí: va directa al pintor. */
export interface PlayerState {
  readonly index: number;
  readonly frameCount: number;
  readonly playing: boolean;
  readonly speed: number;
  /** Nivel máximo de los frames por los que se avanza: 2 = todo, 1 = sin comparaciones, 0 = solo hitos. */
  readonly granularity: Level;
  readonly explain: string;
  readonly anchor: string | null;
  readonly phase: Phase;
  readonly counters: Counters;
  readonly vars: Readonly<Record<string, VarValue>>;
  /** Variables que han cambiado respecto a lo último que se mostró. */
  readonly changedVars: readonly string[];
  /** El estado de cada vista en palabras. Solo se calcula sin reproducción en marcha. */
  readonly descriptions: Readonly<Record<string, string>>;
}

export type PlayerStore = StoreApi<PlayerState>;

const NO_COUNTERS: Counters = { comparisons: 0, swaps: 0, reads: 0, writes: 0, calls: 0, savedCalls: 0 };

export function createPlayerStore(frameCount: number, speed: number): PlayerStore {
  return createStore<PlayerState>()(() => ({
    index: 0,
    frameCount,
    playing: false,
    speed,
    granularity: 2,
    explain: '',
    anchor: null,
    phase: 'step',
    counters: NO_COUNTERS,
    vars: {},
    changedVars: [],
    descriptions: {},
  }));
}
