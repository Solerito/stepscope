const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

/**
 * FNV-1a sobre lo que define el comportamiento observable de una traza: la secuencia de anclas,
 * los contadores y el resultado. No toca los segmentos, así que no hace falta decodificarlos.
 */
export function fingerprint(anchor: Uint16Array, counters: Uint32Array, result: unknown): string {
  let hash = FNV_OFFSET;
  const mix = (value: number) => {
    hash = Math.imul(hash ^ value, FNV_PRIME) >>> 0;
  };
  mix(anchor.length);
  for (const value of anchor) mix(value);
  for (const value of counters) mix(value);
  for (const char of JSON.stringify(result) ?? '') mix(char.charCodeAt(0));
  return hash.toString(36);
}
