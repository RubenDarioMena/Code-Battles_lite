# Editor compartido · E1/E2 · 4 de noviembre de 2026

## Alcance

La instancia `CMGEditor.crear` vive en `shared/editor/`, con adaptador JS, plantillas, símbolos, medición, resaltado, edición por fichas, historial, vistas y ciclo de vida. El juego conserva sus IDs públicos y las fachadas `cmg`, `cmg.edicion` y `cmg.seudo`. E2 añadirá la demo sobre estas mismas fábricas, con raíces y preferencias independientes. Las órdenes del juego se componen en `js/paleta.js`; las plantillas de control de JS tienen una sola definición compartida.

Las preferencias de edición y Seudo se inyectan desde el anfitrión. La importación del banco antiguo permanece en el juego y es de solo lectura. El componente no lee localStorage, no crea Workers y no ejecuta el texto editado. La interfaz y los IDs de la demo se crean por instancia; el marcado del área de código del juego también lo crea el componente.

## Método

Chromium 155 headless, Playwright disponible en el entorno, servidor dedicado en `127.0.0.1:8771`. Las suites existentes se importan sin alterar sus expectativas; el adaptador de Playwright implementa `page.cdp` y elige el primer elemento visible en selectores de clic que también coinciden con botones ocultos. La pasada final desactiva caché. No se ha hecho QA en teléfonos físicos.

La comparación visual parte de `dfa5f33` y del mismo programa, tamaño de ventana y fuentes del sistema. Los recortes de `#v-programa` son idénticos píxel a píxel: 546 × 770 en escritorio y 360 × 314 en móvil. Archivos `antes-pc.png`, `despues-pc.png`, `antes-movil.png` y `despues-movil.png`.

## Incidencia encontrada durante la extracción

Con coordenadas manuales visibles, formato móvil y hoja de sugerencias muy baja, el mínimo fijo de 110 px cortaba la segunda opción entre encabezados de grupo. Se reprodujo también en `dfa5f33`: misma posición, altura y opciones cortadas. El módulo compartido omite los encabezados de grupo cuando la hoja tiene menos de 160 px disponibles, conservando todos sus valores. Esto permite priorizar dos opciones completas en el espacio escaso. El ajuste afecta a la hoja abierta, no al aspecto general del editor.

## Resultados

Los resultados de la pasada final se registran en `PROGRESO.md` y `shared/editor/REFERENCIA-E0.json`.

- Lógica: 123. Contratos E0/D1/D2, reglas Factory y sintaxis correctos.
- Factory en navegador: editor 18, vistas 31, API 7, paridad 28/28.
- War: 88/90 en la pasada completa. En el caso de EJECUTAR desde pantalla completa, el Worker no emitió mensajes antes del vigía de 2.5 s y el intento terminó en error en t=0. Una prueba dirigida del mismo flujo y programa arrancó correctamente en la base (672 ms) y en E1 (739 ms). La suite completa permanece pendiente; no se oculta el fallo ni se reduce su expectativa.
