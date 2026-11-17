// Cableado del principal con Electron emulado: no lanza procesos gráficos.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const main = new URL('../cascaras/escritorio/main.cjs', import.meta.url);
const require = createRequire(main);
const datos = fs.mkdtempSync(path.join(os.tmpdir(), 'cbl-principal-'));
const area = { x: 0, y: 0, width: 1700, height: 1100 };
const app = Object.assign(new EventEmitter(), {
  requestSingleInstanceLock: () => true, whenReady: () => { ordenArranque.push('ready'); return Promise.resolve(); },
  getPath: () => datos, getVersion: () => '0.1.0', getLocale: () => 'es-MX',
  setPath(nombre, valor) { assert(['userData', 'sessionData'].includes(nombre)); assert.equal(valor, datos); }, quit() {},
});
let win, menu, privilegios, handler, filtrar, permisos, comprobarPermiso;
const externos = [];
const logros = [], ordenArranque = [];
class BrowserWindow extends EventEmitter {
  constructor(opciones) {
    super(); win = this; this.opciones = opciones; this.bounds = opciones;
    this.completa = opciones.fullscreen;
    this.webContents = Object.assign(new EventEmitter(), {
      mainFrame: { url: 'cbl://app/index.html' },
      setWindowOpenHandler(fn) { this.abrir = fn; },
    });
  }
  getBounds() { const { x, y, width, height } = this.bounds; return { x, y, width, height }; }
  getNormalBounds() { return this.getBounds(); }
  getSize() { return [this.bounds.width, this.bounds.height]; }
  getContentSize() { return [this.bounds.width - 16, this.bounds.height - 60]; }
  setBounds(bounds) { this.bounds = bounds; }
  isFullScreen() { return this.completa; }
  setFullScreen(valor) { this.completa = valor; this.emit(valor ? 'enter-full-screen' : 'leave-full-screen'); }
  isMaximized() { return false; }
  isMinimized() { return false; }
  show() { this.mostrada = true; }
  focus() { this.enfocada = true; }
  loadURL(url) { this.url = url; return Promise.resolve(); }
}
const Menu = {
  buildFromTemplate(plantilla) {
    const items = plantilla.flatMap(p => p.submenu);
    return { items, getMenuItemById: id => items.find(i => i.id === id) };
  },
  setApplicationMenu(valor) { menu = valor; },
};
const sesion = Object.assign(new EventEmitter(), {
  webRequest: { onBeforeRequest(fn) { filtrar = fn; } },
  setPermissionRequestHandler(fn) { permisos = fn; },
  setPermissionCheckHandler(fn) { comprobarPermiso = fn; },
});
const ipcMain = new EventEmitter();
try {
  vm.runInNewContext(fs.readFileSync(main, 'utf8'), {
    __dirname: path.dirname(fileURLToPath(main)), console, URL,
    process: { env: { CBL_DATOS: datos, CBL_OCULTA: '1' } },
    require(nombre) {
      if (nombre === './steam.cjs') return { crearSteam({ appId }) {
        assert.equal(appId, null);
        return {
          prepararSuperposicion(env) { assert.equal(env.CBL_OCULTA, '1'); ordenArranque.push('steam'); },
          desbloquear(id) { logros.push(id); },
        };
      } };
      if (nombre !== 'electron') return require(nombre);
      return { app, BrowserWindow, Menu, ipcMain, session: { defaultSession: sesion },
        screen: { getPrimaryDisplay: () => ({ workArea: area }), getDisplayMatching: () => ({ workArea: area }) },
        shell: { async openExternal(url) { externos.push(url); } },
        protocol: { registerSchemesAsPrivileged(v) { privilegios = v; }, handle(esquema, fn) { assert.equal(esquema, 'cbl'); handler = fn; } },
      };
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert(handler); assert.equal(privilegios[0].scheme, 'cbl');
  assert.deepEqual(Object.keys(privilegios[0].privileges).sort(), ['corsEnabled', 'secure', 'standard', 'stream', 'supportFetchAPI']);
  assert(Object.values(privilegios[0].privileges).every(Boolean));
  assert.equal(win.opciones.show, false); assert.equal(win.opciones.webPreferences.sandbox, true);
  assert.equal(win.opciones.webPreferences.contextIsolation, true); assert.equal(win.opciones.webPreferences.nodeIntegration, false);
  assert.equal(win.url, 'cbl://app/Prototypes/Rocket%20Launcher/index.html');
  for (const [url, cancel] of [['https://example.com', true], ['file:///etc/passwd', true], ['cbl://app/a.js', false], ['blob:cbl://app/id', false], ['data:text/plain,x', false]])
    filtrar({ url }, r => assert.equal(r.cancel, cancel));
  for (const [permiso, origen, valor] of [['fullscreen', 'cbl://app', true], ['fullscreen', 'https://example.com', false], ['media', 'cbl://app', false]]) {
    assert.equal(comprobarPermiso(null, permiso, origen), valor);
    permisos({ getURL: () => origen }, permiso, v => assert.equal(v, valor));
  }
  const evento = { sender: win.webContents, senderFrame: win.webContents.mainFrame };
  ipcMain.emit('cbl:logro', evento, 'CBL_PRUEBA_VICTORIA');
  ipcMain.emit('cbl:logro', evento, null);
  ipcMain.emit('cbl:logro', { sender: {}, senderFrame: win.webContents.mainFrame }, 'intruso');
  ipcMain.emit('cbl:logro', { sender: win.webContents, senderFrame: { url: 'cbl://app/index.html' } }, 'submarco');
  win.webContents.mainFrame.url = 'https://example.com';
  ipcMain.emit('cbl:logro', evento, 'otro-origen');
  win.webContents.mainFrame.url = 'cbl://app/index.html';
  assert.deepEqual(logros, ['CBL_PRUEBA_VICTORIA']);
  assert.deepEqual(ordenArranque, ['steam', 'ready']);
  ipcMain.emit('cbl:cargar', evento); assert.equal(evento.returnValue.version, '0.1.0');
  ipcMain.emit('cbl:cambiar', evento, 'escribir', 'cmg-banco03:reto', '1');
  ipcMain.emit('cbl:sesion', evento, 'escribir', '__proto__', 'RAM');
  ipcMain.emit('cbl:cargar', evento); assert.equal(evento.returnValue.sesion['__proto__'], 'RAM');
  app.emit('before-quit');
  const archivo = path.join(datos, 'guardado.json');
  assert.deepEqual(JSON.parse(fs.readFileSync(archivo, 'utf8')), { version: 1, almacen: { 'cmg-banco03:reto': '1' } });
  ipcMain.emit('cbl:cambiar', { sender: win.webContents, senderFrame: { url: 'https://example.com' } }, 'escribir', 'intruso', 'x');
  ipcMain.emit('cbl:cambiar', evento, 'escribir', 'ultima', 'texto'); app.emit('will-quit');
  assert.equal(JSON.parse(fs.readFileSync(archivo, 'utf8')).almacen.ultima, 'texto');
  assert.equal(JSON.parse(fs.readFileSync(archivo, 'utf8')).almacen.intruso, undefined);
  let detenida = false;
  win.webContents.emit('will-frame-navigate', { url: 'https://example.com', isMainFrame: true, preventDefault() { detenida = true; } });
  assert(detenida); assert.deepEqual(externos, ['https://example.com']);
  assert.equal(win.webContents.abrir({ url: 'file:///etc/passwd' }).action, 'deny');
  assert.equal(externos.length, 1);
  assert.equal(menu.getMenuItemById('resolucion').label, 'Resolución');
  win.webContents.emit('before-input-event', { preventDefault() {} }, { key: 'F11', type: 'keyDown' });
  assert(win.isFullScreen()); assert.equal(menu.getMenuItemById('resolucion').enabled, false);
  menu.getMenuItemById('completa').click(); assert.equal(win.isFullScreen(), false);
  menu.getMenuItemById('resolucion').submenu[2].click();
  assert(win.getBounds().width <= area.width && win.getBounds().height <= area.height);
  ipcMain.emit('cbl:cambiar', evento, 'escribir', 'cerrar', 'fin');
  win.emit('close');
  assert.equal(JSON.parse(fs.readFileSync(archivo, 'utf8')).almacen.cerrar, 'fin');
  const estado = JSON.parse(fs.readFileSync(path.join(datos, 'ventana.json'), 'utf8'));
  assert.equal(estado.completa, false); assert.equal(estado.width, win.getBounds().width);
  console.log('Principal emulado: privilegios, red, permisos Fullscreen, IPC, sesión RAM, tres volcados, F11, menú y ventana verificados sin Electron.');
} finally { fs.rmSync(datos, { recursive: true, force: true }); }
