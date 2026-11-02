import { describe, expect, it } from 'vitest';
import { ROLES } from '@/core';
import { ease, interpolate } from './interpolate';
import { ROLE_STYLES } from './roles';
import type { Scene, SceneBox } from './types';

const box = (id: string, x: number, extra: Partial<SceneBox> = {}): SceneBox => ({
  kind: 'box',
  id,
  shape: 'rect',
  x,
  y: 0,
  w: 10,
  h: 10,
  ...extra,
});

describe('interpolate', () => {
  const a: Scene = { nodes: [box('x', 0), box('gone', 5)] };
  const b: Scene = { nodes: [box('x', 100), box('new', 50)] };

  it('en los extremos devuelve exactamente cada escena', () => {
    expect(interpolate(a, b, 0)).toBe(a);
    expect(interpolate(a, b, 1)).toBe(b);
  });

  it('mueve por identidad, no por posición en la lista', () => {
    const swapped: Scene = { nodes: [box('gone', 5), box('x', 100)] };
    const middle = interpolate(a, swapped, 0.5).nodes.find((node) => node.id === 'x') as SceneBox;
    expect(middle.x).toBe(50);
  });

  it('es simétrica: ir hacia atrás recorre las mismas posiciones', () => {
    const forward = interpolate(a, b, 0.25).nodes.find((node) => node.id === 'x') as SceneBox;
    const backward = interpolate(b, a, 0.75).nodes.find((node) => node.id === 'x') as SceneBox;
    expect(forward.x).toBeCloseTo(backward.x);
  });

  it('hace aparecer y desaparecer lo que solo está en una escena', () => {
    const middle = interpolate(a, b, 0.5).nodes;
    expect(middle.find((node) => node.id === 'new')?.opacity).toBe(0.5);
    expect(middle.find((node) => node.id === 'gone')?.opacity).toBe(0.5);
  });

  it('una caja con enterFrom sale de la posición de su origen', () => {
    const from: Scene = { nodes: [box('child', 200)] };
    const to: Scene = { nodes: [box('child', 200), box('value', 0, { enterFrom: 'child' })] };
    const middle = interpolate(from, to, 0.5).nodes.find((node) => node.id === 'value') as SceneBox;
    expect(middle.x).toBe(100);
  });

  it('el cambio de rol ocurre al empezar la transición', () => {
    const to: Scene = { nodes: [box('x', 100, { role: 'compare' })] };
    const middle = interpolate({ nodes: [box('x', 0)] }, to, 0.01).nodes[0] as SceneBox;
    expect(middle.role).toBe('compare');
  });
});

describe('ease', () => {
  it('va de 0 a 1 sin salirse ni retroceder', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let previous = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      expect(ease(t)).toBeGreaterThanOrEqual(previous);
      previous = ease(t);
    }
  });
});

describe('ROLE_STYLES', () => {
  it('no hay dos roles con el mismo glifo: el color nunca es la única señal', () => {
    const glyphs = ROLES.map((role) => ROLE_STYLES[role].glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('todos tienen una etiqueta para la leyenda', () => {
    for (const role of ROLES) expect(ROLE_STYLES[role].label).not.toBe('');
  });
});
