# destruccion

Simulación aislada de rotura y recuperación de piezas. La entrada pública es
`index.js`. Funciona en Node y en el navegador y tiene cero dependencias.
El laboratorio consume el mismo contrato que usaría una vista de juego.

```js
import { crearMundo, definirRobot, cargar } from './index.js';

const muestra = definirRobot({ id: 'Banco', piezas: [{
  id: 'cuerpo', forma: { tipo: 'caja', medidas: [.48, .32, .40] },
  pos: [0, 0, .20], rot: [0, 0, 0, 1], padre: null, union: { resistencia: 6 },
  materiales: [{ material: 'acero', cantidad: 4 }], funcion: 'sensor',
  zonaFuncion: { tipo: 'esfera', pos: [0, -.08, 0], radio: .05 },
  aguante: 1, color: '#E7DFCE',
}] });
const mundo = crearMundo({ semilla: 7 });
mundo.agregarRobot(muestra, { pos: [0, 0, 0], rumbo: 0 });
const informe = mundo.disparar({ arma: 'laser', origen: [0, -1, .20], direccion: [0, 1, 0] });
mundo.avanzar(.5);
const copia = cargar(mundo.serializar());
copia.terminarBatalla();
```

## Definiciones y órdenes

- `definirRobot` valida y congela una copia del árbol. Se admite cualquier orden de las piezas, una sola raíz y materiales con nombres únicos y cantidades positivas. `MATERIALES` enumera los materiales de muestra. El tamaño máximo de una rejilla es de 262 144 celdas.
- `forma.tipo` acepta `caja`, `cilindro` o `esfera`. Las medidas y alturas son completas, los radios son radios. `eje` es `x`, `y` o `z`. La posición y la rotación de cada pieza son locales **al robot**. La forma funcional tiene su centro `pos` **en la pieza** y sus mismos ejes. Una zona funcional debe contener al menos un centro vivo.
- `agregarRobot` devuelve la identidad de la instancia. Al repetir una definición, añade `#2`, `#3`… `rumbo` gira en radianes desde +x hacia +y. Las poses usan metros, altura z y cuaterniones [x, y, z, w].
- `raycast({origen,direccion})` devuelve el índice de la primera celda ocupada que cruza, la distancia y el punto de **entrada a la celda**. Devuelve `null` en un fallo. La dirección se normaliza. Los restos en retirada u ocultos dejan de ser blancos.
- `disparar` admite potencia positiva (por defecto 1). Devuelve impacto, identificadores `uid` afectados, celdas y cantidad perdida por material, uniones rotas, módulos perdidos y sucesos de la orden. En una mezcla homogénea, cada celda perdida cuenta para cada material presente. El informe del ácido cubre el contacto inicial. Su evolución posterior se lee en las instantáneas y los sucesos.
- `avanzar` acumula el resto en unidades enteras de 1/3 600 000 000 de paso (4,63 ps). Cada tick completo aplica la corrosión y después integra los conjuntos rígidos. `desaparicion('hundiendose'|'desvaneciendose')` cambia la presentación de la retirada.
- `terminarBatalla` completa los vuelos y las corrosiones pendientes mediante ticks ordinarios, expone los restos y congela el reloj. Puede llamarse varias veces. Solo generan botín las piezas sueltas o de robots caídos.

## Lecturas y guardado

`estado()` entrega tiempo, robots, piezas y restos registrados. En el orden original de la definición, `robots[].piezas` contiene el `uid` de cada pieza original sobreviviente o `null` si se consumió. `padre` en la instantánea referencia el `uid` al que la pieza sigue unida. Un fragmento conserva el `id` de origen y tiene un número de fragmento positivo. Las salidas, poses, materiales, zona, máscara y volúmenes están tipados en [index.d.ts](index.d.ts).

La máscara RLE alterna **valor, longitud**. Los valores son 0 (vacío), 1 (vivo) y 2 (vivo fundido). Se expande con x como eje rápido, luego y y z. El centro del índice tridimensional `i` es `(i + 0.5 − dim/2) × celda` en cada eje. `version` permite reutilizar una textura mientras cambia la pose. Los volúmenes de daño están en coordenadas locales. Formas, definiciones y RLE pueden compartirse como datos de solo lectura.

`sucesos()` devuelve una copia del historial en orden de emisión. `botin()` entrega materiales **recuperables** por resto y totales por material y módulo. La etiqueta usa siempre las cantidades **presentes**. `estado().restos` conserva el registro previo al rendimiento.

`serializar()` devuelve texto JSON con `formato: "cbl-destruccion", v: 1`. Guarda definiciones, máscaras, uniones, velocidades, corrosión, acumulador, números de disparo y fragmento, reposos e historial. `mundo.cargar(texto)` reemplaza el estado, y `cargar(texto)` crea otro mundo. El formato está destinado a partidas producidas por esta versión.

## Verificación

`node paquetes/destruccion/pruebas/destruccion.mjs` comprueba geometría, daño, vuelo, restos, economía y continuación byte a byte. Imprime además la mediana de paso y raycast. Forma parte de `npm test`.

[Modelo y constantes](../../docs/DESTRUCCION-PIEZAS.md) · [Laboratorio](../../herramientas/laboratorio-destruccion/index.html)
