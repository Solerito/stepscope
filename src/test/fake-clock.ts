import type { Clock, FrameCallback } from '../player/clock';

/** Un reloj que solo avanza cuando el test lo dice. */
export class FakeClock implements Clock {
  callback: FrameCallback | null = null;

  start(callback: FrameCallback) {
    this.callback = callback;
  }

  stop() {
    this.callback = null;
  }

  tick(ms: number) {
    this.callback?.(ms);
  }

  /** Avanza en pasos de 16 ms hasta agotar el tiempo o hasta que el reloj se pare. */
  run(ms: number) {
    for (let elapsed = 0; elapsed < ms && this.callback; elapsed += 16) this.tick(16);
  }
}
