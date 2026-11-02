import type { TraceBuilder } from '../trace/builder';
import { toScalar } from '../trace/delta';
import type { ArrayState, Cell, Scalar, StructureId } from '../trace/types';
import type { TracedArray } from './types';

export function createTracedArray<T extends Scalar>(
  builder: TraceBuilder,
  id: StructureId,
  values: readonly T[],
): TracedArray<T> {
  builder.record(['structures', id], {
    kind: 'array',
    cells: values.map((value) => ({ id: builder.nextItemId(), value: toScalar(value) })),
  } satisfies ArrayState);

  const cells = () => (builder.state.structures[id] as ArrayState).cells;

  const cellAt = (i: number): Cell => {
    const cell = cells()[i];
    if (!cell) throw new RangeError(`${id}[${i}] está fuera del array`);
    return cell;
  };

  return {
    id,

    get length() {
      return cells().length;
    },

    get(i) {
      builder.counters.reads++;
      return cellAt(i).value as T;
    },

    peek(i) {
      return cellAt(i).value as T;
    },

    set(i, value) {
      cellAt(i);
      builder.counters.writes++;
      builder.record(['structures', id, 'cells', i, 'value'], toScalar(value));
    },

    swap(i, j) {
      const first = cellAt(i);
      const second = cellAt(j);
      builder.counters.swaps++;
      builder.counters.reads += 2;
      builder.counters.writes += 2;
      builder.record(['structures', id, 'cells', i], second);
      builder.record(['structures', id, 'cells', j], first);
    },

    setRole(i, role) {
      const cell = cellAt(i);
      if (role === null) {
        if (cell.role !== undefined) builder.remove(['structures', id, 'cells', i, 'role']);
        return;
      }
      builder.noteRole(role);
      builder.record(['structures', id, 'cells', i, 'role'], role);
    },

    mark(i, role, label) {
      return { s: id, item: cellAt(i).id, role, ...(label === undefined ? {} : { label }) };
    },

    toArray() {
      return cells().map((cell) => cell?.value as T);
    },
  };
}
