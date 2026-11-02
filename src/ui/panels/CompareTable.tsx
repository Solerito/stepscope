import { useMemo } from 'react';
import { type Counters, TraceCursor } from '@/core';
import type { CompareEngine } from '../../player/compare';
import { useCompareState, usePlayerState } from '../usePlayer';
import styles from './CompareTable.module.css';
import { COUNTER_ROWS, formatCount } from './CountersPanel';

const formatRatio = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 1 });

/** Quién hace menos trabajo, en una frase. Por letra: con el mismo algoritmo, el nombre no distingue. */
export function verdict(totals: readonly [number, number]): string {
  const [a, b] = totals;
  if (a === b) return `Los dos hacen las mismas operaciones: ${formatCount(a)}.`;
  const [winner, loser] = a < b ? (['A', 'B'] as const) : (['B', 'A'] as const);
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  if (low === 0) return `${winner} no hace ninguna operación; ${loser} hace ${formatCount(high)}.`;
  return `${winner} termina antes: ${formatCount(low)} operaciones frente a ${formatCount(high)} de ${loser}, ${formatRatio(high / low)} veces menos.`;
}

interface Props {
  readonly engine: CompareEngine;
  readonly names: readonly [string, string];
}

/** Los contadores de los dos lados en el mismo instante del reloj, y quién acaba haciendo menos. */
export function CompareTable({ engine, names }: Props) {
  const [left, right] = engine.sides;
  const countersA = usePlayerState(left, (state) => state.counters);
  const countersB = usePlayerState(right, (state) => state.counters);
  const sideA = useCompareState(engine, (state) => state.sides[0]);
  const sideB = useCompareState(engine, (state) => state.sides[1]);

  const finals = useMemo(
    () =>
      engine.sides.map((side) => new TraceCursor(side.trace).countersAt(side.last)) as [Counters, Counters],
    [engine],
  );
  const rows = COUNTER_ROWS.filter((row) => row.shows(finals[0]) || row.shows(finals[1]));

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <caption className={styles.caption}>Contadores en este instante</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className={styles.hidden}>Contador</span>
            </th>
            <th scope="col">A · {names[0]}</th>
            <th scope="col">B · {names[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>{formatCount(row.value(countersA))}</td>
              <td>{formatCount(row.value(countersB))}</td>
            </tr>
          ))}
          <tr className={styles.total}>
            <th scope="row">Operaciones</th>
            <td>
              {formatCount(sideA.cost)} <span className={styles.of}>de {formatCount(sideA.total)}</span>
            </td>
            <td>
              {formatCount(sideB.cost)} <span className={styles.of}>de {formatCount(sideB.total)}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className={styles.verdict} data-testid="verdict">
        {verdict(engine.totals)}
      </p>
      <p className={styles.note}>
        Una operación es una comparación, una escritura o una llamada. El reloj avanza por operaciones, no por
        pasos: un algoritmo que explica más no parece por eso más lento.
      </p>
    </div>
  );
}
