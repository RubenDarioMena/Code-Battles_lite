# Partida con unidades programadas · fase 5, paso 4b

Banco manual de rendimiento, separado de los retos. Sin dependencias nuevas.
`node pruebas/medir-unidades-node.mjs` lo comprueba sin lanzar aplicaciones.

```sh
# Node: 6 celdas, 2 ejecuciones independientes/celda, verifica las dos huellas.
node herramientas/medir-unidades.mjs --salida tmp/unidades-node
# Página real, Electron visible (desde el checkout; no el paquete distribuido).
node herramientas/medir-unidades.mjs --modo juego --unidades 500 --segundos 60 --salida tmp/unidades-electron
# Chromium visible: servidor dedicado, perfil/almacenamiento aislados.
python3 -m http.server 8771 --bind 127.0.0.1
# En otra terminal:
node herramientas/medir-unidades.mjs --modo juego --origen http://127.0.0.1:8771 --unidades 500 --segundos 60 --salida tmp/unidades-chromium
```

Por defecto mide War y Campaign, 50/200/500, semilla 7, y ambas vistas en juego.
`--series war` / `--vistas 3d` acotan casos. `--pasos 1200` son pasos **medidos**;
Node ejecuta antes `--calentamiento 40` (2 s de juego). Navegador mide desde el
primer fotograma tras arrancar los programas, sin calentamiento excluido ni
reinicios; 60 s reales por caso. La carga y compilación inicial quedan en
`arranqueMs`; el coste excluye la navegación/carga de recursos y reconstruir la
vista. Node incluye además crear el escenario, mundo y dependencias del arnés.
`--help` y opciones inválidas no importan siquiera el lanzador Playwright.

## Escenarios y límites

- **War:** 500 lanzadores `LAU-001..500`, 500 casillas distintas de las 504
  disponibles en x=3..30, y=0..17, mapa original 32×18. Parte de un reto
  normalizado y reemplaza la lista **solo aquí**, sin volver a pasarla por el
  recorte a dos. Conserva cargador, suministro, sensores y reparador originales.
  Doce oleadas de 40 enemigos, cada 12 s, nacimientos cada 0,3 s, HP=9,
  velocidad=0,8, seis carriles y tres tipos. La definición del banco admite hasta 999
  brechas (más que los 480 enemigos) para completar la ventana. Cada programa prioriza
  drone/crawler/stealth con autoTarget, regularShoot y esperas de 0,1..0,5 s;
  fase inicial de 0,05..0,5 s. La partida termina por las reglas normales si
  se agotan las oleadas; una ventana excesiva falla en vez de reiniciarla.
- **Campaign:** instalación y mapa originales, H0 abierto, 500 obreros adicionales
  `BOT-101..600`, 50 columnas × 10 filas dentro del pasillo. Los nueve programas
  originales se sustituyen por estos 500. Veinte lugares de llegada compartidos
  (dos por fila); cada obrero alterna goTo mediante Promise.all con wait de
  0,1..0,5 s, con fase inicial. El movimiento y la resolución de encargos son
  reales; no transporta material ni cumple H0. Las reglas actuales no imponen
  colisiones, separación mínima ni límite de robots. No demuestra una fábrica
  de 500 máquinas produciendo ni logística con colisiones.
- **Factory:** máximo actual **un programa, R1**. No admite 500 sin cambiar el
  modelo de reglas/anfitrión, así que no se inventa una carga de 500 clones.

Mismos datos y fuentes en Node y página, mediante `crearPartida` y conductor del
juego y las unidades reales del intérprete. Node utiliza el instrumentador del
arnés; navegador usa `ejecutar` y el instrumentador/pulsos del juego.

## Relojes y salida

`resumen.json` tiene versión, equipo/CPU/OS/Node, opciones, semilla, muestras
completas y estadísticas de rango más próximo (media/p50/p95/p99/máximo, ms).
Node crea un proceso independiente con GC previo por celda y repetición; muestra
la **primera** repetición, conserva todas y exige huella idéntica de las fotos
por paso y de todas las órdenes. Hash/serialización de evidencia están fuera del
reloj del paso; no se resta ningún GC que ocurra dentro de la medida.

- `simulacion`: llamada real a partida.paso, **incluida** la creación/copia de
  respuestas que haga el reglamento; `instantanea`: suma de ambas fotos por paso.
- `ceder` y `responder`: llamadas completas al anfitrión con sus continuaciones.
- `total`: desde entrar en paso hasta finalizar su turno, o entrar al siguiente
  paso del lote. Incluye órdenes, sucesos y callbacks del conductor, además de
  esas cuatro columnas. No incluye ocio entre llamadas, hash, dibujo, HUD ni el
  recogerRegistro posterior de app. No hay que sumar percentiles entre sí.
- Node: RSS base/final/máximo muestreado tras cada paso (bytes). No es el pico
  instantáneo del asignador. El proceso conserva registros y órdenes, como el
  juego; no se borra historial para mejorar el resultado.
- Juego: intervalos del **bucle real**, >33 ms, pasos/s real, deriva firmada
  `pasos*0.05-real`, fotogramas con delta >0,25 s y ms no acumulados por programas
  corriendo. Coste por paso medido dentro de la página. Último lote esperado
  antes de cerrar la ventana; no se fuerza recuperación, no se cambia el bucle.
  `cumple` exige |deriva|≤0,05 s, cero recortes, p95 total<16,7 ms, ventana
  completa, programas vivos y ausencia de errores. Tener media<16,7 no basta.
- Memoria de procesos cada segundo desde fuera de la página: Electron usa
  getAppMetrics (workingSetSize y pico); Chromium SystemInfo + RSS del SO (ps o
  PowerShell). Suma de RSS puede contar páginas compartidas varias veces. Los
  errores de muestreo quedan explícitos; no se sustituyen por heap de JS.
  GPU real, DPR, campo, lienzo, versión y calidad alto se registran por caso.
  Comparar por separado máquinas/backends; SwiftShader no valida GPU real.

## Ganchos de banco y pruebas

`__banco.medirUnidades(preparar)` presta el contexto de composición a la
herramienta; no se llama al cargar el juego y no importa herramientas desde app.
La preparación cambia solo el escenario/fuentes en memoria de la página aislada,
reconstruye la vista y ejecuta la ruta habitual. La fábrica del conductor se
restaura tras decorar partida/anfitrión para tomar tiempos. El gancho opcional
`__banco.alFotograma` recibe el delta original y el recortado, tras dibujar. Sin
observador no añade lecturas de algunoCorre ni relojes. No es API del jugador.
El almacenamiento de esta sesión de QA es temporal; no usar un origen propio
donde se esté jugando. Recargar restaura la composición original.

Pruebas: escenarios reales de 500 y dos huellas por serie, límites originales
conservados, descomposición temporal con reloj falso, percentiles/deriva/CLI,
bucle real y ventana rAF emulados. Registradas en todas.mjs. Identificadores
revisa también todos los módulos de la herramienta. **No sustituye probar el
navegador:** no se han validado aquí WebGL, UI de 500 pestañas ni GPU.

Perfil externo, separado de las cifras sin instrumentación de V8:

```sh
mkdir -p tmp/perfil-unidades
node --cpu-prof --cpu-prof-dir=tmp/perfil-unidades herramientas/medir-unidades.mjs --caso --series war --unidades 500 --pasos 240 --calentamiento 40 > tmp/perfil-unidades/caso.json
```

Abrir el .cpuprofile en un visor V8. No optimiza reglas ni simulación; los
cuellos encontrados y propuestas se documentan en el informe de QA del paso 4b.
Cambiar `--series war` por `--series campaign` perfila también sus respuestas.
El perfil incluye arranque, huella y cierre: no usar sus tiempos como medida sin
perfilador. [Resultados antes/después y límites](../../docs/qa/interprete-2026-11-17/README.md#paso-4b):
en M1/Node 22, 500 War da 9,01 ms p95 y Campaign 6,47 ms, arranque <0,5 s;
solo demuestra coste sin pantalla, pendiente el ritmo y dibujo en juego real.
