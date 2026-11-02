import { describe, expect, it } from 'vitest';
import { formatAlgorithmHash, parseHash } from './hash';

describe('parseHash', () => {
  it('reconoce el catálogo con cualquier forma de hash vacío', () => {
    for (const hash of ['', '#', '#/']) expect(parseHash(hash)).toEqual({ page: 'catalog' });
  });

  it('reconoce el banco de pruebas', () => {
    expect(parseHash('#/bench')).toEqual({ page: 'bench' });
  });

  it('extrae algoritmo y parámetros', () => {
    expect(parseHash('#/insertion-sort?values=5,2,4&f=12')).toEqual({
      page: 'algorithm',
      id: 'insertion-sort',
      params: { values: '5,2,4', f: '12' },
    });
  });

  it('ignora un parámetro mal codificado sin romperse', () => {
    expect(parseHash('#/x?a=%E0%A4%A&b=1')).toEqual({ page: 'algorithm', id: 'x', params: { b: '1' } });
  });
});

describe('formatAlgorithmHash', () => {
  it('deja las comas legibles', () => {
    expect(formatAlgorithmHash('a', { values: '5,-2,4', f: '3' })).toBe('#/a?values=5,-2,4&f=3');
  });

  it('hace ida y vuelta con caracteres especiales', () => {
    const params = { text: 'hola & adiós = ñ', f: '1' };
    expect(parseHash(formatAlgorithmHash('a', params))).toEqual({ page: 'algorithm', id: 'a', params });
  });

  it('omite la interrogación sin parámetros', () => {
    expect(formatAlgorithmHash('a', {})).toBe('#/a');
  });
});
