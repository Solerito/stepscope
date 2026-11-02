import type { TraceBuilder } from '../trace/builder';
import { toScalar } from '../trace/delta';
import { seededRandom } from '../trace/random';
import type { Scalar, VarValue } from '../trace/types';
import { createTracedArray } from './array';
import { createTracedBuckets } from './buckets';
import { createRecursion } from './recursion';
import type { StepOptions, Tracer, Widen } from './types';

export function createTracer<A extends string>(builder: TraceBuilder, seed: number): Tracer<A> {
  const random = seededRandom(seed);

  const vars = (values: Readonly<Record<string, VarValue | undefined>>) => {
    const top = builder.state.stack.length - 1;
    const current = builder.state.stack[top]?.vars ?? {};
    for (const name of Object.keys(values)) {
      const value = values[name];
      if (value === undefined) {
        if (name in current) builder.remove(['stack', top, 'vars', name]);
        continue;
      }
      const normalized = Array.isArray(value)
        ? (value as readonly Scalar[]).map(toScalar)
        : toScalar(value as Scalar);
      if (JSON.stringify(current[name]) !== JSON.stringify(normalized)) {
        builder.record(['stack', top, 'vars', name], normalized);
      }
    }
  };

  return {
    step(anchor, explain, options: StepOptions = {}) {
      if (options.vars) vars(options.vars);
      builder.emit({
        anchor,
        explain,
        phase: options.phase ?? 'step',
        level: options.level ?? 1,
        ...(options.marks ? { marks: options.marks } : {}),
        ...(options.arrows ? { arrows: options.arrows } : {}),
      });
    },

    vars,

    chapter(title) {
      builder.chapter(title);
    },

    compare(outcome) {
      builder.counters.comparisons++;
      return outcome;
    },

    array<T extends Scalar>(id: string, values: readonly T[]) {
      return createTracedArray(builder, id, values as readonly Widen<T>[]);
    },

    buckets<T extends Scalar = number>(id: string, count: number, labels?: readonly string[]) {
      return createTracedBuckets<Widen<T>>(builder, id, count, labels);
    },

    ...createRecursion<A>(builder),

    random,
  };
}
