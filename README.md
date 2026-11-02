# StepScope

Un microscopio para algoritmos: ejecútalos paso a paso con tu propia entrada y mira qué hacen por dentro, con la estructura animada, la línea de código activa, las variables vivas y una explicación de cada paso.

El plan completo y las decisiones de arquitectura, con sus medidas, están en [PLAN.md](PLAN.md).

## Cómo funciona

Los algoritmos no se animan a sí mismos. Cada uno emite una **traza**, una secuencia de frames con el estado, la línea activa, las variables y la explicación. El reproductor recibe la traza y la pinta, sin saber qué algoritmo está mostrando.

Eso da gratis retroceder, saltar a cualquier punto, compartir el paso exacto por URL y probar cada ejecución de forma determinista.

## Cómo añadir un algoritmo

Se crea un archivo y ya está:

1. Copia `docs/algorithm-template.algo.ts` en `src/algorithms/<categoría>/<id>.algo.ts`. El `id` de la URL sale del nombre del archivo.
2. Escribe en la región `//#region shown` el código que verá el usuario, con `// @ancla` en las líneas a las que apuntarán los frames.
3. Declara los metadatos, la entrada, las vistas y las anclas, y escribe en `trace` la versión instrumentada.
4. Ejecuta `npm run test:update`, que genera la entrada del algoritmo en el snapshot.

El algoritmo aparece en el catálogo y pasa solo una batería de tests. Entre otras cosas, comprueba que:

- La traza es determinista.
- El resultado coincide con el del código mostrado en entradas aleatorias.
- Las líneas de la traza están en un orden que ese código puede ejecutar de verdad.
- Saltar a cualquier frame reconstruye lo mismo que recorrerla en orden.
- La entrada máxima cabe en el presupuesto.

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

La ruta `#/bench` mide el rendimiento en el dispositivo en el que se abra.

## Licencia

[MIT](LICENSE)
