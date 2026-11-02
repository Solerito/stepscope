import { describe, expect, it } from 'vitest';
import { formatAlgorithmHash, formatCompareHash, parseHash } from './hash';

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

describe('comparación', () => {
  it('reconoce la pareja, una sola o ninguna', () => {
    expect(parseHash('#/compare/quick-sort/merge-sort?values=3,1&op=4')).toEqual({
      page: 'compare',
      ids: ['quick-sort', 'merge-sort'],
      params: { values: '3,1', op: '4' },
    });
    expect(parseHash('#/compare/quick-sort')).toEqual({ page: 'compare', ids: ['quick-sort'], params: {} });
    expect(parseHash('#/compare')).toEqual({ page: 'compare', ids: [], params: {} });
  });

  it('hace ida y vuelta con las variantes de cada lado', () => {
    const params = { values: '5,2,4', 'a.pivot': 'last', 'b.pivot': 'median3', fp: 'abc,def' };
    const hash = formatCompareHash(['quick-sort', 'quick-sort'], params);
    expect(hash).toBe('#/compare/quick-sort/quick-sort?values=5,2,4&a.pivot=last&b.pivot=median3&fp=abc,def');
    expect(parseHash(hash)).toEqual({ page: 'compare', ids: ['quick-sort', 'quick-sort'], params });
  });
});
