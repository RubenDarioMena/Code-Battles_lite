# Cáscara de escritorio · fase 3, paso 1

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
plataforma: { almacen, sesion } }`. Cada almacén tiene `leer`, `escribir` y
`borrar` síncronos sobre texto, sin prefijos ni conversiones. La sesión vive en
memoria del preload, con un espejo en RAM del principal para sobrevivir a
recargas como sessionStorage; se reinicia al cerrar la ventana y no se escribe
en disco. Solo el preload usa IPC; no expone Electron ni Node.
`shared/i18n` conserva su propio localStorage de Electron, que también persiste
en userData; el idioma no está en `guardado.json`.

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
`code-battle-lite.exe` y `code-battle-lite`, cuya existencia comprueba al final.
También acepta `--plataforma=darwin`. Los temporales se eliminan incluso al
fallar. Preparar Netlify reconstruye `dist/`: hacerlo antes de empaquetar.

El empaquetador necesita las distribuciones Electron de destino en su caché
o conexión para obtenerlas; tener el módulo Electron del host no proporciona
los binarios de otros sistemas. Sin icono personalizado, firma, instalador,
actualización automática ni Steamworks (paso siguiente). Un cierre forzado
puede perder los últimos 300 ms; no hay recuperación automática de temporales.

Pruebas sin Electron: `npm test`, `npm run tipos` y `node pruebas/publicacion.mjs`
tras preparar Netlify. `escritorio-node.mjs` comprueba rutas, MIME, symlinks,
guardado atómico/agrupado/dañados, preload emulado y geometría. El principal
emulado en `escritorio-principal.mjs` verifica además IPC, permisos, F11, menú
y los tres puntos de volcado; no comprueba el comportamiento nativo de Electron.
`publicables.mjs` compara listas y bytes sin empaquetar. `test:escritorio` usa
Electron real con datos temporales, sin navegador externo: arranque de las tres
series, guardado/reapertura, seguridad y War 2/7 frente a la referencia que se
contrastó con la web en fase 2. No sustituye revisar F11, el botón Fullscreen,
las tres resoluciones y la restauración de posición en Windows y Linux reales.
