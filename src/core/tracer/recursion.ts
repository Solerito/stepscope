import type { TraceBuilder } from '../trace/builder';
import { toScalar } from '../trace/delta';
import type { CallStatus, Phase, Role, Scalar } from '../trace/types';
import type { RecursiveSpec, Tracer } from './types';

type RecursionApi<A extends string> = Pick<Tracer<A>, 'recursive' | 'ret' | 'memoHit' | 'prune'>;

const ROLE_OF_STATUS: Record<CallStatus, Role> = {
  active: 'active',
  waiting: 'waiting',
  done: 'done',
  'memo-hit': 'memo-hit',
  pruned: 'pruned',
};

export function createRecursion<A extends string>(builder: TraceBuilder): RecursionApi<A> {
  // Llamadas que costaría cada subárbol sin memoizar, abierto por cada marco de la pila.
  const naiveCalls: number[] = [0];
  // Lo mismo por firma de llamada: un acierto de memo se ahorra lo que costó la primera vez.
  const naiveBySignature = new Map<string, number>();

  const setStatus = (callId: number, status: CallStatus) => {
    builder.noteRole(ROLE_OF_STATUS[status]);
    builder.record(['calls', callId, 'status'], status);
  };

  const leave = <R extends Scalar>(
    anchor: A,
    value: R,
    explain: string,
    status: CallStatus,
    phase: Phase,
  ): R => {
    const top = builder.state.stack.length - 1;
    const frame = builder.state.stack[top];
    if (!frame || top === 0) throw new Error('Se ha salido de una llamada fuera de t.recursive()');

    const signature = `${frame.fn}|${JSON.stringify(frame.args)}`;
    let size = naiveCalls.pop() ?? 1;
    if (status === 'memo-hit') {
      size = naiveBySignature.get(signature) ?? 1;
      const saved = size - 1;
      builder.counters.savedCalls += saved;
      builder.record(['calls', frame.id, 'saved'], saved);
    } else {
      naiveBySignature.set(signature, size);
    }
    naiveCalls[naiveCalls.length - 1] = (naiveCalls.at(-1) ?? 0) + size;

    builder.record(['calls', frame.id, 'ret'], toScalar(value));
    setStatus(frame.id, status);

    const caller = builder.state.stack[top - 1];
    if (value !== null && caller && caller.id >= 0) builder.noteRole('returned');

    // El marco sigue en la pila durante el frame de retorno: la línea activa aún es de esta llamada.
    builder.emit({ anchor, explain, phase, level: 0 });

    builder.remove(['stack', top]);
    if (caller && caller.id >= 0) setStatus(caller.id, 'active');

    return value;
  };

  return {
    recursive<P extends readonly Scalar[], R extends Scalar>(
      spec: RecursiveSpec<A>,
      body: (...args: P) => R,
    ) {
      return (...args: P): R => {
        const named: Record<string, Scalar> = {};
        spec.params.forEach((param, i) => {
          named[param] = toScalar(args[i] as Scalar);
        });

        const top = builder.state.stack.length - 1;
        const caller = builder.state.stack[top];
        if (caller && caller.id >= 0) setStatus(caller.id, 'waiting');

        const id = builder.state.calls.length;
        const parent = caller && caller.id >= 0 ? caller.id : null;
        builder.counters.calls++;
        naiveCalls.push(1);
        builder.noteRole('active');
        builder.record(['calls', id], { id, parent, fn: spec.name, args: named, status: 'active' });
        builder.record(['stack', top + 1], { id, fn: spec.name, args: named, vars: {} });

        const label = `${spec.name}(${args.join(', ')})`;
        builder.emit({ anchor: spec.enter, explain: `Llamo a ${label}`, phase: 'call', level: 0 });

        const depth = builder.state.stack.length;
        const result = body(...args);
        if (builder.state.stack.length !== depth - 1) {
          throw new Error(`${label} ha salido sin pasar por t.ret(), t.memoHit() ni t.prune()`);
        }
        return result;
      };
    },

    ret(anchor, value, explain) {
      return leave(anchor, value, explain ?? `Devuelve ${value}`, 'done', 'return');
    },

    memoHit(anchor, value, explain) {
      return leave(anchor, value, explain ?? `Ya estaba calculado: ${value}`, 'memo-hit', 'memo-hit');
    },

    prune(anchor, value, explain) {
      return leave(anchor, value, explain ?? 'Descarto esta rama', 'pruned', 'prune');
    },
  };
}
