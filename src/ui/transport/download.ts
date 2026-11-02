import { type EncodedTrace, exportTrace } from '@/core';

/** Safari necesita la URL viva un momento después del clic, o la descarga se queda vacía. */
const REVOKE_AFTER_MS = 30_000;

export function traceFileName(trace: EncodedTrace): string {
  return `stepscope-${trace.header.algorithmId}-${trace.header.fingerprint}.json`;
}

/** Descarga la traza entera en JSON: el formato está descrito en `core/trace/export.ts`. */
export function downloadTrace(trace: EncodedTrace): void {
  const json = JSON.stringify(exportTrace(trace));
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = traceFileName(trace);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
