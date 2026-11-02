export interface TreeNodeInput {
  readonly id: number;
  readonly parent: number | null;
}

export interface TreeLayout {
  /** Posición en unidades: `x` en anchos de hoja y `depth` en niveles. */
  readonly positions: ReadonlyMap<number, { readonly x: number; readonly depth: number }>;
  readonly width: number;
  readonly maxDepth: number;
}

/**
 * Cada hoja ocupa una columna y cada padre se centra sobre sus hijos. Se calcula sobre el árbol final:
 * como la traza es completa, los nodos ya dibujados nunca se mueven al expandirse el árbol.
 */
export function layoutTree(nodes: readonly TreeNodeInput[]): TreeLayout {
  const children = new Map<number | null, number[]>();
  for (const node of nodes) {
    const siblings = children.get(node.parent);
    if (siblings) siblings.push(node.id);
    else children.set(node.parent, [node.id]);
  }

  const positions = new Map<number, { x: number; depth: number }>();
  let nextLeaf = 0;
  let maxDepth = 0;

  const place = (id: number, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = children.get(id);
    let x: number;
    if (kids && kids.length > 0) {
      const placed = kids.map((kid) => place(kid, depth + 1));
      x = ((placed[0] as number) + (placed.at(-1) as number)) / 2;
    } else {
      x = nextLeaf++;
    }
    positions.set(id, { x, depth });
    return x;
  };

  for (const root of children.get(null) ?? []) place(root, 0);

  return { positions, width: Math.max(1, nextLeaf), maxDepth };
}
