import type { TraceBuilder } from '../trace/builder';
import { toScalar } from '../trace/delta';
import type { BucketsState, Cell, Scalar, StructureId } from '../trace/types';
import type { TracedBuckets } from './types';

export function createTracedBuckets<T extends Scalar>(
  builder: TraceBuilder,
  id: StructureId,
  count: number,
  labels?: readonly string[],
): TracedBuckets<T> {
  builder.record(['structures', id], {
    kind: 'buckets',
    buckets: Array.from({ length: count }, () => []),
    ...(labels ? { labels: [...labels] } : {}),
  } satisfies BucketsState);

  const bucketAt = (bucket: number): Cell[] => {
    const cells = (builder.state.structures[id] as BucketsState).buckets[bucket];
    if (!cells) throw new RangeError(`${id} no tiene el cubo ${bucket}`);
    return cells;
  };

  return {
    id,
    count,

    size(bucket) {
      return bucketAt(bucket).length;
    },

    push(bucket, value) {
      const cells = bucketAt(bucket);
      builder.counters.writes++;
      builder.record(['structures', id, 'buckets', bucket, cells.length], {
        id: builder.nextItemId(),
        value: toScalar(value),
      });
    },

    shift(bucket) {
      const first = bucketAt(bucket)[0];
      if (!first) throw new RangeError(`El cubo ${bucket} de ${id} está vacío`);
      builder.counters.reads++;
      builder.remove(['structures', id, 'buckets', bucket, 0]);
      return first.value as T;
    },

    mark(bucket, index, role, label) {
      const cell = bucketAt(bucket)[index];
      if (!cell) throw new RangeError(`${id}[${bucket}][${index}] no existe`);
      return { s: id, item: cell.id, role, ...(label === undefined ? {} : { label }) };
    },
  };
}
