import { useEffect, useMemo, useRef } from 'react';
import { highlight } from 'sugar-high';
import type { Phase, ShownSource } from '@/core';
import type { PlayerEngine } from '../../player/engine';
import { usePlayerState } from '../usePlayer';
import styles from './CodePanel.module.css';

/** Bajar y subir se distinguen por forma y texto, no solo por color. */
export const PHASE_LABELS: Readonly<Record<Phase, { readonly glyph: string; readonly text: string } | null>> =
  {
    step: null,
    call: { glyph: '▼', text: 'Llamada' },
    return: { glyph: '▲', text: 'Retorno' },
    'memo-hit': { glyph: '⧉', text: 'Memo' },
    prune: { glyph: '✂︎', text: 'Poda' },
  };

interface Props {
  readonly engine: PlayerEngine;
  readonly source: ShownSource;
}

export function CodePanel({ engine, source }: Props) {
  const anchor = usePlayerState(engine, (state) => state.anchor);
  const phase = usePlayerState(engine, (state) => state.phase);
  const activeLine = anchor === null ? null : (source.lineOf[anchor] ?? null);
  const activeElement = useRef<HTMLLIElement>(null);

  const lines = useMemo(() => highlight(source.code).split('\n'), [source.code]);
  const badge = PHASE_LABELS[phase];

  // biome-ignore lint/correctness/useExhaustiveDependencies: hay que seguir la línea cada vez que cambia
  useEffect(() => {
    activeElement.current?.scrollIntoView({ block: 'nearest' });
  }, [activeLine]);

  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: tiene scroll propio; sin foco no se podría desplazar con teclado
    <section className={styles.code} tabIndex={0} aria-label="Código del algoritmo">
      <ol className={styles.lines}>
        {lines.map((html, index) => {
          const lineNumber = index + 1;
          const isActive = lineNumber === activeLine;
          return (
            <li
              key={lineNumber}
              ref={isActive ? activeElement : undefined}
              className={styles.line}
              data-active={isActive}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className={styles.gutter} aria-hidden="true">
                {isActive ? '▶' : lineNumber}
              </span>
              <span className={styles.content}>
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: sale de sugar-high sobre código de este mismo repositorio */}
                <code dangerouslySetInnerHTML={{ __html: html }} />
                {isActive && badge ? (
                  <span className={styles.badge} data-phase={phase}>
                    {badge.glyph} {badge.text}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
