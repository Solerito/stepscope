# StepScope

Visualizador de algoritmos por trazas. Plan, decisiones y roadmap en `PLAN.md`. La v1 comprometida son las fases F1, F3 y F4, en ese orden.

## Git: lo hace Unai

No hacer commits, push, ramas, PR ni etiquetas. Dejar los cambios en el árbol de trabajo y avisar cuando haya un buen punto para commitear, con un mensaje propuesto.

## Comandos

```powershell
npm run check       # Biome: lint, formato y fronteras entre capas
npm run typecheck   # tsc -b con las tres configuraciones
npm test            # Vitest: unitarios y batería universal
npm run test:update # Regenera snapshots cuando una traza cambia a propósito
npm run e2e         # Playwright en Chromium, WebKit y móvil, con axe
npm run budget      # Tamaño del bundle inicial, tras `npm run build` (también en CI)
```

## Capas

- `core`: trazas, tracer y entrada. Sin React ni DOM; corre en el worker, en tests y en el navegador.
- `algorithms`: un archivo por algoritmo. Solo importan de `@/core`.
- `scene`, `views`, `player`: el camino caliente. Sin React.
- `ui`: lo único que usa React. No pinta la visualización: monta el lienzo y escucha el store.

Biome hace cumplir estas fronteras con `noRestrictedImports`.

## Reglas que no son evidentes

- **`*.algo.ts` no se formatea.** Biome movería `// @ancla` fuera de líneas como `for (...) { // @outer` y rompería el mapeo a líneas. Por eso están excluidos en `biome.json`.
- **Dos tsconfig por una razón.** `noUncheckedIndexedAccess` obligaría a escribir `a[j]!` en el código que ve el usuario: está activo en la app e inactivo en los algoritmos.
- **El cursor reutiliza `frame.state` entre seeks.** Lo que se quiera conservar se copia. Las vistas construyen su escena en el momento.
- **Al aplicar deltas hay que clonar los valores.** Si no, el estado comparte objetos con el segmento en caché y retroceder reconstruye mal. El test de `seek` aleatorio contra secuencial lo detecta.
- **`fsModuleCache` de Vitest debe seguir desactivado.** Con él, `import.meta.glob` no ve algoritmos nuevos. Un test compara el registro con el disco.
- **Nada no finito en la traza.** `JSON.stringify` convierte `Infinity` en `null`; el tracer lo normaliza a `'∞'`.
- **La URL no se actualiza durante la reproducción.** Safari limita `history.replaceState`.

## Diseño visual

La paleta sale de una preparación histológica: hematoxilina y eosina sobre campo claro, con el cuerpo del instrumento en oscuro (`ui/styles/tokens.css`). El gesto llamativo es solo uno: la barra de progreso como micrómetro, con marcas reales en cada hito.

- Un rol se define en `scene/roles.ts` con glifo y patrón además de color: el color nunca es la única señal.
- Sin cards, sombras ni etiquetas en mayúsculas.

## Reglas añadidas en F3

- **Una función `void` ancla su retorno en la llave de cierre:** `} // @return`. El plugin de fidelidad marca esa línea cuando la función llega al final sin `return`.
- **Niveles de frame:**
  - 0: hitos (pasadas, llamadas y retornos).
  - 1: cambios de estado.
  - 2: comparaciones y lecturas.

  El selector «Avanzar» y la tecla `G` filtran por nivel.
- **Las vistas declaran dónde van:** `place: 'stage' | 'side'` y `weight` en el `ViewSpec`. La primera va siempre a la platina. En móvil la platina enseña solo la primera; el resto pasa a pestañas.
- **La estabilidad se prueba con `0` y `-0`:** comparan igual pero `Object.is` los distingue. Los algoritmos con `meta.stable` pasan ese test solos; si el rango de su campo `values` no incluye el 0, el test fallará.
- **Algoritmos con azar:** la semilla es un campo de entrada, y `reference` y `trace` consumen la misma secuencia de `seededRandom(seed)`. Con `Math.random`, el test de fidelidad compararía ejecuciones distintas.

## Reglas añadidas en F4

- **Pintar y decidir el frame van por separado.** `FramePresenter` (`player/presenter.ts`) pinta un frame y publica los paneles. `PlayerEngine` y `CompareEngine` solo deciden qué frame toca. Los paneles y `ViewPane` reciben un `FrameSource`, no un motor concreto.
- **El reloj de la comparación cuenta operaciones:** comparaciones + escrituras + llamadas (`COST_COUNTERS`). Cada lado enseña el último frame cuyo coste no pasa del reloj. Los frames sin coste se ven de camino: es así a propósito.
- **Datos frente a variantes.** Un campo con `variant: true` configura el algoritmo, y cada lado de la comparación elige el suyo. `choice` ya lo es. Una semilla también debe serlo: si no, dos lados con pivote aleatorio no podrían diferir.
- **Dos algoritmos son comparables** si sus campos de datos tienen los mismos nombres y tipos (`sharedFields`). El campo común solo acepta lo que aceptan los dos. Un tipo de campo nuevo necesita su caso en `intersectFields`; sin él, esos algoritmos no se pueden comparar.
- **URL de comparación:** `#/compare/<a>/<b>?<datos>&a.<variante>=…&b.<variante>=…&op=<coste>&fp=<fpA>,<fpB>`.
- **Una comparación necesita dos workers.** Cada lado usa su propio `TraceChannel`; con uno solo, cada petición cancelaría la del otro lado.
- **Los enlaces del README salen de `ui/pages/featured.ts`.** Un test exige que coincidan.
- **Las tinciones deben distinguirse con daltonismo:** `ui/styles/palette.test.ts` simula los cuatro tipos sobre `tokens.css`. Si cambias un color y falla, el color nuevo no vale.
