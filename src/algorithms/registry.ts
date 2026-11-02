import { type AlgorithmDefinition, extractShown, type ShownSource } from '@/core';

// biome-ignore lint/suspicious/noExplicitAny: colección heterogénea, cada archivo se comprueba en su sitio
type AnyDefinition = AlgorithmDefinition<any, any, string>;

export interface RegisteredAlgorithm extends AnyDefinition {
  readonly id: string;
  readonly loadSource: () => Promise<ShownSource>;
}

const modules = import.meta.glob<{ default: AnyDefinition }>('./**/*.algo.ts', { eager: true });

// Perezoso: el texto se descarga al abrir el algoritmo y no engorda el bundle inicial.
const texts = import.meta.glob<string>('./**/*.algo.ts', { query: '?raw', import: 'default' });

const idFromPath = (path: string) => path.slice(path.lastIndexOf('/') + 1, -'.algo.ts'.length);

export const algorithms: readonly RegisteredAlgorithm[] = Object.entries(modules).map(([path, module]) => ({
  ...module.default,
  id: idFromPath(path),
  loadSource: async () => {
    const load = texts[path];
    if (!load) throw new Error(`Sin texto para ${path}`);
    return extractShown(await load());
  },
}));

export function findAlgorithm(id: string): RegisteredAlgorithm | undefined {
  return algorithms.find((algorithm) => algorithm.id === id);
}
