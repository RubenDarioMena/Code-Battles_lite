// Importado únicamente después de validar --modo juego; nunca desde npm test.
import { _electron, chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resumirPagina } from './estadisticas.mjs';
const ejecutar = promisify(execFile);

export async function memoriaProcesos(app, sesion) {
  if (app) return app.evaluate(({ app }) => app.getAppMetrics().map(p => ({
    pid: p.pid, tipo: p.type, rssBytes: p.memory.workingSetSize * 1024,
    picoBytes: p.memory.peakWorkingSetSize * 1024,
  })));
  const { processInfo } = await sesion.send('SystemInfo.getProcessInfo');
  const pids = processInfo.map(p => p.id);
  if (process.platform === 'win32') {
    const { stdout } = await ejecutar('powershell.exe', ['-NoProfile', '-Command',
      `Get-Process -Id ${pids.join(',')} | Select-Object Id,WorkingSet64 | ConvertTo-Json -Compress`]);
    const datos = JSON.parse(stdout);
    return [datos].flat().map(p => ({ pid: p.Id, tipo: processInfo.find(q => q.id === p.Id)?.type, rssBytes: p.WorkingSet64 }));
  }
  const { stdout } = await ejecutar('ps', ['-o', 'pid=,rss=', '-p', pids.join(',')]);
  return stdout.trim().split('\n').filter(Boolean).map(linea => {
    const [pid, kib] = linea.trim().split(/\s+/).map(Number);
    return { pid, tipo: processInfo.find(p => p.id === pid)?.type, rssBytes: kib * 1024 };
  });
}

export async function medirNavegador(o, guardar) {
  const raiz = fileURLToPath(new URL('../../', import.meta.url));
  const datos = await mkdtemp(path.join(tmpdir(), 'cbl-unidades-'));
  let app, browser, context, page, sesion;
  const resultados = [], errores = [];
  try {
    if (o.origen) {
      browser = await chromium.launch({ headless: false });
      context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
      page = await context.newPage(); sesion = await browser.newBrowserCDPSession();
    } else {
      /** @type {NodeJS.ProcessEnv} */
      const env = { ...process.env, CBL_DATOS: datos, CBL_STEAM_APPID: '0', CBL_OCULTA: '0' };
      delete env.ELECTRON_RUN_AS_NODE;
      app = await _electron.launch({ args: [raiz], cwd: raiz, env, timeout: 45000 });
      page = await app.firstWindow();
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1280, 720); w.show(); w.focus();
      });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
    }
    page.on('pageerror', error => errores.push(error.message));
    const version = browser ? browser.version() : await app.evaluate(() => process.versions);
    for (const serie of o.series) for (const unidades of o.unidades) for (const vista of o.vistas) {
      errores.length = 0;
      await page.goto(`${o.origen || 'cbl://app'}/Prototypes/Rocket%20Launcher/index.html?serie=${serie}&vfx=alto`);
      await page.waitForFunction(() => window.__juegoListo === true, null, { timeout: 45000 });
      console.log(`${serie}/${unidades}/${vista}: ${o.segundos} s reales a 1×`);
      const memoria = [], fallosMemoria = [];
      let ocupado = false;
      const tomar = async () => {
        if (ocupado) return;
        ocupado = true;
        try { memoria.push({ ms: performance.now(), procesos: await memoriaProcesos(app, sesion) }); }
        catch (e) { fallosMemoria.push(e.message); }
        finally { ocupado = false; }
      };
      await tomar();
      const reloj = setInterval(() => { void tomar(); }, 1000);
      let r;
      try {
        r = await page.evaluate(async opciones => {
          const modulo = await import(new URL('/herramientas/medir-unidades/en-juego.mjs', location.href).href);
          return modulo.medirEnJuego(opciones);
        }, { serie, unidades, vista, segundos: o.segundos, semilla: o.semilla });
      } finally { clearInterval(reloj); }
      await tomar();
      const resumen = resumirPagina(r);
      const fila = { serie, unidades, vista, semilla: o.semilla, ...resumen,
        cumple: resumen.cumple && !resumen.error && !errores.length && r.duracionMs >= o.segundos * 1000,
        memoria: { muestras: memoria, fallos: fallosMemoria,
          rssSumaMaxBytes: memoria.length ? Math.max(...memoria.map(m => m.procesos.reduce((a, p) => a + p.rssBytes, 0))) : null },
        errores: [...errores], datos: r };
      resultados.push(fila);
      await guardar({ backend: o.origen ? 'chromium' : 'electron', version, resultados });
      if (fila.error || errores.length) throw Error(`Caso inválido: ${JSON.stringify(fila.error || errores)}`);
    }
    return resultados;
  } finally {
    try { await app?.close(); await context?.close(); await browser?.close(); }
    finally { await rm(datos, { recursive: true, force: true }); }
  }
}
