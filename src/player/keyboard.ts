import type { CompareEngine } from './compare';
import type { PlayerEngine } from './engine';
import { SPEEDS } from './engine';

/** Lo que puede hacer el teclado. Lo que un reloj no tenga, como los hitos en la comparación, se omite. */
export interface KeyCommands {
  step(direction: 1 | -1): void;
  start(): void;
  end(): void;
  toggle(): void;
  speed(direction: 1 | -1): void;
  milestone?(direction: 1 | -1): void;
  granularity?(): void;
}

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

/** La siguiente velocidad de la lista en esa dirección, sin salirse de ella. */
export function nextSpeed(current: number, direction: 1 | -1): number {
  const index = SPEEDS.indexOf(current as (typeof SPEEDS)[number]);
  return SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, index + direction))] ?? current;
}

/** Las flechas controlan el reproductor, salvo mientras se escribe en un campo de texto. */
export function bindKeys(commands: KeyCommands, onHelp: () => void, target: Window = window): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTextEntry(event.target)) return;
    // Con un diálogo abierto, las teclas son suyas: el reproductor de detrás no debe moverse.
    if (document.querySelector('dialog[open]')) return;

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    switch (event.key) {
      case '?':
        onHelp();
        break;
      case 'ArrowRight':
      case 'ArrowLeft':
        if (event.shiftKey && commands.milestone) commands.milestone(direction);
        else commands.step(direction);
        break;
      case 'Home':
        commands.start();
        break;
      case 'End':
        commands.end();
        break;
      case ' ':
        // En un botón con el foco, Espacio ya lo activa: no debe contar dos veces.
        if (event.target instanceof HTMLButtonElement) return;
        commands.toggle();
        break;
      case 'g':
      case 'G':
        if (!commands.granularity) return;
        commands.granularity();
        break;
      case '+':
        commands.speed(1);
        break;
      case '-':
        commands.speed(-1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}

export function playerCommands(engine: PlayerEngine): KeyCommands {
  return {
    step: (direction) => engine.step(direction),
    milestone: (direction) => engine.jumpToMilestone(direction),
    start: () => engine.seek(0),
    end: () => engine.seek(engine.store.getState().frameCount - 1),
    toggle: () => engine.toggle(),
    speed: (direction) => engine.setSpeed(nextSpeed(engine.store.getState().speed, direction)),
    granularity: () => {
      const current = engine.store.getState().granularity;
      engine.setGranularity(current === 0 ? 2 : current === 2 ? 1 : 0);
    },
  };
}

export function compareCommands(engine: CompareEngine): KeyCommands {
  return {
    step: (direction) => engine.step(direction),
    start: () => engine.seek(0),
    end: () => engine.seek(engine.total),
    toggle: () => engine.toggle(),
    speed: (direction) => engine.setSpeed(nextSpeed(engine.store.getState().speed, direction)),
  };
}

export function bindKeyboard(engine: PlayerEngine, onHelp: () => void, target: Window = window): () => void {
  return bindKeys(playerCommands(engine), onHelp, target);
}
