// Capturas deterministas del campo (2D y 3D) para comparar dos versiones píxel a píxel (fase 2).
//   node herramientas/capturas-vista.mjs capturar <origen> <carpeta>
//   node herramientas/capturas-vista.mjs comparar <carpetaA> <carpetaB>
// Sirve cada versión en su puerto (p. ej. un `git worktree` del commit anterior en 8772 y la rama en 8771).
// War y Factory juegan su reto con semilla 7 hasta el final; Campaign se captura al empezar. Después se
// congelan performance.now y la marca de requestAnimationFrame y se captura el lienzo.
// Ruido conocido (también entre dos capturas de la misma versión): el brazo del robot de Factory 3D se
// suaviza con el reloj real, y los chips de texto sobre el lienzo pueden variar algún píxel.
import { chromium } from 'playwright';

/** Globales de la página del juego (solo dentro de page.evaluate). */
/** @type {any} */ let __banco;
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CASOS = [['war', '2d', true], ['war', '3d', true], ['factory', '2d', true], ['factory', '3d', true], ['campaign', '2d', false], ['campaign', '3d', false]];

async function capturar(origen, carpeta) {
  mkdirSync(carpeta, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [serie, vista, correr] of CASOS) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      await ctx.addInitScript(([serie, vista]) => {
        if (!sessionStorage.getItem('capturas')) { localStorage.clear(); sessionStorage.setItem('capturas', '1'); }
        localStorage.setItem('cmg-banco03:' + (serie === 'war' ? '' : serie + '-') + 'vista', JSON.stringify(vista));
      }, [serie, vista]);
      const page = await ctx.newPage();
      const errores = [];
      page.on('pageerror', e => errores.push(e.message));
      await page.goto(`${origen}/Prototypes/Rocket%20Launcher/index.html?serie=${serie}`);
      await page.waitForFunction(() => /** @type {any} */ (window).__juegoListo === true, null, { timeout: 30000 });
      if (correr) {
        await page.evaluate(() => { __banco.fijarSemilla(7); __banco.turbo(40); __banco.ejecutar(); });
        await page.waitForFunction(() => !!__banco.mundo.fin, null, { timeout: 120000 });
      }
      await page.evaluate(() => {
        performance.now = () => 123456;
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = cb => raf(() => cb(123456));
      });
      for (let i = 0; i < 9; i++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r(undefined))));
      await page.locator(vista === '3d' ? '#c3d' : '#c2d').screenshot({ path: join(carpeta, `${serie}-${vista}.png`) });
      console.log(`${serie} ${vista} · t=${await page.evaluate(() => __banco.mundo.t)} · errores de página: ${errores.length}${errores.length ? ` (${errores[0]})` : ''}`);
      await ctx.close();
    }
  } finally { await browser.close(); }
}

async function comparar(a, b) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let distintas = 0;
  try {
    for (const nombre of readdirSync(a).filter(n => n.endsWith('.png')).sort()) {
      const datos = [a, b].map(c => 'data:image/png;base64,' + readFileSync(join(c, nombre)).toString('base64'));
      const r = await page.evaluate(async ([x, y]) => {
        const leer = async src => { const i = new Image(); i.src = src; await i.decode(); const c = new OffscreenCanvas(i.width, i.height); const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
        const [p, q] = [await leer(x), await leer(y)];
        if (p.width !== q.width || p.height !== q.height) return { tamano: true };
        let n = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
        for (let k = 0; k < p.data.length; k += 4) if (p.data[k] !== q.data[k] || p.data[k + 1] !== q.data[k + 1] || p.data[k + 2] !== q.data[k + 2]) {
          n++; const px = (k / 4) % p.width, py = Math.floor(k / 4 / p.width);
          x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
        }
        return { n, caja: n ? [x0, y0, x1, y1] : null };
      }, datos);
      if (r.tamano) { distintas++; console.log(`${nombre}: tamaños distintos`); }
      else if (r.n) { distintas++; console.log(`${nombre}: ${r.n} píxeles distintos en ${r.caja.join(',')}`); }
      else console.log(`${nombre}: idéntica`);
    }
  } finally { await browser.close(); }
  return distintas;
}

const [orden, x, y] = process.argv.slice(2);
if (orden === 'capturar' && x && y) await capturar(x, y);
else if (orden === 'comparar' && x && y) await comparar(x, y);
else { console.error('Uso: node herramientas/capturas-vista.mjs capturar <origen> <carpeta> | comparar <carpetaA> <carpetaB>'); process.exitCode = 1; }
