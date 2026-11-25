# Receta de extensibilidad sobre papel: VEH, WHL y minador

Type: prototype
Label: wayfinder:prototype
Status: resolved
Blocked by: 05, 08, 09

## Question

Con la arquitectura elegida, ¿se sostiene la promesa de cambios localizados?

Escribir esqueletos (stubs con firmas y comentarios, sin lógica) de:

- el vehículo VEH;
- la rueda WHL;
- el minador, con `drop()` y su evento;
- la Batalla 6.

Hacer una tabla de archivos tocados, archivos leídos y pruebas nuevas. El autor reacciona al artefacto. Si algún caso obliga a tocar más de lo prometido, se reabre el ticket que corresponda.

## Contexto añadido (tras el ticket 05)

Hay que comprobar la promesa del ticket 05 para una mecánica nueva:
- dos archivos propios (`reglas.js` y `ficha.js`);
- una línea en `paso.js`;
- una línea en `modelos.js` si tiene GLB.

Los textos ES/EN van en catálogos de `shared/i18n` (decidido en el ticket 08, Q3), no en la ficha. Para la línea base, ver ticket 01: un verbo toca hoy 15 archivos.

## Contexto añadido (tras el ticket 08)

- La Batalla 6 del esqueleto sigue el formato del ticket 08: `niveles/nivel-1/b6.js`, una línea en la secuencia de `nivel.js`, sus claves en `shared/i18n/campaign-v2/nivel-1.js`, y la prueba de contenido debe pasarla.
- Sigue bloqueado por el ticket 09 (escala y coordenadas).

## Contexto añadido (tras el ticket 09)

- Desbloqueado: 05, 08 y 09 están resueltos.
- Los esqueletos trabajan en metros del mundo. VEH y WHL usan el marco de batalla como campo activo y no conocen las casillas: la traducción la hace `reglas-campaign-v2`.
- Si VEH necesita más campo que 32 × 18, la Batalla de prueba es una copia con `mapa.cols` ampliado. Hay que comprobar qué cuesta hacer configurables las filas.
- El asset de VEH entra como una línea en `modelos.js`, con escala, desplazamiento y anclaje (manda la simulación).

## Grill

[grill/ticket-12.html](../grill/ticket-12.html) · HTML conjunto de los tickets 12 (Q1–Q7) y 10 (Q8–Q12). Esqueletos del prototipo en [prototipo/receta/](../prototipo/receta/). Datos nuevos: el seudocódigo de trunk rechaza funciones (`editor/seudo-modelo.js:171`); el subconjunto Python ya admite `def`, `async def` y `lambda`; `regularShoot` de War es un modo, sin blanco.

## Answer

Resuelto el 24-nov-2026 con el HTML conjunto (Q8–Q12). Los esqueletos están en `prototipo/receta/`.

- **Q8 · La promesa se sostiene (A):**
  - Mecánica nueva: 2 archivos propios (`reglas.js`, `ficha.js`), 1 línea en `paso.js`, 1 en `modelos.js` si tiene GLB, y textos en i18n.
  - Batalla nueva: `bN.js`, 1 línea en `nivel.js` y sus claves en el catálogo del nivel.
  - Costes únicos (van al plan por porciones): la capacidad `movimiento/`, las puertas en el marco, la reaparición (recrear la unidad y usar «aplicar ahora»), el nodo «cuando» del seudocódigo y el proyectil V2.
- **Q9 · Movimiento (A):** capacidad compartida en `mecanicas/movimiento/` (`moveTo`, `stop`, `await arrive()`, evento `onArrive`). Las fichas la declaran con `capacidades: ["movimiento"]`.
- **Q10 · Arma del VEH (A):** un proyectil propio de V2 que, al impactar, llama a `war.danoEnArea`. War no expone su disparo.
- **Q11 · Puertas (A):** en el marco del nivel, `marco: { origen, puertas: [filas locales] }`, compartidas por todas sus Batallas.
- **Q12 · Unidad destruida (A):** mientras no existe vale `null` (`None` en Python). Su programa se detiene y vuelve a la primera línea al reaparecer. El árbol de unidades la muestra en gris con una cuenta atrás.

Con el verbo de Q2 del ticket 12, el VEH usa `regularShoot(objetivo)` en lugar del `shootAt` de los esqueletos.
