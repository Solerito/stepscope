import type { Ref } from 'react';
import styles from './KeyboardHelp.module.css';

const SHORTCUTS: readonly { readonly keys: string; readonly action: string }[] = [
  { keys: '← →', action: 'Paso anterior o siguiente' },
  { keys: 'Mayús + ← →', action: 'Hito anterior o siguiente' },
  { keys: 'Inicio, Fin', action: 'Ir al principio o al final' },
  { keys: 'Espacio', action: 'Reproducir o pausar' },
  { keys: '+ −', action: 'Más o menos velocidad' },
  { keys: 'G', action: 'Cambiar el detalle: todo, sin comparaciones o solo hitos' },
  { keys: '?', action: 'Abrir esta ayuda' },
];

export function KeyboardHelp({ dialog }: { readonly dialog: Ref<HTMLDialogElement> }) {
  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="keyboard-help-title">
      <h2 id="keyboard-help-title" className={styles.title}>
        Atajos de teclado
      </h2>
      <dl className={styles.list}>
        {SHORTCUTS.map(({ keys, action }) => (
          <div key={keys} className={styles.row}>
            <dt className={styles.keys}>{keys}</dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
      <form method="dialog">
        <button type="submit" className={styles.close}>
          Cerrar
        </button>
      </form>
    </dialog>
  );
}
