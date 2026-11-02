import type { AlgorithmDefinition } from '../algorithm';
import { createTracer } from '../tracer/tracer';
import { DEFAULT_BUDGET, type TraceBudget, TraceBuilder, TraceLimitError } from './builder';
import type { EncodedTrace, Level, TraceHeader } from './types';

export interface RunOptions {
  readonly algorithmId?: string;
  readonly detail?: Level;
  readonly budget?: TraceBudget;
  readonly seed?: number;
}

export function runTrace<I, R, A extends string>(
  definition: AlgorithmDefinition<I, R, A>,
  input: I,
  options: RunOptions = {},
): EncodedTrace {
  const builder = new TraceBuilder(definition.anchors, options.detail ?? 2, options.budget ?? DEFAULT_BUDGET);
  const tracer = createTracer<A>(builder, options.seed ?? 1);

  let result: unknown = null;
  let truncated: TraceHeader['truncated'] = null;
  try {
    result = definition.trace(input, tracer);
  } catch (error) {
    if (!(error instanceof TraceLimitError)) throw error;
    truncated = error.reason;
  }

  return builder.finish({
    algorithmId: options.algorithmId ?? '',
    input,
    views: definition.views,
    result,
    truncated,
  });
}
