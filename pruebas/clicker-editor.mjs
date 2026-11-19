// Random clicker del editor (QA nivel 1 · harness v1). Gratis: no usa modelos.
// Hace clics, teclea y pulsa atajos al azar en paquetes/editor/demo/demo.html con una semilla fija,
// y comprueba invariantes después de cada paso. La misma semilla repite los mismos pasos.
//
// Uso (CLI, necesita el paquete `playwright` disponible para Node):
//   node pruebas/clicker-editor.mjs [--semilla texto] [--pasos 200] [--forma escritorio|movil|ambas]
//                                   [--origen http://127.0.0.1:8771] [--salida carpeta]
// Si no hay servidor en el origen, arranca `python3 -m http.server 8771` en la raíz y lo cierra al final.
// Uso como función (por ejemplo desde ego-browser): import { clicker } from './clicker-editor.mjs'.
//
// Spec de la pantalla: docs/pantallas/editor.md (sección «Método de QA»).

import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TECLAS = ['a', 'x', '1', '(', ')', '{', '}', '"', ';', ' ', 'Enter', 'Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
const ATAJOS = ['Control+z', 'Control+y', 'Control+Shift+z', 'Control+a', 'Control+Alt+a', 'Escape', 'Control+d'];
const TEXTOS = ['if (x > 1) {', 'for (const v of l) ', 'print("á 😀")', 'def f(n):', '  return n', '}', '// nota'];

function generador(semilla) {
  let s = 2166136261;
  for (const c of String(semilla)) s = Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0;
  s = s || 1;
  return n => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return Math.floor(s / 4294967296 * n); };
}

// Lee el estado observable y las invariantes. Se ejecuta dentro de la página.
function leerEstado() {
  const raices = ['#demo-uno', '#demo-dos'];
  const editores = (window.demoEditores || []).map((e, i) => {
    let doc = null, error = null;
    try { doc = e.documento(); } catch (err) { error = String(err && err.message || err); }
    return {
      i, error,
      revision: doc?.revision ?? null,
      id: doc?.id ?? null,
      longitud: typeof doc?.texto === 'string' ? doc.texto.length : null,
      superficies: document.querySelectorAll(raices[i] + ' .cm-content').length,
    };
  });
  return {
    editores,
    desbordeX: document.documentElement.scrollWidth - window.innerWidth,
  };
}

function objetivos() {
  // Controles visibles y habilitados dentro de las tarjetas. Los enlaces se excluyen: sacarían de la página.
  // Si hay un diálogo abierto (modal o flotante), una persona tocaría lo que está dentro o lo cerraría.
  document.querySelectorAll('[data-clicker-id]').forEach(n => delete n.dataset.clickerId);
  const sel = 'button, select, input[type="checkbox"], input[type="range"], .cm-content, [role="button"], [data-ficha], .orden-btn';
  const modal = [...document.querySelectorAll('dialog[open]')].filter(d => d.getClientRects().length && d.querySelector(sel)).pop(); // el de encima
  const candidatos = modal ? modal.querySelectorAll(sel) : document.querySelectorAll('[data-demo] ' + sel.split(', ').join(', [data-demo] '));
  const visibles = [...candidatos]
    .filter(n => !n.closest('a[href]') && !n.disabled && n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden');
  return visibles.map((n, k) => {
    n.dataset.clickerId = String(k);
    const etiqueta = n.getAttribute('aria-label') || n.dataset.editor || n.dataset.accion || n.textContent.trim().slice(0, 24) || n.tagName;
    return { k, tag: n.tagName.toLowerCase(), tipo: n.type || '', etiqueta, cm: n.classList.contains('cm-content'),
      demo: n.closest('[data-demo]')?.dataset.demo, opciones: n.tagName === 'SELECT' ? [...n.options].map(o => o.value) : null };
  });
}

export async function clicker(page, opciones = {}) {
  const { semilla = 'clicker-v1', pasos = 200, origen = 'http://127.0.0.1:8771', forma = 'escritorio', alCaptura } = opciones;
  const azar = generador(semilla + ':' + forma);
  const errores = [], fallos = [], registro = [];
  page.on('pageerror', e => errores.push({ tipo: 'pageerror', mensaje: String(e.message || e) }));
  page.on('console', m => { if (m.type() === 'error') errores.push({ tipo: 'console', mensaje: m.text() }); });

  await page.goto(origen + '/paquetes/editor/demo/demo.html');
  await page.waitForFunction(() => window.demoEditores?.length === 2, null, { timeout: 15000 });
  let anterior = await page.evaluate(leerEstado);

  for (let paso = 1; paso <= pasos; paso++) {
    const lista = await page.evaluate(objetivos);
    if (!lista.length) { fallos.push({ paso, invariante: 'sin-controles', detalle: 'No quedan controles visibles' }); break; }
    const o = lista[azar(lista.length)];
    const loc = page.locator(`[data-clicker-id="${o.k}"]`);
    let accion = '';
    const erroresAntes = errores.length;
    try {
      if (o.tag === 'select' && o.opciones?.length) {
        const v = o.opciones[azar(o.opciones.length)];
        accion = `elegir ${v} en «${o.etiqueta}»`;
        await loc.selectOption(v, { timeout: 2000 });
      } else if (o.cm) {
        await loc.click({ timeout: 2000 });
        const r = azar(10);
        if (r < 5) { const t = TECLAS[azar(TECLAS.length)]; accion = `tecla ${t}`; await page.keyboard.press(t); }
        else if (r < 8) { const t = TEXTOS[azar(TEXTOS.length)]; accion = `escribir «${t}»`; await page.keyboard.type(t); }
        else { const t = ATAJOS[azar(ATAJOS.length)]; accion = `atajo ${t}`; await page.keyboard.press(t); }
        accion = `editor ${o.demo}: ${accion}`;
      } else {
        accion = `clic «${o.etiqueta}» (${o.tag})`;
        await loc.click({ timeout: 2000 });
      }
    } catch (err) {
      // Un control que desaparece o queda tapado no es un bug por sí mismo: se registra y se sigue.
      const lineas = String(err.message).split('\n');
      const motivo = lineas.find(l => /intercepts pointer|not visible|not stable|not enabled|detached/.test(l)) || lineas[0];
      registro.push({ paso, accion: accion || `clic «${o.etiqueta}» (${o.tag})`, omitido: motivo.trim().slice(0, 160) });
      // Tras varios omitidos seguidos suele haber un menú o capa abierta: Escape la cierra, como haría una persona.
      if (registro.slice(-3).every(r => r.omitido)) await page.keyboard.press('Escape').catch(() => {});
      continue;
    }
    await page.waitForTimeout(30);
    const estado = await page.evaluate(leerEstado);
    const recreado = /Recrear/i.test(o.etiqueta);
    const nuevos = [];
    for (const e of errores.slice(erroresAntes)) nuevos.push({ invariante: 'sin-errores-js', detalle: `${e.tipo}: ${e.mensaje}` });
    for (const e of estado.editores) {
      const prev = anterior.editores[e.i];
      if (e.error) nuevos.push({ invariante: 'documento-legible', detalle: `editor ${e.i}: ${e.error}` });
      if (e.superficies !== 1) nuevos.push({ invariante: 'una-superficie', detalle: `editor ${e.i}: ${e.superficies} .cm-content` });
      if (!recreado && prev && prev.revision != null && e.revision != null && e.revision < prev.revision)
        nuevos.push({ invariante: 'revision-no-baja', detalle: `editor ${e.i}: ${prev.revision} → ${e.revision}` });
    }
    if (estado.desbordeX > 1) nuevos.push({ invariante: 'sin-scroll-horizontal', detalle: `${estado.desbordeX}px de más` });
    registro.push({ paso, accion, fallos: nuevos.length });
    for (const f of nuevos) {
      const repetido = fallos.some(x => x.invariante === f.invariante && x.detalle === f.detalle);
      if (repetido) continue;
      const fallo = { paso, accion, ...f, captura: null };
      if (alCaptura && fallos.length < 10) fallo.captura = await alCaptura(page, `${forma}-paso-${paso}.png`);
      fallos.push(fallo);
    }
    anterior = estado;
  }
  return { semilla, forma, pasos, fallos, registro, omitidos: registro.filter(r => r.omitido).length };
}

function html(resultados, meta) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bloques = resultados.map(r => `
  <section><h2>${esc(r.forma)} · ${r.fallos.length} fallo(s) · ${r.omitidos} paso(s) omitido(s)</h2>
  ${r.fallos.length ? `<table><tr><th>Paso</th><th>Invariante</th><th>Detalle</th><th>Acción</th><th>Captura</th></tr>
  ${r.fallos.map(f => `<tr><td>${f.paso}</td><td><code>${esc(f.invariante)}</code></td><td>${esc(f.detalle)}</td><td>${esc(f.accion)}</td><td>${f.captura ? `<a href="${esc(f.captura)}">ver</a>` : ''}</td></tr>`).join('')}
  </table>` : '<p class="ok">Sin fallos en esta forma.</p>'}
  <details><summary>Registro de pasos</summary><ol>${r.registro.map(p => `<li value="${p.paso}">${esc(p.accion)}${p.omitido ? ' <em>(omitido)</em>' : ''}${p.fallos ? ' <strong>⚠</strong>' : ''}</li>`).join('')}</ol></details>
  </section>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Clicker del editor</title><style>
:root{--fondo:#fafaf8;--texto:#1d1d1b;--suave:#66645e;--borde:#ddd9d0;--ok:#1f7a4a;--mal:#b3261e}
@media (prefers-color-scheme: dark){:root{--fondo:#171716;--texto:#ecebe6;--suave:#a5a39b;--borde:#3a3935;--ok:#6fcf97;--mal:#f28b82}}
body{background:var(--fondo);color:var(--texto);font:15px/1.5 system-ui,sans-serif;margin:0 auto;max-width:980px;padding:24px 16px}
h1{margin:0 0 4px}.meta{color:var(--suave)}table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}
td,th{border-bottom:1px solid var(--borde);padding:6px 8px;text-align:left;vertical-align:top}.ok{color:var(--ok)}
h2{border-top:1px solid var(--borde);padding-top:16px}code{font-size:13px}strong{color:var(--mal)}
</style></head><body><h1>Clicker del editor</h1>
<p class="meta">Semilla <code>${esc(meta.semilla)}</code> · ${meta.pasos} pasos por forma · commit <code>${esc(meta.commit)}</code> · ${esc(meta.fecha)}</p>
<p class="meta">Repetir: <code>node pruebas/clicker-editor.mjs --semilla ${esc(meta.semilla)} --pasos ${meta.pasos} --forma ${esc(meta.formaArg)}</code></p>
${bloques}</body></html>`;
}

async function servidorActivo(origen) {
  try { const r = await fetch(origen + '/paquetes/editor/demo/demo.html'); return r.ok; } catch { return false; }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(p => { const [k, ...v] = p.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
  const semilla = args.semilla || 'clicker-v1';
  const pasos = Number(args.pasos || 200);
  const origen = args.origen || 'http://127.0.0.1:8771';
  const formaArg = args.forma || 'ambas';
  const formas = formaArg === 'ambas' ? ['escritorio', 'movil'] : [formaArg];
  const fecha = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const salida = resolve(args.salida || join(RAIZ, 'docs/qa/clicker', `${fecha}-${semilla}`));
  await mkdir(salida, { recursive: true });

  let servidor = null;
  if (!await servidorActivo(origen)) {
    const puerto = new URL(origen).port || '8771';
    servidor = spawn('python3', ['-m', 'http.server', puerto, '--bind', '127.0.0.1'], { cwd: RAIZ, stdio: 'ignore' });
    for (let i = 0; i < 50 && !await servidorActivo(origen); i++) await new Promise(r => setTimeout(r, 100));
  }

  let commit = 'desconocido';
  try { const { execSync } = await import('node:child_process'); commit = execSync('git rev-parse --short HEAD', { cwd: RAIZ }).toString().trim(); } catch {}

  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch {
    // Instalación global: la resolución CommonJS sí mira NODE_PATH y las carpetas globales.
    const { createRequire } = await import('node:module');
    try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
    catch { console.error('Falta Playwright. Instálalo con: npm i -g playwright && npx playwright install chromium'); process.exit(2); }
  }
  const navegador = await chromium.launch();
  const resultados = [];
  try {
    for (const forma of formas) {
      const contexto = await navegador.newContext(forma === 'movil'
        ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }
        : { viewport: { width: 1280, height: 800 } });
      const page = await contexto.newPage();
      const alCaptura = async (p, nombre) => { await p.screenshot({ path: join(salida, nombre) }); return nombre; };
      const r = await clicker(page, { semilla, pasos, origen, forma, alCaptura });
      resultados.push(r);
      console.log(`${forma}: ${r.fallos.length} fallo(s), ${r.omitidos} paso(s) omitido(s)`);
      for (const f of r.fallos) console.log(`  paso ${f.paso} · ${f.invariante} · ${f.detalle} · tras «${f.accion}»`);
      await contexto.close();
    }
  } finally {
    await navegador.close();
    if (servidor) servidor.kill();
  }
  const meta = { semilla, pasos, commit, fecha, formaArg };
  await writeFile(join(salida, 'resultado.json'), JSON.stringify({ meta, resultados }, null, 2));
  await writeFile(join(salida, 'informe.html'), html(resultados, meta));
  console.log(`Informe: ${join(salida, 'informe.html')}`);
  process.exitCode = resultados.some(r => r.fallos.length) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
