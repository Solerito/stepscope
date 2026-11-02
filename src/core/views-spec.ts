import type {
  RecursionViewSpec,
  SequenceViewSpec,
  StructureId,
  StructureViewSpec,
  ViewLayout,
} from './trace/types';

type SequenceOptions = ViewLayout & { pointers?: readonly string[] };

/** El array como barras: la altura es el valor. */
export function bars(structure: StructureId, options: SequenceOptions = {}): SequenceViewSpec {
  return { view: 'bars', structure, ...options };
}

/** El array como casillas con su índice: para contadores, tablas pequeñas o valores sin escala. */
export function cells(structure: StructureId, options: SequenceOptions = {}): SequenceViewSpec {
  return { view: 'cells', structure, ...options };
}

/** El mismo array dibujado como árbol binario completo: así se ve un montículo. */
export function heapTree(
  structure: StructureId,
  options: SequenceOptions & { heapSize?: string } = {},
): SequenceViewSpec {
  return { view: 'heap-tree', structure, ...options };
}

export function buckets(structure: StructureId, options: ViewLayout = {}): StructureViewSpec {
  return { view: 'buckets', structure, ...options };
}

export function callTree(options: ViewLayout = {}): RecursionViewSpec {
  return { view: 'call-tree', ...options };
}

export function callStack(options: ViewLayout = {}): RecursionViewSpec {
  return { view: 'call-stack', ...options };
}
