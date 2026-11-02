import { bars, defineAlgorithm, form, intArray, intInRange } from '@/core';

//#region shown
function linearSearch(a: number[], target: number): number {
  for (let i = 0; i < a.length; i++) { // @visit
    if (a[i] === target) return i; // @found
  }
  return -1; // @missing
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Búsqueda lineal',
    category: 'searching',
    summary: 'Mira los elementos uno a uno hasta encontrar el que busca o quedarse sin ninguno.',
    complexity: {
      time: { best: 'O(1)', average: 'O(n)', worst: 'O(n)' },
      space: 'O(1)',
    },
  },

  input: form({
    values: intArray({ minLength: 1, maxLength: 200, min: -999, max: 999, default: [7, 3, 9, 4, 1, 8] }),
    target: intInRange({ label: 'Valor buscado', min: -999, max: 999, default: 4 }),
  }),

  views: [bars('a', { pointers: ['i'] })],

  anchors: ['visit', 'found', 'missing'],

  reference: ({ values, target }) => linearSearch([...values], target),

  check: ({ values, target }, index) => {
    if (index === -1) return values.includes(target) ? 'estaba y no lo ha encontrado' : null;
    return values[index] === target ? null : 'ha devuelto una posición con otro valor';
  },

  expected: { metric: 'comparisons', formula: 'n en el peor caso', at: ({ values }) => values.length },

  examples: [
    { name: 'Está en medio', input: { values: [7, 3, 9, 4, 1, 8], target: 4 } },
    { name: 'Está al principio (mejor caso)', input: { values: [7, 3, 9, 4, 1, 8], target: 7 } },
    { name: 'No está (peor caso)', input: { values: [7, 3, 9, 4, 1, 8], target: 5 } },
  ],

  trace({ values, target }, t) {
    const a = t.array('a', values);
    t.vars({ target });

    for (let i = 0; i < a.length; i++) {
      t.step('visit', `Miro la posición ${i}`, { vars: { i }, marks: [a.mark(i, 'active')] });

      const current = a.get(i);
      if (t.compare(current === target)) {
        t.step('found', `a[${i}] = ${current}: es el valor buscado`, { marks: [a.mark(i, 'path', 'encontrado')] });
        return i;
      }
      a.setRole(i, 'discarded');
      t.step('found', `a[${i}] = ${current} no es ${target}: lo descarto`, { marks: [a.mark(i, 'compare')] });
    }

    t.step('missing', `He mirado los ${a.length} elementos y ${target} no está`, { vars: { i: undefined } });
    return -1;
  },
});
