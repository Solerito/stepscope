import { callStack, callTree, defineAlgorithm, form, intInRange } from '@/core';

//#region shown
function fib(n: number, memo = new Map<number, number>()): number { // @enter
  if (memo.has(n)) return memo.get(n)!; // @hit
  if (n <= 1) return n; // @base
  const a = fib(n - 1, memo); // @left
  const b = fib(n - 2, memo); // @right
  const result = a + b;
  memo.set(n, result); // @store
  return result; // @return
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Fibonacci con memoización',
    category: 'recursion',
    summary: 'Guarda cada resultado la primera vez: las ramas repetidas se cortan en cuanto aparecen.',
    complexity: {
      time: { best: 'O(n)', average: 'O(n)', worst: 'O(n)' },
      space: 'O(n)',
    },
  },

  input: form({ n: intInRange({ label: 'n', min: 0, max: 40, default: 6 }) }),

  views: [callTree(), callStack()],

  anchors: ['enter', 'hit', 'base', 'left', 'right', 'store', 'return'],

  reference: ({ n }) => fib(n),

  expected: { metric: 'calls', formula: '2n − 1', at: ({ n }) => Math.max(1, 2 * n - 1) },

  examples: [{ name: 'fib(6)', input: { n: 6 } }],

  trace({ n }, t) {
    const memo = new Map<number, number>();

    const go = t.recursive({ name: 'fib', params: ['n'], enter: 'enter' }, (n: number): number => {
      const known = memo.get(n);
      if (known !== undefined) {
        return t.memoHit('hit', known, `fib(${n}) ya está calculado: ${known}. No hace falta bajar`);
      }
      if (t.compare(n <= 1)) return t.ret('base', n, `Caso base: fib(${n}) = ${n}`);

      t.step('left', `Bajo a por fib(${n - 1})`);
      const a = go(n - 1);
      t.vars({ a });

      t.step('right', `fib(${n - 1}) = ${a}. Bajo a por fib(${n - 2})`);
      const b = go(n - 2);
      t.vars({ b });

      const result = a + b;
      memo.set(n, result);
      t.step('store', `Apunto fib(${n}) = ${a} + ${b} = ${result}`);
      return t.ret('return', result, `fib(${n}) devuelve ${result}`);
    });

    return go(n);
  },
});
