# vista-3d

Fase 2, paso 12. Vistas de War, Factory y Campaign desde la escena visible
del reglamento, sin leer ni escribir el mundo. Puede importar `protocolo`
y `vfx`; las dependencias de juego llegan en opciones.

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
opciones y la última escena dibujada. `tema`/`calidad` se reservan para el
contrato del plan; los colores actuales se siguen obteniendo de `leerVar`.

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
`alSuceso` no hace nada todavía: los efectos actuales vienen en la escena;
el consumo por `vfx` queda para la fase 4. Tipos comunes de `Vista` en
`protocolo`, reexportados por este paquete y usados también por app y vista-2d.

Las dependencias conservan los nombres anteriores: `$`, `FUNCIONES`,
`funcionDe`, `leerVar`, `radioDe` y los catálogos y funciones visuales de War.
War recibe `terreno` (API de CMGTerreno) y `terrenoEditor` (datos validados o
null); URL y guardado los lee la app. Campaign recibe `mapa`, `crearTerreno`
y `reglas`. Detalle en `index.d.ts`. La app conserva `V3` para sus extras y
usa `vistaActual()` para dibujo, elección y proyección.

Se conservan las entradas `crear3D(estado, deps)`,
`crearCampaign3D(estado, deps)` y `factory3d` (incluido su gancho mutable
`ultimo` para QA). Three r128 sigue siendo global y local al repositorio;
las rutas del T1 y su cargador glTF conservan la resolución anterior.

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
Factory reciben la misma instancia por parámetros; `factory3d.cargar(THREE)`
conserva la carga diferida de GLTFLoader y del modelo. El paquete no lee Three
ni la fachada `cmg` de la página. Prueba: `node paquetes/vista-3d/pruebas/vista-3d.mjs`.

## Dibujante de efectos (fase 4, paso 1)

`crearDibujanteEfectos(THREE, grupo, opciones)` se exporta por `index.js` y
vive en `efectos.js`; **todavía no se llama desde las vistas del juego**.
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

Shader pequeño compatible con r128: formas procedurales, tamaño en metros
con perspectiva, límite físico de punto y fragmentos de niebla. La niebla
apaga la luz aditiva hacia negro. `alturaBufer` son píxeles físicos (no se
multiplican otra vez por pixelRatio); `redimensionar` sí convierte altura CSS.
Debe inyectarse el máximo del dispositivo; el respaldo es 64 px conservadores.
No hay renderizador, consulta WebGL ni reloj dentro del dibujante. Destrucción
idempotente que retira las nubes y libera geometrías/materiales.
Contrato en `efectos.d.ts`; prueba r128 sin rasterizado en
`node pruebas/vfx-dibujantes.mjs` (incluida en `npm test`).
