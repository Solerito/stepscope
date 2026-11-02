import { bars, defineAlgorithm, form, intArray } from '@/core';

//#region shown
function bubbleSort(a: number[]): number[] {
  for (let end = a.length - 1; end > 0; end--) { // @pass
    let swapped = false;
    for (let i = 0; i < end; i++) {
      if (a[i] > a[i + 1]) { // @compare
        [a[i], a[i + 1]] = [a[i + 1], a[i]]; // @swap
        swapped = true;
      }
    }
    if (!swapped) return a; // @early
  }
  return a; // @done
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Ordenación por burbuja',
    category: 'sorting',
    summary: 'Recorre el array intercambiando vecinos desordenados: en cada pasada, el mayor llega al final.',
    complexity: {
      time: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)' },
      space: 'O(1)',
    },
    stable: true,
  },

  input: form({
    values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [5, 1, 4, 2, 8, 3] }),
  }),

  views: [bars('a', { pointers: ['i', 'end'] })],

  anchors: ['pass', 'compare', 'swap', 'early', 'done'],

  reference: ({ values }) => bubbleSort([...values]),

  expected: { metric: 'comparisons', formula: 'n(n−1)/2 en el peor caso', at: ({ values }) => (values.length * (values.length - 1)) / 2 },

  examples: [
    { name: 'Desordenado', input: { values: [5, 1, 4, 2, 8, 3] } },
    { name: 'Ya ordenado: termina en una pasada', input: { values: [1, 2, 3, 4, 5, 6] } },
    { name: 'Inverso (peor caso)', input: { values: [6, 5, 4, 3, 2, 1] } },
  ],

  trace({ values }, t) {
    const a = t.array('a', values);

    for (let end = a.length - 1; end > 0; end--) {
      t.step('pass', `Pasada: el mayor de a[0..${end}] acabará en a[${end}]`, {
        vars: { end, swapped: false, i: undefined },
        level: 0,
      });
      let swapped = false;

      for (let i = 0; i < end; i++) {
        const left = a.get(i);
        const right = a.get(i + 1);
        const outOfOrder = t.compare(left > right);
        t.step('compare', `¿a[${i}] = ${left} > a[${i + 1}] = ${right}? ${outOfOrder ? 'Sí: están al revés' : 'No: están en orden'}`, {
          vars: { i },
          marks: [a.mark(i, 'compare'), a.mark(i + 1, 'compare')],
          level: 2,
        });
        if (outOfOrder) {
          a.swap(i, i + 1);
          swapped = true;
          t.step('swap', `Intercambio ${left} y ${right}`, {
            vars: { swapped },
            marks: [a.mark(i, 'swap'), a.mark(i + 1, 'swap')],
          });
        }
      }

      a.setRole(end, 'sorted');
      if (!swapped) {
        for (let k = 0; k < end; k++) a.setRole(k, 'sorted');
        t.step('early', 'Ninguna pareja estaba al revés: el array ya está ordenado', { vars: { i: undefined }, level: 0 });
        return a.toArray();
      }
    }

    if (a.length > 0) a.setRole(0, 'sorted');
    t.step('done', 'Array ordenado', { vars: { end: undefined, i: undefined, swapped: undefined }, level: 0 });
    return a.toArray();
  },
});
