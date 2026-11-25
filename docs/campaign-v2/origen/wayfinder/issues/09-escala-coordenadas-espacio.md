# Escala, coordenadas y espacio del mundo

Type: grilling
Label: wayfinder:grilling
Status: resolved
Blocked by: 03, 04

## Question

Hay tres escalas en juego:

- War usa una cuadrícula de 32 × 18 con la muralla en x = 3 y los bastiones hasta x = 6;
- el laboratorio usa 48 × 27 con el muro en x = 7;
- el mapa papercraft mide 400 × 208 m.

¿Qué sistema de coordenadas usa el mundo de Campaign-V2? ¿Dónde está la fábrica respecto a la muralla? ¿Cuánto campo hay al otro lado para unidades que salen (VEH, WHL)? ¿Cómo se traduce casilla ↔ metro para las vistas sin romper la paridad de las Batallas 1–5?

## Contexto añadido (tras el ticket 04)

- La colocación en el bastión cambia la posición del lanzador en la definición de cada Batalla, solo en modo campaña.
- `reglas-campaign/nivel.js` (trunk) ya define un mundo continuo de 200 × 104 m (1 casilla = 1 m), con la fábrica al oeste, la muralla en x ≈ 104 y el campo al este. Es un candidato a sistema de coordenadas.
- El ticket 03 encontró que la escala de la muralla Traba no coincide con el motor de vóxeles.

## Grill

[grill/ticket-09.html](../grill/ticket-09.html) · 6 preguntas (marco del mundo, marco de batalla, campo activo, arte frente a simulación, fábrica, dónde se traduce). Datos nuevos: `mapa-ampliado.json` trae `antiguo.origen = [103, 22]`, muralla recta en x = 207 (y 44–90) y losa en (93, 72); War lee `def.mapa.cols`.

## Answer

Resuelto el 24-nov-2026 con el grill en HTML. Las seis preguntas se respondieron con la opción A.

1. **Marco del mundo:** los metros del mapa papercraft (`mapa-ampliado.json`, 400 × 208 m, x hacia el este, y hacia el sur, 1 unidad = 1 m). Los datos de fábrica de Campaign se trasladan una vez sumando (103, 22), que es `antiguo.origen`.
2. **Marco de batalla:** solo un desplazamiento, sin escala; 1 casilla = 1 m.
   - Cada nivel lo declara en `nivel.js`: `marco: { origen: [204, 72] }`, de modo que la línea de brechas local x = 3 cae en la muralla x = 207 y el «Paso del este» (y = 81) queda en el centro.
   - War sigue en sus casillas, intacto. Los valores del laboratorio en casillas pasan tal cual a metros.
   - Si hay batallas en el frente sur, se añade un giro al marco; es un campo más, no un cambio de forma.
3. **Campo activo:** el propio marco de batalla. Las unidades V2 (VEH, WHL…) no salen del rectángulo donde existen los enemigos de War. Una Batalla que necesite más campo se copia (ticket 08) y amplía `mapa.cols`. Las filas las fija hoy la app, y hacerlas configurables queda para la implementación.
4. **Arte frente a simulación:** manda la simulación. Las posiciones de las reglas no se mueven por el arte. Cada modelo lleva en `modelos.js` su escala, su desplazamiento y su punto de anclaje. Traba se escala ≈ 0,54: el nudo queda con 3 m de fondo (de x = 3 a x = 6) y ≈ 8,6 m de alto. El anclaje del bastión se define en esos datos, porque los GLB no lo traen.
5. **Fábrica:** pegada a la muralla, como en Campaign: la instalación trasladada (103, 22) ocupa x ≈ 174–207. La losa del papercraft se mueve a ese sitio en `mapa-ampliado.json`.
   - **Pendiente de verificar en la implementación:** si la losa está horneada en `terreno-F-C.glb`. En ese caso hay que regenerar los trozos con `mapa.py`, porque es un cambio de arte.
   - Si resulta caro, la salida aceptada es poner la instalación sobre la losa actual (opción B) sin tocar ninguna regla.
6. **Traducción:** solo en `reglas-campaign-v2`.
   - Al leer enemigos de War los convierte a metros, y al aplicar daño en área lo pasa a casillas.
   - La escena llega a las vistas ya en metros.
   - El colocador y los clics (orden puntual, clic programado) entregan metros, y V2 los traduce.
   - Las vistas y las mecánicas nuevas no conocen el marco.

**Consecuencias:**
- `vista-3d/war.js` dibuja hoy en casillas; la vista de Campaign-V2 dibujará en metros.
- En modo paridad se usa el mismo marco, así que se ve igual.
- El encuadre del corte del mapa (en Not yet specified) ya tiene escala y posición: la batalla ocupa x 204–236, y 72–90.
