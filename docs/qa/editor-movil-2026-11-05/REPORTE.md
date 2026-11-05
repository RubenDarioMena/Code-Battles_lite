# QA · Editor del teléfono rediseñado (rama `ui-movil-editor`) · 5 de noviembre de 2026

Aplicación de los [lineamientos del rediseño](../../REDISENO-EDITOR-MOVIL.md). Todo es emulación de Chromium (teléfono de 390 × 844 y 360 × 740, táctil): **falta probar en teléfonos reales**.

## Resultados

| Suite | Resultado |
|---|---|
| Teléfono rediseñado (`editor-movil.mjs`, nueva) | 36 |
| War (`navegador.mjs`, parte del teléfono adaptada al nuevo reparto) | 92 (antes 90; 2 nuevas) |
| Factory: común, vistas, editor, 3D, API | 28, 31, 18, 10, 7 |
| Python en el juego (lista de la paleta ampliada) / ejecución JS-Python | 27 / 21 |
| Demo del editor | 73 |
| Entrada y paquete | 8 · 9 páginas y 87 referencias |
| Lógica (`interaccion.cjs`, grupos de la paleta ampliados) | 123 |
| Contratos, lenguajes, Python del editor, traductor, reglas de Factory | correctos · 34 · 64 · OK |

- Las suites de navegador se ejecutaron con Playwright y un adaptador que imita a ego-browser (`page.cdp` por CDP y el clic sobre el primer elemento visible). Con ese mismo adaptador, `trunk` (845f93e) da War 90/90: es la línea base.
- La excepción de página de `python-juego.mjs` («reading 'crear'») es la deliberada de la prueba que fuerza un recurso ausente; sale igual en `trunk`.
- **PC sin cambios:** la columna del código de War, Factory y War a 1100 px es idéntica píxel a píxel a la de `trunk`. Con el modo sin teclado y la ficha ⓘ abierta solo difiere la flecha animada de la tira de pestañas (anima dos veces al abrir).

## Capturas (teléfono de 390 × 844, pantalla completa en el código)

- `antes-movil-codigo.png` / `despues-movil-codigo.png`: el mismo programa. Antes, pestañas, EJECUTAR largo, lenguaje, letra, paleta, barra de edición y el panel inferior encima y debajo del código; después, barra mínima arriba, código y las dos barras al pie.
- `antes-movil-teclado.png` / `despues-movil-teclado.png`: con el teclado simulado del probador. La barra de símbolos desaparece; edición e inserción quedan encima del teclado.
- `despues-protomouse-seleccion.png`: arrastrando el ProtoMouse con la selección encendida (luz azul); el puntero virtual y la selección se pintan aunque el teclado esté cerrado.
- `despues-variantes-pegar.png`: mantener Pegar despliega Línea nueva, Sangrar y Quitar sangría.
- `despues-menu.png`: el menú ⋯ con la pestaña actual encendida.
- `despues-ficha-inspector.png`: el inspector del programa como segunda pestaña de la ficha ⓘ.

## Límites

- Sin teléfono real: queda por validar el tacto del ProtoMouse (ganancia y aceleración), el tamaño de la franja en pantallas de 360 px (unos 70 px; el arrastre puede seguir fuera de ella) y el teclado de Android con `interactive-widget=resizes-visual`. iOS sin revisar.
- El teléfono en horizontal sigue con la distribución de PC.
- La demo del editor conserva la barra clásica y la barra de símbolos.
- Elegir lenguaje y tamaño de letra al empezar queda pendiente; hoy están en Ajustes.
