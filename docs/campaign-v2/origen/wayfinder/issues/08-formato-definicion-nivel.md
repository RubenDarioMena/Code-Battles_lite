# Formato de la definición de nivel e hitos

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: 04

## Question

¿Dónde y en qué formato vive la definición de un nivel?

- secuencia H0 → B1 → … → H5;
- metas de cada hito;
- fábrica inicial con las máquinas mínimas;
- batallas con sus oleadas;
- torretas de serie.

El objetivo es que añadir la Batalla 6 sea un solo archivo de datos y que un agente lo haga leyendo un único README.

¿Reutiliza `retos.js` + `normalizar()` de War y `nivel.js` de Campaign, o se define un formato nuevo? ¿Cómo se valida, y cómo se recupera desde ese formato la batalla de paridad de cada reto? Usar la skill codebase-design.

## Grill

[grill/ticket-08.html](../grill/ticket-08.html) · 6 preguntas (contenedor, B1–B5 frente a War, textos, metas, programas entre hitos, validación). Respuestas esperadas en `~/Documents/ticket-08-respuestas.md`.

## Answer

Resuelto el 24-nov-2026 con el grill en HTML. Las seis preguntas se respondieron con la opción A.

1. **Contenedor:** una carpeta por nivel con módulos JS de datos, como `retos.js` y `nivel.js` en trunk:
   - `reglas-campaign-v2/niveles/nivel-1/nivel.js`: la secuencia de hitos, el mapa, la instalación inicial y las mecánicas activas;
   - un archivo por hito: `h0.js`… para los de fábrica y `b1.js`… para las Batallas;
   - un `niveles/README.md` con la receta.

   Añadir la Batalla 6 es crear `b6.js`, añadir una línea a la secuencia de `nivel.js` y poner sus textos en el catálogo del nivel.
2. **B1–B5 frente a War:**
   - Mientras una Batalla sea idéntica a su reto, su archivo solo apunta a él: `{ war: N }`. `app` resuelve la referencia con `normalizar(RETOS[N-1])` y la inyecta, porque `reglas-campaign-v2` no puede importar `reglas-war` (fronteras).
   - Cuando una Batalla cambia, se copia su reto una vez a su archivo y se edita ahí. No hay parches del tipo `{ war: N, cambios }`.
   - La paridad siempre usa el reto original de War.
3. **Textos:** catálogo i18n propio por nivel en `shared/i18n/campaign-v2/nivel-1.js`. Respeta la regla de `docs/PLAN-ARQUITECTURA.md:33`, y los datos llevan claves, no textos. Esto también responde lo que el ticket 10 dejaba abierto: los textos de las fichas de mecánica van en catálogos i18n (uno por mecánica o uno común), no dentro de la ficha.
4. **Metas:** cada tipo de hito usa su formato.
   - Las Batallas terminan con el resultado del `evaluar` de War (`brechasMax`, `atascosMax`, `derribosMin`, `tiempoMax`).
   - Los hitos de fábrica usan la lista de Campaign `[{ k, tipo: "en" | "lotes" | "banda", … }]`, que pasa a `produccion.js`.
   - Si V2 necesita una meta extra, se añade como tipo nuevo en esa lista. No hay formato unificado.
5. **Programas entre hitos:** al empezar una Batalla se conserva el programa del jugador. Un botón «Programa de la lección» carga el programa de partida de esa Batalla, y el cambio se puede deshacer. El programa de partida también se usa para las unidades que aparecen nuevas. El Archivo de programas sigue fuera del primer corte.
6. **Validación:**
   - Un validador de contenido al cargar, con errores que dicen el archivo y el campo: ids repetidos, `{ war: N }` inexistente, tipo de enemigo o mecánica desconocidos, claves i18n que faltan.
   - Una prueba de contenido (`pruebas/contenido.mjs`) que carga todos los niveles y juega cada hito con semilla en Node, sin vista.
   - `normalizar()` de War no se toca: sigue recortando sin avisar para los retos de War.

**Coste de añadir la Batalla 6:** 2 archivos propios del nivel más 1 línea en `nivel.js`. No toca archivos compartidos de la serie. Es el mismo número de archivos que un reto en trunk (ticket 01), y ahora la prueba de contenido lo valida.
