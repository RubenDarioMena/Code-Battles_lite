# Formato del checkpoint de Campaign-V2

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: —

## Question

Con el mundo compuesto que decidió «Forma del mundo continuo» (fábrica persistente más un mundo de War por Batalla), ¿cómo se guarda y se restaura un checkpoint?

- **Serializar** la fábrica (ya existe `serializar` en `reglas-campaign`) y empezar siempre en el inicio de un hito, sin programas a medias.
- **Repetir** desde el inicio del nivel con las entradas grabadas (propuesta de Astra). Así se reconstruyen también las esperas de los programas, pero cuesta tiempo en niveles largos.

¿Qué incluye el checkpoint (programas, vínculos de programas compartidos, semilla, versión del nivel)? ¿Qué pasa con un checkpoint cuando cambia la versión del nivel? ¿Cómo se comprueba?

## Pistas

`reglas-campaign/README.md` (claves del checkpoint), `research/02-runtime-laboratorio-vs-anfitrion.md` (grabar y repetir) y la sección «Checkpoint» de `astra/ARQUITECTURA-ASTRA.md`.

## Grill

[grill/ticket-11.html](../grill/ticket-11.html) · 7 preguntas (estrategia, contenido, semilla, programas al volver, revisión del nivel, dónde y cuántos, comprobación). Dato nuevo: trunk Campaign ya guarda `{ hito, t, mundo, programas, fuentes }` y `volverA(cp, conProgramas)` relanza los programas (`app/juego/campaign.js:25-51`).

## Answer

Resuelto el 24-nov-2026 con el grill en HTML.

1. **Estrategia (A):** una instantánea en la frontera del hito, como el Campaign de trunk (`guardarCheckpoint` / `volverA`).
   - Al restaurar, el mundo de War se crea desde el reto de la Batalla y cada programa arranca en su primera línea.
   - Una espera a medias en la fábrica vuelve a empezar; es una pérdida aceptada.
   - La grabación del primer corte (ticket 07) empieza en el checkpoint y sirve para repetir y probar, no para guardar. Se descarta la repetición desde el inicio del nivel (propuesta de Astra).
2. **Contenido:**
   - Entran: la fábrica y la bodega (`serializar` de `produccion.js`), la posición de las torretas, los programas por unidad con sus vínculos compartidos, las fuentes Python, y la semilla, la clave y la revisión del nivel.
   - No entran: el mundo de War (se crea desde el reto), el estado de las ejecuciones (arrancan de nuevo), la grabación anterior al checkpoint y el programa anterior del botón «Programa de la lección».
3. **Semilla (B):** cada intento de una Batalla usa una semilla nueva, así que el programa tiene que aguantar atascos en momentos distintos.
   - Para que siga siendo reproducible, la semilla del intento se anota al empezar en su grabación, y repetir ese intento la reutiliza.
   - El menú de pruebas, la prueba de contenido y la prueba del checkpoint fijan la semilla de forma explícita.
   - La semilla guardada en el checkpoint es la de la fábrica, que es continua.
4. **Programas al volver tras perder (A):** se mantienen los programas actuales. Una casilla del diálogo de derrota trae los del checkpoint (`conProgramas` de trunk).
5. **Revisión distinta (B):** se descarta el mundo, se conservan los programas, se vuelve al inicio del nivel y se avisa en la consola. No hay migraciones.
6. **Dónde y cuántos (A):** un checkpoint por hito alcanzado, bajo la clave `campaign-v2-nivel-1`, y repetir un hito sustituye su checkpoint. No hay guardado en vivo a mitad de hito: al cerrar la pestaña vuelves al último checkpoint con tus programas actuales, que se guardan aparte como en trunk.
7. **Comprobación (A):**
   - ida y vuelta: `serializar(restaurar(c))` es igual a `c`;
   - restaurar el checkpoint de una Batalla y jugarla con una semilla dada da la misma huella que un ensayo de esa Batalla con la misma bodega, programas, torretas y semilla;
   - un checkpoint de otra revisión sigue la regla del punto 5.
