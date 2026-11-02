/** Solo valores JSON: una traza tiene que poder serializarse, transferirse y exportarse. */
export type Scalar = number | string | boolean | null;
export type VarValue = Scalar | readonly Scalar[];

/** Identidad estable de un elemento visual durante toda la traza. Es lo que permite animar. */
export type ItemId = number;
export type StructureId = string;
export type CallId = number;

/** Lo único que un algoritmo puede decir sobre el aspecto de algo. Nunca un color. */
export const ROLES = [
  'active',
  'compare',
  'write',
  'swap',
  'pivot',
  'min',
  'sorted',
  'visited',
  'frontier',
  'path',
  'discarded',
  'waiting',
  'done',
  'base-case',
  'memo-hit',
  'pruned',
  'returned',
  'conflict',
  'rb-red',
  'rb-black',
] as const;
export type Role = (typeof ROLES)[number];

/** 0 = hito, 1 = paso, 2 = detalle. Permite ver la traza a distintos aumentos. */
export type Level = 0 | 1 | 2;

/** Qué está pasando en términos de control de flujo. La vista de código lo muestra con forma y texto. */
export const PHASES = ['step', 'call', 'return', 'memo-hit', 'prune'] as const;
export type Phase = (typeof PHASES)[number];

export const COUNTER_NAMES = ['comparisons', 'swaps', 'reads', 'writes', 'calls', 'savedCalls'] as const;
export type CounterName = (typeof COUNTER_NAMES)[number];
export type Counters = Readonly<Record<CounterName, number>>;

// ─── Estructuras: vocabulario cerrado que el reproductor sabe pintar ───────────

export interface Cell {
  id: ItemId;
  value: Scalar;
  role?: Role;
}

/** null = hueco reservado sin usar (capacidad del array dinámico, huecos de direccionamiento abierto). */
export interface ArrayState {
  kind: 'array';
  cells: (Cell | null)[];
}

/** Tablas de PD, matrices de adyacencia, tableros (reinas, sudoku, laberinto). `roles` es disperso: "fila,col". */
export interface TableState {
  kind: 'table';
  rows: number;
  cols: number;
  cells: Scalar[][];
  roles: Record<string, Role>;
  rowLabels?: readonly string[];
  colLabels?: readonly string[];
}

/** BST, AVL, rojo-negro, heap, trie (n-ario con `edgeLabel`), bosque de Union-Find (varias raíces). */
export interface TreeNode {
  id: ItemId;
  label: Scalar;
  children: (ItemId | null)[];
  edgeLabel?: string;
  role?: Role;
  badge?: string;
}
export interface TreeState {
  kind: 'tree';
  roots: ItemId[];
  nodes: Record<ItemId, TreeNode>;
}

/** Posiciones normalizadas en [0, 1]: las fija la entrada y son deterministas. */
export interface GraphNode {
  id: ItemId;
  label: string;
  x: number;
  y: number;
  role?: Role;
  badge?: string;
}
export interface GraphEdge {
  id: ItemId;
  from: ItemId;
  to: ItemId;
  weight?: number;
  role?: Role;
}
export interface GraphState {
  kind: 'graph';
  directed: boolean;
  nodes: Record<ItemId, GraphNode>;
  edges: Record<ItemId, GraphEdge>;
}

export interface ListNode {
  id: ItemId;
  value: Scalar;
  next: ItemId | null;
  prev?: ItemId | null;
  role?: Role;
}
export interface ListState {
  kind: 'list';
  variant: 'singly' | 'doubly' | 'circular';
  head: ItemId | null;
  nodes: Record<ItemId, ListNode>;
}

/** Tabla hash con encadenamiento, cubetas de radix sort, varillas de Hanoi. */
export interface BucketsState {
  kind: 'buckets';
  buckets: Cell[][];
  labels?: readonly string[];
}

export type Structure = ArrayState | TableState | TreeState | GraphState | ListState | BucketsState;

// ─── Recursión ─────────────────────────────────────────────────────────────────

export type CallStatus = 'active' | 'waiting' | 'done' | 'memo-hit' | 'pruned';

/** Marco de la pila. `stack[0]` es siempre el ámbito global: los algoritmos iterativos viven ahí. */
export interface CallFrame {
  id: CallId;
  fn: string;
  args: Record<string, Scalar>;
  vars: Record<string, VarValue>;
}

/** Nodo del árbol de llamadas. Solo crece: nunca se borra, así que `calls[id]` es acceso directo. */
export interface CallNode {
  id: CallId;
  parent: CallId | null;
  fn: string;
  args: Record<string, Scalar>;
  status: CallStatus;
  ret?: Scalar;
  /** En un acierto de memo: llamadas que se habrían hecho sin memoizar. */
  saved?: number;
}

/** Estado acumulado. Es lo que se reconstruye con keyframes + deltas. */
export interface TraceState {
  structures: Record<StructureId, Structure>;
  stack: CallFrame[];
  calls: CallNode[];
}

// ─── Anotaciones efímeras: valen para un único frame y no entran en el estado ──

export type Mark =
  | { s: StructureId; item: ItemId; role: Role; label?: string }
  | { s: StructureId; cell: readonly [row: number, col: number]; role: Role; label?: string };

/** Flecha de dependencia entre celdas de una tabla (PD). */
export interface Arrow {
  s: StructureId;
  from: readonly [row: number, col: number];
  to: readonly [row: number, col: number];
  label?: string;
}

// ─── El frame: lo que recibe el reproductor ────────────────────────────────────

export interface Frame {
  readonly index: number;
  /** Ancla de código activa; la línea se resuelve con `source.lineOf[anchor]`. */
  readonly anchor: string | null;
  readonly level: Level;
  readonly phase: Phase;
  /** Qué acaba de pasar, en una frase. */
  readonly explain: string;
  /** Acumulados hasta este frame incluido. */
  readonly counters: Counters;
  readonly marks: readonly Mark[];
  readonly arrows: readonly Arrow[];
  /**
   * Variables vivas: `state.stack.at(-1).vars`. Pila y árbol también viven aquí.
   * El cursor reutiliza este objeto entre seeks: quien quiera conservar algo, lo copia.
   */
  readonly state: Readonly<TraceState>;
}

// ─── Vistas: qué estructura se pinta y cómo. Una estructura admite varias ──────

/** Dónde va una vista y cuánto ocupa. Por defecto, la primera va a la platina y el resto al lateral. */
export interface ViewLayout {
  title?: string;
  place?: 'stage' | 'side';
  /** Altura relativa entre las vistas que comparten la platina. */
  weight?: number;
}
export interface SequenceViewSpec extends ViewLayout {
  view: 'bars' | 'cells' | 'stack' | 'queue' | 'heap-tree';
  structure: StructureId;
  /** Variables cuyo valor es un índice: se dibujan como flechas bajo el array. */
  pointers?: readonly string[];
  /** Solo `heap-tree`: variable con el tamaño del montículo; lo que queda fuera ya está ordenado. */
  heapSize?: string;
}
export interface StructureViewSpec extends ViewLayout {
  view:
    | 'table'
    | 'board'
    | 'tree'
    | 'graph'
    | 'adjacency-matrix'
    | 'adjacency-list'
    | 'list'
    | 'buckets'
    | 'pegs';
  structure: StructureId;
}
export interface RecursionViewSpec extends ViewLayout {
  view: 'call-tree' | 'call-stack';
}
export type ViewSpec = SequenceViewSpec | StructureViewSpec | RecursionViewSpec;

// ─── Almacenamiento: lo que realmente se guarda y viaja desde el worker ────────

export type Path = readonly (string | number)[];
/** Asignación si hay valor; borrado si no. Con esto se describe cualquier cambio de estado. */
export type DeltaOp = readonly [path: Path, value: unknown] | readonly [path: Path];
export type StoredFrame = readonly [
  explain: string,
  marks: readonly Mark[],
  arrows: readonly Arrow[],
  delta: readonly DeltaOp[],
];

export interface TraceHeader {
  readonly schema: 1;
  readonly algorithmId: string;
  readonly input: unknown;
  readonly frameCount: number;
  readonly anchors: readonly string[];
  readonly views: readonly ViewSpec[];
  /** Hitos de la barra de progreso: operación de una estructura, pasada de un bucle externo… */
  readonly chapters: readonly { readonly frame: number; readonly title: string }[];
  /** Roles que aparecen en la traza: de aquí sale la leyenda. */
  readonly roles: readonly Role[];
  readonly result: unknown;
  /** Hash de la secuencia de anclas y contadores. Detecta enlaces compartidos obsoletos. */
  readonly fingerprint: string;
  /** Nivel máximo que se llegó a emitir. Baja de 2 si la traza no cabía en el presupuesto. */
  readonly detail: Level;
  readonly truncated: null | 'frames' | 'bytes' | 'time';
}

export interface EncodedTrace {
  readonly header: TraceHeader;
  /** Columnas: una entrada por frame, acceso O(1) sin decodificar nada. */
  readonly anchor: Uint16Array;
  readonly level: Uint8Array;
  readonly phase: Uint8Array;
  /** frameCount × COUNTER_NAMES.length */
  readonly counters: Uint32Array;
  /** Frame cuyo estado guarda el keyframe de cada segmento; el primero es -1 (estado inicial). */
  readonly segmentStart: Int32Array;
  /** JSON en UTF-8: { key: TraceState, fr: StoredFrame[] }. Se decodifican bajo demanda. */
  readonly segments: readonly Uint8Array[];
}
