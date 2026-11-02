export type FrameCallback = (deltaMs: number) => void;

export interface Clock {
  start(callback: FrameCallback): void;
  stop(): void;
}

/** Un salto largo significa que la pestaña estuvo en segundo plano, no que hayan pasado esos pasos. */
const MAX_DELTA_MS = 100;

export function createRafClock(): Clock {
  let handle: number | null = null;
  let last = 0;

  return {
    start(callback) {
      if (handle !== null) return;
      last = performance.now();
      const loop = (now: number) => {
        const delta = Math.min(MAX_DELTA_MS, now - last);
        last = now;
        handle = requestAnimationFrame(loop);
        callback(delta);
      };
      handle = requestAnimationFrame(loop);
    },

    stop() {
      if (handle !== null) cancelAnimationFrame(handle);
      handle = null;
    },
  };
}
