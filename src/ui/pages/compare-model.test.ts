import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type InputField, sharedFields } from '@/core';
import { findAlgorithm, type RegisteredAlgorithm } from '../../algorithms/registry';
import { parseHash } from '../../routing/hash';
import {
  canCompare,
  compareInputFromParams,
  compareLinkFor,
  compareParams,
  defaultPartner,
  partnersOf,
  resolvePair,
} from './compare-model';
import { FEATURED_CASES, FEATURED_COMPARISONS } from './featured';

const algorithm = (id: string): RegisteredAlgorithm => {
  const found = findAlgorithm(id);
  if (!found) throw new Error(`no existe ${id}`);
  return found;
};

const quick = algorithm('quick-sort');
const merge = algorithm('merge-sort');
const insertion = algorithm('insertion-sort');
const counting = algorithm('counting-sort');
const linear = algorithm('linear-search');
const binary = algorithm('binary-search');
const fib = algorithm('fibonacci-memo');
const fibNoMemo = algorithm('fibonacci');
// Su entrada son `weights` y `days`, que no tiene ningún otro algoritmo: es el único sin pareja.
const answer = algorithm('binary-search-answer');

describe('canCompare', () => {
  it('compara toda la ordenación entre sí, también con rangos distintos', () => {
    expect(canCompare(quick, merge)).toBe(true);
    expect(canCompare(counting, insertion)).toBe(true);
  });

  it('compara las dos búsquedas por valor', () => {
    expect(canCompare(linear, binary)).toBe(true);
  });

  it('no compara entradas distintas', () => {
    expect(canCompare(quick, linear)).toBe(false);
    expect(canCompare(fib, quick)).toBe(false);
  });

  it('un algoritmo consigo mismo, solo si tiene variantes', () => {
    expect(canCompare(quick, quick)).toBe(true);
    expect(canCompare(merge, merge)).toBe(false);
  });
});

describe('resolvePair', () => {
  it('completa B con el primer compañero del catálogo', () => {
    const resolved = resolvePair(['linear-search']);
    expect(resolved).toEqual({ kind: 'pair', pair: [linear, binary] });
  });

  it('cambia un B incompatible por uno que sí lo es', () => {
    const resolved = resolvePair(['quick-sort', 'linear-search']);
    expect(resolved.kind).toBe('pair');
    if (resolved.kind === 'pair') expect(canCompare(...resolved.pair)).toBe(true);
  });

  it('avisa de un algoritmo que no existe', () => {
    expect(resolvePair(['quick-sort', 'no-existe'])).toEqual({ kind: 'unknown', id: 'no-existe' });
  });

  it('sin compañeros se queda solo, sin inventarse una comparación', () => {
    expect(resolvePair(['binary-search-answer'])).toEqual({ kind: 'alone', algorithm: answer });
    expect(defaultPartner(answer)).toBeNull();
    expect(partnersOf(answer)).toEqual([]);
  });

  it('empareja los dos Fibonacci: el mismo campo `n`, con el rango del más estrecho', () => {
    expect(canCompare(fib, fibNoMemo)).toBe(true);
    expect(defaultPartner(fib)).toBe(fibNoMemo);
    const shared = sharedFields(fib.input, fibNoMemo.input) as Record<string, InputField<number>>;
    expect(shared.n?.validate(12)).toBeNull();
    expect(shared.n?.validate(13)).not.toBeNull();
  });

  it('sin nada en el enlace, elige una pareja que se pueda comparar', () => {
    const resolved = resolvePair([]);
    expect(resolved.kind).toBe('pair');
  });
});

describe('entrada de la comparación', () => {
  it('los datos son comunes y cada lado lleva sus variantes', () => {
    const shared = sharedFields(quick.input, merge.input) ?? {};
    const input = compareInputFromParams([quick, merge], shared, {
      values: '3,1,2',
      'a.pivot': 'first',
      'b.pivot': 'median3',
    });
    expect(input).toEqual({ shared: { values: [3, 1, 2] }, a: { pivot: 'first', seed: 1 }, b: {} });
  });

  it('lo que no se entiende vuelve a su valor por defecto', () => {
    const shared = sharedFields(linear.input, binary.input) ?? {};
    const input = compareInputFromParams([linear, binary], shared, { values: '5,1,3', target: 'x' });
    // Sin ordenar no vale para la binaria, así que se queda la entrada por defecto común.
    expect(input.shared.values).toEqual(shared.values?.default);
    expect(input.shared.target).toBe(shared.target?.default);
  });

  it('con el mismo algoritmo, B empieza con la variante siguiente', () => {
    const shared = sharedFields(quick.input, quick.input) ?? {};
    const input = compareInputFromParams([quick, quick], shared, { 'a.pivot': 'last' });
    expect(input.a.pivot).toBe('last');
    expect(input.b.pivot).not.toBe('last');
  });

  it('hace ida y vuelta por la URL', () => {
    const shared = sharedFields(quick.input, quick.input) ?? {};
    const params = { values: '4,2,9', 'a.pivot': 'random', 'a.seed': '7', 'b.pivot': 'first', 'b.seed': '3' };
    const input = compareInputFromParams([quick, quick], shared, params);
    expect(compareParams([quick, quick], shared, input)).toEqual(params);
  });

  it('el enlace desde un algoritmo lleva sus datos y sus variantes como las de A', () => {
    const route = parseHash(compareLinkFor(quick, { values: [3, 1, 2], pivot: 'median3', seed: 4 }));
    expect(route).toEqual({
      page: 'compare',
      ids: ['quick-sort'],
      params: { values: '3,1,2', 'a.pivot': 'median3', 'a.seed': '4' },
    });
  });
});

describe('casos preparados', () => {
  it.each(FEATURED_COMPARISONS)('$title: existe, se puede comparar y su entrada vale', ({ href }) => {
    const route = parseHash(href);
    if (route.page !== 'compare') throw new Error(`${href} no es una comparación`);
    const resolved = resolvePair(route.ids);
    if (resolved.kind !== 'pair') throw new Error(`${href} no da una pareja`);
    expect(resolved.pair.map((entry) => entry.id)).toEqual(route.ids);

    const shared = sharedFields(resolved.pair[0].input, resolved.pair[1].input) ?? {};
    const input = compareInputFromParams(resolved.pair, shared, route.params);
    // Si algún valor no valiera, se habría sustituido por el de por defecto y el enlace mentiría.
    expect(compareParams(resolved.pair, shared, input)).toMatchObject(route.params);
  });

  it.each(FEATURED_CASES)('$title: existe y su entrada vale', ({ href }) => {
    const route = parseHash(href);
    if (route.page !== 'algorithm') throw new Error(`${href} no es un algoritmo`);
    const fields = algorithm(route.id).input.fields as Record<string, InputField<unknown>>;
    for (const [name, text] of Object.entries(route.params)) {
      const field = fields[name];
      expect(field?.validate(field.parse(text)), name).toBeNull();
    }
  });
});

describe('el README', () => {
  const readme = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8');

  it.each([...FEATURED_COMPARISONS, ...FEATURED_CASES])(
    'enlaza «$title» con la misma entrada',
    ({ href }) => {
      expect(readme).toContain(`https://stepscope.vercel.app/${href})`);
    },
  );
});
