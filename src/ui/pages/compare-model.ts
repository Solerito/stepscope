import { type ChoiceField, type InputField, sharedFields, variantFields } from '@/core';
import { findAlgorithm, type RegisteredAlgorithm } from '../../algorithms/registry';
import { formatCompareHash, type Params } from '../../routing/hash';
import { catalogOrder } from '../catalog';
import { type InputValue, readField } from '../input-editors/params';

export const SIDES = ['a', 'b'] as const;
export type Side = (typeof SIDES)[number];
export type Pair<T> = readonly [T, T];
export type SharedFields = Readonly<Record<string, InputField<unknown>>>;

/**
 * Se comparan dos algoritmos con la misma entrada de datos. Uno consigo mismo solo tiene sentido si
 * tiene variantes, como los pivotes de quicksort: entonces cada lado elige la suya.
 */
export function canCompare(a: RegisteredAlgorithm, b: RegisteredAlgorithm): boolean {
  if (a === b) return variantFields(a.input).length > 0;
  return sharedFields(a.input, b.input) !== null;
}

/** Con quién se puede comparar `a`, en el orden del catálogo. */
export function partnersOf(a: RegisteredAlgorithm): RegisteredAlgorithm[] {
  return catalogOrder.filter((b) => canCompare(a, b));
}

/** El primer compañero distinto de él mismo; si no hay, él mismo con otra variante; si tampoco, ninguno. */
export function defaultPartner(a: RegisteredAlgorithm): RegisteredAlgorithm | null {
  const partners = partnersOf(a);
  return partners.find((b) => b !== a) ?? partners[0] ?? null;
}

export type ResolvedPair =
  | { readonly kind: 'pair'; readonly pair: Pair<RegisteredAlgorithm> }
  | { readonly kind: 'unknown'; readonly id: string }
  | { readonly kind: 'alone'; readonly algorithm: RegisteredAlgorithm };

/** Completa lo que falte en el enlace: sin algoritmos, el primero que tenga compañero; sin B, el suyo. */
export function resolvePair(ids: readonly string[]): ResolvedPair {
  const found = ids.map((id) => ({ id, algorithm: findAlgorithm(id) }));
  const unknown = found.find((entry) => !entry.algorithm);
  if (unknown) return { kind: 'unknown', id: unknown.id };

  const a = found[0]?.algorithm ?? catalogOrder.find((candidate) => defaultPartner(candidate) !== null);
  if (!a) return { kind: 'unknown', id: '' };

  const requested = found[1]?.algorithm;
  const b = requested && canCompare(a, requested) ? requested : defaultPartner(a);
  return b ? { kind: 'pair', pair: [a, b] } : { kind: 'alone', algorithm: a };
}

/** La entrada de una comparación: los datos comunes y las variantes de cada lado. */
export interface CompareInput {
  readonly shared: InputValue;
  readonly a: InputValue;
  readonly b: InputValue;
}

/** Con el mismo algoritmo en los dos lados, B empieza con la opción siguiente: si no, serían idénticos. */
function nextOption(field: InputField<unknown>, value: unknown): unknown {
  if (field.kind !== 'choice') return value;
  const options = Object.keys((field as ChoiceField<string>).options);
  return options[(options.indexOf(String(value)) + 1) % options.length] ?? value;
}

export function compareInputFromParams(
  pair: Pair<RegisteredAlgorithm>,
  shared: SharedFields,
  params: Params,
): CompareInput {
  const [a, b] = pair;
  const sharedValue: InputValue = {};
  for (const [name, field] of Object.entries(shared)) sharedValue[name] = readField(field, params[name]);

  const aValue: InputValue = {};
  for (const [name, field] of variantFields(a.input)) aValue[name] = readField(field, params[`a.${name}`]);

  const bValue: InputValue = {};
  for (const [name, field] of variantFields(b.input)) {
    const fallback = a === b ? nextOption(field, aValue[name]) : field.default;
    bValue[name] = readField(field, params[`b.${name}`], fallback);
  }
  return { shared: sharedValue, a: aValue, b: bValue };
}

export function compareParams(
  pair: Pair<RegisteredAlgorithm>,
  shared: SharedFields,
  input: CompareInput,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [name, field] of Object.entries(shared)) params[name] = field.format(input.shared[name]);
  SIDES.forEach((side, k) => {
    for (const [name, field] of variantFields((pair[k] as RegisteredAlgorithm).input)) {
      params[`${side}.${name}`] = field.format(input[side][name]);
    }
  });
  return params;
}

/** El enlace a comparar este algoritmo con lo que tiene ahora: sus datos pasan a ser la entrada común. */
export function compareLinkFor(algorithm: RegisteredAlgorithm, input: InputValue): string {
  const params: Record<string, string> = {};
  for (const [name, field] of Object.entries(algorithm.input.fields as Record<string, InputField<unknown>>)) {
    params[field.variant ? `a.${name}` : name] = field.format(input[name]);
  }
  return formatCompareHash([algorithm.id], params);
}
