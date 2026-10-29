# Animación educativa · banco de pruebas

Implementa el setup de [docs/Codemageddon_Vision_Animacion_Educativa.md](../docs/Codemageddon_Vision_Animacion_Educativa.md). **Está separado del juego**: el juego sigue sin npm ni compilación; las dependencias viven solo aquí.

## Arranque

Requisitos: Node 22+, FFmpeg (ya instalado en este equipo).

```bash
cd educational-animation
npm install
npm run mc          # Motion Canvas → http://localhost:9000
npm run remotion    # Remotion Studio → http://localhost:3000
npm run render:remotion      # MP4 + manifiesto en renders/remotion/
npm run render:remotion:en   # variante de la prueba de reutilización
npm run typecheck
```

En Motion Canvas el render se lanza desde el botón *Render* del editor y se escribe en `renders/motion-canvas/`.

## Estructura

| Ruta | Contenido |
|---|---|
| `shared/theme.ts` | Paleta y fuentes copiadas del editor del juego (`Prototypes/Tres vistas/css/base.css`). El juego **no usa CodeMirror**: tiene un resaltado propio (`--tk-*`), aquí reproducido con Lezer. |
| `shared/highlight.ts` | Parser Lezer JS + correspondencia etiqueta → color, común a ambos motores. |
| `shared/await-pilot.json` | Parámetros del piloto: idioma, textos, código, tiempos, intervalos del contador, motion blur. |
| `shared/awaitPilot.ts` | Lógica de la escena como funciones puras del tiempo (cues, contador, poses, cajas, muestras de blur). |
| `shared/stickman.ts` | Stickman vectorial provisional (IK simple) hasta tener la exportación de StykAnimate. |
| `concepts/motion-canvas/` | Proyecto Motion Canvas 3.17 (escena `awaitBusyWait`). |
| `compositions/remotion/` | Proyecto Remotion 4.0.535 (composiciones `AwaitPilot` y `AwaitPilotEn`). Admite personajes en PNG y voz opcional. |
| `concepts/hyperframes/`, `motion-studio-projects/` | Vacíos a propósito; ver abajo. |
| `characters/` | `.styk` fuente y exportaciones PNG (ver su README). |
| `audio/voice`, `audio/sfx` | Fuente de audio; `sync-assets` lo copia a `public/` de Remotion. |
| `scripts/`, `storyboards/`, `experiments/`, `licenses/` | Guion, variantes, plantilla de evaluación y licencias. |
| `tools/render-manifest.mjs` | Escribe `<render>.manifest.json` (resolución, FPS, duración, versiones, comando, parámetros, sha256). |

## Principios aplicados

- **Capas independientes:** personaje, código, contador, cajas y textos son componentes separados.
- **Reproducible:** cada fotograma se calcula desde `t`; el motion blur son muestras deterministas del intervalo de obturación + desenfoque proporcional a la frecuencia.
- **Reutilización:** cambiar idioma, intervalo o espera = editar `shared/await-pilot.json` (o las props en Remotion Studio).
- **Sincronía semántica:** los momentos clave son cues con nombre (`busyStart`, `boxArrives`…), listos para atarse a marcas de palabra.

## Pendiente

- Personajes reales en StykAnimate (ver `characters/README.md`).
- Variante B del storyboard en ambos motores.
- HyperFrames y Motion Studio: no instalados en esta iteración (opcionales según la visión; Motion Studio usa IA y podría generar costes, requiere autorización).
- Voz y SFX.
