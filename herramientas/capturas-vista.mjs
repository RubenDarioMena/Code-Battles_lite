// Capturas deterministas del campo (2D y 3D) para comparar dos versiones píxel a píxel (fase 2).
//   node herramientas/capturas-vista.mjs capturar <origen> <carpeta>
//   node herramientas/capturas-vista.mjs capturar <origen> <carpeta> --enemigos 2000
//   node herramientas/capturas-vista.mjs comparar <carpetaA> <carpetaB>
// Sirve cada versión en su puerto (p. ej. un `git worktree` del commit anterior en 8772 y la rama en 8771).
// War/Factory finales y Campaign inicial conservan las capturas anteriores. Se añaden
// war-combate-{2d,3d}.png: reto 3/semilla 7/paso 512 (25,6 s), pausa síncrona en alPaso.
// COMBATE fija paso y reloj visual; off=0 por la pausa, nueve rAF a la misma marca,
// fuentes listas y contexto nuevo por captura. Repetir con mismo navegador/GPU/fuentes.
// resumen.json e impresión incluyen calls/triangles del último render en War 3D.
// comparar recorre todos los PNG, incluidos los de combate. Factory mantiene el ruido
// histórico de suavizado de su brazo; la garantía de combate no depende de ese reloj.
import { chromium } from 'playwright';
import { COMBATE, prepararCombate, escenaCarga } from './capturas-combate.mjs';

/** Globales de la página del juego (solo dentro de page.evaluate). */
/** @type {any} */ let __banco;
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CASOS = [['war', '2d', true], ['war', '3d', true], ['factory', '2d', true], ['factory', '3d', true], ['campaign', '2d', false], ['campaign', '3d', false], ['war', '2d', 'combate'], ['war', '3d', 'combate']];

async function capturar(origen, carpeta, cantidad = 0) {
  mkdirSync(carpeta, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const resumen = [];
  try {
    const casos = cantidad ? [['war', '3d', 'combate']] : CASOS;
    for (const [serie, vista, correr] of casos) {
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
      await page.evaluate(() => document.fonts.ready);
      if (correr === 'combate') {
        // La función se evalúa con sus argumentos explícitos, igual que en la prueba Node.
        await page.evaluate(({ fuente, config }) => {
          const preparar = (0, eval)(`(${fuente})`); preparar(__banco, config);
        }, { fuente: prepararCombate.toString(), config: COMBATE });
        await page.waitForFunction(() => __banco.capturaLista === true, null, { timeout: 120000 });
        const paso = await page.evaluate(() => __banco.partida.pasoActual);
        if (paso !== COMBATE.paso) throw new Error(`Combate avanzó hasta ${paso}`);
      } else if (correr) {
        await page.evaluate(() => { __banco.fijarSemilla(7); __banco.turbo(40); __banco.ejecutar(); });
        await page.waitForFunction(() => !!__banco.mundo.fin, null, { timeout: 120000 });
      }
      await page.evaluate(() => {
        performance.now = () => 123456;
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = cb => raf(() => cb(123456));
      });
      for (let i = 0; i < 9; i++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r(undefined))));
      let carga = null;
      if (cantidad) {
        // Vacía el rAF ya pendiente y evita que el bucle normal sobrescriba la escena sintética.
        await page.evaluate(() => new Promise(resolve => {
          const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0;
          raf(() => resolve(undefined));
        }));
        carga = await page.evaluate(({ fuente, cantidad }) => {
          const crear = (0, eval)(`(${fuente})`), escena = crear(__banco.escenaVista, cantidad);
          __banco.dibujarCaptura(escena, 123456);
          return { enemigos: escena.enemigos.length, misiles: escena.misiles.length };
        }, { fuente: escenaCarga.toString(), cantidad });
      }
      const nombre = cantidad ? `war-carga-3d-${cantidad}` : `${serie}${correr === 'combate' ? '-combate' : ''}-${vista}`;
      const muestra = await page.evaluate(() => ({ paso: __banco.partida.pasoActual, t: __banco.mundo.t,
        enemigos: __banco.mundo.enemigos?.length ?? 0, misiles: __banco.mundo.misiles?.length ?? 0,
        dibujo: /** @type {any} */ (window).cmg.camara()?.dibujo }));
      resumen.push({ nombre, ...muestra, ...(carga ?? {}), errores });
      await page.locator(vista === '3d' ? '#c3d' : '#c2d').screenshot({ path: join(carpeta, `${nombre}.png`) });
      console.log(`${nombre} · paso=${muestra.paso} · t=${muestra.t} · dibujo=${JSON.stringify(muestra.dibujo)} · errores de página: ${errores.length}${errores.length ? ` (${errores[0]})` : ''}`);
      await ctx.close();
    }
    writeFileSync(join(carpeta, 'resumen.json'), JSON.stringify(resumen, null, 2) + '\n');
  } finally { await browser.close(); }
}

async function comparar(a, b) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let distintas = 0;
  try {
    const nombres = new Set([...readdirSync(a), ...readdirSync(b)].filter(n => n.endsWith('.png')));
    for (const nombre of [...nombres].sort()) {
      if (![a, b].every(c => existsSync(join(c, nombre)))) {
        distintas++; console.log(`${nombre}: falta en una carpeta`); continue;
      }
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

const [orden, x, y, opcion, valor] = process.argv.slice(2);
const cantidad = opcion === '--enemigos' ? Number(valor) : 0;
if (opcion && (opcion !== '--enemigos' || !Number.isSafeInteger(cantidad) || cantidad < 1)) throw new Error('Uso: --enemigos <entero positivo>');
if (orden === 'capturar' && x && y) await capturar(x, y, cantidad);
else if (orden === 'comparar' && x && y) process.exitCode = (await comparar(x, y)) ? 1 : 0;
else { console.error('Uso: node herramientas/capturas-vista.mjs capturar <origen> <carpeta> | comparar <carpetaA> <carpetaB>'); process.exitCode = 1; }
