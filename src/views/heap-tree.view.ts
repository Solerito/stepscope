import type { SequenceViewSpec } from '@/core';
import type { SceneNode, ViewDefinition } from '../scene/types';
import { arrayOf, marksByItem } from './shared';

const MARGIN = 16;
const MAX_NODE = 46;

/** Tamaño del montículo: lo que hay después ya está ordenado y queda fuera del árbol. */
function heapSizeOf(vars: Readonly<Record<string, unknown>>, spec: SequenceViewSpec, length: number): number {
  const size = spec.heapSize ? vars[spec.heapSize] : undefined;
  return typeof size === 'number' ? Math.max(0, Math.min(length, size)) : length;
}

/**
 * El array dibujado como árbol binario completo: el índice i tiene sus hijos en 2i+1 y 2i+2. La posición
 * de cada casilla es fija; lo que se mueve son los valores, así que un intercambio se ve como dos nodos
 * que se cruzan.
 */
export const heapTreeView: ViewDefinition = {
  kinds: ['heap-tree'],

  build(frame, spec, { width, height }) {
    const state = arrayOf(frame, spec);
    const count = state?.cells.length ?? 0;
    if (!state || count === 0 || width <= 0 || height <= 0) return { nodes: [] };

    const levels = Math.floor(Math.log2(count)) + 1;
    const rowHeight = (height - MARGIN * 2) / levels;
    const leafSlot = (width - MARGIN * 2) / 2 ** (levels - 1);
    const nodeSize = Math.max(6, Math.min(MAX_NODE, leafSlot * 0.85, rowHeight * 0.6));
    const labelSize = Math.max(10, Math.min(14, nodeSize * 0.42));
    const vars = frame.state.stack.at(-1)?.vars ?? {};
    const size = heapSizeOf(vars, spec as SequenceViewSpec, count);
    const marks = marksByItem(frame);

    const nodes: SceneNode[] = [];
    state.cells.forEach((cell, index) => {
      if (!cell) return;
      const level = Math.floor(Math.log2(index + 1));
      const slots = 2 ** level;
      const position = index - (slots - 1);
      const slotWidth = (width - MARGIN * 2) / slots;
      const mark = marks.get(cell.id);
      const role = mark?.role ?? cell.role;

      nodes.push({
        kind: 'box',
        id: `n${cell.id}`,
        shape: 'circle',
        x: MARGIN + (position + 0.5) * slotWidth - nodeSize / 2,
        y: MARGIN + level * rowHeight + (rowHeight - nodeSize) / 2,
        w: nodeSize,
        h: nodeSize,
        labelSize,
        showGlyph: nodeSize >= 26,
        ...(nodeSize >= 16 ? { label: String(cell.value) } : {}),
        ...(role ? { role } : {}),
      });

      // Solo se une lo que sigue dentro del montículo.
      const parent = state.cells[Math.floor((index - 1) / 2)];
      if (index > 0 && index < size && parent) {
        nodes.push({ kind: 'link', id: `edge-${index}`, from: `n${parent.id}`, to: `n${cell.id}` });
      }
    });
    return { nodes };
  },

  estimate(header) {
    const input = header.input as { values?: readonly unknown[] };
    return (input.values?.length ?? 0) * 2;
  },

  describe(frame, spec) {
    const state = arrayOf(frame, spec);
    if (!state || state.cells.length === 0) return '';
    const vars = frame.state.stack.at(-1)?.vars ?? {};
    const size = heapSizeOf(vars, spec as SequenceViewSpec, state.cells.length);
    const root = state.cells[0]?.value;
    return `Montículo de ${size} elementos con ${root} en la raíz; ${state.cells.length - size} ya colocados al final.`;
  },
};
