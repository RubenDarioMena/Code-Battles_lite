# Medida de carga de War

Ejecución manual del autor con Playwright y Electron instalados (`npm ci`). No
pertenece a `npm test` ni `test:navegador`. No necesita servidor para Electron.

```sh
node herramientas/medir-carga.mjs --segundos 10 --salida tmp/carga-electron
# Comparación: servidor de QA dedicado, en otra terminal:
python3 -m http.server 8771 --bind 127.0.0.1
node herramientas/medir-carga.mjs --origen http://127.0.0.1:8771 --segundos 10 --salida tmp/carga-chromium
```

Sin opciones: Electron, 10 s por caso, salida `tmp/medir-carga`. Son 16 casos:
alto/medio/bajo/no × 2D/3D × partida real/saturación, con recarga entre casos y
2 s extra de calentamiento cada uno (unos 3–4 minutos). `--help` no abre apps.
Electron usa `CBL_DATOS` temporal y Steam desactivado, igual que
`pruebas/escritorio.mjs`; el directorio se borra al cerrar, incluso por error.
Prueba `CBL_OCULTA=1` (la cáscara ya desactiva backgroundThrottling). Si rAF
queda limitado o el renderer inicial es software/no está disponible, muestra
la ventana y lo declara. Esto no garantiza aceleración: comprueba el renderer
final en el resumen. Chromium usa una ventana
visible y un contexto nuevo. No fuerza SwiftShader ni desactiva GPU.
Ambos solicitan 1280×720; la salida guarda tamaño efectivo, campo, canvas y DPR.
El movimiento reducido se fuerza desactivado para comparar niveles completos.

En los dos escenarios se juega el reto **1** (índice 0), semilla **7**, a 1×,
con `RETOS[1].inicial['LAU-01']`. Si termina durante una ventana larga, repite
el mismo reto/semilla/programa y cuenta los reinicios (incluye su coste).
En la partida real la ventana empieza con la primera explosión (en el reto 1
llega hacia los 17 s de juego), para no medir solo el despliegue.
En saturación se añaden **120 tríos/s real** (`--ritmo` lo cambia): disparo, derribo de dron y
explosión con golpe. Se emiten en rAF por `__banco.sucesosVistas(lista)`, la
misma ruta visual del conductor, a las dos colas aunque una vista esté oculta.
El derribo se posiciona por su explosión posterior del mismo paso y lanzador.
Las posiciones se distribuyen por el campo mediante una secuencia fija.
No se escribe en mundo, RNG, órdenes, referencias ni telemetría. El caudal es
idéntico para todos los niveles; se advierte si no alcanza el presupuesto.

`resumen.json` y `resumen.md` se actualizan tras cada caso (también quedan
resultados parciales si falla otro). Guardan frames e intervalos rAF: media,
p95/p99 (rango más próximo), >33 ms, vivas máximas, presupuesto alcanzado,
CPU de `particulas()` y `dibujar()` por separado y combinadas, errores y GPU
(`WEBGL_debug_renderer_info` si el controlador permite exponerlo).
El contador pasivo solo se activa por `__banco.medirEfectos(callback)`;
`null` lo apaga. No incluye render de escena, trabajo GPU ni la inyección en
CPU VFX; los intervalos rAF sí incluyen toda la carga y esperas de Workers.
La medida no es un temporizador de GPU ni una comparación de determinismo.

Para comparar, usa la misma ventana/DPR/GPU y evita otras cargas. Mira primero
`rendererReal`: SwiftShader/llvmpipe/Software no representa una GPU real.
Luego verifica saturación (alto debe llegar a 2000), errores, reinicios y
p95/p99/>33 ms. Compara CPU y partículas entre niveles y vistas. Una fila sin
presupuesto alcanzado no valida el peor caso; los resultados emulados de Node
solo comprueban el guion y no son medidas de rendimiento.

Verificación sin abrir aplicaciones: `node pruebas/medir-carga-node.mjs`,
`node herramientas/medir-carga.mjs --help`, tipos e identificadores libres/TDZ.
