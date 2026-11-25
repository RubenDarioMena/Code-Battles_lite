# Cómo se añade una mecánica sin tocar archivos compartidos

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: 01, 02, 04

## Question

¿Cuál es la unidad de extensión de una mecánica nueva (movimiento, arma, sensor/radar, evento, seguimiento), dónde vive y qué contrato expone a los cinco consumidores?

- reglamento: paso y órdenes;
- anfitrión: API del programa y esperas;
- lenguaje: nombres JS/Python y sugerencias del editor;
- vistas 2D/3D;
- interfaz: ficha y árbol.

Probar la respuesta con los casos VEH, WHL y uno de los cinco arquetipos. Criterio: cuántos de esos cinco consumidores hay que tocar fuera de la carpeta de la mecánica. Usar la skill codebase-design.

## Insumos

[Comparación Astra/Claude](../arquitecturas/COMPARACION.md)

## Contexto añadido (tras el ticket 04)

Las mecánicas nuevas viven en `reglas-campaign-v2`, no en `reglas-war`. War sigue como caja negra por Batalla. Queda abierto cómo ve una mecánica (por ejemplo, VEH) a los enemigos del mundo de War: a través de la instantánea o por una lectura inyectada.

Línea base (ticket 01): hoy un verbo toca 15 archivos porque está duplicado entre `anfitrion/api.js` y `reglas-war/mundo.js`.

## Answer

Resuelto con el autor el 24-nov-2026 (grilling, ronda única más confirmación del orden de paso).

1. **Unidad de extensión.** Cada mecánica es una carpeta `reglas-campaign-v2/mecanicas/<m>/` con dos archivos:
   - `reglas.js`, puro: paso, órdenes, lecturas y eventos;
   - `ficha.js`, solo datos: verbos con clase y espera, nombres JS/Python, firma, nota, paleta, seudocódigo, i18n e id del modelo. Amplía el formato de `app/juego/datos-proveedor.js`.

   Se suma una línea por mecánica en `paso.js`, que la llama explícitamente.
2. **Una sola fuente por verbo.** La regla es una función autocontenida en `reglas.js`, que corre en el mundo y también dentro del programa para el efecto inmediato. Es el patrón de `reglas-campaign/validacion.js`, copiado con `toString()`. Los verbos de War no cambian.
3. **El editor lee las fichas.** Un único cambio hace que paleta, vocabulario, nombres Python, sugerencias, seudocódigo, ayuda e i18n lean las fichas desde el proveedor de V2. War conserva sus listas.
4. **Eventos con transporte genérico**, añadido una sola vez al anfitrión:
   - la ficha declara los nombres de evento y el paso de la mecánica los emite como `{ evento, unidad, datos }`;
   - se entregan entre pasos, en un orden determinista, a manejadores que corren como hilos propios;
   - el jugador ve nombres concretos (`onDamage(fn)`).

   Si entran en el primer corte se decide en el ticket 07.
5. **Interacción con War.** Dos funciones públicas en `reglas-war/index.js`: leer los enemigos (copia plana) y aplicar daño en un área `(x, y, radio, daño)`. Los enemigos que disparan (tirador, cañón de asedio) son de V2 y viven en un campo propio de V2. No se extrae `defensa.js`.
6. **Dibujo y asset.** La ficha guarda un id de modelo (solo texto). `vista-3d/cv2/modelos.js` traduce el id a URL, escala y mapa del rig, con un placeholder si falla la carga. `vista-3d/cv2/<m>.js` existe solo si la mecánica necesita un dibujo propio, y lo mismo en 2D con iconos.
7. **Orden del paso.** Fábrica → puente → batalla de War → mecánicas, en el orden de `paso.js`. El daño de una mecánica llega a War en el paso siguiente (+0,05 s). En modo paridad no hay mecánicas.

**Coste esperado de una mecánica nueva** (hay que comprobarlo en el ticket 10):
- dos archivos propios y una línea en `paso.js`;
- una línea en `modelos.js` si tiene GLB;
- además, el catálogo i18n, salvo que `i18n-catalogos` aprenda a leer las fichas.

**Coste único, que se paga una vez:**
- el transporte de eventos en el anfitrión;
- que el editor lea las fichas;
- las funciones de lectura y daño de War;
- el registro de modelos.

Queda para el ticket 10:
- si los textos ES/EN viven en la ficha o en `shared/i18n`;
- comprobar el coste con VEH, la rueda y el minador.
