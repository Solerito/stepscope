import type { EncodedTrace } from '@/core';
import type { TraceRequest, TraceResponse } from './trace.worker';

/** Un algoritmo que no responde en este tiempo tiene un bug o una entrada que no cabe. */
const WATCHDOG_MS = 10_000;

export class TraceCancelled extends Error {}

let requestCount = 0;

/**
 * Un worker con una petición en curso como mucho: una nueva cancela la anterior, y terminar el worker
 * es la única forma de pararlo. La comparación usa un canal por lado, para que una no cancele a la otra.
 */
export class TraceChannel {
  private worker: Worker | null = null;
  private cancelCurrent: (() => void) | null = null;

  request(algorithmId: string, input: unknown): Promise<EncodedTrace> {
    this.cancelCurrent?.();

    return new Promise<EncodedTrace>((resolve, reject) => {
      const requestId = ++requestCount;
      const current = this.getWorker();

      const finish = () => {
        clearTimeout(watchdog);
        current.removeEventListener('message', onMessage);
        current.removeEventListener('error', onError);
        this.cancelCurrent = null;
      };

      const onMessage = ({ data }: MessageEvent<TraceResponse>) => {
        if (data.requestId !== requestId) return;
        finish();
        if (data.ok) resolve(data.trace);
        else reject(new Error(data.message));
      };

      const onError = (event: ErrorEvent) => {
        finish();
        this.discardWorker();
        reject(new Error(event.message || 'El cálculo de la traza ha fallado'));
      };

      const watchdog = setTimeout(() => {
        finish();
        this.discardWorker();
        reject(new Error('El algoritmo no ha terminado en 10 segundos: prueba con una entrada más pequeña.'));
      }, WATCHDOG_MS);

      this.cancelCurrent = () => {
        finish();
        this.discardWorker();
        reject(new TraceCancelled());
      };

      current.addEventListener('message', onMessage);
      current.addEventListener('error', onError);
      current.postMessage({ requestId, algorithmId, input } satisfies TraceRequest);
    });
  }

  /** Cancela lo que haya en curso y libera el worker. Una petición posterior crea otro. */
  dispose(): void {
    this.cancelCurrent?.();
    this.discardWorker();
  }

  private getWorker(): Worker {
    this.worker ??= new Worker(new URL('./trace.worker.ts', import.meta.url), { type: 'module' });
    return this.worker;
  }

  private discardWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

/** El canal del reproductor: hay uno a la vez en pantalla. */
export const mainChannel = new TraceChannel();
