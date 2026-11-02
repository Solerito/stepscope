# StepScope: plan técnico

Visualizador interactivo de algoritmos y estructuras de datos. Un microscopio, no un curso.

## Contexto

Los visualizadores actuales traen unos pocos algoritmos cerrados, no aceptan entrada propia y no se pueden extender. StepScope quiere lo contrario: entrada del usuario, que añadir un algoritmo sea crear un archivo y, como meta final, 55 piezas de catálogo. El repositorio está vacío; este plan parte de cero.

**Alcance comprometido de la v1: F1 + F3 + F4.** Toda la ordenación y la búsqueda, Fibonacci con memo y el modo comparación, publicados en producción. El resto es ampliación opcional: mejor algo terminado que 55 algoritmos a medias. El proyecto se enseñará en entrevistas, sin fecha fija.

| Dato | Valor |
|---|---|
| Nombre | StepScope (`stepscope` en rutas y URL) |
| Ruta local | `C:\Users\usole\source\repos\stepscope` |
| Producción | `https://stepscope.vercel.app` (subdominio libre a 2026-11-02) |
| Remoto | `https://github.com/Solerito/stepscope.git` |
| Nota del vault | `proyectos/stepscope.md` |

Hay 5 repositorios pequeños con ese nombre en GitHub, ninguno es un visualizador de algoritmos. El paquete `stepscope` existe en npm, pero no afecta: este proyecto es `private` y no se publica allí.

Decisiones tomadas contigo:

- **Instrumentación:** dos funciones por archivo (la que se muestra y la instrumentada), verificadas entre sí por tests.
- **Código mostrado:** TypeScript real, ejecutable por los tests.
- **Idioma de la v1:** español en interfaz y explicaciones; identificadores del código en inglés.
- **Despliegue:** Vercel al hacer push; GitHub Actions solo para CI; `main` protegida.
- **Orden:** F1 → F3 → F4 y, si se amplía, F2 → resto.
- **Git:** los commits, push, ramas y PR los haces tú. Claude solo ejecuta `git init` y deja los cambios en el árbol de trabajo.
- El resto de respuestas está en §7.

### Qué está comprobado y qué no

Este plan no se apoya en intuiciones cuando se podía medir. Todo se hizo en memoria o en un perfil temporal, sin tocar el repositorio.

| Comprobación | Resultado |
|---|---|
| Bloques de código de §2 y §4 | Se extraen de este mismo documento y compilan en `strict` con TS 6.0.3 |
| Trazas de los ejemplos | Ejecutadas sobre 346 entradas: deterministas, mismo resultado que el código mostrado, `seek` aleatorio = recorrido secuencial, líneas fieles al código mostrado |
| Poder de detección de los tests | Tres divergencias introducidas a propósito, las tres detectadas |
| Bugs que encontró esta verificación | Dos reales en el cursor de `seek` (§2.4), corregidos antes de redactar |
| Estrategias de memoria | Medidas con prototipo en Node 24 (§1.4) |
| SVG, DOM, Canvas y React | Medidos en Chrome 156 headless con la GPU de tu portátil, con y sin CPU ×4 (§1.5) |
| Versiones y compatibilidad | Consultadas en npm hoy; `npm install --dry-run` del stack completo resuelve sin conflictos |

**Sin comprobar, y dónde se comprueba:**

- **Safari e iPhone reales.** CPU ×4 aproxima un móvil medio, pero no sustituye a uno: throttling de CPU, no de GPU, y motor Blink, no WebKit. Es la condición de salida de la Fase 1. Medido el 2026-11-02 en un iPhone: 59 fps en todos los casos y 1 ms al arrastrar.
- **Las cifras de §1.4 y §1.5** vienen de los prototipos previos a la Fase 1. La implementación real se mide en `#/bench`: en este portátil, 60 fps en los tres casos y arrastre de la barra en 0,2 ms sobre una traza sintética de 100 000 frames (34,1 MB).

**Confirmado en la Fase 1:** TS 7 compila todo con `tsc -b`, y el bundle inicial son 101 kB comprimidos, muy por debajo de los 250 kB estimados. En F4, con la comparación, son 119 kB, y CI impone un presupuesto de 140 kB.

---

## 1. Resumen y decisiones de arquitectura

### 1.1 La propuesta

Cada algoritmo es una función pura `trace(entrada) → traza`. La traza es una secuencia de frames con todo lo necesario para pintar un instante: estructuras, línea activa, variables, explicación y contadores. Se genera entera en un worker, viaja al hilo principal como bytes y se decodifica bajo demanda. El reproductor convierte cada frame en una escena de primitivas con identidad estable, interpola entre dos escenas y la pinta en SVG o Canvas. No sabe qué algoritmo está mostrando.

```
 *.algo.ts ──► Worker: trace(input) ──► EncodedTrace ──(transferencia sin copia)──┐
                                                                                  ▼
 Renderer ◄── interpolate(escena i, escena i+1, t) ◄── view.build(frame) ◄── cursor.seek(i)
 SVG / Canvas                                                                     │
                                       React (código, variables, contadores) ◄────┘
```

Todo lo visual es función pura de dos números: el frame `i` y el progreso `t` de la transición. Ahí está el valor de la arquitectura: retroceder, saltar, arrastrar, interrumpir una animación a medias o desactivarla no son casos especiales.

### 1.2 Decisiones

| # | Decisión | Elegido | Descartado y por qué |
|---|---|---|---|
| D1 | Quién anima | La traza es el contrato; el reproductor es agnóstico | **Algoritmo que anima:** sin retroceso ni tests deterministas. **Generadores con `yield` perezoso:** `yield*` ensucia la recursión, la barra de progreso no conoce el total y retroceder obliga a guardar los frames igualmente |
| D2 | Instrumentación | Dos funciones en un archivo, verificadas por tests | **Plugin que instrumenta por AST:** compilador propio, subconjunto de JS, un frame por sentencia. **Proxy sobre arrays:** no ve comparaciones ni líneas, y pierde la identidad de los valores |
| D3 | Frame → línea | Anclas con nombre en comentarios | **Números de línea a mano:** se rompen al editar. **`Error().stack`:** lento y roto al minificar |
| D4 | Memoria | Deltas + keyframes adaptativos, codificados en bytes, con columnas tipadas | **Estado completo:** 574 MB con solo 5 919 frames. **Compartición estructural:** copia arrays que crecen. **Objetos JS:** ver §1.4 |
| D5 | Dónde se genera | Web Worker, cancelable | **Hilo principal:** una entrada grande congela la interfaz |
| D6 | Pintado | Capa de escena; SVG imperativo por defecto, Canvas con repintado parcial en vistas densas | **React en el camino caliente, Canvas para todo, WebGL/Pixi, DOM con `transform`:** ver §1.5 |
| D7 | Animación | `f(i, t)` propia, sin librería en la visualización | **Motion, GSAP, react-spring, transiciones de D3:** ver §1.6 |
| D8 | Significado visual | Roles cerrados; un algoritmo no puede emitir un color | **Colores en la traza:** imposibilitan garantizar accesibilidad |
| D9 | Identidad | IDs estables por elemento; disposición calculada conociendo la traza entera | **Posiciones recalculadas por frame sin identidad:** los duplicados saltan y los árboles tiemblan |
| D10 | Estructuras de datos | La entrada es una lista de operaciones; cada operación añadida regenera la traza | **Mutación en vivo:** rompe el determinismo y la URL |
| D11 | Granularidad *(propuesta mía)* | Cada frame tiene nivel: hito, paso o detalle | **Una sola granularidad:** Floyd-Warshall n=50 son 125 000 frames, inmanejables si no se puede ver a menos aumentos |

### 1.3 Instrumentación sin ensuciar el código

Cada archivo contiene dos funciones que hacen lo mismo:

- **La función mostrada** es código de libro, sin una sola llamada a la traza. Solo lleva comentarios `// @ancla`, que se retiran al mostrarla.
- **La función instrumentada** usa `t.*`. Aquí sí se decide qué merece un frame, qué se marca y qué se explica.

Duplicar tiene un riesgo: que lo mostrado y lo ejecutado diverjan, y un microscopio que miente es peor que no tenerlo. Cuatro comprobaciones automáticas lo cubren, sin escribir nada por algoritmo:

| Divergencia | Test que la detecta |
|---|---|
| Errata en un ancla | No compila: `t` es `Tracer<'outer' \| 'key' \| …>` |
| Ancla sin comentario, o comentario sin ancla | Las anclas declaradas deben coincidir con los comentarios |
| Mismos pasos, distinto resultado | `reference(input)` debe ser igual al resultado de la traza, en entradas aleatorias |
| La traza apunta a líneas en un orden imposible | **Test de fidelidad:** la secuencia de líneas de la traza debe ser subsecuencia de las líneas que ejecuta de verdad el código mostrado |

El test de fidelidad es la pieza clave y es solo de test. Un plugin de Vitest inserta `__hit(línea)` en la región mostrada mediante `acorn`, y al ejecutar `reference` se obtiene la secuencia real de líneas. No afecta a producción. Lo he prototipado: detecta un ancla equivocada en una traza cuyo resultado sigue siendo correcto, que es justo lo que los demás tests no verían.

La autoinstrumentación por AST queda abierta para el futuro: la traza no sabe quién la produjo, así que sería otro productor sin tocar el reproductor.

### 1.4 Memoria: deltas + keyframes en bytes

Una ejecución puede generar decenas de miles de frames. Medido con cuatro estrategias:

| Caso | Frames | Estado completo | Compartición estructural | Deltas + keyframes, objetos JS | **Deltas + keyframes, bytes** |
|---|---:|---:|---:|---:|---:|
| Burbuja n=100, inverso | 9 900 | 66 MB | 9 MB | 8 MB | **1,1 MB** |
| Floyd-Warshall n=30 | 27 000 | 246 MB | 17 MB | 17,5 MB | **2,7 MB** |
| Floyd-Warshall n=50 | 125 000 | ~2,5 GB (estimado) | 81 MB | 81 MB | **12,7 MB** |
| fib(15) | 5 919 | 574 MB | 41 MB | 5,6 MB | **1,1 MB** |
| fib(20) | 65 673 | no viable | no viable | 94 MB | **26,3 MB** |

Tres conclusiones que no eran evidentes:

1. **El estado completo falla antes de lo esperado.** fib(15) es una entrada pequeña, pero el árbol de llamadas crece con cada frame y se copia entero.
2. **La mayor parte del coste no es el estado, sino los objetos JS de cada frame:** unos 650 bytes por frame en objetos frente a unos 100 en bytes.
3. **Cruzar del worker al hilo principal bloquea.** Clonar la traza de Floyd-Warshall n=50 como objetos cuesta 335 ms con la interfaz congelada, y fib(20) 595 ms. Como bytes se transfiere sin copia.

**La regla de los keyframes.** Cada frame acumula un peso de `1 + nº de operaciones de su delta`. El segmento se cierra y se guarda un keyframe cuando sus deltas ya ocupan tantos bytes como el keyframe, con un peso mínimo de 256 y un máximo de 4 096. Así, los keyframes nunca ocupan más que los deltas (hasta el tope), y reconstruir un frame cuesta como mucho copiar un keyframe más 4 096 pasos. No hay un intervalo fijo que afinar por algoritmo.

**Latencia de `seek` medida** (presupuesto de un frame a 60 Hz: 16,6 ms):

| Caso | Salto aleatorio p50 / p99 / máx. | Paso atrás p99 | Arrastre de la barra p99 |
|---|---:|---:|---:|
| Burbuja n=100 | 0,06 / 0,3 / 0,5 ms | 0,03 ms | 0,07 ms |
| Floyd-Warshall n=50 | 0,5 / 9,4 / 12,6 ms | 0,03 ms | 0,09 ms |
| fib(20) | 3,1 / 13 / 18,8 ms | 5,4 ms | 1,7 ms |

Sin deltas inversos: retroceder con keyframes ya es lo bastante rápido, y evita duplicar el tamaño de la traza. Medido en Node sobre el portátil; en móvil habrá que multiplicar, por eso la Fase 1 lo mide allí.

**Por qué columnas tipadas aparte.** Ancla, nivel, fase y contadores van en `Uint16Array`/`Uint32Array`, con acceso O(1) sin decodificar nada. Eso permite que el modo comparación busque por coste, que un paso de granularidad encuentre el siguiente hito y que el fingerprint se calcule sin tocar los segmentos.

### 1.5 Renderizado: SVG, Canvas o mezcla

Se suele dar por hecho que SVG se ahoga con cientos de elementos. En esta carga de trabajo, los datos no lo confirman.

**Coste en hilo principal por frame, en ms** (cada elemento es caja + etiqueta; ventana 1280×800 @2x; presupuesto 16,6 ms; ×4 = CPU ralentizada, aproximación a un móvil medio):

| Elementos | SVG, todos se mueven | SVG, 4 se mueven | Canvas, repinta todo | DOM + `transform`, todos |
|---:|---:|---:|---:|---:|
| 100 | 1,0 / 4,1 | 0,5 / 1,7 | 1,0 / 3,1 | 1,8 / 5,2 |
| 300 | 1,8 / 10,2 | 1,3 / 3,6 | 1,9 / 6,5 | 4,5 / 11,8 |
| 1 000 | 6,5 / **21,1** | 2,7 / 7,6 | 4,6 / **20,1** | 8,9 / **42,7** |
| 3 000 | **19,7** / **113,7** | 7,6 / **27,4** | 9,5 / **41,4** | **29,3** / **168,4** |
| 10 000 | n/m | **24,6** / **109,9** | **22,5** / **122,5** | n/m |

Formato: CPU ×1 / CPU ×4. En negrita, por encima del presupuesto. n/m = no medido. Las cifras varían entre tandas (SVG con 1 000 elementos a CPU ×4 dio 21 y 27 ms en dos ejecuciones): tómalas como orden de magnitud, no como valores exactos.

**Canvas con estrategias específicas** (ms, ×1 / ×4):

| Variante | 2 500 | 5 000 | 20 000 |
|---|---:|---:|---:|
| Repintado total con texto | 7,0 / **28,0** | | |
| **Repintado parcial** (solo lo que cambia) | 0,5 / 2,3 | | 0,9 / 5,3 |
| Sin texto (nivel de detalle bajo), repinta todo | | 3,1 / **17,8** | 12,6 / **65,6** |

**React en el camino caliente** (CPU ×4, hilo principal):

| Elementos y caso | SVG imperativo | React normal | React + `memo` |
|---|---:|---:|---:|
| 300, todos se mueven | 9,3 | 11,7 | 12,5 |
| 300, 4 se mueven | 4,0 | 7,9 | 4,9 |
| 1 000, todos se mueven | **27,1** | **37,2** | **38,8** |
| 1 000, 4 se mueven | 9,5 | **17,7** | 10,2 |

**Qué se deduce:**

1. **A los tamaños del catálogo cabe cualquier opción.** Un array de 100 o un grafo de 50 nodos no deciden nada. El rendimiento manda solo en tres sitios: árboles de llamadas grandes, matrices densas y modo comparación.
2. **La variable que importa es cuántos elementos cambian, no cuántos hay.** El coste de SVG sigue a los cambios; el de un Canvas ingenuo sigue al total. Una animación típica mueve pocos elementos, y por eso SVG aguanta hasta 3 000 en portátil.
3. **Canvas solo gana claramente con repintado parcial.** Sin él, a 1 000 elementos y CPU ×4 cuesta más que SVG con pocos cambios (20,1 frente a 7,6 ms).
4. **El peor caso real del catálogo mueve unos 250 elementos:** una rotación que recoloca todo un AVL de 127 nodos. Queda dentro del presupuesto incluso a CPU ×4 (unos 10 ms a 300).

**Decisión: una capa de escena con dos pintores.**

- Las vistas son funciones puras `estado → Scene`, una lista de primitivas con ID. No saben quién las pinta.
- **SVG por defecto, hasta 1 000 primitivas visibles.** Texto nítido, inspeccionable en DevTools, clic directo sobre un nodo y exportable.
- **Canvas con repintado parcial y nivel de detalle por encima.** Árboles de llamadas grandes y matrices como Floyd-Warshall. El pintor se elige por traza con el tamaño máximo previsto, para que no cambie a mitad de ejecución.

**En la v1 solo hay SVG.** Ningún algoritmo de F1, F3 o F4 pasa de las 1 000 primitivas: 100 barras más el árbol de llamadas de mergesort son unas 500. El pintor Canvas se construye con la primera vista que lo necesite, ya en la ampliación; la interfaz `Renderer` queda preparada desde el principio.

**Sobre el SVG imperativo, siendo honesto:** los datos no obligan a evitar React. A ≤ 300 elementos la diferencia es despreciable, y `memo` casi la borra en el caso típico. Lo elijo por otras razones: el mismo `paint(scene)` sirve para SVG y Canvas, lo que deja un solo camino de pintado; da más margen en el peor caso (27 frente a 39 ms); y no asigna un árbol virtual 60 veces por segundo. Cuesta unas 100 líneas de DOM con claves. React sigue a cargo de todo lo demás.

**Descartados:**

- **DOM + `transform`:** el peor en todos los casos medidos en los que se mueven todos.
- **Canvas para todo:** renuncia a inspección, clic y texto nítido sin ganar nada a estos tamaños.
- **WebGL/Pixi:** un motor entero y texto difícil, cuando Canvas parcial da 5,3 ms con 20 000 elementos a CPU ×4.

**El coste de Canvas, asumido donde se usa:** sin DOM no hay semántica. La alternativa accesible es la misma que para SVG: la explicación en región `aria-live` y una vista en tabla del estado actual. Un `<rect>` tampoco se entiende con lector de pantalla.

### 1.6 Animación: sin librería en la visualización

Motion, GSAP y react-spring son excelentes para lo que hacen: gestionan el tiempo por ti, con estado interno por elemento. Aquí eso es justo el problema, porque **el tiempo es del reproductor**.

```ts
scene(i, t) = interpolate(build(frame[i]), build(frame[i + 1]), ease(t))
```

| Situación | Con esta función | Con una librería de tweens |
|---|---|---|
| Arrastrar la barra | `t = 1`, salto directo | Cancelar y resincronizar tweens en curso |
| Interrumpir a mitad de transición | Nada que hacer: no hay estado | Fuente clásica de desincronización |
| Ir hacia atrás | Misma función con `i` decreciente | Reconstruir la animación inversa |
| `prefers-reduced-motion` | `t = 1` siempre | Rama aparte |
| Modo comparación | Dos `(i, t)` del mismo reloj | Dos líneas de tiempo que coordinar |
| Pintar en Canvas | Funciona igual | No aplica a elementos sin DOM |
| Test | Función pura | Requiere reloj falso y navegador |

Reglas de la interpolación:

- Las cajas se interpolan por ID en posición y tamaño.
- Una caja nueva entra desde `enterFrom` si lo tiene o escalando desde su centro; la que desaparece sale con fundido.
- El rol cambia al inicio de la transición: primero se resalta y luego se mueve.
- Los enlaces no guardan coordenadas, sino los ID de sus extremos, así que siguen a los nodos durante una rotación sin código especial.

Por encima de unos 30 frames/s no hay transición, y por encima de la frecuencia de pantalla se pinta solo el último frame de cada tick. Los paneles de React se actualizan a un máximo de 20 Hz durante la reproducción y con precisión al pausar.

Para los paneles basta CSS. No hace falta ninguna librería de animación en el proyecto.

### 1.7 Visualización de la recursión

Las tres vistas no se sincronizan entre sí: todas son función del mismo frame, así que no pueden desincronizarse.

```
┌ Código ───────────────────┬ Árbol de llamadas ────────────────┐
│   function fib(n, memo) { │              fib(5)               │
│ ▼ LLAMADA                 │            ╱        ╲             │
│ ▶ if (memo.has(n)) ...    │       fib(4)        ⧉ fib(3) = 2  │
│   if (n <= 1) return n;   │       ╱    ╲        ya calculado  │
│   const a = fib(n - 1...  │  fib(3)    ⧉ fib(2)    −4 llamadas│
├ Pila ─────────────────────┤   ╱   ╲                           │
│ ▌fib(3)   n=3   ← activa  │ …     …                           │
│  fib(4)   n=4             │    Llamadas: 9                    │
│  fib(5)   n=5             │    Sin memoizar serían: 15        │
├───────────────────────────┴───────────────────────────────────┤
│ ▼ Llamo a fib(3)                                              │
│ ⏮ ◀ ▶ ▶▶ ⏭  ━━━━━●━━━━━━━━━━━  paso 12 / 37   velocidad ▾     │
└───────────────────────────────────────────────────────────────┘
```

**Bajar y subir se distinguen sin depender del color.** Etiqueta (`LLAMADA`, `RETORNO`, `MEMO`, `PODA`), glifo (▼ ▲ ⧉ ✂) y posición en el margen del código. La explicación repite el glifo.

**Estado de cada nodo del árbol**, con forma además de color:

| Estado | Forma |
|---|---|
| Activo | Anillo grueso |
| En espera | Borde discontinuo |
| Terminado | Borde sólido con el valor devuelto |
| Memo | Borde doble, glifo ⧉ y sin hijos |
| Podado | Trama diagonal y aspa |

**Los valores suben por las ramas sin código especial.** El valor devuelto es una primitiva de la escena que entra con `enterFrom` en el hijo y termina en el padre: la interpolación hace el resto, también hacia atrás.

**La disposición del árbol se calcula con el árbol final**, que se conoce porque la traza es completa. Los nodos ya dibujados no se mueven al expandirse el árbol: solo aparecen nodos nuevos. Es una ventaja directa de no generar frames en vivo.

**Por qué se ahorra trabajo, de un vistazo** *(propuesta mía)*. `t.memoHit` calcula de forma genérica cuántas llamadas se habría hecho sin memoizar, usando el tamaño del subárbol de la primera llamada con esos argumentos, sin ejecutar nada más. Comprobado contra la fórmula exacta: fib(6) son 11 llamadas frente a 25 sin memo, y fib(40) 79 frente a 331 160 281.

**En la v1:** Fibonacci con memo, mergesort y quicksort se ven con las tres vistas, con árboles de unos 200 nodos como máximo.

**A gran escala (F2, fuera de la v1):** por encima de unos 500 nodos el árbol pasa a Canvas, con cámara que sigue al nodo activo, zoom con rueda o pellizco y subárboles terminados colapsables.

### 1.8 Interfaz: cómo se cumple cada requisito

| Requisito | Solución |
|---|---|
| Reproductor | Play, pausa, paso ±1, inicio, fin, velocidad de 0,5 a 1 200 frames/s y barra arrastrable (`<input type="range">`, accesible y táctil sin más). Velocidad inicial: la que recorre la traza en unos 20 s |
| Granularidad *(propuesta mía)* | Selector hito / paso / detalle: los botones saltan al siguiente frame de ese nivel. Es el «paso a paso por procedimiento» de un depurador |
| Capítulos *(propuesta mía)* | Marcas en la barra por operación o por pasada externa |
| Paneles | Visualización, código con línea resaltada, variables (destaca las que acaban de cambiar), explicación, contadores |
| Punteros `i`, `j`, `lo`, `hi` | La vista los lee de las variables vivas: `bars('a', { pointers: ['i', 'j'] })`, sin instrumentación extra |
| Entrada | Campo de texto validado, ejemplos del algoritmo y generadores: aleatorio, ordenado, inverso, duplicados. Una nueva entrada cancela el worker anterior |
| Comparación | Dos reproductores con un reloj que avanza por operaciones: un tick = una comparación, escritura o llamada, con búsqueda binaria sobre la columna de coste. Así un frame de más en un algoritmo no lo hace parecer lento |
| Complejidad | Mejor, medio y peor caso, más el contador real junto al valor teórico para esa entrada (`expected.at(input)`) |
| Compartir | URL legible: `#/insertion-sort?values=5,2,4,6,1,3&f=12&fp=2r6f8`. Con hash, sin límites del servidor ni configuración en el hosting. Comprimida con `CompressionStream` si supera 1,5 kB |
| Enlaces estables | `fp` es el fingerprint de la traza. Si el algoritmo cambió desde que se compartió, se abre igualmente y se avisa de que el paso es aproximado. Sin versiones manuales |
| `prefers-reduced-motion` | `t = 1` siempre y sin transiciones CSS. La reproducción sigue funcionando, en pasos discretos |
| Teclado | `←` `→` paso, `Mayús+←` `→` hito, `Inicio` `Fin`, `Espacio` play, `+` `-` velocidad, `G` granularidad, `?` ayuda. Inactivos con el foco en un campo de texto |
| Lector de pantalla | Explicación en `aria-live` solo al pausar o avanzar a mano, `aria-valuetext` en la barra, vista en tabla del estado |
| Daltonismo | Cada rol define etiqueta, glifo y patrón además del color, en un `Record<Role, RoleStyle>` que TS obliga a completar. Un test exige que no haya dos roles con igual glifo y patrón. La leyenda se genera con los roles que aparecen en la traza |
| Móvil | Visualización arriba, explicación, transporte fijo abajo y pestañas (Código, Variables, Contadores, Entrada). En recursión: Árbol, Pila, Código. Comparación apilada. Dianas de 44 px, sin información solo en hover |
| Estructuras de datos | Consola de operaciones: `insert 7` se añade a la lista, la traza se regenera y se salta al primer frame nuevo. Cada operación es un capítulo. La URL guarda la lista |
| Sin backend | Sitio estático en Vercel con `base: '/'`. Las rutas con hash evitan configurar reescrituras: el servidor siempre sirve `index.html` |

### 1.9 Límites recomendados

Las cifras de ordenación y recursión salen de ejecutar cada algoritmo y contar sus frames. Las de grafos, PD, laberinto y árboles son cotas analíticas, sin ejecutar todavía: el test de límites las confirmará en su fase. En la v1 solo aplican ordenación, búsqueda y Fibonacci con memo.

| Familia | Límite de entrada | Peor caso en frames | Pintor | Motivo |
|---|---|---:|---|---|
| Ordenación | n ≤ 100 | 10 297 (quicksort, último pivote, ya ordenado) | SVG | Un array mayor deja de leerse, no de pintarse |
| Búsqueda | n ≤ 200 | < 1 000 | SVG | |
| Fibonacci sin memo | n ≤ 20 | 65 673 | SVG hasta n=12, luego Canvas | n=22 ocupa 150 MB |
| Fibonacci con memo | n ≤ 40 | 275 | SVG | Es lineal. El contador de 32 bits de llamadas ahorradas aguanta hasta n=45 |
| Hanoi | ≤ 12 discos | 20 477 | Varillas SVG, árbol Canvas | |
| N reinas | Todas: n ≤ 8. Primera solución: n ≤ 12 | 50 866 / 12 279 | Tablero SVG, árbol Canvas | n=10, todas: 1,4 M de frames |
| Permutaciones | n ≤ 7 | 27 400 | Canvas | n=8: 219 202 |
| Subconjuntos | n ≤ 12 | 16 382 | Canvas | |
| Sudoku | Sin límite de tablero, con presupuesto | Fácil: 37 652 intentos. Difícil: más de 30 M | Tablero SVG | Es el caso que justifica truncar con aviso |
| Laberinto | ≤ 25×25 | ~2 500 | SVG | |
| Grafos | V ≤ 50, E ≤ 150 | 15 000 (Bellman-Ford) | SVG | Por encima, un grafo deja de leerse |
| Floyd-Warshall | V ≤ 50 | 125 000 | SVG hasta V=30, luego Canvas | Con V=50 se ve por hitos y mejoras |
| Tablas de PD | ≤ 30×30 | ~1 800 | SVG | Con flechas por celda, más no se lee |
| Árboles (BST, AVL, RN) | ≤ 127 nodos | < 5 000 | SVG | Peor animación: ~250 primitivas en movimiento |

**Presupuesto por traza:** 250 000 frames y 64 MB desde F1; si se supera, se trunca con un aviso visible. En la v1 no debería ocurrir: su peor caso contado son 10 297 frames. F2 añade 5 s de tiempo y la regeneración a menos detalle (sin frames de detalle y, si no basta, solo hitos), que es cuando empieza a hacer falta. Cada algoritmo declara límites que un test verifica con la entrada máxima y el peor generador.

**Modo comparación:** mismos límites. Son dos reproductores, así que el coste se duplica; a estos tamaños hay margen de sobra según las medidas de §1.5.

### 1.10 Stack

Versiones consultadas en npm el 2026-11-01.

| Pieza | Elección | Por qué |
|---|---|---|
| Lenguaje | TypeScript `~7.0.2`, `strict` | El port nativo: comprobación de tipos muy rápida. Es también lo que instala hoy la plantilla oficial de Vite |
| UI | React 19.3 | Tu preferencia. Solo paneles: fuera del camino caliente |
| Build | Vite 8 con `@vitejs/plugin-react` 6 | `import.meta.glob` hace gratis el registro de algoritmos, y los workers funcionan sin configuración |
| Estado | Zustand 5, un store por reproductor | Lo conoces de Room8, pesa poco y permite suscripción selectiva. Dos reproductores = dos stores |
| Lint y formato | Biome 2 | Una dependencia y sin configuraciones cruzadas. Tiene reglas de accesibilidad, hooks y `noRestrictedImports` para las capas |
| Tests | Vitest 5, fast-check 4, Playwright, axe | §8 |
| Resaltado de código | `sugar-high` | Solo hace falta TS, y es diminuto frente a Shiki. Se resalta una vez por algoritmo; la línea activa es una clase CSS |
| Enrutado | Propio, unas 40 líneas | Tres rutas sin anidar, y la sincronización con la URL es a medida igualmente |
| Componentes | Nativos: `<input type="range">`, `<select>`, `<dialog>` | Accesibles por defecto. Radix solo si algo no da la talla |
| CSS | CSS Modules + tokens en variables CSS | Sin runtime; Canvas lee los mismos tokens |
| Despliegue | Vercel, al hacer push; `base: '/'` | Deploy preview por rama con URL estable: se prueba en el iPhone antes de fusionar |
| CI | GitHub Actions: lint, tipos, tests, build, presupuesto del bundle y E2E | No despliega, así que CI y despliegue quedan desacoplados: Vercel publicaría cualquier push a `main` aunque fallen los tests. Por eso `main` se protege y solo acepta PRs en verde (§9) |
| Gestor de paquetes | npm | `pnpm` está roto en tu máquina (`error: CommandNotFound`) |

**Una trampa de compatibilidad, resuelta.** `typescript-eslint` 8.72 exige `typescript <6.1.0`, TS 7 ya no expone la API clásica del compilador y `eslint-plugin-jsx-a11y` llega solo hasta ESLint 9. Con Biome ninguna herramienta depende de esa API, y TS 7 queda libre. Si TS 7 diera problemas, volver a `typescript@6` es cambiar una línea. Por la misma razón, el plugin de fidelidad usa `acorn` y `node:module`, no la API de TS.

**Dos configuraciones de TypeScript.** `noUncheckedIndexedAccess` obligaría a escribir `a[j]!` en el código que ve el usuario: el compilador da 5 errores en el ejemplo de inserción con ese flag activo. Va activo en `tsconfig.app.json` (todo salvo algoritmos) e inactivo en `tsconfig.algorithms.json`. Ambos con `strict`, `exactOptionalPropertyTypes` y `erasableSyntaxOnly`.

---

## 2. Modelo de datos

### 2.1 El frame y el estado

```ts
// file: src/core/trace/types.ts
/** Solo valores JSON: una traza tiene que poder serializarse, transferirse y exportarse. */
export type Scalar = number | string | boolean | null;
export type VarValue = Scalar | readonly Scalar[];

/** Identidad estable de un elemento visual durante toda la traza. Es lo que permite animar. */
export type ItemId = number;
export type StructureId = string;
export type CallId = number;

/** Lo único que un algoritmo puede decir sobre el aspecto de algo. Nunca un color. */
export const ROLES = [
  'active',
  'compare',
  'write',
  'swap',
  'pivot',
  'min',
  'sorted',
  'visited',
  'frontier',
  'path',
  'discarded',
  'waiting',
  'done',
  'base-case',
  'memo-hit',
  'pruned',
  'returned',
  'conflict',
  'rb-red',
  'rb-black',
] as const;
export type Role = (typeof ROLES)[number];

/** 0 = hito, 1 = paso, 2 = detalle. Permite ver la traza a distintos aumentos. */
export type Level = 0 | 1 | 2;

/** Qué está pasando en términos de control de flujo. La vista de código lo muestra con forma y texto. */
export const PHASES = ['step', 'call', 'return', 'memo-hit', 'prune'] as const;
export type Phase = (typeof PHASES)[number];

export const COUNTER_NAMES = ['comparisons', 'swaps', 'reads', 'writes', 'calls', 'savedCalls'] as const;
export type CounterName = (typeof COUNTER_NAMES)[number];
export type Counters = Readonly<Record<CounterName, number>>;

// ─── Estructuras: vocabulario cerrado que el reproductor sabe pintar ───────────

export interface Cell {
  id: ItemId;
  value: Scalar;
  role?: Role;
}

/** null = hueco reservado sin usar (capacidad del array dinámico, huecos de direccionamiento abierto). */
export interface ArrayState {
  kind: 'array';
  cells: (Cell | null)[];
}

/** Tablas de PD, matrices de adyacencia, tableros (reinas, sudoku, laberinto). `roles` es disperso: "fila,col". */
export interface TableState {
  kind: 'table';
  rows: number;
  cols: number;
  cells: Scalar[][];
  roles: Record<string, Role>;
  rowLabels?: readonly string[];
  colLabels?: readonly string[];
}

/** BST, AVL, rojo-negro, heap, trie (n-ario con `edgeLabel`), bosque de Union-Find (varias raíces). */
export interface TreeNode {
  id: ItemId;
  label: Scalar;
  children: (ItemId | null)[];
  edgeLabel?: string;
  role?: Role;
  badge?: string;
}
export interface TreeState {
  kind: 'tree';
  roots: ItemId[];
  nodes: Record<ItemId, TreeNode>;
}

/** Posiciones normalizadas en [0, 1]: las fija la entrada y son deterministas. */
export interface GraphNode {
  id: ItemId;
  label: string;
  x: number;
  y: number;
  role?: Role;
  badge?: string;
}
export interface GraphEdge {
  id: ItemId;
  from: ItemId;
  to: ItemId;
  weight?: number;
  role?: Role;
}
export interface GraphState {
  kind: 'graph';
  directed: boolean;
  nodes: Record<ItemId, GraphNode>;
  edges: Record<ItemId, GraphEdge>;
}

export interface ListNode {
  id: ItemId;
  value: Scalar;
  next: ItemId | null;
  prev?: ItemId | null;
  role?: Role;
}
export interface ListState {
  kind: 'list';
  variant: 'singly' | 'doubly' | 'circular';
  head: ItemId | null;
  nodes: Record<ItemId, ListNode>;
}

/** Tabla hash con encadenamiento, cubetas de radix sort, varillas de Hanoi. */
export interface BucketsState {
  kind: 'buckets';
  buckets: Cell[][];
  labels?: readonly string[];
}

export type Structure = ArrayState | TableState | TreeState | GraphState | ListState | BucketsState;

// ─── Recursión ─────────────────────────────────────────────────────────────────

export type CallStatus = 'active' | 'waiting' | 'done' | 'memo-hit' | 'pruned';

/** Marco de la pila. `stack[0]` es siempre el ámbito global: los algoritmos iterativos viven ahí. */
export interface CallFrame {
  id: CallId;
  fn: string;
  args: Record<string, Scalar>;
  vars: Record<string, VarValue>;
}

/** Nodo del árbol de llamadas. Solo crece: nunca se borra, así que `calls[id]` es acceso directo. */
export interface CallNode {
  id: CallId;
  parent: CallId | null;
  fn: string;
  args: Record<string, Scalar>;
  status: CallStatus;
  ret?: Scalar;
  /** En un acierto de memo: llamadas que se habrían hecho sin memoizar. */
  saved?: number;
}

/** Estado acumulado. Es lo que se reconstruye con keyframes + deltas. */
export interface TraceState {
  structures: Record<StructureId, Structure>;
  stack: CallFrame[];
  calls: CallNode[];
}

// ─── Anotaciones efímeras: valen para un único frame y no entran en el estado ──

export type Mark =
  | { s: StructureId; item: ItemId; role: Role; label?: string }
  | { s: StructureId; cell: readonly [row: number, col: number]; role: Role; label?: string };

/** Flecha de dependencia entre celdas de una tabla (PD). */
export interface Arrow {
  s: StructureId;
  from: readonly [row: number, col: number];
  to: readonly [row: number, col: number];
  label?: string;
}

// ─── El frame: lo que recibe el reproductor ────────────────────────────────────

export interface Frame {
  readonly index: number;
  /** Ancla de código activa; la línea se resuelve con `source.lineOf[anchor]`. */
  readonly anchor: string | null;
  readonly level: Level;
  readonly phase: Phase;
  /** Qué acaba de pasar, en una frase. */
  readonly explain: string;
  /** Acumulados hasta este frame incluido. */
  readonly counters: Counters;
  readonly marks: readonly Mark[];
  readonly arrows: readonly Arrow[];
  /**
   * Variables vivas: `state.stack.at(-1).vars`. Pila y árbol también viven aquí.
   * El cursor reutiliza este objeto entre seeks: quien quiera conservar algo, lo copia.
   */
  readonly state: Readonly<TraceState>;
}

// ─── Vistas: qué estructura se pinta y cómo. Una estructura admite varias ──────

/** Dónde va una vista y cuánto ocupa. Por defecto, la primera va a la platina y el resto al lateral. */
export interface ViewLayout {
  title?: string;
  place?: 'stage' | 'side';
  /** Altura relativa entre las vistas que comparten la platina. */
  weight?: number;
}
export interface SequenceViewSpec extends ViewLayout {
  view: 'bars' | 'cells' | 'stack' | 'queue' | 'heap-tree';
  structure: StructureId;
  /** Variables cuyo valor es un índice: se dibujan como flechas bajo el array. */
  pointers?: readonly string[];
  /** Solo `heap-tree`: variable con el tamaño del montículo; lo que queda fuera ya está ordenado. */
  heapSize?: string;
}
export interface StructureViewSpec extends ViewLayout {
  view:
    | 'table'
    | 'board'
    | 'tree'
    | 'graph'
    | 'adjacency-matrix'
    | 'adjacency-list'
    | 'list'
    | 'buckets'
    | 'pegs';
  structure: StructureId;
}
export interface RecursionViewSpec extends ViewLayout {
  view: 'call-tree' | 'call-stack';
}
export type ViewSpec = SequenceViewSpec | StructureViewSpec | RecursionViewSpec;

// ─── Almacenamiento: lo que realmente se guarda y viaja desde el worker ────────

export type Path = readonly (string | number)[];
/** Asignación si hay valor; borrado si no. Con esto se describe cualquier cambio de estado. */
export type DeltaOp = readonly [path: Path, value: unknown] | readonly [path: Path];
export type StoredFrame = readonly [
  explain: string,
  marks: readonly Mark[],
  arrows: readonly Arrow[],
  delta: readonly DeltaOp[],
];

export interface TraceHeader {
  readonly schema: 1;
  readonly algorithmId: string;
  readonly input: unknown;
  readonly frameCount: number;
  readonly anchors: readonly string[];
  readonly views: readonly ViewSpec[];
  /** Hitos de la barra de progreso: operación de una estructura, pasada de un bucle externo… */
  readonly chapters: readonly { readonly frame: number; readonly title: string }[];
  /** Roles que aparecen en la traza: de aquí sale la leyenda. */
  readonly roles: readonly Role[];
  readonly result: unknown;
  /** Hash de la secuencia de anclas y contadores. Detecta enlaces compartidos obsoletos. */
  readonly fingerprint: string;
  /** Nivel máximo que se llegó a emitir. Baja de 2 si la traza no cabía en el presupuesto. */
  readonly detail: Level;
  readonly truncated: null | 'frames' | 'bytes' | 'time';
}

export interface EncodedTrace {
  readonly header: TraceHeader;
  /** Columnas: una entrada por frame, acceso O(1) sin decodificar nada. */
  readonly anchor: Uint16Array;
  readonly level: Uint8Array;
  readonly phase: Uint8Array;
  /** frameCount × COUNTER_NAMES.length */
  readonly counters: Uint32Array;
  /** Frame cuyo estado guarda el keyframe de cada segmento; el primero es -1 (estado inicial). */
  readonly segmentStart: Int32Array;
  /** JSON en UTF-8: { key: TraceState, fr: StoredFrame[] }. Se decodifican bajo demanda. */
  readonly segments: readonly Uint8Array[];
}
```

### 2.2 La API del tracer

```ts
// file: src/core/tracer/types.ts
import type { Arrow, Level, Mark, Phase, Role, Scalar, StructureId, VarValue } from '../trace/types';

export interface StepOptions {
  /** Se fusionan en el ámbito actual. `undefined` retira la variable: ha dejado de estar viva. */
  vars?: Readonly<Record<string, VarValue | undefined>>;
  marks?: readonly Mark[];
  arrows?: readonly Arrow[];
  level?: Level;
  phase?: Phase;
}

/** Las mutaciones cuentan y registran el delta; solo `t.step` emite un frame. */
export interface TracedArray<T extends Scalar> {
  readonly id: StructureId;
  readonly length: number;
  /** Cuenta una lectura. */
  get(i: number): T;
  /** Lee sin contar: para escribir explicaciones. */
  peek(i: number): T;
  /** Cuenta una escritura. La celda conserva su identidad: la barra cambia de altura. */
  set(i: number, value: T): void;
  /** Cuenta 1 intercambio, 2 lecturas y 2 escrituras. Las identidades viajan: las barras se deslizan. */
  swap(i: number, j: number): void;
  /** Rol persistente: dura hasta que se cambie. */
  setRole(i: number, role: Role | null): void;
  /** Marca efímera para un `t.step`. */
  mark(i: number, role: Role, label?: string): Mark;
  toArray(): T[];
}

/** Cubetas (radix sort, tabla hash con encadenamiento). Cada elemento tiene identidad propia. */
export interface TracedBuckets<T extends Scalar> {
  readonly id: StructureId;
  readonly count: number;
  size(bucket: number): number;
  /** Añade al final del cubo. Cuenta una escritura. */
  push(bucket: number, value: T): void;
  /** Saca el primero del cubo. Cuenta una lectura. */
  shift(bucket: number): T;
  mark(bucket: number, index: number, role: Role, label?: string): Mark;
}

export interface RecursiveSpec<A extends string> {
  name: string;
  params: readonly string[];
  /** Ancla de la línea en la que se entra a la función. */
  enter: A;
}

/** `t.array('a', [0, 0])` debe dar un array de `number`, no del literal `0`. */
export type Widen<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends boolean
      ? boolean
      : T;

export interface Tracer<A extends string> {
  /** Emite un frame con el estado acumulado. Es la única forma de emitir fuera de `recursive`. */
  step(anchor: A, explain: string, options?: StepOptions): void;
  vars(values: Readonly<Record<string, VarValue | undefined>>): void;
  /** Abre un hito en la barra de progreso. Los invariantes se comprueban al cerrar cada uno. */
  chapter(title: string): void;
  /** Cuenta una comparación y devuelve el resultado, para usarlo en la condición. */
  compare(outcome: boolean): boolean;
  array<T extends Scalar>(id: StructureId, values: readonly T[]): TracedArray<Widen<T>>;
  buckets<T extends Scalar = number>(
    id: StructureId,
    count: number,
    labels?: readonly string[],
  ): TracedBuckets<Widen<T>>;

  /**
   * Envuelve una función recursiva: apila el marco, crea el nodo del árbol y emite el frame de
   * llamada. Toda salida debe pasar por `ret`, `memoHit` o `prune`, o el tracer lanza un error.
   */
  recursive<P extends readonly Scalar[], R extends Scalar>(
    spec: RecursiveSpec<A>,
    body: (...args: P) => R,
  ): (...args: P) => R;
  ret<R extends Scalar>(anchor: A, value: R, explain?: string): R;
  memoHit<R extends Scalar>(anchor: A, value: R, explain?: string): R;
  prune<R extends Scalar>(anchor: A, value: R, explain?: string): R;

  /** PRNG con semilla. `Math.random` está prohibido en un algoritmo. */
  random(): number;

  // Se añaden en su fase, con el mismo patrón que `array`:
  // table() (F2), graph() (F5), list() (F7), tree() (F8).
}
```

Solo se especifica lo que la Fase 1 necesita. Fijar ahora la API de `graph` o `tree` sería adivinarla: se diseña cuando haya algoritmos reales que la usen.

### 2.3 Del frame a la línea de código

1. El código mostrado lleva comentarios `// @ancla` al final de las líneas relevantes. Una línea puede tener varias anclas.
2. `anchors: [...]` en el archivo las declara, y eso da el tipo `A` con el que se comprueba cada `t.step('ancla', …)`.
3. Al abrir un algoritmo, `extractShown` recorta la región `//#region shown`, retira los comentarios y construye `lineOf`.
4. El frame guarda el ancla; la línea se resuelve al pintar: `source.lineOf[frame.anchor]`.

```ts
// file: src/core/source/extract.ts
export interface ShownSource {
  /** Texto que ve el usuario, sin anclas. */
  readonly code: string;
  /** Ancla → línea (empezando en 1) dentro de `code`. */
  readonly lineOf: Readonly<Record<string, number>>;
}

const REGION = /\/\/#region shown\r?\n([\s\S]*?)\r?\n\/\/#endregion/;
const ANCHORS = /\s*\/\/((?:\s*@[\w-]+)+)\s*$/;

export function extractShown(fileText: string): ShownSource {
  const region = REGION.exec(fileText)?.[1];
  if (region === undefined) throw new Error('Falta la región //#region shown');

  const lineOf: Record<string, number> = {};
  const code = region
    .split(/\r?\n/)
    .map((line, index) => {
      const match = ANCHORS.exec(line);
      if (!match) return line;
      for (const name of (match[1] ?? '').trim().split(/\s+/)) lineOf[name.slice(1)] = index + 1;
      return line.slice(0, match.index);
    })
    .join('\n');

  return { code, lineOf };
}
```

Guardar anclas en vez de números tiene una ventaja de regalo: la traza no depende del texto mostrado. Reformatear no invalida nada, y añadir otro lenguaje en el futuro sería otra región con las mismas anclas.

### 2.4 Cómo se reconstruye un frame

`TraceCursor.seek(i)`:

1. Busca por bisección el último segmento con `segmentStart < i`.
2. Lo decodifica si no está en la caché (3 segmentos, LRU).
3. Si el cursor ya está en ese segmento y no ha pasado de `i`, sigue desde donde estaba. Si no, copia el keyframe.
4. Aplica los deltas hasta `i`, **clonando los valores**.
5. Rellena ancla, nivel, fase y contadores desde las columnas.

Los dos bugs que encontró la verificación estaban aquí, y conviene dejarlos escritos:

- **Límite de segmento.** El keyframe guarda el estado *después* de `start`, pero los metadatos de ese frame están en el segmento anterior. La búsqueda debe usar `start < i`, no `<=`.
- **Aliasing.** Sin clonar en el paso 4, el estado de trabajo comparte objetos con el delta decodificado. Una operación posterior lo muta y una segunda pasada desde la caché reconstruye frames incorrectos. Solo se manifiesta al retroceder: el recorrido hacia delante funciona. El test «`seek` aleatorio = secuencial» lo detecta.

**Serialización.** `JSON.stringify` convierte `Infinity` en `null` sin avisar, y Dijkstra y Floyd-Warshall lo usan. El tracer normaliza los números no finitos a la cadena `'∞'`. Otro test universal exige que el estado sobreviva a un ciclo JSON.

### 2.5 Ejemplo real

Salida real de la traza de inserción sobre `[5, 2, 4]` (`L` = línea del código mostrado, `n` = nivel):

```
 #  L    n  array     variables               explicación
 0  L2   0  [5,2,4]   {i:1}                   La parte ordenada llega hasta a[0]; toca colocar a[1]
 1  L3   1  [5,2,4]   {i:1,key:2}             Guardo la clave 2
 2  L5   1  [5,2,4]   {i:1,key:2,j:0}         ¿a[0] = 5 > 2? Sí: hay que desplazarlo
 3  L6   1  [5,5,4]   {i:1,key:2,j:0}         Copio 5 a la posición 1
 4  L9   1  [2,5,4]   {i:1,key:2,j:-1}        Coloco la clave 2 en la posición 0
 5  L2   0  [2,5,4]   {i:2}                   La parte ordenada llega hasta a[1]; toca colocar a[2]
 6  L3   1  [2,5,4]   {i:2,key:4}             Guardo la clave 4
 7  L5   1  [2,5,4]   {i:2,key:4,j:1}         ¿a[1] = 5 > 4? Sí: hay que desplazarlo
 8  L6   1  [2,5,5]   {i:2,key:4,j:1}         Copio 5 a la posición 2
 9  L5   1  [2,5,5]   {i:2,key:4,j:0}         ¿a[0] = 2 > 4? No: la clave va justo detrás
10  L9   1  [2,4,5]   {i:2,key:4,j:0}         Coloco la clave 4 en la posición 1
11  L11  0  [2,4,5]   {}                      Array ordenado
```

Fíjate en el frame 3: `[5,5,4]`. Durante un desplazamiento el array tiene de verdad un valor duplicado. Un visualizador que deslice barras lo escondería; un microscopio lo enseña.

### 2.6 La escena: el contrato entre vistas y pintores

```ts
// file: src/scene/types.ts
import type { Frame, Role, TraceHeader, ViewSpec } from '@/core';

export type SceneId = string;

export interface SceneBox {
  kind: 'box';
  id: SceneId;
  shape: 'rect' | 'circle';
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  labelSize?: number;
  /** Dentro de la caja o encima: una barra estrecha no admite el texto dentro. */
  labelAt?: 'center' | 'top';
  badge?: string;
  role?: Role;
  /** Se apaga cuando el glifo sería ruido: barras muy estrechas, o si la posición ya lo dice. */
  showGlyph?: boolean;
  /** Caja desde la que entra: así sube un valor devuelto o se copia un elemento. */
  enterFrom?: SceneId;
  opacity?: number;
}

/** Une dos cajas por ID, sin coordenadas: sigue a sus extremos durante cualquier transición. */
export interface SceneLink {
  kind: 'link';
  id: SceneId;
  from: SceneId;
  to: SceneId;
  directed?: boolean;
  label?: string;
  role?: Role;
  opacity?: number;
}

export interface SceneText {
  kind: 'text';
  id: SceneId;
  x: number;
  y: number;
  text: string;
  size?: number;
  role?: Role;
  opacity?: number;
}

export type SceneNode = SceneBox | SceneLink | SceneText;

export interface Scene {
  readonly nodes: readonly SceneNode[];
}

export const EMPTY_SCENE: Scene = { nodes: [] };

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface ViewDefinition {
  readonly kinds: readonly ViewSpec['view'][];
  /** Se ejecuta una vez por traza: aquí se calcula, por ejemplo, la disposición del árbol final. */
  prepare?(header: TraceHeader, finalState: Frame['state'], viewport: Viewport, spec: ViewSpec): unknown;
  /** Función pura: mismo frame, mismo resultado. Se prueba sin navegador. */
  build(frame: Frame, spec: ViewSpec, viewport: Viewport, prepared: unknown): Scene;
  /** Primitivas máximas previstas: decide entre SVG y Canvas. */
  estimate(header: TraceHeader, finalState: Frame['state']): number;
  /** El estado en palabras, para lectores de pantalla. */
  describe(frame: Frame, spec: ViewSpec): string;
}

export interface Renderer {
  /** Solo toca lo que difiere de lo último pintado. */
  paint(scene: Scene): void;
  resize(viewport: Viewport): void;
  destroy(): void;
}
```

---

## 3. Estructura del repositorio

```
stepscope/
├── PLAN.md
├── CLAUDE.md                     # Convenciones del repo; se crea en la Fase 1
├── README.md                     # Demo, arquitectura y «Cómo añadir un algoritmo»
├── LICENSE                       # MIT
├── index.html
├── package.json
├── biome.json                    # Lint, formato y fronteras entre capas
├── tsconfig.json                 # Solo referencias
├── tsconfig.base.json            # Opciones comunes
├── tsconfig.app.json             # Todo salvo algoritmos, con noUncheckedIndexedAccess
├── tsconfig.algorithms.json      # Algoritmos, sin ese flag: el código mostrado debe quedar limpio
├── tsconfig.node.json            # Configuración, tests y E2E
├── docs/algorithm-template.algo.ts   # La plantilla de §4.4
├── vite.config.ts                # base: '/'
├── vitest.config.ts              # Activa el plugin de fidelidad, solo en tests
├── playwright.config.ts
├── .github/workflows/ci.yml      # Solo CI: lint, tipos, tests, build y E2E. Despliega Vercel
├── e2e/                          # Flujos de usuario, accesibilidad, teclado, URL
│
└── src/
    ├── main.tsx
    │
    ├── core/                     # Sin React ni DOM: corre en worker, tests y navegador
    │   ├── index.ts              # El alias @/core: lo único que importa un algoritmo
    │   ├── algorithm.ts          # defineAlgorithm y sus tipos
    │   ├── trace/
    │   │   ├── types.ts          # §2.1
    │   │   ├── builder.ts        # Tracer: registra deltas, cierra segmentos, aplica presupuesto
    │   │   ├── cursor.ts         # TraceCursor.seek(i)
    │   │   ├── run.ts            # runTrace: presupuesto y bajada de detalle
    │   │   └── fingerprint.ts
    │   ├── tracer/
    │   │   ├── types.ts          # §2.2
    │   │   ├── array.ts          # Una por tipo de estructura; llegan por fases
    │   │   └── recursion.ts      # recursive, ret, memoHit, prune, savedCalls
    │   ├── input/                # form, intArray, intInRange… parsear, validar, generar, formatear
    │   ├── source/extract.ts     # §2.3
    │   └── views-spec.ts         # bars(), callTree()… constructores de ViewSpec
    │
    ├── algorithms/               # ← Añadir un algoritmo es crear un archivo aquí
    │   ├── registry.ts           # import.meta.glob; nadie más sabe qué algoritmos existen
    │   ├── algorithms.test.ts    # La batería universal: corre sola sobre cada archivo
    │   ├── __snapshots__/        # Frames, fingerprint y resultado. Generado, no se escribe a mano
    │   ├── structures/   sorting/   searching/   graphs/
    │   ├── recursion/    dp/        strings/
    │
    ├── scene/                    # Sin React
    │   ├── types.ts              # §2.6
    │   ├── interpolate.ts        # scene(i, t), función pura
    │   ├── roles.ts              # Record<Role, RoleStyle>: etiqueta, glifo, patrón, token de color
    │   ├── svg-renderer.ts
    │   └── canvas-renderer.ts    # Fuera de la v1: llega con F2
    │
    ├── views/                    # Una por vista: estado → Scene. Pura y sin DOM
    │   ├── registry.ts           # También por glob
    │   ├── bars.view.ts          # …call-tree, call-stack, table, board, graph, tree…
    │   └── layout/               # Árbol ordenado, grafo con semilla
    │
    ├── player/                   # Sin React: reloj y estado de reproducción
    │   ├── clock.ts              # Bucle rAF; (i, t) a partir de velocidad y tiempo
    │   ├── presenter.ts          # Pinta un frame y publica los paneles; no decide cuál (F4)
    │   ├── engine.ts             # El reproductor: decide qué frame toca
    │   ├── store.ts              # Un store de Zustand por reproductor
    │   ├── compare.ts            # Reloj compartido y búsqueda por coste
    │   └── keyboard.ts
    │
    ├── worker/
    │   ├── trace.worker.ts       # Recibe id + entrada, ejecuta y transfiere los bytes
    │   └── client.ts             # Promesa cancelable con vigilante de tiempo
    │
    ├── routing/                  # Rutas con hash y URL ↔ estado
    │
    ├── ui/                       # React: todo lo que no es el camino caliente
    │   ├── pages/                # Catálogo, Reproductor, Comparación, Banco de pruebas
    │   ├── panels/               # Código, Variables, Explicación, Contadores, Complejidad, Leyenda
    │   ├── transport/            # Botones, barra de progreso, velocidad
    │   ├── input-editors/        # Uno por tipo de campo de entrada
    │   └── styles/tokens.css
    │
    └── test/
        ├── fidelity-plugin.ts    # Inserta __hit(línea) en la región mostrada
        └── arbitraries.ts        # tipo de campo → generador de fast-check
```

**Fronteras entre capas**, comprobadas por `noRestrictedImports` en Biome: `algorithms` solo importa `@/core`. `core` no importa nada del proyecto fuera de sí mismo, ni React. `views` importa tipos de `core` y `scene`. `player` y `scene` no importan React. Solo `ui` lo hace.

---

## 4. El contrato para añadir un algoritmo

### 4.1 Qué hay que hacer

1. Crear `src/algorithms/<categoría>/<id>.algo.ts`. El `id` de la URL sale del nombre del archivo.
2. Ejecutar `npm run test:update`, que genera su entrada en el snapshot.

El algoritmo aparece en el catálogo y la batería universal lo prueba, sin tocar nada más. El commit contiene tu archivo y el snapshot regenerado, que no se escribe a mano.

**El alcance exacto de este requisito.** Vale para cualquier algoritmo que use las vistas existentes, que es el caso normal. Una vista nueva, como la de Hanoi, es la excepción: un archivo en `views/` que se recoge solo y un valor más en la unión `ViewSpec`.

### 4.2 Los tipos del contrato

```ts
// file: src/core/algorithm.ts
import type { CounterName, TraceState, ViewSpec } from './trace/types';
import type { Tracer } from './tracer/types';

export type Category = 'structures' | 'sorting' | 'searching' | 'graphs' | 'recursion' | 'dp' | 'strings';

export interface AlgorithmMeta {
  name: string;
  category: Category;
  summary: string;
  complexity: {
    time: { best: string; average: string; worst: string };
    space: string;
  };
  stable?: boolean;
}

/** Un campo de entrada: sabe parsearse, validarse, generarse y volver a texto (URL y editor). */
export interface InputField<T> {
  kind: string;
  label: string;
  default: T;
  /** Lanza un `InputError` con un mensaje para el usuario si el texto no se entiende. */
  parse(text: string): T;
  format(value: T): string;
  validate(value: T): string | null;
  generators?: Readonly<Record<string, (random: () => number, current: T) => T>>;
  /** La entrada más grande permitida: con ella se comprueba que los límites declarados son ciertos. */
  maximal(): T;
}

export interface InputSpec<I> {
  readonly fields: { readonly [K in keyof I]: InputField<I[K]> };
  readonly default: I;
}

export interface AlgorithmDefinition<I, R, A extends string> {
  meta: AlgorithmMeta;
  input: InputSpec<I>;
  views: readonly ViewSpec[];
  /** Deben coincidir con los comentarios `// @ancla` del código mostrado. Lo comprueba un test. */
  anchors: readonly A[];
  /** Ejecuta el código mostrado, sin instrumentar. Es el oráculo de la implementación instrumentada. */
  reference: (input: I) => R;
  trace: (input: I, t: Tracer<A>) => R;
  /** Propiedad que debe cumplir el resultado. Devuelve el motivo del fallo o null. */
  check?: (input: I, result: R) => string | null;
  /** Se comprueban al cerrar cada capítulo, no en cada frame: a mitad de rotación un AVL puede estar desequilibrado. */
  invariants?: readonly { name: string; holds: (state: Readonly<TraceState>) => boolean }[];
  /** Coste teórico para contrastar con el contador real. */
  expected?: { metric: CounterName; formula: string; at: (input: I) => number };
  /** Casos del desplegable de la interfaz y de los tests de trazas. */
  examples?: readonly { name: string; input: I }[];
}

/** No hace nada en ejecución: existe para que TS infiera I, R y A y compruebe cada `t.step`. */
export function defineAlgorithm<const A extends string, I, R>(
  definition: AlgorithmDefinition<I, R, A>,
): AlgorithmDefinition<I, R, A> {
  return definition;
}
```

`form` compone los campos e infiere el tipo de la entrada sin ningún `any`, con un tipo mapeado inverso:

```ts
function form<I extends object>(fields: { readonly [K in keyof I]: InputField<I[K]> }): InputSpec<I>;
```

### 4.3 El registro

```ts
// file: src/algorithms/registry.ts
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
```

### 4.4 El esqueleto

```ts
// file: docs/algorithm-template.algo.ts
// Plantilla: cópiala en src/algorithms/<categoría>/<id>.algo.ts. El id de la URL sale del nombre del archivo.
import { bars, defineAlgorithm, form, intArray } from '@/core';

//#region shown
// Lo que ve el usuario, tal cual. Es código real: compila y los tests lo ejecutan.
// Una acción por línea. `// @ancla` marca las líneas a las que puede apuntar un frame;
// esos comentarios no se muestran. Los demás sí.
function firstValue(a: number[]): number { // @enter
  const first = a[0]; // @read
  return first; // @done
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Nombre visible',
    category: 'searching', // structures | sorting | searching | graphs | recursion | dp | strings
    summary: 'Una frase: qué hace y cuál es la idea clave.',
    complexity: {
      time: { best: 'O(1)', average: 'O(1)', worst: 'O(1)' },
      space: 'O(1)',
    },
  },

  // Cada campo sabe parsearse, validarse, generarse y volver a texto para la URL.
  input: form({
    values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [3, 1, 2] }),
  }),

  // Qué se pinta y cómo. Una misma estructura puede tener varias vistas.
  views: [bars('a')],

  // Deben coincidir con los comentarios de arriba. Una errata en un t.step no compila.
  anchors: ['enter', 'read', 'done'],

  // Ejecuta el código mostrado: es el oráculo de la implementación instrumentada.
  reference: ({ values }) => firstValue([...values]),

  // La implementación instrumentada. Hace lo mismo que el código mostrado y decide qué se ve.
  trace({ values }, t) {
    const a = t.array('a', values);
    t.step('enter', 'Qué acaba de pasar, en una frase');

    const first = a.get(0);
    t.step('read', `Leo el primer valor: ${first}`, { vars: { first }, marks: [a.mark(0, 'active')] });

    t.step('done', `Devuelvo ${first}`);
    return first;
  },

  // Opcionales:
  // check:      (input, result) => motivo del fallo o null. Propiedad que debe cumplir el resultado.
  // invariants: [{ name, holds: (state) => boolean }]. Se comprueban al cerrar cada capítulo.
  // expected:   { metric, formula, at: (input) => number }. Coste teórico para contrastar.
  // examples:   [{ name, input }]. Casos de la interfaz y de los tests de trazas.
});
```

### 4.5 Ejemplo completo: ordenación por inserción

```ts
// file: src/algorithms/sorting/insertion-sort.algo.ts
import { bars, defineAlgorithm, form, intArray } from '@/core';

//#region shown
function insertionSort(a: number[]): number[] {
  for (let i = 1; i < a.length; i++) { // @outer
    const key = a[i]; // @key
    let j = i - 1;
    while (j >= 0 && a[j] > key) { // @compare
      a[j + 1] = a[j]; // @shift
      j--;
    }
    a[j + 1] = key; // @place
  }
  return a; // @done
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Ordenación por inserción',
    category: 'sorting',
    summary: 'Inserta cada elemento en su sitio dentro de la parte ya ordenada, desplazando los mayores.',
    complexity: {
      time: { best: 'O(n)', average: 'O(n²)', worst: 'O(n²)' },
      space: 'O(1)',
    },
    stable: true,
  },

  input: form({
    values: intArray({ minLength: 1, maxLength: 100, min: -999, max: 999, default: [5, 2, 4, 6, 1, 3] }),
  }),

  views: [bars('a', { pointers: ['i', 'j'] })],

  anchors: ['outer', 'key', 'compare', 'shift', 'place', 'done'],

  reference: ({ values }) => insertionSort([...values]),

  check: ({ values }, sorted) =>
    sorted.length !== values.length ? 'ha perdido elementos'
    : sorted.some((v, k) => k > 0 && sorted[k - 1] > v) ? 'no está ordenado'
    : null,

  expected: { metric: 'comparisons', formula: 'n²/4 de media', at: ({ values }) => values.length ** 2 / 4 },

  examples: [
    { name: 'Desordenado', input: { values: [5, 2, 4, 6, 1, 3] } },
    { name: 'Ya ordenado (mejor caso)', input: { values: [1, 2, 3, 4, 5, 6] } },
    { name: 'Inverso (peor caso)', input: { values: [6, 5, 4, 3, 2, 1] } },
  ],

  trace({ values }, t) {
    const a = t.array('a', values);
    a.setRole(0, 'sorted');

    for (let i = 1; i < a.length; i++) {
      t.step('outer', `La parte ordenada llega hasta a[${i - 1}]; toca colocar a[${i}]`, {
        vars: { i, key: undefined, j: undefined },
        level: 0,
      });

      const key = a.get(i);
      t.step('key', `Guardo la clave ${key}`, { vars: { key }, marks: [a.mark(i, 'active', 'clave')] });

      let j = i - 1;
      t.vars({ j });

      while (j >= 0) {
        const current = a.get(j);
        const isGreater = t.compare(current > key);
        t.step('compare', `¿a[${j}] = ${current} > ${key}? ${isGreater ? 'Sí: hay que desplazarlo' : 'No: la clave va justo detrás'}`, {
          marks: [a.mark(j, 'compare')],
          level: 2,
        });
        if (!isGreater) break;

        a.set(j + 1, current);
        t.step('shift', `Copio ${current} a la posición ${j + 1}`, { marks: [a.mark(j + 1, 'write')] });
        j--;
        t.vars({ j });
      }

      a.set(j + 1, key);
      a.setRole(i, 'sorted');
      t.step('place', `Coloco la clave ${key} en la posición ${j + 1}`, { marks: [a.mark(j + 1, 'write')] });
    }

    t.step('done', 'Array ordenado', { vars: { i: undefined, j: undefined, key: undefined }, level: 0 });
    return a.toArray();
  },
});
```

Resultado real: 37 frames sobre el ejemplo desordenado, 21 ya ordenado y 46 en inverso. Con n=100 inverso: 10 198 frames, 1,2 MB y 12 ms de generación. Solo con hitos: 100 frames y el mismo resultado.

### 4.6 Ejemplo recursivo: Fibonacci con memoización

```ts
// file: src/algorithms/recursion/fibonacci-memo.algo.ts
import { callStack, callTree, defineAlgorithm, form, intInRange } from '@/core';

//#region shown
function fib(n: number, memo = new Map<number, number>()): number { // @enter
  if (memo.has(n)) return memo.get(n)!; // @hit
  if (n <= 1) return n; // @base
  const a = fib(n - 1, memo); // @left
  const b = fib(n - 2, memo); // @right
  const result = a + b;
  memo.set(n, result); // @store
  return result; // @return
}
//#endregion

export default defineAlgorithm({
  meta: {
    name: 'Fibonacci con memoización',
    category: 'recursion',
    summary: 'Guarda cada resultado la primera vez: las ramas repetidas se cortan en cuanto aparecen.',
    complexity: {
      time: { best: 'O(n)', average: 'O(n)', worst: 'O(n)' },
      space: 'O(n)',
    },
  },

  input: form({ n: intInRange({ label: 'n', min: 0, max: 40, default: 6 }) }),

  views: [callTree(), callStack()],

  anchors: ['enter', 'hit', 'base', 'left', 'right', 'store', 'return'],

  reference: ({ n }) => fib(n),

  expected: { metric: 'calls', formula: '2n − 1', at: ({ n }) => Math.max(1, 2 * n - 1) },

  examples: [{ name: 'fib(6)', input: { n: 6 } }],

  trace({ n }, t) {
    const memo = new Map<number, number>();

    const go = t.recursive({ name: 'fib', params: ['n'], enter: 'enter' }, (n: number): number => {
      const known = memo.get(n);
      if (known !== undefined) {
        return t.memoHit('hit', known, `fib(${n}) ya está calculado: ${known}. No hace falta bajar`);
      }
      if (t.compare(n <= 1)) return t.ret('base', n, `Caso base: fib(${n}) = ${n}`);

      t.step('left', `Bajo a por fib(${n - 1})`);
      const a = go(n - 1);
      t.vars({ a });

      t.step('right', `fib(${n - 1}) = ${a}. Bajo a por fib(${n - 2})`);
      const b = go(n - 2);
      t.vars({ b });

      const result = a + b;
      memo.set(n, result);
      t.step('store', `Apunto fib(${n}) = ${a} + ${b} = ${result}`);
      return t.ret('return', result, `fib(${n}) devuelve ${result}`);
    });

    return go(n);
  },
});
```

La versión sin memo es otro archivo con su propio código mostrado. Así, comparar ambas en el modo comparación no necesita nada más. Las variantes que no cambian el código, como los pivotes de quicksort, son un campo de `form`, y el modo comparación las admite como si fueran dos algoritmos.

### 4.7 Reglas para quien escribe un algoritmo

- **Una acción por línea en el código mostrado.** La línea es la unidad de resaltado: `return fib(n-1) + fib(n-2)` no permite distinguir las dos bajadas.
- **Sin `Math.random`, `Date` ni `localeCompare`.** Rompen el determinismo. Si hace falta azar, `t.random()`. Los tests sustituyen esas funciones por versiones que lanzan un error.
- **Sintaxis de TypeScript borrable** (`erasableSyntaxOnly`), sin `enum`: el plugin de fidelidad necesita quitar los tipos conservando las posiciones.
- **Identificadores en inglés, explicaciones en español.**
- **La explicación cuenta lo que acaba de pasar, no el código.** «Coloco la clave 4 en la posición 1», no «a[j+1] = key».
- **Nivel 0** para hitos, como cada pasada externa. **Nivel 2** para lo muy repetitivo, como una comprobación de `isSafe`.

---

## 5. Roadmap

**Orden: F1 → F3 → F4 y, si se amplía, F2 → F5 → F6 → F7 → F8 → F9.** Los números identifican cada fase, no su orden.

| Alcance | Fases | Contenido | Archivos de algoritmo |
|---|---|---|---:|
| **v1 comprometida** | F1, F3, F4 | Toda la ordenación y la búsqueda, Fibonacci con memo, comparación, complejidad, compartir y exportar | 13 |
| Ampliación opcional | F2, F5, F6, F7, F8, F9 | El resto del catálogo | 43 |

**Por qué este orden.** F2 es la fase más cara: hacerla justo después del esqueleto arriesga quedarse con dos algoritmos si hay un atasco. Con F3 y F4 el sitio ya es enseñable. La v1 está terminada cuando se cumplen las condiciones de salida de F4, y nada de la ampliación la condiciona.

Cada fase se despliega y se puede usar por sí sola. El tamaño es relativo (S, M, L): no doy horas porque aún no hay datos con los que estimarlas honestamente. La velocidad real de la Fase 1 calibrará el resto.

### Definición de terminado, en todas las fases

- Trabajo en una rama, con PR en verde (lint, tipos, tests, build y E2E), fusionado a `main` y desplegado.
- Toda vista nueva: roles con forma y etiqueta, teclado, `prefers-reduced-motion`, legible en móvil.
- Ningún algoritmo sin pasar la batería universal.
- Si la fase cambió algo del contrato, `README.md` y `CLAUDE.md` actualizados.

### F1. Esqueleto andante · M

**Objetivo:** demostrar la arquitectura de punta a punta con lo mínimo. Dos algoritmos de familias distintas son el mínimo: con uno solo, nada probaría que el reproductor es agnóstico.

**Algoritmos:** `insertion-sort` (array) y `fibonacci-memo` (árbol, pila, memo). `linear-search` es la prueba de aceptación, ver abajo.

**Se construye:**

- **Herramientas:** repositorio con licencia MIT, TS con doble configuración, Biome con fronteras, Vitest, Playwright, CI en GitHub Actions, proyecto en Vercel y `main` protegida.
- **Núcleo:** tipos, tracer (`step`, `vars`, `compare`, `array`, `recursive`, `ret`, `memoHit`, `prune`, `random`), codificador, cursor, fingerprint, presupuesto de frames y bytes, `extractShown`, `form`, `intArray`, `intInRange`.
- **Worker** con cancelación y un vigilante que lo termina si no responde.
- **Escena:** tipos, `interpolate`, pintor SVG, tabla de roles.
- **Vistas:** `bars`, `call-stack` y `call-tree`, esta con disposición estable sobre el árbol final, forma por estado (incluida la marca de memo) y `savedCalls` en el panel.
- **Reproductor:** todos los controles, teclado, `prefers-reduced-motion`.
- **Paneles:** código con línea y fase, variables, explicación, contadores.
- **Entrada:** texto validado y los cuatro generadores. URL con algoritmo, entrada y paso.
- **Tests:** batería universal, plugin de fidelidad, propiedades de ordenación, E2E básico con axe.
- **Banco de pruebas** en `#/bench`: trazas sintéticas para medir en cualquier dispositivo.

**Condiciones de salida:**

| # | Condición | Si falla |
|---|---|---|
| 1 | **`linear-search` se añade creando un archivo, en un commit que no toca nada más** | El contrato está mal: se corrige antes de seguir |
| 2 | Atrás, adelante, salto, arrastre y reabrir la URL dan frames idénticos | Bloquea |
| 3 | 100 barras a 60 fps en el portátil | Bloquea |
| 4 | **En tu iPhone, sobre el deploy preview de la rama y antes de fusionar:** 300 primitivas a ≥ 30 fps y arrastre sin saltos en una traza de 100 000 frames | Acortar transiciones o quitar etiquetas con n grande. Si no basta, adelantar el pintor Canvas: la arquitectura no cambia, es intercambiable |
| 5 | `tsc -b` con TS 7 sin errores | Fijar `typescript@6` |
| 6 | Un PR en rojo no se puede fusionar, y uno en verde llega a producción al fusionarlo | Corregir la regla de `main` antes de seguir |

La condición 1 es la más importante del proyecto: si añadir el tercer algoritmo obliga a tocar otra cosa, se arregla ahora, cuando hay tres y no cincuenta.

**Estado (2026-11-02).** Cumplidas las seis condiciones. La 1, 2, 3 y 5 en local; las otras dos así:

- **La 4, en el iPhone.** Medida sobre producción, porque F1 llegó a `main` sin PR:
  - 59 fps en todos los casos de `#/bench`, también 300 primitivas.
  - Traza sintética de 100 000 pasos: 34,1 MB.
  - Arrastrar la barra y el salto largo: 1 ms de p99, frente a 33 ms de límite.
- **La 6, con el PR #1.** Un ruleset en `main` exige PR y el check `ci` en verde, y prohíbe force push y borrado, sin excepciones. Al fusionarlo, Vercel publicó el commit en producción sin intervenir.

La condición 1 cazó un fallo real: la caché `fsModuleCache` de Vitest ocultaba los algoritmos nuevos. Corregido, un archivo nuevo añade 12 tests y no cambia ningún otro archivo, salvo el snapshot generado.

### F3. Ordenación, búsqueda y entrada completa · M

**Algoritmos (10):** burbuja, selección, mergesort, quicksort (pivote primero, último, mediana de tres, aleatorio), heapsort, counting sort, radix sort, shell sort; búsqueda binaria y binaria sobre respuesta.

**Se construye:**

- Vistas `cells`, `buckets` y `heap-tree`, que lee el mismo array: heapsort se ve como array y como árbol a la vez. `t.buckets` y arrays auxiliares.
- Mergesort y quicksort usan el `t.recursive` de F1: barras, pila y árbol a la vez, con el valor devuelto subiendo por las ramas.
- Selector de granularidad: con 10 000 frames hace falta poder ver por pasadas.
- Panel de complejidad con el contraste real frente a teórico.
- Botón de compartir y URL robusta (aviso por fingerprint y compresión).
- Pivote aleatorio con la semilla como campo de entrada, para que un enlace reproduzca la misma ejecución. `reference` y `trace` deben consumir la misma secuencia de `seededRandom(seed)`: si no, el test de fidelidad compararía dos ejecuciones distintas.

**Se puede usar para:** todo el bloque de ordenación con entrada propia y casos extremos, compartido por enlace. A partir de aquí el sitio ya es enseñable.

**Salida:** la propiedad «cualquier ordenación deja el array ordenado y es una permutación de la entrada» pasa en todos, y la estabilidad en los declarados como estables.

**Estado (2026-11-02).** Construida en local y en verde: 307 tests unitarios y 89 E2E en Chromium, WebKit y móvil. Lo que trae:

- Los 10 algoritmos.
- Las vistas `cells`, `heap-tree` y `buckets`, y varias vistas por platina.
- La granularidad y el panel de complejidad.
- Compartir con aviso por fingerprint.

La salida se cumple:

- La propiedad de ordenación pasa en las 9 ordenaciones.
- La estabilidad se comprueba en las 5 declaradas estables, con un truco: `0` y `-0` comparan igual en todo, pero `Object.is` los distingue, así que el orden de sus signos delata si dos iguales se han cruzado.
- Cuatro mutaciones introducidas a propósito las cazan los tests previstos.

Dos decisiones al construirla:

- **Funciones `void`.** Anclan su retorno en la llave de cierre, `} // @return`; el plugin de fidelidad registra cuándo una función llega al final.
- **Compresión de la URL aplazada a F5.** Ninguna entrada de F3 pasa de unos 1 000 caracteres, y en el hash no hay límite del servidor.

### F4. Comparación y cierre de la v1 · M

Sin algoritmos nuevos. Va aquí porque ya hay con qué comparar. Incluye el cierre que antes estaba en F9: en una fase opcional, la v1 nunca quedaría terminada. Por eso pasa de S a M.

**Modo comparación:** dos reproductores con un reloj por operaciones, tabla de contadores comparada, URL de comparación y disposición apilada en móvil.

**Cierre de la v1:**

- Exportar la traza a JSON.
- Auditoría de accesibilidad: axe, teclado, VoiceOver y simulación de daltonismo.
- Presupuesto de bundle en CI.
- `README.md` pensado para quien lo abre en una entrevista: enlace a la demo, enlaces a casos preparados, las decisiones de arquitectura con sus medidas y «Cómo añadir un algoritmo».
- Etiqueta `v1.0.0`.

**Se puede usar para:** quicksort frente a mergesort sobre el mismo array, y pivotes entre sí. Fibonacci con y sin memo llegará con F2, sin tocar este modo.

**Salida:**

- El modo funciona con cualquier par de algoritmos con entrada compatible, sin código específico por algoritmo.
- Al menos 30 fps en iPhone con dos arrays de 100.
- Axe sin errores y toda la interfaz usable solo con teclado.
- v1.0.0 en producción.

**Estado (2026-11-02).** Construida en local y en verde: 378 tests unitarios y 138 E2E en Chromium, WebKit y móvil. Lo que trae:

- **Comparación** en `#/compare/<a>/<b>`: dos platinas con un reloj que cuenta operaciones (comparaciones, escrituras y llamadas), tabla de contadores con quién hace menos, enlace al instante exacto y disposición apilada en móvil. Se llega desde el catálogo, con cuatro comparaciones preparadas, o desde cualquier algoritmo con «Comparar con otro».
- **Exportar la traza a JSON:** cabecera, estado inicial y el delta de cada frame. Un test de la batería la reconstruye entera con un lector independiente que solo sigue el formato documentado.
- **Presupuesto de bundle en CI:** 119 kB medidos, 140 kB de límite.
- **Auditoría de accesibilidad automatizada:** axe en el catálogo, en los 13 algoritmos y en las comparaciones preparadas; recorrido con tabulador de la comparación; y una simulación de protanopía, deuteranopía, tritanopía y acromatopsia sobre las tinciones de `tokens.css`. La pareja más justa, hematoxilina frente a eosina en gris, queda a 0,11 en OKLab, unas cinco veces la diferencia mínima perceptible.
- **README** para quien lo abre en una entrevista, con los casos preparados enlazados.

La salida se cumple en local:

- **Sin código por algoritmo.** Dos algoritmos son comparables si sus campos de datos coinciden en nombre y tipo, y cada campo común acepta solo lo que aceptan los dos. Quedan comparables las 9 ordenaciones entre sí (counting sort y radix sort restringen el rango) y las dos búsquedas por valor. Fibonacci con memo no tiene pareja hasta F2, y la página lo dice en vez de inventarse una.
- **Rendimiento.** La comparación real con dos arrays de 100 da 60 fps en Chrome sin pantalla, también con la CPU a ×4 y a cualquier velocidad. `#/bench` añade ese caso para medirlo en el iPhone.
- **Axe y teclado**, en los tres navegadores.

**En producción** en `https://stepscope.vercel.app` desde 5b97b24, con la CI en verde. Los 138 E2E pasan también contra producción.

**En el iPhone (2026-11-02):** 59 fps en todos los casos de `#/bench`, también dos arrays de 100. Quicksort frente a mergesort se reproduce fluido, y la pasada con VoiceOver salió bien.

**v1 cerrada:** etiqueta `v1.0.0` sobre 0ca53ff, el commit que está en producción.

Cuatro decisiones al construirla:

- **Pintar y decidir el frame, por separado.** El reproductor se partió en `FramePresenter`, que pinta y publica, y el reloj que decide qué frame toca. La comparación son dos presentadores y un reloj; los paneles no saben cuál de los dos casos tienen delante.
- **Campos de variante.** `choice` y los campos con `variant: true` (la semilla de quicksort) configuran el algoritmo en vez de darle datos. En la comparación son los únicos que cada lado elige por separado, y con el mismo algoritmo en los dos lados, B empieza en la opción siguiente. Es lo que permite comparar pivotes sin tratarlos aparte.
- **Los frames sin coste se ven de camino.** Cada lado enseña el último frame cuyo coste no pasa del reloj. Uno que no cuesta nada, como abrir una pasada, se salta: el modo compara trabajo, no explicaciones.
- **Exportar deltas, no estados completos.** Con el estado en cada frame, fib(15) pasaría de 1 MB a más de 500.

---

### Ampliación opcional

A partir de aquí nada está comprometido. Cada fase se decide por separado cuando la v1 esté publicada.

### F2. Recursión y backtracking · L

La primera ampliación: la familia de contenido prioritaria y la fase más cara.

**Algoritmos (8):** factorial, Fibonacci sin memo, Hanoi, permutaciones, subconjuntos, N reinas, laberinto, sudoku.

**Se construye:**

- `t.table`; vistas `board` y `pegs`.
- **Pintor Canvas** con repintado parcial y nivel de detalle; cámara que sigue al nodo activo, zoom, subárboles colapsables.
- Bajada automática de detalle y presupuesto de tiempo.

**Se puede usar para:** ver cualquier recursión con pila, árbol y código sincronizados, y entender el coste de no memoizar con fib(20) frente a fib-memo(20), también en el modo comparación.

**Salida:** fib(20), con 21 891 nodos, navegable. Un sudoku difícil muestra el aviso de truncado sin colgarse. Ambas cosas también en iPhone.

### F5. Grafos · L

**Algoritmos (10):** BFS, DFS, orden topológico, Dijkstra, Bellman-Ford, Floyd-Warshall, Kruskal, Prim, detección de ciclos, componentes conexas.

**Se construye:** `t.graph`; vistas `graph`, `adjacency-matrix` y `adjacency-list`; disposición por fuerzas con semilla, calculada al crear la entrada; entrada como lista de aristas con generadores (aleatorio, árbol, DAG, rejilla, completo), sin editor visual; Canvas para la matriz por encima de V=30 (si F5 se hiciera sin F2, el pintor se construye aquí); pruebas cruzadas (Dijkstra = Bellman-Ford = Floyd-Warshall, Kruskal = Prim).

**Salida:** Floyd-Warshall con V=50 navegable a nivel de hitos, también en iPhone.

### F6. Programación dinámica y cadenas · M

**Algoritmos (7):** mochila, subsecuencia común más larga, distancia de edición, cambio de monedas, subsecuencia creciente máxima, KMP, Rabin-Karp.

**Se construye:** vista `table` con flechas de dependencia, celda a celda, y reconstrucción de la solución; vista de alineamiento para cadenas; tabla de prefijos de KMP y hash deslizante de Rabin-Karp; editores de cadenas y de objetos.

**Salida:** cada DP comprobada contra fuerza bruta en entradas pequeñas, y KMP = Rabin-Karp = `indexOf`.

### F7. Estructuras lineales y tablas hash · M

**Piezas (9):** array, array dinámico (con redimensionado visible), lista simple, doble y circular, pila, cola, tabla hash con encadenamiento y con direccionamiento abierto.

**Se construye:** consola de operaciones con capítulos; `t.list`; vistas `list`, `stack`, `queue` y `buckets`; huecos de capacidad.

**Salida:** toda operación deja la estructura igual que una implementación de referencia, en secuencias aleatorias de operaciones.

### F8. Árboles y estructuras enlazadas · L

**Piezas (9):** cola de prioridad, heap binario, BST, AVL, rojo-negro, trie, grafo como lista de adyacencia, grafo como matriz, Union-Find con compresión de caminos.

**Se construye:** `t.tree`; rotaciones animadas (los enlaces siguen a los nodos gracias a D9), invariantes por capítulo, bosque para Union-Find, roles `rb-red` y `rb-black` con forma propia.

**Salida:** los invariantes de cada estructura se cumplen tras cada operación en secuencias aleatorias.

### F9. Cierre del catálogo · S

**Se construye:** búsqueda y filtros en el catálogo, que con 13 algoritmos no hacen falta y con 56 sí; repetir la auditoría de accesibilidad sobre las vistas nuevas.

**Salida:** las 55 piezas del catálogo cubiertas.

### Cobertura del catálogo

| Bloque | Piezas | En la v1 | Fase |
|---|---:|---:|---|
| Ordenación | 9 | 9 | F1 (inserción), F3 |
| Búsqueda | 3 | 3 | F1 (lineal), F3 |
| Recursión y backtracking | 8 | 0 | F2 (Fibonacci con memo, además, en F1) |
| Grafos | 10 | 0 | F5 |
| Programación dinámica | 5 | 0 | F6 |
| Cadenas | 2 | 0 | F6 |
| Estructuras de datos | 18 | 0 | F7 y F8 |
| **Total** | **55** | **12** | 56 archivos en total y 13 en la v1, porque Fibonacci con memo va aparte |

---

## 6. Riesgos técnicos

| Riesgo | Prob. | Impacto | Qué lo mitiga |
|---|---|---|---|
| **El código mostrado y el instrumentado divergen** | Media | Alto | Cuatro comprobaciones automáticas (§1.3). Verificado con divergencias introducidas a propósito |
| **Rendimiento en Safari/iPhone peor que lo medido** | Media | Alto | Condición de salida de F1 en tu iPhone, sobre el deploy preview, antes de construir nada encima. Si SVG no basta, se adelanta Canvas: el pintor es intercambiable |
| **CI y despliegue desacoplados** | Alta si no se protege | Alto | Vercel publica cualquier push a `main` sin esperar a CI. Regla en `main`: solo PRs con CI en verde y sin excepciones para administradores (§9). F1 no termina sin comprobarlo |
| **El preview pide iniciar sesión de Vercel en el iPhone** | Media | Bajo | Es la protección de despliegues de Vercel; no he confirmado el valor por defecto de un proyecto nuevo. Se ve en el primer preview: iniciar sesión en el móvil o desactivarla para previews en Settings → Deployment Protection |
| **La API del tracer no sirve para árboles o grafos** | Media | Medio | Solo se fija lo que F1 usa (§2.2); cada estructura se diseña con su familia. Las vistas y los deltas son genéricos: no dependen de la API |
| **Traza inmanejable con entrada del usuario** | Alta | Medio | Límites por algoritmo, presupuesto de frames, bytes y tiempo, y bajada automática de detalle. Un test con la entrada máxima de cada algoritmo |
| **Bucle infinito por un bug en un algoritmo** | Baja | Medio | Un vigilante en el hilo principal termina el worker si no responde (F1). Con F2, además, el worker comprueba el tiempo cada 1 024 frames y conserva la traza parcial |
| **El truncado por tiempo no es determinista (F2)** | Baja | Medio | Frames y bytes sí lo son, porque dependen de la entrada. El de tiempo depende de la máquina: es solo una red de seguridad, se avisa y se advierte al compartir |
| **Un descubrimiento automático que falla en silencio** | Media | Alto | Ya ocurrió: la caché de Vitest escondía archivos nuevos de `import.meta.glob` y simplemente había menos tests. Caché desactivada y un test que compara el registro con el disco |
| **Aliasing o errores sutiles en `seek`** | Media | Alto | Ya ocurrió dos veces en el prototipo. Test universal: `seek` aleatorio = secuencial en todos los algoritmos |
| **Enlaces compartidos obsoletos** | Alta | Bajo | Fingerprint en la URL: se abre igualmente y se avisa |
| **Safari limita `history.replaceState`** | Media | Bajo | La URL se actualiza al pausar o al terminar un salto, a un máximo de 2 por segundo, nunca durante la reproducción |
| **Herramientas muy recientes (TS 7, Vite 8, Vitest 5)** | Media | Bajo | Versiones fijadas con `package-lock.json`. Nada depende de la API de TS; volver a TS 6 es cambiar una línea |
| **`stripTypeScriptTypes` es experimental en Node 24** | Baja | Bajo | Solo se usa en el plugin de fidelidad. El paquete subyacente (`amaro`) es una alternativa directa |
| **Canvas sin semántica** | Segura si se amplía | Medio | Fuera de la v1. Solo en vistas densas, con vista en tabla, `aria-live` y prueba con VoiceOver en su fase |
| **Volumen y agotamiento antes de terminar** | Media | Alto | La v1 se compromete a 13 archivos; los otros 43 son opcionales. Se empieza por lo barato y enseñable, y F2, la fase más cara, queda fuera. La batería universal evita escribir tests por algoritmo |
| **Bundle inicial excesivo** | Baja | Bajo | Texto de los algoritmos en carga perezosa. Medido: 101 kB en F1 y 119 kB en F4. CI falla por encima de 140 kB (`npm run budget`) |
| **El reproductor retiene el estado reutilizado del cursor** | Media | Medio | Contrato explícito en el tipo `Frame`. La escena se construye al momento y es una copia propia |

---

## 7. Preguntas, ya resueltas

No queda ninguna abierta.

| # | Pregunta | Decisión | Consecuencia en el plan |
|---:|---|---|---|
| 1 | ¿Fecha o asignatura? | Sin fecha; se enseñará en entrevistas | La v1 terminada manda sobre el volumen, y el `README.md` se escribe para ese lector |
| 2 | ¿Repositorio público? | Sí | Público en GitHub, licencia MIT |
| 3 | ¿Cómo avanza la comparación? | Por operaciones | Sin selector por frames: un solo comportamiento que construir y explicar |
| 4 | ¿Qué es un «acceso a memoria»? | Lecturas y escrituras sobre estructuras trazadas, no variables locales | Un intercambio cuenta como 2 lecturas, 2 escrituras y 1 intercambio |
| 5 | ¿Editor visual de grafos? | No | Grafos por texto y generadores |
| 6 | ¿Exportar? | Solo exportar, a JSON | Sin importar, GIF ni vídeo |
| 7 | ¿SEO? | No | Rutas con hash, sin páginas por algoritmo |
| 8 | ¿Nombre y licencia? | StepScope, MIT | AlgoScope ya estaba cogido por otro visualizador |

---

## 8. Testing y verificación

### 8.1 La batería universal

`src/algorithms/algorithms.test.ts` recorre el registro y aplica todo esto a cada archivo, sin escribir tests por algoritmo:

| Comprobación | Qué garantiza |
|---|---|
| **Traza dorada** | Por ejemplo: número exacto de frames, fingerprint, resultado y contadores, en un snapshot |
| **Determinismo** | Dos ejecuciones dan bytes idénticos, con `Math.random`, `Date.now` y `performance.now` sustituidos por funciones que lanzan un error |
| **Oráculo** | En entradas aleatorias con fast-check: resultado de la traza = `reference(input)`, y `check` no devuelve fallo |
| **Fidelidad** | Las líneas de la traza son subsecuencia de las que ejecuta el código mostrado (§1.3) |
| **Anclas** | Declaradas = comentarios, y cada una se alcanza en algún ejemplo: una línea anclada que nunca se usa es un error |
| **Integridad de `seek`** | `seek` aleatorio = recorrido secuencial, en todos los frames |
| **Serialización** | El estado sobrevive a un ciclo JSON, sin `undefined`, `NaN` ni `Infinity` |
| **Contadores** | Nunca decrecen |
| **Límites** | La entrada máxima con el peor generador cabe en el presupuesto; si no, el algoritmo debe declararlo |
| **Invariantes** | Se comprueban al cerrar cada capítulo |

```ts
describe.each(algorithms)('$id', (algorithm) => {
  it.each(algorithm.examples ?? [])('traza dorada: $name', ({ input }) => {
    expect(summarize(runTrace(algorithm, input))).toMatchSnapshot();
  });

  it('coincide con el código mostrado en cualquier entrada', () => {
    fc.assert(
      fc.property(arbitraryFor(algorithm.input), (input) => {
        const trace = runTrace(algorithm, input);
        expect(trace.header.result).toEqual(algorithm.reference(input));
        expect(algorithm.check?.(input, trace.header.result) ?? null).toBeNull();
      }),
    );
  });
});
```

Un valor real de esa traza dorada:

```
insertion-sort > Desordenado: { frames: 37, result: [1,2,3,4,5,6], comparisons: 12, reads: 17, writes: 14 }
fibonacci-memo > fib(6):      { frames: 37, result: 8, comparisons: 8, calls: 11, savedCalls: 14 }
```

### 8.2 Por familia

- **Ordenación:** resultado ordenado y permutación de la entrada; estabilidad si `meta.stable`.
- **Pruebas cruzadas entre algoritmos:** Dijkstra = Bellman-Ford = Floyd-Warshall en grafos sin pesos negativos; Kruskal y Prim, mismo peso; KMP = Rabin-Karp = `indexOf`; búsqueda binaria = lineal.
- **PD:** contra fuerza bruta en entradas pequeñas.
- **Invariantes tras cada operación, nunca en mitad de una:**
  - AVL: factor de equilibrio en [−1, 1] y orden de BST. A mitad de una rotación puede no cumplirse, por eso se comprueba al cerrar el capítulo.
  - Rojo-negro: las cinco propiedades.
  - Heap: propiedad de orden.
  - Union-Find: bosque sin ciclos y raíz correcta.

### 8.3 Fuera de los algoritmos

| Capa | Pruebas |
|---|---|
| Escena | `interpolate(a, b, 0) = a` y `interpolate(a, b, 1) = b`; simétrica hacia atrás; IDs únicos |
| Vistas | Funciones puras, sin navegador: dentro del viewport y sin solapes |
| Roles | No hay dos con el mismo glifo y patrón |
| Reproductor | Reloj falso: velocidad, fin de traza, granularidad, búsqueda por coste |
| URL | Ida y vuelta de cada tipo de entrada |
| E2E (Playwright en Chromium, WebKit y viewport móvil) | Reproducir, paso, arrastrar, teclado, entrada propia, compartir y reabrir; `reducedMotion: 'reduce'`; axe sin errores |
| Visuales | Capturas en frames fijos, deterministas porque `t = 1` |

### 8.4 Comprobación de la Fase 1, de punta a punta

```powershell
npm run check       # Biome: lint, formato y fronteras entre capas
npm run typecheck   # tsc -b con las dos configuraciones
npm test            # Batería universal
npm run build
npm run e2e         # Playwright y axe
npm run dev         # Después, a mano: http://localhost:5173/#/insertion-sort
```

A mano: reproducir inserción, retroceder con `←`, arrastrar la barra, copiar la URL y abrirla en otra pestaña (mismo frame), y activar la reducción de movimiento en el sistema (sin transiciones). Después, abrir en el iPhone el deploy preview de la rama, en `#/bench`.

---

## 9. Comandos para inicializar el repositorio

Ya ejecutados al empezar F1, salvo los de git que van aparte. Quedan como registro de cómo se creó el repositorio. Son para PowerShell, desde `C:\Users\usole\source\repos\stepscope`, con `PLAN.md` ya dentro.

```powershell
git init -b main

# Control de versiones: fin de línea uniforme, porque el texto de los algoritmos se muestra tal cual
Set-Content -Path .gitattributes -Value "* text=auto eol=lf"
Set-Content -Path .gitignore -Value "node_modules/","dist/","coverage/","playwright-report/","test-results/"

# package.json
npm init -y
npm pkg delete main
npm pkg set type=module
npm pkg set private=true --json
npm pkg set license=MIT
npm pkg set engines.node=">=24"
npm pkg set scripts.dev=vite
npm pkg set scripts.build="vite build"
npm pkg set scripts.preview="vite preview"
npm pkg set scripts.check="biome check ."
npm pkg set scripts.format="biome format --write ."
npm pkg set scripts.typecheck="tsc -b"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch=vitest
npm pkg set scripts.test:update="vitest run -u"
npm pkg set scripts.e2e="playwright test"

# Dependencias
npm install react react-dom zustand sugar-high
npm install -D vite @vitejs/plugin-react "typescript@~7.0.2" @types/react @types/react-dom @types/node vitest fast-check @biomejs/biome @playwright/test @axe-core/playwright acorn

# Herramientas
npx biome init
npx playwright install chromium webkit

```

**Git es tuyo.** Yo no hago commits, push, ramas, PR ni etiquetas: dejo los cambios en el árbol de trabajo y aviso cuando hay un buen punto para commitear. Estos comandos los ejecutas tú:

```powershell
# Primer commit, cuando el andamiaje y el workflow de CI estén listos
git add .
git commit -m "chore: inicializar repositorio con el plan"

# Remoto: crea antes el repositorio público y vacío en github.com (gh no está instalado)
git remote add origin https://github.com/Solerito/stepscope.git
git push -u origin main

# A partir de aquí, todo en ramas con PR
git switch -c f1-esqueleto
```

**Pasos en la web**, hechos el 2026-11-02. El proyecto de Vercel se creó al final con la CLI (`vercel link`) y después se conectó a GitHub desde la web; el ruleset se importó desde un JSON. El despliegue, en `CLAUDE.md`.

1. **GitHub:** crear el repositorio público `Solerito/stepscope`, vacío.
2. **Vercel:** en `vercel.com/new`, importar el repositorio con el nombre de proyecto `stepscope`. Detecta Vite solo y `main` queda como rama de producción. Da una URL estable por rama, la que se abre en el iPhone.
3. **Proteger `main`,** imprescindible porque CI y despliegue están desacoplados. En Settings → Rules → Rulesets de GitHub:
   - Exigir pull request antes de fusionar.
   - Exigir que pase el check de CI.
   - Bloquear los force push.
   - Sin lista de excepciones, para que tampoco un administrador se la salte.

   GitHub solo ofrece un check después de que haya corrido una vez: la regla se activa tras la primera ejecución de CI.

**Por qué no uso `npm create vite`:**

- Pregunta y puede borrar archivos si la carpeta no está vacía, y aquí ya está `PLAN.md`.
- Trae `oxlint`, cuando aquí se usa Biome.

Los archivos de configuración y `src/` se crean al empezar la Fase 1.

