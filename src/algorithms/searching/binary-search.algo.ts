import { bars, defineAlgorithm, form, intArray, intInRange } from '@/core';

//#region shown
function binarySearch(a: number[], target: number): number {
  let lo = 0; // @init
  let hi = a.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2); // @mid
    if (a[mid] === target) return mid; // @found
    if (a[mid] < target) lo = mid + 1; // @right
    else hi = mid - 1; // @left
  }
  return -1; // @missing
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Búsqueda binaria',
    category: 'searching',
    summary: 'En un array ordenado, mira el centro y descarta la mitad donde no puede estar: n pasa a n/2 a cada paso.',
    complexity: {
      time: { best: 'O(1)', average: 'O(log n)', worst: 'O(log n)' },
      space: 'O(1)',
    },
  },

  input: form({
    values: intArray({
      label: 'Array ordenado',
      minLength: 1,
      maxLength: 200,
      min: -999,
      max: 999,
      sorted: true,
      default: [1, 3, 4, 7, 9, 11, 15, 20, 24, 31],
    }),
    target: intInRange({ label: 'Valor buscado', min: -999, max: 999, default: 15 }),
  }),

  views: [bars('a', { pointers: ['lo', 'mid', 'hi'] })],

  anchors: ['init', 'mid', 'found', 'right', 'left', 'missing'],

  reference: ({ values, target }) => binarySearch([...values], target),

  check: ({ values, target }, index) => {
    if (index === -1) return values.includes(target) ? 'estaba y no lo ha encontrado' : null;
    return values[index] === target ? null : 'ha devuelto una posición con otro valor';
  },

  expected: { metric: 'comparisons', formula: '2·log₂ n en el peor caso', at: ({ values }) => 2 * Math.ceil(Math.log2(values.length + 1)) },

  examples: [
    { name: 'Está a la derecha', input: { values: [1, 3, 4, 7, 9, 11, 15, 20, 24, 31], target: 15 } },
    { name: 'Está a la izquierda', input: { values: [1, 3, 4, 7, 9, 11, 15, 20, 24, 31], target: 3 } },
    { name: 'No está', input: { values: [1, 3, 4, 7, 9, 11, 15, 20, 24, 31], target: 10 } },
  ],

  trace({ values, target }, t) {
    const a = t.array('a', values);
    let lo = 0;
    let hi = a.length - 1;
    t.step('init', `Busco ${target} en todo el array, de a[0] a a[${hi}]`, { vars: { target, lo, hi }, level: 0 });

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const value = a.get(mid);
      t.step('mid', `El centro de a[${lo}..${hi}] es a[${mid}] = ${value}`, { vars: { mid }, marks: [a.mark(mid, 'active')] });

      if (t.compare(value === target)) {
        t.step('found', `a[${mid}] = ${value}: es el valor buscado`, { marks: [a.mark(mid, 'path', 'encontrado')] });
        return mid;
      }
      if (t.compare(value < target)) {
        for (let k = lo; k <= mid; k++) a.setRole(k, 'discarded');
        lo = mid + 1;
        t.step('right', `${value} < ${target}: si está, está a la derecha. Descarto hasta a[${mid}]`, { vars: { lo } });
      } else {
        for (let k = mid; k <= hi; k++) a.setRole(k, 'discarded');
        hi = mid - 1;
        t.step('left', `${value} > ${target}: si está, está a la izquierda. Descarto desde a[${mid}]`, { vars: { hi } });
      }
    }

    t.step('missing', `El intervalo se ha quedado vacío: ${target} no está`, { vars: { mid: undefined }, level: 0 });
    return -1;
  },
});
