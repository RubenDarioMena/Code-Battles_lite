# Campaign-V2 · decisiones del grill (23–24 nov 2026)

Resultado de tres rondas de grill con documentos, **cerrado y confirmado por el autor el 24-nov-2026**. Es la entrada para el wayfinder. Los términos están definidos en [CONTEXT.md](../../CONTEXT.md). Las respuestas originales: [origen/respuestas/](origen/respuestas/).

## Fuentes y precedencia

- **Código:** rama nueva `Campaign-V2`, desde `origin/trunk` más un merge de `origin/assets-3d`. Trunk da la arquitectura inicial, que el wayfinder podrá cambiar.
- **campaign-nivel-1** es solo referencia visual y de UI (feedback «War actual vs prototipo», iconos de `img/campaign/`). No se usa ningún código suyo.
- **Aspecto:** papercraft (kit y mapa ampliado de `assets-3d`).
- **Documentos:** ante inconsistencias, manda el documento fuente más reciente (por fecha y commit). El consolidado preprototipo (23-nov, 21:33) entra como **visión fechada**: rige las mecánicas futuras y el lenguaje 2D, no la estética de este corte.

## Qué es Campaign-V2

- Sustituye a la campaña H0–H5 como experiencia principal. War, Factory y la campaña H0–H5 quedan ocultas, accesibles para QA desde el menú de pruebas.
- **Nivel 1:** un solo mundo con hitos de fábrica y de batalla alternados: H0 → B1 → H1 → B2 → H2 → B3 → H3 → B4 → H4 → B5 → H5. Es un borrador; el orden se ajusta jugando.
- **Batallas 1–5:** al principio, idénticas a los retos de War (Primer blanco, Prioridades, Niebla, Enjambre, Dos lanzadores). Más adelante podrán cambiar.
- **Fábrica:** usa las mecánicas de la campaña H0–H5, recortadas a una **munición básica** de cadena corta. Las máquinas mínimas ya están colocadas desde el inicio: el colocador puede moverlas, pero no añadir otras. El reparador sigue siendo automático, como en War. La fábrica sigue funcionando durante la batalla.
- **Munición:** en el Nivel 1, la bodega de la muralla abastece sola a las torretas; más adelante la repartirán robots programados.
- **Torretas:** en las cinco primeras batallas (quizá solo en las tres primeras) vienen montadas en la muralla de serie.

## Dos modos y paridad

- **Modo paridad** (desde el menú de pruebas): cada batalla corre con los parámetros exactos de War y debe dar la misma huella que las referencias de War (retos 1–5, semillas 1 y 7).
- **Modo campaña:** la fábrica cambia el cargador y el suministro, y se pueden dar órdenes puntuales y usar el colocador.
- **Derrota:** se elige a qué checkpoint volver; el último aparece como opción por defecto.

## Mundo y 3D

- **Escenario:** una sección del mapa papercraft ampliado (400 × 208 m) frente a la muralla, con el encuadre resuelto para que el corte del mapa no se note.
- **Muralla:** estática, diseño C · Traba + Cordón. Su cara frontal está en x = 3 (`LINEA_BASE`) y las torretas, en bastiones (el nudo de Traba) que sobresalen hasta x = 6. No cambia ninguna regla.
- **Torreta esfera:** el GLB actual (`torreta_observacion.glb`) mientras se exporta el rediseño S. Apunta con su rig, abre la compuerta, dispara por el telescopio y muestra el atasco.
- **Placeholders:** dron, oruga, sensor y reparador se dibujan con las primitivas actuales de War.
- **Vista de combate:** oscura y sin texturas (estilo Tron); se activa sola al empezar una batalla.
- **Iconos 2D** según el consolidado: robots vectoriales vistos desde arriba, máquinas en isométrica ligera, y ámbar, verde y azul para los estados, con el rojo reservado para daño.
- **Cambios de arquitectura permitidos para el 3D:** registro y caché de modelos, material papercraft compartido, rigs animados desde la escena y resolución de URL de binarios (raw.githubusercontent).
- **WebGPU:** lo nuevo (material papercraft) se escribe en TSL y funciona con los dos renderizadores. Lo existente (VFX en GLSL) se queda como está hasta medir. El renderizador se elige en el menú de pruebas.
- **Rendimiento:** se mide en el primer hito (Electron y el teléfono del autor) y se decide con esos datos.
- **Fuera de alcance:** muralla rompible de vóxeles, núcleo en otro hilo, modelo de materiales con masa, reciclaje, sierra frente a láser y splats realistas.

## Interfaz

- **Editor:** idéntico a trunk (CodeMirror, sin teclado, paleta, sugerencias, revisión). Seudocódigo en las batallas desde el primer hito; en la fábrica, más adelante.
- **Panel de código:** nuevo. Lleva el árbol de unidades plegable arriba a la izquierda, con casillas por unidad y por tipo y otra para marcar todas; sustituye a la tira de tarjetas, también en el móvil.
- **Programas:** compartidos por defecto entre las unidades seleccionadas, con la opción de desvincular.
- **Selección:** una sola, compartida entre el mapa y el árbol.
- **Primer hito** (Batalla 1): botón Misión «!», metas en columna, selector 3D/2D centrado y vista de combate automática, ficha compacta, ficha completa con modelo 3D, vida de las unidades, árbol de unidades, menú ⋯, selección con clic izquierdo o arrastre, orden puntual de disparo con clic derecho y colocador (bastión de la torreta).
- **Después:** Archivo de programas, guardado en varias ranuras, menú Máquinas (ingeniería inversa e investigación) y colocación libre de máquinas.
- **Móvil:** la interfaz de trunk, con pantalla completa por defecto. La única excepción es el árbol de unidades.

## Menú de pruebas

Se abre por URL (por ejemplo `?pruebas=1`) y se documenta en `docs/campaign-v2/MENU-PRUEBAS.md`. Incluye: saltar a cualquier nivel o hito, elegir modo paridad o campaña, la semilla, un checkpoint guardado, el renderizador (WebGL o WebGPU) y la calidad, y enlaces a War, Factory y la campaña H0–H5.

## Documentación de la rama

`CONTEXT.md` en la raíz; `AGENTS.md` y `CLAUDE.md` actualizados con la dirección de Campaign-V2; el consolidado preprototipo en `docs/Vision/2026-11-23/`; `docs/campaign-v2/MENU-PRUEBAS.md`; `PROGRESO.md` archivado y uno nuevo para Campaign-V2. **Sin ADRs**, por decisión del autor.

## Primer entregable

La Batalla 1 «Primer blanco», jugable con la UI nueva del mapa, la torreta esfera sobre un bastión, el escenario papercraft y el menú de pruebas, con enlace raw.githack. Después, un hito de fábrica con munición, y luego las batallas 2 a 5.

## Pendiente fuera del grill

- **Wayfinder:** arquitectura de mundo continuo (cómo conviven fábrica y combate en un mismo reglamento) y estructura de paquetes de Campaign-V2.
- **Agentes:** restricciones de Astra 6.2, `codex` (principal) y `codex-astra` (fallback).
- **Encargos de arte:** exportar el GLB de la torreta S; más adelante, VEH y WHL.
