import { applyOp, clone } from './delta';
import { fingerprint } from './fingerprint';
import {
  type Arrow,
  COUNTER_NAMES,
  type CounterName,
  type DeltaOp,
  type EncodedTrace,
  type ItemId,
  type Level,
  type Mark,
  type Path,
  PHASES,
  type Phase,
  type Role,
  type StoredFrame,
  type TraceHeader,
  type TraceState,
  type ViewSpec,
} from './types';

export interface TraceBudget {
  readonly maxFrames: number;
  readonly maxBytes: number;
}

export const DEFAULT_BUDGET: TraceBudget = { maxFrames: 250_000, maxBytes: 64 * 1024 * 1024 };

/** Un segmento no se cierra antes de este peso, para que los estados pequeños no generen keyframes de más. */
const MIN_SEGMENT_WEIGHT = 256;
/** Ni se alarga más allá de este: es la cota de lo que cuesta reconstruir un frame. */
const MAX_SEGMENT_WEIGHT = 4096;

export class TraceLimitError extends Error {
  readonly reason: 'frames' | 'bytes';

  constructor(reason: 'frames' | 'bytes') {
    super(`La traza supera el presupuesto de ${reason}`);
    this.reason = reason;
  }
}

export interface EmittedFrame {
  readonly anchor: string | null;
  readonly explain: string;
  readonly phase: Phase;
  readonly level: Level;
  readonly marks?: readonly Mark[];
  readonly arrows?: readonly Arrow[];
}

/**
 * Acumula el estado, registra cada cambio como delta y empaqueta los frames en segmentos.
 *
 * Cada segmento empieza con un keyframe. Se cierra cuando sus deltas ya pesan tanto como el keyframe,
 * así que los keyframes nunca ocupan más que los deltas y reconstruir un frame cuesta como mucho
 * copiar un keyframe más MAX_SEGMENT_WEIGHT operaciones.
 */
export class TraceBuilder {
  readonly state: TraceState = {
    structures: {},
    stack: [{ id: -1, fn: '<global>', args: {}, vars: {} }],
    calls: [],
  };
  readonly counters: Record<CounterName, number> = {
    comparisons: 0,
    swaps: 0,
    reads: 0,
    writes: 0,
    calls: 0,
    savedCalls: 0,
  };

  private readonly anchors: readonly string[];
  private readonly detail: Level;
  private readonly budget: TraceBudget;
  private readonly encoder = new TextEncoder();

  private frameCount = 0;
  private nextItem: ItemId = 0;
  private pending: DeltaOp[] = [];
  private readonly usedRoles = new Set<Role>();
  private readonly chapters: { frame: number; title: string }[] = [];

  private readonly anchorColumn: number[] = [];
  private readonly levelColumn: number[] = [];
  private readonly phaseColumn: number[] = [];
  private readonly counterColumn: number[] = [];

  private readonly segmentStarts: number[] = [-1];
  private readonly segments: Uint8Array[] = [];
  private keyframe: string;
  private openFrames: string[] = [];
  private openChars = 0;
  private segmentWeight = 0;
  private closedBytes = 0;

  constructor(anchors: readonly string[], detail: Level, budget: TraceBudget) {
    this.anchors = anchors;
    this.detail = detail;
    this.budget = budget;
    this.keyframe = JSON.stringify(this.state);
  }

  nextItemId(): ItemId {
    return this.nextItem++;
  }

  noteRole(role: Role): void {
    this.usedRoles.add(role);
  }

  chapter(title: string): void {
    this.chapters.push({ frame: this.frameCount, title });
  }

  /** Asigna en el estado y guarda el delta. Cada lado se queda su propia copia. */
  record(path: Path, value: unknown): void {
    applyOp(this.state, [path, clone(value)]);
    this.pending.push([path, clone(value)]);
  }

  remove(path: Path): void {
    applyOp(this.state, [path]);
    this.pending.push([path]);
  }

  emit(frame: EmittedFrame): void {
    // Un frame por encima del detalle pedido no se emite, pero sus cambios viajan con el siguiente.
    if (frame.level > this.detail) return;
    if (this.frameCount >= this.budget.maxFrames) throw new TraceLimitError('frames');

    const marks = frame.marks ?? [];
    for (const mark of marks) this.usedRoles.add(mark.role);

    const stored: StoredFrame = [frame.explain, marks, frame.arrows ?? [], this.pending];
    const json = JSON.stringify(stored);

    this.openChars += json.length;
    if (this.closedBytes + this.keyframe.length + this.openChars > this.budget.maxBytes) {
      throw new TraceLimitError('bytes');
    }

    this.anchorColumn.push(frame.anchor === null ? 0 : this.anchors.indexOf(frame.anchor) + 1);
    this.levelColumn.push(frame.level);
    this.phaseColumn.push(PHASES.indexOf(frame.phase));
    for (const name of COUNTER_NAMES) this.counterColumn.push(this.counters[name]);

    this.openFrames.push(json);
    this.frameCount++;
    this.segmentWeight += 1 + this.pending.length;
    this.pending = [];

    if (this.shouldCloseSegment()) {
      this.closeSegment();
      this.keyframe = JSON.stringify(this.state);
      this.segmentStarts.push(this.frameCount - 1);
      this.segmentWeight = 0;
    }
  }

  finish(meta: {
    algorithmId: string;
    input: unknown;
    views: readonly ViewSpec[];
    result: unknown;
    truncated: TraceHeader['truncated'];
  }): EncodedTrace {
    this.closeSegment();
    const anchor = Uint16Array.from(this.anchorColumn);
    const counters = Uint32Array.from(this.counterColumn);

    return {
      header: {
        schema: 1,
        algorithmId: meta.algorithmId,
        input: meta.input,
        frameCount: this.frameCount,
        anchors: this.anchors,
        views: meta.views,
        chapters: this.chapters,
        roles: [...this.usedRoles],
        result: meta.result,
        fingerprint: fingerprint(anchor, counters, meta.result),
        detail: this.detail,
        truncated: meta.truncated,
      },
      anchor,
      level: Uint8Array.from(this.levelColumn),
      phase: Uint8Array.from(this.phaseColumn),
      counters,
      segmentStart: Int32Array.from(this.segmentStarts),
      segments: this.segments,
    };
  }

  private shouldCloseSegment(): boolean {
    if (this.segmentWeight >= MAX_SEGMENT_WEIGHT) return true;
    return this.segmentWeight >= MIN_SEGMENT_WEIGHT && this.openChars >= this.keyframe.length;
  }

  private closeSegment(): void {
    const bytes = this.encoder.encode(`{"key":${this.keyframe},"fr":[${this.openFrames.join(',')}]}`);
    this.segments.push(bytes);
    this.closedBytes += bytes.length;
    this.openFrames = [];
    this.openChars = 0;
  }
}
