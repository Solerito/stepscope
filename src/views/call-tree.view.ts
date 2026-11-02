import type { CallNode, CallStatus, Role } from '@/core';
import type { SceneNode, ViewDefinition } from '../scene/types';
import { layoutTree, type TreeLayout } from './layout/tree-layout';

const ROLE_OF_STATUS: Record<CallStatus, Role> = {
  active: 'active',
  waiting: 'waiting',
  done: 'done',
  'memo-hit': 'memo-hit',
  pruned: 'pruned',
};

const MARGIN = 14;
const MAX_NODE_WIDTH = 92;
const MAX_NODE_HEIGHT = 34;
/** Con filas más bajas, el glifo de un nodo pisaría el texto de la fila de arriba. */
const MIN_ROW_FOR_GLYPHS = 60;
const TOKEN_HEIGHT = 18;

const argsOf = (call: CallNode) => Object.values(call.args).join(', ');

function labelFor(call: CallNode, nodeWidth: number): string | undefined {
  const full = `${call.fn}(${argsOf(call)})`;
  if (nodeWidth >= full.length * 7.2) return full;
  if (nodeWidth >= argsOf(call).length * 7.2 + 4) return argsOf(call);
  return undefined;
}

/** Una función `void` devuelve null: no hay valor que enseñar. */
function badgeFor(call: CallNode, compact: boolean): string | undefined {
  if (call.ret === undefined || call.ret === null) return undefined;
  if (!call.saved) return `= ${call.ret}`;
  return compact ? `= ${call.ret}  −${call.saved}` : `= ${call.ret}  −${call.saved} llamadas`;
}

export const callTreeView: ViewDefinition = {
  kinds: ['call-tree'],

  prepare(_header, finalState) {
    return layoutTree(finalState.calls);
  },

  build(frame, _spec, { width, height }, prepared) {
    const layout = prepared as TreeLayout | undefined;
    if (!layout || width <= 0 || height <= 0) return { nodes: [] };

    const columnWidth = (width - MARGIN * 2) / layout.width;
    const rowHeight = (height - MARGIN * 2) / (layout.maxDepth + 1);
    const nodeWidth = Math.max(4, Math.min(MAX_NODE_WIDTH, columnWidth * 0.92));
    // Nunca más alto que su fila: en árboles muy hondos, los nodos se tocarían.
    const nodeHeight = Math.min(rowHeight * 0.8, Math.max(6, Math.min(MAX_NODE_HEIGHT, rowHeight * 0.52)));
    const labelSize = Math.max(10, Math.min(13, nodeHeight * 0.5));
    const compact = rowHeight < MIN_ROW_FOR_GLYPHS;

    const nodes: SceneNode[] = [];
    const boxOf = new Map<number, { x: number; y: number }>();

    for (const call of frame.state.calls) {
      const position = layout.positions.get(call.id);
      if (!position) continue;

      const label = labelFor(call, nodeWidth);
      const badge = rowHeight >= 30 ? badgeFor(call, compact) : undefined;
      const x = MARGIN + (position.x + 0.5) * columnWidth - nodeWidth / 2;
      const y = MARGIN + position.depth * rowHeight;
      boxOf.set(call.id, { x, y });

      nodes.push({
        kind: 'box',
        id: `call-${call.id}`,
        shape: 'circle',
        x,
        y,
        w: nodeWidth,
        h: nodeHeight,
        labelSize,
        role: ROLE_OF_STATUS[call.status],
        // Si ya se ve «= 2», el glifo de «terminada» solo estorba. Sin glifo, cada estado se sigue
        // distinguiendo sin color por su borde: grueso, discontinuo o doble.
        showGlyph: !compact && !(call.status === 'done' && badge),
        ...(label ? { label } : {}),
        ...(badge ? { badge } : {}),
      });

      if (call.parent !== null) {
        nodes.push({
          kind: 'link',
          id: `edge-${call.id}`,
          from: `call-${call.parent}`,
          to: `call-${call.id}`,
        });
      }
    }

    // El valor que sube: en el frame de retorno aparece en el hijo y viaja hasta el padre.
    const returning =
      frame.phase === 'return' || frame.phase === 'memo-hit' ? frame.state.stack.at(-1) : undefined;
    const call = returning ? frame.state.calls[returning.id] : undefined;
    const parent = call?.parent === null || call?.parent === undefined ? undefined : boxOf.get(call.parent);
    if (call && parent && call.ret !== undefined && call.ret !== null && rowHeight >= 24) {
      const text = String(call.ret);
      const tokenWidth = Math.max(24, text.length * 8 + 12);
      nodes.push({
        kind: 'box',
        id: `returned-${call.id}`,
        shape: 'rect',
        x: parent.x + nodeWidth / 2 - tokenWidth / 2,
        y: parent.y + nodeHeight + 3,
        w: tokenWidth,
        h: TOKEN_HEIGHT,
        label: text,
        labelSize: 12,
        role: 'returned',
        showGlyph: false,
        enterFrom: `call-${call.id}`,
      });
    }
    return { nodes };
  },

  estimate(_header, finalState) {
    return finalState.calls.length * 2;
  },

  describe(frame) {
    const { calls } = frame.state;
    const active = calls.find((call) => call.status === 'active');
    const done = calls.filter((call) => call.status === 'done').length;
    const hits = calls.filter((call) => call.status === 'memo-hit').length;
    const focus = active ? ` Activa: ${active.fn}(${argsOf(active)}).` : '';
    return `Árbol de llamadas con ${calls.length} llamadas, ${done} terminadas y ${hits} ya calculadas.${focus}`;
  },
};
