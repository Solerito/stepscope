import type { ReactNode } from 'react';
import { SPEEDS } from '../../player/engine';
import styles from './Transport.module.css';

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

/** Más marcas que esto ya no se distinguen entre sí en la escala. */
const MAX_TICKS = 300;

/**
 * Trazos de la escala del micrómetro, en un lienzo de 1000 × 24. Cada marca es un hito real de la
 * traza, no un adorno. `from` y `to` acotan la altura: la comparación pone un lado arriba y otro abajo.
 */
export function tickPath(positions: readonly number[], last: number, from = 0, to = 10): string {
  if (last <= 0) return '';
  const stride = Math.max(1, Math.ceil(positions.length / MAX_TICKS));
  let path = '';
  for (let i = 0; i < positions.length; i += stride) {
    // Sin pegarse al borde: una marca justo en 0 o en 1000 perdería medio trazo.
    const x = Math.min(998, Math.max(2, ((positions[i] as number) / last) * 1000));
    path += `M${x} ${from}V${to}`;
  }
  return path;
}

export interface TransportBarProps {
  readonly position: number;
  readonly last: number;
  readonly playing: boolean;
  readonly speed: number;
  /** Cómo se lee la posición: «Paso 3 de 37», «Operación 40 de 160». */
  readonly readout: string;
  /** Unidad de la velocidad, en singular y en plural. */
  readonly unit: readonly [string, string];
  readonly ticks: ReactNode;
  readonly onStart: () => void;
  readonly onStep: (direction: 1 | -1) => void;
  readonly onToggle: () => void;
  readonly onEnd: () => void;
  readonly onSeek: (position: number) => void;
  /** Al empezar a arrastrar la barra: la reproducción se para. */
  readonly onScrub: () => void;
  readonly onSpeed: (speed: number) => void;
  /** Controles propios de cada reloj, como la granularidad. */
  readonly children?: ReactNode;
}

/** El cuerpo del instrumento: botones, micrómetro y velocidad. No sabe qué reloj lo mueve. */
export function TransportBar(props: TransportBarProps) {
  const { position, last, playing, speed, readout, unit } = props;
  const progress = last <= 0 ? 100 : (position / last) * 100;

  return (
    <div className={styles.bar}>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.button}
          aria-label="Ir al inicio"
          disabled={position === 0}
          onClick={props.onStart}
        >
          <Icon path={ICONS.start} />
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label="Paso anterior"
          disabled={position === 0}
          onClick={() => props.onStep(-1)}
        >
          <Icon path={ICONS.back} />
        </button>
        <button
          type="button"
          className={styles.playButton}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          onClick={props.onToggle}
        >
          <Icon path={playing ? ICONS.pause : ICONS.play} />
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label="Paso siguiente"
          disabled={position >= last}
          onClick={() => props.onStep(1)}
        >
          <Icon path={ICONS.forward} />
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label="Ir al final"
          disabled={position >= last}
          onClick={props.onEnd}
        >
          <Icon path={ICONS.end} />
        </button>
      </div>

      <div className={styles.scale} style={{ '--progress': `${progress}%` } as React.CSSProperties}>
        <svg className={styles.ticks} viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true">
          {props.ticks}
        </svg>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={last}
          value={position}
          aria-label="Progreso de la ejecución"
          aria-valuetext={readout}
          onPointerDown={props.onScrub}
          onChange={(event) => props.onSeek(Number(event.target.value))}
        />
      </div>

      <output className={styles.readout} data-testid="position">
        {readout}
      </output>

      {props.children}

      <label className={styles.speed}>
        <span>Velocidad</span>
        <select value={speed} onChange={(event) => props.onSpeed(Number(event.target.value))}>
          {SPEEDS.map((option) => (
            <option key={option} value={option}>
              {option.toLocaleString('es-ES')} {option === 1 ? unit[0] : unit[1]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
