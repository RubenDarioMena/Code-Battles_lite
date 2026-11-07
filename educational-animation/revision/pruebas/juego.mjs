// Prueba del modo revisión y de los pulsos del código dentro del juego (War) en Chromium, puerto 8771 (el de las
// pruebas del juego). node educational-animation/revision/pruebas/juego.mjs
// Con la solución del reto 5 (ejemplos/reto-5) en el editor:
//   - los binoculares (y «Revisar» del menú ⋯ en el teléfono) abren el recorrido de lectura del código actual
//     sin haberlo ejecutado; en PC código | diagrama, en el teléfono apilado; la montaña vuelve al mapa;
//   - un error de sintaxis se avisa con su línea;
//   - pulsos: una lectura null, un if false o regularShoot(null) no pulsan; una lectura con valor, un if que se
//     cumple y una orden sí, con el color de su fila; un mismo fragmento no repite pulso al momento;
//   - la partida instrumentada para los pulsos es la misma que la grabada (mismo final, derribos y tiempo);
//   - la montaña sustituye al mapa en toda la app.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const EJ = join(RAIZ, 'educational-animation/revision/ejemplos/reto-5');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const servidor = createServer(async (q, r) => {
  try { let f = join(RAIZ, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); r.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream' }); r.end(await readFile(f)); }
  catch { r.writeHead(404); r.end(); }
});
await new Promise((ok, mal) => servidor.once('error', mal).listen(8771, '127.0.0.1', ok));
const programas = { 'LAU-01': await readFile(join(EJ, 'LAU-01.js'), 'utf8'), 'LAU-02': await readFile(join(EJ, 'LAU-02.js'), 'utf8') };
const ctx = { window: {} }; vm.runInNewContext(await readFile(join(EJ, 'grabacion.js'), 'utf8'), ctx);
const grabada = ctx.window.GRABACIONES_REVISION['reto-5'];
let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };
const MAPA = 'M3.5 6.5l5.5-2.5', MONTANA = 'M2.5 19.5 9.5 6.5';
const navegador = await chromium.launch();
try {
  for (const [nombre, opc, forma] of [['PC', { viewport: { width: 1440, height: 900 } }, 'escritorio'], ['teléfono', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'movil']]) {
    const contexto = await navegador.newContext(opc);
    await contexto.addInitScript(() => localStorage.setItem('cmg-interfaz-idioma', 'es'));
    const page = await contexto.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/WebGL|three/i.test(m.text())) errores.push(m.text()); });
    await page.goto(`http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?forma=${forma}`);
    await page.waitForFunction(() => window.__juegoListo && window.__banco);
    await page.evaluate(() => document.querySelector('[data-vista="2d"]')?.click());
    // La montaña en lugar del mapa, en toda la app.
    eq(await page.evaluate((m) => document.body.innerHTML.includes(m), MAPA), false, `${nombre}: ya no queda el icono del mapa`);
    eq(await page.evaluate((m) => ['b-mapa-movil', 'b-ver-mapa'].map(id => document.getElementById(id).innerHTML.includes(m)), MONTANA), [true, true], `${nombre}: los botones del mapa llevan la montaña`);
    // El reto 5 con su solución en el editor, sin ejecutar nada.
    await page.evaluate((programas) => { const b = window.__banco; b.elegirReto(4); for (const [id, c] of Object.entries(programas)) b.programas[id] = c; b.abrirPrograma('LAU-01'); }, programas);
    eq(await page.evaluate(() => window.cmg.codigo.value), programas['LAU-01'], `${nombre}: el editor tiene el programa de LAU-01`);
    if (nombre === 'PC') await page.click('#b-revisar');
    else {
      await page.evaluate(() => document.getElementById('app').dispatchEvent(new CustomEvent('cmg:pantalla', { detail: 'codigo' })));
      await page.click('#b-menu-cod');
      ok(await page.locator('#menu-cod [data-menu="revisar"]').isVisible(), 'teléfono: el menú ⋯ tiene «Revisar»');
      eq(await page.locator('#menu-cod [data-menu="revisar"] svg circle').count(), 2, 'teléfono: con los binoculares');
      await page.click('#menu-cod [data-menu="revisar"]');
    }
    await page.waitForFunction(() => window.__revisionJuego && window.__revisionJuego.vista, null, { timeout: 30000 });
    const e = await page.evaluate(() => window.__revisionJuego.vista.estado);
    eq([e.modo, e.prog, e.total, e.paso], ['lectura', 'LAU-01', 9, 0], `${nombre}: abre el recorrido de lectura del código actual, sin haberlo ejecutado`);
    eq(e.disposicion, nombre === 'PC' ? 'lado' : 'apilado', `${nombre}: ${nombre === 'PC' ? 'código | diagrama' : 'apilado'}`);
    ok((await page.locator('#revision-juego .rv-narra-txt').innerText()).includes('Repite las filas 2 a 8 sin parar'), `${nombre}: con la frase de la fila 1`);
    eq(await page.locator('#revision-juego .rv-titulo').innerText(), 'Reto 5 · ' + await page.evaluate(() => window.__banco.def.titulo), `${nombre}: con el título del reto`);
    eq(await page.locator('#revision-juego .rv-junto').count(), 0, `${nombre}: sin «junto»`);
    eq(await page.evaluate(() => window.__banco.mundo.activo), false, `${nombre}: no se ejecutó nada`);
    await page.click('#revision-juego [data-accion="mapa"]');
    eq(await page.evaluate(() => [window.CMGRevisionJuego.abierta, document.getElementById('app').hasAttribute('data-revision')]), [false, false], `${nombre}: la montaña cierra la revisión`);
    // Un error de sintaxis: aviso con la línea, sin abrir nada.
    await page.evaluate(() => { window.__banco.programas['LAU-02'] = 'while (true) {\n  regularShoot(\n}'; window.CMGRevisionJuego.abrir(); });
    await page.waitForFunction(() => { const a = document.querySelector('.rj-aviso:not([hidden])'); return a && a.textContent.length; });
    ok((await page.locator('.rj-aviso').innerText()).startsWith('LAU-02 no se puede leer (línea 3)'), `${nombre}: un error de sintaxis se avisa con su línea`);
    eq(await page.evaluate(() => window.CMGRevisionJuego.abierta), false, `${nombre}: y no se abre`);
    await page.evaluate((c) => { window.__banco.programas['LAU-02'] = c; }, programas['LAU-02']);
    // Python: los binoculares también lo leen (lezer), con el mismo recorrido.
    await page.evaluate(() => { window.__banco.fuentes['LAU-02'] = { lenguaje: 'python', enUso: true, texto: 'while True:\n    pos = auto_target("drone", "visual")\n    if LAU_01.jammed:\n        regular_shoot(pos)\n    wait(0.25)\n' }; window.CMGRevisionJuego.abrir(); });
    await page.waitForFunction(() => window.__revisionJuego && window.__revisionJuego.vista, null, { timeout: 30000 });
    await page.evaluate(() => window.__revisionJuego.vista.cambiarPrograma('LAU-02'));
    eq(await page.evaluate(() => [window.__revisionJuego.vista.estado.prog, window.__revisionJuego.vista.estado.total, window.__revisionJuego.vista.datos['LAU-02'].P.lenguaje]), ['LAU-02', 6, 'python'], `${nombre}: un programa en Python se lee en la revisión`);
    await page.evaluate(() => window.__revisionJuego.vista.ir(1));
    eq(await page.locator('#revision-juego .rv-narra-txt').innerText(), '2Sensor cámara: busca el dron más avanzado y calcula dónde estará. Lo guarda en pos (None si no ve ninguno).', `${nombre}: Python: auto_target, con None`);
    ok(!(await page.evaluate(() => [...document.querySelectorAll('.rj-aviso:not([hidden])')].map(x => x.textContent).join(' '))).includes('JavaScript'), `${nombre}: sin aviso de «solo JavaScript»`);
    await page.click('#revision-juego [data-accion="mapa"]');
    await page.evaluate(() => { delete window.__banco.fuentes['LAU-02']; });

    // ---------- Pulsos ----------
    if (nombre === 'teléfono') await page.evaluate(() => document.getElementById('app').dispatchEvent(new CustomEvent('cmg:pantalla', { detail: 'codigo' })));
    const pulsos = await page.evaluate(() => {
      const P = window.CMGPulsos, src = window.cmg.codigo.value;
      P.reiniciar(); P.preparar('LAU-01', src);
      const pr = P.programas.get('LAU-01'), N = [...pr.nodos.entries()];
      const de = (txt, clase) => N.filter(([, x]) => x.clase === clase && src.slice(x.a, x.b).startsWith(txt)).map(([id]) => id);
      const [a1, a2] = de('autoTarget("drone"', 'lectura').concat(de('autoTarget("stealth"', 'lectura'));
      const atasco = de('LAU_02.jammed', 'condicion')[0], falla = de('failureRate < 0.12', 'condicion')[0];
      const rafaga = de('burstFire', 'orden')[0], normal = de('regularShoot', 'orden')[0];
      // Fragmentos que pulsaron (un fragmento partido en dos renglones da dos cajas) y su color.
      const pulsados = () => { const m = {}; for (const x of document.querySelectorAll('.capa-pulsos .pulso')) m[x.dataset.n] = x.style.getPropertyValue('--c').trim(); return m; };
      // Que se vean los tres que deben pulsar (en el teléfono el editor es bajo).
      const area = document.getElementById('codigo'); area.scrollTop = 0;
      P.traza('LAU-01', [['t', 0, null], [a1, null], [a2, { x: 3, y: 4 }], [atasco, false], [falla, true], [rafaga, 'ok'], [normal, 'sin_objetivo']]);
      const primera = pulsados(), cuantos = () => document.querySelectorAll('.capa-pulsos .pulso').length;
      const antes = cuantos();
      P.traza('LAU-01', [[a2, { x: 3, y: 4 }], [falla, true], [rafaga, 'ok']]);
      const repetidos = cuantos() - antes, cajas = Object.keys(primera).length;
      // Python: sin árbol de JS, pulsa la línea (una orden sí; una lectura null, no).
      P.python('LAU-01'); P.linea('LAU-01', 2, 'cmd', 'ok'); P.linea('LAU-01', 3, 'lee', null);
      const py = [!!document.querySelector('.capa-pulsos .pulso[data-n="L2"]'), !!document.querySelector('.capa-pulsos .pulso[data-n="L3"]')];
      // Con el lector de Python: pulsa la llamada (no la línea) con el color de su fila.
      P.reiniciar();
      const antesPy = area.value, srcPy = 'while True:\n    pos = auto_target("drone", "visual")\n    regular_shoot(pos)\n';
      area.value = srcPy; area.dispatchEvent(new Event('input', { bubbles: true }));
      P.python('LAU-01', srcPy); P.linea('LAU-01', 2, 'lee', { x: 1, y: 2 }); P.linea('LAU-01', 3, 'cmd', 'ok');
      const pyArbol = [...new Map([...document.querySelectorAll('.capa-pulsos .pulso')].map(x => [x.dataset.n, [x.dataset.n.startsWith('L'), x.style.getPropertyValue('--c').trim()]])).values()];
      const filasPy = (() => { const x = window.CMGPythonRevision.leer(srcPy), Pp = window.CMGFlujo.preparar(x, {}), F = window.CMGFlujo.construir(Pp); return F.filas.map(f => f.color); })();
      area.value = antesPy; area.dispatchEvent(new Event('input', { bubbles: true }));
      P.reiniciar();
      return { nodos: [a1, a2, atasco, falla, rafaga, normal].every(x => x != null), clases: [...new Set(N.map(([, x]) => x.clase))].sort(), primera,
        si: [a2, falla, rafaga].map(String), no: [a1, atasco, normal].map(String), colores: Object.fromEntries([a2, falla, rafaga].map(id => [id, pr.nodos.get(id).color])),
        seguidos: repetidos === 0 && cajas > 0, py, pyArbol, filasPy, dentro: N.some(([, x]) => x.clase === 'lectura' && src.slice(x.a, x.b) === 'LAU_02.jammed') };
    });
    ok(pulsos.nodos, `${nombre}: pulsos: encuentra las lecturas, las condiciones y las órdenes del programa`);
    eq(pulsos.clases, ['condicion', 'lectura', 'orden'], `${nombre}: pulsos: lecturas, condiciones de if y órdenes`);
    eq(pulsos.dentro, false, `${nombre}: pulsos: lo que se lee dentro de una condición no pulsa aparte`);
    eq(pulsos.no.filter(id => id in pulsos.primera), [], `${nombre}: pulsos: una lectura null, un if false y regularShoot(null) no pulsan`);
    const vistos = pulsos.si.filter(id => id in pulsos.primera);
    ok(nombre === 'PC' ? vistos.length === 3 : vistos.length >= 1, `${nombre}: pulsos: la lectura con valor, el if que se cumple y la ráfaga sí (los que se ven: ${vistos.length})`);
    eq(vistos.map(id => pulsos.primera[id]), vistos.map(id => pulsos.colores[id]), `${nombre}: pulsos: cada uno con el color de su fila`);
    ok(pulsos.seguidos, `${nombre}: pulsos: el mismo fragmento no vuelve a pulsar al momento`);
    eq(pulsos.py, [true, false], `${nombre}: pulsos en Python: la línea de una orden sí; la de una lectura null, no`);
    eq(pulsos.pyArbol, [[false, pulsos.filasPy[1]], [false, pulsos.filasPy[2]]], `${nombre}: pulsos en Python: auto_target(…) y regular_shoot(…) pulsan con el color de su fila`);
    // La partida instrumentada para los pulsos es la misma que la grabada.
    const partida = await page.evaluate(async () => {
      const b = window.__banco, vistos = new Set();
      const obs = new MutationObserver(() => document.querySelectorAll('.capa-pulsos .pulso').forEach(x => vistos.add(x.style.getPropertyValue('--c'))));
      obs.observe(document.getElementById('area'), { childList: true, subtree: true });
      b.fijarSemilla(1); b.turbo(4); b.ejecutar();
      const inicio = performance.now();
      while (!b.mundo.fin && performance.now() - inicio < 120000) await new Promise(r => setTimeout(r, 40));
      obs.disconnect(); b.turbo(1);
      return { fin: b.mundo.fin, t: Math.round(b.mundo.t * 100) / 100, derribos: b.mundo.derribos, colores: vistos.size, instrumentado: window.CMGPulsos.programas.size };
    });
    eq(partida.instrumentado, 2, `${nombre}: los dos programas van instrumentados`);
    eq([partida.fin, partida.derribos, partida.t], [grabada.partida.resultado, grabada.partida.derribos, grabada.partida.t], `${nombre}: la misma partida que la grabada (${partida.fin}, ${partida.derribos} derribos, ${partida.t} s)`);
    ok(partida.colores >= 2, `${nombre}: durante la partida, el código pulsa con varios colores (${partida.colores})`);

    eq(errores, [], `${nombre}: sin errores en la página`);
    await contexto.close();
  }

  // Factory: los mismos binoculares y la misma revisión, con el catálogo del robot.
  for (const [nombre, opc, forma] of [['Factory PC', { viewport: { width: 1440, height: 900 } }, 'escritorio'], ['Factory teléfono', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'movil']]) {
    const contexto = await navegador.newContext(opc);
    await contexto.addInitScript(() => localStorage.setItem('cmg-interfaz-idioma', 'es'));
    const page = await contexto.newPage();
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.goto(`http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?serie=factory&forma=${forma}`);
    await page.waitForFunction(() => window.__juegoListo && window.__banco);
    if (nombre === 'Factory PC') ok(await page.locator('#b-revisar').isVisible(), `${nombre}: con los binoculares`);
    else {
      await page.evaluate(() => document.getElementById('app').dispatchEvent(new CustomEvent('cmg:pantalla', { detail: 'codigo' })));
      await page.click('#b-menu-cod');
      ok(await page.locator('#menu-cod [data-menu="revisar"]').isVisible(), `${nombre}: el menú ⋯ tiene «Revisar»`);
      await page.click('#b-menu-cod');
    }
    const leer = async () => {
      await page.evaluate(() => window.CMGRevisionJuego.abrir());
      await page.waitForFunction(() => window.__revisionJuego && window.__revisionJuego.vista, null, { timeout: 30000 });
      const filas = await page.evaluate(() => [...document.querySelectorAll('#revision-juego .rv-nodo .rv-et')].map(x => x.textContent));
      await page.evaluate(() => window.__revisionJuego.vista.ir(2));
      const frase = await page.locator('#revision-juego .rv-narra-txt').innerText();
      const e = await page.evaluate(() => window.__revisionJuego.vista.estado);
      await page.evaluate(() => window.CMGRevisionJuego.cerrar());
      return { filas, frase, e };
    };
    const FILAS = ['¿cuánto "cobre" hay en "ENT-1" es mayor que 0?', 'Recoge "cobre" en "ENT-1"', 'Guarda en r: el resultado de entregar en "FUN"', '¿r vale "lleno"?', 'Espera 2 s'];
    await page.evaluate(() => { window.__banco.programas['R1'] = 'while (count("ENT-1", "cobre") > 0) {\n  await pickUp("ENT-1", "cobre")\n  const r = await deliver("FUN")\n  if (r === "lleno") {\n    await wait(2)\n  }\n}'; });
    const js = await leer();
    eq([js.e.modo, js.e.prog], ['lectura', 'R1'], `${nombre}: abre la lectura de R1`);
    eq(js.filas, FILAS, `${nombre}: las filas con las frases del robot`);
    eq(js.frase, '3Calcula el resultado de entregar en "FUN" y lo guarda en r.', `${nombre}: la frase de deliver`);
    await page.evaluate(() => { window.__banco.fuentes['R1'] = { lenguaje: 'python', enUso: true, texto: 'while count("ENT-1", "cobre") > 0:\n    pick_up("ENT-1", "cobre")\n    r = deliver("FUN")\n    if r == "lleno":\n        wait(2)\n' }; });
    eq((await leer()).filas, FILAS, `${nombre}: en Python, las mismas filas`);
    eq(await page.evaluate(() => window.__banco.mundo.activo), false, `${nombre}: no se ejecutó nada`);
    eq(errores, [], `${nombre}: sin errores en la página`);
    await contexto.close();
  }
  console.log(`juego: ${n} comprobaciones`);
} finally {
  await navegador.close();
  servidor.close();
}
