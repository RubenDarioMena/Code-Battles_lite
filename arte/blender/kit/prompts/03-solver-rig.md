# Tarea 03 · Solver del rig en el juego (cbl-rig v2)

Eres el ejecutor de un pipeline. Haz SOLO esta tarea. Las tareas 01 y 02 (kit, exportador y validador) están hechas
en el árbol de trabajo, sin commit: no las deshagas. No hagas commits.

## Objetivo
El juego lee los `extras` del rig de un GLB y mueve la máquina solo con sus **controles**. Debe reproducir las
restricciones de Blender: apuntar (APUNTAR), suspensión (COPIAR_POSICION + ESTIRAR) y torreta (LOCAL con giros).
La prueba es objetiva: las matrices del solver contra las poses que exportó Blender.

## Fuentes de verdad (léelas antes de escribir código)
- Contrato: `arte/blender/kit/README.md`, sección «Contrato del solucionador · cbl-rig v2».
  - Las reglas `LOCAL`, el orden topológico y las cuatro restricciones.
  - Las expresiones: el AST `[op, ...args]`.
  - La comparación `inversa(W_raíz_en_reposo) · W_pivote`.
  - Los enlaces a `constraint.cc` de Blender 5.2: síguelos para Damped Track, Locked Track, Stretch To y la mezcla
    por influencia.
- Implementación Python de referencia:
  - `arte/blender/kit/rig.py` y `expresiones.py`: `evaluar_local`, `evaluar`;
  - `validar_rig.py`: forma y reglas válidas.
- GLB (ya validados):
  - `Prototypes/Rocket Launcher/modelos/vehiculo_tubular.glb`: 181 pivotes por nivel, 18 controles, con
    COPIAR_POSICION 56, APUNTAR 40, LOCAL 33 y ESTIRAR 28;
  - `torreta_observacion.glb`: 9 pivotes, 4 controles y un `bucle` de claves en la raíz;
  - `t1.glb`: 9 pivotes y 5 controles.
- Poses de referencia exportadas desde Blender:
  - `pruebas/rig/VehiculoTubular-poses.json`: 57 muestras;
  - `pruebas/rig/TorretaObservacion-poses.json`: 21 muestras.
  - Cada muestra trae `controles` y `mundo`. `mundo` es nombre corto → 16 números **por columnas**, en el marco de
    la raíz en reposo.
- Detalles:
  - `extras.rig` es una **cadena** JSON, no un objeto.
  - Los nombres de nodo llevan el prefijo `L<n>_`; las referencias del rig usan el nombre corto, dentro del mismo
    nivel.

## Qué construir
1. **Paquete puro `paquetes/rig/`**, sin dependencias: no importa nada, ni siquiera Three.
   - Debe tener manifiesto, README de contrato, `index.js`, `index.d.ts` y `pruebas/rig.mjs`, como los demás
     paquetes (mira `paquetes/destruccion/` o `paquetes/vfx/`).
   - Las matrices son 4×4 por columnas en `Float64Array(16)`.
   - `leerRig(gltfJson)`: a partir del JSON glTF (nodos, hijos, TRS, `extras`), entrega por nivel:
     - los pivotes con su padre;
     - la TRS del nodo;
     - las reglas ya decodificadas;
     - los controles con su reposo y sus límites;
     - el orden topológico (padre y objetivos antes que el dueño).
     Rechaza con error claro cualquier `tipo`, operador o versión desconocidos.
   - `crearSolver(rig, nivel)`: devuelve `{ controles, evaluar(valores) }`.
     - `evaluar` devuelve las matrices de mundo de cada pivote (relativas a la raíz del nivel) y las locales
       `inversa(W_padre) · W` listas para escribir en un nodo.
     - Un control ausente toma su reposo.
     - Los límites `min`/`max` se respetan con `clamp`; los cíclicos no se limitan.
     - Sin asignaciones por llamada en el camino caliente: reutiliza buffers.
   - Las restricciones trabajan en mundo con matrices completas. No descompongas en TRS salvo donde Blender lo hace
     (por ejemplo, la mezcla por influencia < 1). Puede haber cizalla: el resultado se escribe como matriz.
2. **Adaptador Three en `paquetes/vista-3d/`** (`rig.js`, exportado desde su `index.js`):
   - `conectarRig(THREE, raizObject3D, rig, nivel)`: devuelve `{ controles, aplicar(valores) }`;
   - pone `matrixAutoUpdate = false` en los pivotes del rig;
   - escribe `node.matrix` desde las locales del solver y marca el mundo para actualizar.
   - Añade `rig` a `vista-3d` en la tabla de dependencias de `paquetes/README.md` y en `pruebas/fronteras.mjs`, con
     `rig` sin dependencias.
3. **Factory usa el solver para el T1.**
   - Hoy `paquetes/vista-3d/factory.js` escribe `rotation.y/x/z` de `torreta`, `hombro`, `codo`, `muneca`, `dedo_i` y
     `dedo_d` a mano.
   - Sustitúyelo por los controles `torreta.giro`, `hombro.giro`, `codo.giro`, `muneca.giro` y `pinza.apertura`.
     Las reglas del GLB ya coinciden en eje y signo con lo de hoy; compruébalo con la prueba de abajo, no lo des
     por hecho.
   - La conducta visible no debe cambiar.
4. **Visor `herramientas/visor-rig/`** (`index.html` y módulos), Three r180 del vendor, como el laboratorio de
   destrucción:
   - selector de máquina (las tres) y de nivel L0/L1/L2;
   - un deslizador por control, con rango de `min`/`max`; los cíclicos de −2π a 2π;
   - botón «reproducir bucle» si la raíz trae `bucle`, con interpolación lineal entre claves y los fps del bucle;
   - selector «muestra de referencia» (vehículo y torreta):
     - pone esos controles;
     - muestra el error máximo por pivote y el peor pivote;
     - dibuja ejes pequeños en los pivotes de la referencia, para ver si coinciden;
   - `?maquina=…&nivel=…&muestra=…&captura` deja una vista fija, apta para captura sin interfaz.

## Pruebas (deben fallar si la matemática está mal)
`paquetes/rig/pruebas/rig.mjs`, registrada en `pruebas/todas.mjs` y en `tsconfig.json`, como los demás paquetes:
- Lee los GLB directamente: cabecera, chunk JSON y extras. Sin Three ni GPU.
- **Reposo:** para las tres máquinas y los tres niveles, con todos los controles en reposo:
  - cada local es igual a la TRS del nodo, con error ≤ 1e−5;
  - la cadena de mundo es coherente.
- **Poses de Blender:** cada muestra de vehículo y torreta, en L0, L1 y L2.
  - Compara `inversa(W_raíz_reposo) · W_pivote` con la referencia, en los 16 elementos.
  - **Tolerancia 1e−4 absoluta.** Imprime el error máximo observado, el pivote y la muestra.
  - Apunta a 1e−5. Si algo pasa de 1e−4, no subas la tolerancia: busca la causa (orden, convención de ejes, Stretch
    To de Blender…).
- **Mutaciones:** cada una debe hacer fallar la comparación. Demuestra que la prueba sí ve los errores.
  - invertir el `eje` de una APUNTAR;
  - cambiar `volumen` de una ESTIRAR;
  - quitar `desplazamiento` de una COPIAR_POSICION;
  - romper el orden topológico (evaluar un dueño antes que su objetivo).
- **Controles:**
  - clamp en `min`/`max`;
  - un control ausente toma el reposo;
  - un cíclico en 2π + x da lo mismo que en x.
- **Equivalencia Factory:** con 200 poses pseudoaleatorias deterministas, las matrices del T1 con el adaptador nuevo
  y con el código anterior de `rotation.*` coinciden (≤ 1e−6). Copia el código anterior en la prueba como oráculo.
- **Adaptador Three:** con el `GLTFLoader` de r180 en Node (mira cómo lo carga `pruebas/three-r180.mjs`), el
  `matrixWorld` relativo a la raíz tras `aplicar` es igual a la salida del solver puro (≤ 1e−6).
- **Coste:** mide la mediana de `evaluar` del vehículo L0 (181 pivotes), al menos 2 000 llamadas. Imprímela.
  Objetivo < 0,3 ms en Node.

## Debe seguir pasando
- `npm test`;
- `npm run tipos`;
- `node pruebas/fronteras.mjs`;
- `python3 arte/blender/kit/pruebas.py`;
- `python3 arte/blender/kit/pruebas_exportar.py`.

Si te falta `node_modules`, avísalo en la respuesta: no instales dependencias.

## Documentación
- `paquetes/rig/README.md`:
  - el contrato del paquete;
  - cómo resuelve cada restricción, con enlace al código de Blender que sigue;
  - la tolerancia y el error observado.
- Una línea en `arte/blender/kit/README.md` que enlace al paquete.

## Respuesta final
Breve y en lenguaje claro:
- qué archivos creaste o cambiaste;
- el **error máximo observado** por máquina, y en qué pivote y muestra;
- el coste medido;
- qué mutaciones falla la prueba;
- lo que no pudiste comprobar, y qué debe mirar el orquestador en el visor.
