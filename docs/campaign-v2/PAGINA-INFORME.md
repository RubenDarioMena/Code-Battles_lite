# Campaign-V2 · Página propia

La porción «Página propia», posterior a P5a, tiene entrada en [Prototypes/Campaign-V2/](../../Prototypes/Campaign-V2/index.html). Una partida nueva abre H0 y pasa a B1 al almacenar cuatro misiles. Una partida guardada recupera su último hito.

## Qué salió

Rocket Launcher recuperó el HTML, los estilos, los servicios y los modelos de `HEAD`. Su único cambio frente a esa revisión es la redirección de `?serie=campaign-v2`, que conserva el resto de la consulta y el fragmento. En el prototipo independiente se retiraron la navegación entre series y a la portada, el selector de retos, la edición de escenarios, el enlace al editor de terreno, la prueba en dispositivos, el teclado simulado y la telemetría remota.

`paquetes/reglas-campaign/` coincide con `HEAD`. El arranque clásico inyecta ese reglamento. El grafo de la entrada de Campaign-V2 carga su fábrica local. Las reglas de War siguen aportando las batallas de referencia y el anfitrión de programas mantiene la API de las unidades.

## Qué entró

- La página reúne fábrica, campo de batalla, selector de vistas, HUD, árbol de unidades, inspector, consola, mando y editor. Reutiliza los estilos generales, el editor y sus servicios. Conserva las órdenes manuales y la revisión paso a paso del código.
- El menú de etapas ofrece H0, B1–B5 y Salida. En campaña, elegir un checkpoint conserva la opción de recuperar sus programas. Una etapa pendiente se abre como ensayo independiente. «Continuar campaña» vuelve al progreso guardado desde un ensayo o paridad.
- La página aplica `campaign-v2:` a los datos de interfaz y sesión, incluidos idioma, portapapeles y preferencias del modo revisión. El progreso conserva `campaign-v2-nivel-1` y `campaign-v2-nivel-1-programas`. La página no migra preferencias desde las otras series.
- El reglamento V2 contiene el estado de las unidades de fábrica, la receta, el ciclo de la prensa, la bodega, las metas y la serialización de H0. El plano reutiliza el dibujante con el mapa de H0. La torreta, el vehículo, el T1 con rig y el icono de prensa se sirven desde el prototipo. Factory vuelve a cargar su T1 original.

## Líneas en la app compartida

El recuento corresponde a la columna de adiciones de `git diff HEAD --numstat -- paquetes/app` en archivos de código que ya existían en la base. Incluye P1–P5a y esta porción. Una línea sustituida cuenta una vez en «Añadidas». Las retiradas se indican para que se pueda reproducir el cálculo.

| Archivo en `paquetes/app/` | Añadidas | Retiradas |
| --- | ---: | ---: |
| `conductor.js` | 45 | 2 |
| `index.d.ts` | 12 | 2 |
| `index.js` | 6 | 1 |
| `juego/arranque.js` | 19 | 6 |
| `juego/bucle.js` | 2 | 1 |
| `juego/campo.js` | 5 | 1 |
| `juego/ciclo-programas.js` | 119 | 30 |
| `juego/cierre-intentos.js` | 3 | 0 |
| `juego/datos-proveedor.js` | 7 | 1 |
| `juego/escenario.js` | 2 | 1 |
| `juego/estado.js` | 45 | 14 |
| `juego/iniciar.js` | 8 | 2 |
| `juego/paleta.js` | 4 | 4 |
| `juego/programas.js` | 53 | 5 |
| `juego/proveedor.js` | 1 | 0 |
| `juego/python.js` | 1 | 1 |
| `juego/revision-juego.js` | 3 | 3 |
| `juego/vistas.js` | 15 | 5 |
| **Total** | **350** | **79** |

Los archivos nuevos de app dedicados a V2 se contabilizan aparte.

- `campaign-v2.js` · 2 líneas
- `juego/campaign-v2.js` · 205 líneas
- `juego/checkpoints-v2.js` · 77 líneas
- `juego/colocador-v2.js` · 63 líneas
- `juego/gestos-clic.js` · 96 líneas
- `juego/proveedor-v2.js` · 27 líneas
- `juego/repetir-intento.js` · 20 líneas
- `juego/vinculos-v2.js` · 45 líneas

## Suposiciones

- Se tomó el índice recibido como base de P1–P5a y se conservó el `HEAD` indicado (`6330c0ed`, igual a la referencia local `origin/trunk`). La rama local `trunk` apunta a otra revisión. El índice y las referencias grabadas conservan el estado recibido.
- En paridad, seleccionar otra batalla conserva el modo. H0 y Salida abren un ensayo porque carecen de reto equivalente en War. En campaña, visitar una etapa pendiente sirve para probarla sin adelantar el historial.
- Las preferencias generales de V2 empiezan en su nuevo espacio de claves. Se conserva el progreso que ya pertenecía exclusivamente a V2. Los estilos base de Rocket Launcher y el adaptador de servicios se comparten por ruta relativa.
- La verificación de las rutas en 8779 corresponde al navegador del revisor. Aquí se ejecutaron las entradas locales con el DOM emulado y los modelos con Three y los GLB de disco.

## Verificación

`node pruebas/todas.mjs` dio **82 ok, 7 falla, 0 omitida**. Pasaron la prueba nueva de página, las 43 referencias grabadas, las 12 partidas de paridad de V2 y las fronteras de las series clásicas (War 10/10, Factory 28/28, Campaign 2/2 y 12/12 repeticiones). Se ejecutó además la prueba de página con el acceso al almacenamiento del modo revisión.

La prueba de página recorre H0 → B1, abre B1 y Salida por URL, ejerce el menú de etapas y observa las claves persistidas. Comprueba la ausencia de la navegación antigua y de imports de reglas de Campaign en V2. La prueba de la redirección comprueba la consulta, el fragmento y las otras tres series.

La comparación contra `HEAD` quedó vacía para los modelos, `campaign.css`, `js/servicios.js` y el reglamento de Campaign. El único diff en Rocket Launcher es la redirección de `index.html`. Tanto `paquetes/reglas-war` como `pruebas/referencias/partidas.json` coinciden con el índice recibido.

## Faltantes

- Los siete fallos de la línea base son `vfx-dibujantes`, `medir-carga-node`, `publicables`, `steam-empaquetado`, `steam-vdf`, `globales-juego` y `juego-identificadores`.
- La comprobación complementaria con TypeScript disponible en otro worktree sigue señalando dependencias locales ausentes de Electron, Steamworks y Playwright y dos lecturas de `mundo.hito` en `ciclo-programas.js` y `repetir-intento.js`.
- Quedan para Claude la carga HTTP en 8779 y la revisión visual en móvil y escritorio. P5b sigue pendiente.
