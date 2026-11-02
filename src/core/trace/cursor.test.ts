import { describe, expect, it } from 'vitest';
import { type AlgorithmDefinition, form, intInRange, runTrace, TraceCursor } from '@/core';
import { seekMatchesSequential } from '../../test/harness';

type Anchors = 'tick';

const counting: AlgorithmDefinition<{ n: number }, number, Anchors> = {
  meta: {
    name: 'Prueba',
    category: 'sorting',
    summary: '',
    complexity: { time: { best: '', average: '', worst: '' }, space: '' },
  },
  input: form({ n: intInRange({ label: 'n', min: 0, max: 100_000, default: 10 }) }),
  views: [],
  anchors: ['tick'],
  reference: ({ n }) => n,
  trace({ n }, t) {
    const a = t.array('a', [0, 0, 0, 0]);
    for (let i = 0; i < n; i++) {
      a.set(i % 4, i);
      t.step('tick', `Paso ${i}`, { vars: { i } });
    }
    return n;
  },
};

describe('TraceCursor', () => {
  it('reconstruye bien una traza que abarca muchos segmentos', () => {
    const trace = runTrace(counting, { n: 12_000 });
    expect(trace.segments.length).toBeGreaterThan(5);
    expect(seekMatchesSequential(trace, 2_000)).toBe(true);
  });

  it('resuelve el frame que coincide con el inicio de un segmento', () => {
    const trace = runTrace(counting, { n: 3_000 });
    const cursor = new TraceCursor(trace);
    for (const start of trace.segmentStart) {
      if (start < 0) continue;
      const frame = cursor.seek(start);
      expect(frame.index).toBe(start);
      expect(frame.explain).toBe(`Paso ${start}`);
    }
  });

  it('no contamina los segmentos en caché al retroceder', () => {
    const trace = runTrace(counting, { n: 400 });
    const cursor = new TraceCursor(trace);
    const first = JSON.stringify(cursor.seek(100).state);
    cursor.seek(200);
    expect(JSON.stringify(cursor.seek(100).state)).toBe(first);
  });

  it('rechaza un frame fuera de la traza', () => {
    const cursor = new TraceCursor(runTrace(counting, { n: 5 }));
    expect(() => cursor.seek(5)).toThrow(RangeError);
    expect(() => cursor.seek(-1)).toThrow(RangeError);
  });
});

describe('runTrace', () => {
  it('trunca al superar el presupuesto de frames', () => {
    const trace = runTrace(counting, { n: 100 }, { budget: { maxFrames: 10, maxBytes: 1_000_000 } });
    expect(trace.header.frameCount).toBe(10);
    expect(trace.header.truncated).toBe('frames');
    expect(trace.header.result).toBeNull();
  });

  it('trunca al superar el presupuesto de bytes', () => {
    const trace = runTrace(counting, { n: 100 }, { budget: { maxFrames: 1_000, maxBytes: 2_000 } });
    expect(trace.header.truncated).toBe('bytes');
  });

  it('propaga los errores que no son de presupuesto', () => {
    const broken = {
      ...counting,
      trace: () => {
        throw new Error('fallo del algoritmo');
      },
    };
    expect(() => runTrace(broken, { n: 1 })).toThrow('fallo del algoritmo');
  });

  it('acumula los cambios de los frames por encima del detalle pedido', () => {
    const detailed: AlgorithmDefinition<{ n: number }, number, Anchors> = {
      ...counting,
      trace({ n }, t) {
        const a = t.array('a', [0]);
        for (let i = 1; i <= n; i++) {
          a.set(0, i);
          t.step('tick', `Paso ${i}`, { level: i % 5 === 0 ? 0 : 2 });
        }
        return n;
      },
    };
    const trace = runTrace(detailed, { n: 10 }, { detail: 0 });
    const cursor = new TraceCursor(trace);
    expect(trace.header.frameCount).toBe(2);
    expect(JSON.stringify(cursor.seek(0).state)).toContain('"value":5');
    expect(JSON.stringify(cursor.seek(1).state)).toContain('"value":10');
  });

  it('normaliza Infinity para que sobreviva a JSON', () => {
    const infinite: AlgorithmDefinition<{ n: number }, number, Anchors> = {
      ...counting,
      trace({ n }, t) {
        t.array('a', [Number.POSITIVE_INFINITY]);
        t.step('tick', 'Infinito', { vars: { best: Number.POSITIVE_INFINITY } });
        return n;
      },
    };
    const { state } = new TraceCursor(runTrace(infinite, { n: 1 })).seek(0);
    expect(state.stack[0]?.vars.best).toBe('∞');
    expect(JSON.stringify(state.structures.a)).toContain('∞');
  });
});
