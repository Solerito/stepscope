import type { InputField, InputSpec } from '../algorithm';
import { type IntArrayField, type IntField, intArray, intInRange } from './index';

type AnyField = InputField<unknown>;
// biome-ignore lint/suspicious/noExplicitAny: compara entradas de algoritmos distintos, cada una con su tipo
type AnySpec = InputSpec<any>;

export const fieldsOf = (spec: AnySpec) => Object.entries(spec.fields) as [string, AnyField][];

/** Los campos que configuran el algoritmo: en una comparación, cada lado elige los suyos. */
export const variantFields = (spec: AnySpec) => fieldsOf(spec).filter(([, field]) => field.variant === true);

const dataFields = (spec: AnySpec) => fieldsOf(spec).filter(([, field]) => field.variant !== true);

/**
 * La entrada común de dos algoritmos: los mismos campos de datos, con igual nombre y tipo, y cada uno
 * restringido a lo que aceptan los dos. Devuelve null si no se pueden ejecutar sobre la misma entrada.
 */
export function sharedFields(a: AnySpec, b: AnySpec): Readonly<Record<string, AnyField>> | null {
  const left = dataFields(a);
  const right = new Map(dataFields(b));
  if (left.length === 0 || left.length !== right.size) return null;

  const shared: Record<string, AnyField> = {};
  for (const [name, field] of left) {
    const other = right.get(name);
    const both = other ? intersectFields(field, other) : null;
    if (!both) return null;
    shared[name] = both;
  }
  return shared;
}

/** Un campo que solo acepta lo que aceptan los dos. Null si no hay nada que acepten ambos. */
export function intersectFields(a: AnyField, b: AnyField): AnyField | null {
  if (a === b) return a;
  if (a.kind !== b.kind) return null;
  if (a.kind === 'int-array') return intersectArrays(a as never, b as never) as AnyField | null;
  if (a.kind === 'int') return intersectInts(a as never, b as never) as AnyField | null;
  return null;
}

/** Si uno de los dos ya describe exactamente el resultado, su etiqueta es la más precisa. */
function labelFor<F extends { readonly label: string }>(a: F, b: F, matches: (field: F) => boolean): string {
  return matches(b) && !matches(a) ? b.label : a.label;
}

function intersectArrays(a: IntArrayField, b: IntArrayField): IntArrayField | null {
  const bounds = {
    minLength: Math.max(a.minLength, b.minLength),
    maxLength: Math.min(a.maxLength, b.maxLength),
    min: Math.max(a.min, b.min),
    max: Math.min(a.max, b.max),
    sorted: a.sorted || b.sorted,
  };
  if (bounds.minLength > bounds.maxLength || bounds.min > bounds.max) return null;

  const label = labelFor(
    a,
    b,
    (field) =>
      field.minLength === bounds.minLength &&
      field.maxLength === bounds.maxLength &&
      field.min === bounds.min &&
      field.max === bounds.max &&
      field.sorted === bounds.sorted,
  );
  const probe = intArray({ ...bounds, label, default: [] });
  // Valores crecientes desde el mínimo: válidos también si el campo exige el array ordenado.
  const fallback = Array.from({ length: Math.min(bounds.maxLength, Math.max(bounds.minLength, 6)) }, (_, i) =>
    Math.min(bounds.max, bounds.min + i),
  );
  const value = [a.default, b.default].find((candidate) => probe.validate(candidate) === null) ?? fallback;
  return intArray({ ...bounds, label, default: value });
}

function intersectInts(a: IntField, b: IntField): IntField | null {
  const min = Math.max(a.min, b.min);
  const max = Math.min(a.max, b.max);
  if (min > max) return null;
  const label = labelFor(a, b, (field) => field.min === min && field.max === max);
  const value = [a.default, b.default].find((candidate) => candidate >= min && candidate <= max) ?? min;
  return intInRange({ label, min, max, default: value });
}
