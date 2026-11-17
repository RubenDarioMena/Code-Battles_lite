# Plan de arquitectura: núcleo sin pantalla, vistas intercambiables y Steam

Decidido por el autor el 15 de noviembre de 2026. Sustituye a las reglas «sin framework, sin compilación, sin npm» y a la prioridad de navegador. `docs/PLAN-UNIFICACION.md` queda cerrado y es historia: explica cómo se llegó a la base actual, no cómo se sigue.

## Decisiones del autor

| Tema | Decisión |
| --- | --- |
| Plataformas | **Steam primero** (Windows, Linux/Steam Deck). **Android después**. El navegador deja de ser el producto y pasa a ser el canal de QA. |
| Tecnología | Se mantiene la tecnología web. Steam con **Electron**; Android con Capacitor. No se migra a Godot ni a Unity. |
| Lenguaje del jugador | **JavaScript y Python reales** (Python traducido a JS), como hoy. |
| Equipo | Modesto. Los efectos de batalla (VFX) son prioritarios, con niveles de calidad. |
| Modularidad | El editor de código por botones debe poder usarse en otra aplicación o en otra mecánica. |
| Simulación y gráficos | Separados. Se debe poder cambiar el motor de dibujo, la plataforma o el estilo sin tocar las reglas. |
| 2D y 3D | Las dos representaciones se mantienen y se cambia de una a otra en caliente. |
| Diseño abierto | El estilo gráfico, la interfaz y el sistema de combate de War, Factory y Campaign **no son definitivos**. La arquitectura debe admitir control manual de unidades y combates con muchas más unidades. |
| Forma de trabajo | El autor tiene poco tiempo frente al ordenador. El trabajo lo hacen agentes, que verifican solos y entregan pasos revisables desde el teléfono. |

## Reglas que se retiran y reglas que siguen

**Se retiran:**

- «JavaScript y CSS sin framework ni compilación» y «no añadas herramientas o dependencias». Hay `package.json` raíz, dependencias de desarrollo y empaquetado.
- «Evoluciona el juego HTML existente» y «haz cambios pequeños». Se permite mover, partir y reescribir módulos siguiendo este plan.
- La obligación de conservar `window.cmg`, `window.__banco`, los IDs del marcado y las versiones `?v=`. Se sustituyen por imports entre módulos cuando el paso correspondiente los alcance.
- «TypeScript, VM y empaquetado móvil aún no son implementaciones decididas». Ahora lo son, con el alcance de este plan.

**Siguen:**

- **Determinismo.** Paso fijo, RNG con semilla, sin reloj real ni azar global en las reglas.
- **Los programas del jugador siguen funcionando.** La API de los programas y los programas guardados no cambian durante la reestructura. Cambiarla es una decisión de diseño aparte.
- **Paridad durante la reestructura.** Hasta terminar la fase 2, el juego se comporta igual que antes. Las suites actuales y el oráculo de Factory son la red de seguridad.
- **Legibilidad en PC y en móvil**, y textos en los catálogos ES/EN de i18n.
- **Sin commits ni push sin instrucción**, y enlaces raw.githack tras cada push.

## Arquitectura objetivo

### Módulos

Cada módulo es una carpeta de `paquetes/` con su `README.md` (contrato), su entrada pública `index.js` y sus pruebas. Nadie importa archivos internos de otro paquete.

| Paquete | Contenido | Puede importar |
| --- | --- | --- |
| `protocolo` | Tipos de los tres mensajes: instantánea, suceso y orden. Solo tipos y validadores | Nada |
| `nucleo` | Reloj de paso fijo, RNG con semilla, almacén de entidades, cola de órdenes, registro de sucesos, guardar y restaurar | `protocolo` |
| `reglas-war`, `reglas-factory`, `reglas-campaign` | Un reglamento por serie: mundo, paso, órdenes, metas y lo que ven los programas | `nucleo`, `protocolo` |
| `lenguaje` | Léxico, estructura tolerante, traductor de Python, seudocódigo, instrumentación. Sin DOM | Nada |
| `anfitrion` | Ejecuta los programas del jugador contra un reglamento. Hoy con Web Workers; después con un intérprete determinista | `nucleo`, `protocolo`, `lenguaje` |
| `editor` | Editor de código por botones. Se puede montar solo | `lenguaje` |
| `vfx` | Recetas de efectos y su evaluación sin estado | `protocolo` |
| `vista-2d`, `vista-3d` | Dibujan el mundo a partir de instantáneas y sucesos | `protocolo`, `vfx` |
| `interfaz` | HUD, inspector, consola, fichas de reto, Ajustes, distribución | `protocolo`, `editor` |
| `app` | Composición: elige reglamento, vistas e interfaz y los conecta | Todos |

Las cáscaras viven en `cascaras/`: `web` (QA por enlace), `escritorio` (Electron y Steamworks) y `android` (Capacitor). Solo ellas conocen la plataforma: guardado, pantalla completa, logros, nube.

**Prohibido en `protocolo`, `nucleo`, `reglas-*`, `lenguaje` y `vfx`:** `window`, `document`, `performance.now`, `Date.now`, `Math.random`, Three.js y cualquier API de navegador. Deben ejecutarse en Node sin simular nada.

Una comprobación automática (`pruebas/fronteras`) recorre los imports y falla si alguien cruza una frontera. Forma parte de la verificación habitual.

### Las tres fronteras

**1. Del mundo hacia fuera: instantáneas y sucesos.**

- Una **instantánea** es el estado visible del mundo en un paso: datos planos, sin funciones, clonables y serializables.
- Un **suceso** es algo que pasó en un paso (disparo, impacto, derribo, entrega). Los sucesos son solo para ver y oír: ninguna regla ni programa los lee.
- Las vistas reciben la instantánea anterior, la actual y la fracción entre ambas, e interpolan. No leen el objeto `mundo` ni escriben en él.
- Consecuencias: cambiar entre 2D y 3D es cambiar de suscriptor; una vista nula sirve para pruebas; el núcleo puede correr en otro hilo o en otro motor.

**2. De fuera hacia el mundo: órdenes.**

- Una **orden** es la única forma de cambiar el mundo desde fuera: `{ paso, origen, unidad, verbo, args }`, con `origen` igual a `programa`, `jugador` o `sistema`.
- El programa del jugador y el jugador que hace clic sobre una unidad usan el mismo canal. El control manual es un controlador más, no un caso especial de las reglas.
- Consecuencia: una partida es escenario, semilla y lista de órdenes. Con eso se repite, se prueba y se graba.

**3. Entre los programas y el mundo: el anfitrión.**

- El anfitrión carga los programas, les da la instantánea que les toca, recoge sus órdenes y dice cuándo todos esperan.
- Su interfaz es asíncrona para admitir las dos implementaciones: Workers hoy, intérprete después.
- El resto de la aplicación no sabe cómo se ejecutan los programas.

### Contratos

Los nombres definitivos los fija quien implemente la fase 2. La forma es esta:

```js
// nucleo
const partida = crearPartida({ reglas, escenario, semilla });
partida.ordenar(orden);            // se aplica en el paso indicado
partida.paso();                    // avanza DT
partida.instantanea();             // datos planos
partida.sucesos(desdePaso);        // lista de sucesos
partida.serializar(); restaurar(datos);

// un reglamento
export default {
  id, version,
  crearMundo(escenario, rng), paso(mundo, dt), aplicarOrden(mundo, orden),
  instantanea(mundo), evaluar(mundo),      // metas y fin
  api,                                     // lecturas, modos y encargos que ven los programas y el editor
};

// una vista
const vista = crearVista(contenedor, { tema, calidad });
vista.dibujar(anterior, actual, fraccion);
vista.alSuceso(suceso);
vista.elegir(x, y);                // id de entidad o null
vista.redimensionar(); vista.destruir();

// el anfitrión
const anfitrion = crearAnfitrion({ reglas, lenguaje });
await anfitrion.cargar(unidad, fuente);
await anfitrion.ceder(instantanea);  // corre hasta que todos esperan; devuelve órdenes y avisos
```

### Código fuente y herramientas

- **Módulos ES.** Los IIFE que publican globales (`window.WAR`, `window.VISTAS`…) pasan a `export`. Mientras convivan las dos formas, un único archivo de compatibilidad vuelve a publicar los globales que aún se usen; se borra al terminar la fase 2.
- **El código se ejecuta sin compilar.** JavaScript con tipos en JSDoc y contratos en archivos `.d.ts`, comprobados con `tsc --noEmit` (`checkJs`). Así el enlace raw.githack de una rama sigue funcionando sin CI, que es como el autor hace QA. No se escriben archivos `.ts` con código ejecutable salvo decisión posterior.
- **Dependencias de ejecución** (Three.js, Acorn, lezer): servidas desde el repositorio y resueltas con un mapa de imports, con licencia y hash como hoy.
- **Dependencias de desarrollo** por npm: TypeScript, un empaquetador (Vite o esbuild) para las cáscaras, Playwright, Electron y Capacitor. npm workspaces en la raíz. `educational-animation/` conserva su pnpm y queda fuera.
- **Empaquetado** solo para publicar: Steam, Android y el paquete de Netlify.
- **Tamaño.** Ningún archivo de código nuevo o partido supera unas 500 líneas. `juego.js` (2.792 líneas) es lo que no debe repetirse: un agente debe poder trabajar en un paquete leyendo solo ese paquete y los contratos.

### Herramientas para agentes

- **Partida sin pantalla:** `node herramientas/partida.mjs --reglas war --reto 2 --semilla 7 [--programas …]` imprime resultado, métricas y un hash de las instantáneas. Es la base de las pruebas de paridad y de rendimiento. Factory usa `--intento` (su semilla es el intento) y Campaign es una secuencia de tramos sobre el mismo mundo; detalle en `herramientas/partida/README.md`.
- **Capturas:** un guion que abre una vista con una partida grabada y guarda capturas en instantes fijos, para revisar gráficos y efectos sin jugar.
- **Laboratorio de efectos:** la página de `docs/PLAN-VFX.md`, con cada receta aislada en 2D y en 3D.
- **Medida de carga:** partida sintética con 100, 500 y 2.000 unidades; registra milisegundos por paso y por fotograma. Antes de optimizar se mide.

## Estado de partida

- `js/war.js`, `js/factory.js` y `js/campaign.js` ya no usan DOM. Son el germen de los reglamentos.
- `paquetes/editor/` tiene contrato (`README.md`), entrada pública ES e instancia autónoma (`demo/demo.html`), trasladados en el paso 10 de la fase 2.
- `js/juego.js` mezcla ciclo de programas, las dos vistas, inspector, pestañas, guardado y pegamento del editor.
- Las vistas (`vistas.js`, `factory-vista.js`, `campaign-3d.js`, `campaign-plano.js`) leen `mundo` directamente.
- `index.html` carga 63 scripts globales en orden, con `?v=` manual.
- El runtime usa un Worker por máquina programable y límites por reloj real (2,5 s sin `await`). No escala a cientos de unidades y no es determinista en ese límite.
- Three.js es r128 (2021).
- El modo revisión del juego importa `educational-animation/revision/motor/`. Esa dependencia se conserva tal cual hasta la fase 2, donde pasa a ser un import explícito.

## Fases

Cada fase termina con las suites en verde, una entrada en `PROGRESO.md` y los enlaces de QA. Una fase son varios commits pequeños, no uno grande.

### Fase 0 · Herramientas, sin cambiar comportamiento

- `package.json` raíz con workspaces, `tsconfig.json` con `checkJs`, guion `npm test` que ejecuta todas las suites de lógica y `npm run test:navegador` para las de Playwright.
- Carpeta `paquetes/` con los README de contrato y la comprobación de fronteras (al principio, vacía de infracciones porque está vacía de código).
- `herramientas/partida.mjs` sobre el código actual, y **grabación de referencias**: resultado y hash por reto y semilla de War, Factory y la partida de referencia de Campaign. Estas referencias son el criterio de paridad de las fases 1 y 2.
- Hecho cuando: `npm test` pasa en un clon limpio y las referencias están en el repositorio.
- **Cerrada el 15 de noviembre de 2026** (rama `arquitectura/fase-0`). Referencias: `pruebas/referencias/partidas.json`, 41 partidas (War retos 1–5 × semillas 1 y 7; 27 casos del oráculo de Factory; Campaign H0–H5 en JS y en Python; War 2/7 y Factory reto-1 en Python). `pruebas/partida-contraste.mjs` demuestra que la partida sin pantalla da el mismo hash, pasos y resultado que el juego real con Workers: 41/41. En las fases 1 y 2, `npm test` (incluye `partida-referencias`) y `npm run test:navegador` (incluye el contraste) son el criterio de paridad.

### Fase 1 · Núcleo, reglamentos y protocolo

- Tipos de `protocolo`. `nucleo` a partir de `nucleo.js`. Los tres reglamentos a partir de `war.js`, `factory.js`, `campaign.js` y sus retos.
- Las reglas anotan sucesos (hoy solo existen `mundo.explosiones` y `mundo.derribados`).
- El juego actual usa ya estos paquetes; su interfaz no cambia.
- Hecho cuando: los paquetes pasan sus pruebas en Node sin `window`, y las referencias de la fase 0 coinciden.
- **Cerrada el 15 de noviembre de 2026** (rama `arquitectura/fase-1`, a partir de `arquitectura/fase-0`).
  - `protocolo`, `nucleo`, `reglas-war`, `reglas-factory` y `reglas-campaign` existen como módulos ES, con unas 15.400 comprobaciones en Node.
  - En el cierre de la fase 1 el juego usaba un puente clásico de reglamentos; se retiró en el paso 11c de la fase 2. Hoy usa imports ES.
  - Las 41 referencias de la fase 0 coinciden y el contraste con el juego real sigue en 41/41.
  - Ajustes respecto a lo escrito arriba: `campaign.js` se partió en `estado.js`, `mundo.js` y `validacion.js` por el límite de 500 líneas. `validar` (Factory y Campaign) y `modoEnSnap` (Campaign) siguen autocontenidas porque `runtime.js` copia su texto al Worker; esa copia desaparece con el `anfitrion` de la fase 2.
  - Los sucesos van en un registro no enumerable del núcleo, fuera de la instantánea y de la huella.

### Fase 2 · Vistas, anfitrión y fin de `juego.js`

- `vista-2d` y `vista-3d` dibujan solo con instantáneas y sucesos. Cambio 2D/3D en caliente, sin reiniciar la partida.
- `anfitrion` extraído de `runtime.js` y de «Ciclo de los programas», todavía con Workers.
- `juego.js` y `layout.js` se reparten entre `interfaz` y `app`. `editor` sale de `shared/editor/` a `paquetes/editor/`. Desaparecen los globales y los `?v=`.
- **Pruebas de las fronteras**, que son el criterio de la fase:
  1. una partida completa con vista nula;
  2. repetición exacta de una partida a partir de escenario, semilla y órdenes;
  3. una orden de origen `jugador` en un escenario de prueba (control manual mínimo);
  4. el editor montado solo, fuera del juego.
- Hecho cuando: las cuatro pruebas pasan, las suites de navegador pasan y la comprobación de fronteras no tiene excepciones.
- **Cerrada** (16 de noviembre de 2026, rama `arquitectura/fase-2`; detalle en `PROGRESO.md`). Las cuatro pruebas de frontera pasan (1–3 en `pruebas/fronteras-fase2.mjs` con War; 4 con la demo del editor), `npm run test:navegador` pasa entero (53 suites, contraste 41/41 con el juego real) y `pruebas/fronteras.mjs` no tiene excepciones. Qué quedó:
  - `anfitrion` con `crearAnfitrion` para las tres series (orden fijo de mensajes); `app` con `crearPartida`, `crearConductor`, `jugarPartida` y vista nula. El juego juega por ese camino, sin `runtime.js`, `legado` ni Workers propios.
  - Vistas en `vista-2d` y `vista-3d` con `crearVista` (contrato de «Contratos»), sobre `escena(mundo)`; cambio 2D/3D en caliente con prueba.
  - `juego.js` es una entrada de pocas líneas; su código y el de `layout.js` están en `interfaz` y `app`. `editor` y `lenguaje` son paquetes. Ningún archivo nuevo pasa de unas 500 líneas.
  - Sin `compat-paquetes.js` ni `?v=`. Dentro de `paquetes/` no se leen globales (solo APIs del navegador y la publicación de `window.cmg`/`__banco` para QA; prueba `globales-juego`).
  - Guardado detrás de la interfaz de plataforma (`Plataforma = { almacen, sesion }`, síncrona, texto); `cascaras/web` la implementa con `localStorage`/`sessionStorage`, con las mismas claves y formatos.
- **Desviaciones decididas al cerrar.**
  - Las bibliotecas de terceros (Three r128, Acorn, Lezer) y las compartidas con otras páginas del repositorio (`shared/i18n`, `shared/terreno`, el motor de revisión de `educational-animation`) siguen siendo scripts clásicos: las usan también la portada, `campaign/`, el editor de terreno, el laboratorio de revisión y pruebas `.cjs`. El juego las lee en un único sitio (`js/servicios.js`) y las inyecta. El mapa de imports para las de terceros queda para la fase 3, con el empaquetador.
  - `dibujar(anterior, actual, fraccion)` todavía no interpola: `anterior` llega `null` y las vistas extrapolan la escena actual, como antes (decisión «Escena e instantánea»). `alSuceso` se recibe y no se usa hasta `vfx` (fase 4).
  - `shared/i18n` guarda el idioma con su propio `localStorage` (biblioteca compartida). En escritorio funciona igual (Electron conserva `localStorage`); pasarlo por la plataforma es tarea de la fase 3 si hace falta Steam Cloud.

### Fase 3 · Cáscara de escritorio y Steam

Puede empezar al terminar la fase 0, en paralelo con las fases 1 y 2.

- `cascaras/escritorio` con Electron: ventana, pantalla completa, resoluciones, guardado en disco detrás de una interfaz de guardado común (en web sigue siendo localStorage).
- Steamworks (`steamworks.js` o equivalente): superposición, logros de prueba, Steam Cloud para el guardado. Comprobación en Steam Deck.
- Hecho cuando: hay un ejecutable de Windows y otro de Linux generados por un guion, y una lista de lo que el autor debe hacer en Steamworks (cuenta, AppID, subida a una rama privada). Los agentes no tienen acceso a esa cuenta.
- **Cerrada por los agentes** (16 de noviembre de 2026, rama `arquitectura/fase-3`; detalle en `PROGRESO.md`). `cascaras/escritorio` (Electron 45, protocolo `cbl://`, ventana, pantalla completa, resoluciones, guardado en disco detrás de `Plataforma`); `npm run escritorio:empaquetar` genera los ejecutables de Windows y Linux x64 (@electron/packager, `asar`, el mismo conjunto de archivos que Netlify; empaquetador decidido para escritorio); Steam opcional con `steamworks.js` (logro de prueba, superposición, Auto-Cloud sobre `guardado.json`) y [docs/STEAM.md](STEAM.md) con la lista del autor y los VDF de SteamPipe. Pendiente del autor: la validación en Steam, Windows, Linux y Steam Deck.

### Fase 4 · Motor de dibujo y efectos

- Three.js actual en `vista-3d`. Instancias para unidades repetidas.
- Paquete `vfx` según `docs/PLAN-VFX.md`: recetas de datos, partículas sin estado, mismo efecto en 2D y en 3D, laboratorio.
- Niveles de calidad (bajo, medio, alto) con presupuesto de partículas; post-proceso solo en los niveles que lo aguanten.
- Hecho cuando: los efectos de War se ven en las dos vistas, y la medida de carga está registrada para los tres niveles.

### Fase 5 · Anfitrión determinista

- Sustituir un Worker por máquina por un intérprete con presupuesto de instrucciones: sin límites de reloj real, con muchas unidades y con ejecución paso a paso.
- Primero una prueba corta de las dos opciones (intérprete propio sobre el árbol de Acorn, o QuickJS en WebAssembly) con los programas reales del juego; después, la decisión, registrada aquí.
- Hecho cuando: los programas guardados dan los mismos resultados, y una partida con 500 unidades programadas mantiene el paso fijo.

### Fase 6 · Android

- `cascaras/android` con Capacitor, guardado, ciclo de vida (pausa al salir) y nivel de calidad por defecto según el dispositivo.
- Hecho cuando: hay un APK de prueba y la medida de carga en un teléfono real, que hace el autor.

## Fuera de este plan

- Rediseñar el combate, la interfaz o el estilo gráfico. El plan deja la base preparada para hacerlo; no lo hace.
- Mecánicas nuevas, multijugador, tienda, contenido de Campaign.
- `educational-animation/`, salvo el motor de revisión que el juego importa.
- Un motor nativo. Solo se reconsidera si, terminada la fase 4, las medidas en Steam Deck o en Android no alcanzan. La frontera de instantáneas mantiene abierta esa puerta.

## Riesgos

| Riesgo | Cómo se acota |
| --- | --- |
| La reestructura cambia el comportamiento sin que nadie lo note | Referencias de la fase 0, oráculo de Factory y suites de navegador en cada paso |
| La superposición de Steam falla con Electron | Fase 3 temprana, antes de invertir en efectos |
| Android lento en gama baja | Niveles de calidad y medida de carga; es la segunda prioridad |
| Las instantáneas cuestan demasiado con miles de unidades | Medir antes; el protocolo admite pasar a arreglos compactos sin cambiar las vistas de sitio |
| Las suites de navegador dependen de IDs y de `window.cmg` | Se adaptan en el mismo commit que mueve lo que prueban; no se borran |

## Decisiones pendientes

- Intérprete propio o QuickJS (fase 5).
- Si el núcleo corre en un hilo aparte desde la fase 2 o se deja para cuando la medida lo pida.
- Qué empaquetador usan las cáscaras.
- Qué hacer con `PROGRESO.md` (189 KB): se propone archivarlo en `docs/historial/` y empezar uno nuevo al cerrar la fase 0. **Sigue pendiente**: la fase 0 no lo archivó para no mover historia sin decisión del autor.
- **Escena e instantánea (fase 2, decidido).** La instantánea de los programas (`instantanea(mundo)`) no tiene lo que dibujan las vistas (posiciones, giros, misiles, explosiones) y protege las huellas de referencia. Cada reglamento exporta además `escena(mundo)`: datos planos de lo visible, solo para las vistas. Las vistas extrapolan la escena actual como antes; el contrato `dibujar(anterior, actual, fraccion)` se adoptará con esa semántica.
- **Orden de mensajes entre Workers (hallazgo de la fase 0).** Resuelto en `crearAnfitrion` (fase 2): por unidad y llegada. Medido en el paso 7b: tampoco cambia las 2 referencias de Campaign (coinciden con orden por unidad y por llegada). El juego todavía usa su propio ciclo con `window.RUNTIME` hasta que pase a `crearAnfitrion`. En el navegador, los mensajes de distintos Workers en el mismo instante llegan en un orden que depende del reloj real. Hoy solo cambia el orden del registro de eventos de la interfaz (Campaign H5); el mundo es idéntico paso a paso. El `anfitrion` de la fase 2 debería fijar un orden (por unidad y llegada, como `herramientas/partida/programa.mjs`) para que dos órdenes en el mismo paso no dependan del reloj; la fase 5 lo resuelve del todo.
- **Vigía de 2,5 s de reloj real.** No se puede reproducir sin pantalla; el caso `bucle-sin-await` del oráculo queda fuera de las referencias. Se resuelve con el presupuesto de instrucciones de la fase 5.
- **Suites de navegador fuera de `npm run test:navegador`.** Entran el editor montado solo y, desde el paso 13, las del modo revisión en el juego (`juego.mjs`, `ejecutar-depuracion.cjs`). `python-juego`, `python-ejecucion` y `factory-editor-comun` pasan con un adaptador de Playwright pero no están en la suite; `navegador.mjs`, `editor-movil*.mjs` y `factory-comun.mjs` fallaban ya antes de la fase 2 con ese adaptador (tiempos de espera u origen fijo). Conviene arreglarlas e incluirlas al empezar la fase 3.
- **Puente de reglamento a juego (resuelto).** El juego y la herramienta usan `crearPartida` y las entradas públicas; ya no se exporta `legado`. En el paso 11c se retira `compat-paquetes.js` del juego: la app configura el editor y conecta los proveedores por imports/parámetros.
- **`trunk` antes de la fase 2.** `trunk` tiene dos commits (editor de terreno, `e2d4680` y `c2f0d21`) que tocan `js/vistas.js` e `index.html`, solo en la vista. No afectan a las referencias, pero chocarán con la fase 2 al mover las vistas: conviene unirlos a esta línea antes.
