import { describe, expect, it } from 'vitest';
import { runTrace, TraceCursor, type ViewSpec } from '@/core';
import fibonacciMemo from '../algorithms/recursion/fibonacci-memo.algo';
import { algorithms } from '../algorithms/registry';
import binarySearch from '../algorithms/searching/binary-search.algo';
import heapSort from '../algorithms/sorting/heap-sort.algo';
import insertionSort from '../algorithms/sorting/insertion-sort.algo';
import quickSort from '../algorithms/sorting/quick-sort.algo';
import radixSort from '../algorithms/sorting/radix-sort.algo';
import type { Scene, SceneBox, Viewport } from '../scene/types';
import { barsView } from './bars.view';
import { layoutTree } from './layout/tree-layout';
import { duplicatedKinds, viewFor } from './registry';

const DESKTOP: Viewport = { width: 800, height: 500 };
const PHONE: Viewport = { width: 360, height: 220 };
const boxesOf = (scene: Scene) => scene.nodes.filter((node): node is SceneBox => node.kind === 'box');

// biome-ignore lint/suspicious/noExplicitAny: cualquier algoritmo del registro
function scenesOf(definition: any, input: unknown, spec: ViewSpec, viewport = DESKTOP): Scene[] {
  const trace = runTrace(definition, input);
  const cursor = new TraceCursor(trace);
  const view = viewFor(spec.view);
  const finalState = structuredClone(new TraceCursor(trace).seek(trace.header.frameCount - 1).state);
  const prepared = view.prepare?.(trace.header, finalState, viewport, spec);
  const scenes: Scene[] = [];
  for (let i = 0; i < trace.header.frameCount; i++) {
    scenes.push(view.build(cursor.seek(i), spec, viewport, prepared));
  }
  return scenes;
}

function expectInside(scene: Scene, { width, height }: Viewport) {
  for (const box of boxesOf(scene)) {
    expect(box.x, box.id).toBeGreaterThanOrEqual(0);
    expect(box.y, box.id).toBeGreaterThanOrEqual(0);
    expect(box.x + box.w, box.id).toBeLessThanOrEqual(width + 0.001);
    expect(box.y + box.h, box.id).toBeLessThanOrEqual(height + 0.001);
  }
}

function expectUniqueIds(scene: Scene) {
  const ids = scene.nodes.map((node) => node.id);
  expect(new Set(ids).size).toBe(ids.length);
}

/** Como la batería de algoritmos: toda vista de todo algoritmo, sin escribir nada por algoritmo. */
describe.each(algorithms)('vistas de $id', (algorithm) => {
  const inputs = (algorithm.examples ?? []).map((example) => example.input);

  it.each(algorithm.views.map((spec) => [spec.view, spec] as const))(
    '%s cabe en escritorio y en móvil, sin IDs repetidos',
    (_name, spec) => {
      for (const input of inputs) {
        for (const viewport of [DESKTOP, PHONE]) {
          for (const scene of scenesOf(algorithm, input, spec, viewport)) {
            expectInside(scene, viewport);
            expectUniqueIds(scene);
          }
        }
      }
    },
  );
});

describe('bars', () => {
  const spec = insertionSort.views[0] as ViewSpec;

  it('coloca las barras en el orden del array', () => {
    const lastScene = scenesOf(insertionSort, { values: [3, 1, 2] }, spec).at(-1) as Scene;
    const labels = boxesOf(lastScene)
      .sort((a, b) => a.x - b.x)
      .map((box) => box.label);
    expect(labels).toEqual(['1', '2', '3']);
  });

  it('dibuja los punteros que nombra la vista con la posición de su variable', () => {
    const pointer = scenesOf(insertionSort, { values: [3, 1, 2] }, spec)[0]?.nodes.find(
      (node) => node.id === 'ptr-i',
    );
    expect(pointer?.kind).toBe('text');
  });

  it('apila los punteros que señalan la misma casilla, sin taparse', () => {
    const scenes = scenesOf(binarySearch, { values: [1, 3], target: 1 }, binarySearch.views[0] as ViewSpec);
    const sameSpot = scenes.find((scene) => {
      const lo = scene.nodes.find((node) => node.id === 'ptr-lo');
      const mid = scene.nodes.find((node) => node.id === 'ptr-mid');
      return lo && mid && lo.kind === 'text' && mid.kind === 'text' && lo.x === mid.x;
    });
    const lo = sameSpot?.nodes.find((node) => node.id === 'ptr-lo');
    const mid = sameSpot?.nodes.find((node) => node.id === 'ptr-mid');
    expect(lo?.kind === 'text' && mid?.kind === 'text' && lo.y !== mid.y).toBe(true);
  });

  it('describe el estado en palabras', () => {
    const cursor = new TraceCursor(runTrace(insertionSort, { values: [3, 1] }));
    expect(barsView.describe(cursor.seek(0), spec)).toBe('Array con 2 elementos: 3, 1.');
  });
});

describe('call-tree', () => {
  const spec = fibonacciMemo.views[0] as ViewSpec;

  it('los nodos ya dibujados no se mueven cuando el árbol crece', () => {
    const firstSeen = new Map<string, { x: number; y: number }>();
    for (const scene of scenesOf(fibonacciMemo, { n: 7 }, spec)) {
      for (const box of boxesOf(scene).filter((node) => node.id.startsWith('call-'))) {
        const seen = firstSeen.get(box.id);
        if (seen) expect({ x: box.x, y: box.y }).toEqual(seen);
        else firstSeen.set(box.id, { x: box.x, y: box.y });
      }
    }
    expect(firstSeen.size).toBe(13);
  });

  it('marca los aciertos de memo con su rol y lo que ahorran', () => {
    const hit = boxesOf(scenesOf(fibonacciMemo, { n: 6 }, spec).at(-1) as Scene).find(
      (box) => box.role === 'memo-hit',
    );
    expect(hit?.badge).toMatch(/−\d+ llamadas/);
  });

  it('el valor devuelto sale del hijo que retorna', () => {
    const tokens = scenesOf(fibonacciMemo, { n: 4 }, spec).flatMap((scene) =>
      boxesOf(scene).filter((box) => box.role === 'returned'),
    );
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) expect(token.enterFrom).toMatch(/^call-\d+$/);
  });

  it('una función sin valor de retorno no enseña «= null»', () => {
    const lastScene = scenesOf(quickSort, quickSort.input.default, quickSort.views[1] as ViewSpec).at(
      -1,
    ) as Scene;
    expect(boxesOf(lastScene).some((box) => box.badge?.includes('null'))).toBe(false);
  });
});

describe('call-stack', () => {
  const spec = fibonacciMemo.views[1] as ViewSpec;

  it('un marco nuevo no desplaza a los que ya estaban si la recursión cabe', () => {
    const position = new Map<string, number>();
    for (const scene of scenesOf(fibonacciMemo, { n: 5 }, spec)) {
      for (const box of boxesOf(scene)) {
        const seen = position.get(box.id);
        if (seen !== undefined) expect(box.y).toBe(seen);
        else position.set(box.id, box.y);
      }
    }
  });

  it('con recursión muy honda enseña los de arriba y cuántos quedan debajo', () => {
    const sorted = Array.from({ length: 60 }, (_, i) => i);
    const stack = quickSort.views[2] as ViewSpec;
    const scenes = scenesOf(quickSort, { values: sorted, pivot: 'last', seed: 1 }, stack, PHONE);
    const deepest = scenes.find((scene) => scene.nodes.some((node) => node.id === 'hidden-frames'));
    expect(deepest).toBeDefined();
    for (const scene of scenes) {
      expectInside(scene, PHONE);
      expect(boxesOf(scene).filter((box) => box.role === 'active').length).toBeLessThanOrEqual(1);
    }
  });
});

describe('heap-tree', () => {
  it('solo une los nodos que siguen dentro del montículo', () => {
    const spec = heapSort.views[0] as ViewSpec;
    for (const scene of scenesOf(heapSort, { values: [4, 10, 3, 5, 1, 8, 7] }, spec)) {
      const links = scene.nodes.filter((node) => node.kind === 'link').length;
      expect(links).toBeLessThanOrEqual(6);
    }
    const lastScene = scenesOf(heapSort, { values: [4, 10, 3, 5, 1, 8, 7] }, spec).at(-1) as Scene;
    expect(lastScene.nodes.filter((node) => node.kind === 'link')).toHaveLength(0);
  });
});

describe('buckets', () => {
  it('apila los elementos de cada cubeta de abajo arriba', () => {
    const spec = radixSort.views[1] as ViewSpec;
    const full = scenesOf(radixSort, { values: [12, 22, 32] }, spec).reduce((best, scene) =>
      boxesOf(scene).length > boxesOf(best).length ? scene : best,
    );
    const ys = boxesOf(full).map((box) => box.y);
    expect(new Set(ys).size).toBe(3);
  });
});

describe('layoutTree', () => {
  it('centra cada padre sobre sus hijos y da una columna a cada hoja', () => {
    const layout = layoutTree([
      { id: 0, parent: null },
      { id: 1, parent: 0 },
      { id: 2, parent: 0 },
    ]);
    expect(layout.width).toBe(2);
    expect(layout.maxDepth).toBe(1);
    expect(layout.positions.get(0)).toEqual({ x: 0.5, depth: 0 });
    expect(layout.positions.get(1)).toEqual({ x: 0, depth: 1 });
    expect(layout.positions.get(2)).toEqual({ x: 1, depth: 1 });
  });

  it('acepta un árbol vacío', () => {
    expect(layoutTree([]).width).toBe(1);
  });
});

describe('registro de vistas', () => {
  it('cada tipo de vista lo declara un solo archivo', () => {
    // El registro resuelve los duplicados quedándose con el último que carga el glob, sin
    // avisar: un `*.view.ts` nuevo que declare «bars» cambiaría cómo se pintan nueve
    // algoritmos y ningún otro test fallaría.
    expect(duplicatedKinds).toEqual([]);
  });
});
