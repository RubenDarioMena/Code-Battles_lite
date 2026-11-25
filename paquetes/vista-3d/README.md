# vista-3d

Fase 2, paso 12. Vistas de War, Factory y Campaign desde la escena visible
del reglamento, sin leer ni escribir el mundo. Puede importar `protocolo`
y `vfx`; las dependencias de juego llegan en opciones.

## Campaign-V2 en metros

La composición de campaña y ensayo monta `crearVistaCV2(campo, opciones)` para H0 y la Batalla. Recibe `escenaMetros` y devuelve metros en `suelo`. La app convierte el punto a casillas para los gestos y traslada la proyección de las etiquetas en sentido inverso. `bastionEn` devuelve el índice de la pieza tocada y `batalla(si)` cambia los materiales sobre las mismas mallas. El registro de `cv2/modelos.js` comparte la carga de cada GLB entre sus instancias hasta destruir la vista. El plano y la paridad conservan sus vistas de origen.

`crearFicha3D(canvas, servicios, tipos)` devuelve un visor con `mostrar(unidad)` y `pausar()`, o `null` si WebGL no está disponible. Usa el registro de modelos y las primitivas de War. La prueba con Three comprueba la rotación y los extremos del campo y los bastiones en horizontal y vertical.

Las pruebas `node pruebas/campaign-v2-vista.mjs` y `node pruebas/three-r180.mjs` comprueban el registro, la pose física, la selección y el dibujo de H0 y B1 con geometría real.

## Contrato

```js
const vista = crearVista(campo, { serie, dt, estado, canvas, ...dependencias });
// null si falta THREE/WebGL (o crearTerreno en Campaign): usar la vista 2D.
vista.dibujar(null, escena, fraccion, ahora);
vista.alSuceso(suceso);
vista.elegir(x, y);                 // id o null; píxeles CSS locales al campo
vista.proyectar(x, alto, y);        // { x, y, visible }, píxeles CSS locales
vista.redimensionar();
vista.destruir();
```

`serie` es `war`, `factory` o `campaign`; `dt` es el paso fijo en segundos.
`dibujar` extrapola la escena actual: `actualizar(fraccion * dt, ahora)` y
luego `render()`, en ese orden. `fraccion` está entre 0 y 1; `anterior` puede
ser `null` y no se usa. El cuarto argumento opcional `ahora` es la marca del
fotograma en milisegundos; si se omite, se toma `performance.now()`.
Los relojes internos de animación de los motores anteriores se conservan.

`estado` aporta selección, arrastre y dimensiones del mapa. Su getter
`escena` abastece los métodos extra (`construir`, `anillosDe`, etc.) entre
fotogramas y antes del primer dibujo. Durante `dibujar` siempre se usa la
escena recibida por argumento. Sin `estado`, se usan `cols` y `rows` de las
opciones y la última escena dibujada. `tema` se reserva para el contrato del plan; los colores actuales se siguen obteniendo de `leerVar`.

El contenedor es el campo completo: `elegir`, `proyectar`, `suelo` y
`redimensionar` obtienen ancho/alto de su `getBoundingClientRect()`, el mismo
rectángulo usado anteriormente por la app. `canvas` es opcional; si falta,
se busca el primer canvas del contenedor. `proyectar` admite e ignora el
cuarto argumento `radioPlano` del contrato común (desplazamiento solo 2D).

Se conservan los métodos extra existentes: `construir`, `actualizar`,
`render`, `tamano`, `suelo`, `centrar`, `recentrar`, `anillosDe`,
`aplicarColores`, `girar`, `retrato` y `camara`. Campaign añade `batalla`,
`verCampo` y `terreno`. `suelo` de la fachada ya no necesita ancho/alto;
`tamano` y `girar` mantienen sus argumentos anteriores. `destruir` es
idempotente: retira gestos/observadores y libera recursos de dibujo.
`alSuceso` anota efectos locales en War; `vaciar()` los retira.
Factory y Campaign ignoran los sucesos VFX. Tipos comunes de `Vista` en
`protocolo`, reexportados por este paquete y usados también por app y vista-2d.

Las dependencias conservan los nombres anteriores: `$`, `FUNCIONES`,
`funcionDe`, `leerVar`, `radioDe` y los catálogos y funciones visuales de War.
War recibe `terreno` (API de CMGTerreno) y `terrenoEditor` (datos validados o
null); URL y guardado los lee la app. Campaign recibe `mapa`, `crearTerreno`
y `reglas`. Detalle en `index.d.ts`. La app conserva `V3` para sus extras y
usa `vistaActual()` para dibujo, elección y proyección.

Se conservan las entradas `crear3D(estado, deps)`,
`crearCampaign3D(estado, deps)` y `factory3d` (incluido su gancho mutable
`ultimo` para QA). Three r180 es ESM local; la ruta del T1 conserva su resolución relativa a la página.

## Pruebas

- `node pruebas/vistas-contrato.mjs`: exportaciones y respaldo sin Three.
- `node paquetes/vista-3d/pruebas/vista-3d.mjs`: Three real, GPU/DOM simulados,
  escenas congeladas, fachada, extrapolación y marca de fotograma,
  proyección/elección desde el contenedor y destrucción. No prueba rasterizado.
- `pruebas/vista-caliente.cjs`, `pruebas/factory-3d.mjs` y
  `herramientas/capturas-vista.mjs`: QA de navegador.


### Three inyectado (paso 13)

`crearVista`, `crear3D` y `crearCampaign3D` reciben `THREE` en sus opciones.
Si falta, devuelven `null` para conservar la caída al plano. Cámara, terreno y
Factory reciben la misma instancia por parámetros;
`factory3d.cargar(cargarGLTFLoader)` recibe una función asíncrona que devuelve
el constructor GLTFLoader r180. Solo Factory lo solicita y carga el modelo. El paquete no lee Three
ni la fachada `cmg` de la página. Prueba: `node paquetes/vista-3d/pruebas/vista-3d.mjs`.

## Dibujante de efectos (fase 4, paso 1)

`crearDibujanteEfectos(THREE, grupo, opciones)` se exporta por `index.js` y
vive en `efectos.js`; lo usa la fachada de War mediante `efectos-war.js`.
Three se recibe como parámetro; el import funciona en Node sin DOM ni Three.

```js
const fx = crearDibujanteEfectos(THREE, grupo, {
  pixelRatio, alturaBufer, fov: camara.fov,
  maxPunto: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1],
  capacidad: 2000,
});
fx.dibujar(particulas);
fx.redimensionar({ alturaCss, pixelRatio, fov: camara.fov });
fx.destruir();
```

Dos `Points` (normal y aditivo), cada uno con búfer fijo de `capacidad`,
`setDrawRange`, `raycast` vacío, `depthWrite:false`, renderOrder 2/3 sobre
los calcos actuales (1). La capacidad cuenta estelas; si se supera en una
mezcla se trunca su cola. El gestor VFX debe usar un presupuesto acorde.
Convierte mapa `(x,y,z altura)` a Three `(x,z,y)`.

Shader pequeño compatible con r180: formas procedurales, tamaño en metros
con perspectiva, límite físico de punto y fragmentos de niebla. La niebla
apaga la luz aditiva hacia negro. `alturaBufer` son píxeles físicos (no se
multiplican otra vez por pixelRatio); `redimensionar` sí convierte altura CSS.
Debe inyectarse el máximo del dispositivo; el respaldo es 64 px conservadores.
No hay renderizador, consulta WebGL ni reloj dentro del dibujante. Destrucción
idempotente que retira las nubes y libera geometrías/materiales.
Contrato en `efectos.d.ts`; prueba r180 sin rasterizado en
`node pruebas/vfx-dibujantes.mjs` (incluida en `npm test`).


## War conectado (fase 4, paso 2)

La composición `app/juego/vistas.js` reenvía `alSucesos` del conductor a las
dos vistas, aunque una esté oculta, solo en War. `efectos-war.js` mantiene su
cola `crearEfectos` y enriquece copias desde la escena: lanzador a altura 1
para `disparo` (rumbo al destino) y `atasco`, al suelo para `reparado`;
coordenadas del suceso para `brecha`; última posición dibujada con off para
`derribo` (o actual si existe). Si el enemigo falta, espera la explosión
posterior del mismo paso y lanzador; la escena aporta el respaldo del mismo
paso. `recetaWar` elige impacto/fallo y descarta la explosión del atasco.

La fachada monta un grupo fuera de fijo/móvil, con las dos nubes por encima
de los calcos. Sustituye las antiguas esferas de explosión y humo de atasco.
Antes de renderizar evalúa `particulas(escena.t + off, { colores: estado.col,
calidad })`; usa `opciones.MISIL.radio` y `dt`. La app resuelve preferencias y URL; ni la vista ni VFX leen la URL. Factory/Campaign no montan VFX.

El montaje obtiene `maxPunto` del contexto WebGL, `fov` de la cámara War y
la altura física del canvas del renderer. `tamano`, `redimensionar` y el
dibujo sincronizan la escala con el búfer. `vaciar()` retira cola, posiciones,
pendientes y partículas visibles al ejecutar/reiniciar/crear mundo.
`destruir()` además retira grupo, nubes, materiales y geometrías antes de
liberar la escena/renderizador. `node pruebas/vfx-juego.mjs` (en `npm test`)
comprueba integración, orígenes, calidad y recursos con GPU/canvas emulados;
shaders, aspecto y capturas quedan para el autor.

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

## Instancias de War (fase 4, paso 4)

`instancias-war.js` conserva el modelo suelto para `retrato` y reutiliza dos
patrones (oruga/dron) para componer exactamente sus `matrixWorld`. En combate
hay un `InstancedMesh` por pareja geometría/material: cuerpos de oruga y dron
normal/frío/golpe, orugas, brazos, rotores, sombras y esferas de misil. No usa
`instanceColor`: el golpe es `M.golpe` durante los mismos 0,25 s; frío mantiene
`M.frio`, transparente con opacidad 0,72. Materiales compartidos con el visor,
por lo que `aplicarColores` llega también a todos los lotes.

Capacidad inicial 1, duplicada sin techo fijo; `count` cuenta piezas vivas
(dos orugas, dos brazos o cuatro rotores por unidad). Se compactan las bajas
y las migraciones de material, sin matrices de unidades muertas. Solo se
marca `instanceMatrix.needsUpdate` si cambia alguna matriz o crece el búfer;
`frustumCulled=false` evita recortes por el volumen del patrón en el origen.

Las líneas de altura y las estelas siguen por unidad para conservar trazado,
mezcla y discontinuidad: altura usa el mismo `lineDistance=[0,1]` antes de
escalar a `e.z`; cada estela conserva los diez puntos separados por 0,03 s.
Máquinas, miras y anillos siguen como antes. Los retratos usan mallas sueltas.

`camara.js` resuelve cada hit mediante `instanceId` y `object.userData.ids`;
las piezas, sombras y alturas devuelven el ID de su enemigo. Los objetos
sueltos siguen buscando `userData.id` en sus padres. Anillos sin cambios.
Al reconstruir/destruir se retiran y liberan instancias y geometrías propias;
los búferes sustituidos al duplicar se liberan inmediatamente. El visor es
el dueño de G/M/L y libera esos recursos compartidos al destruirse.

`camara().dibujo = { calls, triangles }` en War/Factory copia los contadores
del último render (`renderer.info.render`), incluido el resto del paisaje,
máquinas y VFX. La página los expone con `cmg.camara().dibujo`.

Pruebas: `node paquetes/vista-3d/pruebas/instancias-war.mjs` (en `npm test`):
Three r180 real sin GPU, todas las matrices contra el modelo suelto, materiales,
counts, no actualización redundante, crecimiento 513→1024, selección, líneas,
bajas y liberación. `vista-3d.mjs` comprueba además raycast real desde cámara,
tema, reconstrucción, retratos y contrato. No comprueban rasterizado.

## Migración Three r180 (fase 4, paso 5)

La entrada del juego importa `three.module.min.js` y lo inyecta; este paquete
no importa Three ni modifica su namespace. Su import map resuelve `three`
para el GLTFLoader ESM y sus utilidades locales, también en `cbl://app/`.
CMGTerreno recibe THREE explícitamente: no necesita `window.THREE`.
WebGL 2 es obligatorio; si falla el constructor se conserva la caída al plano.
El editor de terreno usa el módulo WebGPU de la misma distribución.

Gestión de color activa: hex/CSS se interpretan como sRGB y se convierten a
Linear-sRGB automáticamente; no se aplica una segunda conversión ni un factor
adicional a los colores del tema. Salida `SRGBColorSpace`, `NoToneMapping`
(exposición 1). Las luces compensan el modo heredado con ×π: War/Factory,
hemisférica 0,85π y direccional 0,55π; Campaign, 0,82π y 0,62π. Las mezclas
entre colores se hacen ahora en lineal; el rasterizado puede variar.
Las CanvasTexture de halos llevan `SRGBColorSpace` (alfa sin conversión).
El robot conserva los valores lineales glTF al adaptar PBR a Lambert,
sin el antiguo `convertLinearToSRGB`.

VFX recibe el mismo RGB sRGB que 2D, lo convierte a lineal en el búfer y usa
`colorspace_fragment` antes de la niebla (como los materiales r180). La niebla
aditiva sigue desvaneciéndose a negro. No hay `outputEncoding`, `encoding`,
luces heredadas ni alias `*BufferGeometry` en los consumidores actuales.
`node pruebas/three-r180.mjs` verifica el grafo ESM oficial, el T1 y MIME/rutas
del protocolo de escritorio sin Electron ni red.
Las pruebas Node usan r180 real con dobles mutables de renderizador; no se
reescribe el namespace importado. No verifican shaders en GPU ni capturas.
