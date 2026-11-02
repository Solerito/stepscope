import { stripTypeScriptTypes } from 'node:module';
import { parse } from 'acorn';
import type { Plugin } from 'vite';

interface AstNode {
  type: string;
  start: number;
  end: number;
  loc: { start: { line: number }; end: { line: number } };
  [key: string]: unknown;
}

const isNode = (value: unknown): value is AstNode =>
  typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string';

const SIMPLE_STATEMENTS = new Set([
  'VariableDeclaration',
  'ExpressionStatement',
  'ReturnStatement',
  'BreakStatement',
  'ContinueStatement',
  'ThrowStatement',
]);

const REGION = /\/\/#region shown\r?\n([\s\S]*?)\r?\n\/\/#endregion/;

/** Devuelve el código de la región con `__hit(línea)` delante de todo lo que se ejecuta. */
function instrumentRegion(body: string): string {
  const inserts: { at: number; text: string }[] = [];
  const add = (at: number, text: string) => inserts.push({ at, text });
  const lineOf = (node: AstNode) => node.loc.start.line;

  const wrapExpression = (expression: AstNode, line: number) => {
    add(expression.start, `(__hit(${line}),`);
    add(expression.end, ')');
  };

  // Un cuerpo sin llaves no admite una sentencia más: se envuelve para poder insertar.
  const ensureBlock = (statement: AstNode) => {
    if (statement.type === 'BlockStatement') {
      walk(statement);
      return;
    }
    add(statement.start, '{');
    walk(statement);
    add(statement.end, '}');
  };

  const walkChildren = (node: AstNode, skip: readonly string[] = []) => {
    for (const key of Object.keys(node)) {
      if (key === 'loc' || skip.includes(key)) continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) if (isNode(item)) walk(item);
      } else if (isNode(value)) {
        walk(value);
      }
    }
  };

  function walk(node: AstNode): void {
    const line = lineOf(node);

    if (SIMPLE_STATEMENTS.has(node.type)) {
      add(node.start, `__hit(${line});`);
      walkChildren(node);
      return;
    }

    switch (node.type) {
      case 'IfStatement': {
        wrapExpression(node.test as AstNode, line);
        walk(node.test as AstNode);
        ensureBlock(node.consequent as AstNode);
        if (node.alternate) ensureBlock(node.alternate as AstNode);
        return;
      }
      case 'WhileStatement': {
        wrapExpression(node.test as AstNode, line);
        walk(node.test as AstNode);
        ensureBlock(node.body as AstNode);
        return;
      }
      case 'DoWhileStatement': {
        ensureBlock(node.body as AstNode);
        wrapExpression(node.test as AstNode, line);
        walk(node.test as AstNode);
        return;
      }
      case 'ForStatement': {
        // La inicialización no se instrumenta: dentro de `for (...)` no cabe una sentencia.
        if (node.init) walkChildren(node.init as AstNode);
        if (node.test) wrapExpression(node.test as AstNode, line);
        if (node.update) wrapExpression(node.update as AstNode, line);
        ensureBlock(node.body as AstNode);
        return;
      }
      case 'ForOfStatement':
      case 'ForInStatement': {
        const body = node.body as AstNode;
        if (body.type === 'BlockStatement') add(body.start + 1, `__hit(${line});`);
        ensureBlock(body);
        return;
      }
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': {
        const body = node.body as AstNode;
        if (body.type !== 'BlockStatement') {
          walk(body);
          return;
        }
        add(body.start + 1, `__hit(${line});`);
        walk(body);
        // Llegar a la llave de cierre también es una línea: así un `void` sin return puede anclar su
        // retorno en `} // @return`. Si la función sale antes por un return, esta marca no se ejecuta.
        add(body.end - 1, `__hit(${body.loc.end.line});`);
        return;
      }
      default:
        walkChildren(node);
    }
  }

  const ast = parse(body, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  walk(ast as unknown as AstNode);

  // Para una misma posición, el orden de inserción es el orden en el texto final.
  let output = body;
  inserts
    .map((insert, order) => ({ ...insert, order }))
    .sort((a, b) => b.at - a.at || b.order - a.order)
    .forEach(({ at, text }) => {
      output = output.slice(0, at) + text + output.slice(at);
    });
  return output;
}

/**
 * Solo en tests: hace que el código mostrado informe de cada línea que ejecuta, para comprobar que la
 * traza no apunta a líneas en un orden imposible. En producción este plugin no existe.
 */
export function fidelityPlugin(): Plugin {
  return {
    name: 'stepscope:fidelity',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.algo.ts')) return null;

      const stripped = stripTypeScriptTypes(code, { mode: 'strip' });
      const match = REGION.exec(stripped);
      if (!match || match[1] === undefined) return null;

      const body = match[1];
      const start = match.index + match[0].indexOf(body);
      const hit = 'const __hit = (line) => globalThis.__stepscopeHit?.(line);\n';
      return {
        code: `${stripped.slice(0, start)}${hit}${instrumentRegion(body)}${stripped.slice(start + body.length)}`,
        map: null,
      };
    },
  };
}
