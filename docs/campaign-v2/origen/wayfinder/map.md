# Mapa · Campaign-V2 (alias «B2»): arquitectura extensible y primer corte

Label: wayfinder:map
Tracker: markdown local (`.scratch/campaign-v2-wayfinder/`). No hay tracker configurado y el repo es público; pasar a GitHub Issues solo con permiso explícito del autor.

## Destination

Un plan de implementación de Campaign-V2 listo para entregarlo a agentes. Debe fijar cuatro cosas:

- la estructura de paquetes y del mundo continuo (fábrica + batalla) sobre trunk;
- la Batalla 1 como primer corte, con paridad con War;
- las partes del modo de batalla integrado que necesitan las Batallas 1–5;
- una receta, comprobada sobre papel, para añadir un nivel, una mecánica y su asset con cambios localizados.

Se llega cuando no queda nada por decidir antes de empezar a programar.

## Notes

- **Dominio:** juego educativo de programación (JS/Python reales), simulación determinista, Three r180. Glosario: `docs/grill/CONTEXT-borrador.md`. Decisiones cerradas del grill: `docs/grill/DECISIONES-GRILL.md`; no se reabren.
- **«B2» = Campaign-V2.** El encargo del otro agente dice «B2» y el grill, «Campaign-V2». Es el mismo prototipo; el término canónico es Campaign-V2.
- **Decisión vigente (autor, 24-nov-2026):** el laboratorio de batalla de `ccr-684f16c6-yq5at1` se **incorpora** a Campaign-V2 como modo de batalla integrado, para probar. Nota histórica: su propuesta del 16-nov lo planteaba como un laboratorio independiente, y eso queda solo como contexto.
- **Valores experimentales:** alcances, vidas y cadencias del laboratorio (VEH 3 casillas/s, alcance 8; WHL 6 casillas/s, 8 de daño en 2,5; marca de 6 s…) son ejemplos sin confirmar.
- **Criterio rector del autor:** añadir mecánicas y niveles de cualquier tipo de forma fácil y **eficiente en tokens**. Las opciones se comparan por:
  - archivos compartidos que hay que tocar;
  - pruebas afectadas;
  - archivos que el agente debe leer.

  No se inventan cifras de tokens. Sin frameworks ni abstracciones que trunk no justifique.
- **Fuentes por rama:**
  - `origin/trunk`: arquitectura (`docs/PLAN-ARQUITECTURA.md`, `docs/REGLAMENTO.md`, `paquetes/*/README.md`).
  - `origin/ccr-684f16c6-yq5at1`: mecánicas (`docs/PROPUESTA-MECANICAS-BATALLA.md`, `laboratorio/batalla/`).
  - `origin/assets-3d`: modelos, rigs y animaciones.
  - `campaign-nivel-1`: solo referencia visual.
- **Dos arquitecturas en paralelo** (pedido del autor):
  - la de Astra 6.2 (codex, high): [astra/ARQUITECTURA-ASTRA.md](astra/ARQUITECTURA-ASTRA.md), con brief en [astra/BRIEF.md](astra/BRIEF.md);
  - la de Claude: [arquitecturas/ARQUITECTURA-CLAUDE.md](arquitecturas/ARQUITECTURA-CLAUDE.md).

  Comparación legible: [arquitecturas/COMPARACION.md](arquitecturas/COMPARACION.md). Ambas son insumo de «Forma del mundo continuo» y «Cómo se añade una mecánica», no decisiones.
- **Astra en tickets posteriores:** high en la primera iteración y medium en las correcciones (`codex exec resume`), siempre con `--disable default_mode_request_user_input`. Sus salidas las resume otro modelo antes de llegar al autor. Brief con entregable único, límite de tamaño y presupuesto de disco.
- **Skills por sesión:** grilling + domain-modeling en los tickets de grilling; codebase-design en «Cómo se añade una mecánica» y en «Formato de la definición de nivel e hitos».
- **Investigaciones:** sus hallazgos van a `research/NN-*.md` dentro de este esfuerzo (no hay ramas `research/*` porque el árbol de trabajo tiene cambios sin confirmar).

## Decisions so far

<!-- una línea por ticket cerrado -->

- [Receta de extensibilidad sobre papel: VEH, WHL y minador](issues/10-receta-extensibilidad-papel.md): la promesa se sostiene. Una mecánica son 2 archivos propios más 2 o 3 líneas compartidas, y una Batalla, 1 archivo más 2 líneas. Costes únicos: capacidad `movimiento/`, puertas en el marco, reaparición con «aplicar ahora», nodo «cuando» y proyectil V2. Una unidad destruida vale `null`.
- [Forma del clic programado en JS, Python y seudocódigo](issues/12-forma-clic-programado.md): `terrain.onClick` y `enemies.onClick`, en coordenadas del marco de batalla. `regularShoot(objetivo)` es el disparo dirigido (confirmado). En Python, `def`/`async def`/`lambda`. Nodo genérico «cuando» en el seudocódigo. Cada clic abre un hilo, y los oyentes se registran solo al principio.
- [Formato del checkpoint de Campaign-V2](issues/11-formato-checkpoint.md): una instantánea al empezar cada hito (fábrica, bodega, torretas, programas y vínculos, fuentes, semilla y revisión). War se reconstruye desde el reto y los programas arrancan de nuevo. Cada intento de Batalla usa una semilla nueva, anotada en su grabación. Al volver tras perder se mantienen los programas actuales. Con otra revisión del nivel se conservan solo los programas. Un checkpoint por hito. La prueba compara con el ensayo.
- [Escala, coordenadas y espacio del mundo](issues/09-escala-coordenadas-espacio.md): el mundo usa los metros del mapa papercraft (400 × 208 m) y la fábrica de Campaign se traslada (103, 22), pegada a la muralla. La batalla de War entra con un marco que solo desplaza (`origen: [204, 72]`, 1 casilla = 1 m) y que también es el campo activo de las unidades V2. Manda la simulación (el arte se ajusta en `modelos.js`; Traba × 0,54). Solo `reglas-campaign-v2` traduce entre casillas y metros.
- [Formato de la definición de nivel e hitos](issues/08-formato-definicion-nivel.md): una carpeta por nivel con módulos JS de datos (`nivel.js` + un archivo por hito). Las Batallas 1–5 apuntan al reto de War (`{ war: N }`) mientras sean idénticas y se copian cuando cambian. Los textos van en un catálogo i18n por nivel. Cada tipo de hito usa sus metas. El programa del jugador se conserva, con el botón «Programa de la lección». Hay validador al cargar y una prueba de contenido. Batalla 6 = 2 archivos + 1 línea.
- [Qué partes del modo de batalla integrado entran para probar las Batallas 1–5](issues/07-modo-integrado-primer-corte.md): tres maneras de jugar (campaña, ensayo y paridad). En el primer corte entran errores aislados, aplicar ahora, grabar y repetir, pausa con órdenes y clic programado, lo que adelanta el transporte de eventos. Los otros eventos, el radar y la reaparición son extensión; la marca y `track`, por definir. Las piezas se activan por modo.
- [Orden puntual frente a `onClick`](issues/06-orden-puntual-frente-a-onclick.md): el clic derecho o mantener va primero al programa de las unidades que escuchan `onClick` (clic programado); si no escuchan, es una orden puntual que apunta con la predicción de War en el siguiente turno de fuego. «Apuntar arrastrando» desde la torreta es siempre manual. Se retiran Alt+clic y «Señalar».
- [Cómo se añade una mecánica sin tocar archivos compartidos](issues/05-como-se-anade-una-mecanica.md): una carpeta por mecánica con `reglas.js` (puro, regla única que corre también en el programa) y `ficha.js` (datos que lee el editor), más una línea en `paso.js`. Hay transporte genérico de eventos, War expone lectura de enemigos y daño en área, y existe un registro de modelos por id. Orden del paso: fábrica → puente → batalla → mecánicas.
- [Forma del mundo continuo: fábrica y batalla en un mismo reglamento, con paridad](issues/04-forma-mundo-continuo.md): un paquete nuevo `reglas-campaign-v2` recibe por inyección un mundo War por Batalla (intacto, salvo una función pública para fijar el suministro) y la producción extraída de H0–H5. Un solo reloj: fábrica → puente → batalla. Entre Batallas pasan la fábrica, la bodega, los programas y la posición de la torreta. La paridad son las 10 referencias más una victoria y una partida con atascos.
- [Línea base: cuánto cuesta hoy en trunk añadir un reto, una orden, un evento y un tipo de unidad](issues/01-linea-base-coste-trunk.md): un reto toca 2 archivos (unas 315 líneas). Un verbo como `moveTo` toca 15 archivos en 8 paquetes, porque está duplicado entre `anfitrion/api.js` y `reglas-war/mundo.js`. Un evento toca unos 10 archivos, porque no existe ningún camino de sucesos hacia el programa. Un tipo de enemigo toca 9 archivos y un PNG, sin flujo GLB. La línea base de mecánicas es cara; la de contenido, barata.
- [Runtime del laboratorio frente al anfitrión e intérprete de trunk](issues/02-runtime-laboratorio-vs-anfitrion.md): trunk no tiene oyentes ni varios hilos en War (una sola espera), errores aislados, «aplicar ahora» ni reaparición. Tiene a medias el canal del jugador, la repetición y la espera de orden (patrón `goTo` de Campaign). El intérprete sin Workers abarata reprogramar y reaparecer.
- [Assets 3D disponibles para la Batalla 1 y su cadena de carga](issues/03-assets-batalla-1-y-carga.md): la torreta tiene rig v2 (azimut, inclinación, compuerta, telescopio) pero no disparo ni atasco. La muralla Traba sirve, sin punto de bastión definido y con texturas externas. VEH y WHL no tienen GLB. Trunk no tiene registro de modelos ni `paquetes/rig`, y solo carga `t1.glb` con una URL fija.

## Not yet specified

- **Comunicación entre unidades** (`signal`/`onSignal`) y su relación con el Control Maestro de la visión. Depende de cómo se modelen los eventos.
- **Visibilidad compartida:** niebla por bando, sensor móvil que la disipa (dron explorador) e identidad que caduca (marca de 6 s + `track`; el ticket 07 la dejó en «necesita definición»). Hace falta saber antes qué sensores entran.
- **Unidades móviles y destruibles en la interfaz:** inspector y ficha (la semántica de `null` y el árbol en gris ya están decididos en el ticket 10).
- **Encuadre del corte del mapa papercraft** frente a la muralla (encargo de Astra). Desde el ticket 09 la batalla ocupa x 204–236, y 72–90 en metros del mapa; falta decidir cámara y recorte.
- **Material papercraft en TSL:** dónde vive dentro de `vista-3d` y cómo convive con los VFX en GLSL.
- **El plan de implementación por porciones** (slices verticales para agentes). Es el traspaso final, cuando los tickets estén cerrados.

## Out of scope

- Implementar código en este esfuerzo: el destino es un plan.
- Lo que el grill dejó fuera: muralla rompible de vóxeles, núcleo en otro hilo, materiales con masa, reciclaje, sierra frente a láser y splats realistas.
- Equilibrio de juego definitivo de las mecánicas nuevas: los números siguen siendo experimentales.
