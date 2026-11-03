import { callStack, callTree, defineAlgorithm, form, intInRange } from '@/core';

//#region shown
function fib(n: number): number { // @enter
  if (n <= 1) return n; // @base
  const a = fib(n - 1); // @left
  const b = fib(n - 2); // @right
  return a + b; // @return
}
//#endregion

/**
 * F(n) de forma iterativa. Lo usan el `check` y el coste teórico a propósito: así ninguno de los dos
 * depende de ejecutar el código mostrado, que es justo lo que tienen que vigilar.
 */
function fibOf(n: number): number {
  let previous = 0;
  let current = 1;
  for (let i = 1; i <= n; i++) {
    const next = previous + current;
    previous = current;
    current = next;
  }
  return previous;
}

/** Llamadas que hace `fib(n)` sin memoizar: 2·F(n+1) − 1. */
function callsFor(n: number): number {
  return 2 * fibOf(n + 1) - 1;
}

export default defineAlgorithm({
  meta: {
    name: 'Fibonacci sin memoización',
    category: 'recursion',
    summary: 'Cada llamada vuelve a calcular lo que ya calculó otra rama: el árbol se duplica a cada nivel.',
    complexity: {
      time: { best: 'O(1)', average: 'O(φⁿ)', worst: 'O(φⁿ)' },
      space: 'O(n)',
    },
  },

  // Tope 12: el árbol final son 465 nodos, unas 930 primitivas, justo por debajo de las 1 000 que
  // aguanta el pintor SVG. El valor por defecto es el mismo que el de fibonacci-memo para que la
  // comparación entre los dos se abra en el caso que ya cuentan el plan y el README: 25 frente a 11.
  input: form({ n: intInRange({ label: 'n', min: 0, max: 12, default: 6 }) }),

  views: [callTree(), callStack()],

  anchors: ['enter', 'base', 'left', 'right', 'return'],

  reference: ({ n }) => fib(n),

  check: ({ n }, result) => (result === fibOf(n) ? null : `fib(${n}) debería ser ${fibOf(n)}`),

  expected: { metric: 'calls', formula: '2·F(n+1) − 1', at: ({ n }) => callsFor(n) },

  // Los ejemplos los barre entero el test universal de vistas, frame a frame y en dos viewports, así que
  // se quedan pequeños a propósito. El tope n=12 (1 394 frames, 930 primitivas) ya lo cubre el test de
  // límites por `maximal()`, y en la interfaz se escribe a mano.
  examples: [
    { name: 'fib(6)', input: { n: 6 } },
    { name: 'fib(10)', input: { n: 10 } },
  ],

  trace({ n }, t) {
    const go = t.recursive({ name: 'fib', params: ['n'], enter: 'enter' }, (n: number): number => {
      if (t.compare(n <= 1)) return t.ret('base', n, `Caso base: fib(${n}) = ${n}`);

      t.step('left', `Bajo a por fib(${n - 1})`);
      const a = go(n - 1);
      t.vars({ a });

      t.step('right', `fib(${n - 1}) = ${a}. Bajo a por fib(${n - 2}), otra vez desde cero`);
      const b = go(n - 2);
      t.vars({ b });

      const result = a + b;
      return t.ret('return', result, `fib(${n}) devuelve ${a} + ${b} = ${result}`);
    });

    return go(n);
  },
});
