import type { SceneNode, ViewDefinition } from '../scene/types';
import { arrayOf, marksByItem, POINTER_ROW, pointersOf, pointerTexts } from './shared';

const MARGIN = 12;
const MAX_CELL = 52;
const INDEX_ROW = 16;

export const cellsView: ViewDefinition = {
  kinds: ['cells'],

  build(frame, spec, { width, height }) {
    const state = arrayOf(frame, spec);
    if (!state || state.cells.length === 0 || width <= 0 || height <= 0) return { nodes: [] };

    const count = state.cells.length;
    const pointers = pointersOf(spec);
    const below = INDEX_ROW + POINTER_ROW * pointers.length + 6;
    const cellWidth = Math.min(MAX_CELL, (width - MARGIN * 2) / count);
    const cellHeight = Math.max(8, Math.min(MAX_CELL, cellWidth * 1.1, height - MARGIN * 2 - below));
    const left = (width - cellWidth * count) / 2;
    const top = Math.max(MARGIN, (height - cellHeight - below) / 2);
    const labelSize = Math.max(10, Math.min(15, cellWidth * 0.36));
    const marks = marksByItem(frame);
    const showIndex = cellWidth >= 14;

    const nodes: SceneNode[] = [];
    state.cells.forEach((cell, index) => {
      const x = left + index * cellWidth;
      if (showIndex) {
        nodes.push({
          kind: 'text',
          id: `index-${index}`,
          x: x + cellWidth / 2,
          y: top + cellHeight + INDEX_ROW - 2,
          text: String(index),
          size: 11,
        });
      }
      if (!cell) return;

      const mark = marks.get(cell.id);
      const role = mark?.role ?? cell.role;
      const empty = cell.value === null;
      nodes.push({
        kind: 'box',
        id: `c${cell.id}`,
        shape: 'rect',
        x: x + 1,
        y: top,
        w: Math.max(2, cellWidth - 2),
        h: cellHeight,
        labelSize,
        showGlyph: cellWidth >= 24,
        ...(empty || cellWidth < 12 ? {} : { label: String(cell.value) }),
        ...(role ? { role } : {}),
      });
    });

    nodes.push(
      ...pointerTexts(
        frame,
        pointers,
        count,
        (index) => left + (index + 0.5) * cellWidth,
        top + cellHeight + INDEX_ROW,
      ),
    );
    return { nodes };
  },

  estimate(_header, finalState) {
    let largest = 0;
    for (const structure of Object.values(finalState.structures)) {
      if (structure.kind === 'array') largest = Math.max(largest, structure.cells.length * 2);
    }
    return largest;
  },

  describe(frame, spec) {
    const state = arrayOf(frame, spec);
    if (!state) return '';
    const values = state.cells.map((cell, index) => `${index}: ${cell?.value ?? 'vacío'}`).join(', ');
    return `Casillas: ${values}.`;
  },
};
