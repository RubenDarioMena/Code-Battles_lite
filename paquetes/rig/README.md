# rig · solver cbl-rig v2

Paquete puro (no importa nada, ni Three) que mueve una máquina exportada con el kit de Blender usando solo sus
**controles**. Lee los `extras` del GLB y reproduce las reglas `LOCAL` y las restricciones de Blender. El contrato
del formato está en [el README del kit](../../arte/blender/kit/README.md#contrato-del-solucionador--cbl-rig-v2).

```js
import { leerRig, crearSolver } from '../rig/index.js';
const rig = leerRig(gltfJson);          // JSON glTF: nodos, hijos, TRS y extras (extras.rig es una cadena)
const s = crearSolver(rig, 0);          // nivel L0, L1 o L2
const { mundo, locales } = s.evaluar({ 'torreta.giro': .4 });
```

- `leerRig` devuelve, por nivel, los pivotes con su padre, la TRS del nodo, las reglas decodificadas, los
  controles y el orden topológico: el padre y los objetivos van antes que el dueño. Un `tipo`, un operador o una
  versión desconocidos lanzan un error. Las expresiones se compilan al leer.
- `evaluar(valores)` devuelve dos matrices 4×4 por columnas (`Float64Array(16)`) para cada pivote:
  - `mundo`, relativa a la raíz del nivel;
  - `locales`, que es `inversa(W_padre) · W`, lista para `Object3D.matrix`. Puede tener cizalla.
- Controles:
  - un control ausente toma su reposo;
  - `min` y `max` se aplican con `clamp`;
  - los cíclicos no se limitan.
- Los buffers se reutilizan, así que el resultado se sobrescribe en la llamada siguiente. Copia lo que quieras
  guardar.

El adaptador Three es `conectarRig(THREE, raiz, rig, nivel)` en `vista-3d`. Pone `matrixAutoUpdate = false` en los
pivotes y escribe sus matrices. Factory ya mueve el T1 con él.

## Restricciones

Todas trabajan en mundo y con la matriz completa. Leen el mundo final del objetivo y el resultado de la restricción
anterior del mismo dueño. Si la influencia está entre 0 y 1, se mezcla como `interp_m4_m4m4` de Blender (forma
polar). Referencia: [`constraint.cc` de Blender 5.2](https://github.com/blender/blender/blob/v5.2.0/source/blender/blenkernel/intern/constraint.cc).

| Tipo | Blender | Cómo se resuelve |
| --- | --- | --- |
| `COPIAR_POSICION` | Copy Location | Copia los ejes habilitados del origen del objetivo, con su signo, y suma la posición de entrada si hay `desplazamiento`. |
| `APUNTAR` | Damped Track | Gira por el arco más corto, conservando la traslación. A 180° usa el eje vecino como Blender. |
| `APUNTAR_BLOQUEADO` | Locked Track | Proyecta la dirección al objetivo sobre el plano del bloqueo y rehace la base conservando la longitud de cada columna. |
| `ESTIRAR` | Stretch To | Primero quita la cizalla, como `orthogonalize_m4_stable` con el eje longitudinal fijo. Después apunta el eje `[0,0,-1]` y escala por distancia / (longitud de reposo × escala entrante); los transversales se escalan por ese factor elevado a −`abultamiento`, según el `volumen`. `eje_fijo` Z conserva el plano del antiguo +Y. |

## Pruebas y tolerancia

`node paquetes/rig/pruebas/rig.mjs` lee los GLB sin Three y compara con las poses que exportó Blender
(`pruebas/rig/*-poses.json`). La tolerancia es 1e−4 absoluta en los 16 elementos.

| Comprobación | Resultado |
| --- | --- |
| Vehículo tubular, 57 muestras × L0/L1/L2 | error máximo **1,3e−6** (`trapecio_inf_dd`, muestra 56) |
| Torreta de observación, 21 muestras × L0/L1/L2 | error máximo **2,3e−7** (`hoja_d`, muestra 10) |
| Reposo de las tres máquinas | local = TRS del nodo con error ≤ 1e−5 |
| Factory T1 frente al antiguo `rotation.*`, 200 poses × 3 niveles | 6,5e−8 |
| Adaptador Three r180 frente al solver puro | ≤ 2e−15 |
| Mediana de `evaluar` del vehículo L0 (181 pivotes), 2 500 llamadas | ≈ 0,04 ms en Node |

Mutaciones que la prueba detecta:
- invertir el eje de una `APUNTAR`;
- cambiar el volumen de una `ESTIRAR`;
- evaluar un dueño antes que su objetivo;
- quitar el desplazamiento de una `COPIAR_POSICION`.

También comprueba `APUNTAR_BLOQUEADO` y la mezcla a media influencia con casos sintéticos, porque los GLB actuales
no los usan.
