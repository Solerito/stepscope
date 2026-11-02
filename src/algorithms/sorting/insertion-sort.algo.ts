import { bars, defineAlgorithm, form, intArray } from '@/core';

//#region shown
function insertionSort(a: number[]): number[] {
  for (let i = 1; i < a.length; i++) { // @outer
    const key = a[i]; // @key
    let j = i - 1;
    while (j >= 0 && a[j] > key) { // @compare
      a[j + 1] = a[j]; // @shift
      j--;
    }
    a[j + 1] = key; // @place
  }
  return a; // @done
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Ordenación por inserción',
    category: 'sorting',
    summary: 'Inserta cada elemento en su sitio dentro de la parte ya ordenada, desplazando los mayores.',
    complexity: {
      time: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)' },
      space: 'O(1)',
    },
    stable: true,
  },

  input: form({
    values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [5, 2, 4, 6, 1, 3] }),
  }),

  views: [bars('a', { pointers: ['i', 'j'] })],

  anchors: ['outer', 'key', 'compare', 'shift', 'place', 'done'],

  reference: ({ values }) => insertionSort([...values]),

  check: ({ values }, sorted) =>
    sorted.length !== values.length ? 'ha perdido elementos'
    : sorted.some((v, k) => k > 0 && sorted[k - 1] > v) ? 'no está ordenado'
    : null,

  expected: { metric: 'comparisons', formula: 'n²/4 de media', at: ({ values }) => values.length ** 2 / 4 },

  examples: [
    { name: 'Desordenado', input: { values: [5, 2, 4, 6, 1, 3] } },
    { name: 'Ya ordenado (mejor caso)', input: { values: [1, 2, 3, 4, 5, 6] } },
    { name: 'Inverso (peor caso)', input: { values: [6, 5, 4, 3, 2, 1] } },
  ],

  trace({ values }, t) {
    const a = t.array('a', values);
    a.setRole(0, 'sorted');

    for (let i = 1; i < a.length; i++) {
      t.step('outer', `La parte ordenada llega hasta a[${i - 1}]; toca colocar a[${i}]`, {
        vars: { i, key: undefined, j: undefined },
        level: 0,
      });

      const key = a.get(i);
      t.step('key', `Guardo la clave ${key}`, { vars: { key }, marks: [a.mark(i, 'active', 'clave')] });

      let j = i - 1;
      t.vars({ j });

      while (j >= 0) {
        const current = a.get(j);
        const isGreater = t.compare(current > key);
        t.step('compare', `¿a[${j}] = ${current} > ${key}? ${isGreater ? 'Sí: hay que desplazarlo' : 'No: la clave va justo detrás'}`, {
          marks: [a.mark(j, 'compare')],
          level: 2,
        });
        if (!isGreater) break;

        a.set(j + 1, current);
        t.step('shift', `Copio ${current} a la posición ${j + 1}`, { marks: [a.mark(j + 1, 'write')] });
        j--;
        t.vars({ j });
      }

      a.set(j + 1, key);
      a.setRole(i, 'sorted');
      t.step('place', `Coloco la clave ${key} en la posición ${j + 1}`, { marks: [a.mark(j + 1, 'write')] });
    }

    t.step('done', 'Array ordenado', { vars: { i: undefined, j: undefined, key: undefined }, level: 0 });
    return a.toArray();
  },
});
