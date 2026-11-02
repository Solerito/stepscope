import type { TraceHeader } from '@/core';
import type { FrameSource } from '../../player/presenter';
import { usePlayerState } from '../usePlayer';
import { PHASE_LABELS } from './CodePanel';
import styles from './Explanation.module.css';

const TRUNCATED_NOTICE: Readonly<Record<NonNullable<TraceHeader['truncated']>, string>> = {
  frames:
    'Esta ejecución es demasiado larga: solo se muestran sus primeros pasos. Prueba con una entrada más pequeña.',
  bytes:
    'Esta ejecución ocupa demasiado: solo se muestran sus primeros pasos. Prueba con una entrada más pequeña.',
  time: 'Esta ejecución tarda demasiado: solo se muestran sus primeros pasos. Prueba con una entrada más pequeña.',
};

interface Props {
  readonly engine: FrameSource;
  readonly truncated: TraceHeader['truncated'];
}

export function Explanation({ engine, truncated }: Props) {
  const explain = usePlayerState(engine, (state) => state.explain);
  const phase = usePlayerState(engine, (state) => state.phase);
  const playing = usePlayerState(engine, (state) => state.playing);
  const badge = PHASE_LABELS[phase];

  return (
    <div className={styles.block}>
      {/* Durante la reproducción no se anuncia nada: un lector de pantalla no daría abasto. */}
      <p className={styles.explain} aria-live={playing ? 'off' : 'polite'} data-testid="explanation">
        {badge ? <span aria-hidden="true">{badge.glyph} </span> : null}
        {explain}
      </p>
      {truncated ? (
        <p className={styles.notice} role="status">
          {TRUNCATED_NOTICE[truncated]}
        </p>
      ) : null}
    </div>
  );
}
