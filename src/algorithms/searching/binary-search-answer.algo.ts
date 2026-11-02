import { bars, defineAlgorithm, form, intArray, intInRange } from '@/core';

//#region shown
function shipWithinDays(weights: number[], days: number): number {
  let lo = Math.max(...weights); // @bounds
  let hi = weights.reduce((sum, w) => sum + w, 0);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2); // @mid
    if (fits(weights, days, mid)) hi = mid; // @fits
    else lo = mid + 1; // @tooSmall
  }
  return lo; // @answer
}

function fits(weights: number[], days: number, capacity: number): boolean {
  let used = 1; // @start
  let load = 0;
  for (const w of weights) { // @package
    if (load + w > capacity) {
      used++; // @newDay
      load = 0;
    }
    load += w; // @load
  }
  return used <= days; // @verdict
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Búsqueda binaria sobre la respuesta',
    category: 'searching',
    summary:
      'Capacidad mínima de un barco para enviar unos paquetes en D días: no busca en un array, busca en el rango de respuestas posibles.',
    complexity: {
      time: { best: 'O(n log S)', average: 'O(n log S)', worst: 'O(n log S), con S la suma de pesos' },
      space: 'O(1)',
    },
  },

  input: form({
    weights: intArray({ label: 'Pesos de los paquetes', minLength: 1, maxLength: 30, min: 1, max: 50, default: [3, 2, 2, 4, 1, 4] }),
    days: intInRange({ label: 'Días', min: 1, max: 30, default: 3 }),
  }),

  views: [bars('w', { title: 'Paquetes', pointers: ['i'] })],

  anchors: ['bounds', 'mid', 'fits', 'tooSmall', 'answer', 'start', 'package', 'newDay', 'load', 'verdict'],

  reference: ({ weights, days }) => shipWithinDays([...weights], days),

  check: ({ weights, days }, capacity) => {
    if (!fits([...weights], days, capacity)) return 'con esa capacidad no caben';
    const minimal = capacity === Math.max(...weights) || !fits([...weights], days, capacity - 1);
    return minimal ? null : 'cabe con menos: no es la mínima';
  },

  expected: {
    metric: 'comparisons',
    formula: 'n·log₂(suma de pesos)',
    at: ({ weights }) => weights.length * Math.log2(Math.max(2, weights.reduce((sum, w) => sum + w, 0))),
  },

  examples: [
    { name: 'Seis paquetes en tres días', input: { weights: [3, 2, 2, 4, 1, 4], days: 3 } },
    { name: 'Un solo día: todo junto', input: { weights: [5, 1, 3], days: 1 } },
    { name: 'Un día por paquete', input: { weights: [7, 2, 5, 9], days: 4 } },
  ],

  trace({ weights, days }, t) {
    const w = t.array('w', weights);

    let lo = w.get(0);
    let hi = lo;
    for (let i = 1; i < w.length; i++) {
      const weight = w.get(i);
      if (t.compare(weight > lo)) lo = weight;
      hi += weight;
    }
    t.step('bounds', `La respuesta está entre ${lo}, el paquete más pesado, y ${hi}, todo en un día`, {
      vars: { days, lo, hi },
      level: 0,
    });

    const fits = (capacity: number): boolean => {
      let used = 1;
      let load = 0;
      t.step('start', `¿Caben en ${days} ${days === 1 ? 'día' : 'días'} con un barco de ${capacity}?`, {
        vars: { capacity, used, load },
      });

      for (let i = 0; i < w.length; i++) {
        const weight = w.get(i);
        t.step('package', `Paquete ${i}: pesa ${weight}`, { vars: { i }, marks: [w.mark(i, 'active', `día ${used}`)], level: 2 });
        if (t.compare(load + weight > capacity)) {
          used++;
          load = 0;
          t.step('newDay', `No cabe en el día ${used - 1}: empiezo el día ${used}`, {
            vars: { used, load },
            marks: [w.mark(i, 'conflict', `día ${used}`)],
          });
        }
        load += weight;
        t.step('load', `El día ${used} lleva ${load} de ${capacity}`, { vars: { load }, marks: [w.mark(i, 'write', `día ${used}`)], level: 2 });
      }

      const ok = t.compare(used <= days);
      t.step('verdict', ok ? `Hacen falta ${used} ${used === 1 ? 'día' : 'días'}: cabe` : `Hacen falta ${used} días: no cabe en ${days}`, {
        vars: { i: undefined },
      });
      t.vars({ capacity: undefined, used: undefined, load: undefined });
      return ok;
    };

    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      t.step('mid', `Pruebo con la capacidad intermedia: ${mid}`, { vars: { mid }, level: 0 });
      if (fits(mid)) {
        hi = mid;
        t.step('fits', `Cabe con ${mid}: la respuesta es ${mid} o menos`, { vars: { hi } });
      } else {
        lo = mid + 1;
        t.step('tooSmall', `No cabe con ${mid}: hace falta más de ${mid}`, { vars: { lo } });
      }
    }

    t.step('answer', `El rango se ha cerrado en ${lo}: es la capacidad mínima`, { vars: { mid: undefined }, level: 0 });
    return lo;
  },
});
