# Campaign-V2 · menú de pruebas

Entrada: `Prototypes/Campaign-V2/index.html?pruebas=1`, que redirige a `pruebas.html`. También se puede abrir `pruebas.html` directamente. Cada inciso abre la página con su caso ya montado. Los ensayos (`?ensayo=…`) no tocan el progreso de la campaña. El botón **Borrar el progreso de Campaign-V2**, al final del menú, borra solo las claves `campaign-v2*` de `localStorage`: progreso, programas, guardado en vivo y mando.

Las rutas son relativas a `Prototypes/Campaign-V2/` y funcionan igual en local y en raw.githack. Para acelerar una prueba, en la consola del navegador: `__banco.turbo(8)` (y `__banco.turbo(1)` para volver).

## Batallas del mapa nuevo

Cada Batalla, como ensayo suelto, con la UI nueva, la muralla y la torreta esfera.

| Inciso | Ruta | Qué mirar |
|---|---|---|
| B1 · Primer blanco | `index.html?ensayo=b1` | Seis orugas por un carril. Con el programa de abajo en LAU-01 no cruza ninguna. Arriba están los botones 3D / Plano / Batalla. |
| B2 · Prioridades | `index.html?ensayo=b2` | Primero orugas lentas, después drones a 2,5 m. |
| B3 · Niebla | `index.html?ensayo=b3` | La cámara ve 4,5 casillas y la térmica 7. Prueba `autoTarget(tipo, "thermal")`. |
| B4 · Enjambre | `index.html?ensayo=b4` | Dos enjambres de 18 drones: 1 disparo/s no basta. Prueba `burstFire(objetivo)` y vigila el atasco. |
| B5 · Dos lanzadores | `index.html?ensayo=b5` | Un enjambre por el norte y otro por el sur. Cada lanzador lleva su programa (pestañas LAU-01 y LAU-02). |
| B6 · Fuera de la muralla | `index.html?ensayo=b6` | Orugas y un enjambre de 20 drones. Las torretas solas dejan pasar orugas porque persiguen drones. VEH-01 sale por la puerta y caza drones lejos de la muralla. El tirador (x 227, y 84) lo desgasta si se acerca a 7 m. También gana repartir el trabajo: torretas con `autoTarget("crawler")` primero y el vehículo a por los drones. |
| B7 · La rueda | `index.html?ensayo=b7` | Cinco orugas blindadas (7 de vida) en fila por el carril de la puerta, más rápidas de lo que las torretas tumban. WHL-01 espera en el carril, estalla con una oruga a menos de 2 m y reaparece a los 12 s con su programa desde el principio. |
| B8 · Siembra | `index.html?ensayo=b8` | Una columna de ocho orugas llega a los 16 s. MIN-01 siembra sus cuatro cargas antes y vuelve tras la muralla. Cada carga que estalla escribe «¡Carga!» en la consola. Es la última Batalla: al ganarla en la campaña se pasa al taller de H6, y el cierre del nivel llega al cumplirlo. |

Ejemplo para B1 (LAU-01):

```js
while (true) {
  regularShoot(autoTarget("crawler", "visual"));
  await esperar(0.5);
}
```

Ejemplo para B2 (LAU-01): primero orugas y, si no hay, drones.

```js
while (true) {
  const objetivo = autoTarget("crawler", "visual") ?? autoTarget("drone", "visual");
  regularShoot(objetivo);
  await esperar(0.3);
}
```

## Mecánicas nuevas

Cada ensayo trae cargado su programa de ejemplo, en JavaScript y en Python: basta con pulsar **Ejecutar**.

### Salida · vehículo VEH y tirador — `index.html?ensayo=salida`

- VEH-01 sale por la puerta, llega a su puesto y dispara a los drones.
- Si el tirador lo destruye, el árbol lo muestra en gris con una cuenta atrás, y el vehículo reaparece.

### Rueda · WHL kamikaze — `index.html?ensayo=rueda`

- WHL-01 espera en el carril. Cuando hay una oruga a menos de 2 m, llama a `detonate()`.
- Desaparece y a los 6 s reaparece en casa; su programa vuelve a la primera línea. En la ficha la reaparición es de 12 s; este ensayo la baja a 6.
- La lectura `nearest` da los metros hasta la oruga más cercana, o `null` si no hay ninguna.

```js
moveTo({x: 224, y: 81.5});
await arrive();
while (nearest === null || nearest > 2) {
  await esperar(0.1);
}
detonate();
```

### Minador · cargas y onDetonation — `index.html?ensayo=minador`

- MIN-01 siembra cuatro cargas, que se ven como puntos sobre el carril, y vuelve tras la muralla.
- Cada carga que estalla escribe «¡Carga! N enemigos» en la consola.
- `charges` cuenta las cargas que le quedan. Con 0, `drop()` devuelve `"sin_cargas"`.

```js
onDetonation(carga => log("¡Carga!", carga.enemigos, "enemigos"));
for (const x of [222, 220, 218, 216]) {
  moveTo({x, y: 81.5});
  await arrive();
  drop();
}
moveTo({x: 205.5, y: 81.5});
```

## Cámara y móvil

| Inciso | Ruta | Qué mirar |
|---|---|---|
| Cámara en PC | `index.html?ensayo=b1` | La rueda del ratón aleja hasta 1,5 veces el encuadre inicial y acerca hacia el cursor. Al alejarte no se ven los bordes del mapa, porque las teselas de alrededor se cargan después. |
| Inclinación a ras del suelo | `index.html?ensayo=b1` (pulsa «3D») e `index.html` (fábrica) | El deslizador de la derecha baja la cámara hasta unos 17° (antes, 45°) y la sube hasta casi la vertical. También inclinan Mayúsculas + rueda, dos dedos que suben o bajan juntos en el teléfono y el arrastre con la rueda pulsada. Abajo se ven la muralla y los árboles, y la niebla tapa el borde del mapa. En el plano 2D el deslizador no aparece. |
| Mando táctil en PC | `index.html?ensayo=b1&mando=1` | El joystick, abajo a la izquierda, desplaza la cámara. La zona «Ratón», a la derecha, mueve el cursor. L selecciona; R da una orden puntual con el programa en marcha. Con L mantenido, arrastrar en la zona dibuja un recuadro de selección. |
| Mando oculto | `index.html?ensayo=b1&mando=0` | Fuerza el mando oculto, también en el teléfono. El botón 🕹 lo vuelve a mostrar. |

## Fábrica por hito

La fábrica se dibuja sobre el mapa papercraft, junto a la muralla, con el estilo de las máquinas de Campaign 1:

- prensa amarilla en H;
- moldeadora morada con cilindros;
- mezcladora verde con rotor;
- ensambladora turquesa con chevrones;
- brazos azules y montacargas rojo.

Cada inciso abre un hito con la planta tal como la deja la demo automática (`datos/plantas-demo.json`). Antes pide confirmación, porque **sustituye el progreso** de Campaign-V2.

| Inciso | Qué mirar |
|---|---|
| H1 · Prensa y ARM-01 | Prensa con su ariete; bandeja de entrada cian y de salida amarilla. |
| H2 · Moldeadora y ARM-02 | PAL-3 queda fuera del alcance de ARM-02: muévela con «Mover». |
| H3 · Mezcladora | El rotor gira mientras mezcla. |
| H4 · Ensambladora | Chevrones y franja de peligro. |
| H5 · La cadena entera | Todas las máquinas a la vez. |
| H6 · Carcasas (producción circular) | Los recortes bloquean la sierra si nadie los retira; tres refundidos dan una placa. La meta pide 6 semiesferas con 5 placas. |

Al elegir una unidad, la **minificha** aparece abajo a la izquierda, también en las Batallas. Muestra:

- el dibujo de la unidad (los SVG y sprites de Campaign 1);
- su id, estado y clase;
- dos propiedades con su valor en vivo;
- las órdenes clave, como tokens que se insertan en el editor con doble clic.

Al tocar la tarjeta fuera de un token se abre la ficha completa. Para regenerar las plantas tras cambiar la fábrica: `DEMO_PLANTAS=Prototypes/Campaign-V2/datos/plantas-demo.json node pruebas/campaign-v2-demo-fabrica.mjs`.

## Campaña y paridad

| Inciso | Ruta | Qué mirar |
|---|---|---|
| Campaña desde el principio | `index.html` | Empieza en H0 (la fábrica es un marcador provisional) y, al cumplirlo, pasa a B1. Para empezar de cero, usa «Borrar el progreso». |
| Paridad B1–B5 | `index.html?modo=paridad&batalla=b1` | Cada Batalla con los parámetros exactos de War. Para las demás, cambia `batalla=b2`…`b5` en la dirección. |

## Otros prototipos

| Inciso | Ruta |
|---|---|
| War | `../Rocket%20Launcher/index.html?serie=war` |
| Factory | `../Rocket%20Launcher/index.html?serie=factory` |
| Campaign (trunk, H0–H5) | `../Rocket%20Launcher/index.html?serie=campaign` |

## Pruebas automáticas

- `node pruebas/campaign-v2-rueda-minador.mjs` juega los ensayos de la rueda y del minador con sus programas de ejemplo. Rueda: estallidos, reaparición en casa y `nearest`. Minador: cuatro cargas, avisos `onDetonation` y vuelta tras la muralla. Cada estallido y cada carga anota una explosión `carga` (la receta `detonacion`).
- `node pruebas/campaign-v2-mando.mjs` prueba el mando táctil.
- `node pruebas/campaign-v2-minificha.mjs` prueba la minificha (rótulos, filas elegidas, dibujo por clase) el deslizador de inclinación y la puerta de la muralla en la vista de la fábrica.
- `node pruebas/campaign-v2-batallas-propias.mjs` juega B6–B8 con el intérprete: las torretas solas pierden y con la unidad nueva se gana; en la B6 también gana repartir el trabajo.
- `node pruebas/campaign-v2-i18n.mjs` revisa los textos de Campaign-V2: las mismas claves en español e inglés, ninguna vacía y los mismos `{parámetros}`; y que existe cada clave `cv2.…` escrita literalmente en el código.
