import type { Counters } from '@/core';
import type { PlayerEngine } from '../../player/engine';
import { usePlayerState } from '../usePlayer';
import styles from './CountersPanel.module.css';

interface Props {
  readonly engine: PlayerEngine;
  /** Los contadores al final de la traza: uno que acabará en 0 no aporta nada y no se muestra. */
  readonly final: Counters;
}

const format = (value: number) => value.toLocaleString('es-ES');

export function CountersPanel({ engine, final }: Props) {
  const counters = usePlayerState(engine, (state) => state.counters);

  const rows = [
    { key: 'comparisons', label: 'Comparaciones', value: counters.comparisons, show: final.comparisons > 0 },
    { key: 'swaps', label: 'Intercambios', value: counters.swaps, show: final.swaps > 0 },
    {
      key: 'memory',
      label: 'Accesos a memoria',
      value: counters.reads + counters.writes,
      show: final.reads + final.writes > 0,
    },
    { key: 'calls', label: 'Llamadas recursivas', value: counters.calls, show: final.calls > 0 },
    {
      key: 'naive',
      label: 'Sin memoizar serían',
      value: counters.calls + counters.savedCalls,
      show: final.savedCalls > 0,
    },
  ].filter((row) => row.show);

  return (
    <dl className={styles.list}>
      {rows.map((row) => (
        <div key={row.key} className={styles.row}>
          <dt>{row.label}</dt>
          <dd className={styles.value}>{format(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
