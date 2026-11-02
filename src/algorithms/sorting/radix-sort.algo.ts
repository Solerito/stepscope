import { bars, buckets, defineAlgorithm, form, intArray } from '@/core';

//#region shown
function radixSort(a: number[]): number[] {
  const max = Math.max(...a); // @max
  for (let place = 1; place <= max; place *= 10) { // @digit
    const buckets: number[][] = Array.from({ length: 10 }, () => []);
    for (const value of a) {
      buckets[Math.floor(value / place) % 10].push(value); // @push
    }
    let k = 0; // @collect
    for (const bucket of buckets) {
      for (const value of bucket) a[k++] = value; // @write
    }
  }
  return a; // @done
}
//#endregion

const PLACE_NAMES: Readonly<Record<number, string>> = { 1: 'unidades', 10: 'decenas', 100: 'centenas' };

export default defineAlgorithm({
  meta: {
    name: 'Radix sort',
    category: 'sorting',
    summary: 'Reparte por la última cifra, recoge en orden y repite con la siguiente: ordena sin comparar elementos.',
    complexity: {
      time: { best: 'O(d·n)', average: 'O(d·n)', worst: 'O(d·n), con d cifras' },
      space: 'O(n + 10)',
    },
    stable: true,
  },

  input: form({
    values: intArray({ label: 'Array (de 0 a 999)', minLength: 1, maxLength: 100, min: 0, max: 999, default: [170, 45, 75, 90, 802, 24, 2, 66] }),
  }),

  views: [
    bars('a', { pointers: ['k'], weight: 2 }),
    buckets('buckets', { title: 'Cubetas', place: 'stage', weight: 3 }),
  ],

  anchors: ['max', 'digit', 'push', 'collect', 'write', 'done'],

  reference: ({ values }) => radixSort([...values]),

  expected: { metric: 'writes', formula: '2·d·n escrituras', at: ({ values }) => 2 * String(Math.max(...values)).length * values.length },

  examples: [
    { name: 'Tres cifras', input: { values: [170, 45, 75, 90, 802, 24, 2, 66] } },
    { name: 'Una cifra', input: { values: [3, 1, 4, 1, 5, 9, 2, 6] } },
    { name: 'Todo ceros', input: { values: [0, 0, 0] } },
  ],

  trace({ values }, t) {
    const a = t.array('a', values);
    const b = t.buckets('buckets', 10);

    let max = a.get(0);
    for (let i = 1; i < a.length; i++) {
      const value = a.get(i);
      if (t.compare(value > max)) max = value;
    }
    t.step('max', `El mayor es ${max}: ${max === 0 ? 'no hay cifras que repartir' : `hay que repartir ${String(max).length} ${String(max).length === 1 ? 'vez' : 'veces'}`}`, {
      vars: { max },
      level: 0,
    });

    for (let place = 1; place <= max; place *= 10) {
      t.step('digit', `Reparto por la cifra de las ${PLACE_NAMES[place] ?? `posiciones de ${place}`}`, {
        vars: { place, k: undefined },
        level: 0,
      });

      for (let i = 0; i < a.length; i++) {
        const value = a.get(i);
        const digit = Math.floor(value / place) % 10;
        b.push(digit, value);
        t.step('push', `${value} tiene un ${digit} en esa cifra: va a la cubeta ${digit}`, {
          vars: { digit },
          marks: [a.mark(i, 'active'), b.mark(digit, b.size(digit) - 1, 'write')],
        });
      }

      let k = 0;
      t.step('collect', 'Recojo las cubetas en orden, de la 0 a la 9, y cada una de abajo arriba', { vars: { k, digit: undefined } });
      for (let d = 0; d < 10; d++) {
        while (b.size(d) > 0) {
          const value = b.shift(d);
          a.set(k, value);
          t.step('write', `Saco ${value} de la cubeta ${d} y lo escribo en a[${k}]`, { marks: [a.mark(k, 'write')] });
          k++;
          t.vars({ k });
        }
      }
    }

    for (let k = 0; k < a.length; k++) a.setRole(k, 'sorted');
    t.step('done', 'Array ordenado', { vars: { k: undefined, place: undefined }, level: 0 });
    return a.toArray();
  },
});
