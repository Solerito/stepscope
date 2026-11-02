import type { DeltaOp, Scalar } from './types';

export function clone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clone) as T;
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) copy[key] = clone((value as Record<string, unknown>)[key]);
  return copy as T;
}

/** Aplica una operación sobre `target`. Quien la llama debe pasar valores que `target` pueda poseer. */
export function applyOp(target: unknown, op: DeltaOp): void {
  const path = op[0];
  let node = target as Record<string | number, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    node = node[path[i] as string | number] as Record<string | number, unknown>;
  }
  const key = path[path.length - 1] as string | number;
  if (op.length === 1) {
    if (Array.isArray(node)) node.splice(key as number, 1);
    else delete node[key];
  } else {
    node[key] = op[1];
  }
}

/** JSON convierte Infinity y NaN en null sin avisar: se normalizan antes de entrar en la traza. */
export function toScalar<T extends Scalar>(value: T): Scalar {
  if (typeof value !== 'number' || Number.isFinite(value)) return value;
  if (Number.isNaN(value)) return 'NaN';
  return value > 0 ? '∞' : '-∞';
}
