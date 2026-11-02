import { describe, expect, it } from 'vitest';
import { extractShown } from './extract';

const file = [
  'import x from "y";',
  '//#region shown',
  'function f() { // @enter',
  '  // Este comentario sí se muestra',
  '  return 1; // @a @b',
  '}',
  '//#endregion',
  'export default {};',
].join('\n');

describe('extractShown', () => {
  it('recorta la región y retira solo los comentarios de ancla', () => {
    expect(extractShown(file).code).toBe(
      'function f() {\n  // Este comentario sí se muestra\n  return 1;\n}',
    );
  });

  it('asigna a cada ancla su línea dentro del código mostrado, también con varias por línea', () => {
    expect(extractShown(file).lineOf).toEqual({ enter: 1, a: 3, b: 3 });
  });

  it('da lo mismo con finales de línea de Windows', () => {
    expect(extractShown(file.replaceAll('\n', '\r\n'))).toEqual(extractShown(file));
  });

  it('avisa si falta la región', () => {
    expect(() => extractShown('const x = 1;')).toThrow('Falta la región');
  });
});
