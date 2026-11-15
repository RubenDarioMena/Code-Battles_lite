# Code Battle Lite

Las instrucciones del proyecto están en [AGENTS.md](AGENTS.md). Usa ese mismo flujo y alcance. El código está en esta carpeta; no requiere el repositorio original.

**Plan vigente:** [`docs/PLAN-ARQUITECTURA.md`](docs/PLAN-ARQUITECTURA.md). Steam primero (Electron) y Android después; tecnología web, núcleo de simulación sin pantalla, vistas 2D y 3D intercambiables y editor reutilizable. Ya no rigen «sin compilación» ni «sin npm».

**Punto de partida del código:** la aplicación común de `Prototypes/Rocket Launcher/` (War, Factory con `?serie=factory`, Campaign con `?serie=campaign`) y `shared/`. El Factory original (`Prototypes/Tres vistas/`) está retirado y solo redirige; su comportamiento histórico queda en `pruebas/factory-oraculo.json` y su código en el historial (`b76411b`). `docs/PLAN-UNIFICACION.md` está cerrado.

**Tras cada push:** al terminar la tarea, entrega siempre los enlaces raw.githack (rama y commit), como indica [AGENTS.md](AGENTS.md).
