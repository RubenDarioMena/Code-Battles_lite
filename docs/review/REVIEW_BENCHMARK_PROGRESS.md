# REVIEW_BENCHMARK_PROGRESS

[Plan y reglas](PLAN.md). Preparación documental; **0 ciclos ejecutados**, sin resultados ni tests nuevos. Registro por cambio/spec para comparar revisores y modelos autores y recuperar investigación de bugs.

## Cómo registrar

Cada entrada del historial se añade al final: no reescribir resultados previos. Correcciones, ampliaciones a 80 y re-scoring se publican como entradas nuevas con referencia al evento original. Conservar respuestas y hashes inmutables; no sobrescribir archivos al reintentar.

Un manifiesto debe incluir:
- case_id/spec_id/version/hash, repo, base/head completos, diff hash, URL de commit/PR/push cuando exista, modelo autor y evidencia (unknown si no hay registro fiable).
- protocol_version, commit documental y **harness_commit** ejecutable, comando literal/opciones/cwd, dependencias, entorno y permisos.
- config_id, módulo/versión/hash, proveedor y modelo exacto/snapshot, settings, prompt/context hashes, límites y herramientas.
- ciclos planeados, iniciados, completados, fallidos y reintentos; decisión prerregistrada de 50/80.
- oracle_version/hash y referencia privada para scoring; no incluir respuestas conocidas en el paquete visible.
- rutas/URLs de solicitud/respuesta cruda, normalización, scoring y adjudicación por ciclo.
- resultados: bugs conocidos distintos, frecuencias por ID y denominadores, distribución por ciclo, inválidos, duplicados, nuevos confirmados y pendientes; coste/tiempo/errores.

Artefactos previstos en almacenamiento de evaluación separado: `<case>/<protocol>/<config>/<cycle>/request.json`, `review.raw.txt`, `findings.json`, `usage.json`; scoring en almacenamiento privado con acceso distinto. No existen aún; registrar URIs reales y hashes al crear cada run.

Cada bug tendrá un registro estable enlazado a la spec y a sus ocurrencias/fixes, según el plan. Ese registro ayuda al investigador y scorer; no se monta en la sesión del revisor.

## Matriz de comparación (plantilla; sin resultados)

| Cambio/spec | Autor modelo/evidencia | Módulo/versión | Modelo revisor exacto/settings | Plan/completados | Distintos conocidos/frecuencias | Inválidos/nuevos/pendientes | Raw/scoring |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CBL-EDITOR-001 / spec pendiente | unknown / commit sin atribución de modelo | Por definir | Por definir | 50 por configuración; 0 | N/A: oráculo pendiente | N/A | No generados |

Añadir una fila por configuración y cambio. Para comparar autores, mantener las configuraciones revisoras y desglosar por varios cambios de cada autor; no mezclar diferencias de dificultad con identidad de autor.

## Historial append-only

### SETUP-001 · 18 de noviembre de 2026 · diseño sin ejecución

- Repo: `RubenDarioMena/Code-Battles_lite`. Rama documental `peer-review-harness-plan`, desde `codemirror-mobile@567f7d6d54bb786e4da20a9cf48245e3d5e7ab45`; PR contra `codemirror-mobile`.
- Caso CBL-EDITOR-001: integración CodeMirror; base `8c110b879a28fbe79fd95b3f9a035bc339b3da50`, head `567f7d6d54bb786e4da20a9cf48245e3d5e7ab45`.
- [Cambio exacto](https://github.com/RubenDarioMena/Code-Battles_lite/compare/8c110b879a28fbe79fd95b3f9a035bc339b3da50...567f7d6d54bb786e4da20a9cf48245e3d5e7ab45). PR original no devuelta por GitHub; fecha de push desconocida.
- Autor modelo: **unknown**; no inferido de cuenta Git ni de commits vecinos. Revisor módulo/modelo/settings: pendientes.
- Fuentes consultadas: ramas remotas, commit y archivos cambiados, instrucciones AGENTS/CLAUDE, README/VISION/PROGRESO, contrato, QA CodeMirror, recuperación y script de 20 ciclos. Inspección por GitHub; checkout y ramas locales sin verificar.
- Script de recuperación: `pruebas/recuperacion-editor.mjs`, blob `9d47ed573f490897ecc6d1d69711d95c06e20306`, igual en main/revision-flujo/codemirror-mobile. Repetición histórica: `pruebas/war-20-ciclos.mjs`, blob `3c5ae3d6248cccdcf5bc559b6d78d2185bcc943e`, inspeccionado en head. Exporta función, no CLI de peer review.
- Commit del harness ejecutable/comando exacto: **pendientes; no existe implementación en esta entrega**. El commit documental es identificable como el commit de creación de este archivo en esta rama (no se puede incluir su propio SHA dentro de sí mismo); registrarlo literalmente en el siguiente manifiesto antes de correr.
- Planeados: 50 por configuración, extensión de todas a 80 según regla previa. Iniciados/completados: **0/0**. Resultados, raw reviews y scoring: **no generados**.
- Verificación de esta entrega: lectura de fuentes y revisión del contenido documental; no tests ni ciclos. Los números de QA en documentos existentes son históricos, no nuevos resultados.
- Pendientes: spec aprobada, oráculo privado confirmado, runner y SHA/comando, configuraciones exactas y presupuestos, política de extensión/reintentos, aislamiento y autorización posterior para ejecutar.
