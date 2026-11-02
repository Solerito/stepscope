import type { CallFrame } from '@/core';
import type { SceneNode, ViewDefinition } from '../scene/types';
import { layoutTree, type TreeLayout } from './layout/tree-layout';

const MARGIN = 8;
const MAX_ROW_HEIGHT = 34;
/** Por debajo de esta altura, el texto de un marco ya no se lee. */
const MIN_ROW_HEIGHT = 16;
const ROW_GAP = 3;

function labelOf(call: CallFrame): string {
  const signature = `${call.fn}(${Object.values(call.args).join(', ')})`;
  const vars = Object.entries(call.vars)
    .map(([name, value]) => `${name}=${value}`)
    .join('  ');
  return vars ? `${signature}   ${vars}` : signature;
}

export const callStackView: ViewDefinition = {
  kinds: ['call-stack'],

  prepare(_header, finalState) {
    return layoutTree(finalState.calls);
  },

  build(frame, _spec, { width, height }, prepared) {
    if (width <= 0 || height <= 0) return { nodes: [] };

    // El marco 0 es el ámbito global: no es una llamada.
    const calls = frame.state.stack.slice(1);
    const deepest = ((prepared as TreeLayout | undefined)?.maxDepth ?? calls.length) + 1;
    const capacity = Math.max(2, Math.floor((height - MARGIN * 2) / MIN_ROW_HEIGHT));

    // Si la recursión más honda cabe, cada marco tiene su sitio fijo y apilar no mueve a los demás.
    // Si no cabe, se ven los de arriba, que son los que importan, y una línea dice cuántos quedan debajo.
    const fits = deepest <= capacity;
    const rowHeight = fits
      ? Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, (height - MARGIN * 2) / deepest))
      : MIN_ROW_HEIGHT;
    const hidden = fits ? 0 : Math.max(0, calls.length - (capacity - 1));
    const visible = calls.slice(hidden);
    const firstSlot = hidden > 0 ? 1 : 0;
    const labelSize = Math.max(10, Math.min(13, rowHeight * 0.45));

    const nodes: SceneNode[] = visible.map((call, index) => {
      const isTop = index === visible.length - 1;
      return {
        kind: 'box',
        id: `frame-${call.id}`,
        shape: 'rect',
        x: MARGIN,
        y: height - MARGIN - (firstSlot + index + 1) * rowHeight,
        w: width - MARGIN * 2,
        h: rowHeight - ROW_GAP,
        labelSize,
        role: isTop ? 'active' : 'waiting',
        // Estar arriba del todo ya dice cuál es el activo.
        showGlyph: false,
        label: labelOf(call),
      };
    });

    if (hidden > 0) {
      nodes.push({
        kind: 'text',
        id: 'hidden-frames',
        x: width / 2,
        y: height - MARGIN - 3,
        text: `y ${hidden} ${hidden === 1 ? 'marco más' : 'marcos más'} debajo`,
        size: 12,
      });
    }

    if (calls.length === 0) {
      nodes.push({ kind: 'text', id: 'empty', x: width / 2, y: height / 2, text: 'Pila vacía', size: 13 });
    }
    return { nodes };
  },

  estimate(_header, finalState) {
    return finalState.calls.length;
  },

  describe(frame) {
    const calls = frame.state.stack.slice(1);
    if (calls.length === 0) return 'Pila de llamadas vacía.';
    const list = [...calls].reverse().map(labelOf).join('; ');
    return `Pila de llamadas con ${calls.length} marcos, del más reciente al más antiguo: ${list}.`;
  },
};
