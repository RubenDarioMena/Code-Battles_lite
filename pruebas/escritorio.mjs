// Ejecuta el autor: Electron real, sin añadirlo a test:navegador.
// No abre Chromium aparte ni usa red: contrasta War con la referencia de la web.
import assert from 'node:assert/strict';
import { _electron } from 'playwright';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const entrada = 'cbl://app/Prototypes/Rocket%20Launcher/index.html';
const datos = await mkdtemp(path.join(tmpdir(), 'cbl-electron-'));
const errores = [], salidas = [];
let app;
const esperarListo = page => page.waitForFunction(() => window.__juegoListo === true, null, { timeout: 45000 });

async function abrir() {
  const env = { ...process.env, CBL_DATOS: datos, CBL_OCULTA: '1' };
  delete env.ELECTRON_RUN_AS_NODE;
  // Fuerza la integración inactiva incluso si el autor ya configuró steam.json.
  env.CBL_STEAM_APPID = '0';
  app = await _electron.launch({ args: [raiz], cwd: raiz, env, chromiumSandbox: true, timeout: 45000 });
  await app.evaluate(() => {
    globalThis.__erroresPrincipal = [];
    const original = console.error;
    console.error = (...args) => {
      globalThis.__erroresPrincipal.push(args.map(String).join(' ')); original(...args);
    };
  });
  const page = await app.firstWindow();
  page.on('pageerror', e => errores.push(e.message));
  app.context().on('request', peticion => {
    if (!/^(?:cbl:|blob:|data:)/.test(peticion.url())) salidas.push(peticion.url());
  });
  await esperarListo(page);
  // Repetir la carga bajo los observadores, incluidos los scripts iniciales.
  await page.reload(); await esperarListo(page);
  assert.equal(await page.evaluate(() => window.cblCascara.nombre), 'escritorio');
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  assert.equal(await page.evaluate(() => {
    const logros = window.cblCascara.plataforma.logros;
    logros.desbloquear('CBL_PRUEBA_VICTORIA');
    return typeof logros.desbloquear;
  }), 'function');
  const seguridad = await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0], p = w.webContents.getLastWebPreferences();
    return { aislado: p.contextIsolation, sandbox: p.sandbox, node: p.nodeIntegration, visible: w.isVisible() };
  });
  assert.deepEqual(seguridad, { aislado: true, sandbox: true, node: false, visible: false });
  return page;
}

async function cerrar() {
  if (!app) return;
  const erroresPrincipal = await app.evaluate(() => globalThis.__erroresPrincipal);
  await app.close(); app = null;
  assert.deepEqual(erroresPrincipal, [], 'sin errores del principal, incluido el IPC de logros');
}

try {
  let page = await abrir();
  for (const serie of ['war', 'factory', 'campaign']) {
    await page.goto(`${entrada}?serie=${serie}`); await esperarListo(page);
    assert.equal(await page.evaluate(() => window.cmg.serie), serie);
    assert.equal(await page.evaluate(() => window.cblCascara.nombre), 'escritorio');
  }
  await page.goto(entrada); await esperarListo(page);
  await page.evaluate(() => window.__banco.elegirReto(1));
  await page.locator('[data-vista="2d"]:visible').first().click();
  const esperado = await page.evaluate(() => ({
    reto: window.cblCascara.plataforma.almacen.leer('cmg-banco03:reto'),
    vista: window.cblCascara.plataforma.almacen.leer('cmg-banco03:vista'),
  }));
  assert.deepEqual(esperado, { reto: '1', vista: '"2d"' });
  await page.evaluate(() => window.cblCascara.plataforma.sesion.escribir('qa', 'temporal'));
  await page.reload(); await esperarListo(page);
  assert.equal(await page.evaluate(() => window.cblCascara.plataforma.sesion.leer('qa')), 'temporal');
  await cerrar();
  const guardado = JSON.parse(await readFile(path.join(datos, 'guardado.json'), 'utf8'));
  assert.equal(guardado.version, 1);
  assert.equal(guardado.almacen['cmg-banco03:reto'], esperado.reto);
  assert.equal(guardado.almacen['cmg-banco03:vista'], esperado.vista);
  assert(Object.values(guardado.almacen).every(v => typeof v === 'string'));
  assert(!Object.hasOwn(guardado.almacen, 'qa'));
  page = await abrir();
  assert.deepEqual(await page.evaluate(() => ({
    reto: window.__banco.def.titulo, plano: !document.getElementById('c2d').hidden,
    retoGuardado: window.cblCascara.plataforma.almacen.leer('cmg-banco03:reto'),
    sesion: window.cblCascara.plataforma.sesion.leer('qa'),
  })), { reto: await page.evaluate(() => window.__banco.RETOS[1].titulo), plano: true, retoGuardado: '1', sesion: null });

  for (const url of ['cbl://app/../package.json', 'cbl://app/%2e%2e/package.json',
    'cbl://app/%2e%2e/%2e%2e/fuera.txt', 'cbl://app/x%5c..%5cpackage.json'])
    assert.equal(await page.evaluate(async url => (await fetch(url)).status, url), 404, url);
  assert.deepEqual(salidas, [], 'ninguna petición remota durante el arranque/uso');

  // Evita abrir el navegador del autor; conserva la política de navegación real.
  await app.evaluate(({ shell }) => {
    globalThis.__externos = [];
    shell.openExternal = async url => { globalThis.__externos.push(url); };
  });
  await page.evaluate(() => { location.href = 'https://example.com'; });
  await page.waitForTimeout(150);
  assert(page.url().startsWith(entrada));
  assert.deepEqual(await app.evaluate(() => globalThis.__externos), ['https://example.com/']);
  assert.equal(await page.evaluate(() => window.open('https://example.com/ventana') === null), true);
  await page.waitForTimeout(100); assert.equal(app.windows().length, 1);
  // Peticiones de recurso remotas, también desde Workers, deben fallar.
  assert.equal(await page.evaluate(async () => {
    try { await fetch('https://example.com/recurso'); return false; } catch { return true; }
  }), true);

  const preferencias = await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu().getMenuItemById('resolucion').submenu.items.map(i => i.label));
  assert.deepEqual(preferencias, ['1280×720', '1600×900', '1920×1080']);
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById('resolucion').submenu.items[0].click());
  const geometria = await app.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return { bounds: w.getBounds(), area: screen.getDisplayMatching(w.getBounds()).workArea };
  });
  assert(geometria.bounds.width <= geometria.area.width && geometria.bounds.height <= geometria.area.height);

  // La referencia War 2/7 fue contrastada con la web (Workers reales) en fase 2.
  const referencia = JSON.parse(await readFile(new URL('./referencias/partidas.json', import.meta.url), 'utf8'))
    .casos.find(c => c.id === 'war-2-7');
  await page.evaluate(() => {
    const B = window.__banco;
    B.elegirReto(1); B.fijarSemilla(7); B.turbo(30);
    for (const unidad of B.mundo.programables) {
      B.programas[unidad.id] = (B.def.inicial[unidad.id] || []).join('\n');
      delete B.fuentes[unidad.id];
    }
    B.abrirPrograma(B.mundo.programables[0].id); B.ejecutar();
  });
  await page.waitForFunction(() => !!window.__banco.fin, null, { timeout: 60000 });
  const final = await page.evaluate(() => ({ fin: window.__banco.fin, t: window.__banco.mundo.t, disparos: window.__banco.mundo.consumidos }));
  assert(final.disparos > 0, 'el programa disparó');
  assert.equal(final.fin, referencia.resultado.fin); assert.equal(final.t, referencia.resultado.t);

  // War 2/7 de referencia pierde. Su programa en bucle sí gana el reto 1:
  // verificado también sin pantalla (semilla 7, victoria a 35,9 s).
  await page.evaluate(() => {
    const B = window.__banco, programa = B.RETOS[1].inicial['LAU-01'].join('\n');
    B.elegirReto(0); B.fijarSemilla(7); B.turbo(30);
    B.programas['LAU-01'] = programa; delete B.fuentes['LAU-01'];
    B.abrirPrograma('LAU-01'); B.ejecutar();
  });
  await page.waitForFunction(() => !!window.__banco.fin, null, { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.__banco.fin), 'victoria', 'el camino del logro al ganar no interrumpe el juego');
  assert.deepEqual(errores, [], 'sin errores de página en las tres series');
  await cerrar();

  await writeFile(path.join(datos, 'guardado.json'), '{dañado', 'utf8');
  page = await abrir();
  const apartado = (await readdir(datos)).find(n => n.startsWith('guardado.json.danado-'));
  assert(apartado); assert.equal(await readFile(path.join(datos, apartado), 'utf8'), '{dañado');
  assert.deepEqual(errores, []);
  await cerrar();
  console.log('Electron: 3 series, sandbox, disco/reapertura/dañados, protocolo, red/navegación, menú, War 2/7 de referencia y victoria War 1 con logros inactivos.');
} finally { await cerrar(); await rm(datos, { recursive: true, force: true }); }
