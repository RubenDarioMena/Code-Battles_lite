# Code Battle Lite

Las instrucciones del proyecto están en [AGENTS.md](AGENTS.md). Usa ese mismo flujo y alcance. El código está en esta carpeta; no requiere el repositorio original.

**Línea canónica: `trunk`.** Todo trabajo terminado se integra en `trunk` con merge; las ramas de trabajo nacen de `trunk` actualizado. Detalle en [AGENTS.md](AGENTS.md).

**Plan vigente:** [`docs/PLAN-ARQUITECTURA.md`](docs/PLAN-ARQUITECTURA.md). Steam primero (Electron) y Android después; tecnología web, núcleo de simulación sin pantalla, vistas 2D y 3D intercambiables y editor reutilizable. Ya no rigen «sin compilación» ni «sin npm».

**Punto de partida del código:** la aplicación común de `Prototypes/Rocket Launcher/` (War, Factory con `?serie=factory`, Campaign con `?serie=campaign`) y `shared/`. El Factory original (`Prototypes/Tres vistas/`) está retirado y solo redirige; su comportamiento histórico queda en `pruebas/factory-oraculo.json` y su código en el historial (`b76411b`). `docs/PLAN-UNIFICACION.md` está cerrado.

**Rama `Campaign-V2`:** es la experiencia principal (fábrica y batalla en un nivel). Antes de tocarla, lee la sección «Rama `Campaign-V2`» de [AGENTS.md](AGENTS.md) y el vocabulario de [CONTEXT.md](CONTEXT.md).

**Tras cada push:** al terminar la tarea, entrega siempre los enlaces raw.githack (rama y commit), como indica [AGENTS.md](AGENTS.md).

**Harness:** lee [harness/REGLAS.md](harness/REGLAS.md) al empezar. Antes de tocar una pantalla, su spec en `docs/pantallas/` y el índice [docs/bugs/INDICE.md](docs/bugs/INDICE.md). Salidas HTML en `docs/salidas/`. Sin memoria automática.
