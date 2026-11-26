# vista-2d

Fase 2, paso 12. Dibuja War, Factory y Campaign desde `escena(mundo)`:
datos planos, sin leer ni escribir el mundo. Solo puede importar `protocolo`
y `vfx`; mapa, reglas auxiliares y catálogos llegan desde la composición.

## Contrato

```js
const vista = crearVista(canvas, { serie, dt, estado, ...dependencias });
vista.dibujar(null, escena, fraccion, ahora);
vista.alSuceso(suceso);
vista.elegir(x, y);                   // id o null; píxeles CSS locales
vista.proyectar(x, alto, y);          // { x, y, visible }, píxeles CSS locales
vista.redimensionar();
vista.destruir();
```

`serie` es `war`, `factory` o `campaign`; `dt` es el paso fijo en segundos.
`fraccion` está entre 0 y 1: se extrapola la escena actual con
`off = fraccion * dt`, como antes. `anterior` puede ser `null` y no se usa.
El cuarto argumento opcional `ahora` es la marca del fotograma en milisegundos:
se pasa al plano conservando su dibujo actual (War sigue leyendo su propio
reloj para los halos; Campaign no usa ese argumento).

`estado` aporta selección, arrastre, dimensiones en unidades del mundo
(`cols`, `rows`) y colores (`col`). Su getter opcional `escena` permite elegir
sobre la escena vigente entre fotogramas, incluso antes del primer dibujo.
Durante `dibujar` siempre se usa el argumento `escena`. Sin `estado`, se pueden
dar `cols`, `rows` y `tema` en opciones; la selección queda vacía.
`estado.efectos` aporta la calidad y accesibilidad vivas (véase paso 3).

Las dependencias conservan los nombres de los planos anteriores: `FUNCIONES`,
`TIPOS`, `MISIL`, `SENSOR`, `LAU`, `LINEA_BASE`, `FR`, `HALO`, `INTENSIDAD`,
`ARCO`, `LUCES`, `visual`, `funcionDe`, `radioDe`, `direccionDe`, `alcance`,
`rgba`, `mezclaBlanco` y `r2`. Campaign recibe `mapa` y `reglas` (`esRobot`,
`esMaquina`, `estadoMaquina`, etc.; `luzEstado` opcional, para el color del piloto). Tipos en `index.d.ts`.

La geometría del plano es privada. `elegir` recorre `maquinas` y `enemigos`,
obtiene las máquinas de Factory de `robot` + `entidades` en su orden original,
prefiere `cx/cy` a `x/y` y conserva el umbral estricto de .9 unidades.
`proyectar` ignora `alto`; su cuarto argumento opcional `radioPlano` desplaza
la etiqueta hacia arriba en unidades del mundo. `suelo(x, y)` invierte la
proyección para introducir coordenadas desde el campo. La interfaz obtiene
la escala con la diferencia entre dos proyecciones, sin acceder a la geometría.

El lienzo se ajusta en el siguiente dibujo; `redimensionar` no adelanta ese
dibujo. `destruir` retira los gestos de Campaign y libera su fondo; es
idempotente. En War, `alSuceso` anota efectos locales y `vaciar()` los retira;
Factory y Campaign ignoran estos sucesos.

Se conservan `crearPlano`, `dibujarFactory`, `crearPlanoCampaign` y
`crearTerreno(mapa)` como entradas compatibles. La app inyecta el relieve a
vista-3d sin imports entre vistas. Campaign aún consulta el botón de piel y
`window.__banco`, igual que antes.

La composición de Campaign-V2 inyecta `dibujarIconoHito` como `iconoUnidad(ctx2d, unidad, x, y, escala, tiempo)` en H0 y las Batallas. El plano conserva la geometría común de proyección y selección.

## Pruebas

- `node pruebas/vistas-contrato.mjs`: fachada, dibujo con fracciones 0/1 idéntico
  al plano anterior, selección y destrucción con canvas falso; entra en `npm test`.
- `node paquetes/vista-2d/pruebas/vista-2d.mjs`: escenas congeladas de War y
  Factory y relieve determinista de Campaign.
- `pruebas/vista-caliente.cjs`: cambio 2D/3D en navegador.
- `herramientas/capturas-vista.mjs`: comparación visual; requiere navegador.

En el paso 13, el plano Campaign recibe `leerBatalla()` por opciones (por defecto
`false`), en lugar de consultar `window.__banco` y el botón de piel. La app
conserva la misma condición de UI. `pruebas/globales-juego.mjs` protege esta
frontera además de las pruebas del plano y del contrato de vistas.

## Dibujante de efectos (fase 4, paso 1)

`crearDibujanteEfectos` se exporta por `index.js` y vive en `efectos.js`;
lo usa la fachada de War mediante `efectos-war.js`.

```js
const fx = crearDibujanteEfectos({ T, ox, oy });
fx.dibujar(ctx2, particulas); // Particula[] del paquete vfx
fx.vaciarCache();
fx.destruir();
```

`T` es píxeles por metro, `ox/oy` el origen del mapa. Puede pasarse
`proyectar(x,y,z) → {x,y}`; `T` sigue determinando el diámetro del sello.
La proyección por defecto ignora altura, como el plano actual. Guarda/restaura
el estado del contexto y dibuja humo, restos y luz, por ese orden (`lighter`
para luz). Los sellos radiales se cuantizan a 16 niveles RGB por canal y se
reutilizan en una caché acotada (256 entradas por defecto, `limiteCache`).
`crearLienzo(lado)` permite inyectar un canvas falso; importar el módulo no
requiere DOM. `destruir` libera la caché y es idempotente; el dibujante puede
volver a generar sellos si se reutiliza. Contrato en `efectos.d.ts`.
Prueba sin navegador: `node pruebas/vfx-dibujantes.mjs` (incluida en `npm test`).


## War conectado (fase 4, paso 2)

`app/juego/ciclo-programas.js` entrega `alSucesos(lista)` a la composición
`app/juego/vistas.js`, que reenvía cada suceso a ambas fachadas solo en War.
`efectos-war.js` crea su propio `crearEfectos`, con `dt`, `recetaWar` y
`crearRecetasWar({ radioDanio: opciones.MISIL.radio })`. Se anota una copia:
`disparo` desde el lanzador a altura 1 y rumbo al destino; `atasco` a altura 1;
`reparado` desde el suelo del lanzador; `brecha` desde sus coordenadas.
`derribo` usa la última posición dibujada (con off) o la posición actual si
existe; sin ella espera la explosión posterior del mismo paso y lanzador,
con respaldo en las explosiones de la escena del mismo paso.

Dibuja `particulas(escena.t + off, { colores: estado.col, calidad })` tras
unidades y misiles. `anotaciones-war.js` mantiene encima las miras, selección,
aro discontinuo y etiqueta `↑z` de estallidos aéreos. Se retiran los discos
rellenos de explosión y atasco. La app resuelve preferencias y URL; la vista no las consulta.
`vaciar()` se llama al ejecutar, reiniciar y crear un mundo; `destruir()`
también vacía la cola y libera la caché de sellos. No cambia ningún dato del
reglamento. Prueba de integración: `node pruebas/vfx-juego.mjs` en `npm test`,
con canvas/GPU emulados; la revisión visual corresponde al autor.

## Calidad viva y medida (fase 4, paso 3)

`estado.efectos?: { calidad: 'alto'|'medio'|'bajo'|'no', sinDestellos?: boolean }`
se consulta en cada dibujo y se reenvía a `particulas`. Las fachadas conservan
el getter del estado externo. No vacían por cambiar nivel ni accesibilidad;
los efectos en curso reaparecen si siguen vivos al subir calidad.
Sin getter se conserva `opciones.calidad` (alto por defecto) para consumidores
independientes. La resolución de `auto`, URL y movimiento reducido es de app.

`estado.medicionEfectos?` recibe `{ ahora(): number, registrar(muestra) }`.
Solo cuando está presente se cronometra `particulas()` y `dibujar()` con el
reloj inyectado; entrega `{ vista, vivas, particulasMs, dibujarMs }` por dibujo.
Excluye el render de escena/GPU. App lo habilita únicamente por el gancho de
QA `__banco.medirEfectos`. `pruebas/vfx-juego.mjs` verifica cambios entre
fotogramas de un mismo efecto y contadores con canvas/GPU emulados.
