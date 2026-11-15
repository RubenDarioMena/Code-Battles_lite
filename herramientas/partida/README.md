# Partida sin pantalla · fase 0, pasos 3a y 3b

War y Factory sobre las fuentes actuales: no es el nuevo núcleo de la fase 1.
No cambia archivos del juego, programas guardados ni reglas. Campaign queda para 3c.

```sh
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

## Contrato de los módulos

- `cargar.mjs`: contexto sin DOM y captura del Worker real mediante Blob/URL
  falsos. Scripts seleccionados desde `index.html`, conservando su orden.
  Incluye ambos reglamentos y retos, proveedor Python, traductor, Lezer y Acorn.
- `instrumentar.mjs`: extrae de `juego.js` el bloque `const KW`–`instrumentar`
  y las funciones puras de revisión, Python y formato. Acorn valida los límites;
  ausencia, duplicidad o cambio estructural fallan explícitamente. La serie
  selecciona las funciones y los nombres reales de sus unidades/edificios.
- `programa.mjs`: contexto y microtareas por unidad. Mensajes clonados al enviar,
  entrega por unidad y FIFO. Timers virtuales locales por vencimiento/inserción.
  Cada evaluación y sus microtareas tienen un timeout de VM de 1000 ms.
- `ciclo.mjs`: carga, revisión/traducción, arranque, mensajes comunes, entrega,
  paso fijo real con `NUCLEO.avanzar`/`RUNTIME.despertar`, huella y limpieza.
- `anfitrion-war.mjs`: `ejecutarWar(opciones)` y `resultadoWar`; conserva el
  contrato anterior y los diez SHA-256 completos comprobados en 3a.
- `anfitrion-factory.mjs`: `ejecutarFactory(opciones)`, `resultadoFactory` y
  adaptador de encargos/lecturas. Usa `FACTORY.crear/conectar` reales; completa
  encargos con sus respuestas y evalúa al arrancar, en cada paso y en `done`.
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
node pruebas/partida-war.mjs
node pruebas/partida-factory.mjs
npm test
npm run tipos
node pruebas/fronteras.mjs
node --check pruebas/partida-contraste.mjs
# Fuera del sandbox, con servidor dedicado YA activo en 127.0.0.1:8771:
node pruebas/partida-contraste.mjs --reglas factory
node pruebas/partida-contraste.mjs --reglas war
node pruebas/partida-contraste.mjs --reglas todas
```

`partida-factory` compara todos los campos de `factory-comun`, aplicando solo
los cambios explícitos de `factory-deltas.json`. Imprime cada caso y falla ante
cualquier diferencia nueva. Resultado de lógica actual: **14 iguales, 13 deltas
aceptados, 0 diferencias, 1 excluido**; también comprueba repetición, JS/Python,
semilla/intento, límites y bloqueo al reanudar. No son Workers de navegador.

El contraste acepta War y Factory, por defecto `todas` (10 + 27 casos).
Instala setters de WAR/FACTORY/NUCLEO antes del juego; conserva Workers reales,
pulsos y reloj. Factory carga el escenario propio y los intentos previos en un
contexto aislado. Compara hash, pasos y resultado; informa el primer registro
distinto, incluso cuando una secuencia es prefijo de la otra. La serialización
y el formato tienen una única fuente (`huella.mjs`); Web Crypto calcula SHA-256.
`probarCaso(browser, caso)` mantiene compatibilidad con casos War sin `reglas`.

**Pendiente de 3b:** ejecutar los 27 contrastes reales de Factory fuera del
sandbox (Chromium no se ha lanzado aquí). La sintaxis del archivo y del gancho
generado sí está verificada. Las referencias Factory de navegador siguen
pendientes de esa ejecución; no se presentan los hashes de VM como contrastados.
