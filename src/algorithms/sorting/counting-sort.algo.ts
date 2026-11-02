import { bars, cells, defineAlgorithm, form, intArray } from '@/core';

//#region shown
function countingSort(a: number[]): number[] {
  const max = Math.max(...a); // @max
  const count = new Array<number>(max + 1).fill(0);
  for (const value of a) count[value]++; // @count
  for (let v = 1; v <= max; v++) count[v] += count[v - 1]; // @prefix
  const out = new Array<number>(a.length);
  for (let i = a.length - 1; i >= 0; i--) {
    out[--count[a[i]]] = a[i]; // @place
  }
  return out; // @done
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Counting sort',
    category: 'sorting',
    summary: 'No compara: cuenta cuántas veces sale cada valor y calcula dónde va cada uno. Solo sirve con enteros pequeños.',
    complexity: {
      time: { best: 'O(n + k)', average: 'O(n + k)', worst: 'O(n + k)' },
      space: 'O(n + k), con k el valor máximo',
    },
    stable: true,
  },

  input: form({
    values: intArray({ label: 'Array (de 0 a 99)', minLength: 1, maxLength: 100, min: 0, max: 99, default: [4, 1, 3, 4, 0, 2, 1, 3] }),
  }),

  views: [
    bars('a', { pointers: ['i'], weight: 2 }),
    cells('count', { title: 'Contadores', place: 'stage', pointers: ['v'], weight: 1 }),
    bars('out', { title: 'Salida', place: 'stage', weight: 2 }),
  ],

  anchors: ['max', 'count', 'prefix', 'place', 'done'],

  reference: ({ values }) => countingSort([...values]),

  expected: { metric: 'writes', formula: '3n + k escrituras', at: ({ values }) => 3 * values.length + Math.max(...values) },

  examples: [
    { name: 'Con repetidos', input: { values: [4, 1, 3, 4, 0, 2, 1, 3] } },
    { name: 'Todos iguales', input: { values: [2, 2, 2, 2] } },
    { name: 'Inverso', input: { values: [6, 5, 4, 3, 2, 1, 0] } },
  ],

  trace({ values }, t) {
    const a = t.array('a', values);

    let max = a.get(0);
    for (let i = 1; i < a.length; i++) {
      const value = a.get(i);
      if (t.compare(value > max)) max = value;
    }
    const count = t.array('count', Array.from({ length: max + 1 }, () => 0));
    t.step('max', `El mayor valor es ${max}: necesito ${max + 1} contadores, del 0 al ${max}`, { vars: { max }, level: 0 });

    for (let i = 0; i < a.length; i++) {
      const value = a.get(i);
      count.set(value, count.get(value) + 1);
      t.step('count', `a[${i}] = ${value}: sumo uno a count[${value}]`, {
        vars: { i },
        marks: [a.mark(i, 'active'), count.mark(value, 'write')],
      });
    }

    t.vars({ i: undefined });
    for (let v = 1; v <= max; v++) {
      count.set(v, count.get(v) + count.get(v - 1));
      t.step('prefix', `count[${v}] += count[${v - 1}]: los valores hasta ${v} ocupan ${count.peek(v)} posiciones`, {
        vars: { v },
        marks: [count.mark(v, 'write'), count.mark(v - 1, 'active')],
      });
    }

    t.vars({ v: undefined });
    const out = t.array<number | null>('out', values.map(() => null));
    for (let i = a.length - 1; i >= 0; i--) {
      const value = a.get(i);
      const position = count.get(value) - 1;
      count.set(value, position);
      out.set(position, value);
      t.step('place', `a[${i}] = ${value} va a la posición ${position}: recorro de atrás adelante para que sea estable`, {
        vars: { i },
        marks: [a.mark(i, 'active'), count.mark(value, 'write'), out.mark(position, 'write')],
      });
    }

    t.step('done', 'Salida ordenada', { vars: { i: undefined }, level: 0 });
    return out.toArray() as number[];
  },
});
