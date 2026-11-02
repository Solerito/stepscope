import { type EncodedTrace, runTrace, transferablesOf } from '@/core';
import { findAlgorithm } from '../algorithms/registry';

export interface TraceRequest {
  readonly requestId: number;
  readonly algorithmId: string;
  readonly input: unknown;
}

export type TraceResponse =
  | { readonly requestId: number; readonly ok: true; readonly trace: EncodedTrace }
  | { readonly requestId: number; readonly ok: false; readonly message: string };

self.onmessage = ({ data }: MessageEvent<TraceRequest>) => {
  const { requestId, algorithmId, input } = data;
  try {
    const algorithm = findAlgorithm(algorithmId);
    if (!algorithm) throw new Error(`No existe el algoritmo «${algorithmId}»`);

    const trace = runTrace(algorithm, input, { algorithmId });
    const response: TraceResponse = { requestId, ok: true, trace };
    // Sin copia: la memoria pasa al hilo principal y la interfaz no se bloquea al recibirla.
    self.postMessage(response, { transfer: transferablesOf(trace) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ requestId, ok: false, message } satisfies TraceResponse);
  }
};
