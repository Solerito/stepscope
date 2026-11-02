import { useEffect, useRef, useState } from 'react';
import styles from './ShareButton.module.css';

const MESSAGE_MS = 2500;

interface Props {
  readonly link: () => string;
  readonly label?: string;
}

/** Copia el enlace al paso exacto que se está viendo. */
export function ShareButton({ link, label = 'Copiar enlace a este paso' }: Props) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(link());
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    timer.current = setTimeout(() => setStatus('idle'), MESSAGE_MS);
  };

  return (
    <span className={styles.wrapper}>
      <button type="button" className={styles.button} onClick={copy}>
        {label}
      </button>
      <span className={styles.status} role="status">
        {status === 'copied' ? 'Enlace copiado' : null}
        {status === 'failed' ? 'No se ha podido copiar: copia la dirección del navegador' : null}
      </span>
    </span>
  );
}
