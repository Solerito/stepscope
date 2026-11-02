// Plantilla: cópiala en src/algorithms/<categoría>/<id>.algo.ts. El id de la URL sale del nombre del archivo.
import { bars, defineAlgorithm, form, intArray } from '@/core';

//#region shown
// Lo que ve el usuario, tal cual. Es código real: compila y los tests lo ejecutan.
// Una acción por línea. `// @ancla` marca las líneas a las que puede apuntar un frame;
// esos comentarios no se muestran. Los demás sí.
function firstValue(a: number[]): number { // @enter
  const first = a[0]; // @read
  return first; // @done
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Nombre visible',
    category: 'searching', // structures | sorting | searching | graphs | recursion | dp | strings
    summary: 'Una frase: qué hace y cuál es la idea clave.',
    complexity: {
      time: { best: 'O(1)', average: 'O(1)', worst: 'O(1)' },
      space: 'O(1)',
    },
  },

  // Cada campo sabe parsearse, validarse, generarse y volver a texto para la URL.
  input: form({
    values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [3, 1, 2] }),
  }),

  // Qué se pinta y cómo. Una misma estructura puede tener varias vistas.
  views: [bars('a')],

  // Deben coincidir con los comentarios de arriba. Una errata en un t.step no compila.
  anchors: ['enter', 'read', 'done'],

  // Ejecuta el código mostrado: es el oráculo de la implementación instrumentada.
  reference: ({ values }) => firstValue([...values]),

  // La implementación instrumentada. Hace lo mismo que el código mostrado y decide qué se ve.
  trace({ values }, t) {
    const a = t.array('a', values);
    t.step('enter', 'Qué acaba de pasar, en una frase');

    const first = a.get(0);
    t.step('read', `Leo el primer valor: ${first}`, { vars: { first }, marks: [a.mark(0, 'active')] });

    t.step('done', `Devuelvo ${first}`);
    return first;
  },

  // Opcionales:
  // check:      (input, result) => motivo del fallo o null. Propiedad que debe cumplir el resultado.
  // invariants: [{ name, holds: (state) => boolean }]. Se comprueban al cerrar cada capítulo.
  // expected:   { metric, formula, at: (input) => number }. Coste teórico para contrastar.
  // examples:   [{ name, input }]. Casos de la interfaz y de los tests de trazas.
});
