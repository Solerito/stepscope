import { defineConfig, mergeConfig } from 'vitest/config';
import { fidelityPlugin } from './src/test/fidelity-plugin.ts';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [fidelityPlugin()],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      // Esta caché reutiliza registry.ts ya transformado y con el glob expandido: un algoritmo nuevo no
      // aparecería en los tests hasta que ese archivo cambiase. Sin ella la batería sigue tardando menos de 1 s.
      fsModuleCache: false,
    },
  }),
);
