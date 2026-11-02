import type { CounterName, TraceState, ViewSpec } from './trace/types';
import type { Tracer } from './tracer/types';

export type Category = 'structures' | 'sorting' | 'searching' | 'graphs' | 'recursion' | 'dp' | 'strings';

export interface AlgorithmMeta {
  name: string;
  category: Category;
  summary: string;
  complexity: {
    time: { best: string; average: string; worst: string };
    space: string;
  };
  stable?: boolean;
}

/** Un campo de entrada: sabe parsearse, validarse, generarse y volver a texto (URL y editor). */
export interface InputField<T> {
  kind: string;
  label: string;
  default: T;
  /** Lanza un `InputError` con un mensaje para el usuario si el texto no se entiende. */
  parse(text: string): T;
  format(value: T): string;
  validate(value: T): string | null;
  generators?: Readonly<Record<string, (random: () => number, current: T) => T>>;
  /** La entrada más grande permitida: con ella se comprueba que los límites declarados son ciertos. */
  maximal(): T;
}

export interface InputSpec<I> {
  readonly fields: { readonly [K in keyof I]: InputField<I[K]> };
  readonly default: I;
}

export interface AlgorithmDefinition<I, R, A extends string> {
  meta: AlgorithmMeta;
  input: InputSpec<I>;
  views: readonly ViewSpec[];
  /** Deben coincidir con los comentarios `// @ancla` del código mostrado. Lo comprueba un test. */
  anchors: readonly A[];
  /** Ejecuta el código mostrado, sin instrumentar. Es el oráculo de la implementación instrumentada. */
  reference: (input: I) => R;
  trace: (input: I, t: Tracer<A>) => R;
  /** Propiedad que debe cumplir el resultado. Devuelve el motivo del fallo o null. */
  check?: (input: I, result: R) => string | null;
  /** Se comprueban al cerrar cada capítulo, no en cada frame: a mitad de rotación un AVL puede estar desequilibrado. */
  invariants?: readonly { name: string; holds: (state: Readonly<TraceState>) => boolean }[];
  /** Coste teórico para contrastar con el contador real. */
  expected?: { metric: CounterName; formula: string; at: (input: I) => number };
  /** Casos del desplegable de la interfaz y de los tests de trazas. */
  examples?: readonly { name: string; input: I }[];
}

/** No hace nada en ejecución: existe para que TS infiera I, R y A y compruebe cada `t.step`. */
export function defineAlgorithm<const A extends string, I, R>(
  definition: AlgorithmDefinition<I, R, A>,
): AlgorithmDefinition<I, R, A> {
  return definition;
}
