import type { Category } from '@/core';
import { algorithms, type RegisteredAlgorithm } from '../algorithms/registry';

export const CATEGORY_NAMES: Readonly<Record<Category, string>> = {
  sorting: 'Ordenación',
  searching: 'Búsqueda',
  recursion: 'Recursión y backtracking',
  graphs: 'Grafos',
  dp: 'Programación dinámica',
  strings: 'Cadenas',
  structures: 'Estructuras de datos',
};

const CATEGORY_ORDER = Object.keys(CATEGORY_NAMES) as Category[];

/** El orden del catálogo: por familia y, dentro de cada una, por nombre. */
export const catalogOrder: readonly RegisteredAlgorithm[] = [...algorithms].sort(
  (a, b) =>
    CATEGORY_ORDER.indexOf(a.meta.category) - CATEGORY_ORDER.indexOf(b.meta.category) ||
    a.meta.name.localeCompare(b.meta.name, 'es'),
);
