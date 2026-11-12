# Campaign · nivel 1 «Primera fábrica»

Primer nivel jugable de la campaña, construido sobre la aplicación común (`Prototypes/Rocket Launcher/?serie=campaign`). Sale del dossier «Primera fábrica — propuesta validable» y de las decisiones del autor del 11 y 12 de noviembre de 2026. Es un prototipo para QA: los números son provisionales.

## Decisiones aplicadas

| Decisión del autor | Cómo quedó |
| --- | --- |
| Alcance H0–H5 como primer nivel | Un solo nivel con seis hitos encadenados. |
| Mundo continuo en vivo, con checkpoints autoguardados e historial | Ejecutar solo arranca los programas; la planta sigue donde estaba. Cada hito guarda un checkpoint (mundo y programas). Pestaña **Historial** y botón **↺ Checkpoint**. El estado en vivo sobrevive a recargar la página. |
| Sin oleadas todavía | El nivel termina cuando la munición llega a la bodega de la muralla; los lanzadores disparan una salva de prueba a unas dianas. |
| Mapa 10× en superficie | 200 × 104 m (casillas de 1 m): fábrica al oeste, muralla y campo de batalla al este, calcados del boceto a 10 px por metro. |
| Misma interfaz | Editor, inspector, consola, registro, Ajustes, distribución PC/móvil e idiomas ES/EN son los de War y Factory. |
| JS y Python | Los dos, con el mismo runtime (un Worker por unidad). Sin seudocódigo ni bloques por ahora. |
| Modo batalla | Botón **Batalla**: el paisaje se apaga y queda la cuadrícula de War sobre el relieve. |
| 1 · Ensambladora multiuso | ASM-01 tiene dos recetas (`"motor"` y `"missile"`) y cambiar tarda 6 s: por eso conviene fabricar por lotes. La energía es un límite suave: con más demanda que suministro, todo va más lento. |
| 3 · Salida con buffer | Cada máquina guarda 2–3 piezas en su salida y espera sin perder nada. Su luz sigue al sensor de salida; el programa de la máquina puede cambiarla (`light`) o avisar con `console.log`. |
| 4 · Slots y clases | Prensa, moldeadora y mezcladora: entrada por cantidad. Ensambladora: ranuras por tamaño (4 S, 2 M, 2 L). |
| 5 · Receta fija | La receta se elige con `setRecipe`; elegirla con un `if` según lo que haya es cosa del programa. |
| 6 · Montacargas desde el inicio | H0 es su acción guiada (programa ya escrito). También mueve máquinas ligeras a una plataforma libre. |
| 7 · Un tramo de banda | BLT-01, de la ensambladora a la bodega. Sin divisores. |
| 8 · Local primero, maestro en H4 | Cada unidad tiene su programa. CTL-01 puede ordenar a todas desde H4. El lenguaje completo vale desde el principio. |
| 9 · Piezas | Misil = ojiva + motor; motor = base con aletas + carga química. Tres piezas base con silueta propia. |
| 10–12 | Energía para I+D, árbol de tecnología y ventana de la ensambladora: fuera de este nivel. |

Decisión técnica: **WebGL con el Three.js r128 que ya sirve el proyecto**, no WebGPU. El mapa (unos 10 000 triángulos y pocas decenas de objetos) no lo necesita, WebGPU exigiría otra versión de Three.js o un motor propio y un segundo camino para los teléfonos sin soporte. El visor de Campaign está aislado en `campaign-3d.js` con el mismo contrato que `vistas.js`, así que cambiar de motor no toca el resto.

## Hitos

| Hito | Meta | Aprende | Se enciende |
| --- | --- | --- | --- |
| H0 Llegada | 12 de acero en SUP-1 | ejecutar y leer un programa; `await` | FRK-01, BOT-01 |
| H1 Máquina rápida | 6 ojivas en los lotes | bucle, leer el estado, esperar a que haya pieza | PRS-01 |
| H2 Dos estaciones lentas | 4 bases y 4 cargas | `if / else`, prioridades | MLD-01, MIX-01 (llega polímero) |
| H3 Montacargas y abastecimiento | 8 ojivas, 8 bases y 8 cargas | pedir, descargar, reubicar | — |
| H4 Producción por lotes | 6 misiles en un lote | recetas, etapas, control maestro | ASM-01, CTL-01 |
| H5 Primer transportador | 12 misiles por la banda | flujo continuo | BLT-01, BOT-02 |

Cada hito paga ₵ 50; cada misil en la bodega, ₵ 35. Presupuesto inicial ₵ 300; una tarima de 12 cuesta ₵ 40 (acero) o ₵ 60 (polímero).

## API

Nombres en inglés; en pantalla las unidades llevan guion (`PRS-01`) y en el código, guion bajo (`PRS_01`). Lo propio se escribe sin prefijo. En Python: `pick_up`, `go_to`, `set_recipe`, `output_full`.

- **Encargos** (tardan, llevan `await`): `pickUp(lugar, pieza?)`, `deliver(lugar)`, `goTo(lugar)`. Devuelven `"ok"`, `"viaje_vacio"`, `"sin_tarima"`, `"lleno"`, `"rechazado"`, `"manos_llenas"`, `"manos_vacias"`, `"ocupado"`, `"muy_pesado"` o `"no_disponible"`. Sin `"ok"`, el robot conserva su carga.
- **Modos** (al instante): `start()`, `stop()`, `light(color)`, `setRecipe(receta)`, `BAY_1.request(materia)`.
- **Lecturas**: `count(lugar, pieza)` (0: no hay; `null`: el lugar no existe) y propiedades: `cargo`, `busy` · `input`, `output`, `outputFull`, `state`, `recipe`, `made`, `running` · `pallet`, `items`, `free`, `pending` · `missiles` · `power`, `budget`.
- `await wait(segundos)`: deja pasar el tiempo de la planta.
- Las órdenes de una unidad con programa solo valen en su programa o en el de CTL-01 (desde H4). La bahía atiende a cualquiera.
- Un programa puede esperar varios encargos a la vez (`await Promise.all([...])`). Dar otra orden a una unidad que aún trabaja para ese programa es el error «Falta await…».

Piezas: `"steel"`, `"polymer"`, `"nose"`, `"base"`, `"charge"`, `"motor"`, `"missile"`. Lugares: `BAY_1`, `SUP_1`–`SUP_2`, `LOT_1`–`LOT_5`, `PAD_1`–`PAD_4`, `STK_1`, `DEP_01`.

## Archivos

| Archivo | Responsabilidad |
| --- | --- |
| `js/campaign-nivel.js` | Datos: mapa (boceto), instalación, hitos y programas de partida. |
| `js/campaign.js` | Reglas puras con paso fijo: robots, tarimas, máquinas, banda, energía, pedidos, hitos, serialización. |
| `js/campaign-terreno.js` | Relieve determinista: montes, río, muralla, carriles y colores. |
| `js/campaign-3d.js`, `js/campaign-plano.js` | Vista 3D (diorama low-poly, dos pieles) y plano con zoom. |
| `js/campaign-ui.js` | Inspector, ayuda, sugerencias, hitos e historial. |
| `shared/i18n/campaign.js` | Textos ES/EN de la serie. |
| `js/runtime.js`, `js/juego.js` | API del Worker (encargos múltiples, «cede») y enganche de la serie (`ES_CAMPAIGN`). |

Guardado (`cmg-banco03:`): `prog-campaign-0`, `fuentes-campaign-0`, `campaign-1-vivo`, `campaign-1-historial`, `campaign-telemetria`, `campaign-vista`, `campaign-piel`.

## Verificar

```bash
node pruebas/campaign-reglas.cjs
```

```bash
node pruebas/campaign-juego.cjs /ruta/de/capturas escritorio
```

La segunda necesita Playwright y el servidor en 8771: juega H0–H5 con los programas de `pruebas/campaign-soluciones.cjs`.

## Límites conocidos

- Los robots van en línea recta por el pasillo y no chocan entre sí.
- Los mensajes de error del runtime de Campaign salen en español también con la interfaz en inglés.
- Robots y máquinas son primitivas; el T1 de Factory aún no se usa aquí. La ensambladora es cerrada.
- La relación entre programa local y maestro es la mínima: un robot ocupado responde `"ocupado"`.
- Sin seudocódigo, bloques ni pulsos del código en el mapa para esta serie.
- Tiempos largos a 1× en H4 y H5 (4–5 min con un programa sencillo): usar 4× u 8×.
