import type { Counters } from '@/core';
import type { FrameSource } from '../../player/presenter';
import { usePlayerState } from '../usePlayer';
import styles from './CountersPanel.module.css';

export interface CounterRow {
  readonly key: string;
  readonly label: string;
  readonly value: (counters: Counters) => number;
  /** Con los contadores finales: una fila que acabará en 0 no aporta nada y no se muestra. */
  readonly shows: (final: Counters) => boolean;
}

const row = (key: string, label: string, value: (counters: Counters) => number): CounterRow => ({
  key,
  label,
  value,
  shows: (final) => value(final) > 0,
});

export const COUNTER_ROWS: readonly CounterRow[] = [
  row('comparisons', 'Comparaciones', (counters) => counters.comparisons),
  row('swaps', 'Intercambios', (counters) => counters.swaps),
  row('memory', 'Accesos a memoria', (counters) => counters.reads + counters.writes),
  row('calls', 'Llamadas recursivas', (counters) => counters.calls),
  {
    ...row('naive', 'Sin memoizar serían', (counters) => counters.calls + counters.savedCalls),
    shows: (final) => final.savedCalls > 0,
  },
];

export const formatCount = (value: number) => value.toLocaleString('es-ES');

interface Props {
  readonly engine: FrameSource;
  readonly final: Counters;
}

export function CountersPanel({ engine, final }: Props) {
  const counters = usePlayerState(engine, (state) => state.counters);

  return (
    <dl className={styles.list}>
      {COUNTER_ROWS.filter((counter) => counter.shows(final)).map((counter) => (
        <div key={counter.key} className={styles.row}>
          <dt>{counter.label}</dt>
          <dd className={styles.value}>{formatCount(counter.value(counters))}</dd>
        </div>
      ))}
    </dl>
  );
}
