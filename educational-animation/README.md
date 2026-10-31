# Animación educativa · banco de pruebas

Implementa el setup de [docs/Codemageddon_Vision_Animacion_Educativa.md](../docs/Codemageddon_Vision_Animacion_Educativa.md). **Está separado del juego**: el juego sigue sin npm ni compilación; las dependencias viven solo aquí.

## Arranque

Requisitos: Node 22+, **pnpm 11** (`packageManager` en package.json), FFmpeg y Google Chrome.

Remotion renderiza con el **Google Chrome instalado** (`remotion.config.ts`): el Chrome headless que descarga (Chromium 157, también en 4.0.539) se cierra en macOS 26.5.1. Para otra ruta, definir `REMOTION_CHROME`.

```bash
cd educational-animation
pnpm install
pnpm mc                    # Motion Canvas → http://localhost:9000
pnpm remotion              # Remotion Studio → http://localhost:3000
pnpm render:remotion       # MP4 + manifiesto en renders/remotion/
pnpm render:remotion:en    # variante de la prueba de reutilización
pnpm still:remotion        # un fotograma de prueba
pnpm typecheck
```

En Motion Canvas el render se lanza desde el botón *Render* del editor y se escribe en `renders/motion-canvas/`.

pnpm solo ejecuta los scripts de instalación aprobados en `pnpm-workspace.yaml` (`allowBuilds`): esbuild y los instaladores de ffmpeg/ffprobe de Motion Canvas.

## MCP de StykAnimate

Registrado en Claude Code solo para este proyecto (`claude mcp add --scope local`) como `stykanimate`: [mashhoorahdal/stykanimate-mcp](https://github.com/mashhoorahdal/stykanimate-mcp) fijado al commit `de645ec`, ejecutado con `pnpm dlx` (el `npx` de npm 10.9 falla con paquetes de GitHub). Guarda en `characters/` y usa el Google Chrome instalado. Ejecuta la app real sin interfaz: escena → `.styk` + previsualización + MP4/WebM/GIF. **No exporta PNG con alfa**; ver `characters/README.md`.

## Estructura

| Ruta | Contenido |
|---|---|
| `shared/theme.ts` | Paleta y fuentes copiadas del editor del juego (`Prototypes/Tres vistas/css/base.css`). El juego **no usa CodeMirror**: tiene un resaltado propio (`--tk-*`), aquí reproducido con Lezer. |
| `shared/highlight.ts` | Parser Lezer JS + correspondencia etiqueta → color, común a ambos motores. |
| `shared/await-pilot.json` | Parámetros del piloto: idioma, textos, código, tiempos, intervalos del contador, motion blur. |
| `shared/awaitPilot.ts` | Lógica de la escena como funciones puras del tiempo (cues, contador, poses, cajas, muestras de blur). |
| `shared/stickman.ts` | Stickman vectorial provisional (IK simple) hasta tener la exportación de StykAnimate. |
| `concepts/motion-canvas/` | Proyecto Motion Canvas 3.17 (escena `awaitBusyWait`). |
| `compositions/remotion/` | Proyecto Remotion 4.0.539 (composiciones `AwaitPilot` y `AwaitPilotEn`). Admite personajes en PNG y voz opcional. |
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
