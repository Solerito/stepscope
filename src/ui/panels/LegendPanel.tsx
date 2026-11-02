import type { Role } from '@/core';
import { ROLE_STYLES } from '../../scene/roles';
import styles from './LegendPanel.module.css';

/** Se genera con los roles que aparecen en esta traza: nunca explica algo que no se va a ver. */
export function LegendPanel({ roles }: { readonly roles: readonly Role[] }) {
  if (roles.length === 0) return null;

  return (
    <div className={styles.legend}>
      <h3 className={styles.title}>Leyenda</h3>
      <ul className={styles.list}>
        {roles.map((role) => {
          const style = ROLE_STYLES[role];
          return (
            <li key={role} className={styles.item}>
              <span
                className={styles.swatch}
                data-pattern={style.pattern}
                data-stain={style.stain}
                data-outline={style.outline}
                aria-hidden="true"
              />
              <span className={styles.glyph} aria-hidden="true">
                {style.glyph}
              </span>
              {style.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
