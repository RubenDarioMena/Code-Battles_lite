# Editor compartido · E2.1: paridad con War y pantalla completa · 4 de noviembre de 2026

## Punto de partida

Revisión de la demo E2 contra el IDE de War a 1920×1080, 1400×900, 1024×768, 768×1024, 390×844, 360×640 y 844×390. Sin desborde ni errores de consola, pero con estas diferencias:

1. Sin pantalla completa; editor fijo de 300 px. En un teléfono en horizontal el editor no cabía en la pantalla (`antes-horizontal.png`).
2. Siempre con tamaños de PC: las reglas del teléfono dependían de `.app[data-forma]` en `layout.css` de War.
3. Barra de edición y de símbolos siempre visibles (en War: barra solo sin teclado/Seudo en PC; símbolos solo con el teclado del teléfono).
4. Sin tooltips en los iconos (vivían en `layout.js` de War).
5. Sin A−/A+ (en `juego.js`).
6. Asa de líneas y orden de la barra junto al editor (en War están en Ajustes).
7. El primer ejemplo no se podía ver en Seudo.

## Cambios

- Reglas por forma de paleta, barra de edición y seudocódigo trasladadas de `layout.css` a `shared/css/edicion.css` con `.cmg-anfitrion` (la `.app` del juego o la raíz autónoma), con la misma especificidad.
- Tooltips en `shared/editor/tips.js`; `layout.js` lo usa con su `#tip`, las instancias autónomas comparten uno. La paleta y las variantes se buscan dentro del editor del elemento.
- Instancias autónomas: forma por ventana/raíz, barra de símbolos al escribir en el teléfono, herramientas con el aspecto del juego (JS/Seudo, sin teclado, A−/A+, Ajustes, pantalla completa), alto del editor según la ventana.
- Pantalla completa por instancia: cubre el viewport visual, pide la del navegador donde existe y sale con el botón, Esc, el Esc del navegador o `destruir()`.
- Demo: primer ejemplo compatible con Seudo, `?forma=` como en el juego, aviso del estado de pantalla completa.

## Verificación

Chromium headless con Playwright en 127.0.0.1:8771, caché desactivada; el adaptador de E1 (`page.cdp`, clic sobre el primer elemento visible).

- **War y Factory sin cambio visual:** 32 capturas de `#zona-codigo` (War y Factory × 1400×900, 1024×768 táctil, 390×844 y 844×390 × normal, sin teclado, Seudo y pantalla completa) idénticas píxel a píxel antes y después. Antes se comprobó que dos pasadas de la base son idénticas entre sí.
- Tooltips de War comprobados aparte: al pasar el ratón por la paleta («Comentar · // … (Ctrl+/)») y por A−, ocultos al salir; en el teléfono aparecen al tocar y se van al segundo.
- Suites del juego: **War 90/90** en esta pasada (en E1 quedó 88/90 por una intermitencia que esta pasada no reprodujo; no se declara resuelta), editor Factory 18, vistas 31, API 7, paridad 28/28, Factory 3D 10.
- Demo: `pruebas/editor-demo.mjs` **38** (20 de E2 + 18 nuevas: forma y clase de anfitrión, barras en PC y sin teclado, tooltip compartido, A−/A+ por instancia y guardado, Ajustes, pantalla completa, Esc, salida del navegador, botón sin teclado, destruir a pantalla completa, forma móvil, símbolos al escribir, retirada del tooltip). Dos pasadas seguidas correctas. Dos expectativas de E2 buscaban el texto del ejemplo anterior y se actualizaron al nuevo.
- Lógica 123, contratos E0/D1/D2, reglas Factory, entrada 8, paquete 9 páginas / 79 referencias locales (incluye `tips.js`), `node --check` y `git diff --check`.

## Fallo encontrado durante la prueba

Si el editor salía o se destruía mientras la petición de pantalla completa del navegador seguía pendiente, la ventana se quedaba en pantalla completa. Corregido: la petición se suelta al llegar.

## Límites

- Emulación de Chromium; sin teléfonos ni tabletas reales. Falta comprobar en un iPhone (sin la API del navegador, solo el modo del editor) y en Android con el teclado abierto.
- Una captura de página completa en Playwright desactiva la emulación táctil; las capturas de la demo en teléfono horizontal se tomaron sin ella.
- El modo Seudo de la demo muestra los ladrillos de War (apunta, dispara…): `seudo.js` aún trae ese catálogo por defecto. Corresponde al catálogo común de E3.
- En War, un teléfono en horizontal se trata como PC (editor de 144 px). La demo lo trata como teléfono; War no se ha cambiado.
