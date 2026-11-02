import type { Category } from '@/core';
import { CATEGORY_NAMES, catalogOrder } from '../catalog';
import styles from './CatalogPage.module.css';
import { FEATURED_COMPARISONS } from './featured';

export function CatalogPage({ notFound }: { readonly notFound?: string }) {
  const categories = (Object.keys(CATEGORY_NAMES) as Category[])
    .map((category) => ({
      category,
      items: catalogOrder.filter((algorithm) => algorithm.meta.category === category),
    }))
    .filter(({ items }) => items.length > 0);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>StepScope</h1>
        <p className={styles.lead}>
          Mira qué hace un algoritmo por dentro, paso a paso y con tu propia entrada.
        </p>
      </header>

      {notFound ? (
        <p className={styles.notice} role="alert">
          No existe ningún algoritmo llamado «{notFound}». Elige uno de esta lista.
        </p>
      ) : null}

      {categories.map(({ category, items }) => (
        <section key={category} className={styles.category} aria-labelledby={`category-${category}`}>
          <h2 id={`category-${category}`} className={styles.categoryName}>
            {CATEGORY_NAMES[category]}
          </h2>
          <ul className={styles.list}>
            {items.map((algorithm) => (
              <li key={algorithm.id}>
                <a className={styles.item} href={`#/${algorithm.id}`}>
                  <span className={styles.itemName}>{algorithm.meta.name}</span>
                  <span className={styles.itemSummary}>{algorithm.meta.summary}</span>
                  <span className={styles.itemCost}>{algorithm.meta.complexity.time.worst}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className={styles.category} aria-labelledby="category-compare">
        <h2 id="category-compare" className={styles.categoryName}>
          Comparar dos algoritmos
        </h2>
        <p className={styles.sectionLead}>
          La misma entrada y un mismo reloj, que avanza por operaciones. También desde cualquier algoritmo,
          con «Comparar con otro».
        </p>
        <ul className={styles.list}>
          {FEATURED_COMPARISONS.map((comparison) => (
            <li key={comparison.href}>
              <a className={styles.item} href={comparison.href}>
                <span className={styles.itemName}>{comparison.title}</span>
                <span className={styles.itemSummary}>{comparison.summary}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
