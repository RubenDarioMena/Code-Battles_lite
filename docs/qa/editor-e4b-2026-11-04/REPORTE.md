# QA · E4b Python en el juego (`?python=1`) · 4 de noviembre de 2026

## Resultados

| Suite | Resultado |
|---|---|
| Python en el juego (`python-juego.mjs`, nueva) | 22 |
| War | 90/90 |
| Factory: editor, vistas, API, 3D | 18, 31, 7, 10 |
| Paridad | 28/28 en tres repeticiones. Falló una vez dentro de la pasada completa: «sin-await: tiempo», un caso de error que depende de cuándo llega el mensaje del Worker. |
| Demo | 73 |
| Python sin DOM | 34 |
| Lógica, contratos e integridad | 123 y correctos |
| Paquete | 9 páginas / 79 referencias |
| Capturas sin flag contra E3 | 32/32 idénticas píxel a píxel |

**Qué comprueba `python-juego.mjs`:**
- Sin flag, el juego no ofrece ni lee Python.
- Con flag:
  - **Py** abre el programa Python de la unidad;
  - la paleta del lanzador y del robot sale en Python, con nombres D1 y huecos D4, y el inspector muestra los nombres Python;
  - el bucle se escribe con su pausa y la sangría correcta;
  - el texto se guarda en `fuentes-<reto>` y `prog-<reto>` conserva el JS;
  - Ejecutar muestra el aviso sin crear Workers;
  - volver a JS recupera el JS y volver a Py el Python; al recargar se conserva el lenguaje;
  - Seudo desde Python vuelve a JS y abre la vista;
  - varias unidades en lenguajes distintos no aplican el borrador, y Add en Python escribe en las fuentes sin tocar los JS;
  - las sugerencias de un hueco Python son las del robot, sin sintaxis JS, y al elegir un valor se pasa al hueco siguiente.

## Capturas

- `war-pc-python-ejecutar.png`: 1400×900. Programa Python del lanzador y el aviso de Ejecutar. El inspector muestra `auto_target`, `wait`, `False` y `None`.
- `factory-movil-python.png`: 390×844. Programa del robot en Python, con la paleta de recoger, entregar, contar y esperar.

## Límites

- Python no se ejecuta: llega en E5.
- En el teléfono con Factory, el botón Py recorta la pestaña «Programa de R1» (solo con el flag).
- La telemetría y los récords aún no registran el lenguaje (E5).
- Solo emulación de Chromium.
