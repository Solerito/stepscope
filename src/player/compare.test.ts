import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type EncodedTrace, runTrace, TraceCursor } from '@/core';
import fibonacciMemo from '../algorithms/recursion/fibonacci-memo.algo';
import insertionSort from '../algorithms/sorting/insertion-sort.algo';
import mergeSort from '../algorithms/sorting/merge-sort.algo';
import quickSort from '../algorithms/sorting/quick-sort.algo';
import type { Renderer, Scene } from '../scene/types';
import { FakeClock } from '../test/fake-clock';
import { CompareEngine, costColumn, frameAtCost } from './compare';

const values = [38, 27, 43, 3, 9, 82, 10, 3];
const quick = runTrace(quickSort, { values, pivot: 'last', seed: 1 });
const merge = runTrace(mergeSort, { values });

function engineFor(a: EncodedTrace, b: EncodedTrace, reducedMotion = true) {
  const clock = new FakeClock();
  const engine = new CompareEngine([a, b], { clock, prefersReducedMotion: () => reducedMotion });
  return { engine, clock, state: () => engine.store.getState() };
}

const shown = (engine: CompareEngine) => engine.sides.map((side) => side.index);

/** Pulsa «paso siguiente» (o anterior) hasta que no cambie nada, y devuelve por dónde pasa el reloj. */
function walk(engine: CompareEngine, direction: 1 | -1): number[] {
  const visited = [engine.store.getState().cost];
  for (let guard = 0; guard < 100_000; guard++) {
    engine.step(direction);
    const cost = engine.store.getState().cost;
    if (cost === visited.at(-1)) return visited;
    visited.push(cost);
  }
  throw new Error('el reloj no termina');
}

describe('costColumn', () => {
  it('suma comparaciones, escrituras y llamadas de cada frame', () => {
    const costs = costColumn(quick);
    const cursor = new TraceCursor(quick);
    for (let i = 0; i < quick.header.frameCount; i++) {
      const { comparisons, writes, calls } = cursor.countersAt(i);
      expect(costs[i]).toBe(comparisons + writes + calls);
    }
  });

  it('no decrece: el reloj puede buscar por bisección', () => {
    const costs = costColumn(merge);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThanOrEqual(costs[i - 1] as number);
  });
});

describe('frameAtCost', () => {
  const costs = Float64Array.from([1, 1, 2, 2, 2, 5]);

  it('da el último frame que no ha gastado más de lo que marca el reloj', () => {
    expect(frameAtCost(costs, 1)).toBe(1);
    expect(frameAtCost(costs, 2)).toBe(4);
    expect(frameAtCost(costs, 4)).toBe(4);
    expect(frameAtCost(costs, 5)).toBe(5);
    expect(frameAtCost(costs, 99)).toBe(5);
  });

  it('antes de la primera operación enseña el primer frame', () => {
    expect(frameAtCost(costs, 0)).toBe(0);
  });
});

describe('CompareEngine', () => {
  it('el reloj dura lo que el más lento de los dos', () => {
    const { engine, state } = engineFor(quick, merge);
    expect(state().total).toBe(Math.max(...engine.totals));
    expect(state().sides.map((side) => side.total)).toEqual([...engine.totals]);
  });

  it('cada lado enseña el frame que corresponde al trabajo hecho', () => {
    const { engine } = engineFor(quick, merge);
    for (const cost of [0, 7, 23, 40, engine.total]) {
      engine.seek(cost);
      expect(shown(engine)).toEqual(engine.costs.map((costs) => frameAtCost(costs, cost)));
    }
  });

  it('el que termina antes se queda en su último frame', () => {
    const { engine, state } = engineFor(quick, merge);
    const faster = engine.totals[0] < engine.totals[1] ? 0 : 1;
    engine.seek(engine.totals[faster] + 1);
    expect(engine.sides[faster].index).toBe(engine.sides[faster].last);
    expect(engine.sides[1 - faster]?.index).toBeLessThan(engine.sides[1 - faster]?.last ?? 0);
    expect(state().sides[faster]?.cost).toBe(engine.totals[faster]);
  });

  it('cada paso adelante cambia el frame de al menos uno de los dos', () => {
    const { engine } = engineFor(quick, merge);
    let before = shown(engine);
    for (let i = 0; i < 30; i++) {
      engine.step(1);
      const after = shown(engine);
      expect(after).not.toEqual(before);
      before = after;
    }
  });

  it('retroceder pasa por los mismos instantes que avanzar, al revés', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 14 }), (input) => {
        const { engine } = engineFor(
          runTrace(insertionSort, { values: input }),
          runTrace(quickSort, { values: input, pivot: 'median3', seed: 1 }),
        );
        const forward = walk(engine, 1);
        expect(forward.at(-1)).toBe(engine.total);
        const backward = walk(engine, -1);
        expect(backward).toEqual([...forward].reverse());
      }),
      { numRuns: 40 },
    );
  });

  it('reproduce hasta el final del más lento y se detiene solo', () => {
    const { engine, clock, state } = engineFor(quick, merge);
    engine.setSpeed(600);
    engine.play();
    expect(state().playing).toBe(true);
    clock.run(20_000);
    expect(state().cost).toBe(engine.total);
    expect(state().playing).toBe(false);
    expect(shown(engine)).toEqual(engine.sides.map((side) => side.last));
    expect(clock.callback).toBeNull();
  });

  it('reproducir estando al final vuelve a empezar', () => {
    const { engine, state } = engineFor(quick, merge);
    engine.seek(engine.total);
    engine.play();
    expect(state().cost).toBe(0);
    expect(state().playing).toBe(true);
  });

  it('al pausar, los dos lados publican su frame exacto', () => {
    const { engine, clock } = engineFor(quick, merge);
    engine.setSpeed(60);
    engine.play();
    for (let tick = 0; tick < 7; tick++) clock.tick(16);
    engine.pause();
    for (const side of engine.sides) {
      expect(side.store.getState().index).toBe(side.index);
      expect(side.store.getState().playing).toBe(false);
    }
  });

  it('un paso anima los dos lados que cambian y luego para el reloj', () => {
    const { engine, clock } = engineFor(quick, merge, false);
    const painted: Scene[][] = [[], []];
    engine.sides.forEach((side, k) => {
      const renderer: Renderer = {
        paint: (scene) => painted[k]?.push(scene),
        resize: () => {},
        destroy: () => {},
      };
      const spec = side.trace.header.views[0];
      if (!spec) throw new Error('sin vista');
      side.mount(spec, renderer).resize({ width: 600, height: 300 });
    });
    engine.step(1);
    clock.run(400);
    expect(painted.some((scenes) => scenes.length > 3)).toBe(true);
    expect(clock.callback).toBeNull();
  });

  it('no depende de qué algoritmos compara: también con recursión pura', () => {
    const fib = runTrace(fibonacciMemo, { n: 8 });
    const { engine } = engineFor(fib, runTrace(fibonacciMemo, { n: 5 }));
    const forward = walk(engine, 1);
    expect(forward.at(-1)).toBe(engine.total);
    expect(shown(engine)).toEqual(engine.sides.map((side) => side.last));
  });
});
