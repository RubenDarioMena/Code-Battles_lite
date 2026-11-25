# Campaign-V2 · misión 1 «Primera fábrica» (25-nov-2026, implementada)

Fuente: idea del autor del 25-nov, más el consolidado del 23-nov, `VISION-CAMPANA.md` (3-nov, prueba 1 «abastecer un lanzador») y `CAMPAIGN-NIVEL-1.md` (17-nov). Ante choques manda lo más reciente. Los números y nombres siguen siendo provisionales: se ajustan jugando.

## La idea del autor

1. El **montacargas** acerca el material a las máquinas en tarimas.
2. Una **máquina lenta** necesita **dos piezas** distintas para sacar un producto.
3. Dos **máquinas con brazo** (estáticas) alimentan cada una a su **máquina rápida** con un material.
4. Las piezas terminadas caen en **tarimas que el jugador coloca donde quiera**.
5. El montacargas lleva esas tarimas a la **ensambladora**, que solo funciona **absorbiendo mucha energía de la base**.
6. Por decidir: si el jugador **diseña** la distribución (colocar tarimas y máquinas).

## Cadena implementada

La fábrica corre sobre el motor compartido `paquetes/fabrica` (extraído de `reglas-campaign`; cierra el ticket 04.3). Los datos están en `reglas-campaign-v2/fabrica/catalogo.js` y la planta en `niveles/nivel-1/fabrica.js`.

| Máquina | Tipo | Entra | Sale | Tiempo |
|---|---|---|---|---|
| PRS-01 · prensa | rápida, con brazo ARM-01 | acero | ojiva | 2 s |
| MLD-01 · moldeadora | rápida, con brazo ARM-02 | polímero | base con aletas | 2,5 s |
| MIX-01 · mezcladora | **lenta**, absorbe de sus tarimas (`zona: 2`) y deja la carga en una tarima de salida | acero + polímero | carga | 7 s |
| ASM-01 · ensambladora | **umbral de energía** (6 kW enteros o no arranca), absorbe de 3 tarimas | ojiva + base + carga | misil → DEP-01 (bodega) | 4 s |

| Pieza | Dónde |
|---|---|
| Montacargas con tarimas (`pickUp`/`deliver`) | motor compartido |
| **Brazo anclado** con `alcance` (2,8 m): fuera de él, `"fuera_de_alcance"` | motor, `alcance` en el obrero |
| **Tarimas, máquinas y brazos colocables** | orden `colocar` del jugador; botón «Mover» de la sesión de fábrica |
| **Ensambladora con umbral** | motor, `umbral` en la máquina |
| Energía de la base | una reserva (10 kW); en esta misión solo la consumen las máquinas |

## Hitos intercalados con las batallas

La bodega empieza con 48 misiles para B1–B4, porque el misil completo no sale hasta H4. Cada hito de fábrica es una sesión de la serie Campaign. Durante la Batalla siguiente la planta sigue trabajando sin programas.

| Hito | Meta | Unidades nuevas | Aprende |
|---|---|---|---|
| H0 Llegada | 12 de acero en PAL-1 | FRK-01 (programa ya escrito) | ejecutar, `await` |
| H1 Máquina rápida | 6 ojivas en PAL-2 | ARM-01, PRS-01 | bucle, esperar a que haya pieza |
| H2 Dos brazos | 6 bases en PAL-4 (PAL-3 queda fuera del alcance de ARM-02: hay que moverla) | ARM-02, MLD-01 | función reutilizable, colocar |
| H3 Máquina lenta | 4 cargas fabricadas | MIX-01 | sincronizar dos piezas |
| H4 Ensamblaje | 4 misiles fabricados | ASM-01 | coordinar, energía (parar máquinas para que arranque) |
| H5 | 8 misiles fabricados | — | la cadena entera sostenida |

## Decisiones del autor (25-nov)

1. **Energía:** es **de la base, compartida** con la defensa, pero de momento pesa menos que la arquitectura. Se modela desde ya como una sola reserva de la base; en esta misión solo la consumen las máquinas y las torretas de War no la leen todavía, así que la paridad sigue intacta.
2. **Máquina lenta:** **absorbe sola de la tarima pegada a su entrada.** El reto es que estén las dos piezas a la vez.
3. **Diseño libre:** **tarimas y máquinas se colocan libremente desde el principio** con el colocador (confirmar, girar, cancelar y fijar, como pidió el feedback del 17-nov).
4. Abierto: nombres de las piezas (semiesfera u ojiva, aletas, motor).

Consecuencia del punto 3: los programas no pueden depender de coordenadas fijas. Los lugares se nombran por su máquina o su tarima (`PRS_01`, `PAL_1`) y el brazo actúa sobre lo que quede **dentro de su alcance**; si el jugador aleja la tarima, el encargo devuelve `"fuera_de_alcance"`.

## Estado

- Jugable de H0 a H5 en `Prototypes/Campaign-V2/`. Las transiciones entre fábrica y Batalla recargan la página desde el checkpoint (`paquetes/app/juego/fabrica-v2.js`).
- Pruebas: `campaign-v2-fabrica.mjs` (misión completa con programas guionizados) y `campaign-v2-sesion-fabrica.mjs` (página, recargas, colocador, Checkpoint).
- Abierto: girar al colocar, la consola de energía de la base compartida con las torretas y equilibrar números jugando.
