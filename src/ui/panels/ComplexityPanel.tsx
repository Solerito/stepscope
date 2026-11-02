import type { CounterName, Counters } from '@/core';
import type { RegisteredAlgorithm } from '../../algorithms/registry';
import styles from './ComplexityPanel.module.css';

const METRIC_NAMES: Readonly<Record<CounterName, string>> = {
  comparisons: 'comparaciones',
  swaps: 'intercambios',
  reads: 'lecturas',
  writes: 'escrituras',
  calls: 'llamadas',
  savedCalls: 'llamadas ahorradas',
};

const format = (value: number) => Math.round(value).toLocaleString('es-ES');

interface Props {
  readonly algorithm: RegisteredAlgorithm;
  readonly input: unknown;
  /** Contadores al final de la ejecución: el coste real de esta entrada. */
  readonly final: Counters;
}

export function ComplexityPanel({ algorithm, input, final }: Props) {
  const { time, space } = algorithm.meta.complexity;
  const expected = algorithm.expected;

  return (
    <div className={styles.panel}>
      <dl className={styles.table}>
        <div className={styles.row}>
          <dt>Mejor caso</dt>
          <dd>{time.best}</dd>
        </div>
        <div className={styles.row}>
          <dt>Caso medio</dt>
          <dd>{time.average}</dd>
        </div>
        <div className={styles.row}>
          <dt>Peor caso</dt>
          <dd>{time.worst}</dd>
        </div>
        <div className={styles.row}>
          <dt>Memoria</dt>
          <dd>{space}</dd>
        </div>
      </dl>

      {expected ? (
        <p className={styles.contrast} data-testid="complexity-contrast">
          Esta ejecución ha hecho{' '}
          <strong>
            {format(final[expected.metric])} {METRIC_NAMES[expected.metric]}
          </strong>
          . La teoría, {expected.formula}, da unas {format(expected.at(input))} para esta entrada.
        </p>
      ) : null}
    </div>
  );
}
