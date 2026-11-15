# Partida sin pantalla · fase 0, paso 3a

Solo War sobre las fuentes actuales: no es el nuevo núcleo de la fase 1.
No cambia archivos del juego, programas guardados ni reglas.

```sh
node herramientas/partida.mjs --reglas war --reto 2 --semilla 7
node herramientas/partida.mjs --reglas war --reto 2 --semilla 7 --json
node herramientas/partida.mjs --reglas war --reto 2 --semilla 7 --programas /tmp/programas.json
```

`--reto` es 1–5, `--semilla` un entero seguro. Sin archivo se usa `inicial`
del reto normalizado exactamente como en el juego. El archivo es un objeto
`{ "LAU-01": "código" }` o `{ "LAU-01": { "lenguaje": "python", "codigo": "…" } }`;
se permiten fuentes mixtas y las unidades omitidas quedan vacías. Se rechazan
unidades ajenas al reto y errores de revisión/traducción antes de ejecutar.

`--json` devuelve `{ reglas, reto, semilla, resultado, metricas, hash }`.
`resultado` contiene `fin`, `motivo`, `t` sin redondear y los argumentos
`texto`, `linea`, `idProg` del hook `terminar`; los opcionales ausentes son `null`.
Las métricas son pasos, tiempo simulado, mensajes recibidos por tipo y `ms`
totales (incluyen carga). Los milisegundos nunca intervienen en la simulación,
resultado ni hash. `--max-pasos` limita la ejecución a 10000 por defecto;
su resultado propio es `fin: "límite", motivo: "pasos"`.

## Contrato de los módulos

- `cargar.mjs`: `cargar()` crea un contexto y captura el Worker mediante Blob/URL
  falsos. Selecciona los scripts por `index.html`, conservando su orden real.
  También carga `factory.js` porque `runtime.js` interpola `FACTORY.validar`,
  `proveedor.js` para los alias Python y Lezer para el traductor.
  `javascript.js` es el módulo sin DOM que publica `CMGEditorJS.lexico`.
- `instrumentar.mjs`: extrae en ejecución el bloque `const KW`–`instrumentar`
  (incluye `vecino` y `esObjeto`), `revisar`, `opcionesPython`, `mensajePython`,
  `fmtLugar` y `fmtValor`. Acorn encuentra los finales reales; ausencia,
  duplicidad o cambio de estructura producen errores explícitos.
- `programa.mjs`: un contexto y cola de microtareas por unidad. Mensajes clonados
  al enviar, entrega por orden de unidad y FIFO dentro de cada unidad.
  `setTimeout` es una cola virtual local ordenada por vencimiento e inserción.
- `anfitrion-war.mjs`: `ejecutarWar(opciones)` replica el ciclo de mensajes/órdenes
  y usa `WAR.crear/conectar`, `RUNTIME.despertar` y `NUCLEO.avanzar` reales.
  Devuelve además la instantánea final y admite un observador `alPaso` para QA.
- `huella.mjs`: SHA-256 incremental de `paso + ":" + canonico(snap) + "\n"`,
  después de cada `paso(DT)`, incluido el último. Pasos numerados desde 1;
  claves ordenadas lexicográficamente, arrays en orden y números según JSON,
  sin redondeo adicional. `terminar()` devuelve hash, pasos e instantánea final
  clonada (null si no hubo pasos). No incluye la instantánea previa al primer paso.

## Límites frente al navegador

El vigía de `juego.js:478` usa `performance.now()` y no se reproduce. Un bucle
síncrono sin mensajes/await puede bloquear esta herramienta. MAX_ORDENES=4000
sí se conserva, incluido el efecto de la orden 4001 antes de fallar. `node:vm`
no es un entorno seguro para código hostil. Los timers son virtuales; no se
promete paridad de programas que usan reloj real, azar global o APIs del navegador.

El reloj de `bucle(now)` (`juego.js:2637`) solo dosifica el acumulador;
el anfitrión ofrece un DT y reanuda tras las esperas. El `performance.now()`
de `RUNTIME.despertar` solo actualiza la marca del vigía: aquí vale cero.
Globos, avisos y pulsos visuales no se ejecutan ni se cuentan como mensajes de
reglas. En el contraste permanecen activos y se usan Workers reales.

## Verificación

```sh
node pruebas/partida-war.mjs
node pruebas/partida-contraste.mjs
npm test
npm run tipos
```

El contraste necesita Chromium de Playwright y el servidor ya activo en
`http://127.0.0.1:8771`. Instala setters antes del juego con `addInitScript`,
observa `WAR.conectar` y cada paso de `NUCLEO.avanzar`, fija semilla con
`__banco.fijarSemilla`, carga programas y usa turbo. Compara SHA-256, pasos y
todos los campos del resultado para los retos 1–5, semillas 1 y 7. La función
canónica y el formato de registro tienen una sola fuente (`huella.mjs`).
El navegador conserva los registros tomados tras cada paso y aplica SHA-256 al
final mediante Web Crypto; Node actualiza el hash incrementalmente. Ante una
diferencia muestra el primer registro distinto, pasos, resultados y errores.
`probarCaso(browser, caso)` permite contrastar además programas JS/Python propios.
