# Partida sin pantalla · fase 0, pasos 3a–3c y 5

War, Factory y Campaign sobre las fuentes actuales: no es el nuevo núcleo de la fase 1.
No cambia archivos del juego, programas guardados ni reglas.

```sh
node herramientas/partida.mjs --reglas campaign --lenguaje python --json
node herramientas/partida.mjs --reglas campaign --programas /tmp/tramos.json --json
node herramientas/partida.mjs --reglas war --reto 2 --semilla 7 --json
node herramientas/partida.mjs --reglas factory --reto 5 --intento 2 --json
node herramientas/partida.mjs --reglas factory --reto 1 --semilla 7 --programas /tmp/programas.json
node herramientas/partida.mjs --reglas factory --reto 7 --intento 1 --escenario /tmp/reto.json
```

`--reto` es 1–5 para War, 1–6 para Factory y 7 para «Tu reto».
El oráculo histórico usa índices 0–6: las pruebas suman uno explícitamente.
War requiere `--semilla`, un entero seguro. En Factory `--intento K` y
`--semilla K` son equivalentes (entero seguro positivo); si se dan ambos deben
coincidir. Factory crea el mundo con el intento, no con el RNG de War:
el stock oculto sigue la secuencia `stockPorIntento`. En el contraste se prepara
la telemetría anterior para que el juego arranque exactamente ese intento.

Sin `--programas` se usa `inicial` del reto, como en el juego. El archivo es
un objeto `{ "R1": "código" }` para Factory (`"LAU-01"` para War), o
`{ "R1": { "lenguaje": "python", "codigo": "…" } }`. Se permiten fuentes
mixtas y las unidades omitidas quedan vacías. Se rechazan unidades ajenas.
War revisa JS antes de arrancar; Factory deja su diagnóstico al Worker, como
`juego.js`. Python usa el traductor y proveedor reales de cada serie.
`--escenario` solo se admite en Factory 7: JSON normalizado con
`FACTORY_RETOS.normalizar`, igual que `factory-propio` en la aplicación.
Sin él, Factory 7 usa la base propia normalizada; su programa inicial está vacío.

`--json` devuelve `{ reglas, reto, semilla, resultado, metricas, hash }` y
además `intento` para Factory. War conserva `fin`, `motivo`, `t` sin redondear,
`texto`, `linea`, `idProg`. Factory usa exactamente la forma de `factory-comun`:
`fin`, `motivo`, `mensaje`, `linea`, `t` sin redondear, `intento`, `derrames`,
`vacios`, `stockOculto`, `metas`, `robot`, `resultados`, `eventos`.
Los normalizadores de resultado también se inyectan en el contraste real.
Las métricas incluyen pasos, tiempo simulado, mensajes por tipo y `ms` totales
(incluyen carga). Los milisegundos no intervienen en las reglas ni en la huella.
`--max-pasos` limita a 10000 por defecto: `fin: "límite", motivo: "pasos"`.

## Campaign: secuencia sobre un mundo continuo

`--reglas campaign [--lenguaje js|python] [--programas archivo.json]` no recibe
reto, semilla, intento ni escenario. Sin archivo usa H0–H5 de
`pruebas/campaign-soluciones.cjs`; ahora contiene ambos lenguajes. Las fuentes
Python usan una función para la búsqueda de destino (aún no hay diccionarios)
y `return await` en el auxiliar async. No se ha cambiado la semántica del traductor.
Con archivo, el formato es una lista de objetos por unidad, por ejemplo:

```json
[{ "FRK-01": "await pickUp(BAY_1); await deliver(SUP_1);" }]
```

Las cadenas usan `--lenguaje` (JS por defecto); también se admite
`{ "lenguaje": "python", "codigo": "…" }` por unidad. Se rechazan unidades
que todavía no son programables. Las omitidas quedan vacías, sin heredar fuentes
del tramo anterior. Los programas del tramo siguiente se cargan tras detener
el anterior; se conserva el mismo objeto mundo, incluidos cargas, procesos,
pedidos, presupuesto y posiciones. Al detener se cancelan tareas y luces,
se registra uso y se vacía, como `cerrarProgramas`/`terminarCampaign`.
`--max-pasos` limita **cada tramo**, por defecto 30000 en Campaign (10000 en las
otras series). También se corta por error, bloqueo o quietud. La secuencia termina
al completar H5 o cuando un tramo termina sin avanzar de hito.

**Punto de corte y riesgo del reloj real.** `CAMPAIGN.evaluar` cambia el hito y
llama a `hooks.hito` dentro de `paso`. En `juego.js:1054` ese hook solo escribe
`hitoPendiente`. `alCumplirHito` (`2599`) pone `pausa = !!ejec`, guarda
checkpoint/estado vivo, registra victoria/hito y muestra el banner: **conserva
los Workers**, para poder seguir y arrancar las unidades recién encendidas.
Se llama desde `cicloCampaign` (`2628`), después de `avanzar()` en el fotograma
(`2641–2642`). Puede haber más pasos dentro del acumulador antes de la pausa;
además los mensajes de Workers pueden seguir entrando mientras `mundo.activo`
sea verdadero. Ejecutar otra vez cierra los programas y conserva el mundo;
el botón alternar detiene con registro `detenido/detenido`.

Para comparar una frontera determinista, el anfitrión corta **tras la instantánea
del primer paso que cambia hito o completado, antes de entregar sus mensajes**.
Solo en el arnés de contraste, el hook de NUCLEO pone `mundo.activo = false` tras
registrar ese paso: corta el resto del acumulador y bloquea mensajes posteriores
por la guarda real de `alMensaje`. Se deja que el juego procese el banner y su
checkpoint, se comprueba su tiempo, y se detiene con `alternarEjecucion`. No se
toca ningún archivo del juego. Esta intervención fija la parada de QA; no acredita
que una parada humana o `campaign-juego.cjs` ocurra en ese mismo paso. Tampoco se
pulsa «Ver salva»: H5 completa es la última frontera, la salva posterior queda fuera.

La salida contiene `resultado` (`hito`, `completado`, `t`, `hitosT`, presupuesto,
producidos, eventos y `registro` normalizado de terminarCampaign), `tramos`
(`desde`, `hito`, `completado`, pasos, t absoluto, hash y resultado), métricas y hash
continuo. El registro conserva resultado, motivo, mensaje, línea, programa,
tiempoJuego, hito, presupuesto, producidos, uso y consolas; excluye fechas,
intento y fuentes. El contraste comprueba esos campos contra la telemetría real.

**Excepción demostrada del orden de eventos de Campaign (solo comparación).**
El primer contraste Chromium dio 0/2 pese a coincidir los 16707 pasos y todos
sus registros. Se recuperó su JSON retirando dos líneas de stdout intercaladas
dentro del diagnóstico de stderr. H0–H4 son idénticos. En H5, los 1663 eventos
son los mismos, con idénticos campos y tiempos; solo cambian los primeros
2 lugares en JS y 3 en Python, todos en t=527.05. El navegador recibe primero
`BLT-01.start`, mientras la VM entrega primero la lectura de `BOT-02`; la lectura
de `CTL-01` también se intercala distinto en Python. Registros, uso, consolas,
tiempo, resultados y errores de página coinciden (sin errores).

Los Workers independientes corren y envían mensajes según la planificación real
del navegador: no hay un orden total garantizado entre unidades. Para comparar
Campaign se agrupa **cada bloque contiguo del mismo t** por `maquina`, con ordenación
estable. Se preservan todos los campos, duplicados, tiempos, bloques temporales y
el FIFO de cada unidad. No se cambia la simulación, el gancho, los resultados
originales ni las huellas; tampoco se relaja War/Factory. La comparación sigue
fallando si cambia un valor, falta un evento o cambia el orden dentro de una
unidad. `partida-campaign-intercalado.json` conserva la evidencia mínima real;
las pruebas cubren esa excepción y sus límites. La evidencia completa recuperada
de ambos lenguajes coincide al aplicar únicamente esta normalización.

La huella usa la envoltura completa que reciben los programas:
`{ t, maq: {}, auto: {}, vib: {}, campaign: campana.instantanea() }`.
El SHA continuo numera desde 1 hasta 16707, sin reiniciar entre tramos;
cada hash de tramo numera localmente desde 1. Ambos incluyen su último paso y
excluyen el estado inicial y la cancelación de tareas posterior.

Referencias **de VM**, idénticas JS/Python (t absoluto mostrado a dos decimales;
el JSON y la huella conservan t sin redondear):

| Tramo cumplido | Pasos | Δt (s) | t final (s) | SHA-256 de tramo |
| --- | ---: | ---: | ---: | --- |
| H0 → H1 | 149 | 7.45 | 7.45 | `d92498775bdc4eb3fc11efa9a488d4d0a4cb27391d043a9bd68b17dd5345a56a` |
| H1 → H2 | 1058 | 52.90 | 60.35 | `57c88c747120895e6f017f408e78951f3bdc15c623b5df4d72ffa17d5ec5210d` |
| H2 → H3 | 2493 | 124.65 | 185.00 | `9ad3db45c978367ebdb0fc96f53df2d839d75c91a8d1e01d8a8e4317c1fa340d` |
| H3 → H4 | 2020 | 101.00 | 286.00 | `d9e10f66cb9c71446483d681bf59989cd4a8a70d5f2a94c9ed80324771430f4d` |
| H4 → H5 | 4821 | 241.05 | 527.05 | `0456f29f2b62bb5bc823cdf2ca84d83101ca3dc654943c606fc3ab57a8cf1dad` |
| H5 completa | 6166 | 308.30 | 835.35 | `d9563a8f964340db1168d0a9564220adafdcc749dbec313791818f60db342f1b` |

Hash continuo: `9a7bfd5f8676882813790279af63a49e1be083a80d88b09c2f90b517f13714ae`.
`partida-referencias` protege estos hashes y todos los resultados/tramos completos.
`partida-campaign` ejecuta cada lenguaje dos veces;
compara H0/H1 y la recepción de 12 misiles con la misma prueba de reglas exportada
por `campaign-reglas.cjs`, sin copiar su mini-lockstep. Los tiempos posteriores
de aquella prueba no son referencias del Worker: sus programas deciden otras rutas.

## Contrato de los módulos

- `cargar.mjs`: contexto sin DOM y captura del Worker real mediante Blob/URL
  falsos. Scripts seleccionados desde `index.html`, conservando su orden.
  War y sus retos se importan desde `paquetes/reglas-war/index.js`; se inyectan
  copias planas de `legado` y `retos` como `WAR`/`WAR_RETOS` antes de cargar los
  scripts que siguen en `vm`. Factory y Campaign siguen cargándose desde sus
  scripts reales. Incluye proveedor Python, traductor, Lezer y Acorn.
- `instrumentar.mjs`: extrae de `juego.js` el bloque `const KW`–`instrumentar`
  y las funciones puras de revisión, Python y formato. Acorn valida los límites;
  ausencia, duplicidad o cambio estructural fallan explícitamente. La serie
  selecciona las funciones y los nombres reales de sus unidades/edificios.
- `programa.mjs`: contexto y microtareas por unidad. Mensajes clonados al enviar,
  entrega por unidad y FIFO. Timers virtuales locales por vencimiento/inserción.
  Cada evaluación y sus microtareas tienen un timeout de VM de 1000 ms.
- `ciclo.mjs`: carga, revisión/traducción, arranque, mensajes comunes, entrega,
  paso fijo con `DT`/`avanzar` importados de `paquetes/nucleo` y
  `RUNTIME.despertar`, huella y limpieza. Usa `legado` y `retos` importados de
  `paquetes/reglas-war`; las órdenes War pasan por `legado.aplicarOrden` con
  `{ paso: Math.round(mundo.t / DT), origen: "programa", unidad, verbo,
  args: [lugar ?? null] }`, igual que en el juego, antes del registro original.
- `anfitrion-war.mjs`: `ejecutarWar(opciones)` y `resultadoWar`; conserva el
  contrato anterior; los diez SHA-256 comprobados en 3a están en las referencias.
- `anfitrion-factory.mjs`: `ejecutarFactory(opciones)`, `resultadoFactory` y
  adaptador de encargos/lecturas. Usa `FACTORY.crear/conectar` reales; completa
  encargos con sus respuestas y evalúa al arrancar, en cada paso y en `done`.
- `anfitrion-campaign.mjs`: `ejecutarCampaign`, `programasCampaign`,
  `resultadoCampaign` y el adaptador de mensajes con `p.pend`, modos y cesiones.
  Reutiliza `ciclo.mjs` con sesión persistente y huella continua.
- `huella.mjs`: SHA-256 incremental de `paso + ":" + canonico(snap) + "\n"`
  tras cada paso, incluido el último; numeración desde 1, claves ordenadas,
  arrays en orden, números sin redondear. No incluye la instantánea inicial.
  En Factory se registra la instantánea completa que reciben los programas:
  `{ t, maq: {}, auto: {}, vib: {}, factory: FACTORY.instantanea(mundo) }`.
  Los anfitriones devuelven además la instantánea final clonada (null sin pasos)
  y aceptan `alPaso(paso, instantanea)` para QA.

## Límites y selección de referencias

El vigía de `juego.js` usa `performance.now()` y no se reproduce. La VM corta
bucles síncronos o de microtareas con `fin: "bloqueado", motivo: "vm-timeout"`;
el timeout es protección de la herramienta, no un resultado comparable del juego.
También devuelve `bloqueado/sin-cesion` si el programa no tiene tarea virtual
ni espera del juego. `node:vm` no es un entorno seguro para código hostil.
Timers virtuales, reloj real, azar global y APIs de navegador no tienen paridad
prometida. Un programa legítimo que consuma más de 1000 ms por entrega también
se corta: no usar esos resultados como referencia determinista.

De los 28 casos del oráculo se ejecutan todos, pero se excluye de referencias
y del contraste **solo `bucle-sin-await` (categoría `vigia`)**: su resultado
histórico depende de 2.5 s de reloj real. Se comprueba su salida bloqueada.
**`bucle-con-metas` (categoría `no-termina`) sí se incluye**: la victoria en la
última entrega interrumpe el programa antes del bucle; es un delta ya aceptado.
`limite-sensores` sí se incluye: la lectura 501 produce el diagnóstico real de
500 sensores; la VM cede antes de agotar CPU/memoria. MAX_ORDENES=4000 también
se conserva, incluido el efecto de la orden 4001 antes del error.

Globos, avisos y pulsos visuales no se ejecutan. El reloj de `bucle(now)` solo
dosifica el acumulador; aquí se ofrece un DT y se reanuda tras las esperas.
La marca del vigía de `RUNTIME.despertar` vale cero en la herramienta.

## Verificación y pendiente

```sh
node pruebas/partida-campaign.mjs
node pruebas/partida-war.mjs
node pruebas/partida-factory.mjs
npm test
npm run tipos
node pruebas/fronteras.mjs
node --check pruebas/partida-contraste.mjs
# Fuera del sandbox, con servidor dedicado YA activo en 127.0.0.1:8771:
node pruebas/partida-contraste.mjs --reglas factory
node pruebas/partida-contraste.mjs --reglas war
node pruebas/partida-contraste.mjs --reglas campaign
node pruebas/partida-contraste.mjs --reglas todas
```

`partida-factory` compara todos los campos de `factory-comun`, aplicando solo
los cambios explícitos de `factory-deltas.json`. Imprime cada caso y falla ante
cualquier diferencia nueva. Resultado de lógica actual: **14 iguales, 13 deltas
aceptados, 0 diferencias, 1 excluido**; también comprueba repetición, JS/Python,
semilla/intento, límites y bloqueo al reanudar. No son Workers de navegador.

El contraste acepta `war|factory|campaign|todas`, por defecto `todas` (10 + 27 + 2 casos originales y 2 Python nuevos).
Instala setters de WAR/FACTORY/CAMPAIGN/NUCLEO antes del juego; conserva Workers reales,
pulsos y reloj. Factory carga el escenario propio y los intentos previos en un
contexto aislado. Compara hash, pasos y resultado; informa el primer registro
distinto, incluso cuando una secuencia es prefijo de la otra. El diagnóstico
común imprime la primera diferencia del resultado y de cada tramo, las diferencias
de hash/pasos y los errores de página (como máximo sus primeros 300 caracteres).
Son hasta 19 líneas de diagnóstico de hasta 300 caracteres, más la línea resumen
del caso: `ruta · juego=valor corto · sin pantalla=valor corto`. Los contenedores
se resumen y, si no cabe todo, se informa cuántas diferencias/errores se omiten. La serialización
y el formato tienen una única fuente (`huella.mjs`); Web Crypto calcula SHA-256.
`probarCaso(browser, caso)` mantiene compatibilidad con casos War sin `reglas`.

**Evidencia histórica proporcionada por la dirección:** los 37 contrastes reales de
War/Factory de 3a/3b pasaron. En 3c sus hashes se siguen comprobando mediante las
suites de lógica; no se relanza Chromium aquí. **Evidencia actual proporcionada
por la dirección:** Campaign JS/Python tiene hashes y pasos idénticos a la VM;
el contraste inicialmente falló por el intercalado descrito arriba. La comparación
corregida pasa al reprocesar la captura completa. **Pendiente de 3c:** repetir los
dos contrastes Campaign fuera del sandbox con el nuevo comparador. Se verifica
sintaxis de módulos y gancho generado, sin ejecutar Chromium. No se han modificado Prototypes/, shared/ ni PROGRESO.md.

## Referencias persistentes · paso 5

`casos.mjs` exporta `casosReferencia()` y `parametrosCaso()`: selección única
para grabación, comprobación y contraste, sin cambiar los 39 casos anteriores.
Los dos programas Python nuevos se escribieron a mano, equivalentes al inicial
de War 2/7 y a `reto-1-victoria` del oráculo (reto público 2, intento 1).
`referencias.mjs` ejecuta un caso y descarta métricas de reloj e instantánea final;
conserva el resultado íntegro de VM y los tramos completos de Campaign.

`node herramientas/grabar-referencias.mjs` crea el JSON; si existe exige
`--forzar` y advierte que regrabar requiere decisión del autor.
`node pruebas/partida-referencias.mjs` compara los 41 casos; también está en
`npm test`. Véase [el contrato de referencias](../../pruebas/referencias/README.md).
No guarda registros por paso: el diagnóstico no puede localizar el primer paso
distinto y lo indica con null. Factory mantiene su prueba completa del oráculo,
y las tres suites mantienen determinismo y comprobaciones del anfitrión.
