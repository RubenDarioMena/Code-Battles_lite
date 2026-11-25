# Arquitectura de Campaign-V2 · propuesta de Claude

Borrador para comparar con la de Astra. Es insumo de los tickets «Forma del mundo continuo» y «Cómo se añade una mecánica»; no decide nada. Escrita sin ver la de Astra ni las investigaciones 01–03. Las cifras de archivos tocados son estimaciones a contrastar con la línea base de trunk (ticket 01).

> **Corrección tras comparar con Astra:** `pruebas/fronteras.mjs:9-11` solo deja importar `nucleo` y `protocolo` a `reglas-*`. El `reglas-cv2` que importa `reglas-war` y `reglas-campaign`, tal como está escrito aquí, rompe esa frontera. La composición tendría que inyectarse desde `app` (como propone Astra) o exigiría abrir una excepción.

## Resumen

1. La batalla de paridad **es** `reglas-war` sin cambios: no se copia ni se reescribe. La paridad sale gratis.
2. La fábrica es `reglas-campaign` con datos de nivel nuevos (la munición básica), no con código nuevo.
3. Un reglamento nuevo y fino, `reglas-cv2`, **compone** los dos mundos y los une con un puente: la bodega abastece el suministro de las torretas.
4. Las mecánicas nuevas (vehículo, rueda, arquetipos) viven cada una en su propio archivo de reglas y su propio archivo de dibujo. El nivel dice cuáles activa.
5. Los eventos (`onDamage`, `onArrive`…) se añaden una sola vez de forma genérica en el anfitrión. Después, cada mecánica solo emite eventos con nombre.
6. Un agente que añade una mecánica lee una receta, una mecánica vecina como plantilla y el contrato: unos 4 archivos.

## Evidencia de trunk en la que se apoya

- **Contrato de reglamento ya común:** `{ id, crearMundo, paso, aplicarOrden, instantanea, escena, evaluar, api }` en `reglas-war`, `reglas-factory` y `reglas-campaign` (`paquetes/*/index.js`). `api` ya es **datos** (`ordenes`, `tipos`, `sensores`, `conf`).
- **Funciones autocontenidas que viajan al programa:** `reglas-campaign/validacion.js` se copia con `toString()` al texto del trabajador. Es el patrón para que cada mecánica lleve su parte de API sin tocar `anfitrion/api.js`.
- **Espacios con nombre en la instantánea:** `api.js` ya lee `SNAP.campaign` y `SNAP.factory` por separado. Una instantánea compuesta `{ war, fabrica, campo }` no rompe ese patrón.
- **Coste actual que se quiere evitar:**
  - `app/juego/*` se ramifica con `ES_CAMPAIGN` / `ES_FACTORY` en muchos archivos (por ejemplo `escenario.js`, `vistas.js`);
  - `anfitrion/api.js` (323 líneas) mezcla la API de las tres series;
  - `vista-3d` tiene un archivo grande por serie (`campaign.js`, 485 líneas).

  Cada serie o mecánica nueva toca esos archivos compartidos.

## Idea central

```
                 contenido/nivel-1/*.js   (datos: hitos, metas, batallas → «war:1..5», fábrica inicial, mecánicas activas)
                          │
                          ▼
   reglas-war ◄─── reglas-cv2 ───► reglas-campaign        (sin cambios en los dos de los lados)
   (batalla)     compone · puente   (fábrica recortada por datos)
                    │      ▲
                    │      └── reglas-cv2/mecanicas/<m>.js   (VEH, WHL, minador…: datos + paso + órdenes + eventos + api autocontenida)
                    ▼
   anfitrion  ── genérico: hilos de oyentes + on(nombre, fn) + espera de orden (una sola vez)
   vista-3d/cv2/ ── escena compuesta + modelos.js (tipo → GLB, escala, mapa del rig) + <m>.js por mecánica
   interfaz/cv2/ ── árbol de unidades, panel de código, colocador, orden puntual
   app/cv2/      ── composición propia; no añade ramas ES_CV2 dentro de app/juego/*
```

**Paso del mundo compuesto** (determinista, orden fijo):

1. fábrica: paso de `reglas-campaign`;
2. puente: bodega → `suministro`/`cargador`, como orden de origen `sistema`;
3. batalla: paso de `reglas-war`;
4. mecánicas activas, en el orden que declara el nivel.

En **modo paridad**, `reglas-cv2` se salta los pasos 1, 2 y 4 y no acepta órdenes de jugador. Lo que corre es exactamente `reglas-war`, y la huella se compara con las referencias existentes.

## Qué cambia respecto a trunk

| Paquete | Estado | Por qué |
| --- | --- | --- |
| `protocolo`, `nucleo`, `lenguaje`, `interprete`, `editor`, `vfx` | Se quedan | Ya son genéricos. |
| `reglas-war` | Se queda | La paridad depende de no tocarlo. |
| `reglas-campaign` | Se queda; datos nuevos | La munición básica es un nivel nuevo (`nivel.js` admite catálogos). Si hace falta código, se discute en el ticket 04. |
| `reglas-cv2` | **Nuevo** | Compositor + puente + `mecanicas/`. Mismo contrato de reglamento. |
| `anfitrion` | **Cambia una vez** | Varios hilos por programa (cuerpo + oyentes), `on(nombre, fn)` genérico, espera ligada a orden (`arrive`), errores aislados, reinicio en caliente. Después no se toca por mecánica. |
| `vista-3d` | **Carpeta nueva `cv2/`** | Escena compuesta, `modelos.js` con el registro de GLB y rigs, un archivo por mecánica y material papercraft en TSL. No toca `war.js` ni `campaign.js`. |
| `vista-2d` | Carpeta nueva `cv2/` | Iconos vectoriales del consolidado. |
| `interfaz` | Carpeta nueva `cv2/` | Árbol, panel de código, colocador, ficha. |
| `app` | Carpeta nueva `cv2/` | Arranque, menú de pruebas y checkpoints de Campaign-V2. |
| `pruebas/fronteras` | Cambia una vez | Reconocer `reglas-cv2/mecanicas/*` como reglas, sin DOM, y `vista-3d/cv2/*` como vista. |

## Recetas

**Añadir un nivel o una batalla** (caso A):

1. Crear `contenido/nivel-N/bK.js` con oleadas y metas, o con `paridad: 'war:K'`.
2. Añadirlo a la secuencia de hitos del nivel.
3. Correr la prueba de contenido, que valida el esquema y juega con semilla.

Archivos compartidos: 0 (la secuencia del nivel es del propio nivel).

**Añadir una mecánica** (casos B–F):

1. Copiar una mecánica vecina como plantilla en `reglas-cv2/mecanicas/<m>.js`. Exporta:
   - `tipos` (datos);
   - `paso(campo, dt, rng)`;
   - `ordenes` (`{ verbo: { clase: 'modo'|'encargo', aplicar } }`);
   - `eventos` (nombres);
   - `api` (funciones autocontenidas para el programa).
2. `vista-3d/cv2/<m>.js` y `vista-2d/cv2/<m>.js` dibujan su tipo a partir de la escena.
3. Añadir una línea en `vista-3d/cv2/modelos.js` si tiene GLB (caso G).
4. Catálogos ES/EN y nombres Python, en el `api` de la mecánica.
5. La prueba de la mecánica: un escenario mínimo con semilla y huella propia.

Archivos compartidos: `modelos.js` (una línea de datos) y los catálogos i18n.

## Casos A–G

| Caso | Archivos compartidos tocados | Pruebas afectadas | Lectura del agente | Rehacer |
| --- | --- | --- | --- | --- |
| A · Batalla 6 | 0 | Solo contenido | Receta + una batalla vecina | Borrar 1 archivo |
| B · VEH sale del muro | `modelos.js`, i18n. Una vez: ruta por puertas en `campo` | Nueva de VEH | Receta + plantilla + contrato | Borrar 2–3 archivos |
| C · WHL kamikaze | `modelos.js`, i18n. Una vez: reaparición en el anfitrión | Nueva | Igual | Igual |
| D · 5 arquetipos | Igual que C por arquetipo; el camión depende del puente | Nuevas | Igual + puente para el camión | Igual |
| E · eventos, `track`, `signal` | La primera vez, el anfitrión (genérico); después, 0 | Anfitrión la primera vez | `anfitrion/README` + plantilla | El cambio genérico es el caro |
| F · radar y niebla | `campo` compartido (visibilidad por bando) | Paridad intacta si War no lo usa | Contrato de `campo` | Medio |
| G · GLB con rig | `modelos.js` | Prueba de carga de modelos | Receta de assets | 1 línea |

## Primer corte (Batalla 1) frente a extensión

- **Entra:**
  - `reglas-cv2` con el puente (modo campaña) y la paridad de la Batalla 1;
  - `contenido/nivel-1` con B1 = `war:1` y H0 de munición básica (puede ir como hito 2);
  - `vista-3d/cv2` con la torreta esfera, la muralla y el corte del mapa;
  - `interfaz/cv2` (árbol, colocador del bastión, orden puntual);
  - el menú de pruebas.
- **Extensión prevista:**
  - el cambio genérico del anfitrión (oyentes y eventos);
  - `mecanicas/` con VEH y WHL;
  - radar y marca/`track`.
- **Necesita definición:**
  - orden puntual frente a `onClick` (ticket 06);
  - escala casilla ↔ metro y el campo más allá de x = 32 (ticket 09);
  - formato del checkpoint compuesto.

## Riesgos y lo que no sé

- Que `reglas-campaign` admita la munición básica solo con datos. Si no, hay que tocarlo y la promesa de «sin cambios» cae a «cambio pequeño».
- Que el puente bodega → suministro quepa como orden de `sistema` sin tocar `reglas-war`. Si War no expone esa orden, hay que añadirla: un cambio de una línea, pero en un archivo compartido.
- Un campo propio de las mecánicas (`campo`) junto al mundo de War duplica nociones: enemigos de War frente a objetivos de VEH. Habrá que decidir si las mecánicas ven los enemigos de War por la instantánea o por referencia.
- `app/cv2` separado evita ramas `ES_CV2`, pero puede duplicar arranque y bucle. Habría que medir cuánto de `app/juego/*` es genérico.
- La regla de fronteras para subcarpetas es un cambio de herramienta, no de juego. Hay que comprobar su coste en `pruebas/fronteras`.
