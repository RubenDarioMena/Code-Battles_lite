# Partidas sin pantalla

Fase 5, paso 3. War, Factory y Campaign usan `crearPartida`, `crearAnfitrion`
y `jugarPartida`, el mismo conductor que el juego. Node ejecuta el texto real
del arnés histórico en una unidad del intérprete, sin DOM ni Chromium. No hay dependencias nuevas.

## Uso

```sh
node herramientas/partida.mjs --reglas war --reto 2 --semilla 7
node herramientas/partida.mjs --reglas factory --reto 1 --intento 1
node herramientas/partida.mjs --reglas campaign --lenguaje python
```

Opciones: `--json`, `--programas archivo.json`, `--max-pasos N`, `--motor interprete|vm`. War admite
retos 1–5 y una semilla entera segura. Factory admite retos 1–6 y el reto 7
propio (`--escenario archivo.json`); su intento es positivo y equivale a la
semilla. Si se dan ambos, deben coincidir. Campaign usa un nivel continuo,
sin reto, intento ni semilla; `--lenguaje js|python` selecciona sus soluciones.
El presupuesto por defecto es de 10000 pasos en War/Factory y 30000 por tramo
en Campaign; debe ser un entero positivo.

`--programas` contiene un objeto por unidad en War/Factory, o una lista no vacía
de esos objetos en Campaign. Cada fuente es una cadena JS o
`{ "lenguaje": "js" | "python", "codigo": "..." }`. Las unidades omitidas
reciben código vacío; las unidades ajenas o aún no programables se rechazan.
Sin fuentes explícitas se usan los programas iniciales del reto; Campaign usa
la secuencia H0–H5 de `pruebas/campaign-soluciones.cjs`.

## API y salida

`ejecutarWar`, `ejecutarFactory`, `ejecutarCampaign` y `ejecutarReferencia` son
asíncronas: sus consumidores deben usar `await`. Las tres primeras devuelven:

- `resultado`: misma forma y datos deterministas de antes (`resultadoWar`,
  `resultadoFactory`, `resultadoCampaign`). Se compone el mundo con
  `anfitrion.registro()`; los programas no escriben registros en el mundo.
- `metricas`: `pasos`, `t`, `mensajes` por tipo y `ms` de reloj real.
  `alTurno` cuenta los mensajes entregados por la unidad, incluidos los que el
  anfitrión rechaza al detectar un fallo; descarta los posteriores al fallo.
- `hash`: SHA-256 incremental de `paso + ":" + canonico(snap) + "\n"`.
- `instantanea`: última foto incluida en la huella, clonada; null sin pasos.

War y Factory añaden `reglas`, `reto`, `semilla`; Factory añade `intento`.
Campaign añade `tramos`, con `desde`, `hito`, `completado`, `pasos`, `t`,
`hash` y `resultado`. La CLI omite `instantanea`, igual que antes.
`alPaso(paso, instantanea)` recibe cada paso; en Campaign su número es continuo.

La huella excluye el estado inicial e incluye el último paso. War usa la
instantánea pública. Factory/Campaign usan `instantaneaHistorica(mundo)` de
su entrada pública, envuelta en `{ t, maq: {}, auto: {}, vib: {}, factory|campaign }`.
Conserva los campos `undefined` de las referencias de fase 0; la instantánea
pública del protocolo los omite. No se regraban referencias.

Campaign conserva una sola partida. `detener` corta al cumplir un hito o quedar
todos los programas acabados con el mundo `quieto`, antes de las continuaciones
del paso final. Cada resultado toma eventos/uso del tramo y consolas acumuladas.
Después aplica la orden de sistema `fin-tramo` para cancelar tareas y soltar
luces. El hash continuo no reinicia su numeración; cada tramo sí. La salva
posterior a completar H5 queda fuera de la secuencia de referencia.

## Módulos

- `jugar.mjs`: composición común, contexto `nombres`/`tipos`/`sensores`/`conf`,
  revisión, traducción e instrumentación reales, mensajes, finales y huella.
  Las tres pruebas `fronteras-fase2`, `fronteras-factory`, `fronteras-campaign`
  usan esta composición y conservan sus comprobaciones de repetición y paridad.
- `anfitrion-war.mjs`, `anfitrion-factory.mjs`: opciones y resultado por serie.
- `anfitrion-campaign.mjs`: continuidad, cortes y resultados por tramo.
- `cargar.mjs`: scripts reales seleccionados de `index.html`, contexto sin DOM
  y texto del Worker de `fuenteTrabajador`, con validadores y preludio Python.
- `instrumentar.mjs`: extrae las funciones puras actuales de `juego.js` con Acorn.
- `programa.mjs`: alternativa VM para comparación, con canal clonado y timers virtuales.
  La composición vacía las tareas locales del turno antes de otra foto del mundo,
  conservando también los mensajes `cede` programados con `setTimeout(0)`.
- `huella.mjs`, `casos.mjs`, `referencias.mjs`: serialización, selección de los
  41 casos y ejecución para comprobarlos o grabarlos con autorización expresa.

## Límites y comprobación

El juego y el modo predeterminado sin pantalla usan presupuesto por tarea, sin
vigía de reloj real. Con `--motor vm`, cada evaluación y sus microtareas tienen
un timeout de 1000 ms. `jugar.mjs` captura ese fallo después
de cerrar el conductor y conserva `bloqueado/vm-timeout`, su texto y la huella
hasta el último paso. Si no hay tarea virtual ni espera del juego,
`crearAnfitrion` devuelve `sin-cesion` y la composición lo presenta como
`bloqueado/sin-cesion`. Ambos caminos tienen regresiones en `partida-war`.
`node:vm` no es un entorno seguro para código hostil.

MAX_ORDENES=4000 y los 500 sensores de Factory conservan diagnósticos y efectos.
El oráculo ejecuta 28 casos: solo `bucle-sin-await` se excluye de las referencias
por haber dependido del vigía histórico. Hoy se comprueba su resultado completo
de error del programa por presupuesto, línea 1 y dos ejecuciones idénticas.
`bucle-con-metas` sigue incluido: termina antes de alcanzar el bucle.

```sh
npm test
npm run tipos
node pruebas/fronteras.mjs
# Verificación de navegador, por separado y en el origen dedicado 8771:
npm run test:navegador
```

Las 41 referencias persistentes se documentan en
[pruebas/referencias/README.md](../../pruebas/referencias/README.md).
Las comprobaciones Node no sustituyen la interacción ni las capturas en el navegador.
El comparador de Campaign conserva la tolerancia histórica al intercalado de
unidades dentro del mismo tiempo, con FIFO y todos los campos por unidad;
`partida-campaign-intercalado.json` conserva su evidencia. La lógica de los
resultados y las referencias se compara sin esa normalización.

## Motor de los programas (fase 5, paso 3)

Por defecto `jugar` usa `crearTrabajadorInterprete` con Acorn local y 600 000
nodos por tarea, sin Workers ni reloj para los límites. Los diagnósticos usan
los mismos catálogos ES que el juego y la línea del intérprete. La CLI acepta
`--motor interprete|vm`; `crearPrograma` sigue siendo inyectable y prevalece
sobre esa selección. La VM conserva su timeout como herramienta de comparación.
`pruebas/partida-interprete.mjs` compara las 41 partidas entre ambos motores y
comprueba bucles repetibles sin añadirlos al archivo de referencias.
