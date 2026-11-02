import type { Arrow, Level, Mark, Phase, Role, Scalar, StructureId, VarValue } from '../trace/types';

export interface StepOptions {
  /** Se fusionan en el ámbito actual. `undefined` retira la variable: ha dejado de estar viva. */
  vars?: Readonly<Record<string, VarValue | undefined>>;
  marks?: readonly Mark[];
  arrows?: readonly Arrow[];
  level?: Level;
  phase?: Phase;
}

/** Las mutaciones cuentan y registran el delta; solo `t.step` emite un frame. */
export interface TracedArray<T extends Scalar> {
  readonly id: StructureId;
  readonly length: number;
  /** Cuenta una lectura. */
  get(i: number): T;
  /** Lee sin contar: para escribir explicaciones. */
  peek(i: number): T;
  /** Cuenta una escritura. La celda conserva su identidad: la barra cambia de altura. */
  set(i: number, value: T): void;
  /** Cuenta 1 intercambio, 2 lecturas y 2 escrituras. Las identidades viajan: las barras se deslizan. */
  swap(i: number, j: number): void;
  /** Rol persistente: dura hasta que se cambie. */
  setRole(i: number, role: Role | null): void;
  /** Marca efímera para un `t.step`. */
  mark(i: number, role: Role, label?: string): Mark;
  toArray(): T[];
}

/** Cubetas (radix sort, tabla hash con encadenamiento). Cada elemento tiene identidad propia. */
export interface TracedBuckets<T extends Scalar> {
  readonly id: StructureId;
  readonly count: number;
  size(bucket: number): number;
  /** Añade al final del cubo. Cuenta una escritura. */
  push(bucket: number, value: T): void;
  /** Saca el primero del cubo. Cuenta una lectura. */
  shift(bucket: number): T;
  mark(bucket: number, index: number, role: Role, label?: string): Mark;
}

export interface RecursiveSpec<A extends string> {
  name: string;
  params: readonly string[];
  /** Ancla de la línea en la que se entra a la función. */
  enter: A;
}

/** `t.array('a', [0, 0])` debe dar un array de `number`, no del literal `0`. */
export type Widen<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends boolean
      ? boolean
      : T;

export interface Tracer<A extends string> {
  /** Emite un frame con el estado acumulado. Es la única forma de emitir fuera de `recursive`. */
  step(anchor: A, explain: string, options?: StepOptions): void;
  vars(values: Readonly<Record<string, VarValue | undefined>>): void;
  /** Abre un hito en la barra de progreso. Los invariantes se comprueban al cerrar cada uno. */
  chapter(title: string): void;
  /** Cuenta una comparación y devuelve el resultado, para usarlo en la condición. */
  compare(outcome: boolean): boolean;
  array<T extends Scalar>(id: StructureId, values: readonly T[]): TracedArray<Widen<T>>;
  buckets<T extends Scalar = number>(
    id: StructureId,
    count: number,
    labels?: readonly string[],
  ): TracedBuckets<Widen<T>>;

  /**
   * Envuelve una función recursiva: apila el marco, crea el nodo del árbol y emite el frame de
   * llamada. Toda salida debe pasar por `ret`, `memoHit` o `prune`, o el tracer lanza un error.
   */
  recursive<P extends readonly Scalar[], R extends Scalar>(
    spec: RecursiveSpec<A>,
    body: (...args: P) => R,
  ): (...args: P) => R;
  ret<R extends Scalar>(anchor: A, value: R, explain?: string): R;
  memoHit<R extends Scalar>(anchor: A, value: R, explain?: string): R;
  prune<R extends Scalar>(anchor: A, value: R, explain?: string): R;

  /** PRNG con semilla. `Math.random` está prohibido en un algoritmo. */
  random(): number;

  // Se añaden en su fase, con el mismo patrón que `array`:
  // table() (F2), graph() (F5), list() (F7), tree() (F8).
}
