// Fase 2: cambio 2D/3D en caliente, sin reiniciar la partida. Las vistas dibujan la escena del reglamento.
// Con el servidor dedicado 8771 activo: node pruebas/vista-caliente.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const origen = process.env.CBL_QA_ORIGIN || 'http://127.0.0.1:8771';
const DISPARO = 'while (true) {\n  const o = autoTarget("drone", "visual") || autoTarget("crawler", "visual");\n  if (o) regularShoot(o); else stopFire();\n  await esperar(0.3);\n}\n';

(async () => {
  const browser = await chromium.launch({ headless: true });
  let checks = 0;
  const ok = (v, m) => { assert.ok(v, m); checks++; };
  try {
    for (const serie of ['war', 'factory', 'campaign']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await ctx.addInitScript(() => localStorage.clear());
      const page = await ctx.newPage();
      const errores = []; page.on('pageerror', e => errores.push(e.message));
      await page.goto(`${origen}/Prototypes/Rocket%20Launcher/index.html?serie=${serie}`);
      await page.waitForFunction(() => window.__juegoListo === true, null, { timeout: 30000 });
      await page.evaluate(([serie, DISPARO]) => {
        if (serie === 'war') for (const l of __banco.mundo.lanzadores) __banco.programas[l.id] = DISPARO;
        __banco.turbo(4); __banco.ejecutar();
        window.__mundoInicial = __banco.mundo;
      }, [serie, DISPARO]);
      let t = await page.evaluate(() => __banco.mundo.t);
      for (const vista of ['2d', '3d', '2d', '3d']) {
        await page.click(`[data-vista="${vista}"]`);
        await page.waitForTimeout(350);
        const estado = await page.evaluate(() => ({ t: __banco.mundo.t, mismo: __banco.mundo === window.__mundoInicial, c3d: !document.getElementById('c3d').hidden, c2d: !document.getElementById('c2d').hidden, fin: __banco.mundo.fin }));
        ok(estado.mismo, `${serie} → ${vista}: el mismo mundo, sin reiniciar`);
        ok(estado.c3d === (vista === '3d') && estado.c2d === (vista === '2d'), `${serie} → ${vista}: se ve la vista elegida`);
        ok(estado.t >= t, `${serie} → ${vista}: el tiempo sigue (${t} → ${estado.t})`);
        t = estado.t;
      }
      ok(t > 0, `${serie}: la partida avanzó durante los cambios`);
      ok(!errores.length, `${serie}: sin errores de página ${errores[0] || ''}`);
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`Cambio 2D/3D en caliente: ${checks} comprobaciones en War, Factory y Campaign, sin reiniciar.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
