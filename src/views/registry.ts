import type { ViewSpec } from '@/core';
import type { ViewDefinition } from '../scene/types';

// Se recogen solas: añadir una vista es crear un archivo `*.view.ts` que exporte su definición.
const modules = import.meta.glob<Record<string, ViewDefinition>>('./*.view.ts', { eager: true });

const definitions = new Map<ViewSpec['view'], ViewDefinition>();
for (const module of Object.values(modules)) {
  for (const definition of Object.values(module)) {
    for (const kind of definition.kinds) definitions.set(kind, definition);
  }
}

export function viewFor(kind: ViewSpec['view']): ViewDefinition {
  const definition = definitions.get(kind);
  if (!definition) throw new Error(`No hay ninguna vista para «${kind}»`);
  return definition;
}

const TITLES: Readonly<Record<ViewSpec['view'], string>> = {
  bars: 'Array',
  cells: 'Array',
  stack: 'Pila',
  queue: 'Cola',
  'heap-tree': 'Montículo',
  table: 'Tabla',
  board: 'Tablero',
  tree: 'Árbol',
  graph: 'Grafo',
  'adjacency-matrix': 'Matriz de adyacencia',
  'adjacency-list': 'Lista de adyacencia',
  list: 'Lista enlazada',
  buckets: 'Cubetas',
  pegs: 'Varillas',
  'call-tree': 'Árbol de llamadas',
  'call-stack': 'Pila de llamadas',
};

export function titleOf(spec: ViewSpec): string {
  return spec.title ?? TITLES[spec.view];
}

export function keyOf(spec: ViewSpec): string {
  return 'structure' in spec ? `${spec.view}:${spec.structure}` : spec.view;
}
