import type { ArrayState, Frame, ItemId, Role, SequenceViewSpec, ViewSpec } from '@/core';
import type { SceneText } from '../scene/types';

export const POINTER_ROW = 15;

export function arrayOf(frame: Frame, spec: ViewSpec): ArrayState | null {
  if (!('structure' in spec)) return null;
  const structure = frame.state.structures[spec.structure];
  return structure?.kind === 'array' ? structure : null;
}

export function marksByItem(frame: Frame): Map<ItemId, { role: Role; label?: string }> {
  const marks = new Map<ItemId, { role: Role; label?: string }>();
  for (const mark of frame.marks) {
    if ('item' in mark) marks.set(mark.item, mark);
  }
  return marks;
}

export function pointersOf(spec: ViewSpec): readonly string[] {
  return (spec as SequenceViewSpec).pointers ?? [];
}

/**
 * Flechas bajo el array para las variables que son índices. Si dos apuntan al mismo sitio se apilan,
 * cada una en su fila: con `lo` y `mid` iguales, ninguna tapa a la otra.
 */
export function pointerTexts(
  frame: Frame,
  pointers: readonly string[],
  length: number,
  xOf: (index: number) => number,
  top: number,
): SceneText[] {
  const vars = frame.state.stack.at(-1)?.vars ?? {};
  const used = new Map<number, number>();
  const texts: SceneText[] = [];

  for (const pointer of pointers) {
    const position = vars[pointer];
    if (typeof position !== 'number' || position < 0 || position >= length) continue;
    const row = used.get(position) ?? 0;
    used.set(position, row + 1);
    texts.push({
      kind: 'text',
      id: `ptr-${pointer}`,
      x: xOf(position),
      y: top + POINTER_ROW * (row + 1),
      text: `▲ ${pointer}`,
      size: 13,
      role: 'active',
    });
  }
  return texts;
}
