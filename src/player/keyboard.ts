import type { PlayerEngine } from './engine';
import { SPEEDS } from './engine';

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }
  return target instanceof HTMLInputElement && target.type !== 'range';
}

function changeSpeed(engine: PlayerEngine, direction: 1 | -1): void {
  const current = SPEEDS.indexOf(engine.store.getState().speed as (typeof SPEEDS)[number]);
  const next = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, current + direction))];
  if (next !== undefined) engine.setSpeed(next);
}

/** Las flechas controlan el reproductor, salvo mientras se escribe en un campo de texto. */
export function bindKeyboard(engine: PlayerEngine, onHelp: () => void, target: Window = window): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTextEntry(event.target)) return;
    // Con un diálogo abierto, las teclas son suyas: el reproductor de detrás no debe moverse.
    if (document.querySelector('dialog[open]')) return;

    switch (event.key) {
      case '?':
        onHelp();
        break;
      case 'ArrowRight':
        if (event.shiftKey) engine.jumpToMilestone(1);
        else engine.step(1);
        break;
      case 'ArrowLeft':
        if (event.shiftKey) engine.jumpToMilestone(-1);
        else engine.step(-1);
        break;
      case 'Home':
        engine.seek(0);
        break;
      case 'End':
        engine.seek(engine.store.getState().frameCount - 1);
        break;
      case ' ':
        // En un botón con el foco, Espacio ya lo activa: no debe contar dos veces.
        if (event.target instanceof HTMLButtonElement) return;
        engine.toggle();
        break;
      case 'g':
      case 'G': {
        const current = engine.store.getState().granularity;
        engine.setGranularity(current === 0 ? 2 : current === 2 ? 1 : 0);
        break;
      }
      case '+':
        changeSpeed(engine, 1);
        break;
      case '-':
        changeSpeed(engine, -1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}
