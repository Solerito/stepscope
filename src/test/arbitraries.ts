import fc from 'fast-check';
import type { ChoiceField, InputField, InputSpec, IntArrayField } from '@/core';

/** Las propiedades no necesitan arrays enormes: encuentran los fallos antes y corren mucho más rápido. */
const MAX_ARBITRARY_LENGTH = 24;

function arbitraryForField(field: InputField<unknown>): fc.Arbitrary<unknown> {
  switch (field.kind) {
    case 'int-array': {
      const { minLength, maxLength, min, max, sorted } = field as unknown as IntArrayField;
      const values = fc.array(fc.integer({ min, max }), {
        minLength,
        maxLength: Math.min(maxLength, Math.max(minLength, MAX_ARBITRARY_LENGTH)),
      });
      return sorted ? values.map((array) => array.sort((a, b) => a - b)) : values;
    }
    case 'int': {
      const { min, max } = field as unknown as { min: number; max: number };
      return fc.integer({ min, max });
    }
    case 'choice': {
      const { options } = field as unknown as ChoiceField<string>;
      return fc.constantFrom(...Object.keys(options));
    }
    default:
      throw new Error(`Sin generador de fast-check para el campo «${field.kind}»: añádelo aquí`);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: el registro de algoritmos es heterogéneo
export function arbitraryFor(input: InputSpec<any>): fc.Arbitrary<any> {
  const fields: Record<string, fc.Arbitrary<unknown>> = {};
  for (const [name, field] of Object.entries(input.fields)) {
    fields[name] = arbitraryForField(field as InputField<unknown>);
  }
  return fc.record(fields);
}
