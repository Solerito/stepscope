import { applyOp, clone } from './delta';
import {
  COUNTER_NAMES,
  type CounterName,
  type Counters,
  type EncodedTrace,
  type Frame,
  type Level,
  PHASES,
  type StoredFrame,
  type TraceState,
} from './types';

interface DecodedSegment {
  readonly key: TraceState;
  readonly fr: readonly StoredFrame[];
}

const CACHED_SEGMENTS = 3;

/** Reconstruye cualquier frame de una traza codificada. El `state` devuelto se reutiliza entre seeks. */
export class TraceCursor {
  readonly trace: EncodedTrace;

  private readonly decoder = new TextDecoder();
  private readonly cache = new Map<number, DecodedSegment>();
  private workingState: TraceState | null = null;
  private workingSegment = -1;
  private position = -2;

  constructor(trace: EncodedTrace) {
    this.trace = trace;
  }

  get frameCount(): number {
    return this.trace.header.frameCount;
  }

  seek(index: number): Frame {
    if (index < 0 || index >= this.frameCount) {
      throw new RangeError(`Frame ${index} fuera de la traza (${this.frameCount} frames)`);
    }

    // El keyframe guarda el estado tras `start`, pero los metadatos de ese frame están en el segmento
    // anterior: por eso se busca el último segmento con start < index, no <=.
    const segmentIndex = this.findSegment(index);
    const segment = this.loadSegment(segmentIndex);
    const start = this.trace.segmentStart[segmentIndex] as number;

    let state = this.workingState;
    if (state === null || this.workingSegment !== segmentIndex || this.position > index) {
      state = clone(segment.key);
      this.workingState = state;
      this.workingSegment = segmentIndex;
      this.position = start;
    }

    for (let frame = this.position + 1; frame <= index; frame++) {
      const stored = segment.fr[frame - start - 1] as StoredFrame;
      for (const op of stored[3]) {
        // Sin clonar, el estado compartiría objetos con el segmento en caché y una operación posterior
        // mutaría el delta: al volver a pasar por aquí se reconstruiría un frame incorrecto.
        applyOp(state, op.length === 2 ? [op[0], clone(op[1])] : op);
      }
    }
    this.position = index;

    const stored = segment.fr[index - start - 1] as StoredFrame;
    const anchor = this.trace.anchor[index] as number;

    return {
      index,
      anchor: anchor === 0 ? null : (this.trace.header.anchors[anchor - 1] as string),
      level: this.trace.level[index] as Level,
      phase: PHASES[this.trace.phase[index] as number] as Frame['phase'],
      explain: stored[0],
      counters: this.countersAt(index),
      marks: stored[1],
      arrows: stored[2],
      state,
    };
  }

  countersAt(index: number): Counters {
    const base = index * COUNTER_NAMES.length;
    const counters = {} as Record<CounterName, number>;
    COUNTER_NAMES.forEach((name, offset) => {
      counters[name] = this.trace.counters[base + offset] as number;
    });
    return counters;
  }

  private findSegment(index: number): number {
    const starts = this.trace.segmentStart;
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if ((starts[middle] as number) < index) low = middle;
      else high = middle - 1;
    }
    return low;
  }

  private loadSegment(segmentIndex: number): DecodedSegment {
    const cached = this.cache.get(segmentIndex);
    if (cached) {
      this.cache.delete(segmentIndex);
      this.cache.set(segmentIndex, cached);
      return cached;
    }

    const bytes = this.trace.segments[segmentIndex] as Uint8Array;
    const decoded = JSON.parse(this.decoder.decode(bytes)) as DecodedSegment;
    this.cache.set(segmentIndex, decoded);
    if (this.cache.size > CACHED_SEGMENTS) {
      this.cache.delete(this.cache.keys().next().value as number);
    }
    return decoded;
  }
}

/** Las memorias que hay que transferir, no copiar, al enviar una traza entre hilos. */
export function transferablesOf(trace: EncodedTrace): ArrayBuffer[] {
  const views: ArrayBufferView[] = [
    trace.anchor,
    trace.level,
    trace.phase,
    trace.counters,
    trace.segmentStart,
    ...trace.segments,
  ];
  return views.map((view) => view.buffer as ArrayBuffer);
}
