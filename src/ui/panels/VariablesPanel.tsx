import type { FrameSource } from '../../player/presenter';
import { usePlayerState } from '../usePlayer';
import styles from './VariablesPanel.module.css';

export function VariablesPanel({ engine }: { readonly engine: FrameSource }) {
  const vars = usePlayerState(engine, (state) => state.vars);
  const changed = usePlayerState(engine, (state) => state.changedVars);
  const names = Object.keys(vars);

  if (names.length === 0) return <p className={styles.empty}>Ninguna viva en este paso.</p>;

  return (
    <dl className={styles.list}>
      {names.map((name) => {
        const isChanged = changed.includes(name);
        return (
          <div key={name} className={styles.row} data-changed={isChanged}>
            <dt className={styles.name}>{name}</dt>
            <dd className={styles.value}>
              {JSON.stringify(vars[name])}
              {isChanged ? <span className={styles.changedMark}> cambia</span> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
