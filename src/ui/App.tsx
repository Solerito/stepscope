import { useEffect, useState } from 'react';
import { findAlgorithm } from '../algorithms/registry';
import { parseHash, type Route } from '../routing/hash';
import { BenchPage } from './pages/BenchPage';
import { CatalogPage } from './pages/CatalogPage';
import { CompareRoute } from './pages/ComparePage';
import { resolvePair } from './pages/compare-model';
import { PlayerPage } from './pages/PlayerPage';

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}

function titleFor(route: Route): string {
  if (route.page === 'algorithm') {
    const algorithm = findAlgorithm(route.id);
    return algorithm ? `${algorithm.meta.name}: StepScope` : 'StepScope';
  }
  if (route.page === 'compare') {
    const resolved = resolvePair(route.ids);
    if (resolved.kind !== 'pair') return 'Comparar: StepScope';
    const [a, b] = resolved.pair;
    return `${a.meta.name} frente a ${b.meta.name}: StepScope`;
  }
  return 'StepScope';
}

export function App() {
  const route = useRoute();

  useEffect(() => {
    document.title = titleFor(route);
  }, [route]);

  if (route.page === 'bench') return <BenchPage />;
  if (route.page === 'catalog') return <CatalogPage />;
  if (route.page === 'compare') return <CompareRoute ids={route.ids} params={route.params} />;

  const algorithm = findAlgorithm(route.id);
  if (!algorithm) return <CatalogPage notFound={route.id} />;

  // Cambiar de algoritmo reinicia la página entera: no comparten entrada, traza ni reproductor.
  return <PlayerPage key={algorithm.id} algorithm={algorithm} initialParams={route.params} />;
}
