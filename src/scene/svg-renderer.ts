import './scene.css';
import type { Role } from '@/core';
import { type Pattern, ROLE_STYLES, type Stain } from './roles';
import type { Renderer, Scene, SceneBox, SceneLink, SceneText, Viewport } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DARK_STAINS: readonly Stain[] = ['hematoxylin', 'eosin', 'ink'];
const STAINS: readonly Stain[] = ['neutral', 'hematoxylin', 'eosin', 'ink'];
const TILE_SIZE = 7;

let rendererCount = 0;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, className?: string): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  if (className) element.setAttribute('class', className);
  return element;
}

function buildTile(prefix: string, pattern: Exclude<Pattern, 'solid'>, stain: Stain): SVGPatternElement {
  const tile = svg('pattern', `ss-tile-${stain}`);
  tile.id = `${prefix}-${pattern}-${stain}`;
  tile.setAttribute('width', String(TILE_SIZE));
  tile.setAttribute('height', String(TILE_SIZE));
  tile.setAttribute('patternUnits', 'userSpaceOnUse');

  const background = svg('rect', 'ss-tile-bg');
  background.setAttribute('width', String(TILE_SIZE));
  background.setAttribute('height', String(TILE_SIZE));
  tile.append(background);

  if (pattern === 'dots') {
    const dot = svg('circle', 'ss-tile-dot');
    dot.setAttribute('cx', '3.5');
    dot.setAttribute('cy', '3.5');
    dot.setAttribute('r', '1.3');
    tile.append(dot);
  } else {
    const path = svg('path', 'ss-tile-line');
    const hatch = `M-1,${TILE_SIZE + 1} L${TILE_SIZE + 1},-1`;
    path.setAttribute(
      'd',
      pattern === 'cross' ? `${hatch} M-1,-1 L${TILE_SIZE + 1},${TILE_SIZE + 1}` : hatch,
    );
    tile.append(path);
  }
  return tile;
}

interface BoxElements {
  readonly group: SVGGElement;
  readonly shape: SVGRectElement | SVGEllipseElement;
  readonly isCircle: boolean;
  ring: SVGRectElement | SVGEllipseElement | null;
  label: SVGTextElement | null;
  glyph: SVGTextElement | null;
  badge: SVGTextElement | null;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  role: Role | undefined;
  labelText: string | undefined;
  badgeText: string | undefined;
  labelSize: number;
  labelAt: 'center' | 'top';
  showGlyph: boolean;
  seen: number;
}

interface LinkElements {
  readonly line: SVGLineElement;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
  role: Role | undefined;
  seen: number;
}

interface TextElements {
  readonly text: SVGTextElement;
  x: number;
  y: number;
  value: string;
  opacity: number;
  seen: number;
}

/**
 * Pinta una escena con DOM imperativo y claves por ID. Solo escribe lo que ha cambiado desde el último
 * paint: el coste sigue a lo que se mueve, no a lo que hay en pantalla.
 */
export function createSvgRenderer(host: HTMLElement): Renderer {
  const prefix = `ss${rendererCount++}`;
  const root = svg('svg', 'ss-svg');
  root.setAttribute('aria-hidden', 'true');

  const defs = svg('defs');
  for (const stain of STAINS) {
    defs.append(
      buildTile(prefix, 'hatch', stain),
      buildTile(prefix, 'dots', stain),
      buildTile(prefix, 'cross', stain),
    );
  }
  const linkLayer = svg('g');
  const boxLayer = svg('g');
  const textLayer = svg('g');
  root.append(defs, linkLayer, boxLayer, textLayer);
  host.append(root);

  const boxes = new Map<string, BoxElements>();
  const links = new Map<string, LinkElements>();
  const texts = new Map<string, TextElements>();
  let generation = 0;

  const applyRole = (elements: BoxElements) => {
    const { role, labelAt, showGlyph } = elements;
    const style = role ? ROLE_STYLES[role] : undefined;
    const stain = style?.stain ?? 'neutral';
    const pattern = style?.pattern ?? 'solid';
    const outline = style?.outline ?? 'thin';

    const onDark = pattern === 'solid' && DARK_STAINS.includes(stain) && labelAt === 'center';
    elements.group.setAttribute(
      'class',
      `ss-box ss-stain-${stain} ss-pattern-${pattern} ss-outline-${outline}${onDark ? ' ss-on-dark' : ''}`,
    );

    if (pattern === 'solid') elements.shape.removeAttribute('fill');
    else elements.shape.setAttribute('fill', `url(#${prefix}-${pattern}-${stain})`);

    if (outline === 'double' && !elements.ring) {
      elements.ring = svg(elements.isCircle ? 'ellipse' : 'rect', 'ss-ring');
      elements.group.insertBefore(elements.ring, elements.shape);
      setGeometry(elements.ring, elements.w + 7, elements.h + 7, -3.5, elements.isCircle);
    } else if (outline !== 'double' && elements.ring) {
      elements.ring.remove();
      elements.ring = null;
    }

    if (style && showGlyph) {
      if (!elements.glyph) {
        elements.glyph = svg('text', 'ss-glyph');
        elements.group.append(elements.glyph);
      }
      elements.glyph.textContent = style.glyph;
    } else if (elements.glyph) {
      elements.glyph.remove();
      elements.glyph = null;
    }
  };

  const setGeometry = (
    shape: SVGRectElement | SVGEllipseElement,
    w: number,
    h: number,
    offset: number,
    isCircle: boolean,
  ) => {
    if (isCircle) {
      shape.setAttribute('cx', String(offset + w / 2));
      shape.setAttribute('cy', String(offset + h / 2));
      shape.setAttribute('rx', String(Math.max(0, w / 2)));
      shape.setAttribute('ry', String(Math.max(0, h / 2)));
    } else {
      shape.setAttribute('x', String(offset));
      shape.setAttribute('y', String(offset));
      shape.setAttribute('width', String(Math.max(0, w)));
      shape.setAttribute('height', String(Math.max(0, h)));
      shape.setAttribute('rx', String(Math.min(2, w / 4)));
    }
  };

  // Etiqueta, glifo e insignia se colocan respecto a la caja, así que dependen de su tamaño.
  const layoutTexts = (elements: BoxElements) => {
    const { w, h, labelSize, labelAt, label, glyph, badge } = elements;
    if (label) {
      label.setAttribute('x', String(w / 2));
      label.setAttribute('y', String(labelAt === 'top' ? -5 : h / 2));
      label.setAttribute('dominant-baseline', labelAt === 'top' ? 'auto' : 'central');
      label.setAttribute('font-size', String(labelSize));
    }
    if (glyph) {
      const size = Math.max(11, Math.min(15, labelSize + 1));
      glyph.setAttribute('font-size', String(size));
      if (labelAt === 'top') {
        glyph.setAttribute('x', String(w / 2));
        glyph.setAttribute('y', String(label ? -9 - labelSize : -5));
      } else {
        glyph.setAttribute('x', String(w + 2));
        glyph.setAttribute('y', '1');
      }
    }
    if (badge) {
      badge.setAttribute('x', String(w / 2));
      badge.setAttribute('y', String(h + labelSize + 3));
      badge.setAttribute('font-size', String(labelSize));
    }
  };

  const paintBox = (box: SceneBox) => {
    let elements = boxes.get(box.id);
    if (!elements) {
      const isCircle = box.shape === 'circle';
      const group = svg('g');
      const shape = svg(isCircle ? 'ellipse' : 'rect', 'ss-shape');
      group.append(shape);
      boxLayer.append(group);
      elements = {
        group,
        shape,
        isCircle,
        ring: null,
        label: null,
        glyph: null,
        badge: null,
        x: Number.NaN,
        y: Number.NaN,
        w: Number.NaN,
        h: Number.NaN,
        opacity: 1,
        role: undefined,
        labelText: undefined,
        badgeText: undefined,
        labelSize: 12,
        labelAt: 'center',
        showGlyph: true,
        seen: generation,
      };
      boxes.set(box.id, elements);
      applyRole(elements);
    }
    elements.seen = generation;

    let textsDirty = false;

    if (box.x !== elements.x || box.y !== elements.y) {
      elements.group.setAttribute('transform', `translate(${box.x} ${box.y})`);
      elements.x = box.x;
      elements.y = box.y;
    }

    if (box.w !== elements.w || box.h !== elements.h) {
      elements.w = box.w;
      elements.h = box.h;
      setGeometry(elements.shape, box.w, box.h, 0, elements.isCircle);
      if (elements.ring) setGeometry(elements.ring, box.w + 7, box.h + 7, -3.5, elements.isCircle);
      textsDirty = true;
    }

    const labelAt = box.labelAt ?? 'center';
    const labelSize = box.labelSize ?? 12;
    const showGlyph = box.showGlyph ?? true;
    if (
      labelAt !== elements.labelAt ||
      labelSize !== elements.labelSize ||
      showGlyph !== elements.showGlyph ||
      box.role !== elements.role
    ) {
      elements.labelAt = labelAt;
      elements.labelSize = labelSize;
      elements.showGlyph = showGlyph;
      elements.role = box.role;
      applyRole(elements);
      textsDirty = true;
    }

    if (box.label !== elements.labelText) {
      elements.labelText = box.label;
      if (box.label === undefined) {
        elements.label?.remove();
        elements.label = null;
      } else {
        if (!elements.label) {
          elements.label = svg('text', 'ss-label');
          elements.group.append(elements.label);
        }
        elements.label.textContent = box.label;
      }
      textsDirty = true;
    }

    if (box.badge !== elements.badgeText) {
      elements.badgeText = box.badge;
      if (box.badge === undefined) {
        elements.badge?.remove();
        elements.badge = null;
      } else {
        if (!elements.badge) {
          elements.badge = svg('text', 'ss-badge');
          elements.group.append(elements.badge);
        }
        elements.badge.textContent = box.badge;
      }
      textsDirty = true;
    }

    if (textsDirty) layoutTexts(elements);

    const opacity = box.opacity ?? 1;
    if (opacity !== elements.opacity) {
      elements.group.setAttribute('opacity', String(opacity));
      elements.opacity = opacity;
    }
  };

  const paintLink = (link: SceneLink, boxesById: ReadonlyMap<string, SceneBox>) => {
    const from = boxesById.get(link.from);
    const to = boxesById.get(link.to);
    if (!from || !to) return;

    let elements = links.get(link.id);
    if (!elements) {
      const line = svg('line', 'ss-link');
      linkLayer.append(line);
      elements = {
        line,
        x1: Number.NaN,
        y1: Number.NaN,
        x2: Number.NaN,
        y2: Number.NaN,
        opacity: 1,
        role: undefined,
        seen: generation,
      };
      links.set(link.id, elements);
    }
    elements.seen = generation;

    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h / 2;
    const x2 = to.x + to.w / 2;
    const y2 = to.y + to.h / 2;
    if (x1 !== elements.x1 || y1 !== elements.y1 || x2 !== elements.x2 || y2 !== elements.y2) {
      elements.line.setAttribute('x1', String(x1));
      elements.line.setAttribute('y1', String(y1));
      elements.line.setAttribute('x2', String(x2));
      elements.line.setAttribute('y2', String(y2));
      elements.x1 = x1;
      elements.y1 = y1;
      elements.x2 = x2;
      elements.y2 = y2;
    }
    if (link.role !== elements.role) {
      elements.line.setAttribute('class', `ss-link${link.role ? ` ss-role-${link.role}` : ''}`);
      elements.role = link.role;
    }
    const opacity = link.opacity ?? 1;
    if (opacity !== elements.opacity) {
      elements.line.setAttribute('opacity', String(opacity));
      elements.opacity = opacity;
    }
  };

  const paintText = (node: SceneText) => {
    let elements = texts.get(node.id);
    if (!elements) {
      const text = svg('text', `ss-text${node.role ? ` ss-role-${node.role}` : ''}`);
      text.setAttribute('font-size', String(node.size ?? 12));
      textLayer.append(text);
      elements = { text, x: Number.NaN, y: Number.NaN, value: '', opacity: 1, seen: generation };
      texts.set(node.id, elements);
    }
    elements.seen = generation;

    if (node.x !== elements.x || node.y !== elements.y) {
      elements.text.setAttribute('x', String(node.x));
      elements.text.setAttribute('y', String(node.y));
      elements.x = node.x;
      elements.y = node.y;
    }
    if (node.text !== elements.value) {
      elements.text.textContent = node.text;
      elements.value = node.text;
    }
    const opacity = node.opacity ?? 1;
    if (opacity !== elements.opacity) {
      elements.text.setAttribute('opacity', String(opacity));
      elements.opacity = opacity;
    }
  };

  const sweep = <T extends { seen: number }>(map: Map<string, T>, remove: (item: T) => void) => {
    for (const [id, item] of map) {
      if (item.seen !== generation) {
        remove(item);
        map.delete(id);
      }
    }
  };

  return {
    paint(scene: Scene) {
      generation++;

      const boxesById = new Map<string, SceneBox>();
      for (const node of scene.nodes) {
        if (node.kind === 'box') {
          boxesById.set(node.id, node);
          paintBox(node);
        } else if (node.kind === 'text') {
          paintText(node);
        }
      }
      for (const node of scene.nodes) {
        if (node.kind === 'link') paintLink(node, boxesById);
      }

      sweep(boxes, (item) => item.group.remove());
      sweep(links, (item) => item.line.remove());
      sweep(texts, (item) => item.text.remove());
    },

    resize({ width, height }: Viewport) {
      root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    },

    destroy() {
      root.remove();
    },
  };
}
