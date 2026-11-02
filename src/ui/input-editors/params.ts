import { fieldsOf, InputError, type InputField, type InputSpec } from '@/core';

export type InputValue = Record<string, unknown>;

/** El valor que indica el texto de un enlace, o el del campo por defecto si no se entiende. */
export function readField<T>(field: InputField<T>, text: string | undefined, fallback: T = field.default): T {
  if (text === undefined) return fallback;
  try {
    const parsed = field.parse(text);
    return field.validate(parsed) === null ? parsed : fallback;
  } catch (error) {
    if (!(error instanceof InputError)) throw error;
    return fallback;
  }
}

/** La entrada que indica la URL. Lo que no se entienda se sustituye por su valor por defecto. */
// biome-ignore lint/suspicious/noExplicitAny: el registro de algoritmos es heterogéneo
export function inputFromParams(spec: InputSpec<any>, params: Readonly<Record<string, string>>): InputValue {
  const input: InputValue = {};
  for (const [name, field] of fieldsOf(spec)) input[name] = readField(field, params[name]);
  return input;
}

// biome-ignore lint/suspicious/noExplicitAny: el registro de algoritmos es heterogéneo
export function paramsFromInput(spec: InputSpec<any>, input: InputValue): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [name, field] of fieldsOf(spec)) params[name] = field.format(input[name]);
  return params;
}
