#!/usr/bin/env node
// Captura cada pantalla del manifiesto en cada plataforma y rama, y mide dónde está cada elemento.
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

// Lista plana con la ruta de padres de cada elemento.
const aplanar = (lista, padre = null, out = []) => { for (const e of lista) { out.push({ id: e.id, sel: e.sel, padre }); if (e.hijos) aplanar(e.hijos, e.id, out); } return out; };

mkdirSync(salida, { recursive: true });
const resultado = { generado: new Date().toISOString(), ramas: {}, capturas: {} };
const navegador = await chromium.launch();
for (const rama of ramas) {
  let commit = '?'; try { commit = execFileSync('git', ['-C', rama.dir, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch {}
  resultado.ramas[rama.nombre] = { commit };
  const srv = await servir(rama.dir); const puerto = srv.address().port;
  for (const pant of M.pantallas) {
    const ruta = typeof pant.ruta === 'string' ? pant.ruta : pant.ruta[rama.nombre];
    if (!ruta) continue;
    const elems = aplanar(M.elementos[pant.elementos]);
    for (const plat of M.plataformas) {
      const ctx = await navegador.newContext({ viewport: { width: plat.w, height: plat.h }, hasTouch: !!plat.tactil, isMobile: !!plat.tactil, deviceScaleFactor: 1, locale: 'es-ES' });
      const page = await ctx.newPage(); const errores = [];
      page.on('pageerror', e => errores.push(e.message));
      await page.goto(`http://localhost:${puerto}/${ruta.split('/').map(encodeURIComponent).join('/').replace(/%3F/, '?').replace(/%3D/g, '=')}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.waitForTimeout(2500);
      const medida = await page.evaluate(({ elems, raiz }) => {
        const R = raiz ? document.querySelector(raiz) : null;
        if (R) R.scrollIntoView({ block: 'start' });
        const base = R ? R.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
        const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
          return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 &&
            r.right > base.left && r.bottom > base.top && r.left < base.left + base.width && r.top < base.top + base.height; };
        const ambito = R || document;
        const cajas = {}; const usados = new Map();
        for (const e of elems) {
          let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
          for (const s of e.sel) for (const n of ambito.querySelectorAll(s)) { if (!vis(n)) continue; if (!usados.has(n)) usados.set(n, e.id); const r = n.getBoundingClientRect();
            x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top); x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom); }
          if (x2 > x1) { x1 = Math.max(x1, base.left); y1 = Math.max(y1, base.top); x2 = Math.min(x2, base.left + base.width); y2 = Math.min(y2, base.top + base.height);
            cajas[e.id] = [x1 - base.left, y1 - base.top, x2 - x1, y2 - y1].map(Math.round); }
        }
        // Controles visibles que el manifiesto no describe.
        const sin = [];
        for (const n of ambito.querySelectorAll('button, select, a[href], input, [role="button"], [role="toolbar"]')) {
          if (!vis(n) || usados.has(n)) continue;
          let en = null; for (let a = n.parentElement; a && !en; a = a.parentElement) en = usados.get(a) || null;
          const ref = n.tagName.toLowerCase() + (n.id ? '#' + n.id : n.classList.length ? '.' + [...n.classList].slice(0, 2).join('.') : '');
          const r = n.getBoundingClientRect();
          sin.push({ ref, en, t: (n.getAttribute('aria-label') || n.dataset.tip || n.title || n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
            caja: [r.left - base.left, r.top - base.top, r.width, r.height].map(Math.round) });
        }
        return { cajas, sin, clip: { x: base.left + scrollX, y: base.top + scrollY, width: Math.min(base.width, innerWidth), height: Math.min(base.height, innerHeight) } };
      }, { elems, raiz: pant.raiz || null });
      const nombre = `${pant.id}-${plat.id}-${rama.nombre}.jpg`;
      await page.screenshot({ path: join(salida, nombre), type: 'jpeg', quality: 72, clip: pant.raiz ? medida.clip : undefined, fullPage: false });
      ((resultado.capturas[pant.id] ??= {})[plat.id] ??= {})[rama.nombre] = { img: nombre, w: Math.round(medida.clip.width), h: Math.round(medida.clip.height), cajas: medida.cajas, sin: medida.sin, errores };
      console.log(`${rama.nombre} · ${pant.id} · ${plat.id}: ${Object.keys(medida.cajas).length} elementos, ${medida.sin.length} sin describir${errores.length ? ', ' + errores.length + ' errores JS' : ''}`);
      await ctx.close();
    }
  }
  srv.close();
}
await navegador.close();
writeFileSync(join(salida, 'capturas.json'), JSON.stringify(resultado, null, 1));
console.log(`Listo: ${join(salida, 'capturas.json')}`);
