---
name: infografia-animada
description: Crea explicaciones animadas de programación como infografías paso a paso, al estilo de las de aprendejavascript.dev, para Code Battle Lite. Una sola spec produce el reproductor interactivo (diapositivas con auto-avance, pausa, preguntas de predicción, JS↔Python, PC y móvil) y los 4 vídeos (16:9 y 9:16, JavaScript y Python) con voz opcional y subtítulos. Úsala cuando pidan un tutorial, explicación animada, infografía, vídeo educativo o "cómo se ejecuta" un fragmento de código o un concepto (variables, condicionales, bucles, break/continue, funciones, await…).
---

# Infografía animada (receta)

Convierte un concepto o un fragmento de código en una **infografía de pasos**: todo el mapa visible desde el principio, apagado, y un foco que avanza con la narración. Código, estado, diagrama y texto cuentan lo mismo a la vez, y cada papel conserva su color en todas las vistas.

Todo vive en `educational-animation/infografias/` (fuera del juego; no añade npm al juego):

| Ruta | Qué es |
|---|---|
| `motor/infografia.js` · `motor/infografia.css` | Motor sin compilación. Una línea de tiempo GSAP en pausa por infografía. |
| `motor/vendor/gsap-3.13.0.min.js`, `motor/fuentes/` | GSAP (licencia estándar gratuita, uso comercial) y Archivo / JetBrains Mono (OFL), locales para que el vídeo no dependa de la red. |
| `render.mjs` | Vídeo y revisión: Playwright + FFmpeg, determinista fotograma a fotograma. |
| `ejemplos/<concepto>/index.html` + `concepto.js` | Una carpeta por explicación. `index.html` es igual en todas; la spec está en `concepto.js`. |

Antes de escribir una spec, lee [references/receta-visual.md](references/receta-visual.md), la referencia de estilo derivada de las capturas, y [references/spec.md](references/spec.md), que documenta todos los campos. Toma como plantilla el ejemplo más parecido de `ejemplos/`.

## Flujo de trabajo

1. **Objetivo y malentendido.** Escribe arriba de `concepto.js` qué debe entender la persona y qué error de concepto hay que evitar. Ejemplo: «`continue` no termina el bucle, solo salta el resto de esta vuelta».
2. **Ejecuta el código de verdad, en los dos lenguajes.** Usa `node` y `python3 -I` en el scratchpad y anota la traza real: valores por vuelta, qué se imprime y por dónde sale. No narres de memoria. La traza es la fuente de los `valores`, la `consola` y las preguntas.
3. **Elige el patrón de escena** de la receta: traza de ejecución, expresión → resultado, cadena de decisión o catálogo + detalle. Si el concepto se repite por vueltas, añade una fila `estilo: 'vueltas'`. Ahí se ve el resultado de cada iteración y se queda visible.
4. **Asigna un color a cada papel antes de escribir los pasos** (mapa `roles`). Hay una regla para cada papel. Por ejemplo, condición = `amarillo`, cuerpo o salida = `cian` o `cobre`, actualización = `morado`, salida del bucle = `rojo`, salto = `cian` y valores = `azul`. Verde y rojo se reservan para `true` y `false` en los valores. **Las anclas del código y los nodos del diagrama usan el mismo id**, así un solo rol las colorea igual. Nunca pintes todo con el color de foco.
5. **Escribe el guion de pasos** (6–12): uno por idea, con frases de 1 o 2 líneas y valores concretos (`3 > 0` es `true`, no «la condición se cumple»).
   - La primera vuelta va lenta, con un paso por fase. Las vueltas iguales se comprimen en un solo paso con secuencias (`en`). Los casos especiales (`continue`, `break`, la salida) se cuentan otra vez en detalle.
   - Cuando un paso resume una vuelta completa, enciende a la vez todas sus fases, cada una con su color.
   - Pon 1 o 2 preguntas de predicción justo antes del momento clave (`pregunta`).
   - Cierra con un paso de resumen que nombre la regla general.
6. **Paridad JS ↔ Python.** Usa la misma spec, `{js, py}` donde difiera y el glosario `{{true}}`, `{{false}}`, `{{null}}`, `{{imprimir}}`, `{{and}}`… Revisa la lista de diferencias de abajo. Si el modelo mental cambia entre lenguajes (`for` de C frente a `for … in range`), adapta el diagrama de ese lenguaje y conserva el objetivo.
7. **Revisa con la hoja**: `node infografias/render.mjs infografias/ejemplos/<concepto> --hoja`, desde `educational-animation/`. Genera un PNG por variante con cada paso asentado y **comprueba desbordes** en vídeo y en el reproductor interactivo. Abre las 4 hojas y revisa la legibilidad, que haya colores distintos por papel y que no queden textos cortados ni avisos. Corrige y repite.
8. **Prueba la interacción** en el navegador (puerto libre, no el 8771 del juego): auto-avance, ‹ ›, puntos, teclado, la pregunta (espera respuesta, marca la elegida y revela), cambio JS↔Python y móvil 390×844 en vertical, sin desplazamiento horizontal.
9. **Renderiza**: `node infografias/render.mjs infografias/ejemplos/<concepto>` genera en `renders/infografias/` los 4 MP4 (1920×1080 y 1080×1920, 30 fps, H.264), un `.vtt` y un `.json` (manifiesto con tiempos, versiones y sha256) por vídeo. Si hay voz en `audio/{lang}/NN.wav`, se mezcla sola. Con `--seguro` se dejan los márgenes de Shorts, Reels y TikTok en vertical.
10. **Entrega**: indica qué conceptos cubre, cómo se verificó (hoja, prueba interactiva, ffprobe) y lo pendiente (voz real, revisión humana de la metáfora).

## Reglas de la receta

- **Mapa completo, foco móvil.** Todo el escenario está desde el paso 1, atenuado al 36 %. Nada aparece de la nada salvo resultados nuevos: líneas de consola, cafés, resultados de una expresión.
- **El color es el papel, no el foco.** Cada fase o categoría tiene un tono estable en el anillo del código, el borde y el título del nodo, la línea resaltada, la casilla de vueltas y el `código`{tono} de la narración.
- **Varias cosas pueden encenderse a la vez**, cada una con su color, si el paso las relaciona. Un paso no debe encender más de 3 o 4 cosas.
- **Valores concretos y booleanos semánticos**: `0 < 3 ✓` en verde, `0 > 0 ✗` en rojo, «sin comprobar» en neutro.
- **Causa → efecto dentro del paso**: primero se mueve el foco (0–0,45 s), después cambian los valores (+0,22 s) y por último aparece la salida (+0,32 s). El motor ya lo hace así.
- **Lo recorrido no se apaga del todo**: usa `hecho` para vueltas o elementos ya completados.
- **Título = tesis**: la idea completa en una frase («Seis cafés: así actúan break y continue»), no «Bucles».
- **Narración = subtítulo = voz**: el mismo texto. Empieza con **término.** en negrita y usa `código` con su color de papel.
- **Pausa de lectura**: el reproductor espera en las preguntas y el usuario controla el ritmo. El vídeo es la versión lineal del mismo material.

## Paridad JS ↔ Python (lista de comprobación)

- Booleanos y nulos: `true/false/null` ↔ `True/False/None`. Usa `{{true}}`, `{{false}}` y `{{null}}` en textos y etiquetas.
- Igualdad y lógicos: `===` ↔ `==`, `&&`/`||`/`!` ↔ `and`/`or`/`not`. Define `{{igual}}` en el `glosario` si aparece en la narración.
- Salida: `console.log(...)` ↔ `print(...)` con `{{imprimir}}`.
- Nombres: `camelCase` ↔ `snake_case` (idiomático); usa una entrada del glosario para la variable.
- Bloques: `{ }` ↔ sangría. Las líneas no coinciden, así que **marca y resalta siempre con anclas**, nunca con números de línea.
- Declaración: `let x = 0` ↔ `x = 0`.
- `for (let i = 0; i < n; i++)` ↔ `for i in range(n)`: el modelo cambia (no hay condición ni actualización explícitas). Adapta el diagrama.
- División, cadenas con plantilla (`` `${x}` `` ↔ `f"{x}"`), comparaciones encadenadas y verdad de valores vacíos: verifica con la ejecución real.

## Errores frecuentes (vistos al probar la skill)

- **Todo del color de foco.** Si en la hoja casi todo es ámbar, faltan `roles`. Cada fase necesita su tono.
- **La pregunta tapa lo que hay que mirar.** Colócala con `sobre` encima de un panel que no haga falta para responder, como la fila de vueltas, nunca sobre la línea en cuestión.
- **Textos que crecen en vertical.** Una narración de 3 líneas o un valor largo en una ficha empujan la escena y la hoja lo marca como desborde. La solución es acortar la frase, no achicar la letra.
- **Nodos con salida y detalle largo.** Se parten en 2 o 3 líneas y el diagrama no cabe. Deja el detalle en 1–2 palabras (`< 10`, `=== 8`).
- **Contar sin ejecutar.** La traza tiene que salir de `node` y `python3`. Por ejemplo, en «seis cafés» la condición `< 10` nunca llega a `false`: el bucle acaba por `break`. Ese dato es el centro de la explicación.

## Verificación mínima antes de entregar

- `node --check` de `concepto.js` (y del motor si lo tocaste).
- La hoja de las 4 variantes sin avisos (`render.mjs --hoja`). Revisa las imágenes, no solo el código de salida.
- La traza narrada coincide con la ejecución real en JS y Python.
- Si tocaste el motor, vuelve a pasar la hoja de los demás ejemplos.

## Límites conocidos

- No pude abrir aprendejavascript.dev desde la nube (red bloqueada). La receta visual sale de capturas estáticas y el movimiento es inferido (ver la referencia).
- Voz: el motor y el render aceptan clips por paso, pero aún no hay voz elegida (grabada o TTS). Sin audio, la duración sale del texto (≈2,4 palabras/s).
- Para usar una infografía dentro del juego habría que servir GSAP en `shared/vendor/`. Esa decisión es del usuario (AGENTS.md: sin dependencias por rutina).
