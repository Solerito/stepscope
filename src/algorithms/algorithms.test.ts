import { readdirSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { COUNTER_NAMES, exportTrace, type InputField, runTrace, seededRandom, TraceCursor } from '@/core';
import { arbitraryFor } from '../test/arbitraries';
import {
  forbidNondeterminism,
  isSubsequence,
  linesOfTrace,
  recordHits,
  replayExport,
  seekMatchesSequential,
  summarize,
} from '../test/harness';
import { algorithms } from './registry';

/** La batería universal: cada archivo de algoritmo la pasa sin escribir un solo test propio. */
describe.each(algorithms)('$id', (algorithm) => {
  const examples = algorithm.examples ?? [{ name: 'por defecto', input: algorithm.input.default }];
  const inputs = examples.map((example) => example.input);

  const traceOf = (input: unknown) =>
    forbidNondeterminism(() => runTrace(algorithm, input, { algorithmId: algorithm.id }));

  it('declara sus metadatos y una entrada por defecto válida', () => {
    expect(algorithm.meta.name).not.toBe('');
    expect(algorithm.meta.summary).not.toBe('');
    expect(algorithm.views.length).toBeGreaterThan(0);
    for (const [name, field] of Object.entries(algorithm.input.fields)) {
      const typed = field as InputField<unknown>;
      expect(typed.validate(algorithm.input.default[name])).toBeNull();
      expect(typed.parse(typed.format(typed.default))).toEqual(typed.default);
    }
  });

  it('sus anclas coinciden con los comentarios del código mostrado', async () => {
    const source = await algorithm.loadSource();
    expect([...algorithm.anchors].sort()).toEqual(Object.keys(source.lineOf).sort());
  });

  it('alcanza todas sus anclas en algún ejemplo', () => {
    const reached = new Set<number>();
    for (const input of inputs) for (const anchor of traceOf(input).anchor) reached.add(anchor);
    const missing = algorithm.anchors.filter((_, index) => !reached.has(index + 1));
    expect(missing, 'anclas que ningún ejemplo alcanza: añade un ejemplo que las cubra').toEqual([]);
  });

  it.each(examples)('traza dorada: $name', ({ input }) => {
    expect(summarize(traceOf(input))).toMatchSnapshot();
  });

  it('es determinista: dos ejecuciones dan los mismos bytes', () => {
    for (const input of inputs) {
      const first = traceOf(input);
      const second = traceOf(input);
      expect(second.header.fingerprint).toBe(first.header.fingerprint);
      expect(second.segments).toEqual(first.segments);
    }
  });

  it('coincide con el código mostrado en cualquier entrada', () => {
    fc.assert(
      fc.property(arbitraryFor(algorithm.input), (input) => {
        const trace = traceOf(input);
        expect(trace.header.result).toEqual(algorithm.reference(input));
        expect(algorithm.check?.(input, trace.header.result) ?? null).toBeNull();
      }),
      { numRuns: 60 },
    );
  });

  it('apunta a líneas en un orden que el código mostrado puede ejecutar', async () => {
    const { lineOf } = await algorithm.loadSource();
    fc.assert(
      fc.property(arbitraryFor(algorithm.input), (input) => {
        const lines = linesOfTrace(traceOf(input), lineOf);
        const executed = recordHits(() => algorithm.reference(input));
        expect(isSubsequence(lines, executed), `traza: ${lines}\nejecutado: ${executed}`).toBe(true);
      }),
      { numRuns: 60 },
    );
  });

  it('reconstruye cualquier frame igual al saltar que al recorrerla en orden', () => {
    for (const input of inputs) expect(seekMatchesSequential(traceOf(input))).toBe(true);
  });

  it('su estado sobrevive a un ciclo JSON, sin undefined, NaN ni Infinity', () => {
    for (const input of inputs) {
      const trace = traceOf(input);
      const cursor = new TraceCursor(trace);
      for (let i = 0; i < trace.header.frameCount; i++) {
        const json = JSON.stringify(cursor.seek(i).state);
        expect(JSON.stringify(JSON.parse(json))).toBe(json);
      }
    }
  });

  it('su exportación a JSON reconstruye cada frame', () => {
    for (const input of inputs) {
      const trace = traceOf(input);
      const exported = JSON.parse(JSON.stringify(exportTrace(trace)));
      expect(exported.frames).toHaveLength(trace.header.frameCount);
      const replayed = replayExport(exported);
      const cursor = new TraceCursor(trace);
      replayed.forEach((state, index) => {
        const frame = cursor.seek(index);
        expect(state, `frame ${index}`).toBe(JSON.stringify(frame.state));
        expect(exported.frames[index].explain).toBe(frame.explain);
        expect(exported.frames[index].counters).toEqual(frame.counters);
        expect(exported.frames[index].anchor).toBe(frame.anchor);
      });
    }
  });

  it('sus contadores nunca decrecen', () => {
    for (const input of inputs) {
      const { counters, header } = traceOf(input);
      const stride = COUNTER_NAMES.length;
      for (let frame = 1; frame < header.frameCount; frame++) {
        for (let name = 0; name < stride; name++) {
          const before = counters[(frame - 1) * stride + name] as number;
          const after = counters[frame * stride + name] as number;
          expect(after).toBeGreaterThanOrEqual(before);
        }
      }
    }
  });

  it('sus límites son ciertos: la entrada máxima cabe en el presupuesto', () => {
    const maximal: Record<string, unknown> = {};
    const generated: Record<string, unknown>[] = [];
    for (const [name, field] of Object.entries(algorithm.input.fields)) {
      maximal[name] = (field as InputField<unknown>).maximal();
    }
    for (const [name, field] of Object.entries(algorithm.input.fields)) {
      const typed = field as InputField<unknown>;
      for (const generate of Object.values(typed.generators ?? {})) {
        generated.push({ ...maximal, [name]: generate(seededRandom(1), maximal[name]) });
      }
    }
    for (const input of [maximal, ...generated]) {
      expect(traceOf(input).header.truncated).toBeNull();
    }
  });

  it('si ordena: devuelve el mismo array, ordenado', () => {
    if (algorithm.meta.category !== 'sorting') return;
    fc.assert(
      fc.property(arbitraryFor(algorithm.input), (input) => {
        const { values } = input as { values: readonly number[] };
        const result = traceOf(input).header.result as number[];
        // Igual a la copia ordenada: a la vez ordenado y permutación de la entrada.
        expect(result).toEqual([...values].sort((a, b) => a - b));
      }),
      { numRuns: 100 },
    );
  });

  it('si se declara estable, no cruza elementos iguales', () => {
    if (!algorithm.meta.stable) return;
    // Con números no se distinguen dos elementos iguales. Salvo 0 y -0: comparan igual en todo, pero
    // Object.is los separa. Si sus signos salen en el mismo orden en que entraron, no se han cruzado.
    const signsOfZeros = (values: readonly number[]) =>
      values.filter((value) => value === 0).map((value) => (Object.is(value, -0) ? '-' : '+'));
    fc.assert(
      fc.property(fc.array(fc.constantFrom(0, -0, 1, 2, 3), { minLength: 2, maxLength: 16 }), (values) => {
        const sorted = algorithm.reference({ ...algorithm.input.default, values }) as number[];
        expect(signsOfZeros(sorted)).toEqual(signsOfZeros(values));
      }),
      { numRuns: 200 },
    );
  });

  it('cumple sus invariantes al cerrar cada capítulo', () => {
    const invariants = algorithm.invariants ?? [];
    if (invariants.length === 0) return;
    for (const input of inputs) {
      const trace = traceOf(input);
      const cursor = new TraceCursor(trace);
      const closing = [
        ...trace.header.chapters.map((chapter) => chapter.frame - 1),
        trace.header.frameCount - 1,
      ];
      for (const frame of closing.filter((index) => index >= 0)) {
        const { state } = cursor.seek(frame);
        for (const invariant of invariants) {
          expect(invariant.holds(state), `${invariant.name} en el frame ${frame}`).toBe(true);
        }
      }
    }
  });
});

describe('el registro', () => {
  // Un descubrimiento que falla no da error, da menos tests: esta comparación es la que lo delataría.
  it('recoge todos los archivos .algo.ts que hay en disco', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    const onDisk = readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.algo.ts'))
      .map((file) => basename(file, '.algo.ts'));
    expect(algorithms.map((algorithm) => algorithm.id).sort()).toEqual(onDisk.sort());
  });

  it('no tiene identificadores repetidos', () => {
    const ids = algorithms.map((algorithm) => algorithm.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
