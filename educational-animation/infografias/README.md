# Infografías animadas

Explicaciones paso a paso al estilo de las infografías de aprendejavascript.dev, con la identidad de Code Battle Lite. **Una spec por concepto** produce:

- el **reproductor interactivo**: diapositivas con auto-avance, pausa, ‹ ›, puntos, teclado, deslizar, preguntas de predicción y cambio JS/Python. Funciona en PC y móvil (en pantallas estrechas pasa a vertical sola);
- los **4 vídeos**: 1920×1080 y 1080×1920, en JavaScript y Python, con subtítulos `.vtt`, voz opcional por paso y un manifiesto reproducible.

La receta completa (cómo pensar los pasos, colores por papel y paridad JS/Python) está en la skill [`.claude/skills/infografia-animada`](../../.claude/skills/infografia-animada/SKILL.md). La referencia de campos está en [references/spec.md](../../.claude/skills/infografia-animada/references/spec.md).

```text
infografias/
  motor/infografia.js · infografia.css   motor sin compilación (una línea de tiempo GSAP en pausa)
  motor/vendor/gsap-3.13.0.min.js        GSAP, licencia estándar gratuita (uso comercial permitido)
  motor/fuentes/                          Archivo y JetBrains Mono (OFL), locales
  render.mjs                              vídeo + hoja de revisión (Playwright + FFmpeg)
  ejemplos/while-cinta/                   while, vuelta a vuelta (9 pasos, 1 pregunta)
  ejemplos/seis-cafes/                    break y continue en un while (12 pasos, 2 preguntas)
```

## Uso

```bash
cd educational-animation
python3 -m http.server 8790 -d infografias  # cualquier servidor estático; abre /ejemplos/<concepto>/
node infografias/render.mjs infografias/ejemplos/seis-cafes --hoja   # revisión: PNG por variante + desbordes
node infografias/render.mjs infografias/ejemplos/seis-cafes          # 4 MP4 + .vtt + .json en renders/infografias/
```

Parámetros útiles en el navegador: `?lang=py`, `?formato=vertical`, `?paso=7` (abre en pausa en ese paso) y `?auto=0`.

El render necesita `playwright` (o `playwright-core` con `--chrome <ruta>`) y `ffmpeg`. No forma parte del juego. Para mostrar una infografía dentro del juego habría que servir GSAP en `shared/vendor/`, y esa decisión está pendiente.

## Cómo es determinista

Cada infografía es una línea de tiempo GSAP en pausa más una función `aplicar(t)` para lo discreto (textos, valores, puntos, barra). El reproductor la reproduce y el render la coloca en cada fotograma (`seek(t)`) y la captura por CDP. Nada depende del reloj ni de transiciones CSS, así que el mismo concepto da el mismo vídeo. En las pausas de lectura, el render captura 1 de cada 3 fotogramas: solo cambia la barra del paso.
