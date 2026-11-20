# Tarea 05 · Correcciones tras revisar en WebGL la granada, el chorro y el tanque

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Las tareas 03 y 04 están en el árbol de trabajo, sin commit:
no las deshagas. Toca solo:
- `paquetes/destruccion/`;
- `herramientas/laboratorio-destruccion/` (salvo `prompts/`);
- `docs/DESTRUCCION-PIEZAS.md`.

No hagas commits. Deben seguir pasando:
- `node paquetes/destruccion/pruebas/destruccion.mjs`;
- `node pruebas/fronteras.mjs`;
- `npm run tipos`.

**Ya corregido por el orquestador, no lo deshagas.** En `superficie.js`, `materialVivo` da una celda por quitada
solo si tuvo material (canal g) y ya no lo tiene (canal r). Antes, en un cilindro dañado, las celdas de fuera de la
forma pintaban franjas oscuras a lo largo del eje.

El orquestador revisó las demos. El puente, la cavidad y el abanico del chorro caótico están bien. Corrige esto:

## 1. La salpicadura de la granada se lee como un solo círculo
En `?demo=granada&t=3.3`, el torso del Andador muestra **un único disco verde grande**, casi del ancho de la cara.
Se pidió que se leyera como **varias manchas** repartidas.
- **El ácido principal** debe ser claramente más pequeño. Su radio final debe quedar alrededor de la mitad del
  actual.
- **Los satélites** deben caer **separados** del principal y entre sí, a unos 8–25 cm sobre la superficie.
  - Que salgan del punto de impacto, se desplacen por el plano tangente y después busquen la superficie con su rayo
    corto.
  - Que no queden casi todos dentro del disco principal.
- Cada satélite es más pequeño que el principal, con tamaños variados por hash.
- Una parte de los satélites puede pasar a caras vecinas o a otras piezas del mismo robot, como la cabeza o el
  chasis.
- **Prueba:** en el guion `granada`, al menos 5 manchas de ácido, en al menos 2 piezas del Andador, y la distancia
  media de los satélites al principal es de al menos 10 cm.

## 2. El chorro directo parece una fila de rayas, no un chorro
En `?demo=chorro&t=0.9`, las gotas se ven como óvalos planos y grandes, separados unos 25 cm. Se lee como una línea
de puntos, no como un chorro de ácido a presión.
- **A presión plena**, dibuja el chorro como un **cuerpo continuo**: un tubo o una cinta afilada que une las gotas
  consecutivas del mismo emisor, de unos 1,5–2,5 cm de grosor, verde y translúcido, con brillo y un ondular suave.
- **Al caer la presión**, la continuidad se rompe:
  - el chorro se parte en tramos y gotas sueltas;
  - el final se ve corto y deshecho.
- **El chorro caótico** se ve como gotas y tramos cortos, en abanico. Su aspecto actual de manchas ya funciona;
  mantenlo.
- Las gotas sueltas, más pequeñas: unos 2–3 cm, alargadas según su velocidad solo en el aire.
- **Encuadre:** en `chorro` y `chorro-caotico`, la cámara debe enseñar el emisor y el blanco a la vez, con el chorro
  cruzando la imagen. Ahora el emisor queda fuera de la imagen.
- Todo esto es solo de la vista. El núcleo no cambia, y las pruebas del chorro siguen igual.

## 3. El tanque flota 6 cm
`casco` está en z = 0,24 con 0,36 m de alto, así que su base queda en z = 0,06. Al caer el robot, todo baja 6 cm.
- Apoya el tanque en el suelo: baja 6 cm el casco, los interiores, la torreta y el cañón.
- Si prefieres, ponle orugas como piezas, pero que la base apoye en z = 0.
- Recalibra el guion `tanque` si hace falta: el corte debe partir el casco en dos y dejar ver los tres interiores.
- Actualiza las cifras de la documentación.

## 4. Comprueba
- Las capturas fijas que ya documentas siguen siendo válidas, con sus tiempos.
- Añade la del chorro directo a presión plena, con el chorro continuo en pantalla.

## Respuesta final
Breve:
- qué cambiaste;
- las pruebas nuevas y su resultado;
- qué debe mirar el orquestador.
