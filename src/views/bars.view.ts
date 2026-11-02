import type { ArrayState, Frame, TraceState, ViewSpec } from '@/core';
import type { Scene, SceneNode, ViewDefinition, Viewport } from '../scene/types';
import { arrayOf, marksByItem, POINTER_ROW, pointersOf, pointerTexts } from './shared';

const MARGIN_X = 12;
/** Sitio para el valor y el glifo encima de la barra más alta. */
const MARGIN_TOP = 44;
const MIN_WIDTH_FOR_LABEL = 16;

interface Scale {
  readonly positive: number;
  readonly negative: number;
}

function largestMagnitude(arrays: readonly (ArrayState | null | undefined)[]): Scale {
  let positive = 1;
  let negative = 0;
  for (const state of arrays) {
    for (const cell of state?.cells ?? []) {
      if (typeof cell?.value !== 'number') continue;
      positive = Math.max(positive, cell.value);
      negative = Math.max(negative, -cell.value);
    }
  }
  return { positive, negative };
}

/** Todos los arrays pintados como barras comparten escala: así `a` y `aux` se pueden comparar a ojo. */
function barArrays(views: readonly ViewSpec[], state: Readonly<TraceState>) {
  return views
    .filter((view) => view.view === 'bars' && 'structure' in view)
    .map((view) => arrayOf({ state } as Frame, view));
}

export const barsView: ViewDefinition = {
  kinds: ['bars'],

  // La escala se fija con la traza entera: si cambiara con cada frame, las barras parecerían crecer solas.
  prepare(header, finalState) {
    return largestMagnitude(barArrays(header.views, finalState));
  },

  build(frame: Frame, spec: ViewSpec, { width, height }: Viewport, prepared: unknown): Scene {
    const state = arrayOf(frame, spec);
    if (!state || width <= 0 || height <= 0) return { nodes: [] };

    const current = largestMagnitude([state]);
    const fixed = prepared as Scale | undefined;
    const positive = Math.max(current.positive, fixed?.positive ?? 0);
    const negative = Math.max(current.negative, fixed?.negative ?? 0);

    const pointers = pointersOf(spec);
    const marginBottom = pointers.length === 0 ? 10 : 8 + POINTER_ROW * pointers.length + 6;
    const usableHeight = Math.max(1, height - MARGIN_TOP - marginBottom);
    const unit = usableHeight / (positive + negative);
    const baseline = MARGIN_TOP + positive * unit;

    const step = (width - MARGIN_X * 2) / Math.max(1, state.cells.length);
    const barWidth = Math.max(1, step * 0.82);
    const labelSize = Math.max(10, Math.min(15, step * 0.34));
    const marks = marksByItem(frame);

    const nodes: SceneNode[] = [];
    state.cells.forEach((cell, index) => {
      // Un hueco, o una casilla aún sin escribir: no hay barra. Al llenarse, la barra aparece.
      if (!cell || cell.value === null) return;
      const value = typeof cell.value === 'number' ? cell.value : 0;
      const barHeight = Math.max(2, Math.abs(value) * unit);
      const mark = marks.get(cell.id);
      const role = mark?.role ?? cell.role;
      // En barras estrechas, el texto de cada una se solapa: solo se mantiene en lo que está pasando ahora.
      const showValue = barWidth >= MIN_WIDTH_FOR_LABEL || mark !== undefined;
      // El valor primero y la anotación aparte: «día 2 1» parecería un solo número.
      const label = mark?.label ? `${cell.value} (${mark.label})` : String(cell.value);

      nodes.push({
        kind: 'box',
        id: `c${cell.id}`,
        shape: 'rect',
        x: MARGIN_X + index * step + (step - barWidth) / 2,
        y: value >= 0 ? baseline - barHeight : baseline,
        w: barWidth,
        h: barHeight,
        labelAt: 'top',
        labelSize,
        showGlyph: showValue,
        ...(showValue ? { label } : {}),
        ...(role ? { role } : {}),
      });
    });

    nodes.push(
      ...pointerTexts(
        frame,
        pointers,
        state.cells.length,
        (index) => MARGIN_X + (index + 0.5) * step,
        height - marginBottom,
      ),
    );
    return { nodes };
  },

  estimate(header) {
    const input = header.input as { values?: readonly unknown[] };
    return input.values?.length ?? 0;
  },

  describe(frame, spec) {
    const state = arrayOf(frame, spec);
    if (!state) return '';
    const values = state.cells
      .map((cell) => (cell && cell.value !== null ? String(cell.value) : 'vacío'))
      .join(', ');
    return `Array con ${state.cells.length} elementos: ${values}.`;
  },
};
