import { useEffect, useRef } from 'react';
import type { ViewSpec } from '@/core';
import type { FrameSource } from '../../player/presenter';
import { createSvgRenderer } from '../../scene/svg-renderer';
import { keyOf } from '../../views/registry';
import { usePlayerState } from '../usePlayer';
import styles from './ViewPane.module.css';

interface Props {
  readonly engine: FrameSource;
  readonly spec: ViewSpec;
  readonly title: string;
}

/** Un lienzo. React solo lo monta: a partir de ahí, el reproductor pinta sin pasar por React. */
export function ViewPane({ engine, spec, title }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const description = usePlayerState(engine, (state) => state.descriptions[keyOf(spec)] ?? '');

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const handle = engine.mount(spec, createSvgRenderer(element));
    const observer = new ResizeObserver(([entry]) => {
      if (entry) handle.resize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      handle.unmount();
    };
  }, [engine, spec]);

  return (
    <div
      ref={host}
      className={styles.pane}
      role="img"
      aria-label={description ? `${title}. ${description}` : title}
      data-view={spec.view}
    />
  );
}
