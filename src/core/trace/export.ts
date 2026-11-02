import { TraceCursor } from './cursor';
import type {
  Arrow,
  Counters,
  DeltaOp,
  EncodedTrace,
  Level,
  Mark,
  Phase,
  StoredFrame,
  TraceHeader,
  TraceState,
} from './types';

export interface ExportedFrame {
  readonly index: number;
  readonly anchor: string | null;
  readonly level: Level;
  readonly phase: Phase;
  readonly explain: string;
  readonly counters: Counters;
  readonly marks: readonly Mark[];
  readonly arrows: readonly Arrow[];
  /**
   * Lo que cambia el estado en este frame, en orden: `[ruta, valor]` asigna y `[ruta]` borra. Borrar
   * en un array quita el elemento y desplaza los siguientes, como `splice`.
   */
  readonly delta: readonly DeltaOp[];
}

/**
 * La traza en JSON legible. Cada frame guarda solo lo que cambia, como la traza original: con el
 * estado completo en cada frame, fib(15) pasaría de 1 MB a más de 500.
 */
export interface ExportedTrace {
  readonly format: 'stepscope-trace';
  readonly version: 1;
  readonly header: TraceHeader;
  /** El estado antes del primer frame. Aplicando los `delta` en orden se llega a cualquier otro. */
  readonly initial: TraceState;
  readonly frames: readonly ExportedFrame[];
}

const EMPTY_STATE: TraceState = { structures: {}, stack: [], calls: [] };

/** Decodifica todos los segmentos y descarta los keyframes, que solo existen para saltar rápido. */
export function exportTrace(trace: EncodedTrace): ExportedTrace {
  const decoder = new TextDecoder();
  const cursor = new TraceCursor(trace);
  const frames: ExportedFrame[] = [];
  let initial = EMPTY_STATE;

  trace.segments.forEach((bytes, segmentIndex) => {
    const segment = JSON.parse(decoder.decode(bytes)) as { key: TraceState; fr: StoredFrame[] };
    if (segmentIndex === 0) initial = segment.key;
    for (const [explain, marks, arrows, delta] of segment.fr) {
      const index = frames.length;
      frames.push({ index, ...cursor.metaAt(index), explain, marks, arrows, delta });
    }
  });

  return { format: 'stepscope-trace', version: 1, header: trace.header, initial, frames };
}
