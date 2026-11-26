# Campaign-V2 · plan de implementación por porciones

Cada porción es vertical: deja algo jugable o comprobable y pruebas en verde. Las decisiones están en `DECISIONES-GRILL.md` y `DECISIONES-WAYFINDER.md` (tickets 01–12), y el glosario en `/CONTEXT.md`. Los valores de juego son experimentales.

| # | Porción | Entrega | Depende de | Estado |
| --- | --- | --- | --- | --- |
| P1 | Esqueleto y paridad | Paquete `reglas-campaign-v2` con War inyectado. Nivel 1 con B1–B5 (`{ war: N }`) y marco. Modos paridad y ensayo por URL. Validador, prueba de contenido y prueba de paridad (10 referencias). | — | hecha |
| P2 | Fábrica, puente y checkpoint | `produccion.js` extraído de `reglas-campaign`, hito de fábrica de munición básica, bodega → suministro (función pública de War), secuencia H0 → B1…, checkpoint como instantánea, catálogo i18n del nivel. Antes, grabar desde War una victoria de B1 y una partida con atascos como referencias. | P1 | hecha |
| P3a | Runtime base del primer corte | Errores aislados, aplicar ahora, grabar y repetir desde el checkpoint o el ensayo y pausa con cola visible. [Informe y pruebas](P3a-INFORME.md). | P1, P2 | hecha |
| P3b | Eventos del primer corte | Transporte de eventos con hilos, clic programado (`terrain/enemies.onClick`, `regularShoot(objetivo)`), gestos y orden puntual, nodo «cuando» del seudocódigo y pruebas Python. [Informe y pruebas](P3b-INFORME.md). | P3a | hecha |
| P4a | Escenario 3D en metros | Terreno papercraft, Traba, torreta con rig, piel de combate, fábrica H0 y colocador en campaña y ensayo. [Informe y revisión manual](P4a-INFORME.md). | P2, P3b | hecha |
| P4b | UI del primer hito | Botón Misión «!», metas en columna, selector 3D/2D centrado, fichas, árbol de unidades y menú ⋯. [Informe y comprobaciones visuales](P4b-INFORME.md). | P4a | hecha |
| P5a | Movimiento, VEH y tirador | Puerta, movimiento, proyectil V2, destrucción, reaparición y ensayo Salida. [Informe y coste real](P5a-INFORME.md). | P3b, P4b | hecha |
| P5b | WHL, minador y menú de pruebas | WHL con reaparición, minador y selección de ensayos desde el menú de pruebas. | P5a | hecho |
| P6 | Documentación de rama | `AGENTS.md` y `CLAUDE.md` con la dirección de Campaign-V2, `MENU-PRUEBAS.md`, el consolidado en `docs/Vision/2026-11-23/` y `PROGRESO.md` nuevo. | continua | hecha salvo el consolidado: `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md` y `MENU-PRUEBAS.md` al día; `PROGRESO.md` empieza en Campaign-V2 y lo anterior está en `docs/historico/`. El consolidado preprototipo del 23-nov (21:33) no está en el repositorio: falta que el autor lo aporte. |

Línea base de pruebas de trunk en este worktree: `node pruebas/todas.mjs` da 63 ok y 7 fallos (`vfx-dibujantes`, `medir-carga-node`, `publicables`, `steam-empaquetado`, `steam-vdf`, `globales-juego` y `juego-identificadores`). Los 7 fallan solo porque no hay `node_modules` (falta `typescript` y otras dependencias), no por el código.
