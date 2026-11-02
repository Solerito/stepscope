import { useEffect, useState } from 'react';
import { findAlgorithm } from '../algorithms/registry';
import { parseHash, type Route } from '../routing/hash';
import { BenchPage } from './pages/BenchPage';
import { CatalogPage } from './pages/CatalogPage';
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

export function App() {
  const route = useRoute();

  useEffect(() => {
    const algorithm = route.page === 'algorithm' ? findAlgorithm(route.id) : undefined;
    document.title = algorithm ? `${algorithm.meta.name}: StepScope` : 'StepScope';
  }, [route]);

  if (route.page === 'bench') return <BenchPage />;
  if (route.page === 'catalog') return <CatalogPage />;

  const algorithm = findAlgorithm(route.id);
  if (!algorithm) return <CatalogPage notFound={route.id} />;

  // Cambiar de algoritmo reinicia la página entera: no comparten entrada, traza ni reproductor.
  return <PlayerPage key={algorithm.id} algorithm={algorithm} initialParams={route.params} />;
}
