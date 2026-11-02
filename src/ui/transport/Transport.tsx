import { useMemo } from 'react';
import type { Level } from '@/core';
import type { PlayerEngine } from '../../player/engine';
import { usePlayerState } from '../usePlayer';
import styles from './Transport.module.css';
import { TransportBar, tickPath } from './TransportBar';

function milestones(level: Uint8Array): number[] {
  const positions: number[] = [];
  for (let i = 0; i < level.length; i++) if (level[i] === 0) positions.push(i);
  return positions;
}

export function Transport({ engine }: { readonly engine: PlayerEngine }) {
  const index = usePlayerState(engine, (state) => state.index);
  const frameCount = usePlayerState(engine, (state) => state.frameCount);
  const playing = usePlayerState(engine, (state) => state.playing);
  const speed = usePlayerState(engine, (state) => state.speed);
  const granularity = usePlayerState(engine, (state) => state.granularity);

  const last = Math.max(0, frameCount - 1);
  const ticks = useMemo(() => tickPath(milestones(engine.trace.level), last), [engine, last]);

  return (
    <TransportBar
      position={index}
      last={last}
      playing={playing}
      speed={speed}
      readout={`Paso ${(index + 1).toLocaleString('es-ES')} de ${frameCount.toLocaleString('es-ES')}`}
      unit={['paso/s', 'pasos/s']}
      ticks={<path d={ticks} vectorEffect="non-scaling-stroke" />}
      onStart={() => engine.seek(0)}
      onStep={(direction) => engine.step(direction)}
      onToggle={() => engine.toggle()}
      onEnd={() => engine.seek(last)}
      onSeek={(position) => engine.seek(position)}
      onScrub={() => engine.pause()}
      onSpeed={(next) => engine.setSpeed(next)}
    >
      <label className={styles.granularity}>
        <span>Avanzar</span>
        <select
          value={granularity}
          onChange={(event) => engine.setGranularity(Number(event.target.value) as Level)}
        >
          <option value={2}>Con todo el detalle</option>
          <option value={1}>Sin comparaciones</option>
          <option value={0}>Solo hitos</option>
        </select>
      </label>
    </TransportBar>
  );
}
