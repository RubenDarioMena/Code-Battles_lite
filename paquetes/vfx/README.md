# vfx

Fase 4, pasos 1–3: recetas de datos y partículas sin estado, conectadas a War. Solo puede importar `protocolo`; funciona en Node sin entorno gráfico,
reloj, RNG de partida ni acceso al mundo. No añade dependencias.

## Entrada pública

```js
import { crearEfectos, crearRecetasWar, recetaWar, evaluar, validarReceta } from './index.js';
const recetas = crearRecetasWar({ radioDanio: MISIL.radio }); // MISIL lo aporta la app
const fx = crearEfectos({ recetas, recetaDe: recetaWar, dt: .05 });
fx.anotar(sucesoVisual);
const particulas = fx.particulas(tv, { colores, calidad: 'medio' });
fx.vaciar();
// Evaluación directa, sin cola ni poda:
evaluar(sucesoVisual, recetas.impacto, tv, { dt: .05, colores, calidad: 'alto' }, emitir);
```

Contrato completo en `index.d.ts`. `validarReceta(valor)` devuelve `string[]`
con rutas y motivos, sin lanzar; el gestor valida sus recetas al crearse.
`recetaDe(suceso)` devuelve una clave de `recetas` o `null`/`undefined` para
ignorar el suceso. Una clave inexistente es un error. El gestor copia los
sucesos al anotarlos; las recetas se consideran constantes durante su uso.

## Sucesos y coordenadas

Son sucesos del protocolo: `{ paso, tipo, unidad?, datos? }`. El origen temporal
es **paso × dt**, y `tv` está en segundos del reloj visual de la simulación.
Coordenadas VFX: `x/y` del mapa y `z` altura, en metros. Por defecto el origen
es `datos.x/y/z` (cero si falta). La vista puede enriquecer una **copia** con:

- `datos.origen: [x, y, z]`: posición visual capturada al recibir el suceso.
- `datos.rumbo`: radianes desde +x hacia +y; si falta, se apunta desde el origen
  hacia `datos.x/y` (destino de `disparo`).

Es imprescindible aportar origen para `disparo`, `derribo`, `atasco` y
`reparado`: el protocolo no incluye la posición del emisor en esos sucesos.
Resolverla desde la escena corresponde a la futura integración (paso 2),
nunca al núcleo VFX. El laboratorio aporta posiciones de muestra.

## Receta

`{ capas: [...] }`; cada capa declara `forma` (`brillo`, `disco`, `humo`),
`mezcla` (`normal`, `suma`), `n`, `vida`, `tam`, `alfa`, `color`.
`n` es entero; `n`, `vida`, `retraso` y `vel` admiten número o intervalo
`[mín, máx]` (extremos enteros inclusivos para `n`). `tam`/`alfa`/`color` son claves equidistantes de la vida.
Opcionales: `dir` (`esfera`, `hemisferio`, `cono`, `anillo`, `arriba`),
`arrastre ≥ 0`, `grav`, `deriva: [x,y,z]`, `suelo`, `alto`, `adelante`,
`estela` (copias de 18 ms, menores y más tenues), `radioFinal` (radio fijo de
un anillo). `destello?: boolean` identifica un brillo breve que puede suprimirse
por accesibilidad; el esquema acepta solo booleanos. `ciclo` se valida y queda reservado: todavía no produce bucles.

Cada partícula depende solo de paso/tipo/unidad/capa/índice y de
`τ = tv − paso×dt − retraso`; está viva cuando `0 ≤ τ < vida`.
Movimiento: `p₀ + d·v·(1−exp(−kτ))/k + deriva·τ + ½gτ²`, con límite `vτ`
cuando `k=0`. Con suelo, se encuentra el primer contacto con `z=0` dividiendo
la trayectoria en tramos monótonos y haciendo bisección determinista;
**las tres coordenadas** quedan detenidas allí, aunque la fórmula luego suba.
Las estelas consultan edades anteriores de la misma trayectoria, sin memoria.

Los colores admiten hex `#RGB`/`#RRGGBB` o tokens. La vista resuelve los tokens
y pasa `colores: { token: hex | [r,g,b] }` con canales normalizados 0–1. El
núcleo interpola esos canales; un token sin resolver lanza un error claro.

## Cola, calidad y presupuesto

`particulas(tv, opciones, emitir?)` devuelve un array de objetos planos
`Particula` (posición, tamaño, alfa, RGB, forma, mezcla e identidad local),
y opcionalmente emite cada elemento del resultado **después** del presupuesto.
No conserva partículas entre llamadas. Sí poda definitivamente sucesos cuyo
máximo retraso+vida ha caducado. Para rebobinar después de la poda: `vaciar()`
y volver a anotar los sucesos; `evaluar` directo admite cualquier orden temporal.

| Calidad | Cantidad | Tamaño de brillo | Presupuesto |
| --- | --- | --- | --- |
| alto | 100 % | 100 % | 2000 |
| medio | 60 % | 80 % | 1200 |
| bajo | 30 % | 60 % | 600 |
| no | 0 | 0 | 0 |

Se mantiene al menos una partícula por capa no vacía. El radio del aro no se
reduce con calidad. `presupuesto` admite un entero o un objeto por calidad.
El conteo incluye las estelas. Para recortar se quita primero humo, después
restos (mezcla normal), después luz; dentro de cada grupo, sucesos antiguos
por paso y desempate estable por orden de anotación/capa/índice/estela.

`evaluar` y `particulas` aceptan `sinDestellos?: boolean` (por defecto `false`).
Con `true` omiten exclusivamente capas `destello: true`, conservando sus índices
originales y las semillas de todas las demás capas. Se filtra antes de aplicar
el presupuesto: en saturación pueden caber otras partículas en su lugar.
No se podan sucesos por cambiar calidad o accesibilidad; volver al nivel anterior
conserva los efectos aún vivos. Sin la opción la salida es idéntica bit a bit.
La app resuelve movimiento reducido y preferencias; VFX no conoce el navegador.

## War

Nueve recetas: `disparo`, `impacto`, `fallo`, `derribo-oruga`, `derribo-dron`,
`derribo-dron-frio`, `atasco`, `reparado`, `brecha`. Datos en `recetas/war.js`,
exportados por la entrada pública. Eventos ≤1,6 s, destellos ≤0,2 s,
luz aditiva y humo con alfa ≤0,24. Solo el fogonazo de disparo (0,12 s)
y el destello inicial de impacto (0,16 s) llevan `destello: true`. Impacto y fallo incluyen el aro de daño.
`recetaWar` traduce `explosion` según `golpe`, ignora la explosión del atasco
(`misil: null`) y traduce `crawler`/`drone`/`stealth` para los derribos.
`golpe`/`aparece` y sucesos ajenos no generan recetas aquí.

## Pruebas y laboratorio

- `node paquetes/vfx/pruebas/vfx.mjs`: esquema, determinismo binario, tiempos,
  fórmula, primer contacto, calidad, selector y descarte con presupuesto.
- `node pruebas/vfx-dibujantes.mjs`: imports públicos sin entorno, Three r180
  real sin GPU, búferes fijos, liberación, contexto 2D falso y CLI de hojas.
- `node pruebas/vfx-laboratorio.mjs`: arranque y controles emulados en Node;
  no sustituye la revisión visual.
- Las tres entran en `npm test`. Fronteras y su autoprueba vigilan reloj y azar.
- [Laboratorio y hojas](../../herramientas/laboratorio-vfx/README.md): revisión
  visual y medidas de navegador pendientes del autor en este paso.

`node pruebas/vfx-calidad.mjs` verifica filtro por capa, esquema y regresión
binaria de 4360 partículas contra el paso 2; entra en `npm test`.
