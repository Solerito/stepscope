import type { ViewSpec } from '@/core';
import type { ViewDefinition } from '../scene/types';

// Se recogen solas: añadir una vista es crear un archivo `*.view.ts` que exporte su definición.
const modules = import.meta.glob<Record<string, ViewDefinition>>('./*.view.ts', { eager: true });

/** Un `*.view.ts` puede exportar ayudantes además de su definición: sin comprobar la forma,
 * leerle `kinds` a uno de ellos tumba el arranque de toda la aplicación. */
function isViewDefinition(value: unknown): value is ViewDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ViewDefinition>;
  return Array.isArray(candidate.kinds) && typeof candidate.build === 'function';
}

const definitions = new Map<ViewSpec['view'], ViewDefinition>();
const duplicated: ViewSpec['view'][] = [];
for (const module of Object.values(modules)) {
  for (const exported of Object.values(module)) {
    if (!isViewDefinition(exported)) continue;
    for (const kind of exported.kinds) {
      if (definitions.has(kind)) duplicated.push(kind);
      definitions.set(kind, exported);
    }
  }
}

/**
 * Vistas que declara más de un archivo. El registro se queda con la última que carga el glob,
 * así que un archivo nuevo podría reemplazar en silencio cómo se pinta un algoritmo entero.
 * Un test lo prohíbe, igual que el de ids duplicados en el registro de algoritmos.
 */
export const duplicatedKinds: readonly ViewSpec['view'][] = duplicated;

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
