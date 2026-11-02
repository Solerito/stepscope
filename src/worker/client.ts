import type { EncodedTrace } from '@/core';
import type { TraceRequest, TraceResponse } from './trace.worker';

/** Un algoritmo que no responde en este tiempo tiene un bug o una entrada que no cabe. */
const WATCHDOG_MS = 10_000;

export class TraceCancelled extends Error {}

let worker: Worker | null = null;
let requestCount = 0;
let cancelCurrent: (() => void) | null = null;

function getWorker(): Worker {
  worker ??= new Worker(new URL('./trace.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

function discardWorker(): void {
  worker?.terminate();
  worker = null;
}

/** Pide una traza. Una petición nueva cancela la anterior: terminar el worker es la única forma de pararlo. */
export function requestTrace(algorithmId: string, input: unknown): Promise<EncodedTrace> {
  cancelCurrent?.();

  return new Promise<EncodedTrace>((resolve, reject) => {
    const requestId = ++requestCount;
    const current = getWorker();

    const finish = () => {
      clearTimeout(watchdog);
      current.removeEventListener('message', onMessage);
      current.removeEventListener('error', onError);
      cancelCurrent = null;
    };

    const onMessage = ({ data }: MessageEvent<TraceResponse>) => {
      if (data.requestId !== requestId) return;
      finish();
      if (data.ok) resolve(data.trace);
      else reject(new Error(data.message));
    };

    const onError = (event: ErrorEvent) => {
      finish();
      discardWorker();
      reject(new Error(event.message || 'El cálculo de la traza ha fallado'));
    };

    const watchdog = setTimeout(() => {
      finish();
      discardWorker();
      reject(new Error('El algoritmo no ha terminado en 10 segundos: prueba con una entrada más pequeña.'));
    }, WATCHDOG_MS);

    cancelCurrent = () => {
      finish();
      discardWorker();
      reject(new TraceCancelled());
    };

    current.addEventListener('message', onMessage);
    current.addEventListener('error', onError);
    current.postMessage({ requestId, algorithmId, input } satisfies TraceRequest);
  });
}
