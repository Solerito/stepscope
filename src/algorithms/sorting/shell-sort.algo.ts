import { bars, defineAlgorithm, form, intArray } from '@/core';

//#region shown
function shellSort(a: number[]): number[] {
  for (let gap = Math.floor(a.length / 2); gap > 0; gap = Math.floor(gap / 2)) { // @gap
    for (let i = gap; i < a.length; i++) {
      const value = a[i]; // @take
      let j = i;
      while (j >= gap && a[j - gap] > value) { // @compare
        a[j] = a[j - gap]; // @shift
        j -= gap;
      }
      a[j] = value; // @place
    }
  }
  return a; // @done
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Shell sort',
    category: 'sorting',
    summary: 'Inserción con saltos que se van reduciendo: los elementos lejanos se acercan pronto a su sitio.',
    complexity: {
      time: { best: 'O(n log n)', average: 'O(n^1,5) con estos saltos', worst: 'O(n²)' },
      space: 'O(1)',
    },
    stable: false,
  },

  input: form({
    values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [23, 4, 42, 8, 16, 15, 1, 30] }),
  }),

  views: [bars('a', { pointers: ['i', 'j'] })],

  anchors: ['gap', 'take', 'compare', 'shift', 'place', 'done'],

  reference: ({ values }) => shellSort([...values]),

  examples: [
    { name: 'Desordenado', input: { values: [23, 4, 42, 8, 16, 15, 1, 30] } },
    { name: 'Inverso', input: { values: [8, 7, 6, 5, 4, 3, 2, 1] } },
    { name: 'Ya ordenado', input: { values: [1, 2, 3, 4, 5, 6] } },
  ],

  trace({ values }, t) {
    const a = t.array('a', values);

    for (let gap = Math.floor(a.length / 2); gap > 0; gap = Math.floor(gap / 2)) {
      t.step('gap', `Ordeno por inserción los elementos separados ${gap} ${gap === 1 ? 'posición' : 'posiciones'}`, {
        vars: { gap, i: undefined, j: undefined, value: undefined },
        level: 0,
      });

      for (let i = gap; i < a.length; i++) {
        const value = a.get(i);
        let j = i;
        t.step('take', `Tomo a[${i}] = ${value}`, { vars: { i, value, j }, marks: [a.mark(i, 'active', 'clave')] });

        while (j >= gap) {
          const previous = a.get(j - gap);
          const greater = t.compare(previous > value);
          t.step('compare', `¿a[${j - gap}] = ${previous} > ${value}? ${greater ? `Sí: lo desplazo ${gap} hacia la derecha` : 'No: la clave va aquí'}`, {
            marks: [a.mark(j - gap, 'compare')],
            level: 2,
          });
          if (!greater) break;

          a.set(j, previous);
          t.step('shift', `Copio ${previous} a la posición ${j}`, { marks: [a.mark(j, 'write')] });
          j -= gap;
          t.vars({ j });
        }

        a.set(j, value);
        t.step('place', `Coloco ${value} en la posición ${j}`, { marks: [a.mark(j, 'write')] });
      }
    }

    for (let k = 0; k < a.length; k++) a.setRole(k, 'sorted');
    t.step('done', 'Array ordenado', { vars: { gap: undefined, i: undefined, j: undefined, value: undefined }, level: 0 });
    return a.toArray();
  },
});
