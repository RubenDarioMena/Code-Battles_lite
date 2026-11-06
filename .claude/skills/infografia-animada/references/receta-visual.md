# Receta visual

Análisis de las infografías de las lecciones de aprendejavascript.dev (midudev): `for`, tipos primitivos, operadores de comparación y `if / else if / else`. Se basa en **8 capturas estáticas** que envió el usuario. El sitio no fue accesible desde la nube, así que el movimiento descrito aquí es **inferido** y no observado. No se sabe qué biblioteca usa el sitio: lo que se ve es DOM (texto real, controles HTML), no vídeo ni canvas. Aquí se extraen **patrones**, no contenido ni marca: el estilo de Code Battle Lite sale de los tokens del juego (grafito, placa metálica, ámbar `--warn`).

## Anatomía (siempre la misma)

```
┌───────────────────────────────────────────────────────────┐
│ [▤ INFOGRAFÍA]  [JS|Python]                          2/8 │ cabecera: insignia + lenguaje + contador
│ Así se ejecuta un bucle for, paso a paso                  │ título = tesis (una frase)
│ ┌──────── escena ─────────────────────────────────────┐ │
│ │ código · estado · salida · diagrama (mapa completo)  │ │ todo visible; lo no activo, atenuado
│ └──────────────────────────────────────────────────────┘ │
│ 2. **Condición.** Antes de cada vuelta… `0 < 3` es true  ● ━ ● ● ‹ ❚❚ › │ pie: narración + puntos + mandos
└▔▔▔▔▔▔▔▔▔▔▔▔▔ barra del paso ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔┘ progreso del paso actual (auto-avance)
```

- Los **puntos** marcan dónde estás: el actual es una píldora alargada, los vistos se tiñen y los pendientes son grises. La **barra** inferior mide el tiempo del paso actual, no el total. En pausa, el botón central cambia a ▶.
- La **narración** es numerada («2.»), con un término en negrita al inicio y `código` en línea. Ocupa una o dos líneas y siempre usa valores concretos.

## Cuatro patrones de escena

| Patrón | Capturas | Composición | Cuándo |
|---|---|---|---|
| **Traza de ejecución** | `for` 2/8, 6/8 | Código con anillos sobre subexpresiones · fichas de estado (`VARIABLE I` = 3, `CONDICIÓN` = `2 < 3 ✓`) · consola · diagrama de fases con vuelta atrás y salida `false →` | Bucles, funciones, cualquier flujo |
| **Expresión → resultado** | comparación 2/6 | Fichas de operandos + operador → resultado coloreado (`false` en rojo) · nota («operador ⇒ booleano») · lista acumulada de ejemplos con el actual resaltado | Operadores, conversiones, métodos puros |
| **Cadena de decisión** | `if` 1/7 | Declaración del dato (`const edad = 20`) · código con línea activa · nodos de condición en vertical con `true →` salida y `false ↓` siguiente; los no evaluados dicen «sin comprobar» | `if/else`, `switch`, cortocircuito |
| **Catálogo + detalle** | tipos 2/6, 3/6, 4/6 | Fila de tarjetas (cada categoría con su color) · panel de detalle de la activa con ejemplos y una operación | Tipos, métodos, familias de algo |

En el motor: traza = `codigo` + `fichas` + `consola` + `flujo` (+ `fila estilo: 'vueltas'` si hay iteraciones). Expresión = `expresion` + `fila lista`. Decisión = `codigo` + `flujo` con `salida` en cada nodo. Catálogo = `fila` + `expresion` o `html`.

## Color: el color identifica el papel

Es lo que más distingue a la referencia y el error más fácil de cometer (todo en el color de foco):

- En el `for` 6/8 se ven **a la vez** la condición en amarillo, el cuerpo en verde y la actualización en morado. El mismo color aparece en el **anillo del código** (`i < 3` amarillo, `i++` morado, recuadro verde en `console.log(i)`) y en el **nodo** del diagrama.
- En los tipos, cada categoría tiene su color: `number` en azul, `string` en naranja y `boolean` en verde. El panel de detalle usa el color de la tarjeta activa en sus fichas.
- Los **booleanos** de los valores son semánticos (`true` en verde, `false` en rojo) y los números van en azul. Lo inactivo queda atenuado pero legible.

Paleta de Code Battle (`data-tono` / `roles`): `amarillo` (= foco, `--warn` del juego), `verde`, `rojo`, `azul`, `morado`, `cian`, `cobre`, `rosa`, `neutro`. Si un mismo paso usa verde para el cuerpo y para `true`, cambia el cuerpo a `cian` o `cobre`.

## Movimiento (inferido, implementado en el motor)

- **Foco**: fundido cruzado de 0,45 s (`power2.out`). Lo saliente se apaga mientras se enciende lo entrante y nunca hay dos estados intermedios fuertes.
- **Anillos de código**: aparecen con un pequeño «pop» (escala 1,18 → 1, 0,35 s) y desaparecen con un fundido. Puede haber varios a la vez.
- **Valores**: cambio en seco más un golpe de escala (1,2 → 1, `back.out`). Las secuencias dentro de un paso, como vueltas comprimidas, avanzan con `en`.
- **Salida**: cada línea o casilla entra desde abajo (y + 6 px) con fundido. La consola se desplaza por líneas completas.
- **Orden causal**: código y diagrama → valores (+0,22 s) → salida (+0,32 s). Primero se ve la causa y después el efecto.
- **Preguntas**: el panel aparece y cuenta los segundos de «Piénsalo…» (en vídeo). En el reproductor se espera la respuesta: la elegida queda marcada (roja si falla) y se revela la correcta en verde.
- **Reducción de movimiento**: con `prefers-reduced-motion` no hay auto-avance y cada paso salta a su estado asentado.

## Vertical (9:16) y móvil

El lienzo vertical mide 540×960 lógicos y se exporta a 1080×1920. Apila los paneles (`areas.vertical`) y sube la tipografía: código a 16–17 px y narración a 19,5 px. Así, a pantalla completa en un teléfono de 390 px, el código queda en unos 12 px reales. Para ganar sitio sin cambiar el contenido:

- `flujo.compacto: { vertical: true }` oculta los detalles de los nodos; el código ya los muestra.
- En vertical, la fila de vueltas muestra solo número e icono.
- `codigo.tamano: { horizontal: 13.5, vertical: 16 }` para fragmentos largos.
- Un panel que `areas` no nombra en un formato no se muestra en ese formato.

Con `--seguro`, la versión para redes reserva unos 84 px arriba y 150 px abajo para la interfaz de la app.
