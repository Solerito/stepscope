import { beforeEach, describe, expect, it } from 'vitest';
import { runTrace } from '@/core';
import insertionSort from '../algorithms/sorting/insertion-sort.algo';
import type { Renderer, Scene, SceneBox } from '../scene/types';
import { FakeClock } from '../test/fake-clock';
import { defaultSpeed, PlayerEngine } from './engine';

const spec = insertionSort.views[0];
const trace = runTrace(insertionSort, { values: [5, 2, 4, 6, 1, 3] });
const frames = trace.header.frameCount;

describe('PlayerEngine', () => {
  let clock: FakeClock;
  let engine: PlayerEngine;
  let painted: Scene[];
  let reducedMotion: boolean;

  const renderer: Renderer = {
    paint: (scene) => painted.push(scene),
    resize: () => {},
    destroy: () => {},
  };

  beforeEach(() => {
    clock = new FakeClock();
    painted = [];
    reducedMotion = false;
    engine = new PlayerEngine(trace, { clock, prefersReducedMotion: () => reducedMotion });
    if (!spec) throw new Error('sin vista');
    engine.mount(spec, renderer).resize({ width: 600, height: 400 });
    painted = [];
  });

  const state = () => engine.store.getState();

  it('empieza en el primer frame con sus datos publicados', () => {
    expect(state().index).toBe(0);
    expect(state().frameCount).toBe(frames);
    expect(state().explain).toContain('toca colocar a[1]');
    expect(state().anchor).toBe('outer');
  });

  it('un paso anima con varios pintados y termina en el frame pedido', () => {
    engine.step(1);
    expect(state().index).toBe(1);
    clock.run(400);
    expect(painted.length).toBeGreaterThan(5);
    expect(clock.callback).toBeNull();
  });

  it('con reducción de movimiento, un paso pinta una sola vez y no arranca el reloj', () => {
    reducedMotion = true;
    engine.step(1);
    expect(painted).toHaveLength(1);
    expect(clock.callback).toBeNull();
  });

  it('no se sale de la traza por ninguno de los dos extremos', () => {
    engine.step(-1);
    expect(state().index).toBe(0);
    engine.seek(frames + 10);
    expect(state().index).toBe(frames - 1);
    engine.step(1);
    expect(state().index).toBe(frames - 1);
  });

  it('saltar no anima', () => {
    engine.seek(10);
    expect(state().index).toBe(10);
    expect(painted).toHaveLength(1);
    expect(clock.callback).toBeNull();
  });

  it('retroceder reconstruye exactamente lo mismo que al pasar la primera vez', () => {
    engine.seek(20);
    const before = JSON.stringify(state().vars);
    const explain = state().explain;
    engine.seek(5);
    engine.seek(20);
    expect(JSON.stringify(state().vars)).toBe(before);
    expect(state().explain).toBe(explain);
  });

  it('reproduce hasta el final y se detiene solo', () => {
    engine.setSpeed(10);
    engine.play();
    expect(state().playing).toBe(true);
    clock.run((frames + 2) * 100);
    expect(state().index).toBe(frames - 1);
    expect(state().playing).toBe(false);
    expect(clock.callback).toBeNull();
  });

  it('reproducir estando al final vuelve a empezar', () => {
    engine.seek(frames - 1);
    engine.play();
    expect(state().index).toBe(0);
    expect(state().playing).toBe(true);
  });

  it('a mucha velocidad pinta una vez por tick, saltando frames sin transición', () => {
    engine.setSpeed(600);
    engine.play();
    clock.tick(16);
    expect(painted).toHaveLength(1);
    clock.tick(16);
    expect(painted).toHaveLength(2);
  });

  it('durante la reproducción, los paneles se refrescan a menos frecuencia que el pintado', () => {
    engine.setSpeed(60);
    engine.play();
    const seen = new Set<number>();
    const unsubscribe = engine.store.subscribe((current) => seen.add(current.index));
    for (let tick = 0; tick < 12; tick++) clock.tick(16);
    unsubscribe();
    expect(painted.length).toBeGreaterThan(seen.size);
    expect(seen.size).toBeGreaterThan(0);
  });

  it('salta entre hitos', () => {
    engine.jumpToMilestone(1);
    const first = state().index;
    expect(trace.level[first]).toBe(0);
    expect(first).toBeGreaterThan(0);
    engine.jumpToMilestone(-1);
    expect(state().index).toBe(0);
  });

  it('señala las variables que han cambiado', () => {
    engine.step(1);
    expect(state().changedVars).toEqual(['key']);
  });

  it('tiene descripción para el lector de pantalla al estar en pausa', () => {
    engine.seek(3);
    expect(state().descriptions['bars:a']).toContain('Array con 6 elementos');
  });

  it('interrumpir una transición con otro paso no deja la escena a medias', () => {
    engine.step(1);
    clock.tick(16);
    engine.step(1);
    clock.run(400);
    const final = painted.at(-1) as Scene;
    expect(state().index).toBe(2);
    const boxes = final.nodes.filter((node): node is SceneBox => node.kind === 'box');
    expect(boxes.every((box) => box.opacity === undefined)).toBe(true);
  });
});

describe('defaultSpeed', () => {
  it('recorre la traza en unos 20 segundos sin pasar de los límites', () => {
    expect(defaultSpeed(37)).toBe(2);
    expect(defaultSpeed(10)).toBe(1);
    expect(defaultSpeed(1_000)).toBe(60);
    expect(defaultSpeed(10_000)).toBe(120);
    expect(defaultSpeed(1_000_000)).toBe(120);
  });
});

describe('granularidad', () => {
  const detailed = runTrace(insertionSort, { values: [5, 2, 4, 6, 1, 3] });
  const levels = Array.from(detailed.level);

  const engineAt = (granularity: 0 | 1 | 2) => {
    const engine = new PlayerEngine(detailed, { clock: new FakeClock(), prefersReducedMotion: () => true });
    engine.setGranularity(granularity);
    return engine;
  };

  it('con «solo pasos» nunca se para en una comparación', () => {
    const engine = engineAt(1);
    for (let i = 0; i < 40; i++) {
      engine.step(1);
      expect(levels[engine.store.getState().index]).toBeLessThanOrEqual(1);
    }
    expect(engine.store.getState().index).toBe(detailed.header.frameCount - 1);
  });

  it('con «solo hitos» recorre exactamente los frames de nivel 0', () => {
    const engine = engineAt(0);
    const visited = [0];
    for (let i = 0; i < 20; i++) {
      engine.step(1);
      visited.push(engine.store.getState().index);
    }
    const milestones = levels.flatMap((level, index) => (level === 0 ? [index] : []));
    expect([...new Set(visited)]).toEqual(milestones);
  });

  it('retroceder respeta la granularidad igual que avanzar', () => {
    const engine = engineAt(1);
    engine.seek(detailed.header.frameCount - 1);
    engine.step(-1);
    expect(levels[engine.store.getState().index]).toBeLessThanOrEqual(1);
  });

  it('se publica para que la interfaz la muestre', () => {
    expect(engineAt(0).store.getState().granularity).toBe(0);
  });
});
