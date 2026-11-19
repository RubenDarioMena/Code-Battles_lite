# Code Battle Lite

Las instrucciones del proyecto están en [AGENTS.md](AGENTS.md). Usa ese mismo flujo y alcance. El código está en esta carpeta; no requiere el repositorio original.

**Base canónica de la unificación:** el 03 / War / lanzamisiles (`Prototypes/Rocket Launcher/`), siguiendo `docs/PLAN-UNIFICACION.md`. Factory ya corre en esta base (`?serie=factory`); el original (`Prototypes/Tres vistas/`) está retirado y solo redirige. Su comportamiento histórico queda en `pruebas/factory-oraculo.json` y su código en el historial (`b76411b`). Campaign queda fuera de este plan.

**Tras cada push:** al terminar la tarea, entrega siempre los enlaces raw.githack (rama y commit), como indica [AGENTS.md](AGENTS.md).

## Plan de peer review y seguimiento de bugs

El plan está en [docs/review/PLAN.md](docs/review/PLAN.md). Consúltalo solo al preparar revisiones, comparar revisores o investigar regresiones; no es necesario cargarlo para otras tareas. El documento describe el futuro harness y no autoriza ejecutar ciclos. El oráculo de bugs y el scoring deben quedar fuera del entorno del revisor del benchmark.
