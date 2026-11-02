import { bars, callStack, callTree, choice, defineAlgorithm, form, intArray, intInRange, seededRandom } from '@/core';

//#region shown
type PivotRule = 'first' | 'last' | 'median3' | 'random';

function quickSort(a: number[], lo: number, hi: number, rule: PivotRule, random: () => number): void { // @enter
  if (lo >= hi) return; // @base
  const p = choosePivot(a, lo, hi, rule, random); // @choose
  [a[p], a[hi]] = [a[hi], a[p]]; // @moveToEnd
  const pivot = a[hi];
  let store = lo;
  for (let i = lo; i < hi; i++) {
    if (a[i] < pivot) { // @compare
      [a[i], a[store]] = [a[store], a[i]]; // @swap
      store++;
    }
  }
  [a[store], a[hi]] = [a[hi], a[store]]; // @place
  quickSort(a, lo, store - 1, rule, random); // @left
  quickSort(a, store + 1, hi, rule, random); // @right
} // @return

function choosePivot(a: number[], lo: number, hi: number, rule: PivotRule, random: () => number): number {
  if (rule === 'first') return lo;
  if (rule === 'last') return hi;
  if (rule === 'random') return lo + Math.floor(random() * (hi - lo + 1));
  const mid = Math.floor((lo + hi) / 2);
  const x = a[lo];
  const y = a[mid];
  const z = a[hi];
  if ((x <= y && y <= z) || (z <= y && y <= x)) return mid;
  if ((y <= x && x <= z) || (z <= x && x <= y)) return lo;
  return hi;
}
//#endregion

const RULES = {
  last: 'El último',
  first: 'El primero',
  median3: 'Mediana de tres',
  random: 'Aleatorio',
} as const;

const RULE_TEXT: Record<keyof typeof RULES, string> = {
  last: 'el último del tramo',
  first: 'el primero del tramo',
  median3: 'la mediana del primero, el central y el último',
  random: 'uno al azar',
};

export default defineAlgorithm({
  meta: {
    name: 'Quicksort',
    category: 'sorting',
    summary: 'Elige un pivote, deja los menores a su izquierda y los mayores a su derecha, y repite en cada lado.',
    complexity: {
      time: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n²)' },
      space: 'O(log n) de pila; O(n) en el peor caso',
    },
    stable: false,
  },

  input: form({
    values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [5, 2, 8, 1, 9, 3, 7, 4, 6] }),
    pivot: choice({ label: 'Pivote', options: RULES, default: 'last' }),
    seed: intInRange({ label: 'Semilla del pivote aleatorio', min: 1, max: 9999, default: 1, variant: true }),
  }),

  views: [
    bars('a', { pointers: ['i', 'store'], weight: 3 }),
    callTree({ place: 'stage', weight: 2 }),
    callStack(),
  ],

  anchors: ['enter', 'base', 'choose', 'moveToEnd', 'compare', 'swap', 'place', 'left', 'right', 'return'],

  reference: ({ values, pivot, seed }) => {
    const a = [...values];
    quickSort(a, 0, a.length - 1, pivot, seededRandom(seed));
    return a;
  },

  expected: { metric: 'comparisons', formula: '1,39·n log₂ n de media', at: ({ values }) => 1.39 * values.length * Math.log2(Math.max(1, values.length)) },

  examples: [
    { name: 'Desordenado', input: { values: [5, 2, 8, 1, 9, 3, 7, 4, 6], pivot: 'last', seed: 1 } },
    { name: 'Ya ordenado con el último como pivote (peor caso)', input: { values: [1, 2, 3, 4, 5, 6, 7, 8], pivot: 'last', seed: 1 } },
    { name: 'Ya ordenado con mediana de tres', input: { values: [1, 2, 3, 4, 5, 6, 7, 8], pivot: 'median3', seed: 1 } },
    { name: 'Pivote aleatorio', input: { values: [5, 2, 8, 1, 9, 3, 7, 4, 6], pivot: 'random', seed: 7 } },
  ],

  trace({ values, pivot: rule, seed }, t) {
    const a = t.array('a', values);
    // La misma secuencia que usa el código mostrado: así los dos eligen los mismos pivotes.
    const random = seededRandom(seed);
    const le = (x: number, y: number) => t.compare(x <= y);

    const choose = (lo: number, hi: number): number => {
      if (rule === 'first') return lo;
      if (rule === 'last') return hi;
      if (rule === 'random') return lo + Math.floor(random() * (hi - lo + 1));
      const mid = Math.floor((lo + hi) / 2);
      const x = a.get(lo);
      const y = a.get(mid);
      const z = a.get(hi);
      if ((le(x, y) && le(y, z)) || (le(z, y) && le(y, x))) return mid;
      if ((le(y, x) && le(x, z)) || (le(z, x) && le(x, y))) return lo;
      return hi;
    };

    const sort = t.recursive({ name: 'quickSort', params: ['lo', 'hi'], enter: 'enter' }, (lo: number, hi: number): null => {
      if (lo >= hi) {
        if (lo === hi) a.setRole(lo, 'sorted');
        return t.ret('base', null, lo === hi ? `Un solo elemento: a[${lo}] ya está en su sitio` : 'Tramo vacío: no hay nada que ordenar');
      }

      const p = choose(lo, hi);
      t.step('choose', `Pivote: a[${p}] = ${a.peek(p)}, ${RULE_TEXT[rule]}`, { vars: { p }, marks: [a.mark(p, 'pivot', 'pivote')] });

      a.swap(p, hi);
      a.setRole(hi, 'pivot');
      const pivot = a.get(hi);
      let store = lo;
      t.step('moveToEnd', p === hi ? `El pivote ${pivot} ya está al final del tramo` : `Llevo el pivote ${pivot} al final del tramo`, {
        vars: { pivot, store, p: undefined },
        marks: p === hi ? [] : [a.mark(p, 'swap'), a.mark(hi, 'swap')],
      });

      for (let i = lo; i < hi; i++) {
        const value = a.get(i);
        const smaller = t.compare(value < pivot);
        t.step('compare', `¿a[${i}] = ${value} < ${pivot}? ${smaller ? 'Sí: va con los menores' : 'No: se queda a la derecha'}`, {
          vars: { i },
          marks: [a.mark(i, 'compare')],
          level: 2,
        });
        if (smaller) {
          a.swap(i, store);
          t.step('swap', i === store ? `${value} ya está con los menores` : `Intercambio a[${i}] y a[${store}]`, {
            marks: i === store ? [a.mark(i, 'swap')] : [a.mark(i, 'swap'), a.mark(store, 'swap')],
          });
          store++;
          t.vars({ store });
        }
      }

      a.swap(store, hi);
      a.setRole(store, 'sorted');
      t.step('place', `El pivote ${pivot} queda en a[${store}]: ese ya es su sitio definitivo`, {
        vars: { i: undefined },
        marks: store === hi ? [a.mark(store, 'swap')] : [a.mark(store, 'swap'), a.mark(hi, 'swap')],
      });

      t.step('left', `Ordeno los menores: a[${lo}..${store - 1}]`);
      sort(lo, store - 1);
      t.step('right', `Ordeno los mayores: a[${store + 1}..${hi}]`);
      sort(store + 1, hi);
      return t.ret('return', null, `quickSort(${lo}, ${hi}) termina: a[${lo}..${hi}] ordenado`);
    });

    sort(0, a.length - 1);
    return a.toArray();
  },
});
