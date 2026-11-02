import type { Category } from '@/core';
import { algorithms } from '../../algorithms/registry';
import styles from './CatalogPage.module.css';

const CATEGORY_NAMES: Readonly<Record<Category, string>> = {
  sorting: 'Ordenación',
  searching: 'Búsqueda',
  recursion: 'Recursión y backtracking',
  graphs: 'Grafos',
  dp: 'Programación dinámica',
  strings: 'Cadenas',
  structures: 'Estructuras de datos',
};

export function CatalogPage({ notFound }: { readonly notFound?: string }) {
  const categories = (Object.keys(CATEGORY_NAMES) as Category[])
    .map((category) => ({
      category,
      items: algorithms
        .filter((algorithm) => algorithm.meta.category === category)
        .sort((a, b) => a.meta.name.localeCompare(b.meta.name, 'es')),
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
    </main>
  );
}
