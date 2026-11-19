# Code Battle Lite

Las instrucciones del proyecto están en [AGENTS.md](AGENTS.md). Usa ese mismo flujo y alcance. El código está en esta carpeta; no requiere el repositorio original.

**Base canónica de la unificación:** el 03 / War / lanzamisiles (`Prototypes/Rocket Launcher/`), siguiendo `docs/PLAN-UNIFICACION.md`. Factory ya corre en esta base (`?serie=factory`); el original (`Prototypes/Tres vistas/`) está retirado y solo redirige. Su comportamiento histórico queda en `pruebas/factory-oraculo.json` y su código en el historial (`b76411b`). Campaign queda fuera de este plan.

**Tras cada push:** al terminar la tarea, entrega siempre los enlaces raw.githack (rama y commit), como indica [AGENTS.md](AGENTS.md).

## Harness: reglas, specs, bugs y revisión

Lee [harness/REGLAS.md](harness/REGLAS.md) al empezar cualquier tarea. Antes de tocar una pantalla, abre su spec en `docs/pantallas/` (primera: [editor](docs/pantallas/editor.md)) y busca en [docs/bugs/INDICE.md](docs/bugs/INDICE.md). Las salidas HTML van en `docs/salidas/`. No uses memoria automática: lo que deba recordarse va a esos archivos. Flujo, roles y scripts: [harness/README.md](harness/README.md).
