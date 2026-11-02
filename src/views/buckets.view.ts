import type { BucketsState, Frame, ViewSpec } from '@/core';
import type { SceneNode, ViewDefinition } from '../scene/types';
import { marksByItem } from './shared';

const MARGIN = 12;
const LABEL_ROW = 22;
const MAX_ITEM_HEIGHT = 30;
/** Hasta esta altura de pila, las casillas no se encogen: así no cambian de tamaño a cada momento. */
const COMFORTABLE_STACK = 8;

function bucketsOf(frame: Frame, spec: ViewSpec): BucketsState | null {
  if (!('structure' in spec)) return null;
  const structure = frame.state.structures[spec.structure];
  return structure?.kind === 'buckets' ? structure : null;
}

/** Cada cubo es una columna; sus elementos se apilan de abajo arriba y salen por abajo, como una cola. */
export const bucketsView: ViewDefinition = {
  kinds: ['buckets'],

  build(frame, spec, { width, height }) {
    const state = bucketsOf(frame, spec);
    if (!state || state.buckets.length === 0 || width <= 0 || height <= 0) return { nodes: [] };

    const columns = state.buckets.length;
    const columnWidth = (width - MARGIN * 2) / columns;
    const itemWidth = Math.min(64, columnWidth * 0.82);
    const tallest = Math.max(COMFORTABLE_STACK, ...state.buckets.map((bucket) => bucket.length));
    const itemHeight = Math.max(6, Math.min(MAX_ITEM_HEIGHT, (height - MARGIN * 2 - LABEL_ROW) / tallest));
    const bottom = height - MARGIN - LABEL_ROW;
    const labelSize = Math.max(10, Math.min(14, itemHeight * 0.5, itemWidth * 0.3));
    const marks = marksByItem(frame);

    const nodes: SceneNode[] = [];
    state.buckets.forEach((bucket, column) => {
      const center = MARGIN + (column + 0.5) * columnWidth;
      nodes.push({
        kind: 'text',
        id: `label-${column}`,
        x: center,
        y: height - MARGIN - 4,
        text: state.labels?.[column] ?? String(column),
        size: 13,
      });

      bucket.forEach((cell, depth) => {
        const mark = marks.get(cell.id);
        const role = mark?.role ?? cell.role;
        nodes.push({
          kind: 'box',
          id: `b${cell.id}`,
          shape: 'rect',
          x: center - itemWidth / 2,
          y: bottom - (depth + 1) * itemHeight + 1,
          w: itemWidth,
          h: itemHeight - 2,
          labelSize,
          showGlyph: false,
          ...(itemHeight >= 12 ? { label: String(cell.value) } : {}),
          ...(role ? { role } : {}),
        });
      });
    });
    return { nodes };
  },

  estimate(header) {
    const input = header.input as { values?: readonly unknown[] };
    return (input.values?.length ?? 0) + 10;
  },

  describe(frame, spec) {
    const state = bucketsOf(frame, spec);
    if (!state) return '';
    const content = state.buckets
      .map(
        (bucket, index) =>
          `${state.labels?.[index] ?? index}: ${bucket.map((cell) => cell.value).join(' ') || 'vacío'}`,
      )
      .join('; ');
    return `Cubetas. ${content}.`;
  },
};
