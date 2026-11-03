export interface ShownSource {
  /** Texto que ve el usuario, sin anclas. */
  readonly code: string;
  /** Ancla → línea (empezando en 1) dentro de `code`. */
  readonly lineOf: Readonly<Record<string, number>>;
}

const REGION = /\/\/#region shown\r?\n([\s\S]*?)\r?\n\/\/#endregion/;
const ANCHORS = /\s*\/\/((?:\s*@[\w-]+)+)\s*$/;

export function extractShown(fileText: string): ShownSource {
  const region = REGION.exec(fileText)?.[1];
  if (region === undefined) throw new Error('Falta la región //#region shown');

  // Sin prototipo: el nombre del ancla sale del texto del archivo y se lee luego con
  // `lineOf[ancla]`, así que un ancla llamada como un miembro de Object.prototype no debe
  // poder devolver nada heredado.
  const lineOf: Record<string, number> = Object.create(null);
  const code = region
    .split(/\r?\n/)
    .map((line, index) => {
      const match = ANCHORS.exec(line);
      if (!match) return line;
      for (const name of (match[1] ?? '').trim().split(/\s+/)) lineOf[name.slice(1)] = index + 1;
      return line.slice(0, match.index);
    })
    .join('\n');

  return { code, lineOf };
}
