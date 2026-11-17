const { app, BrowserWindow, Menu, protocol, session, ipcMain, shell, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { servir, esInterna, peticionPermitida } = require('./protocolo.cjs');
const { crearGuardado } = require('./guardado.cjs');
const { crearSteam } = require('./steam.cjs');
const { limitar, leerVentana, crearMenu } = require('./ventana.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'cbl', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
} }]);
if (process.env.CBL_DATOS) {
  const carpeta = path.resolve(process.env.CBL_DATOS);
  fs.mkdirSync(carpeta, { recursive: true });
  app.setPath('userData', carpeta);
  app.setPath('sessionData', carpeta);
}
let ventana = null, guardado = null, sesion = Object.create(null);

function abrirExterno(url) {
  try {
    if (new URL(url).protocol === 'https:') void shell.openExternal(url).catch(console.error);
  } catch { /* URL inválida */ }
}

function crearVentana() {
  sesion = Object.create(null);
  const archivo = path.join(app.getPath('userData'), 'ventana.json');
  const previo = leerVentana(archivo);
  const area = (previo ? screen.getDisplayMatching(previo) : screen.getPrimaryDisplay()).workArea;
  const bounds = limitar(previo || { width: 1280, height: 800,
    x: area.x + (area.width - 1280) / 2, y: area.y + (area.height - 800) / 2 }, area);
  const win = ventana = new BrowserWindow({
    ...bounds, minWidth: Math.min(800, area.width), minHeight: Math.min(600, area.height),
    fullscreen: previo?.completa === true, show: process.env.CBL_OCULTA !== '1',
    title: 'Code Battle Lite', webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      sandbox: true, nodeIntegration: false,
      backgroundThrottling: process.env.CBL_OCULTA !== '1',
    },
  });
  Menu.setApplicationMenu(crearMenu(win, screen, Menu, app.getLocale()));
  const guardarVentana = () => {
    try {
      fs.writeFileSync(archivo + '.temporal', JSON.stringify({
        ...win.getNormalBounds(), completa: win.isFullScreen(),
      }));
      fs.renameSync(archivo + '.temporal', archivo);
    } catch (error) { console.error(error); }
  };
  win.on('close', () => { guardarVentana(); guardado.volcar(); });
  win.on('closed', () => { ventana = null; });
  win.webContents.setWindowOpenHandler(({ url }) => {
    abrirExterno(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-frame-navigate', evento => {
    if (!esInterna(evento.url)) {
      evento.preventDefault();
      if (evento.isMainFrame) abrirExterno(evento.url);
    }
  });
  win.webContents.on('will-redirect', (evento, url) => {
    if (!esInterna(url)) evento.preventDefault();
  });
  win.webContents.on('will-attach-webview', evento => evento.preventDefault());
  // Siempre la misma entrada; las pruebas pueden navegar internamente a cada serie.
  // ERR_ABORTED solo indica que otra navegación sustituyó a esta carga (recargar, cambiar de serie).
  void win.loadURL('cbl://app/Prototypes/Rocket%20Launcher/index.html')
    .catch(error => { if (error?.code !== 'ERR_ABORTED') console.error(error); });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  let appId = null;
  try {
    appId = process.env.CBL_STEAM_APPID !== undefined
      ? Number(process.env.CBL_STEAM_APPID)
      : JSON.parse(fs.readFileSync(path.join(__dirname, 'steam.json'), 'utf8')).appId;
  } catch (error) { console.warn('Configuración Steam ilegible; integración desactivada.', error); }
  const steam = crearSteam({ appId });
  steam.prepararSuperposicion(process.env);
  app.on('second-instance', () => {
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.show(); ventana.focus();
  });
  app.on('before-quit', () => guardado?.volcar());
  app.on('will-quit', () => guardado?.volcar());
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(() => {
    guardado = crearGuardado(app.getPath('userData'));
    const raiz = path.resolve(__dirname, '../..');
    protocol.handle('cbl', request => servir(raiz, request));
    session.defaultSession.webRequest.onBeforeRequest((detalles, responder) => {
      responder({ cancel: !peticionPermitida(detalles.url) });
    });
    // La API Fullscreen existente del juego debe seguir funcionando.
    session.defaultSession.setPermissionRequestHandler((web, permiso, responder) =>
      responder(permiso === 'fullscreen' && esInterna(web.getURL())));
    session.defaultSession.setPermissionCheckHandler((_web, permiso, origen) =>
      permiso === 'fullscreen' && esInterna(origen));
    session.defaultSession.on('will-download', evento => evento.preventDefault());
    const autorizado = evento => evento.sender === ventana?.webContents
      && evento.senderFrame === ventana.webContents.mainFrame
      && esInterna(evento.senderFrame.url);
    ipcMain.on('cbl:cargar', evento => {
      evento.returnValue = autorizado(evento)
        ? { version: app.getVersion(), almacen: guardado.cargar(), sesion: { ...sesion } }
        : { version: app.getVersion(), almacen: {}, sesion: {} };
    });
    ipcMain.on('cbl:cambiar', (evento, operacion, clave, texto) => {
      if (autorizado(evento)) guardado.cambiar(operacion, clave, texto);
    });
    ipcMain.on('cbl:logro', (evento, nombreApi) => {
      if (autorizado(evento) && typeof nombreApi === 'string') steam.desbloquear(nombreApi);
    });
    // Espejo solo en RAM para que la caché del preload sobreviva a recargas,
    // como sessionStorage. Se descarta junto con la ventana, nunca va al disco.
    ipcMain.on('cbl:sesion', (evento, operacion, clave, texto) => {
      if (!autorizado(evento) || typeof clave !== 'string') return;
      if (operacion === 'escribir' && typeof texto === 'string') sesion[clave] = texto;
      else if (operacion === 'borrar') delete sesion[clave];
    });
    crearVentana();
  }).catch(error => { console.error(error); app.quit(); });
}
