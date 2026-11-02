import { bars, defineAlgorithm, form, intArray } from '@/core';

//#region shown
function selectionSort(a: number[]): number[] {
  for (let i = 0; i < a.length - 1; i++) { // @pass
    let min = i;
    for (let j = i + 1; j < a.length; j++) {
      if (a[j] < a[min]) min = j; // @compare
    }
    [a[i], a[min]] = [a[min], a[i]]; // @swap
  }
  return a; // @done
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Ordenación por selección',
    category: 'sorting',
    summary: 'Busca el mínimo de lo que queda y lo pone en su sitio: siempre n−1 intercambios, como mucho.',
    complexity: {
      time: { best: 'O(n²)', average: 'O(n²)', worst: 'O(n²)' },
      space: 'O(1)',
    },
    stable: false,
  },

  input: form({
    values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [29, 10, 14, 37, 13, 5] }),
  }),

  views: [bars('a', { pointers: ['i', 'j'] })],

  anchors: ['pass', 'compare', 'swap', 'done'],

  reference: ({ values }) => selectionSort([...values]),

  expected: { metric: 'comparisons', formula: 'n(n−1)/2 siempre', at: ({ values }) => (values.length * (values.length - 1)) / 2 },

  examples: [
    { name: 'Desordenado', input: { values: [29, 10, 14, 37, 13, 5] } },
    { name: 'Ya ordenado: compara igual', input: { values: [1, 2, 3, 4, 5, 6] } },
    { name: 'Con duplicados: no es estable', input: { values: [3, 1, 3, 2, 1] } },
  ],

  trace({ values }, t) {
    const a = t.array('a', values);

    for (let i = 0; i < a.length - 1; i++) {
      let min = i;
      t.step('pass', `Busco el mínimo de a[${i}..${a.length - 1}] para ponerlo en a[${i}]`, {
        vars: { i, min, j: undefined },
        marks: [a.mark(i, 'min', 'mínimo')],
        level: 0,
      });

      for (let j = i + 1; j < a.length; j++) {
        const candidate = a.get(j);
        const best = a.get(min);
        const smaller = t.compare(candidate < best);
        if (smaller) min = j;
        t.step('compare', smaller ? `a[${j}] = ${candidate} < ${best}: es el nuevo mínimo` : `a[${j}] = ${candidate} no es menor que ${best}`, {
          vars: { j, min },
          marks: smaller ? [a.mark(j, 'min', 'mínimo')] : [a.mark(j, 'compare'), a.mark(min, 'min', 'mínimo')],
          level: 2,
        });
      }

      a.swap(i, min);
      a.setRole(i, 'sorted');
      t.step('swap', min === i ? `a[${i}] ya era el mínimo: se queda donde está` : `Intercambio a[${i}] y a[${min}]: el mínimo pasa a su sitio`, {
        marks: min === i ? [a.mark(i, 'swap')] : [a.mark(i, 'swap'), a.mark(min, 'swap')],
      });
    }

    if (a.length > 0) a.setRole(a.length - 1, 'sorted');
    t.step('done', 'Array ordenado', { vars: { i: undefined, j: undefined, min: undefined }, level: 0 });
    return a.toArray();
  },
});
