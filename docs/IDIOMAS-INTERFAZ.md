# Idiomas de la interfaz

La portada, Ajustes, la navegación, los controles principales, las paletas de inserción y los formularios de Factory y War están preparados para español e inglés. El selector recuerda la preferencia en `cmg-interfaz-idioma` y actualiza también los controles activos, los menús y las confirmaciones abiertas. El inspector traduce encabezados, leyenda, controles, pistas y etiquetas de signos vitales. Las ayudas extensas, fichas de enemigos, resultados, explicaciones del inspector, avisos del editor y diagnósticos del juego también ofrecen ES/EN. La página de Campaign y el probador respetan la preferencia elegida. Los mensajes nativos del navegador, ejemplos de código, tokens de API y contenidos del jugador conservan su texto original. Los textos podrán revisarse en conjunto sin modificar las reglas del juego.

El idioma de interfaz es independiente del lenguaje del programa (JavaScript/Python) y del idioma del seudocódigo. Cambiarlo no convierte código, reinicia partidas ni migra guardados. Se mantienen las claves y valores existentes de la API, las reglas, los identificadores y los formatos de guardado. La nueva preferencia es una clave separada; si no existe o no es válida, se usa español.

## Implementación

- `shared/i18n/i18n.js`: runtime clásico, sin dependencias ni compilación. Expone `CMGI18n`.
- `shared/i18n/inicio.js` y `ajustes.js`: catálogos planos, separados por pantalla; registran claves ES/EN con `CMGI18n.registrar(idioma, mensajes)`.
- `juego-estatico.js`: textos y accesibilidad del HTML del juego y sus diálogos. `disposicion.js`: paneles, menú móvil y avisos de pantalla completa. `juego-dinamico.js`: controles de ejecución, selector de lenguaje y confirmaciones; las claves de este último usan el prefijo `partida.`.
- `editor.js`: acciones de la barra de edición, variantes móviles, selección/ProtoMouse y modo sin teclado. El componente conserva español como respaldo si el anfitrión no carga i18n o su catálogo; el cambio de idioma actualiza etiquetas sin reconstruir la barra.
- `paleta.js`: etiquetas de inserción y variantes JS/Python, más los nombres descriptivos de teclas. Las plantillas llevan el metadato opcional `i18n`; `t`, `b`, `cod`, operadores, huecos y símbolos conservan sus valores originales. El editor sin catálogo muestra `t` como respaldo. El cambio de idioma no reconstruye la paleta ni cierra el menú abierto.
- `inspector.js`: textos de presentación de fichas y panel inferior. Los marcadores `data-ins-i18n-*` localizan hojas y atributos sin alterar `data-ins`, `data-fin`, valores vivos o firmas de la API. Los repintados normales toman el idioma vigente; el evento de idioma solo actualiza presentación sobre los nodos actuales.
- Los estados, clases, roles y etiquetas de métricas del inspector se localizan al presentarse. Sus valores crudos para la simulación y la telemetría se conservan, igual que los nombres personalizados de las entidades.
- `factory-form.js`: formulario de Factory, con etiquetas y mensajes `formulario.*`. El evento de idioma actualiza hojas, atributos y opciones descriptivas conservando nodos, foco y borrador. Los campos del reto, materiales, IDs, valores funcionales y JSON no se traducen.
- `war-form.js`: formulario de escenarios War, con claves `escenario.*`. Las hojas y atributos usan los marcadores del runtime; el aviso de copia se actualiza desde su estado dinámico sin reiniciar el temporizador. Se conservan enunciados, tipos de enemigos, IDs, valores de opciones, oleadas y JSON. El prefijo del error de JSON se traduce; el detalle técnico del navegador se conserva.
- `retos.js`: títulos, objetivos, lecciones y partes de pista de los once retos incluidos, además de etiquetas de metas y coste. Se traducen al presentar, sin tocar `RETOS`, `def`, telemetría ni formularios/JSON. El índice de cada parte de pista se conserva entre idiomas; su progreso no cambia. Los escenarios propios y las copias conservan su texto. Los refrescos de idioma no reconstruyen las fichas ni mueven los portales del inspector/consola.
- `pendientes.js` y `presentacion.js`: catálogo y presentador para los fragmentos heredados de ayuda, resultados, inspector y editor, y para los diagnósticos crudos de JS/Python. La localización se invoca desde los renderizadores concretos; no observa el DOM. Reconoce frases completas y parámetros, marca hojas y atributos y refresca los nodos existentes al cambiar idioma. Omite código, campos y valores insertables, nombres personalizados y el contenido de las llamadas `console`/`print`. La telemetría y los emisores de simulación conservan los mensajes originales. Las entradas numéricas de este catálogo son identificadores estables: no reordenarlas ni reutilizarlas. Los textos nuevos deben preferir claves semánticas en el catálogo de su área.
- El contrato de catálogos comprueba también las colisiones entre patrones de mensajes concretos. Los resultados y avisos conservan botones, callbacks, foco, temporizadores y progreso de pistas. El selector experimental, el orden de la barra y el probador se localizan conservando sus valores funcionales.
- `CMGI18n.t(clave, parametros)`: texto, con interpolación `{nombre}` y respaldo español si falta la traducción. Una clave desconocida se devuelve literalmente para hacerla visible en QA.
- `CMGI18n.cambiarIdioma('es' | 'en')`: actualiza los textos marcados y `html.lang`, persiste la preferencia y emite `cmg:idioma` en `window`. `CMGI18n.idioma` consulta la selección; `aplicar(raiz)` permite traducir un fragmento nuevo.
- Los botones `data-idioma-interfaz="es"` y `="en"` comparten delegación de eventos y actualizan `aria-pressed`.

Se cargan primero runtime y catálogos; el DOM se traduce al terminar de cargar y al cambiar idioma. No hay peticiones de traducción remota ni observación global de mutaciones. La distribución estática copia `shared/`, por lo que incorpora los catálogos sin añadir una etapa de compilación.

Para texto estático, usar `data-i18n="pantalla.clave"` sobre una **hoja**. Si un texto comparte etiqueta con un control, enlace o icono, marcar un `span` propio: nunca reemplazar el contenedor. Mantener español en el HTML como respaldo de carga. Para accesibilidad y metadatos hay marcadores explícitos: `data-i18n-aria-label`, `data-i18n-title`, `data-i18n-placeholder`, `data-i18n-data-tip` y `data-i18n-content`. El runtime solo escribe texto y atributos permitidos; no interpreta HTML de los catálogos.

Para texto dinámico, usar `t()` en su función de presentación y refrescarla en `cmg:idioma`. Ese refresco debe limitarse a texto y accesibilidad: no llamar a funciones que modifiquen partida, distribución, selección, foco o preferencias. En Ajustes se refrescan la nota de orientación, la descripción de las vistas previas y el estado de pantalla completa. Mantener frases completas como claves; no construir una frase uniendo fragmentos que dependan del orden gramatical.

Los controles con varios estados (Ejecutar/Detener, Pausa/Seguir, copiar/restaurar/borrar en espera de un segundo clic) pertenecen a su función de presentación dinámica. No añadirles un marcador estático que vuelva a escribir el estado inicial al cambiar idioma. Los eventos de idioma tampoco deben volver a armar timers ni resolver promesas de confirmación. Los `value` de opciones y los identificadores de acciones son datos estables; solo se traducen sus etiquetas.

## Ampliación por lotes

1. Elegir un área pequeña y enumerar sus textos estáticos, dinámicos, ayudas y atributos accesibles. Buscar también los lugares que sobrescriben esos nodos después del arranque.
2. Extraer el español sin cambiar comportamiento. Asignar claves estables por significado, no por posición. Añadir su módulo de catálogo a la lista de `pruebas/i18n-catalogos.cjs` y cargarlo en las páginas correspondientes.
3. Traducir solo las claves nuevas o cuyo español haya cambiado. Dar al traductor el módulo, el glosario y contexto de pantalla; no necesita todo el juego. Una clave modificada en español requiere revisar su traducción aunque la comprobación de paridad pase.
4. Revisar con otro agente el diff acotado y sus contratos. Comprobar duplicados, claves y variables mediante scripts; reservar revisión avanzada para textos ambiguos o código delicado.
5. Ejecutar una prueba funcional de cambio de idioma en esa área, incluidos textos dinámicos y cambios repetidos. Reutilizar la regresión que ejercite sus controles. Cerrar el lote con resultados actuales antes de abrir otro.

Orden sugerido posterior: navegación y controles del juego; diálogos secundarios y ayudas; editor/paletas; retos; diagnósticos de ejecución. Al llegar a reglas o runtime, separar el código estable del mensaje presentado: nunca traducir valores que los programas usan para decidir. Campaign y el laboratorio de animación son ámbitos separados.

| Español | English |
| --- | --- |
| Ajustes | Settings |
| Mapa | Map |
| Código | Code |
| Bloques | Blocks |
| Seudocódigo | Pseudocode |
| Lenguaje del programa | Program language |
| Idioma de la interfaz | Interface language |
| Reto | Challenge |

Factory, War, Campaign, JavaScript, Python y los nombres de funciones se conservan. No traducir ejemplos de código de forma mecánica. La API para nuevos idiomas, pluralización o idiomas de derecha a izquierda debe ampliarse con sus pruebas cuando se incorporen; esta etapa ofrece ES/EN.

## Verificación

Desde la raíz:

```bash
node pruebas/i18n.cjs
node pruebas/i18n-catalogos.cjs
node pruebas/interaccion.cjs
node pruebas/editor-contrato.cjs
node pruebas/editor-lenguajes.cjs
node pruebas/editor-python.cjs
node pruebas/python-traductor.cjs
node pruebas/factory-reglas.cjs
node scripts/preparar-netlify.mjs
node pruebas/publicacion.mjs
```

Las suites importables `pruebas/idiomas.mjs`, `pruebas/idiomas-bordes.mjs`, `pruebas/idiomas-juego.mjs`, `pruebas/idiomas-editor.mjs`, `pruebas/idiomas-paleta-inspector.mjs`, `pruebas/idiomas-formulario.mjs`, `pruebas/idiomas-inspector-estados.mjs`, `pruebas/idiomas-escenario-war.mjs`, `pruebas/idiomas-retos.mjs` y `pruebas/idiomas-pendientes.mjs` usan el contrato de navegador de las suites existentes (`page.cdp`). Con el servidor dedicado 8771 y Playwright/Chromium disponibles, el runner opcional las ejecuta en contextos aislados, en vista Plano, sin añadir dependencias al juego:

```bash
node pruebas/ejecutar-idiomas.cjs
```

En este entorno detecta `/usr/bin/chromium`; en otro entorno puede indicarse su ruta con `CBL_CHROMIUM_PATH`. `CBL_QA_ORIGIN` permite indicar el servidor de pruebas. Un fallo conserva el estado de salida y guarda una captura en el directorio temporal del sistema. El runner rechaza una suite que no ejecute comprobaciones.

Usar un contexto de navegador de pruebas: las suites modifican programas y preferencias. Revisar español e inglés a anchuras de 320 y 393 px y en escritorio, incluido Ajustes con textos alargados de prueba. La emulación no sustituye QA de teclado y gestos en un teléfono real.

En este entorno, la suite histórica del editor móvil reproduce con 3D por software un watchdog de Worker de 2,5 s, también con el HTML/layout originales de `HEAD`. Para validar sus 72 checks de edición sin ese problema previo, puede fijarse la preferencia soportada de vista Plano en el contexto aislado, antes de abrir la página:

```js
await context.addInitScript(() => {
  localStorage.setItem('cmg-banco03:vista', JSON.stringify('2d'));
  localStorage.setItem('cmg-banco03:factory-vista', JSON.stringify('2d'));
});
```

Esto no valida el arranque de Worker en 3D. La suite War sí ejercita cámaras/gestos en 3D y pasa a Plano antes de sus últimos checks de ejecución. No modificar el watchdog ni las assertions para esconder fallos.
