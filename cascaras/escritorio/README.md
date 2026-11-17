# Cáscara de escritorio · fase 3, pasos 1 y 2

Desde la raíz, con las dependencias ya instaladas:

```sh
npm run escritorio
npm run test:escritorio
npm run escritorio:empaquetar
# Solo una plataforma (x64):
npm run escritorio:empaquetar -- --plataforma=linux
```

Electron 45.2.1 abre War en `cbl://app/Prototypes/Rocket%20Launcher/index.html`.
Factory y Campaign usan las mismas URLs con `?serie=factory` / `?serie=campaign`.
No se necesita servidor web. `CBL_OCULTA=1` mantiene la ventana oculta y permite
que avance el juego para QA. `CBL_DATOS=/carpeta/absoluta` aísla todos los datos
de Electron, incluido su localStorage. No usar la carpeta personal para pruebas.

## Ventana

1280×800 por defecto (DIP), mínimo 800×600 o el área disponible si es menor.
`ventana.json` recuerda posición, tamaño normal y pantalla completa; al retirar
un monitor se limita al área de trabajo de una pantalla disponible. F11 y
Ver → Pantalla completa alternan el modo. La API Fullscreen del juego sigue
habilitada. Ver → Resolución ofrece 1280×720, 1600×900 y 1920×1080 de contenido,
limitados al área de trabajo incluyendo el marco y menú. Se deshabilita en
pantalla completa. El menú usa español si el sistema comienza por `es`, inglés
en otro caso. Una segunda instancia activa la ventana existente.

## Guardado y contrato

`guardado.json` está en `app.getPath('userData')`. En desarrollo y empaquetado
la aplicación se llama `Code Battle Lite`; ubicaciones habituales:

- Windows: `%APPDATA%/Code Battle Lite/`.
- Linux: `$XDG_CONFIG_HOME/Code Battle Lite/` o `~/.config/Code Battle Lite/`.
- macOS: `~/Library/Application Support/Code Battle Lite/`.

El archivo contiene `{ "version": 1, "almacen": { "clave": "texto" } }`.
Las claves y textos interiores son exactamente los de la plataforma web,
incluidos sus JSON y migraciones. No se importa automáticamente el localStorage
de otro origen. El principal carga antes del juego y agrupa cambios durante
300 ms. Escribe temporal + rename en la misma carpeta, con volcado síncrono en
el cierre de ventana y `before-quit` / `will-quit`. Un fallo conserva el destino
anterior y se reintenta al cambiar/cerrar; se registra en stderr. Un archivo
ilegible, inválido o de otra versión se aparta como
`guardado.json.danado-<marca>`; si no puede apartarse, se detiene el arranque
sin sobreescribirlo.

El preload aislado expone `cblCascara = { nombre: "escritorio", version,
plataforma: { almacen, sesion, logros } }`. Cada almacén tiene `leer`, `escribir` y
`borrar` síncronos sobre texto, sin prefijos ni conversiones. La sesión vive en
memoria del preload, con un espejo en RAM del principal para sobrevivir a
recargas como sessionStorage; se reinicia al cerrar la ventana y no se escribe
en disco. Solo el preload usa IPC; no expone Electron ni Node.
`shared/i18n` conserva su propio localStorage de Electron, que también persiste
en userData; el idioma no está en `guardado.json`.

## Steam opcional

El repositorio no trae AppID: `steam.json` contiene `{ "appId": null }`.
Sin AppID no se carga `steamworks.js`, ni se modifica la GPU. El adaptador
`crearSteam({ appId, cargar?, registro? })` de `steam.cjs` solo lo importa el
principal; permite un módulo falso para probarlo en Node. Ofrece `estado()`
(`{ activo, appId }`), `desbloquear(nombreApi)` y
`prepararSuperposicion(entorno)`. Fallos de carga, inicialización o servicios se
absorben y anotan una vez por adaptador. Desbloquear consulta `isActivated`
antes de `activate`. El preload solo envía `cbl:logro`; el principal aplica el
mismo control de remitente, marco y origen que al guardado.

Para probar, pon tu AppID en `steam.json` o ejecuta
`CBL_STEAM_APPID=123456 npm run escritorio`, con Steam abierto y licencia.
La variable prevalece; `0` fuerza integración inactiva. El principal prepara
la superposición antes de `app.whenReady()` únicamente si hay AppID y Steam
lanzó el proceso (`SteamAppId` o `SteamGameId`). Así se limita el cambio
`in-process-gpu` del módulo a las ejecuciones desde Steam.

`logros.desbloquear("CBL_PRUEBA_VICTORIA")` es seguro sin Steam. Se solicita
al ganar War/Factory o cumplir un hito de Campaign. La web no implementa
`logros`. Steam Cloud usa Auto-Cloud sobre el archivo existente, sin código
ni cambios de formato. La configuración, SteamPipe y la lista concreta de
pruebas del autor están en [docs/STEAM.md](../../docs/STEAM.md).

## Protocolo y seguridad

`cbl` se registra antes de ready como standard, secure, supportFetchAPI,
corsEnabled y stream. `protocol.handle` sirve desde la raíz del repositorio en
desarrollo y la raíz de `app.asar` en el paquete. Rechaza segmentos `..` (también
codificados), rutas absolutas, barras invertidas, dobles codificaciones,
archivos ocultos y enlaces simbólicos fuera de la raíz. Solo sirve los MIME
de `protocolo.cjs`; falta/denegado → 404. No sirve package.json, node_modules ni
las fuentes de esta cáscara. Si Chromium normaliza `../package.json` antes de
entregarlo, `/package.json` sigue dando 404. No se usa `file://`.

`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. IPC limitado
al marco principal de la ventana y al origen fijo `cbl://app`. Navegación solo
a ese origen, `window.open` denegado; los enlaces https abren el navegador del
sistema con `shell.openExternal`. Recursos y conexiones solo `cbl:`, `blob:`
y `data:`; los Workers blob siguen funcionando. La telemetría `/api/t` recibe
404 local y no sale a Internet. No se adjuntan webviews ni se descargan archivos.

## Empaquetado y límites

El guion usa la misma lista/filtro que Netlify (sin pruebas de paquetes), añade
esta carpeta y un package.json mínimo y llama a `@electron/packager` 20.3.0.
Salida predeterminada: Windows y Linux x64 con ASAR en `dist/escritorio/`,
`code-battle-lite.exe` y `code-battle-lite`, cuya existencia comprueba al final,
junto con los `.node` y `steam_api64.dll` / `libsteam_api.so` desempaquetados.
Incluye `steam.json`, declara `steamworks.js` 0.4.0 como dependencia de la app
y copia del módulo instalado solo `index.js`, `package.json`, `LICENSE` y
`dist/` de destino (`win64`, `linux64` u `osx`). Usa
`asar: { unpack: '**/*.{node,dll,so,dylib}' }`; no instala ni recompila módulos.
También acepta `--plataforma=darwin`. Los temporales se eliminan incluso al
fallar. Preparar Netlify reconstruye `dist/`: hacerlo antes de empaquetar.

El empaquetador necesita las distribuciones Electron de destino en su caché
o conexión para obtenerlas; tener el módulo Electron del host no proporciona
los binarios de otros sistemas. Sin icono personalizado, firma, instalador,
actualización automática. Steam real y Steam Deck los verifica el autor. Un cierre forzado
puede perder los últimos 300 ms; no hay recuperación automática de temporales.

Pruebas sin Electron: `npm test`, `npm run tipos` y `node pruebas/publicacion.mjs`
tras preparar Netlify. `escritorio-node.mjs` comprueba rutas, MIME, symlinks,
guardado atómico/agrupado/dañados, preload emulado y geometría. El principal
emulado en `escritorio-principal.mjs` verifica además IPC, permisos, F11, menú
y los tres puntos de volcado; no comprueba el comportamiento nativo de Electron.
`steam.mjs`, `steam-empaquetado.mjs` y `steam-vdf.mjs` prueban el adaptador
falso, manifiesto/copias, comprobación de salida emulada y plantillas sin
ejecutar Electron, packager ni SteamCMD. `npm run escritorio:steam-vdf --
--appid=N --depot-windows=N --depot-linux=N [--rama=qa-privada]` genera VDF
en `dist/steam`; solo incluye `setlive` con una rama explícita distinta de default.
`publicables.mjs` compara listas y bytes sin empaquetar. `test:escritorio` usa
Electron real con datos temporales, sin navegador externo: arranque de las tres
series, guardado/reapertura, seguridad y War 2/7 frente a la referencia que se
contrastó con la web en fase 2 (fallo), más victoria War 1/7 con el programa
en bucle de la referencia 2. Fuerza `CBL_STEAM_APPID=0` y comprueba que la
API de logros existe y es inocua, sin errores de página ni del principal.
No sustituye revisar F11, el botón Fullscreen,
las tres resoluciones y la restauración de posición en Windows y Linux reales.
