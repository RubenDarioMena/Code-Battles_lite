# QA · E3 lenguaje del documento · 4 de noviembre de 2026

Alcance revisado con el usuario:
- Solo Python como lenguaje nuevo.
- Los lenguajes del editor se distinguen de los del juego.
- Bloques y probablemente Seudo saldrán (D8, pendiente).
- El selector muestra solo lenguajes.

## Resultados

| Suite | Resultado |
|---|---|
| War (`navegador.mjs`) | 90/90 |
| Factory: editor, vistas, API, paridad, 3D | 18, 31, 7, 28/28, 10 |
| Demo (`editor-demo.mjs`) | 51 (13 nuevas de E3) |
| Lógica, contratos, D1/D2 + catálogo, reglas Factory | 123, correcto, correcto, correcto |
| Entrada y paquete | 8; 9 páginas / 79 referencias |
| Capturas de War y Factory contra `d739dec` | 32/32 idénticas píxel a píxel (4 tamaños × 4 estados × 2 series) |

Las comprobaciones nuevas de la demo cubren:
- con un solo lenguaje, el selector solo informa;
- la demo funciona sin `seudo.js`;
- el nombre sale del catálogo o del adaptador;
- al cambiar de lenguaje cambian el documento, el adaptador, las teclas y la paleta;
- cada documento conserva su historial;
- el modo sin teclado se conserva;
- no se duplican menús ni atajos;
- una negativa del anfitrión con su motivo no cambia nada;
- se descarta una respuesta que llega después de editar;
- un lenguaje sin adaptador falla;
- `destruir` limpia todo después de varios cambios.

## Capturas

- `pc-dos-lenguajes.png`: 1400×900, tema claro del sistema. El primer editor recibe un segundo adaptador **de prueba** con el nombre «Python» para ver el selector activo; todavía no es Python.
- `movil-oscuro-un-lenguaje.png`: 390×844, un solo lenguaje; el selector queda como indicación, sin flecha.

Sin desbordes horizontales en la barra de herramientas a 1400 px ni a 390 px.

## Límites

- Chromium emulado; no se probó en dispositivos reales.
- El selector nativo del teléfono no se ha visto en iOS ni Android.
