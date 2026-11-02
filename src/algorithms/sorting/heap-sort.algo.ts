import { bars, defineAlgorithm, form, heapTree, intArray } from '@/core';

//#region shown
function heapSort(a: number[]): number[] {
  const n = a.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) { // @build
    siftDown(a, i, n);
  }
  for (let end = n - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end], a[0]]; // @swapMax
    siftDown(a, 0, end);
  }
  return a; // @done
}

function siftDown(a: number[], i: number, size: number): void {
  while (true) { // @sift
    const left = 2 * i + 1;
    const right = left + 1;
    let largest = i;
    if (left < size && a[left] > a[largest]) largest = left; // @left
    if (right < size && a[right] > a[largest]) largest = right; // @right
    if (largest === i) return; // @settled
    [a[i], a[largest]] = [a[largest], a[i]]; // @swap
    i = largest;
  }
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Heapsort',
    category: 'sorting',
    summary: 'Convierte el array en un montículo y saca el mayor una y otra vez: n log n sin memoria extra.',
    complexity: {
      time: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)' },
      space: 'O(1)',
    },
    stable: false,
  },

  input: form({
    values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [4, 10, 3, 5, 1, 8, 7] }),
  }),

  views: [
    heapTree('a', { heapSize: 'size', weight: 3 }),
    bars('a', { place: 'stage', pointers: ['i', 'largest'], weight: 2 }),
  ],

  anchors: ['build', 'swapMax', 'done', 'sift', 'left', 'right', 'settled', 'swap'],

  reference: ({ values }) => heapSort([...values]),

  expected: { metric: 'comparisons', formula: '2n log₂ n como mucho', at: ({ values }) => 2 * values.length * Math.log2(Math.max(1, values.length)) },

  examples: [
    { name: 'Desordenado', input: { values: [4, 10, 3, 5, 1, 8, 7] } },
    { name: 'Ya ordenado', input: { values: [1, 2, 3, 4, 5, 6, 7] } },
    { name: 'Inverso: ya es un montículo', input: { values: [7, 6, 5, 4, 3, 2, 1] } },
  ],

  trace({ values }, t) {
    const a = t.array('a', values);
    const n = a.length;

    const siftDown = (start: number, size: number) => {
      let i = start;
      while (true) {
        const left = 2 * i + 1;
        const right = left + 1;
        let largest = i;
        t.step('sift', `Hundo a[${i}] = ${a.peek(i)}: lo comparo con sus hijos`, {
          vars: { i, largest },
          marks: [a.mark(i, 'active')],
        });

        if (left < size) {
          const child = a.get(left);
          const best = a.get(largest);
          if (t.compare(child > best)) largest = left;
          t.step('left', `Hijo izquierdo a[${left}] = ${child}: ${largest === left ? 'es mayor' : 'no es mayor'}`, {
            vars: { largest },
            marks: [a.mark(left, 'compare'), a.mark(largest, 'active')],
            level: 2,
          });
        }
        if (right < size) {
          const child = a.get(right);
          const best = a.get(largest);
          if (t.compare(child > best)) largest = right;
          t.step('right', `Hijo derecho a[${right}] = ${child}: ${largest === right ? 'es el mayor' : 'no es el mayor'}`, {
            vars: { largest },
            marks: [a.mark(right, 'compare'), a.mark(largest, 'active')],
            level: 2,
          });
        }

        if (largest === i) {
          t.step('settled', `a[${i}] es mayor que sus hijos: este subárbol ya es un montículo`, { marks: [a.mark(i, 'active')] });
          return;
        }
        a.swap(i, largest);
        t.step('swap', `Intercambio a[${i}] y a[${largest}]: el mayor sube`, { marks: [a.mark(i, 'swap'), a.mark(largest, 'swap')] });
        i = largest;
      }
    };

    t.vars({ size: n });
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      t.step('build', `Construyo el montículo desde abajo: arreglo el subárbol de a[${i}]`, { vars: { i }, level: 0 });
      siftDown(i, n);
    }

    for (let end = n - 1; end > 0; end--) {
      a.swap(0, end);
      a.setRole(end, 'sorted');
      t.step('swapMax', `El mayor está en la raíz: lo llevo a a[${end}], que ya es su sitio`, {
        vars: { size: end, i: undefined, largest: undefined },
        marks: [a.mark(0, 'swap'), a.mark(end, 'swap')],
        level: 0,
      });
      siftDown(0, end);
    }

    if (n > 0) a.setRole(0, 'sorted');
    t.step('done', 'Array ordenado', { vars: { i: undefined, largest: undefined, size: 0 }, level: 0 });
    return a.toArray();
  },
});
