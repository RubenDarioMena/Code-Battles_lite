#!/usr/bin/env node
// Genera el inspector de bloques (HTML autocontenido) a partir del manifiesto y de las capturas.
// Uso: node harness/inspector/generar.mjs --capturas <dir> --salida <archivo.html> [--en <pagina.html>] [--manifiesto <json>] [--primera <rama>]
// Con --en, inserta el inspector al principio del <main> de esa página; sin él, genera una página propia.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2); const op = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const dirCap = op('--capturas'), salida = op('--salida'), en = op('--en'), manifiesto = op('--manifiesto') || 'docs/pantallas/inspector/manifiesto.json';
if (!dirCap || !salida) { console.error('Uso: generar.mjs --capturas <dir> --salida <html> [--en <pagina.html>]'); process.exit(2); }
const aqui = dirname(fileURLToPath(import.meta.url));
const M = JSON.parse(readFileSync(manifiesto, 'utf8')), C = JSON.parse(readFileSync(join(dirCap, 'capturas.json'), 'utf8'));

const imagenes = {};
for (const p of Object.values(C.capturas)) for (const pl of Object.values(p)) for (const r of Object.values(pl)) if (r.img)
  imagenes[r.img] = 'data:image/jpeg;base64,' + readFileSync(join(dirCap, r.img)).toString('base64');
// --primera <rama>: la que se ve al abrir (por defecto, la primera capturada).
const primera = op('--primera'); const ramas = primera && C.ramas[primera] ? { [primera]: C.ramas[primera], ...C.ramas } : C.ramas;
const datos = { ramas, generado: C.generado, plataformas: M.plataformas, bloques: M.bloques.filter(b => C.capturas[b.id]).map(({ id, titulo, grupo, que, elementos }) => ({ id, titulo, grupo, que, elementos })), elementos: M.elementos, capturas: C.capturas, imagenes };
const json = JSON.stringify(datos).replace(/</g, '\\u003c');
const fecha = C.generado.slice(0, 10);
const icono = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4l7 17 2.5-7.5L21 11z"/></svg>';
const seccion = `<section id="insp" aria-label="Inspector de bloques">
<style>${readFileSync(join(aqui, 'inspector.css'), 'utf8')}</style>
<div class="i-barra">
  <div class="i-titulo"><h2>Inspector de bloques</h2><p>Cada bloque es una parte funcional del juego (mapa, código, misión…). Pasa el cursor (o toca) sobre la captura o sobre la lista. Capturas automáticas del HTML real · ${fecha}.</p></div>
  <label class="i-campo">Bloque<select id="insp-pant"></select></label>
  <div class="i-campo" style="display:flex;flex-direction:column;gap:.2rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--tenue)">Plataforma<div class="i-seg" id="insp-plat" role="group" aria-label="Plataforma"></div></div>
  <label class="i-campo">Rama<select id="insp-rama"></select></label>
  <button type="button" class="i-btn" id="insp-inspeccionar" aria-pressed="true" title="Seleccionar un elemento para inspeccionarlo">${icono}Inspeccionar</button>
  <button type="button" class="i-btn" id="insp-comparar" aria-pressed="false"><span>Comparar</span></button>
</div>
<div class="i-cuerpo">
  <div class="i-pantallas">
    <figure class="i-p" data-lado="a"><div class="i-lienzo"></div><figcaption></figcaption></figure>
    <figure class="i-p" data-lado="b" hidden><div class="i-lienzo"></div><figcaption></figcaption></figure>
  </div>
  <aside class="i-lista" aria-label="Elementos del bloque"><div class="i-bloque"></div><div class="i-leyenda"></div><ul class="i-arbol"></ul></aside>
</div>
<p class="i-nota i-errores"></p>
<p class="i-nota">Los nombres y descripciones salen de <code>docs/pantallas/inspector/manifiesto.json</code>; la presencia de cada elemento la mide <code>harness/inspector/capturar.mjs</code> en el navegador. «Sin describir» = controles visibles que el manifiesto aún no nombra. «Fuera de la vista» = el elemento existe, pero hay que desplazar el bloque para verlo.</p>
<script>window.INSP=${json};</script>
<script>${readFileSync(join(aqui, 'inspector.js'), 'utf8')}</script>
</section>`;

let html;
if (en) {
  const base = readFileSync(en, 'utf8'); const cuerpo = base.search(/<body[\s>]/); const i = cuerpo < 0 ? -1 : cuerpo + base.slice(cuerpo).search(/<main[\s>]/);
  if (cuerpo < 0 || i < cuerpo) { console.error('La página no tiene <main>.'); process.exit(2); }
  const fin = base.indexOf('>', i) + 1; html = base.slice(0, fin) + '\n' + seccion + '\n' + base.slice(fin);
} else {
  html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inspector de bloques</title>
<style>:root{color-scheme:light dark;--surface:#121614;--border:#2a302d;--text:#e6ebe8;--text-dim:#919d97}body{margin:0;padding:16px;background:#0b0d0c;color:var(--text);font-family:system-ui,sans-serif}
@media (prefers-color-scheme:light){:root{--surface:#fff;--border:#dfe3e0;--text:#121614;--text-dim:#545e59}body{background:#f4f5f3}}</style></head><body><main>${seccion}</main></body></html>`;
}
writeFileSync(salida, html);
console.log(`${salida}: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
