# StepScope

Un microscopio para algoritmos: ejecútalos paso a paso con tu propia entrada y mira qué hacen por dentro, con la estructura animada, la línea de código activa, las variables vivas y una explicación de cada paso. Puedes poner dos uno al lado del otro con un mismo reloj que cuenta operaciones.

**Demo: [stepscope.vercel.app](https://stepscope.vercel.app)**

## Por dónde empezar

Comparaciones, cada una con algo que no se ve mirando un solo algoritmo:

- [Quicksort frente a mergesort](https://stepscope.vercel.app/#/compare/quick-sort/merge-sort?values=38,27,43,3,9,82,10,3,55,21,64,12): los dos son O(n log n), pero no hacen el mismo trabajo.
- [El pivote de quicksort sobre un array ya ordenado](https://stepscope.vercel.app/#/compare/quick-sort/quick-sort?values=1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16&a.pivot=last&b.pivot=median3): el último como pivote cae en el peor caso y la mediana de tres lo evita.
- [Inserción frente a Shell sort, con el array al revés](https://stepscope.vercel.app/#/compare/insertion-sort/shell-sort?values=16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1): Shell sort mueve primero los elementos lejanos.
- [Búsqueda lineal frente a binaria](https://stepscope.vercel.app/#/compare/linear-search/binary-search?values=1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,39,41,43,45,47,49,51,53,55,57,59&target=53): n pasos frente a log₂ n.

Algoritmos sueltos:

- [Fibonacci con memoización](https://stepscope.vercel.app/#/fibonacci-memo?n=6): el árbol de llamadas se poda en cuanto un valor ya está calculado.
- [Heapsort](https://stepscope.vercel.app/#/heap-sort?values=4,10,3,5,1,8,7): el mismo array visto como array y como montículo a la vez.
- [Radix sort](https://stepscope.vercel.app/#/radix-sort?values=170,45,75,90,802,24,2,66): ordena sin una sola comparación.

Cada enlace guarda el algoritmo, la entrada y el paso exacto. Las flechas avanzan y retroceden; `?` enseña el resto de atajos.

## Cómo funciona

Los algoritmos no se animan a sí mismos. Cada uno emite una **traza**: una secuencia de frames con el estado, la línea activa, las variables y la explicación. El reproductor recibe la traza y la pinta sin saber qué algoritmo está mostrando.

```
 *.algo.ts ──► Worker: trace(input) ──► bytes (transferencia sin copia) ──┐
                                                                          ▼
 SVG ◄── interpolate(escena i, escena i+1, t) ◄── vista(frame) ◄── cursor.seek(i)
```

Todo lo que se ve es función de dos números: el frame y el progreso de la transición. Por eso retroceder, saltar, arrastrar la barra, interrumpir una animación o desactivarla no son casos especiales, y cada ejecución se puede probar de forma determinista.

## Decisiones, con lo que se midió

Cada decisión se tomó midiendo antes con un prototipo. El detalle está en [PLAN.md](PLAN.md).

| Decisión                                                               | Por qué                                                                                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deltas con keyframes, codificados en bytes**                         | Guardar el estado completo de cada frame de fib(15) ocupa 574 MB. Con deltas en bytes, 1,1 MB. Saltar a cualquier frame tarda menos de 19 ms en el peor caso medido                         |
| **La traza se genera en un Web Worker y cruza como bytes**             | Pasarla como objetos congelaba la interfaz 595 ms con fib(20). Como bytes se transfiere sin copia                                                                                           |
| **SVG imperativo, sin React en el camino caliente**                    | El coste de SVG crece con lo que cambia, no con lo que hay: 300 elementos caben en 16 ms con la CPU a ×4. Canvas solo ganaba con repintado parcial, y a estos tamaños no hace falta         |
| **Animación propia, sin librería**                                     | Con `escena(i, t)` como función pura, ir hacia atrás o respetar `prefers-reduced-motion` no necesita código aparte. Una librería de tweens guarda su propio tiempo y obliga a sincronizarlo |
| **El código que se ve es TypeScript real, verificado contra la traza** | Cada archivo tiene la función que se muestra y la instrumentada. Un plugin de test comprueba que las líneas de la traza son una secuencia que el código mostrado puede ejecutar de verdad   |
| **La comparación avanza por operaciones, no por frames**               | Una comparación, una escritura o una llamada son un tic. Así un algoritmo que explica más pasos no parece por eso más lento                                                                 |

El bundle inicial pesa 119 kB comprimidos, con un presupuesto de 140 kB que comprueba CI.

## Cómo se verifica

Cada algoritmo pasa una batería universal sin escribir un solo test propio:

- La traza es determinista: `Math.random`, `Date.now` y `localeCompare` lanzan un error durante el test.
- El resultado coincide con el del código mostrado, en entradas aleatorias con fast-check.
- Las líneas de la traza están en un orden que el código mostrado puede ejecutar.
- Saltar a cualquier frame reconstruye lo mismo que recorrer la traza en orden.
- La exportación a JSON reconstruye cada frame.
- La entrada máxima cabe en el presupuesto de frames y bytes.
- Si ordena, el resultado está ordenado y es una permutación de la entrada. Si se declara estable, no cruza elementos iguales: se comprueba con `0` y `-0`, que comparan igual pero `Object.is` distingue.

Además hay tests E2E con Playwright en Chromium, WebKit y un iPhone emulado, con revisión de accesibilidad de axe en el catálogo, en cada algoritmo y en cada comparación preparada. Cada rol visual lleva glifo y patrón además de color, y un test simula los cuatro tipos de daltonismo sobre la paleta.

## Cómo añadir un algoritmo

Se crea un archivo y ya está:

1. Copia `docs/algorithm-template.algo.ts` en `src/algorithms/<categoría>/<id>.algo.ts`. El `id` de la URL sale del nombre del archivo.
2. Escribe en la región `//#region shown` el código que verá el usuario, con `// @ancla` en las líneas a las que apuntarán los frames.
3. Declara los metadatos, la entrada, las vistas y las anclas, y escribe en `trace` la versión instrumentada.
4. Ejecuta `npm run test:update`, que genera la entrada del algoritmo en el snapshot.

El algoritmo aparece en el catálogo, pasa la batería universal y se puede comparar con cualquier otro que reciba la misma entrada. Si tiene variantes, como la regla del pivote, márcalas con `variant: true` (las opciones de `choice` ya lo son) y la comparación dejará elegir una en cada lado.

Reglas: una acción por línea en el código mostrado, nada de `Math.random` ni `Date` (usa `t.random()`), y sintaxis de TypeScript borrable, sin `enum`.

## Desarrollo

Necesita Node 24 o superior.

| Comando               | Qué hace                                                         |
| --------------------- | ---------------------------------------------------------------- |
| `npm run dev`         | Servidor de desarrollo                                           |
| `npm test`            | Tests unitarios y la batería universal                           |
| `npm run test:update` | Regenera los snapshots de las trazas                             |
| `npm run typecheck`   | Comprueba los tipos                                              |
| `npm run check`       | Lint, formato y fronteras entre capas                            |
| `npm run e2e`         | Tests en Chromium, WebKit y móvil, con revisión de accesibilidad |
| `npm run build`       | Sitio estático en `dist/`                                        |
| `npm run budget`      | Comprueba el tamaño del bundle inicial, tras `build`             |

La ruta `#/bench` mide el rendimiento en el dispositivo en el que se abra.

Stack: TypeScript 7, React 19 solo para los paneles, Vite 8, Zustand, Biome, Vitest, fast-check y Playwright. Se despliega en Vercel; GitHub Actions solo comprueba.

El sitio publicado carga las dos medidas de Vercel: Web Analytics (visitas) y Speed Insights (métricas de carga). Las dos sirven su script desde el propio dominio, no desde un tercero, y no leen ni escriben cookies. La cabecera `Content-Security-Policy` de `vercel.json` no abre ningún dominio externo.

## Licencia

[MIT](LICENSE)
