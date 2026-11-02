import { useRef, useState } from 'react';
import {
  buildSyntheticTrace,
  measureRender,
  measureSeek,
  type RenderMeasure,
  type SeekMeasure,
} from '../../player/bench';
import { createSvgRenderer } from '../../scene/svg-renderer';
import styles from './BenchPage.module.css';

interface RenderCase {
  readonly name: string;
  readonly count: number;
  readonly moving: number;
  /** Lo que exige la condición de salida de la Fase 1. */
  readonly minFps: number;
}

const CASES: readonly RenderCase[] = [
  { name: '100 elementos, 2 en movimiento', count: 100, moving: 2, minFps: 55 },
  { name: '300 elementos, todos en movimiento', count: 300, moving: 300, minFps: 30 },
  { name: '1 000 elementos, 4 en movimiento', count: 1000, moving: 4, minFps: 30 },
];

/** Por debajo de esto, arrastrar la barra se percibe fluido a 30 fps. */
const MAX_DRAG_MS = 33;

type RenderResult = RenderCase & RenderMeasure;

/** Mide en este dispositivo lo que decide la condición de salida de la Fase 1. No aparece en el catálogo. */
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
      const renderer = createSvgRenderer(host);
      renderer.resize({ width, height });
      const measure = await measureRender(
        (scene) => renderer.paint(scene),
        benchCase.count,
        benchCase.moving,
        width,
        height,
      );
      renderer.destroy();
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
      <p className={styles.lead}>Mide el rendimiento en este dispositivo. Tarda unos 10 segundos.</p>
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
