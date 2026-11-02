import { useRef, useState } from 'react';
import {
  buildSyntheticTrace,
  measureRender,
  measureSeek,
  type RenderMeasure,
  type SeekMeasure,
} from '../../player/bench';
import { createSvgRenderer } from '../../scene/svg-renderer';
import type { Scene } from '../../scene/types';
import styles from './BenchPage.module.css';

interface RenderCase {
  readonly name: string;
  readonly count: number;
  readonly moving: number;
  /** Lo que exige la condición de salida de su fase. */
  readonly minFps: number;
  /** Lienzos que se pintan a la vez, uno encima de otro: la comparación tiene dos. */
  readonly canvases?: number;
}

const CASES: readonly RenderCase[] = [
  { name: '100 elementos, 2 en movimiento', count: 100, moving: 2, minFps: 55 },
  { name: '300 elementos, todos en movimiento', count: 300, moving: 300, minFps: 30 },
  { name: '1 000 elementos, 4 en movimiento', count: 1000, moving: 4, minFps: 30 },
  // Condición de salida de F4. Todos en movimiento es más de lo que mueve una ordenación real.
  {
    name: 'Comparación: dos arrays de 100, todos en movimiento',
    count: 100,
    moving: 100,
    minFps: 30,
    canvases: 2,
  },
];

/** Divide la superficie en tantos lienzos como pida el caso y pinta la misma escena en todos. */
function createCanvases(host: HTMLElement, count: number, width: number, height: number) {
  const slots = Array.from({ length: count }, () => {
    const slot = document.createElement('div');
    slot.style.height = `${height / count}px`;
    host.append(slot);
    const renderer = createSvgRenderer(slot);
    renderer.resize({ width, height: height / count });
    return { slot, renderer };
  });
  return {
    paint: (scene: Scene) => {
      for (const { renderer } of slots) renderer.paint(scene);
    },
    destroy: () => {
      for (const { slot, renderer } of slots) {
        renderer.destroy();
        slot.remove();
      }
    },
  };
}

/** Por debajo de esto, arrastrar la barra se percibe fluido a 30 fps. */
const MAX_DRAG_MS = 33;

type RenderResult = RenderCase & RenderMeasure;

/** Mide en este dispositivo lo que deciden las condiciones de salida de F1 y F4. No aparece en el catálogo. */
export function BenchPage() {
  const surface = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState<RenderResult[]>([]);
  const [seek, setSeek] = useState<SeekMeasure | null>(null);

  const run = async () => {
    const host = surface.current;
    if (!host) return;
    setRunning(true);
    setResults([]);
    setSeek(null);

    const { width, height } = host.getBoundingClientRect();
    const collected: RenderResult[] = [];
    for (const benchCase of CASES) {
      setProgress(benchCase.name);
      const canvases = benchCase.canvases ?? 1;
      const surface = createCanvases(host, canvases, width, height);
      const measure = await measureRender(
        surface.paint,
        benchCase.count,
        benchCase.moving,
        width,
        height / canvases,
      );
      surface.destroy();
      collected.push({ ...benchCase, ...measure });
      setResults([...collected]);
    }

    setProgress('Traza de 100 000 pasos');
    await new Promise((resolve) => setTimeout(resolve, 30));
    setSeek(measureSeek(buildSyntheticTrace(100_000)));

    setProgress('');
    setRunning(false);
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Banco de pruebas</h1>
      <p className={styles.lead}>Mide el rendimiento en este dispositivo. Tarda unos 15 segundos.</p>
      <p className={styles.device}>{navigator.userAgent}</p>

      <button type="button" className={styles.run} disabled={running} onClick={run}>
        {running ? `Midiendo: ${progress}` : 'Empezar la medida'}
      </button>

      <div ref={surface} className={styles.surface} aria-hidden="true" />

      {results.length > 0 ? (
        <table className={styles.table}>
          <caption>Pintado</caption>
          <thead>
            <tr>
              <th scope="col">Caso</th>
              <th scope="col">Fotogramas/s</th>
              <th scope="col">p95 (ms)</th>
              <th scope="col">Pintado (ms)</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.name}>
                <th scope="row">{result.name}</th>
                <td>{result.fps.toFixed(0)}</td>
                <td>{result.p95FrameMs.toFixed(1)}</td>
                <td>{result.paintMs.toFixed(1)}</td>
                <td>{result.fps >= result.minFps ? '✓ Cumple' : `× Exige ${result.minFps}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {seek ? (
        <table className={styles.table}>
          <caption>Reconstruir frames: traza de {seek.frames.toLocaleString('es-ES')} pasos</caption>
          <tbody>
            <tr>
              <th scope="row">Tamaño de la traza</th>
              <td>{seek.megabytes.toFixed(1)} MB</td>
            </tr>
            <tr>
              <th scope="row">Arrastrar la barra, p99</th>
              <td>
                {seek.dragP99Ms.toFixed(1)} ms{' '}
                {seek.dragP99Ms <= MAX_DRAG_MS ? '✓ Cumple' : `× Exige ${MAX_DRAG_MS}`}
              </td>
            </tr>
            <tr>
              <th scope="row">Salto largo, p99</th>
              <td>{seek.jumpP99Ms.toFixed(1)} ms</td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
