# Observaciones del experimento comparativo

Rellenar tras ver cada render. No inventar cifras: dejar vacío lo que no se haya medido.

## Registro

| Fecha | Variante | Motor | Render (manifiesto) | Tiempo de trabajo | Tokens / coste |
|---|---|---|---|---|---|
| | A | Motion Canvas | | | |
| | A | Remotion | | | |
| | B | Motion Canvas | | | |
| | B | Remotion / Motion Studio | | | |

## Evaluación cualitativa (1–5 + nota)

| Criterio | MC · A | MC · B | Remotion · A | Remotion · B |
|---|---|---|---|---|
| (a) Claridad del concepto | | | | |
| (b) Potencia y ritmo del chiste | | | | |
| (c) Sincronía con la voz | | | | |
| (d) Legibilidad del código | | | | |
| (e) Facilidad de cambiar el guion | | | | |
| (f) Independencia de componentes | | | | |
| (g) Tiempo y coste en tokens | | | | |
| (h) Reproducibilidad del render | | | | |

## Prueba de reutilización (§8)

Cambiar en `shared/await-pilot.json`: idioma (`lang`), intervalo del contador (`polling`) y duración de la espera (`timing.waitSeconds`).

| Motor | ¿Rehízo la composición? | Archivos tocados | % de intervención manual | Notas |
|---|---|---|---|---|
| Motion Canvas | | | | |
| Remotion | | | | |

En Remotion ya existe `AwaitPilotEn` (inglés, 500→24 ms, 11 s de espera) como primer caso.

## Revisión humana de la metáfora

| Persona / perfil | ¿Qué entendió? | ¿Algún malentendido de la lista del guion? |
|---|---|---|
| | | |

## Personajes en StykAnimate (MCP) · 29-oct-2026

Escena: los dos stickmen del piloto `await` (variante A), 1920×1080, 30 fps, 691 fotogramas (23 s), fondo `#0B0F13`, figuras `#DCE3E6`, cajas `#E2894F`. Mismas posiciones que `AwaitPilot.tsx` (suelo y = 940; caderas en x = 400 y 1220; plataformas a +130 px).

- Fuente editable: `characters/stickman-wait.styk` (20 KB, 170 keyframes).
- Referencia: `renders/stykanimate/stickman-wait.mp4` (1920×1080, 30 fps, 691 fotogramas, `yuvj420p`, sin audio) y hoja de revisión `renders/stykanimate/stickman-wait-preview.png`.
- Generador del spec: `experiments/stykanimate-await-spec.mjs` (`node … spec.json`). Calcula los keyframes a partir de los cues (`busyStart` 90, `staggerStart` 328, desplome 376–392, encogimiento 422–479, caja 510, recogida 520–546).

**Qué funcionó**
- `build_animation` + `preview_frames` + `save_project` + `export_video` sin intervención del usuario. Cada reconstrucción tarda segundos.
- La biblioteca de poses cubre casi todo: `pick_up` (llega justo a la plataforma con la escala 1,3), `fall_back` → `lie` para el desplome, `shrug`, `hold_out` para sostener la caja, `walk_*` para los pasitos del tambaleo.
- `physics_plan`: `bounce` (restitución 0,15) para las cajas (31 fotogramas de caída y un rebote de 9) y `drop` para fijar los 11 fotogramas de la caída del personaje con `ease-in`.
- El chiste se lee en la hoja: se agacha y se endereza → frenesí (alterna `pick_up`/`reach` cada 2 fotogramas) → se tambalea y cae → el otro mira, se encoge de hombros, recoge su caja; la otra cae junto al caído.

**Qué no funcionó o hay que vigilar**
- Los keyframes son globales: cualquier figura que no se mencione queda clavada en ese keyframe. Por eso la respiración del de `await` (inclinación ±1,8°) se calcula en cada keyframe y los keyframes de relleno se excluyen en la caída física, en el desplome y en la recogida. A mano, esto sería tedioso.
- `attach` interpola hacia la mano durante el tramo anterior: con `attach` en el mismo keyframe que `pick_up`, la caja se elevaba antes de que llegara la mano. Solución: dejar la caja quieta hasta tocarla y poner `attach` en el keyframe de `hold_out`.
- A 30 fps no caben las 35 comprobaciones/s del contador. La frecuencia visible sube de forma lineal de ~1,4 a 7,5/s (medio ciclo de 11 a 2 fotogramas); la “mancha” la sigue poniendo el motion blur de Remotion/Motion Canvas.
- `joints` sobre `pick_up` apenas cambió la pose; no hizo falta.
- `fall_back` deja los pies sobre la plataforma: la caja de la izquierda cae a sus pies. Funciona como gag, pero la composición dibuja la caja en el mismo sitio; revisar si tapa algo.
- Los prompts `natural-motion` y `physics` no se pueden invocar como prompts desde esta sesión; se leyeron sus `SKILL.md` en la caché de `pnpm dlx`.

**Trabajo manual:** ninguno en la app. Tres iteraciones de spec (aceleración visible, tambaleo con pasos, recogida de la caja) y una prueba de poses. Retoques finos posibles en el editor abriendo el `.styk`.

**Integración en Remotion (pendiente):** el MCP solo exporta MP4/WebM/GIF opacos, no PNG con alfa. Opciones:
1. Abrir `stickman-wait.styk` en https://stykanimate.com/ y exportar a mano la secuencia PNG con alfa a `characters/exports/png-sequence/…` (`characters/README.md`). Habría que separar cada personaje (ocultar el otro y las cajas) y recortar alrededor del origen en el centro inferior.
2. Usar el MP4 opaco como capa inferior a pantalla completa: el fondo coincide con `theme.bg` y las posiciones con la composición. Las cajas, el suelo y las plataformas de Remotion se dibujarían encima o se quitarían del vídeo.
