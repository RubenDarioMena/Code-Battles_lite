# Idiomas de la interfaz

La portada, Ajustes, la navegación, los controles principales y las paletas de inserción están preparados para español e inglés. El selector recuerda la preferencia en `cmg-interfaz-idioma` y actualiza también los controles activos, los menús y las confirmaciones abiertas. El inspector traduce encabezados, leyenda, controles, pistas y etiquetas de signos vitales. La traducción global sigue en curso: quedan contenidos de retos, ayudas dinámicas, formularios, estados y métricas del inspector y diagnósticos de ejecución. Los textos podrán revisarse en conjunto sin modificar las reglas del juego.

El idioma de interfaz es independiente del lenguaje del programa (JavaScript/Python) y del idioma del seudocódigo. Cambiarlo no convierte código, reinicia partidas ni migra guardados. Se mantienen las claves y valores existentes de la API, las reglas, los identificadores y los formatos de guardado. La nueva preferencia es una clave separada; si no existe o no es válida, se usa español.

## Implementación

- `shared/i18n/i18n.js`: runtime clásico, sin dependencias ni compilación. Expone `CMGI18n`.
- `shared/i18n/inicio.js` y `ajustes.js`: catálogos planos, separados por pantalla; registran claves ES/EN con `CMGI18n.registrar(idioma, mensajes)`.
- `juego-estatico.js`: textos y accesibilidad del HTML del juego y sus diálogos. `disposicion.js`: paneles, menú móvil y avisos de pantalla completa. `juego-dinamico.js`: controles de ejecución, selector de lenguaje y confirmaciones; las claves de este último usan el prefijo `partida.`.
- `editor.js`: acciones de la barra de edición, variantes móviles, selección/ProtoMouse y modo sin teclado. El componente conserva español como respaldo si el anfitrión no carga i18n o su catálogo; el cambio de idioma actualiza etiquetas sin reconstruir la barra.
- `paleta.js`: etiquetas de inserción y variantes JS/Python, más los nombres descriptivos de teclas. Las plantillas llevan el metadato opcional `i18n`; `t`, `b`, `cod`, operadores, huecos y símbolos conservan sus valores originales. El editor sin catálogo muestra `t` como respaldo. El cambio de idioma no reconstruye la paleta ni cierra el menú abierto.
- `inspector.js`: textos de presentación de fichas y panel inferior. Los marcadores `data-ins-i18n-*` localizan hojas y atributos sin alterar `data-ins`, `data-fin`, valores vivos o firmas de la API. Los repintados normales toman el idioma vigente; el evento de idioma solo actualiza presentación sobre los nodos actuales.
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

Las suites importables `pruebas/idiomas.mjs`, `pruebas/idiomas-bordes.mjs`, `pruebas/idiomas-juego.mjs`, `pruebas/idiomas-editor.mjs` y `pruebas/idiomas-paleta-inspector.mjs` usan el contrato de navegador de las suites existentes (`page.cdp`). Con el servidor dedicado 8771 y Playwright/Chromium disponibles, el runner opcional las ejecuta en contextos aislados, en vista Plano, sin añadir dependencias al juego:

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
