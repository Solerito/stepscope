import type { DeltaOp, Scalar } from './types';

export function clone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clone) as T;
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) copy[key] = clone((value as Record<string, unknown>)[key]);
  return copy as T;
}

/** Claves que nunca son parte del estado de una traza: escribirlas tocaría el prototipo. */
const FORBIDDEN_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

/** Más profundo que cualquier ruta que emita el tracer: `['structures', id, 'cells', i, 'value']`. */
const MAX_PATH_DEPTH = 8;

/**
 * Aplica una operación sobre `target`. Quien la llama debe pasar valores que `target` pueda poseer.
 *
 * Hoy todas las rutas las construye el tracer con nombres propios e índices ya comprobados, así
 * que estas dos guardas no rechazan nada real. Están porque el día que una traza entre desde
 * fuera —importar un JSON exportado, por ejemplo— esta función pasaría a escribir rutas ajenas.
 */
export function applyOp(target: unknown, op: DeltaOp): void {
  const path = op[0];
  if (path.length > MAX_PATH_DEPTH) throw new Error(`Ruta de delta demasiado profunda: ${path.length}`);
  for (const segment of path) {
    if (typeof segment === 'string' && FORBIDDEN_KEYS.includes(segment)) {
      throw new Error(`«${segment}» no puede ser parte de una ruta de delta`);
    }
  }
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
