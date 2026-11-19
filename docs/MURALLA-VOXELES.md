# Muralla de vóxeles

Sistema de vóxeles **solo para la muralla**: el terreno sigue siendo el relieve de cada serie. Sirve para ampliar la muralla, ponerle capas y subirla construyendo paredes, y para que los golpes le abran huecos que luego se reparan. Estado al 19 de noviembre de 2026: **núcleo, adaptador 3D, laboratorio y pruebas en la rama `vfx-vehiculo-tubular`; ningún juego lo carga todavía**. El destino es Campaign (rama `campaign-nivel-1`), donde hoy la muralla son cajas instanciadas de 2 m.

| Archivo | Qué hace |
| --- | --- |
| `shared/muralla/voxeles.js` | Núcleo sin DOM ni dependencias: rejilla, ejes, paredes, obras, romper/reparar, consultas, guardado y malla. `window.CMGMuralla` (y `module.exports` en node). |
| `shared/muralla/vista-three.js` | Adaptador para Three r128: una malla por trozo, solo rehace los que cambian; el plano translúcido aparte. `window.CMGMurallaVista`. |
| `herramientas/muralla/` | Laboratorio con el trazado del nivel 1 de Campaign. Fuera del juego y del paquete de Netlify. |
| `pruebas/muralla-voxeles.cjs` | 58 comprobaciones de node. |

Abrir el laboratorio con el servidor del README: `http://localhost:8770/herramientas/muralla/` (`?tam=0.25` cambia el tamaño del vóxel).

## Conceptos

- **Rejilla.** Dispersa, en trozos de 16 × 16 × 16 vóxeles, con índices negativos. Un byte por vóxel: 0 vacío, 1–3 material. Vóxel de 0,5 m por omisión (configurable).
- **Eje.** Una polilínea guía con nombre, en metros del mapa (x este, y sur). La muralla del boceto es el eje `principal`.
- **Pared.** Una banda alrededor de un eje: `s0..s1` es la distancia lateral con signo, `z0..z1` la altura y `u0..u1` el tramo a lo largo del eje. `s` es positiva a la izquierda del avance; en el boceto, hacia el campo de batalla (el mismo criterio de «dentro» que `campaign-terreno.js`). Puede llevar almenas en un borde. Los extremos del eje son planos: la pared no se redondea más allá.
- **Capa.** Otra pared sobre el mismo eje con la banda contigua: `capa(eje, "fuera" | "dentro", grosor)` devuelve la banda y la altura actual. Las bandas son semiabiertas, así que dos capas contiguas no se solapan ni dejan hueco (lo comprueba la prueba).
- **Hilada.** Otra pared encima de todo el ancho: `hilada(eje, alto)`.
- **Ampliar.** `ampliar(eje, punto)` alarga el eje y planea el tramo nuevo de cada pared que llegaba al final; la unión queda cerrada.
- **Pared nueva.** Un eje propio (dos o más puntos) y una pared sobre él.
- **Obra.** Lo que falta de una pared, en orden de construcción: tramos de 2 m a lo largo del eje y, dentro de cada uno, de abajo arriba. `avanzar(n)` coloca los n siguientes de la primera obra de la cola; saltar un vóxel ya lleno no gasta. Lo pendiente está en otra rejilla, el **plano**, que la vista dibuja translúcido.
- **Romper.** `romper(x, y, z, radio, poder)`: cada vóxel recibe `poder · (1 − d/radio)` en su centro y cae si supera la resistencia de su material. Devuelve los vóxeles caídos con su material (para restos o VFX).
- **Reparar.** Volver a planear las paredes: solo entran los vóxeles vacíos, con el material de cada pared.

## Reglas que conserva

- **Determinismo.** Sin `Math.random` ni reloj; la prueba los sustituye por funciones que fallan. La variación de tono es un hash de la posición del vóxel. Misma secuencia de órdenes, mismo resultado y mismo guardado.
- **Paso fijo.** El núcleo no mide tiempo: quien lo use decide cuántos vóxeles coloca por paso. El ritmo del laboratorio (vóxeles por segundo con el reloj de la página) es solo del laboratorio.
- **Coordenadas.** El núcleo trabaja en metros del mapa; la malla sale en coordenadas de Three (X = x, Y = altura, Z = y), las de la vista 3D de Campaign.
- **Interacción.** El adaptador acepta `seleccionable: false` para quitar el raycast, como los demás adornos de Campaign. El plano nunca es seleccionable.

## API

```js
const M = CMGMuralla.crear({ tam: .5, origen: [0, 0, 0] });   // origen en metros del mapa (x, y, z)
M.eje("principal", MAPA.muralla);
M.construir({ eje: "principal", s0: -.75, s1: .75, z0: 0, z1: 3.5, material: "piedra", almenas: { alto: .5, paso: 1 } });
M.planear({ ...M.capa("principal", "fuera", 1), material: "hormigon" });   // obra; avanza con M.avanzar(n)
M.planear({ ...M.hilada("principal", 1), material: "acero" });
M.ampliar("principal", [40, 92.8]);
M.romper(x, y, z, 1.3, 1);  M.reparar();
M.altoEn(104.5, 47);        // cima de la muralla en ese punto (torretas), o null
M.huella();                 // columnas para el plano 2D: { x, y, lado, alto, material }
const datos = M.serializar(); const copia = CMGMuralla.cargar(datos);

const vista = CMGMurallaVista.crear(THREE, M, { seleccionable: false, paleta, colorPlano });
escena.add(vista.grupo);    // en cada fotograma: vista.actualizar()
```

Otras: `completar(obra)`, `cancelar(obra)`, `obrasResumen()`, `solido(x, y, z)`, `indice`, `centro`, `estadisticas()`, `largo(eje)`; en la vista, `verPlano(sí)`, `ponerPaleta(lista, colorPlano)` (por piel), `voxelDe(hit)` y `liberar()`.

**Guardado** (`formato: "cmg-muralla", v: 1`): ejes, paredes, obras con lo que les falta y los trozos en pares `[material, repeticiones]`. La muralla del boceto con dos capas, una hilada, una pared nueva y reparaciones ocupa unos 29 KB en JSON; con una capa de acero a medias, unos 42 KB, porque cada obra guarda la lista de lo que le falta.

## Medidas (esta nube, CPU)

| Vóxel | Muralla del boceto | Trozos | Caras | Malla completa |
| --- | --- | --- | --- | --- |
| 0,5 m | 4 589 vóxeles | 22 | 4 998 | ~20–30 ms (node y Chromium) |
| 0,25 m | 36 290 vóxeles | 50 | 19 840 | ~60 ms (Chromium) |

Al construir o romper solo se rehacen los trozos tocados: 1–3 ms por cambio a 0,5 m. Los fotogramas por segundo de SwiftShader no representan un teléfono; falta medir en los dispositivos reales.

## Plan para Campaign

Sin cambiar reglas de Campaign hasta que se decida (VISION-CAMPANA §7 deja pendientes costes, resistencia, construcción y reparación):

1. **Solo vista.** En `campaign-3d.js`, sustituir `muro` y `almenas` (InstancedMesh) por `CMGMurallaVista` con el eje `MAPA.muralla` y la misma banda de 1,5 m × 3,4 m. Para enterrar el cimiento, `origen` con z negativa o una pared de `z0 = −2`. La paleta sale de `conPiel` para las dos pieles. Las torretas leen `altoEn` en vez de `MURO.alto`. En el plano 2D, `huella()`.
2. **Estado del mundo.** La muralla entra en la simulación y en los checkpoints con `serializar()`/`cargar()`. Cada paso fijo decide cuántos vóxeles coloca según robots y material; los misiles enemigos llaman a `romper` y los restos salen de los vóxeles caídos.
3. **Programas.** Encargos para planear y construir paredes (capa, hilada, ampliar, reparar) y una lectura del estado de la muralla. Requiere diseñar la API y documentarla en el reglamento.

## Pendiente

- Costes, resistencias y ritmos de juego: los del laboratorio son provisionales.
- Derrumbe de lo que queda suelto tras un golpe (hoy un vóxel sin apoyo sigue en su sitio).
- Puertas y huecos planeados (pared con tramos vacíos), escaleras o rampas para subir unidades.
- Fusión de caras coplanares (greedy meshing) si el coste de GPU lo pide a 0,25 m.
- Medir en teléfono y en Safari. Revisión visual del usuario en el laboratorio.
