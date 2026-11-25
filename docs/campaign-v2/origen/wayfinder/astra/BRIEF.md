# Brief para Astra · arquitectura alternativa de Campaign-V2 (alias «B2»)

Trabajas solo, sin humano disponible. **No hagas preguntas a nadie.** Si te falta un dato, decide una suposición razonable, escríbela en la sección «Suposiciones» y sigue. Si un archivo o rama no existe, anótalo en «Faltantes» y no inventes su contenido.

## Objetivo único

Diseñar **una** arquitectura para el prototipo Campaign-V2 que adapte los retos 1–5 de War dentro de una campaña con fábrica, y que permita añadir niveles y mecánicas nuevas **con cambios localizados y poco contexto para el agente que los haga**. Otro agente (Claude) diseña otra arquitectura en paralelo sin ver la tuya; luego se comparan. No hay que implementar nada.

## Lo que ya está decidido (no lo reabras)

- Decisiones del autor: `docs/grill/DECISIONES-GRILL.md` (léelo entero).
- Glosario: `docs/grill/CONTEXT-borrador.md`. Usa esos términos («Batalla», no «reto»; «Torreta esfera», no «LAU»; etc.).
- «B2» en el encargo original = el prototipo Campaign-V2.
- **Decisión vigente:** el laboratorio de batalla de la rama `ccr-684f16c6-yq5at1` ya **no** es independiente: sus mecánicas se incorporan a Campaign-V2 como «modo de batalla integrado» para probar. Lo que dice su propuesta sobre «laboratorio aparte» es solo historia.
- Los valores de alcance, vida y cadencia del laboratorio son experimentales.

## Fuentes (léelas con `git show`, no cambies de rama)

El árbol de trabajo está en otra rama con cambios sin confirmar: **no hagas checkout, stash, reset ni commits.** Lee así: `git show origin/trunk:<ruta>` y `git ls-tree -r --name-only origin/trunk <carpeta>`.

1. `origin/trunk` (referencia de arquitectura): `docs/PLAN-ARQUITECTURA.md`, `docs/REGLAMENTO.md`, `paquetes/README.md`, y los `README.md` e `index.js` de `paquetes/{protocolo,nucleo,reglas-war,anfitrion,vista-3d,app}`. Mira `paquetes/reglas-war/retos.js` para los 5 retos y `pruebas/fronteras` para el control de imports.
2. `origin/ccr-684f16c6-yq5at1`: `docs/PROPUESTA-MECANICAS-BATALLA.md` y `laboratorio/batalla/js/{runtime,mundo,escenarios}.js` (mecánicas: vehículo VEH, rueda WHL, `onClick`, `onDamage`, `track`, radar, varios hilos por programa).
3. `origin/assets-3d`: solo el listado (`git ls-tree -r --name-only origin/assets-3d | grep -E "\.(glb|blend|py)$|rig|muralla"`) y `paquetes/rig/README.md` si existe. No abras binarios.

Presupuesto de lectura: no leas archivos enteros de más de 600 líneas; usa `grep -n` y rangos.

## Casos de prueba de extensibilidad (no son requisitos del primer corte)

Evalúa tu arquitectura contra estos casos, escribiendo para cada uno **qué archivos se tocan**:

- A. Añadir la Batalla 6: contenido nuevo que solo reutiliza mecánicas existentes.
- B. Vehículo del jugador de alcance medio/corto que sale de la muralla (movimiento, ruta por puertas, recarga dentro).
- C. Rueda kamikaze (detonación en área, reaparición con programa reiniciado).
- D. Cinco arquetipos: camión de munición, señuelo, minador, dron explorador, escudo de puerta.
- E. Eventos `onClick`, `onDamage`, `onArrive`, `onEnemySeen`; seguimiento `track(id)`; `signal`/`onSignal` entre unidades.
- F. Radar y visibilidad (niebla, sensor móvil que la disipa).
- G. Asociar un GLB con rig a una unidad nueva (por ejemplo VEH).

## Criterios (todos pesan igual; no optimices uno solo)

1. Archivos o módulos **compartidos** que hay que cambiar por cada caso A–G.
2. Pruebas existentes afectadas (paridad con War: retos 1–5 × semillas 1 y 7 deben dar la misma huella).
3. Contexto que necesita cargar un agente para hacer el cambio (qué archivos debe leer). **No inventes cifras de tokens**: cuenta archivos y líneas aproximadas cuando puedas medirlas.
4. Facilidad de rehacer o descartar el cambio.
5. Coherencia con trunk: no impongas un framework o abstracción sin evidencia en trunk. Si propones algo nuevo, di qué problema concreto de trunk resuelve y cómo se comprueba.
6. Determinismo y fronteras de trunk (Node sin DOM en reglas, órdenes con `origen`).

## Entregable (uno solo)

Escribe **un único archivo**: `.scratch/campaign-v2-wayfinder/astra/ARQUITECTURA-ASTRA.md`, de **máximo 350 líneas**, en español, con estas secciones en este orden:

1. **Resumen en 8 líneas** en lenguaje llano, como para alguien que no ha leído el código. Sin nombres de funciones internas. Sin jerga.
2. **La idea central** (1 párrafo + un diagrama ASCII de paquetes y flechas de import).
3. **Qué cambia respecto a trunk** (tabla: paquete · se queda / cambia / nuevo · por qué).
4. **Cómo se añade un nivel** y **cómo se añade una mecánica**: recetas de pasos, con los archivos que se tocan.
5. **Tabla de casos A–G** × criterios 1–4.
6. **Qué entra en el primer corte (Batalla 1), qué queda como extensión prevista y qué necesita definición.**
7. **Riesgos y lo que no sabes** (máximo 10 viñetas).
8. **Suposiciones** y **Faltantes**.

## Límites de trabajo

- Escribe solo dentro de `.scratch/campaign-v2-wayfinder/astra/`. Nada más en el repo.
- Disco justo (unos 7 GB libres): sin `npm install`, sin descargas, sin servidores, sin copias de ramas. Total escrito < 1 MB. Borra cualquier temporal antes de terminar.
- Una sola pasada: lee, diseña, escribe, termina. Si tras releer tu borrador no mejora en algo concreto, para. No itere en bucle.
- Al terminar, tu último mensaje es solo: la ruta del archivo y las 8 líneas del resumen.
