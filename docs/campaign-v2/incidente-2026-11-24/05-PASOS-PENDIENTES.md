# Pasos pendientes de Campaign-V2, en tareas cortas

Cada fila es una tarea según [03-PROCEDIMIENTO-ASTRA.md](03-PROCEDIMIENTO-ASTRA.md):
- un resultado;
- 5 archivos como máximo;
- 30 llamadas como máximo;
- lanzada con la ventana de cuota fresca.

**Talla:** S = unas 15 llamadas, M = unas 30. Si una tarea M se corta, se parte en dos; no se relanza tal cual.

**Quién:** A = Astra, C = Claude. «A high» es la primera vez que se construye algo; «A med», contenido o corrección que repite un patrón.

## 0. Preparar el procedimiento (antes de cualquier tarea de Astra)

| Id | Resultado | Quién | Talla |
|---|---|---|---|
| T00a | `docs/campaign-v2/MAPA-CONTEXTO.md`: módulos de V2, interfaces y dónde se enchufan un nivel, una mecánica, un asset y un VFX (3–5 k tokens) | C | — |
| T00b | `docs/campaign-v2/REGISTRO-TAREAS.md`, con una fila por tarea: cuenta, llamadas, entrada, cuota, resultado y revisión | C | — |
| T00c | Tarea piloto con `lanzar-v3.sh` (por ejemplo, T03). Valida que `project_doc_max_bytes`, `tool_output_token_limit` y los topes funcionan, y mide el coste real de una tarea S | A med | S |

## 1. Deuda vista en la auditoría

| Id | Resultado | Quién | Talla |
|---|---|---|---|
| T01 | El 3D se redibuja al terminar de cargar teselas, muralla y modelos (hoy la primera carga puede salir sin paisaje) | A med | S |
| T02 | `Prototypes/Campaign-V2/` no carga CSS de `../Rocket Launcher/`: copia solo las reglas que usa | A med | S |
| T03 | Tipos: los dos accesos a `mundo.hito` (`ciclo-programas.js`, `repetir-intento.js`) sin diagnósticos | C | — |
| T04 | Un solo `campaign-v2.js` en `paquetes/app/`: renombrar el de 2 líneas o fundirlo | C | — |
| T05 | Sacar las ramas de V2 de `estado.js`, `arranque.js` e `iniciar.js` hacia el módulo de composición de V2 | A high | M |
| T06 | Lo mismo en `ciclo-programas.js` (+119 líneas de V2) | A high | M |
| T07 | Lo mismo en `programas.js` y `conductor.js` | A high | M |

T05–T07 se pagan una vez y abaratan todas las tareas siguientes, porque dejan de necesitar el armazón compartido.

## 2. Más mapa visible

| Id | Resultado | Quién | Talla |
|---|---|---|---|
| T08 | El campo de batalla carga las teselas que encuadra la cámara (de las 16, no solo 2), con el LOD que ya existe | A high | M |
| T09 | La losa de la fábrica queda bajo las máquinas (x ≈ 174–207): ajustar `mapa-ampliado.json` y regenerar las teselas afectadas | A high, con Blender fuera del sandbox | M |
| T10 | El kit de paisaje (10 GLB: pinos, alcornoque, rocas, matorral, torre…) repartido fuera del campo, sin tapar la muralla ni los bastiones | A med | S |

## 3. Assets de unidades

| Id | Resultado | Quién | Talla |
|---|---|---|---|
| T11 | VEH exportado a GLB desde `unidades_batalla` (con LOD y nombres de nodos para el rig) | A high, con Blender | M |
| T12 | El VEH del juego usa el GLB nuevo en lugar del tubular provisional | A med | S |
| T13 | Modelo y GLB del tirador, en sustitución de la primitiva de War | A high, con Blender | M |
| T14 | WHL (rueda kamikaze) exportada a GLB | A high, con Blender | M |

## 4. VFX de armas

| Id | Resultado | Quién | Talla |
|---|---|---|---|
| T15 | Empaquetar los VFX de artillería de `arte/blender/vfx` (`empaquetar.py`) en un formato que cargue la vista 3D | A high | M |
| T16 | El disparo y el impacto del misil de LAU usan el VFX nuevo | A med | S |
| T17 | El disparo del VEH y el del tirador usan VFX propios | A med | S |

## 5. P5b, partida en tareas

| Id | Resultado | Quién | Talla |
|---|---|---|---|
| T18 | Mecánica WHL: carpeta propia (`ficha.js` y `reglas.js`), 2 líneas en `paso.js`, explosión con `danoEnArea` | A high | M |
| T19 | Reaparición de WHL en la base | A med | S |
| T20 | Minador (carpeta propia y ensayo) | A med | M |
| T21 | Menú de pruebas que lista los ensayos (Salida y los nuevos) | A med | S |

## 6. Nuevos niveles

| Id | Resultado | Quién | Talla |
|---|---|---|---|
| T22 | Definir con el autor los niveles nuevos: objetivo, mecánicas que usan, mapa y assets. Sin esto no hay brief | C con el autor | — |
| T23… | Un nivel por tarea: 2 archivos propios y 1 línea en `nivel.js` (el coste medido en el wayfinder), más su prueba de contenido | A med | S |

## 7. Documentación de rama (P6)

| Id | Resultado | Quién | Talla |
|---|---|---|---|
| T30 | `AGENTS.md`, `CLAUDE.md`, `MENU-PRUEBAS.md` y `PROGRESO.md` de la rama, con el procedimiento nuevo | C | — |

## Orden sugerido

1. **T00a–T00c**: el procedimiento y una tarea piloto para medir el coste.
2. **T01–T04**: deuda barata y visible.
3. **T05–T07**: desacoplar. Abarata todo lo que viene después.
4. **2, 3 y 4 intercalados**: mapa, unidades y VFX. Cada bloque se revisa en el navegador antes de seguir.
5. **P5b (T18–T21).**
6. **T22** con el autor, y después un nivel por tarea.

**Sin commits ni push** hasta que el autor lo pida. Cada tarea queda en el índice de git, para que se pueda revisar por separado.
