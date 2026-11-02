import { formatAlgorithmHash, formatCompareHash } from '../../routing/hash';

export interface FeaturedCase {
  readonly title: string;
  readonly summary: string;
  readonly href: string;
}

const ascending = Array.from({ length: 16 }, (_, i) => i + 1).join(',');
const descending = Array.from({ length: 16 }, (_, i) => 16 - i).join(',');

/**
 * Comparaciones preparadas para el catálogo y el README: cada una enseña algo que no se ve con un solo
 * algoritmo. Un test comprueba que los algoritmos existen y que la entrada es válida para los dos.
 */
export const FEATURED_COMPARISONS: readonly FeaturedCase[] = [
  {
    title: 'Quicksort frente a mergesort',
    summary: 'El mismo array desordenado: los dos son O(n log n), pero no hacen el mismo trabajo.',
    href: formatCompareHash(['quick-sort', 'merge-sort'], { values: '38,27,43,3,9,82,10,3,55,21,64,12' }),
  },
  {
    title: 'El pivote de quicksort, sobre un array ya ordenado',
    summary: 'El último como pivote cae en el peor caso; la mediana de tres lo evita.',
    href: formatCompareHash(['quick-sort', 'quick-sort'], {
      values: ascending,
      'a.pivot': 'last',
      'b.pivot': 'median3',
    }),
  },
  {
    title: 'Inserción frente a Shell sort, con el array al revés',
    summary: 'Shell sort mueve primero los elementos lejanos y se ahorra casi todos los desplazamientos.',
    href: formatCompareHash(['insertion-sort', 'shell-sort'], { values: descending }),
  },
  {
    title: 'Búsqueda lineal frente a binaria',
    summary: 'Sobre 30 valores ordenados: n pasos frente a log₂ n.',
    href: formatCompareHash(['linear-search', 'binary-search'], {
      values: Array.from({ length: 30 }, (_, i) => 2 * i + 1).join(','),
      target: '53',
    }),
  },
];

/** Casos sueltos para el README: cada uno abre un algoritmo en un momento que merece la pena ver. */
export const FEATURED_CASES: readonly FeaturedCase[] = [
  {
    title: 'Fibonacci con memoización',
    summary: 'El árbol de llamadas se poda en cuanto un valor ya está calculado: 11 llamadas en vez de 25.',
    href: formatAlgorithmHash('fibonacci-memo', { n: '6' }),
  },
  {
    title: 'Heapsort',
    summary: 'El mismo array visto como array y como montículo, a la vez.',
    href: formatAlgorithmHash('heap-sort', { values: '4,10,3,5,1,8,7' }),
  },
  {
    title: 'Radix sort',
    summary: 'Sin una sola comparación: reparte por cifras en cubetas.',
    href: formatAlgorithmHash('radix-sort', { values: '170,45,75,90,802,24,2,66' }),
  },
];
