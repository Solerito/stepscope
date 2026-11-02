import { useMemo, useRef } from 'react';
import type { Level } from '@/core';
import { type PlayerEngine, SPEEDS } from '../../player/engine';
import { usePlayerState } from '../usePlayer';
import styles from './Transport.module.css';

/** Más marcas que esto ya no se distinguen entre sí en la escala. */
const MAX_MILESTONE_TICKS = 300;

function Icon({ path }: { readonly path: string }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  start: 'M5 4h3v16H5zM20 4v16L9 12z',
  back: 'M18 4v16L6 12z',
  play: 'M6 4v16l14-8z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  forward: 'M6 4v16l12-8z',
  end: 'M16 4h3v16h-3zM4 4v16l11-8z',
} as const;

/** La escala del micrómetro: cada marca larga es un hito real de esta traza, no un adorno. */
function milestonePath(level: Uint8Array): string {
  const last = level.length - 1;
  if (last <= 0) return '';
  const positions: number[] = [];
  for (let i = 0; i <= last; i++) {
    if (level[i] === 0) positions.push(i);
  }
  const stride = Math.max(1, Math.ceil(positions.length / MAX_MILESTONE_TICKS));
  let path = '';
  for (let i = 0; i < positions.length; i += stride) {
    path += `M${((positions[i] as number) / last) * 1000} 0V10`;
  }
  return path;
}

export function Transport({ engine }: { readonly engine: PlayerEngine }) {
  const index = usePlayerState(engine, (state) => state.index);
  const frameCount = usePlayerState(engine, (state) => state.frameCount);
  const playing = usePlayerState(engine, (state) => state.playing);
  const speed = usePlayerState(engine, (state) => state.speed);
  const granularity = usePlayerState(engine, (state) => state.granularity);
  const dragging = useRef(false);

  const last = Math.max(0, frameCount - 1);
  const ticks = useMemo(() => milestonePath(engine.trace.level), [engine]);
  const progress = last === 0 ? 100 : (index / last) * 100;

  const human = `Paso ${(index + 1).toLocaleString('es-ES')} de ${frameCount.toLocaleString('es-ES')}`;

  return (
    <div className={styles.bar}>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.button}
          aria-label="Ir al inicio"
          disabled={index === 0}
          onClick={() => engine.seek(0)}
        >
          <Icon path={ICONS.start} />
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label="Paso anterior"
          disabled={index === 0}
          onClick={() => engine.step(-1)}
        >
          <Icon path={ICONS.back} />
        </button>
        <button
          type="button"
          className={styles.playButton}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          onClick={() => engine.toggle()}
        >
          <Icon path={playing ? ICONS.pause : ICONS.play} />
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label="Paso siguiente"
          disabled={index >= last}
          onClick={() => engine.step(1)}
        >
          <Icon path={ICONS.forward} />
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label="Ir al final"
          disabled={index >= last}
          onClick={() => engine.seek(last)}
        >
          <Icon path={ICONS.end} />
        </button>
      </div>

      <div className={styles.scale} style={{ '--progress': `${progress}%` } as React.CSSProperties}>
        <svg className={styles.ticks} viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true">
          <path d={ticks} vectorEffect="non-scaling-stroke" />
        </svg>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={last}
          value={index}
          aria-label="Progreso de la ejecución"
          aria-valuetext={human}
          onPointerDown={() => {
            dragging.current = true;
            engine.pause();
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onChange={(event) => engine.seek(Number(event.target.value))}
        />
      </div>

      <output className={styles.readout} data-testid="position">
        {human}
      </output>

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

      <label className={styles.speed}>
        <span>Velocidad</span>
        <select value={speed} onChange={(event) => engine.setSpeed(Number(event.target.value))}>
          {SPEEDS.map((option) => (
            <option key={option} value={option}>
              {option.toLocaleString('es-ES')} {option === 1 ? 'paso/s' : 'pasos/s'}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
