# Auditoría · Campaign-V2 con Astra (24-nov-2026)

Fuentes: los registros de sesión de las dos cuentas (`~/.codex/sessions`, `~/.codex-astra/sessions`), el diff del worktree contra trunk (`HEAD` = `6330c0ed`) y las ramas `origin/assets-3d` y `origin/papercraft-campaign`. Las cifras de tokens salen de los eventos `token_count`, y las de cuota, de `rate_limits`.

## Resumen

- **Los tokens se fueron en leer, no en escribir.** En el 24-nov, las porciones consumieron unos **70,7 M de tokens de entrada**: el 97 % fue entrada cacheada que se reenvía en cada llamada. Astra escribió solo unos **250 k de salida**.
- **El 84 % de lo reenviado son volcados de archivos enteros** (`cat`, `sed -n`, `rg`). Cada porción arranca en frío: vuelve a leer los mismos documentos y los mismos archivos grandes de la app. Esos volcados se quedan en el contexto y viajan en cada una de las ~60 llamadas siguientes.
- **Cada porción cuesta entre el 70 y el 85 % de una ventana de 5 h y entre el 11 y el 14 % de la cuota semanal.** Desde el reinicio semanal, `codex` va de 0 a 47 % y `codex-astra` de 9 a 56 %.
- **Unas 1,3 porciones de cuota se perdieron en cortes y atascos.** Cuatro porciones se cortaron a medias (P3a, P4b, P5a y Página). La continuación vuelve a leerlo todo, y un intento de P5a se atascó cuatro horas.
- **El código no está fuera de control:** no hay archivos huérfanos ni restos, la suite da 82 ok, y War y las partidas de referencia siguen intactas. Lo que sí pesa es el acoplamiento: **V2 añade 350 líneas en 18 archivos compartidos de `paquetes/app/`**. Eso obliga a cada porción a cargar esos archivos.
- **Los assets están copiados, pero casi no se usan.** 257 de 259 archivos de `assets-3d` llegaron idénticos (fue una copia, no trabajo de Astra). En ejecución V2 carga 2 de 16 teselas de mapa, 3 de 20 piezas de muralla y 0 de 10 del kit de paisaje. Las unidades de batalla y los VFX solo existen como fuente de Blender.

## Coste por porción (24-nov)

| Porción | Sesiones | Llamadas al modelo | Entrada (M) | Salida (k) | Ventana 5 h | Semana |
|---|---|---:|---:|---:|---|---:|
| P1 Esqueleto y paridad | codex | 38 | 4,4 | 18 | 0 → 41 % | +6 % |
| P2 Fábrica, puente, checkpoint | codex | 56 | 8,5 | 32 | 0 → 70 % | +11 % |
| P3a Runtime base | codex (cortada) + cierre en astra | 26 + 26 | 2,6 + 2,0 | 13 + 6 | 71 → 100 %, luego 0 → 21 % | +5 % y +3 % |
| P3b Eventos y gestos | astra | 67 | 9,9 | 33 | 22 → 99 % | +13 % |
| P4a Escenario 3D | codex | 53 | 8,1 | 35 | 0 → 71 % | +11 % |
| P4b UI del primer hito | codex (cortada) + astra (rehízo la lectura) | 21 + 66 | 2,1 + 10,9 | 10 + 30 | 73 → 98 %, luego 0 → 84 % | +4 % y +13 % |
| P5a Movimiento, VEH, tirador | astra (sin cuota) + codex (atascada 4 h) + astra | 13 + 18 + 65 | 0,8 + 1,0 + 10,7 | 6 + 5 + 34 | 86 → 99 %, 0 → 32 %, 4 → 88 % | +2 %, +5 % y +13 % |
| Página propia | astra (sin cuota) + codex | 10 + 62 | 0,5 + 9,1 | 1 + 26 | 90 → 100 %, luego 0 → 70 % | +1 % y +11 % |
| **Total** | | **~620** | **~70,7** | **~250** | | |

Fuera de las porciones:
- **22-nov:** una sesión en el worktree `papercraft` (motor de vóxeles de la muralla) gastó 11,5 M y el 14 % de la semana.
- **23-nov:** el diseño gastó 0,9 M en la arquitectura alternativa de Astra y 3,5 M en dos sesiones con `gpt-6-luna`.

Lo que se obtuvo: unas **6 000 líneas de código y pruebas**, más 1 800 de documentación. No cuentan los ~42 000 de assets copiados.

## En qué se fueron los tokens

Cada llamada al modelo reenvía todo el contexto acumulado. El contexto empieza en ~25 k tokens (AGENTS.md y el brief) y sube hasta 200–240 k. Con ~60 llamadas por porción, eso da unos 9–10 M por porción. Lo que lo infla, ordenado por peso:

1. **Volcados de archivos enteros al principio de la sesión.**
   - Cada volcado llega al tope de salida de la herramienta (~42 000 caracteres) y viaja en todas las llamadas siguientes.
   - Uno solo leído al principio cuesta 0,5–0,7 M de tokens reenviados.
   - Ejemplos que se repiten en casi todas las porciones:
     - `cat paquetes/app/juego/{campaign-v2,programas,ciclo-programas}.js`;
     - `cat paquetes/app/conductor.js paquetes/anfitrion/{api,trabajador}.js`;
     - `nl -ba "Prototypes/Rocket Launcher/index.html"`.
   - El brief decía «no leas enteros los archivos de más de 600 líneas», pero Astra concatena varios archivos medianos en una sola llamada y la regla no lo frena.
2. **Lectura obligatoria de AGENTS.md en cada sesión.** Pide leer `docs/PLAN-ARQUITECTURA.md` (27 k caracteres), `README.md` (26 k), `VISION.md`, `harness/REGLAS.md` y `PROGRESO.md`. Son ~0,5–0,7 M por porción, casi 8 M en el día, para un contexto que no cambia entre porciones.
3. **Arranques en frío.** Ninguna porción hereda lo que entendió la anterior. Las 8 porciones releyeron casi los mismos 15–20 archivos de `paquetes/app/` y los informes previos.
4. **Continuaciones tras un corte.** Cuando una cuenta se queda sin cuota, la otra empieza de cero sobre el árbol: vuelve a pagar los puntos 1–3 y luego revisa el trabajo a medias. Pasó en P3a, P4b, P5a y Página.
5. **Intentos inútiles que se repiten.** En casi cada porción Astra intentó abrir el puerto 8771 y lanzar Ego Lite. El sandbox lo deniega siempre, y cada intento añade llamadas y contexto.
6. **El atasco de P5a.** La sesión de `codex` de las 16:30 pasó más de 1,5 h entre respuestas. Gastó el 32 % de la ventana con apenas 1 M de tokens y 7 borradores. No había vigilante de inactividad.

Lo que **no** explica el gasto: la suite de pruebas (0,1 % de lo reenviado) y la salida del modelo (0,4 %).

### Parte de la causa es el plan, no Astra

Decidí que V2 fuese una serie dentro del armazón de Rocket Launcher. Eso hizo que cada porción necesitara entender y tocar archivos grandes y compartidos: `ciclo-programas.js`, `estado.js`, `programas.js`, `info-reto.js` y el HTML de 511 líneas. La porción «Página propia» deshizo parte de eso, pero las 350 líneas de V2 siguen en `paquetes/app/` y cada porción futura tendrá que cargarlas.

## Estado del código

**Bien:**
- No hay archivos nuevos sin referencias.
- No quedan `TODO` ni `console.log` en el código del juego: los `console.log` añadidos están en pruebas y herramientas.
- La suite da 82 ok, más los 7 fallos de siempre por falta de `node_modules`.
- `reglas-war`, `partidas.json`, `reglas-campaign` y Rocket Launcher coinciden con trunk, salvo la redirección y las dos funciones públicas de War.

**Para vigilar:**
- **Acoplamiento con la app compartida:** 350 líneas añadidas y 79 retiradas en 18 archivos de `paquetes/app/`. Las más grandes:
  - `ciclo-programas.js`, +119;
  - `programas.js`, +53;
  - `conductor.js`, +45;
  - `estado.js`, +45.
- **La página nueva toma estilos de `../Rocket Launcher/css/`** (`base.css`, `componentes.css`, `layout.css`). Si Rocket Launcher cambia, V2 cambia con él.
- **Dos archivos se llaman `campaign-v2.js`:** `paquetes/app/campaign-v2.js` (2 líneas) y `paquetes/app/juego/campaign-v2.js` (205).
- **TypeScript** marca dos accesos a `mundo.hito` (`ciclo-programas.js` y `repetir-intento.js`) desde P3b, y nadie los ha corregido.
- **Astra nunca vio el juego en un navegador:** el sandbox se lo impide. Toda la revisión visual depende de Claude, y en el panel del navegador, a 2 fps, no se puede ver una batalla entera.

**Fallos vistos y sin corregir:**
- **La primera carga del 3D puede salir sin terreno ni muralla.** Los modelos llegan con 200, pero la escena no se vuelve a dibujar hasta que algo cambia (cambiar de vista lo arregla). Lo vi en la página nueva.
- **La losa de la fábrica está horneada en x 72–113 m**, lejos de las máquinas (x ≈ 201). Hay que regenerar las teselas.

## Assets

| Grupo | En el árbol | Usado en ejecución por V2 |
|---|---:|---|
| Teselas de mapa `papercraft/glb/mapa` | 16 | 2 (`terreno-1-1`, `terreno-1-2`): solo la franja de batalla, por eso se ve poco mapa |
| Muralla `papercraft/glb/muralla` | 20 | 3 piezas (opción 03 tramo y nudo, opción 07 nudo) |
| Kit de paisaje `papercraft/glb/kit` (pinos, alcornoque, rocas, matorral, torre…) | 10 | 0 |
| Torreta de observación, vehículo tubular, T1 con rig | 3 | 3 |
| Unidades de batalla (VEH, WHL…) `unidades_batalla.blend/.py` | solo fuente | 0: el tirador usa la primitiva de War |
| Generador de VFX de artillería `arte/blender/vfx` | solo fuente | 0: las armas usan los efectos de War |

**La copia fue barata:** 257 de 259 archivos son idénticos a `origin/assets-3d`. Los dos distintos solo cambian una ruta, porque los modelos pasaron a `Prototypes/Campaign-V2/modelos/`. **Lo que falta no es traer assets, es usarlos:** colocar el kit y las demás teselas, exportar las unidades de batalla a GLB y conectar los VFX.

## Recomendaciones antes de seguir

1. **Mapa de contexto de V2:** un solo archivo de 3–5 k tokens con:
   - los módulos que importan;
   - sus interfaces;
   - dónde se enchufa un nivel, una mecánica, un asset o un VFX;
   - qué archivos no hace falta abrir.

   El brief dirá que sustituye a las lecturas obligatorias de AGENTS.md para esa porción. Ahorro estimado: el arranque en frío y los puntos 1–3, la mayor parte del gasto.
2. **Reglas de lectura en el brief:**
   - prohibido `cat` de archivos o grupos de más de 150 líneas;
   - primero `rg -n` y luego `sed -n` con rangos;
   - nada de `nl -ba` de un HTML entero;
   - prohibido intentar abrir puertos o navegadores.
3. **Porciones más pequeñas, que quepan en ~40 % de una ventana de 5 h**, y lanzadas solo con la ventana fresca: el lanzador comprobaría la cuota antes de empezar. Así se evitan los cortes a medias, que obligan a releerlo todo.
4. **Un vigilante de inactividad en el lanzador:** si la sesión no registra eventos en 20 minutos, se corta y se avisa.
5. **Sacar las ramas de V2 de `paquetes/app/` hacia su módulo de composición.** Así las porciones de contenido (niveles, assets, VFX) no necesitan cargar el armazón compartido. Es una porción en sí, pero la recuperan las siguientes.
6. **Repartir el trabajo según quién lo puede hacer bien:**
   - Astra rinde en 3D y lógica;
   - la revisión visual necesita navegador, y Astra no lo tiene en el sandbox;
   - para mapa, kit y VFX: Astra construye, Claude revisa capturas en el navegador con el panel visible, y las correcciones salen con Astra en esfuerzo medio.
