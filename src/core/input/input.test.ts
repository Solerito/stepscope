import { describe, expect, it } from 'vitest';
import { seededRandom } from '../trace/random';
import { choice, form, InputError, intArray, intInRange } from '.';

const values = intArray({ minLength: 2, maxLength: 5, min: -9, max: 9, default: [1, 2] });

describe('intArray', () => {
  it('entiende comas, espacios y punto y coma', () => {
    expect(values.parse('1, 2 3;4')).toEqual([1, 2, 3, 4]);
  });

  it('señala el valor que no es un entero', () => {
    expect(() => values.parse('1, x, 3')).toThrow(InputError);
    expect(() => values.parse('1, x, 3')).toThrow('«x»');
    expect(() => values.parse('1.5')).toThrow('«1.5»');
  });

  it('valida longitud y rango con un mensaje accionable', () => {
    expect(values.validate([1])).toContain('entre 2 y 5');
    expect(values.validate([1, 50])).toContain('50');
    expect(values.validate([1, 2])).toBeNull();
  });

  it('vuelve a texto sin perder nada', () => {
    expect(values.parse(values.format([3, -1, 2]))).toEqual([3, -1, 2]);
  });

  it('sus generadores respetan los límites del campo', () => {
    const random = seededRandom(7);
    for (const generate of Object.values(values.generators ?? {})) {
      for (const current of [[1, 2], [1, 2, 3, 4, 5], values.maximal()]) {
        expect(values.validate(generate(random, current))).toBeNull();
      }
    }
  });

  it('cada generador produce lo que dice', () => {
    const random = () => 0.5;
    const current = [5, 1, 4, 2];
    const generators = values.generators ?? {};
    const sorted = generators.Ordenado?.(random, current) ?? [];
    const reversed = generators.Inverso?.(random, current) ?? [];
    expect([...sorted].sort((a, b) => a - b)).toEqual(sorted);
    expect([...reversed].sort((a, b) => b - a)).toEqual(reversed);
  });
});

describe('intInRange', () => {
  const n = intInRange({ label: 'n', min: 0, max: 10, default: 3 });

  it('rechaza lo que no es un entero', () => {
    expect(() => n.parse('')).toThrow(InputError);
    expect(() => n.parse('tres')).toThrow(InputError);
  });

  it('valida el rango', () => {
    expect(n.validate(11)).toContain('de 0 a 10');
    expect(n.validate(10)).toBeNull();
  });
});

describe('form', () => {
  it('reúne los valores por defecto de sus campos', () => {
    const spec = form({ n: intInRange({ label: 'n', min: 0, max: 10, default: 3 }), values });
    expect(spec.default).toEqual({ n: 3, values: [1, 2] });
  });
});

describe('intArray ordenado', () => {
  const sortedValues = intArray({
    minLength: 1,
    maxLength: 10,
    min: -9,
    max: 9,
    sorted: true,
    default: [1, 2],
  });

  it('rechaza un array desordenado con un mensaje claro', () => {
    expect(sortedValues.validate([3, 1])).toContain('ordenado');
    expect(sortedValues.validate([1, 1, 3])).toBeNull();
  });

  it('todos sus generadores dan arrays ordenados', () => {
    const random = seededRandom(3);
    for (const generate of Object.values(sortedValues.generators ?? {})) {
      expect(sortedValues.validate(generate(random, [1, 2, 3, 4, 5]))).toBeNull();
    }
    expect(sortedValues.validate(sortedValues.maximal())).toBeNull();
  });
});

describe('choice', () => {
  const rule = choice({
    label: 'Pivote',
    options: { last: 'El último', first: 'El primero' },
    default: 'last',
  });

  it('acepta solo sus opciones', () => {
    expect(rule.parse('first')).toBe('first');
    expect(() => rule.parse('middle')).toThrow(InputError);
    expect(rule.validate('first')).toBeNull();
  });

  it('vuelve a texto sin perder nada', () => {
    expect(rule.parse(rule.format('first'))).toBe('first');
  });
});
