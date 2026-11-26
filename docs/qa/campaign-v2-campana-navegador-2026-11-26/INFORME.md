# QA en el navegador · Campaign-V2 nivel 1 completo · 26-nov-2026

**Estado:** terminado. Nivel 1 jugado entero (H0 → B1 → H1 → B2 → H2 → B3 → H3 → B4 → H4 → B5 → H5 → B6 → B7 → B8 → H6) hasta «Misión 1 completada», y repetidos H1, B2 y H6 en móvil.

## Resumen

- **La campaña no se puede terminar sin la consola.** Dos bloqueos: C1 (un pedido de BAY-1 que llega durante la Batalla se convierte en un «error del programa» a los 3 s; pasa en B2, B3, B5 y B6) y M3 (la bodega llega a B4 con 0 misiles). Para seguir se usaron parches de consola y una edición del checkpoint `b6`, anotados en cada fila.
- **Errores de consola no capturados:** A1 al pasar de cada Batalla a la fábrica (6 veces en escritorio y 1 en móvil) y A2 al elegir WHL-01 o MIN-01, que congela el juego. Las fábricas no dieron ningún error.
- **Funciona bien:** las tarjetas entre hitos, los checkpoints (menú ⋯, botón ↺ Checkpoint, volver a H1 y a H6 desde el menú), la recarga a mitad de un hito de fábrica, el colocador de PAL-3 con la interfaz real, las cargas del minador y el editor CodeMirror en escritorio y en móvil. Las repeticiones en móvil dieron exactamente los mismos tiempos y resultados (H1 a t 74,95; B2 13/13 con 20 misiles a 34,65 s; H6 a t 721,75): el juego es determinista.
- **Luces:** nunca rojo. El ámbar solo aparece con la salida llena; una máquina que espera material luce verde (M4).
- **Textos:** claves i18n crudas `cv2.b6.titulo`, `cv2.b7.titulo` y `cv2.b8.titulo` en las tarjetas (M7).

## Cómo se probó

- Rama `Campaign-V2`, worktree `Code-battle-lite-cv2`. Servidor sin caché (`.claude/servidor-sin-cache.py`, puerto 8779, configuración `campaign-v2` de `.claude/launch.json`). Página `Prototypes/Campaign-V2/index.html`.
- Navegador incorporado de la app (herramientas `mcp__Claude_Browser__*`), viewport 1024×768. Móvil con el preajuste 375×812. El panel estaba oculto, así que tras cada carga se sustituyó `requestAnimationFrame` por un `setTimeout` de 16 ms, como indica la tarea. Los errores se recogieron con `read_console_messages` y con un capturador de `error`/`unhandledrejection` instalado en cada carga.
- Programas: los de `docs/campaign-v2-soluciones-nivel-1.html`. Se escribieron **con el editor** (clic, Cmd+A y tecleo en CodeMirror) en B1, H1, B7 (WHL-01) y en H1 en móvil (editor a pantalla completa y su ▶). En el resto, con `__banco.programas[id] = …` seguido de `__banco.abrirPrograma(id)` (ver M2).
- Partida limpia: borradas las claves `campaign-v2*` de `localStorage` desde otra página del mismo origen (ver M1).
- Turbo ×4 en casi todo (×2 en partes de H3 y H4). Los tiempos son de simulación.
- No se ha corregido código: solo se informa.

### Rodeos usados para seguir (no son arreglos)

1. **C1, B2/B3/B5:** `setInterval(() => { const p = __banco.mundo?.porId; if (p && !p["BAY-1"]) p["BAY-1"] = { id: "BAY-1" }; }, 20)` antes de Ejecutar.
2. **C1, B6:** ahí `porId` es un getter no configurable y el rodeo 1 no sirve. Se editó `localStorage["campaign-v2-nivel-1"].hitos.b6` con la página cerrada: pedido de 5 placas quitado y tarima con 5 placas puesta en BAY-1, como si ya hubiera llegado.
3. **M3, B4/B6/B8:** `__banco.partida.mundo.bodega.misiles = 60` justo **después** de pulsar Ejecutar (antes no sirve: M5). Los misiles que sobraron pasaron a las etapas siguientes (B5 y B7 se ganaron con esa bodega heredada).
4. **A2, B7:** recargar y no elegir WHL-01.

## Tabla por etapa

| Etapa | Resultado | Tiempo (sim) | Brechas / derribos | Bodega antes → después | Errores de consola | Vía del programa | Notas |
|---|---|---|---|---|---|---|---|
| H0 · Llegada | cumplido | 4,8 s | — | 48 → 48 | 0 | programa de partida | Tarjeta «H0 · Llegada · cumplido» con bodega 48 y «checkpoint guardado». Recargar en la tarjeta lleva directo a B1. |
| B1 · Primer blanco | victoria | 35,9 s | 0 / 6 | 48 → 37 | **1** (A1) | editor (tecleado) | 12 misiles gastados. Recarga a los 10 s: la Batalla vuelve a t = 0 con el programa conservado. |
| H1 · Máquina rápida | cumplido | ≈ 34 s de planta (40,8 → 75,0) | — | 37 → 37 | 0 | editor (ARM-01) | Luz de PRS-01 verde mientras prensa. La recarga «a mitad» llegó tarde: el hito ya se había cumplido y la recarga saltó la tarjeta y abrió B2 directamente (el checkpoint de B2 estaba guardado). |
| B2 · Prioridades | **bloqueada (C1)**; victoria con parche de consola | 34,7 s | 0 / 13 | 37 → 18 | 1 (A1) + error de programa falso (C1) | `__banco.programas` + `abrirPrograma` | Sin parche, *cualquier* programa (incluso vacío) termina en «Error en el programa de LAU-01 · Cannot read properties of undefined (reading 'id')» a los 3,0 s; 5 intentos y una recarga. En `?ensayo=b2` el mismo programa va bien. Con el parche: 20 misiles gastados, 13/13. |
| H2 · Dos brazos | cumplido | ≈ 44 s de planta (109,6 → 153,3) | — | 18 → 18 | 0 | `__banco.programas` + `abrirPrograma` (FRK-01, ARM-02); ARM-01 seguía con el de H1 | PAL-3 movida con la interfaz real: seleccionar → «Mover» → toque junto a ARM-02 → barra ↻ ✓ ✕ → ✓. Quedó en (86,97; 47,59), a 2,2 m de ARM-02 (alcance 2,8); aviso «PAL-3 colocado.». Luces: ver M4. Al cumplir, BAY-1 pide acero (llega a +3 s) y polímero (+6 s): B3 empezará con dos pedidos en camino (C1). |
| B3 · Niebla | **bloqueada (C1)**; victoria con parche | 34,3 s | 0 / 11 | 18 → **0** | 1 (A1) + C1 sin parche | `__banco.programas` + `abrirPrograma` | Sin parche: mismo error falso de LAU-01 a los 3,0 s (1 intento). Con parche: 24 misiles; acabó con 2 en el cargador y la bodega a 0. Ganó por poco margen de munición. |
| H3 · Máquina lenta | cumplido | ≈ 46 s de planta (187,6 → 233,6) | — | 0 → 0 | 0 | `__banco.programas` + `abrirPrograma` | **Recarga a mitad (3/4 cargas, t 227,5) correcta:** el mundo vuelve igual (MIX-01 mezclando, zona T7/T8, salida T9), pero la planta queda parada hasta pulsar Ejecutar, que arranca los programas desde la primera línea (aquí no hizo daño). La tarjeta avisa: «Ojo: la bodega va justa para esta batalla (0 de unos 36 misiles)». |
| B4 · Enjambre | fallo con la bodega real (0); victoria con bodega 60 al 2.º intento | 47,9 s | 0 / 38 (3 atascos) | 0 → (60 por consola) → 18 | 1 (A1) | `__banco.programas` + `abrirPrograma` | Sin pedidos en camino: C1 no aparece. Intento 1 (bodega 0): fallo a los 23,7 s, 10/38, 2 brechas, cargador vacío; la pista dice «el programa de partida espera a 0,35…» (M6). Intento 2: `bodega.misiles = 60` antes de Ejecutar **no surtió efecto** (M5): mismo fallo. Intento 3 (60 tras Ejecutar): fallo por azar, 30/38, 2 brechas, 3 atascos. Intento 4: victoria, 43 misiles, 3 atascos. Los 18 que sobran vienen del parche y favorecen a B5. |
| H4 · Ensamblaje | cumplido | ≈ 42 s de planta (281,5 → 323,4) | — | 18 → 22 | 0 | `__banco.programas` + `abrirPrograma` | **Botón ↺ Checkpoint probado:** el primer toque cambia el rótulo a «¿Volver al inicio de H4?» (unos 2 s); el segundo recarga la página en el inicio de H4 (t 281,5) con el programa nuevo conservado. Sin «sin energía». La tarjeta no avisa de que la bodega (22) no llega para B5 (~45), al contrario que la de H3 (O5). Al cumplir, BAY-1 pide acero (+3 s) y polímero (+6 s): C1 en B5. |
| B5 · Dos lanzadores | victoria al 1.er intento (con parche C1, sin tocar la bodega) | 36,2 s | 0 / 31 (2 atascos) | 22 → 0 | 1 (A1) | `__banco.programas` + `abrirPrograma` (LAU-01 y LAU-02) | 43 misiles: 22 de la bodega más los cargadores de 12 de cada lanzador. Ganó por los 18 que sobraron del parche de B4; sin él habría llegado con 4 (0 + los 4 de H4). La etiqueta «Unidades · 1» no cuenta los dos lanzadores (O6). |
| H5 · La cadena entera | cumplido | 110 s de planta (359,5 → 469,5; meta ≤ 150) | — | 0 → 6 | 0 | `__banco.programas` + `abrirPrograma` (ARM-01, ARM-02, FRK-01) | Sin «sin energía» (⚡ 6/10 al final). Luces de PRS/MLD/MIX/ASM: verde en las 27 muestras (1/s), ninguna ámbar (M4). **Tarjeta con clave i18n cruda: «Ahora la Batalla: cv2.b6.titulo.»** (M7). Avisa «la bodega va justa (6 de unos 12)». Solo 6 en bodega tras «8 misiles más» (O7). BAY-1 pide 5 placas (+3 s): C1 en B6. |
| B6 · Fuera de la muralla | **bloqueada (C1)**; fallo con la bodega real (6); victoria con bodega 60 | 33,9 s | 0 / 26 (mínimo 14) | 6 → (60) → 23 | 0 | `__banco.programas` + `abrirPrograma` (LAU-01, LAU-02, VEH-01) | El parche de C1 ya no sirve aquí: en B6 `mundo.porId` es un getter no configurable que se recalcula. El error falso pasó a VEH-01 («Error en el programa de VEH-01», t 3,0 s, 2 intentos). Se siguió **editando el checkpoint `b6` en `localStorage`** con la página cerrada: pedido de 5 placas quitado y tarima T16 con 5 placas ya en BAY-1 (equivale a la entrega). Intento con bodega 6: fallo a 44,7 s, 3 brechas, 20/26, bodega a 0. Con 60: victoria, 37 misiles. Tarjeta con claves crudas «cv2.b6.titulo · superado» y «Siguiente batalla: cv2.b7.titulo.» (M7). |
| B7 · La rueda | victoria (bodega heredada del parche de B6) | 72,8 s | 0 / 15 (mínimo 12) | 23 → 0 | **1** (A2) en el primer intento | editor (WHL-01, tecleado) + `__banco.programas` (torretas) | «Continuar» desde B6 pasa a B7 sin recargar. **Elegir WHL-01 congela el juego (A2):** el primer intento se quedó en t = 0 con «Aplicar ahora». Tras recargar y sin elegir WHL-01, victoria con 31 misiles. La tarjeta: «cv2.b7.titulo · superado», «Siguiente batalla: cv2.b8.titulo.» y «la bodega va justa (0 de unos 2 misiles)». |
| B8 · Siembra | fallo con la bodega real (0); victoria con bodega 60 | 48,5 s | 0 / 18 (mínimo 14) | 0 → (60) → 11 | 1 (A1) | programa de partida (MIN-01) + `__banco.programas` (torretas) | Sin pedidos en camino. Las cuatro cargas estallan («¡Carga! 1 enemigos» ×4 en el registro y en el globo). Intento con bodega 0: fallo a 57,3 s, 4 brechas, 13/18, cargador vacío; la pista habla de sembrar antes, no de munición (M6). Con 60: victoria, 50 misiles. Tarjeta «cv2.b8.titulo · superado» (M7) y botón «A la fábrica». |
| H6 · Carcasas | **cumplido · misión completada** | ≈ 97 s de planta (624,8 → 721,7) | — | 11 → 11 | 0 | `__banco.programas` + `abrirPrograma` (ARM-01, ARM-02, FRK-01, BOT-01) | 6/6 semiesferas en PAL-7 y 1/1 placa refundida. Tarjeta final «Misión 1 completada · H6 · Carcasas · cumplido», con «Seguir aquí» y «Empezar la campaña de nuevo» ([captura](h6-mision-completada.jpg)). Luces muestreadas 1/s: SAW-01 ámbar 3 veces (salida llena) y verde/parada 11; EMB-01 y FND-01 casi siempre verdes y paradas (M4). Ningún rojo. El checkpoint guardado cubre los 15 hitos (h0…h6). |

## Hallazgos (por gravedad)

### Crítica

- **C1 · B2 no se puede jugar en la campaña: la llegada de un pedido a BAY-1 durante la Batalla se atribuye como error al programa de LAU-01.** Al cumplir H1, la fábrica pide 12 de polímero que llegan 3,0 s después (`BAY-1.pedidos[0].llega = 77,95` con la planta en 74,95). La fábrica sigue corriendo durante B2, y a los 3,0 s de Batalla emite el suceso `entrega-pedido`. `ciclo-programas.js:221` llama a `ctx.entregaCampaign(ctx.mundo.porId[s.unidad], d)`, pero en la Batalla `ctx.mundo` es el mundo de la Batalla y `porId["BAY-1"]` es `undefined`; `entregaCampaign` (`campaign.js:85`) lee `bahia.id` y lanza. El `.catch` de `avanzar` (`ciclo-programas.js:253-254`) lo achaca al programa seleccionado: «Error en el programa de LAU-01 · Cannot read properties of undefined (reading 'id')» e «Ir a la línea» señala `await esperar(0.5)`.
  - Comprobado: pasa con el programa de la guía, con el de B1, con `log(pos)`, con `while (true) { await esperar(0.5); }` y con `// nada`. Siempre a t = 3,0 s. En `?ensayo=b2` (sin fábrica) no pasa.
  - Confirmación: con `setInterval(() => { const p = __banco.mundo?.porId; if (p && !p["BAY-1"]) p["BAY-1"] = { id: "BAY-1" }; }, 20)` en la consola, B2 pasa de los 3 s y se gana. **Ese parche de consola se usó para seguir la campaña** en las Batallas siguientes en las que hacía falta (se indica en la tabla).
  - Alcance comprobado: B2 (tras H1), B3 (tras H2) y B6 (tras H5, error atribuido a VEH-01). En B5 (tras H4, dos pedidos en camino) se aplicó el parche de antemano. B4, B7 y B8 no tenían pedidos en camino y no fallaron. También se reprodujo en móvil ([captura](movil-b2-error-c1.jpg)).
  - Reproducir: partida limpia → H0 → B1 → H1 con los programas de la guía → B2 con cualquier programa → Ejecutar → a los 3 s, error.

### Alta

- **A1 · Error no capturado al terminar una Batalla y pasar a la fábrica.** `TypeError: Cannot read properties of undefined (reading 'map')` en `paquetes/vista-3d/cv2/index.js:148` (`e.enemigos.map`), desde `bucle.js:16`. Sale una vez por Batalla, justo al ganar y aparecer la tarjeta «superado» antes de «A la fábrica»: en B1, B2, B3, B4, B5 y B8 (y en B2 en móvil); no al pasar de una Batalla a otra (B6 → B7 → B8) (la vista 3D de Batalla recibe una instantánea sin `enemigos`). La simulación sigue y la tarjeta funciona.
  - Reproducir: partida limpia → H0 → B1 con el programa de la guía → al ganar, leer la consola.
  - Agravante: `bucle.js` pide el siguiente `requestAnimationFrame` al final de `bucle()`, así que cualquier excepción dentro del fotograma **para el bucle para siempre**. Aquí no se nota porque «A la fábrica» recarga la página, pero cualquier error de dibujo o de inspector congela el juego (ver A2).
- **A2 · Elegir WHL-01 (la rueda) lanza en el inspector y congela el juego.** `__banco.seleccionar("WHL-01")` (o abrir su programa, que lo selecciona) lanza `Cannot read properties of undefined (reading 'frio')` en `paquetes/interfaz/maquinas.js:269`: la clase de la rueda cae en la rama de enemigos de `pintarInspector` y `ctx.TIPOS[e.tipo]` es `undefined`. En el fotograma siguiente `actualizarVivos` → `htmlMetricas` (`maquinas.js:157`) lanza `Cannot read properties of null (reading 'map')` dentro de `bucle()`, que ya no vuelve a pedir fotograma: el tiempo se queda en 0 y Ejecutar no avanza. Solo se sale recargando.
  - Alcance: también con MIN-01 (el minador) en `?ensayo=b8` y con WHL-01 en `?ensayo=b7`; VEH-01, LAU-01 y LAU-02 se eligen sin error.
  - Reproducir: llegar a B7 (o abrir `?ensayo=b7`) → elegir WHL-01 (pestaña de su programa, la unidad en el mapa o `__banco.seleccionar("WHL-01")`) → Ejecutar → el tiempo no pasa de 0.

### Media

- **M3 · Con la bodega real, B4 es imposible: llega con 0 misiles.** La bodega empieza en 48; B1 gasta 12 (→ 37), B2 gasta 20 (→ 18) y B3 gasta 24 (→ 0). H1–H3 no fabrican misiles. B4 necesita ~43 (la tarjeta de H3 dice «unos 36»; la guía, ~45). Con los programas de la guía, la campaña real no se puede ganar sin la consola. Información de balance: o la bodega inicial sube a ~100, o B1–B3 gastan menos, o algún hito previo repone misiles.
- **M1 · El borrado de la campaña desde la consola no funciona con la página abierta.** La guía (sección «Partida guardada») propone borrar las claves `campaign-v2*` en la consola y recargar. Con `index.html` abierto, al recargar el guardado en vivo vuelve a escribir las claves antes de salir y la partida reaparece (en esta prueba volvieron los programas de H6 de una sesión anterior). Funciona si se borra desde otra página del mismo origen (p. ej. `/`) o con el botón del menú de pruebas.
  - Reproducir: abrir `index.html` con una partida avanzada → consola: `Object.keys(localStorage).filter(k => k.startsWith("campaign-v2")).forEach(k => localStorage.removeItem(k))` → recargar → los programas siguen ahí.
- **M2 · `__banco.programas[id] = …` seguido de recarga pierde el programa.** La guía dice «Escribe un programa sin el editor (después recarga o vuelve a abrirlo)». Al recargar, el guardado de salida escribe el texto que hay en el editor y el programa asignado desaparece. «Volver a abrirlo» sí funciona (`__banco.abrirPrograma(id)` o tocar su pestaña).
  - Reproducir: en B2, `__banco.programas["LAU-01"] = "…"` → recargar → el editor y `__banco.programas["LAU-01"]` muestran el programa anterior.
- **M4 · Una máquina parada por falta de material luce verde.** En H2, PRS-01 sin proceso, sin acero en la entrada y con `tSinMaterial` creciendo (111 s) tenía `luz = "green"`; MLD-01 igual mientras esperaba polímero. El programa de luz de partida es `light(outputFull ? "amber" : "green")`: solo pone ámbar con la salida llena, no cuando la máquina espera material. Choca con la regla «ámbar = espera, verde = trabajando».
  - Reproducir: H2 con los programas de la guía → mirar PRS-01 cuando ARM-01 espera acero: verde.
- **M7 · Claves i18n crudas en las tarjetas de B6 en adelante.** Al cumplir H5: «Ahora la Batalla: cv2.b6.titulo.». Al ganar B6: «cv2.b6.titulo · superado» y «Siguiente batalla: cv2.b7.titulo.». Faltan `cv2.bN.titulo` para las Batallas propias en el catálogo (o se buscan con otra clave); el título de la página («Fuera de la muralla») sí sale.
  - Reproducir: cumplir H5 → leer la tarjeta; ganar B6 → leer la tarjeta.
- **M8 · El aviso de bodega de las tarjetas subestima el gasto de B6–B8.** Tarjeta de H5: «6 de unos 12 misiles», y B6 gastó 37 (con 6 se pierde). Tarjeta de B7: «0 de unos 2 misiles», y B8 gastó 50 (con 0 se pierde por 4 brechas). Parece que la estimación descuenta los cargadores o usa otra cuenta.
- **M5 · `__banco.partida.mundo.bodega.misiles = 60` «antes de Ejecutar» no sirve.** Ejecutar crea una partida nueva desde el checkpoint (`__banco.partida` cambia de objeto) y la bodega vuelve al valor guardado. Hay que asignarlo justo después de pulsar Ejecutar. La guía (sección de comandos y aviso de B4/B5) dice «antes de Ejecutar».
  - Reproducir: en B4, Reiniciar → `__banco.partida.mundo.bodega.misiles = 60` → Ejecutar → `__banco.partida.mundo.bodega.misiles` vale 0.
- **M6 · La pista de B4 culpa al programa cuando falta munición.** Con la bodega a 0 el cargador se vacía a los 23 s y se pierde, pero la tarjeta dice «Pista 1/3: El programa de partida espera a 0,35 para parar: es tarde.», aunque el programa ya era el bueno. No hay ninguna pista ni aviso sobre la bodega vacía al perder.

### Baja / observaciones

- **O1 · El selector de checkpoints ofrece todas las Batallas desde el principio.** En H0 el menú ⋯ → Checkpoint lista H0, B1…B8 y SALIDA (`etapasDisponibles` solo filtra los hitos de fábrica). Se puede saltar a B8 o al banco «SALIDA» sin haber jugado nada. Si es intencionado (Batallas siempre rejugables), conviene ocultar SALIDA en la campaña.
- **O2 · Recargar a mitad de una Batalla la reinicia a t = 0.** El programa se conserva; el intento no. Probablemente intencionado (la fábrica sí guarda en vivo), pero no se avisa.
- **O3 · HUD de H0 adelantado.** Al cumplir H0, la barra ya muestra la meta de H1 («ojiva en PAL-2 0/6») mientras el título sigue en «Llegada».
- **O4 · Contador de derribos con un fotograma de retraso.** Al ganar B1, el HUD decía «Derribados 5/6» mientras la tarjeta ya decía 6/6; un instante después el HUD pasó a 6/6.
- **O5 · El aviso de bodega justa sale en H3 pero no en H4.** La tarjeta de H3 avisa «la bodega va justa para esta batalla (0 de unos 36 misiles)»; la de H4, con 22 misiles para B5 (que necesita unos 45), no dice nada.
- **O6 · «Unidades · 1» en B5 con dos lanzadores.** El panel de programas dice «Unidades · 1» aunque LAU-01 y LAU-02 tienen programa propio (puede que cuente la selección; el rótulo confunde).
- **O7 · Los misiles que la fábrica hace durante una Batalla cuentan para el hito siguiente, pero se gastan en la Batalla.** Durante B5 la planta terminó 2 misiles (`producidos.missile` 4 → 6), que entraron en la bodega y se dispararon. H5 pide «8 misiles más» contando desde el final de H4, así que se cumplió fabricando solo 6 en H5, y la bodega quedó en 6, no en 8.
- **O8 · En móvil, el mando táctil tapa la tarjeta de error.** En B2 en móvil el joystick y los botones L/R quedan encima del mensaje «Error en el programa de LAU-01» y del botón «Ir a la línea» ([captura](movil-b2-error-c1.jpg)).
- **O9 · En móvil la barra de metas de la fábrica se corta.** Las píldoras de la parte de abajo («semiesfera en PAL-7 6/6 · placas refundidas 1/1 · ₵ 107…») se salen por la derecha; el tiempo `t` no se ve. No hay desplazamiento horizontal de página (`scrollWidth` = 375).
- **O10 · En móvil, el ▶ del editor a pantalla completa tapa el nombre de la segunda pestaña** («ARM…» en lugar de «ARM-01»).
- **O11 · El menú ⋯ no ofrece «Usar los programas del checkpoint».** La casilla `cv2-con-fuentes` está oculta en la campaña, así que «Volver al hito» siempre conserva los programas actuales (al volver a H1, ARM-01 traía el programa vacío de H6). La tarjeta de fallo de una Batalla sí ofrece esa opción.

## Móvil (375×812)

| Etapa | Cómo se llegó | Resultado | Notas |
|---|---|---|---|
| H1 | menú ⋯ → Checkpoint H1 → «Volver al hito» (recarga en H1, t 40,75, bodega 37) | cumplido a t 74,95, igual que en escritorio | ARM-01 escrito con el editor a pantalla completa (botón `</>`) y ejecutado con su ▶. Tarjeta legible ([captura](movil-h1-tarjeta.jpg)). |
| B2 | «A la batalla» desde la tarjeta | C1 igual que en escritorio; con el rodeo, victoria 13/13, 20 misiles, 34,65 s | El mando táctil aparece solo y tapa la tarjeta de error (O8). A1 al ganar. |
| H6 | menú ⋯ → Checkpoint H6 → «Volver al hito» | cumplido a t 721,75; «Misión 1 completada» | Ejecutar tocado en la barra inferior. Tarjeta final legible ([captura](movil-h6-mision-completada.jpg)). Barra de metas cortada (O9). |

Al terminar se volvió a la vista de escritorio. La partida queda guardada en H6 cumplido.

## Capturas

- [h6-mision-completada.jpg](h6-mision-completada.jpg): tarjeta final en escritorio.
- [movil-h1-tarjeta.jpg](movil-h1-tarjeta.jpg): tarjeta de H1 cumplido en móvil.
- [movil-b2-error-c1.jpg](movil-b2-error-c1.jpg): C1 en móvil (error falso de LAU-01 a los 2–3 s, con el mando encima).
- [movil-h6-mision-completada.jpg](movil-h6-mision-completada.jpg): tarjeta final en móvil.
