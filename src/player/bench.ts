import { bars, defineAlgorithm, type EncodedTrace, form, intInRange, runTrace, TraceCursor } from '@/core';
import { interpolate } from '../scene/interpolate';
import type { Scene, SceneBox, SceneNode } from '../scene/types';

export interface RenderMeasure {
  readonly fps: number;
  readonly p95FrameMs: number;
  readonly paintMs: number;
}

export interface SeekMeasure {
  readonly frames: number;
  readonly megabytes: number;
  readonly dragP99Ms: number;
  readonly jumpP99Ms: number;
}

const percentile = (values: number[], ratio: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
};

/** Una escena sintética de `count` cajas con etiqueta, repartidas por la superficie. */
export function syntheticScene(
  count: number,
  width: number,
  height: number,
  offset: number,
  moving: number,
): Scene {
  const columns = Math.ceil(Math.sqrt((count * width) / height));
  const rows = Math.ceil(count / columns);
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  const nodes: SceneNode[] = [];
  for (let i = 0; i < count; i++) {
    const box: SceneBox = {
      kind: 'box',
      id: `b${i}`,
      shape: 'rect',
      x: (i % columns) * cellWidth + (i < moving ? offset : 0),
      y: Math.floor(i / columns) * cellHeight,
      w: cellWidth * 0.7,
      h: cellHeight * 0.7,
      label: String(i % 1000),
      labelSize: Math.max(8, Math.min(12, cellHeight * 0.4)),
    };
    nodes.push(box);
  }
  return { nodes };
}

/** Mide el pintado real en este dispositivo: interpola entre dos escenas y pinta en cada frame de pantalla. */
export function measureRender(
  paint: (scene: Scene) => void,
  count: number,
  moving: number,
  width: number,
  height: number,
  durationMs = 2500,
): Promise<RenderMeasure> {
  return new Promise((resolve) => {
    const shift = Math.min(width, height) * 0.02;
    const from = syntheticScene(count, width, height, 0, moving);
    const to = syntheticScene(count, width, height, shift, moving);
    const intervals: number[] = [];
    const paints: number[] = [];
    const started = performance.now();
    let last = started;

    const loop = (now: number) => {
      const elapsed = now - started;
      const t = (Math.sin(elapsed / 130) + 1) / 2;
      const paintStart = performance.now();
      paint(interpolate(from, to, Math.max(0.001, Math.min(0.999, t))));
      paints.push(performance.now() - paintStart);
      if (elapsed > 50) intervals.push(now - last);
      last = now;

      if (elapsed < durationMs) {
        requestAnimationFrame(loop);
        return;
      }
      resolve({
        fps: intervals.length > 0 ? 1000 / percentile(intervals, 0.5) : 0,
        p95FrameMs: percentile(intervals, 0.95),
        paintMs: percentile(paints, 0.5),
      });
    };
    requestAnimationFrame(loop);
  });
}

const syntheticAlgorithm = defineAlgorithm({
  meta: {
    name: 'Traza sintética',
    category: 'sorting',
    summary: 'Solo para el banco de pruebas.',
    complexity: { time: { best: '', average: '', worst: '' }, space: '' },
  },
  input: form({ frames: intInRange({ label: 'frames', min: 1, max: 250_000, default: 100_000 }) }),
  views: [bars('a')],
  anchors: ['swap'],
  reference: ({ frames }) => frames,
  trace({ frames }, t) {
    const a = t.array(
      'a',
      Array.from({ length: 100 }, (_, i) => i),
    );
    for (let i = 0; i < frames; i++) {
      const first = i % 100;
      const second = (i * 31) % 100;
      a.swap(first, second);
      t.step('swap', `Intercambio a[${first}] y a[${second}]`, {
        vars: { i, first, second },
        marks: [a.mark(first, 'swap'), a.mark(second, 'swap')],
      });
    }
    return frames;
  },
});

export function buildSyntheticTrace(frames: number): EncodedTrace {
  return runTrace(syntheticAlgorithm, { frames });
}

/** Mide reconstruir frames como lo haría arrastrar la barra y como un salto largo. */
export function measureSeek(trace: EncodedTrace): SeekMeasure {
  const cursor = new TraceCursor(trace);
  const frames = trace.header.frameCount;
  const seed = (i: number) => ((i * 2654435761) >>> 0) / 2 ** 32;

  const jump: number[] = [];
  for (let sample = 0; sample < 400; sample++) {
    const start = performance.now();
    cursor.seek(Math.floor(seed(sample) * frames));
    jump.push(performance.now() - start);
  }

  const drag: number[] = [];
  let position = Math.floor(frames / 2);
  for (let sample = 0; sample < 400; sample++) {
    position = Math.max(
      0,
      Math.min(frames - 1, position + Math.floor((seed(sample) - 0.5) * (frames / 100))),
    );
    const start = performance.now();
    cursor.seek(position);
    drag.push(performance.now() - start);
  }

  const bytes = trace.segments.reduce((total, segment) => total + segment.length, 0);
  return {
    frames,
    megabytes: bytes / 2 ** 20,
    dragP99Ms: percentile(drag, 0.99),
    jumpP99Ms: percentile(jump, 0.99),
  };
}
