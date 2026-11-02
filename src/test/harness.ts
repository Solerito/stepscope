import { COUNTER_NAMES, type EncodedTrace, TraceCursor } from '@/core';

declare global {
  var __stepscopeHit: ((line: number) => void) | undefined;
}

/** Ejecuta `run` y devuelve las líneas del código mostrado que ha pasado por él, en orden. */
export function recordHits(run: () => void): number[] {
  const hits: number[] = [];
  globalThis.__stepscopeHit = (line) => hits.push(line);
  try {
    run();
  } finally {
    globalThis.__stepscopeHit = undefined;
  }
  return hits;
}

/** Ejecuta `run` con lo que rompería el determinismo sustituido por funciones que lanzan un error. */
export function forbidNondeterminism<T>(run: () => T): T {
  const forbidden = (name: string) => () => {
    throw new Error(`${name} rompe el determinismo de la traza`);
  };
  const originals = {
    random: Math.random,
    now: Date.now,
    performanceNow: performance.now,
    localeCompare: String.prototype.localeCompare,
  };
  Math.random = forbidden('Math.random');
  Date.now = forbidden('Date.now');
  performance.now = forbidden('performance.now');
  String.prototype.localeCompare = forbidden('localeCompare');
  try {
    return run();
  } finally {
    Math.random = originals.random;
    Date.now = originals.now;
    performance.now = originals.performanceNow;
    String.prototype.localeCompare = originals.localeCompare;
  }
}

/** Secuencia de líneas de una traza, sin repeticiones seguidas. */
export function linesOfTrace(trace: EncodedTrace, lineOf: Readonly<Record<string, number>>): number[] {
  const lines: number[] = [];
  for (const anchorIndex of trace.anchor) {
    if (anchorIndex === 0) continue;
    const line = lineOf[trace.header.anchors[anchorIndex - 1] as string] as number;
    if (lines.at(-1) !== line) lines.push(line);
  }
  return lines;
}

export function isSubsequence(needle: readonly number[], haystack: readonly number[]): boolean {
  let found = 0;
  for (const item of haystack) {
    if (found < needle.length && item === needle[found]) found++;
  }
  return found === needle.length;
}

/** Lo que fija el comportamiento de una traza: es lo que se guarda en el snapshot. */
export function summarize(trace: EncodedTrace) {
  const counters: Record<string, number> = {};
  const last = trace.header.frameCount - 1;
  COUNTER_NAMES.forEach((name, offset) => {
    counters[name] = trace.counters[last * COUNTER_NAMES.length + offset] as number;
  });
  return {
    frames: trace.header.frameCount,
    fingerprint: trace.header.fingerprint,
    result: trace.header.result,
    counters,
  };
}

/** Comprueba que saltar a cualquier frame reconstruye lo mismo que recorrer la traza en orden. */
export function seekMatchesSequential(trace: EncodedTrace, samples = 300): boolean {
  const sequential = new TraceCursor(trace);
  const expected: string[] = [];
  for (let i = 0; i < trace.header.frameCount; i++) {
    expected.push(JSON.stringify(sequential.seek(i).state));
  }

  const jumping = new TraceCursor(trace);
  for (let sample = 0; sample < samples; sample++) {
    // Secuencia determinista que salta por toda la traza, hacia delante y hacia atrás.
    const index = Math.floor((((sample * 2654435761) >>> 0) / 2 ** 32) * trace.header.frameCount);
    if (JSON.stringify(jumping.seek(index).state) !== expected[index]) return false;
  }
  return true;
}
