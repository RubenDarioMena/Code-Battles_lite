# Harness personal · v0 + v1

Capa de orquestación sobre Claude Code y Codex CLI. **No es un programa nuevo:** son reglas, plantillas y unos pocos scripts que cualquier agente lee y usa igual, en cualquier sesión y dispositivo. Vive aquí para probarlo con Code Battle Lite; cuando funcione se mueve a su propio repo y los demás proyectos lo enlazan.

## Las 5 capas (pizarra del 19-11-2026)

| Capa | Idea | Estado | Siguiente paso |
| --- | --- | --- | --- |
| 1 · Entrada | Hyper-marker como puerta de ideas y feedback (cualquier formato: texto, voz transcrita, flows, HTML anotado) | Pendiente. Las salidas HTML ya van a `docs/salidas/` para abrirlas en él | Fijar el formato de bug y de salidas; después, botón «feedback → bug o tarea» |
| 2 · Fuente de verdad | Sin servidor ni base de datos: un repo de harness con reglas, plantillas y scripts | v0 dentro de Code Battle Lite (`harness/`) | Moverlo a su propio repo tras 1–2 semanas de uso |
| 3 · Revisión y reglas | PR agéntico revisado por otro modelo; enrutador después. Sin memoria automática: todo en `AGENTS.md`, `CLAUDE.md` y `REGLAS.md` | `pedir-revision.sh` (Codex local, solo lectura). `autoMemoryEnabled: false` | Revisión en la nube con PRs; enrutador cuando haya datos de consumo |
| 4 · Historial de bugs | Registro con ID estable y recurrencias, buscable antes de arreglar | `docs/bugs/INDICE.md` + `nuevo-bug.mjs` (detecta duplicados) | Primer uso real |
| 5 · Docs por pantalla | Lista de features, partes conectadas, índice por palabras clave y método de QA muy concreto | Spec del editor (borrador) + clicker del editor + inspector de bloques (Mapa, Código, Misión… con su manifiesto) | Inventario de features de `trunk` y `campaign` con Haiku; luego HTML de inconsistencias con Sonnet; aprobar la spec |

## Qué hay

| Pieza | Para qué |
| --- | --- |
| [REGLAS.md](REGLAS.md) | El reglamento común. `AGENTS.md` y `CLAUDE.md` lo enlazan. Sustituye a la memoria automática. |
| [plantillas/](plantillas/) | Design doc, spec de pantalla y bug. Se copian; no se editan en su sitio. |
| [revision/instrucciones.md](revision/instrucciones.md) | Lo que lee el revisor (GPT o Claude) al revisar un cambio. |
| [scripts/pedir-revision.sh](scripts/pedir-revision.sh) | Pide una revisión a Codex CLI del rango de la rama y la guarda en `docs/revisiones/`. |
| [scripts/nuevo-bug.mjs](scripts/nuevo-bug.mjs) | Busca duplicados en el registro y crea el bug con ID estable. |
| `pruebas/clicker-editor.mjs` | Random clicker del editor (QA nivel 1, sin modelos). |
| [inspector/](inspector/) | Inspector de bloques (Mapa, Código, Misión…): capturas reales con su lista de elementos y comparación entre ramas. |

En el proyecto:

| Carpeta | Contenido |
| --- | --- |
| `docs/pantallas/` | Una spec por pantalla: features, partes conectadas, palabras clave y método de QA. Primera: [editor](../docs/pantallas/editor.md). |
| `docs/bugs/` | [Índice](../docs/bugs/INDICE.md) y un archivo por bug. |
| `docs/revisiones/` | Revisiones guardadas, una por rama y commit. |
| `docs/salidas/` | HTML que pides a los agentes, para abrir en Hyper-marker o raw.githack. |
| `docs/qa/clicker/` | Informes del clicker. |

## El flujo

1. **Idea → design doc.** Con GPT por voz o en conversación. Se guarda con la [plantilla](plantillas/design-doc.md) en `docs/` del proyecto.
2. **Design doc → implementación.** Claude para lo visual o lo delicado; Codex para refactors largos y tareas bien especificadas. El agente lee antes la spec de cada pantalla que toca.
3. **Comprobaciones gratis.** Suites del proyecto y el clicker. Nada de modelos todavía.
4. **Revisión por otro modelo.** `harness/scripts/pedir-revision.sh <base>`. Quien implementó corrige lo que proceda.
5. **Tu QA manual.** Solo sobre trabajo que pasó 3 y 4. Tu feedback (Hyper-marker o texto) se convierte en tareas o en bugs.
6. **Cierre.** Bugs registrados, checklist de la spec actualizada y entrada en `PROGRESO.md`.

## Roles por defecto

| Rol | Quién |
| --- | --- |
| Design docs, conversación, imágenes | GPT (app) |
| Implementación visual o delicada | Claude |
| Refactors largos, tareas bien especificadas | Codex CLI |
| Revisión | El modelo que **no** escribió el cambio |
| QA repetitivo | Scripts primero; un modelo solo para juzgar lo que un script no puede |

## Cómo arrancar una sesión

Pega esto al empezar con cualquier agente:

> Lee `harness/REGLAS.md` y la spec de `docs/pantallas/` de lo que vas a tocar. Tarea: …

## Revisión con Codex

En la máquina donde Codex CLI tiene sesión iniciada:

```bash
harness/scripts/pedir-revision.sh main
```

El primer argumento es la rama base. Opcionales: `MODELO=<id>` y `NOTA="qué mirar en especial"`. Usa sandbox de solo lectura, sesión efímera y memoria desactivada. El resultado queda en `docs/revisiones/<fecha>-<rama>-<commit>.md`, y luego se le pasa al agente que implementó.

Para revisiones en la nube sin depender de esa máquina, la vía es Codex conectado a GitHub con tu cuenta pagada, revisando PRs. Está en pendientes porque requiere trabajar con PRs.

## Clicker del editor

```bash
node pruebas/clicker-editor.mjs --pasos 200
```

Arranca el servidor en 8771 si no está corriendo. Prueba escritorio y móvil, y deja `informe.html` en `docs/qa/clicker/<fecha>-<semilla>/`. Con la misma semilla repite exactamente los mismos pasos. Necesita Playwright (`npm i -g playwright && npx playwright install chromium`). Más en la [spec del editor](../docs/pantallas/editor.md#método-de-qa).

## Pendientes (se activan cuando se cumpla el requisito)

| Pendiente | Requisito |
| --- | --- |
| Revisión automática en la nube (Codex en GitHub) | Trabajar con PRs en vez de push directo a ramas |
| Mover el harness a su propio repo | Que v0 y v1 funcionen una o dos semanas aquí |
| Hyper-marker como interfaz (feedback → bug o tarea) | Formato de bug y de salidas estable |
| Supabase como índice entre dispositivos | Saber qué consultas haces de verdad desde varios dispositivos |
| Enrutador de modelos | Medir consumo por tipo de tarea. Revisar términos de uso: no repartir cuentas de suscripción |
| Clicker para War y Factory | Que el del editor demuestre utilidad |
