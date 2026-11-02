import type { Scene, SceneBox, SceneNode, SceneText } from './types';

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** Lenta al salir y al llegar: se percibe mejor qué elemento se ha movido y adónde. */
export function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function enteringBox(box: SceneBox, before: ReadonlyMap<string, SceneNode>, t: number): SceneBox {
  const origin = box.enterFrom ? before.get(box.enterFrom) : undefined;
  if (origin?.kind === 'box') {
    return {
      ...box,
      x: lerp(origin.x, box.x, t),
      y: lerp(origin.y, box.y, t),
      w: lerp(origin.w, box.w, t),
      h: lerp(origin.h, box.h, t),
    };
  }
  // Sin origen, crece desde su centro.
  return {
    ...box,
    x: box.x + (box.w * (1 - t)) / 2,
    y: box.y + (box.h * (1 - t)) / 2,
    w: box.w * t,
    h: box.h * t,
    opacity: t,
  };
}

function enteringText(text: SceneText, t: number): SceneText {
  return { ...text, opacity: t };
}

function blend(
  previous: SceneNode | undefined,
  node: SceneNode,
  t: number,
  before: ReadonlyMap<string, SceneNode>,
) {
  if (node.kind === 'box') {
    if (previous?.kind !== 'box') return enteringBox(node, before, t);
    return {
      ...node,
      x: lerp(previous.x, node.x, t),
      y: lerp(previous.y, node.y, t),
      w: lerp(previous.w, node.w, t),
      h: lerp(previous.h, node.h, t),
    };
  }
  if (node.kind === 'text') {
    if (previous?.kind !== 'text') return enteringText(node, t);
    return { ...node, x: lerp(previous.x, node.x, t), y: lerp(previous.y, node.y, t) };
  }
  // Un enlace no guarda coordenadas: sus extremos ya vienen interpolados. Solo aparece con fundido.
  return previous ? node : { ...node, opacity: t };
}

/**
 * La escena del instante `t` entre dos frames. Es función pura: no hay estado de animación que
 * cancelar, así que interrumpir, retroceder o saltar no son casos especiales.
 */
export function interpolate(from: Scene, to: Scene, t: number): Scene {
  if (t <= 0) return from;
  if (t >= 1) return to;

  const before = new Map(from.nodes.map((node) => [node.id, node]));
  const after = new Set(to.nodes.map((node) => node.id));

  const nodes: SceneNode[] = to.nodes.map((node) => blend(before.get(node.id), node, t, before));
  for (const node of from.nodes) {
    if (!after.has(node.id)) nodes.push({ ...node, opacity: (node.opacity ?? 1) * (1 - t) });
  }
  return { nodes };
}
