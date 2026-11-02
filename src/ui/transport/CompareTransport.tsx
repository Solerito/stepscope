import { useMemo } from 'react';
import type { CompareEngine } from '../../player/compare';
import { useCompareState } from '../usePlayer';
import styles from './Transport.module.css';
import { TransportBar, tickPath } from './TransportBar';

/** Dónde cae cada hito de un lado en la escala común, que cuenta operaciones y no frames. */
function milestoneCosts(level: Uint8Array, costs: Float64Array): number[] {
  const positions: number[] = [];
  for (let i = 0; i < level.length; i++) if (level[i] === 0) positions.push(costs[i] as number);
  return positions;
}

/**
 * El micrómetro de la comparación tiene dos escalas: los hitos de A cuelgan de arriba y los de B suben
 * desde abajo. Una marca larga señala dónde termina cada uno.
 */
export function CompareTransport({ engine }: { readonly engine: CompareEngine }) {
  const cost = useCompareState(engine, (state) => state.cost);
  const playing = useCompareState(engine, (state) => state.playing);
  const speed = useCompareState(engine, (state) => state.speed);
  const { total, totals } = engine;

  const ticks = useMemo(() => {
    const [a, b] = engine.sides;
    const [costsA, costsB] = engine.costs;
    return {
      a: tickPath(milestoneCosts(a.trace.level, costsA), total, 0, 8),
      b: tickPath(milestoneCosts(b.trace.level, costsB), total, 16, 24),
      ends: `${tickPath([totals[0]], total, 0, 13)}${tickPath([totals[1]], total, 11, 24)}`,
    };
  }, [engine, total, totals]);

  return (
    <TransportBar
      position={cost}
      last={total}
      playing={playing}
      speed={speed}
      readout={`Operación ${cost.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')}`}
      unit={['operación/s', 'operaciones/s']}
      ticks={
        <>
          <path d={ticks.a} vectorEffect="non-scaling-stroke" />
          <path d={ticks.b} vectorEffect="non-scaling-stroke" />
          <path className={styles.endTick} d={ticks.ends} vectorEffect="non-scaling-stroke" />
        </>
      }
      onStart={() => engine.seek(0)}
      onStep={(direction) => engine.step(direction)}
      onToggle={() => engine.toggle()}
      onEnd={() => engine.seek(total)}
      onSeek={(position) => engine.seek(position)}
      onScrub={() => engine.pause()}
      onSpeed={(next) => engine.setSpeed(next)}
    />
  );
}
