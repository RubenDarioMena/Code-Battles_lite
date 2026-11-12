// Campaign en el navegador (Playwright): juega H0–H5 con los programas de referencia, Workers reales y turbo.
// Uso: python3 -m http.server 8771 --bind 127.0.0.1 &  ·  node pruebas/campaign-juego.cjs <carpeta de capturas> [escritorio|movil]
const { chromium } = require('playwright');
const SOL = require('./campaign-soluciones.cjs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const out = process.argv[2], forma = process.argv[3] || 'escritorio', leng = process.argv[4] || 'js';
  const vp = forma === 'movil' ? { width: 412, height: 880 } : { width: 1440, height: 860 };
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 500)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
  await p.goto(`http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?serie=campaign&forma=${forma}`); await p.waitForFunction(() => window.__juegoListo);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForFunction(() => window.__juegoListo);
  const poner = (id, texto) => p.evaluate(([id, texto]) => { const B = window.__banco; B.abrirPrograma(id); const c = document.getElementById('codigo'); c.value = texto; c.dispatchEvent(new Event('input', { bubbles: true })); }, [id, texto]);
  const hito = () => p.evaluate(() => window.__banco.mundo.hito);
  const estado = () => p.evaluate(() => { const m = window.__banco.mundo; return { hito: m.hito, t: +m.t.toFixed(1), fin: m.completado, banner: document.getElementById('banner').hidden ? null : document.getElementById('banner').innerText.slice(0, 160), activo: m.activo, ejec: window.cmg.ejecutando }; });
  await p.evaluate(() => window.__banco.turbo(12));
  const tiempos = [];
  for (let h = 0; h < 6; h++) {
    for (const [id, texto] of Object.entries(SOL[leng][h])) await poner(id, texto);
    const t0 = (await estado()).t;
    await p.evaluate(() => { if (!window.cmg.ejecutando) window.__banco.ejecutar(); });
    const e0 = await estado();
    if (!e0.ejec) { console.log('NO ARRANCA', h, e0, errs); break; }
    try { await p.waitForFunction((h) => { const m = window.__banco.mundo; return m.hito > h || m.completado || !window.cmg.ejecutando; }, h, { timeout: 240000 }); }
    catch (e) { console.log('TIMEOUT hito', h, await estado(), await p.evaluate(() => [...document.querySelectorAll('#consola .c')].slice(-6).map(x => x.innerText))); await p.screenshot({ path: `${out}/camp-timeout.png` }); break; }
    const e = await estado(); tiempos.push(+(e.t - t0).toFixed(0));
    if (!(e.hito > h || e.fin)) { console.log('PARADO sin hito', h, e, await p.evaluate(() => [...document.querySelectorAll('#consola .c')].slice(-6).map(x => x.innerText))); await p.screenshot({ path: `${out}/camp-parado.png` }); break; }
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${out}/camp-${forma}-h${h}.png` });
    if (h === 5) { await p.evaluate(() => document.querySelector('#banner .btn.primario').click()); await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/camp-${forma}-salva.png` }); }
    await p.evaluate(() => { if (window.cmg.ejecutando) window.cmg.alternarEjecucion(); document.getElementById('banner').hidden = true; });
  }
  console.log(forma, leng, 'tiempos', tiempos, 'estado', await estado(), 'checkpoints', await p.evaluate(() => window.__banco.checkpoints.map(c => c.hito)), 'errores', errs.slice(0, 5));
  await b.close();
})();
