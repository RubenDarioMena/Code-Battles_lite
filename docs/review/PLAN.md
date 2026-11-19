# Plan de peer review y futuro harness

Estado: diseño v1, 18 de noviembre de 2026. Esta entrega publica instrucciones; no implementa el harness, no ejecuta tests y no inicia ciclos. Primer caso: UI del editor de Code Battle Lite; después se adaptará a otros proyectos.

## Propósito y documentos

Comparar revisores sobre cambios idénticos y conservar investigación para resolver regresiones más rápido. Mantener tres piezas vinculadas:
- Especificación por pantalla/feature: propósito, controles, estados, comportamiento esperado, límites intencionales, requisitos vigentes con IDs y versión. Separar expresamente roadmap y comportamiento requerido.
- [Historial del benchmark](REVIEW_BENCHMARK_PROGRESS.md): manifiestos, configuraciones, ciclos, métricas y enlaces a artefactos.
- Registro de bugs con ID estable: síntomas, requisito, pasos mínimos, evidencia, versiones afectadas, investigación, causa cuando se confirme, corrección/commit, verificación y recurrencias.

Ubicación prevista: `docs/review/specs/editor-ui.md` y `docs/review/bugs/<ID>.md`. No se crean especificaciones aprobadas ni bugs ficticios en esta entrega. El registro completo, las respuestas y el scoring viven en almacenamiento separado del entorno del revisor. Una futura copia pública de bugs no debe quedar accesible al benchmark.

`AGENTS.md` y `CLAUDE.md` solo apuntan a este plan para tareas pertinentes. El plan no autoriza ejecuciones automáticas.

## Inspección verificada

Se consultó GitHub; no se pudo inspeccionar el checkout local ni ramas locales sin publicar. Repositorio: [RubenDarioMena/Code-Battles_lite](https://github.com/RubenDarioMena/Code-Battles_lite).

| Rama remota | SHA observado | Papel |
| --- | --- | --- |
| `codemirror-mobile` | `567f7d6d54bb786e4da20a9cf48245e3d5e7ab45` | Integración más reciente de la superficie principal entre las ramas de editor consultadas; base elegida para este plan. |
| `revision-flujo` | `8c110b879a28fbe79fd95b3f9a035bc339b3da50` | Padre directo del cambio CodeMirror y base del benchmark. |
| `main` | `fb593e29e16132eefea0dd07fd11a18b78283073` | También contiene el script histórico de recuperación. No equivale a la integración CodeMirror seleccionada. |

No apareció una rama remota `outtesting` en el listado consultado. Esto no demuestra su eliminación histórica ni descarta una rama local. Mobile-Coder no se inspeccionó: `docs/CODEMIRROR-QA.md` del commit elegido indica que todavía no se había sincronizado allí el componente.

La nueva rama documental es `peer-review-harness-plan`, desde el SHA de `codemirror-mobile`; PR contra `codemirror-mobile` para que el diff contenga solo documentación. Una futura rama de implementación debe partir del commit que integre/apruebe este plan sobre el editor elegido, registrando su SHA. No mezclar mejoras del editor con cambios del protocolo.

## Primer benchmark congelado: CBL-EDITOR-001

- Cambio: `feat(editor): integrar CodeMirror con controles táctiles y QA comparativo`.
- Base exacta: `8c110b879a28fbe79fd95b3f9a035bc339b3da50`.
- Head exacto: `567f7d6d54bb786e4da20a9cf48245e3d5e7ab45`.
- [Commit](https://github.com/RubenDarioMena/Code-Battles_lite/commit/567f7d6d54bb786e4da20a9cf48245e3d5e7ab45) y [diff](https://github.com/RubenDarioMena/Code-Battles_lite/compare/8c110b879a28fbe79fd95b3f9a035bc339b3da50...567f7d6d54bb786e4da20a9cf48245e3d5e7ab45).
- PR original: no devuelta por la consulta de PRs asociadas a ese commit. Fecha de push: desconocida; la fecha de commit no demuestra cuándo se publicó.
- Modelo autor: **unknown**. El commit identifica una cuenta humana y no registra un modelo; no inferirlo de commits vecinos ni del modelo revisor.
- Archivos principales: `shared/editor/codemirror.js`, `codemirror.css`, `editor.js`, `edicion.js`, `nucleo-ui.js`, contrato, entradas de demo/juego, layout y pulsos. La superficie editable es `.cm-content`; `#codigo` queda como puerto oculto de compatibilidad.
- Fuentes para preparar requisitos: `shared/editor/CONTRATO.md` y `docs/CODEMIRROR-QA.md` en head. Sus informes históricos y soluciones no se entregan automáticamente al revisor.
- Antes de correr: aprobar una especificación normativa del editor para este head. Aún no está congelada.

Guardar una copia inmutable de base/head, diff exacto y hashes del paquete de contexto. Las ramas pueden moverse; nunca resolverlas de nuevo a mitad de una comparación. El SHA del plan no sustituye al SHA del futuro harness ejecutable.

## Script existente: qué se reutiliza y qué falta

`pruebas/recuperacion-editor.mjs` está en las tres ramas anteriores con blob `9d47ed573f490897ecc6d1d69711d95c06e20306`. Exporta `conectarCiclo(page, opciones)` y `reproducirCaso(page, archivo)`; no tiene un CLI de revisiones de modelos.

`pruebas/war-20-ciclos.mjs`, inspeccionado en head (blob `3c5ae3d6248cccdcf5bc559b6d78d2185bcc943e`), exporta `tanda(p, desde, hasta)`. Automatiza 20 intentos históricos: 10 escritorio y 10 móvil emulado. Usa salida absoluta fija, semilla fija y comprobaciones de recursos `juego.js?v=14` / `edicion.js?v=16`. No debe ejecutarse sin adaptación al editor elegido ni reutilizar su carpeta de evidencia.

Configuración histórica de recuperación:
```js
const ciclo = await conectarCiclo(page, {
  directorio: '<directorio absoluto nuevo>',
  config: {
    semilla: 'rocket-piloto-v1',
    intentos: 10,
    maxClics: 40,
    maxSegundos: 180,
    modalidad: 'piloto'
  }
});
```

No es un comando autónomo: requiere sesión de navegador, fixture, gestos, observación y cierre de intentos. El servidor documentado es `python3 -m http.server 8771 --bind 127.0.0.1`, desde la raíz. Referencia: `docs/CICLO-RECUPERACION-EDITOR.md`. Ningún comando se ejecutó en esta entrega.

El RNG elige caracteres visibles y botones de código permitidos; no recorre uniformemente toda la UI. La recuperación exacta de texto mide una tarea distinta de detectar bugs en un diff. Además, el módulo descarta trazas de intentos sanos: el benchmark de revisiones debe conservar **todas** las respuestas, incluso vacías o sin hallazgos.

La geometría/foco basados en textarea y los selectores históricos requieren revisión para CodeMirror. La UI sin teclado conserva otra representación; no asumir que adaptar solo `#codigo` resuelva todo. Estos scripts pueden ayudar a preparar evidencia y reproducción, pero no constituyen el runner de peer review.

**Harness ejecutable, commit, comando exacto y opciones: pendientes de implementación.** No inventar una invocación ni presentar `node pruebas/war-20-ciclos.mjs` como runner funcional de revisiones. Antes del primer run registrar binario/versión, comando literal, cwd, opciones, variables no secretas, lockfiles y SHA del harness.

## Contexto visible y aislamiento

Cada ciclo comienza en una sesión nueva, con el mismo checkout congelado, diff, prompt, especificación, instrucciones de sistema controlables, herramientas y presupuesto. Sin memoria de cuenta, conversaciones previas, soluciones, resultados anteriores ni scoring. Desactivar recuperación de memoria y conectores; registrar cualquier instrucción del proveedor que no sea controlable. El entrenamiento general del modelo no se puede borrar.

Preparar un paquete por lista explícita de archivos y hashes. Incluir código y dependencias necesarios, requisitos aprobados e instrucciones de entorno idénticas. Si se excluyen archivos del snapshot, conservar el inventario exacto y no llamarlo checkout completo sin aclararlo. No montar `.git`, remotos, red de GitHub, historiales de QA, `PROGRESO.md`, casos resueltos ni este historial de benchmark si pueden revelar respuestas. Revisar también tests y comentarios incluidos para evitar filtraciones; aplicar la misma selección a todos. La especificación pública no contiene IDs ni ubicaciones de bugs conocidos.

Aislar el almacenamiento del scoring mediante permisos y herramientas, no mediante «no leas esta carpeta». Un scorer separado recibe el oráculo privado y las respuestas crudas. No recibe identidad del modelo durante la adjudicación cuando sea viable. Un investigador de reparación sí puede consultar el historial completo después del benchmark.

## Configuraciones y ciclos

Plan: **50 ciclos independientes por configuración**. Si se decide extender, todas las configuraciones comparadas llegan a **80**, conservando los primeros 50. Registrar la decisión de extensión y su criterio antes del primer run; por defecto no extender automáticamente ni seleccionar solo ganadores. Informar resultados a 50 y a 80 por separado.

Una configuración fija:
- Módulo de revisión, versión/commit, prompt/plantilla y sus hashes.
- Proveedor, ID exacto y snapshot de modelo (no solo alias comercial), settings: esfuerzo, temperatura/top-p/seed si existen; marcar opciones no expuestas.
- Presupuesto común de entrada, salida, llamadas a herramientas, tiempo y política de truncamiento. Registrar uso real, coste y límites del proveedor.
- Herramientas/versiones, entorno, permisos de ejecución, fixtures, idioma y criterios de severidad.

Para comparar modelos mantener módulo/protocolo fijos. Para comparar módulos mantener modelo/settings fijos. Si se cambia otra variable, crear otra configuración y explicitar el factor de confusión. La versión interna del módulo se registra siempre, aunque el módulo sea el factor experimental.

Cada ciclo usa una nueva instancia y no recibe feedback del scorer. Alternar o sortear orden de configuraciones con semilla registrada para reducir sesgos temporales. Conservar la solicitud/respuesta cruda, salida estructurada, uso y errores de todos los ciclos. No reutilizar la sesión histórica de los ciclos con Astra. Esos ciclos incluyeron implementación, feedback y memoria, por lo que no son muestras independientes del benchmark.

Si falla infraestructura, conservar el intento y su motivo; no contarlo como revisión completada. Aplicar una política de reintentos limitada y prerregistrada, con IDs separados y vínculo al intento original. Una respuesta válida sin hallazgos sí cuenta. Alcanzar el presupuesto es un resultado registrado; distinguirlo de desconexión. No descartar resultados pobres ni repetir selectivamente.

## Prompt y contrato de salida propuestos

Congelar el siguiente texto, rutas y esquema antes de ejecutarlo:

> Revisa el cambio BASE..HEAD en el snapshot proporcionado usando únicamente el contexto autorizado. Busca defectos concretos atribuibles al cambio; separa problemas preexistentes. Fundamenta cada hallazgo en un requisito identificado o un fallo técnico demostrable. No conviertas roadmap, preferencias ni comportamiento ambiguo en bugs: registra preguntas de especificación aparte. No modifiques código. Devuelve todos los hallazgos dentro del presupuesto, aunque no encuentres ninguno.

Por hallazgo: ID local, título, ruta/líneas, severidad, esperado/observado, requisito o fundamento técnico, desencadenante/reproducción, evidencia y confianza. Salida adicional: preguntas de especificación, limitaciones y estado de completitud. No pedir cadenas privadas de razonamiento. Conservar salida original aunque la normalización falle.

## Oráculo privado y scoring

Antes del primer ciclo, un investigador congela lista de bugs confirmados en head, con IDs estables, requisito, reproducción/evidencia y alcance del diff. Separar bugs introducidos de preexistentes; métrica primaria sobre los introducidos/en alcance. No copiar automáticamente bugs de reportes viejos ni afirmar presencia actual sin verificación.

Guardar fuera del entorno del revisor: versión/hash del oráculo, evidencia y protocolo de adjudicación. El manifiesto público registra solo su ID/hash, no las respuestas. Si no hay bugs conocidos confirmados, declarar cobertura como no disponible; nunca inventar un denominador.

El scorer mapea hallazgos a bugs por causa/comportamiento reproducible, no por similitud de títulos:
- Bug conocido encontrado: un máximo de una detección de ese ID por ciclo.
- Duplicado: vincular al mismo ID, conservar reporte original, no sumar.
- Inválido: evidencia de que no ocurre, es esperado o está fuera del alcance definido; motivo obligatorio.
- Candidato nuevo: pendiente de confirmación, no falso positivo automático.
- Nuevo confirmado: reproducción o evidencia suficiente y adjudicación; asignar ID sin alterar retroactivamente el oráculo original.
- Pregunta/indeterminado: registrar incertidumbre y resolución pendiente.

Escalar desacuerdos a adjudicación humana o independiente con decisión y evidencia registradas. Un scorer de modelo no convierte su opinión en verdad confirmada por sí sola.

Métricas por configuración/cambio: bugs conocidos distintos detectados en el conjunto; cantidad por ciclo (media y distribución); para cada bug, ciclos que lo detectan / ciclos completados; cobertura por ciclo sobre el total elegible; inválidos y pendientes; nuevos confirmados; coste, tiempo y fallos de infraestructura. Mostrar denominadores, incertidumbre (por ejemplo intervalo binomial para frecuencia) y límites de una muestra de un solo cambio. Si se reporta precisión, definirla sobre hallazgos deduplicados adjudicados, mostrando pendientes por separado.

Comparar con una matriz por cambio, modelo autor (incluido unknown), módulo revisor y modelo revisor. No concluir que un modelo revisa mejor a cierto autor a partir de un único cambio; ampliar con varios casos y reportar composición de la muestra. Cambios de autor desconocido permanecen en su categoría.

## Historial para resolver recurrencias

Por bug guardar: ID, spec/versión, contexto, texto/inputs mínimos, primera detección y ocurrencias, investigación, hipótesis rechazadas con evidencia, causa confirmada, workaround, fix/commit/PR y verificación. Una recurrencia se añade con el commit afectado y vínculo al fix anterior; no borrar el cierre histórico. Si solo coincide el síntoma, vincular como posible relación hasta confirmar identidad.

Las reparaciones se realizan en otra fase/rama; el benchmark nunca modifica su snapshot. Los nuevos bugs confirmados pueden incorporarse a una versión siguiente del oráculo y a un caso futuro; no cambiar silenciosamente las puntuaciones publicadas.

## Antes del primer run

1. Aprobar la especificación del editor y resolver contradicciones entre documentos históricos y requisitos vigentes.
2. Confirmar oráculo privado con evidencia en el head elegido, ubicación aislada, hash y scorer/adjudicación.
3. Implementar y fijar módulo/runner, SHA, comando literal y opciones; fijar dependencias y entorno. Esta PR no los implementa.
4. Seleccionar modelos exactos, settings, presupuestos y política de reintentos/80 ciclos.
5. Congelar paquete visible con hashes y auditar filtraciones por historial, herramientas, red e instrucciones.
6. Registrar manifiestos y enlaces a artefactos; autorizar la ejecución como tarea posterior.

## Evolución a flujo continuo

Conservar CBL-EDITOR-001 como referencia inmutable. Cada cambio nuevo crea otro caso con base/head y especificación versionada; cada mejora del workflow crea otra versión/configuración. Separar revisiones continuas que descubren candidatos de las evaluaciones congeladas. Reutilizar IDs e investigación de bugs para reparación y regresión sin exponerlos en evaluaciones ciegas. Tras validar el prototipo, trasladar el protocolo a otros proyectos con sus propias specs y adaptadores; esta entrega no modifica esos repositorios.
