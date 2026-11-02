import { bars, callStack, callTree, defineAlgorithm, form, intArray } from '@/core';

//#region shown
function mergeSort(a: number[], aux: number[], lo: number, hi: number): void { // @enter
  if (lo >= hi) return; // @base
  const mid = Math.floor((lo + hi) / 2); // @split
  mergeSort(a, aux, lo, mid); // @left
  mergeSort(a, aux, mid + 1, hi); // @right
  merge(a, aux, lo, mid, hi); // @merge
} // @return

function merge(a: number[], aux: number[], lo: number, mid: number, hi: number): void {
  for (let k = lo; k <= hi; k++) aux[k] = a[k]; // @copy
  let i = lo;
  let j = mid + 1;
  for (let k = lo; k <= hi; k++) {
    if (i > mid) a[k] = aux[j++]; // @leftDone
    else if (j > hi) a[k] = aux[i++]; // @rightDone
    else if (aux[j] < aux[i]) a[k] = aux[j++]; // @takeRight
    else a[k] = aux[i++]; // @takeLeft
  }
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Mergesort',
    category: 'sorting',
    summary: 'Parte el array por la mitad, ordena cada mitad y las mezcla: siempre n log n, a cambio de memoria extra.',
    complexity: {
      time: { best: 'O(n log n)', average: 'O(n log n)', worst: 'O(n log n)' },
      space: 'O(n)',
    },
    stable: true,
  },

  input: form({
    values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [38, 27, 43, 3, 9, 82, 10, 3] }),
  }),

  views: [
    bars('a', { pointers: ['k'], weight: 3 }),
    bars('aux', { title: 'Auxiliar', place: 'stage', pointers: ['i', 'j'], weight: 2 }),
    callTree({ place: 'stage', weight: 2 }),
    callStack(),
  ],

  anchors: ['enter', 'base', 'split', 'left', 'right', 'merge', 'return', 'copy', 'leftDone', 'rightDone', 'takeRight', 'takeLeft'],

  reference: ({ values }) => {
    const a = [...values];
    mergeSort(a, new Array<number>(a.length), 0, a.length - 1);
    return a;
  },

  expected: { metric: 'comparisons', formula: 'n log₂ n como mucho', at: ({ values }) => values.length * Math.log2(Math.max(1, values.length)) },

  examples: [
    { name: 'Desordenado, con un duplicado', input: { values: [38, 27, 43, 3, 9, 82, 10, 3] } },
    { name: 'Inverso', input: { values: [6, 5, 4, 3, 2, 1] } },
    { name: 'Ya ordenado: tarda lo mismo', input: { values: [1, 2, 3, 4, 5, 6] } },
  ],

  trace({ values }, t) {
    const a = t.array('a', values);
    const aux = t.array<number | null>('aux', values.map(() => null));
    const n = a.length;

    const merge = (lo: number, mid: number, hi: number) => {
      for (let k = lo; k <= hi; k++) {
        aux.set(k, a.get(k));
        t.step('copy', `Copio a[${k}] = ${aux.peek(k)} en aux[${k}]`, { vars: { k }, marks: [aux.mark(k, 'write')], level: 2 });
      }

      let i = lo;
      let j = mid + 1;
      t.vars({ i, j });
      for (let k = lo; k <= hi; k++) {
        t.vars({ k });
        if (i > mid) {
          const value = aux.get(j) as number;
          a.set(k, value);
          j++;
          t.step('leftDone', `La mitad izquierda se ha acabado: escribo ${value} en a[${k}]`, { vars: { j }, marks: [a.mark(k, 'write')] });
        } else if (j > hi) {
          const value = aux.get(i) as number;
          a.set(k, value);
          i++;
          t.step('rightDone', `La mitad derecha se ha acabado: escribo ${value} en a[${k}]`, { vars: { i }, marks: [a.mark(k, 'write')] });
        } else {
          const right = aux.get(j) as number;
          const left = aux.get(i) as number;
          const takeRight = t.compare(right < left);
          t.step('takeRight', `¿aux[${j}] = ${right} < aux[${i}] = ${left}? ${takeRight ? 'Sí: va primero el de la derecha' : 'No: va primero el de la izquierda, y así los iguales no se cruzan'}`, {
            marks: [aux.mark(j, 'compare'), aux.mark(i, 'compare')],
            level: 2,
          });
          if (takeRight) {
            a.set(k, right);
            j++;
            t.step('takeRight', `Escribo ${right} en a[${k}]`, { vars: { j }, marks: [a.mark(k, 'write')] });
          } else {
            a.set(k, left);
            i++;
            t.step('takeLeft', `Escribo ${left} en a[${k}]`, { vars: { i }, marks: [a.mark(k, 'write')] });
          }
        }
      }
      t.vars({ i: undefined, j: undefined, k: undefined });
    };

    const sort = t.recursive({ name: 'mergeSort', params: ['lo', 'hi'], enter: 'enter' }, (lo: number, hi: number): null => {
      if (lo >= hi) {
        return t.ret('base', null, lo === hi ? `Un solo elemento, a[${lo}]: ya está ordenado` : 'Tramo vacío: no hay nada que ordenar');
      }

      const mid = Math.floor((lo + hi) / 2);
      t.step('split', `Parto a[${lo}..${hi}] en a[${lo}..${mid}] y a[${mid + 1}..${hi}]`, { vars: { mid } });
      t.step('left', `Ordeno la mitad izquierda, a[${lo}..${mid}]`);
      sort(lo, mid);
      t.step('right', `Ordeno la mitad derecha, a[${mid + 1}..${hi}]`);
      sort(mid + 1, hi);
      t.step('merge', `Mezclo las dos mitades ya ordenadas de a[${lo}..${hi}]`);
      merge(lo, mid, hi);

      if (lo === 0 && hi === n - 1) for (let k = 0; k < n; k++) a.setRole(k, 'sorted');
      return t.ret('return', null, `mergeSort(${lo}, ${hi}) termina: a[${lo}..${hi}] ya está ordenado`);
    });

    sort(0, n - 1);
    return a.toArray();
  },
});
