import { describe, expect, it } from 'vitest';
import { choice, form, intArray, intersectFields, intInRange, sharedFields, variantFields } from '@/core';

const sortInput = form({
  values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [5, 2, 4] }),
});
const smallSortInput = form({
  values: intArray({
    label: 'Array (de 0 a 99)',
    minLength: 1,
    maxLength: 100,
    min: 0,
    max: 99,
    default: [4, 1, 3],
  }),
});
const pivotInput = form({
  values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [9, 8] }),
  pivot: choice({ label: 'Pivote', options: { last: 'El último', first: 'El primero' }, default: 'last' }),
  seed: intInRange({ label: 'Semilla', min: 1, max: 99, default: 1, variant: true }),
});
const searchInput = form({
  values: intArray({ minLength: 1, maxLength: 200, min: -999, max: 999, default: [7, 3, 9] }),
  target: intInRange({ label: 'Valor buscado', min: -999, max: 999, default: 4 }),
});
const sortedSearchInput = form({
  values: intArray({
    label: 'Array ordenado',
    minLength: 1,
    maxLength: 200,
    min: -999,
    max: 999,
    sorted: true,
    default: [1, 3, 9],
  }),
  target: intInRange({ label: 'Valor buscado', min: -999, max: 999, default: 3 }),
});

describe('variantFields', () => {
  it('son las opciones y lo que se declare como variante, no los datos', () => {
    expect(variantFields(pivotInput).map(([name]) => name)).toEqual(['pivot', 'seed']);
    expect(variantFields(sortInput)).toEqual([]);
  });
});

describe('sharedFields', () => {
  it('comparte los datos aunque uno de los dos tenga variantes', () => {
    expect(Object.keys(sharedFields(pivotInput, sortInput) ?? {})).toEqual(['values']);
  });

  it('no compara entradas con campos distintos', () => {
    expect(sharedFields(sortInput, searchInput)).toBeNull();
    expect(sharedFields(searchInput, sortInput)).toBeNull();
  });

  it('el campo común solo acepta lo que aceptan los dos', () => {
    const values = sharedFields(sortInput, smallSortInput)?.values;
    expect(values?.validate([5, 99])).toBeNull();
    expect(values?.validate([-1, 5])).toContain('rango');
    expect(values?.validate([100])).toContain('rango');
    expect(values?.label).toBe('Array (de 0 a 99)');
  });

  it('si uno exige el array ordenado, el común también', () => {
    const shared = sharedFields(searchInput, sortedSearchInput);
    expect(shared?.values?.validate([3, 1])).toContain('ordenado');
    expect(shared?.values?.label).toBe('Array ordenado');
    // El valor por defecto del primero no está ordenado: se toma el del segundo.
    expect(shared?.values?.default).toEqual([1, 3, 9]);
  });

  it('los generadores dan entradas que valen para los dos', () => {
    const values = sharedFields(sortInput, smallSortInput)?.values;
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const generate of Object.values(values?.generators ?? {})) {
      const generated = generate(
        random,
        Array.from({ length: 100 }, () => 50),
      );
      expect(values?.validate(generated)).toBeNull();
    }
  });
});

describe('intersectFields', () => {
  it('un campo consigo mismo es el mismo campo', () => {
    const field = sortInput.fields.values;
    expect(intersectFields(field as never, field as never)).toBe(field);
  });

  it('rangos que no se tocan no tienen nada en común', () => {
    const low = intInRange({ label: 'n', min: 0, max: 5, default: 1 });
    const high = intInRange({ label: 'n', min: 10, max: 20, default: 10 });
    expect(intersectFields(low as never, high as never)).toBeNull();
  });

  it('tipos distintos no se pueden cruzar', () => {
    expect(intersectFields(sortInput.fields.values as never, searchInput.fields.target as never)).toBeNull();
  });
});
