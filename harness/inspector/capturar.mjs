#!/usr/bin/env node
// Captura cada bloque del manifiesto (mapa, código, misión…) en cada plataforma y rama, y mide dónde está cada elemento.
// Con BLOQUES=mapa,codigo solo captura esos.
// Uso: node harness/inspector/capturar.mjs --rama trunk=<dir> --rama campaign-nivel-1=<dir> [--salida <dir>] [--manifiesto <json>]
// <dir> es un checkout de la rama (p. ej. un git worktree). Sirve cada uno con un servidor estático propio.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const ramas = []; let salida = 'docs/pantallas/inspector/capturas'; let manifiesto = 'docs/pantallas/inspector/manifiesto.json';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--rama') { const [n, d] = args[++i].split('='); ramas.push({ nombre: n, dir: resolve(d) }); }
  else if (args[i] === '--salida') salida = args[++i];
  else if (args[i] === '--manifiesto') manifiesto = args[++i];
}
if (!ramas.length) { console.error('Falta al menos un --rama nombre=dir'); process.exit(2); }

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { const req = createRequire(import.meta.url); for (const p of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = req(p)); break; } catch {} } }
if (!chromium) { console.error('No se encontró Playwright.'); process.exit(2); }

const M = JSON.parse(readFileSync(manifiesto, 'utf8'));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const servir = dir => new Promise(ok => {
  const s = createServer((q, r) => {
    let f = join(dir, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!f.startsWith(dir) || !existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f));
  }).listen(0, () => ok(s));
});

// Lista plana de elementos de un bloque (une las listas que nombra).
const aplanar = (lista, out = []) => { for (const e of lista) { out.push({ id: e.id, sel: e.sel }); if (e.hijos) aplanar(e.hijos, out); } return out; };
const solo = process.env.BLOQUES ? process.env.BLOQUES.split(',') : null;

mkdirSync(salida, { recursive: true });
const resultado = { generado: new Date().toISOString(), ramas: {}, capturas: {} };
const navegador = await chromium.launch();
for (const rama of ramas) {
  let commit = '?'; try { commit = execFileSync('git', ['-C', rama.dir, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch {}
  resultado.ramas[rama.nombre] = { commit };
  const srv = await servir(rama.dir); const puerto = srv.address().port;
  for (const plat of M.plataformas) {
    const ctx = await navegador.newContext({ viewport: { width: plat.w, height: plat.h }, hasTouch: !!plat.tactil, isMobile: !!plat.tactil, deviceScaleFactor: 1, locale: 'es-ES' });
    for (const bl of M.bloques) {
      if (solo && !solo.includes(bl.id)) continue;
      const guardar = v => { ((resultado.capturas[bl.id] ??= {})[plat.id] ??= {})[rama.nombre] = v; };
      const elems = aplanar(bl.elementos.flatMap(n => M.elementos[n]));
      const page = await ctx.newPage(); const errores = [];
      page.on('pageerror', e => errores.push(e.message));
      const ruta = M.series[bl.serie];
      await page.goto(`http://localhost:${puerto}/${ruta.split('/').map(encodeURIComponent).join('/').replace(/%3F/, '?').replace(/%3D/g, '=')}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.waitForTimeout(2500);
      // Abrir el bloque como lo haría el jugador: panel, entrada del menú ⋯ y clics extra.
      const falta = await page.evaluate(async ({ panel, menu, clic }) => {
        const espera = ms => new Promise(r => setTimeout(r, ms));
        const visible = e => e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
        const b = document.getElementById(panel === 'mapa' ? 'b-ver-mapa' : 'b-ver-codigo');
        if (visible(b)) { b.click(); await espera(400); }
        if (menu) {
          // Primero el menú ⋯; si no se ve (PC con pestañas), la pestaña o el botón equivalente.
          const bm = document.getElementById('b-menu-cod');
          if (visible(bm)) {
            bm.click(); await espera(250);
            const it = document.querySelector(`[data-menu="${menu}"]`);
            const hay = [...document.querySelectorAll('[data-menu]')].map(x => x.textContent.trim()).filter(Boolean);
            if (!it) { bm.click(); return `El menú ⋯ no tiene esta entrada. Tiene: ${hay.join(', ')}.`; }
            it.click(); await espera(500);
          } else {
            const alt = [document.getElementById(`t-${menu}`), document.getElementById(`b-${menu}`)].find(visible);
            const tabs = [...document.querySelectorAll('#cabecera-editor .tabs .tab')].filter(visible).map(x => x.textContent.trim());
            if (!alt) return `Sin menú ⋯ y sin pestaña ni botón equivalente. Pestañas: ${tabs.join(', ') || 'ninguna'}.`;
            alt.click(); await espera(500);
          }
        }
        for (const s of clic || []) { const e = document.querySelector(s); if (!visible(e)) return `No se encontró ${s} para abrir el bloque.`; e.click(); await espera(500); }
        return null;
      }, { panel: bl.panel, menu: bl.menu || null, clic: bl.clic || null });
      await page.waitForTimeout(900);
      const medida = falta ? null : await page.evaluate(({ elems, raiz }) => {
        const R = document.querySelector(raiz);
        if (!R || !R.getClientRects().length) return { falta: `No se ve ${raiz}.` };
        const rr = R.getBoundingClientRect();
        // Base: el bloque recortado a la ventana.
        const L = Math.max(0, rr.left), T = Math.max(0, rr.top), Rt = Math.min(innerWidth, rr.right), B = Math.min(innerHeight, rr.bottom);
        if (Rt - L < 20 || B - T < 20) return { falta: `${raiz} queda fuera de la ventana.` };
        const base = { left: L, top: T, width: Rt - L, height: B - T };
        const existe = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
        const enVista = r => r.right > base.left && r.bottom > base.top && r.left < base.left + base.width && r.top < base.top + base.height;
        const cajas = {}, presentes = [], usados = new Map();
        for (const e of elems) {
          let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, hay = false;
          for (const s of e.sel) { let nodos = []; try { nodos = R.querySelectorAll(s); } catch {} for (const n of nodos) { if (!existe(n)) continue; hay = true; if (!usados.has(n)) usados.set(n, e.id); const r = n.getBoundingClientRect(); if (!enVista(r)) continue;
            x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top); x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom); } }
          if (hay) presentes.push(e.id);
          if (x2 > x1) { x1 = Math.max(x1, base.left); y1 = Math.max(y1, base.top); x2 = Math.min(x2, base.left + base.width); y2 = Math.min(y2, base.top + base.height);
            if (x2 - x1 > 1 && y2 - y1 > 1) cajas[e.id] = [x1 - base.left, y1 - base.top, x2 - x1, y2 - y1].map(Math.round); }
        }
        // Controles visibles que el manifiesto no describe.
        const sin = [];
        for (const n of R.querySelectorAll('button, select, a[href], input, textarea, [role="button"], [role="toolbar"]')) {
          if (!existe(n) || usados.has(n)) continue; const r = n.getBoundingClientRect(); if (!enVista(r)) continue;
          let en = null; for (let a = n.parentElement; a && !en; a = a.parentElement) en = usados.get(a) || null;
          const ref = n.tagName.toLowerCase() + (n.id ? '#' + n.id : n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '');
          sin.push({ ref, en, t: (n.getAttribute('aria-label') || n.dataset.tip || n.title || n.textContent || n.name || '').trim().replace(/\s+/g, ' ').slice(0, 60),
            caja: [Math.max(r.left, base.left) - base.left, Math.max(r.top, base.top) - base.top, Math.min(r.right, base.left + base.width) - Math.max(r.left, base.left), Math.min(r.bottom, base.top + base.height) - Math.max(r.top, base.top)].map(Math.round) });
        }
        return { cajas, presentes, sin, clip: { x: base.left + scrollX, y: base.top + scrollY, width: base.width, height: base.height } };
      }, { elems, raiz: bl.raiz });
      const motivo = falta || medida.falta;
      if (motivo) { guardar({ falta: motivo, errores }); console.log(`${rama.nombre} · ${plat.id} · ${bl.id}: no existe (${motivo})`); await page.close(); continue; }
      const nombre = `${bl.id}-${plat.id}-${rama.nombre}.jpg`;
      await page.screenshot({ path: join(salida, nombre), type: 'jpeg', quality: 70, clip: medida.clip });
      guardar({ img: nombre, w: Math.round(medida.clip.width), h: Math.round(medida.clip.height), cajas: medida.cajas, presentes: medida.presentes, sin: medida.sin, errores });
      console.log(`${rama.nombre} · ${plat.id} · ${bl.id}: ${medida.presentes.length} elementos (${Object.keys(medida.cajas).length} a la vista), ${medida.sin.length} sin describir${errores.length ? ', ' + errores.length + ' errores JS' : ''}`);
      await page.close();
    }
    await ctx.close();
  }
  srv.close();
}
await navegador.close();
writeFileSync(join(salida, 'capturas.json'), JSON.stringify(resultado, null, 1));
console.log(`Listo: ${join(salida, 'capturas.json')}`);
