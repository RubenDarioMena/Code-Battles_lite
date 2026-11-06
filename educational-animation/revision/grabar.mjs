// Graba una partida real del juego con la traza de cada programa, para el modo revisión.
//
//   node educational-animation/revision/grabar.mjs educational-animation/revision/ejemplos/reto-5
//
// Lee <carpeta>/ejemplo.json ({ serie, reto, semilla, programas: { id: archivo } }). Sin serie, es un programa
// suelto: se ejecuta en Node con ejecutar.js y su reloj virtual. Con serie, abre el juego en
// Chromium (puerto 8771, el dedicado a pruebas), ejecuta los programas instrumentados por el trazador y
// guarda <carpeta>/grabacion.js. Después repite la partida con los programas sin instrumentar y la misma
// semilla: si los eventos o el resultado cambian, falla (la traza no puede alterar el juego).
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../..');
const PUERTO = 8771;
const carpeta = resolve(process.argv[2] || join(AQUI, 'ejemplos/reto-5'));
const ejemplo = JSON.parse(await readFile(join(carpeta, 'ejemplo.json'), 'utf8'));

// El trazador es un script de navegador; en Node se carga igual que en la página.
globalThis.acorn = require(join(RAIZ, 'shared/vendor/acorn-8.11.3.js'));
vm.runInThisContext(await readFile(join(AQUI, 'motor/trazador.js'), 'utf8'), { filename: 'trazador.js' });
const T = globalThis.CMGTrazador;

// Lo que el programa «ve» en cada despertar: la instantánea que el juego le pasa al Worker.
const ESTADO = 'Object.fromEntries(Object.entries(SNAP.maq).map(([k,v])=>[k,("jammed" in v)?{jammed:v.jammed,failureRate:v.failureRate,missiles:v.missiles,mode:v.mode}:{count:v.count}]))';

// Programas sueltos (sin serie): se ejecutan en Node con el reloj virtual de ejecutar.js; no hace falta el juego.
if (!ejemplo.serie) {
  vm.runInThisContext(await readFile(join(AQUI, 'motor/ejecutar.js'), 'utf8'), { filename: 'ejecutar.js' });
  const programas = {}, salidas = {};
  let error = null, cortado = false;
  for (const [id, archivo] of Object.entries(ejemplo.programas)) {
    const fuente = (await readFile(join(carpeta, archivo), 'utf8')).replace(/\r\n?/g, '\n').replace(/\n+$/, '\n');
    const r = await globalThis.CMGEjecutar.ejecutar(fuente, { acorn: globalThis.acorn });
    // Dos ejecuciones dan la misma traza: lo que se graba no depende del momento.
    const otra = await globalThis.CMGEjecutar.ejecutar(fuente, { acorn: globalThis.acorn });
    if (JSON.stringify(otra.programa.eventos) !== JSON.stringify(r.programa.eventos)) throw new Error(`La traza de ${id} cambia entre dos ejecuciones.`);
    programas[id] = r.programa; salidas[id] = r.salida; error = error || r.error; cortado = cortado || r.cortado;
  }
  const unico = Object.keys(programas).length === 1 ? Object.keys(programas)[0] : null;
  const grabacion = { formato: 2, titulo: ejemplo.titulo || ejemplo.id, programas, salida: unico ? salidas[unico] : [], error, cortado,
    verificacion: { mismaTrazaDosVeces: true, eventosDeTraza: Object.fromEntries(Object.entries(programas).map(([id, p]) => [id, p.eventos.length])) } };
  const destino = join(carpeta, 'grabacion.js');
  await writeFile(destino, '/* Generado por grabar.mjs: programa suelto ejecutado con traza. No editar a mano. */\n'
    + `(window.GRABACIONES_REVISION ||= {})[${JSON.stringify(ejemplo.id)}] = ${JSON.stringify(grabacion)};\n`);
  console.log(`${ejemplo.id}: ${JSON.stringify(grabacion.verificacion.eventosDeTraza)} eventos · consola ${grabacion.salida.length} líneas${error ? ' · error ' + error.mensaje : ''}${cortado ? ' · cortado' : ''}`);
  console.log(`→ ${destino}`);
  process.exit(0);
}

const fuentes = {}, instrumentados = {};
for (const [id, archivo] of Object.entries(ejemplo.programas)) {
  fuentes[id] = (await readFile(join(carpeta, archivo), 'utf8')).replace(/\r\n?/g, '\n').replace(/\n+$/, '\n');
  instrumentados[id] = T.instrumentar(fuentes[id], { reloj: 'SNAP.t', estado: ESTADO });
}

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const servidor = createServer(async (req, res) => {
  try {
    let f = join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(RAIZ)) throw new Error('fuera');
    if ((await stat(f)).isDirectory()) f = join(f, 'index.html');
    res.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream' });
    res.end(await readFile(f));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok, mal) => servidor.once('error', mal).listen(PUERTO, '127.0.0.1', ok));

const navegador = await chromium.launch();
try {
  const page = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  // Cada Worker del juego recibe {type:"run", propia}: así se sabe de qué máquina es cada lote de traza.
  await page.addInitScript(() => {
    const W = window.Worker;
    window.__trazas = {};
    window.Worker = class extends W {
      constructor(...a) {
        super(...a);
        this.addEventListener('message', (ev) => {
          const m = ev.data;
          if (m && m.type === 'traza' && this.__propia) (window.__trazas[this.__propia] ||= []).push(...m.ev);
        });
      }
      postMessage(m, ...r) { if (m && m.type === 'run') this.__propia = m.propia; return super.postMessage(m, ...r); }
    };
  });
  const url = `http://127.0.0.1:${PUERTO}/Prototypes/Rocket%20Launcher/?forma=escritorio${ejemplo.serie === 'factory' ? '&serie=factory' : ''}`;
  await page.goto(url);
  await page.waitForFunction(() => !!window.__banco && !!window.cmg && window.__juegoListo);
  await page.click('[data-vista="2d"]').catch(() => {});

  const jugar = (programas) => page.evaluate(async ({ programas, reto, semilla }) => {
    const b = window.__banco;
    window.__trazas = {};
    b.elegirReto(reto - 1);
    for (const [id, c] of Object.entries(programas)) b.programas[id] = c;
    b.fijarSemilla(semilla);
    b.turbo(20);
    b.ejecutar();
    const t0 = performance.now();
    while (!b.mundo.fin && performance.now() - t0 < 180000) await new Promise(r => setTimeout(r, 40));
    if (!b.mundo.fin) throw new Error('La partida no terminó en 3 minutos.');
    const m = b.mundo, tl = b.telemetria.at(-1), d = b.def;
    return {
      trazas: window.__trazas,
      partida: {
        resultado: m.fin, motivo: tl && tl.motivo, mensaje: tl && tl.mensaje, t: Math.round(m.t * 100) / 100,
        brechas: m.brechas, derribos: m.derribos, enemigos: m.total, atascos: m.detalleAtascos, reparaciones: m.reparaciones,
        eventos: m.eventos,
      },
      reto: { numero: reto, titulo: d.titulo, objetivo: d.objetivo, leccion: d.leccion, pista: d.pista, metas: d.metas,
        lanzadores: d.lanzadores, sensores: d.sensores, reparadores: d.reparadores, oleadas: d.oleadas },
    };
  }, { programas, reto: ejemplo.reto, semilla: ejemplo.semilla });

  const conTraza = await jugar(Object.fromEntries(Object.entries(instrumentados).map(([id, r]) => [id, r.codigo])));
  const sinTraza = await jugar(fuentes);
  if (errores.length) throw new Error('Errores en la página: ' + errores.join(' | '));

  // La traza no puede cambiar la partida: mismo resultado y, máquina a máquina, los mismos eventos con sus
  // líneas. Dentro de un mismo instante, los mensajes de dos Workers llegan en el orden en que cada uno
  // termina (es concurrencia real); no cambia el mundo porque cada máquina solo recibe sus propias órdenes.
  const porMaquina = (p) => { const o = {}; for (const e of p.partida.eventos) (o[e.maquina] ||= []).push(JSON.stringify(e)); return o; };
  const sinEventos = (p) => JSON.stringify({ ...p.partida, eventos: p.partida.eventos.length });
  if (sinEventos(conTraza) !== sinEventos(sinTraza)) throw new Error(`El resultado cambia con la traza: ${sinEventos(conTraza)} ≠ ${sinEventos(sinTraza)}`);
  const a = porMaquina(conTraza), b = porMaquina(sinTraza);
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id] || [], y = b[id] || [], i = x.findIndex((e, k) => e !== y[k]);
    if (i >= 0 || x.length !== y.length) throw new Error(`Los eventos de ${id} cambian con la traza (evento ${i}: ${x[i]} ≠ ${y[i]}).`);
  }
  for (const id of Object.keys(fuentes)) if (!(conTraza.trazas[id] || []).length) throw new Error(`No llegó traza de ${id}.`);

  // Variantes para comparar (mismo reto y misma semilla, sin traza): solo el resultado.
  const comparaciones = [];
  for (const c of ejemplo.comparar || []) {
    const progs = {};
    for (const [id, archivo] of Object.entries(c.programas)) progs[id] = (await readFile(join(carpeta, archivo), 'utf8')).replace(/\r\n?/g, '\n');
    const r = await jugar(progs);
    const { eventos, ...partida } = r.partida;
    partida.reparaciones = r.partida.reparaciones;
    comparaciones.push({ titulo: c.titulo, programas: progs, partida });
  }
  if (errores.length) throw new Error('Errores en la página: ' + errores.join(' | '));

  // Orden estable para que la grabación sea reproducible byte a byte: por instante y máquina, conservando
  // el orden de cada máquina (el que llegan dos Workers en el mismo instante es concurrencia, no partida).
  const estable = (evs) => evs.map((e, i) => [e, i]).sort((x, y) => x[0].t - y[0].t || String(x[0].maquina).localeCompare(String(y[0].maquina)) || x[1] - y[1]).map(x => x[0]);
  conTraza.partida.eventos = estable(conTraza.partida.eventos);
  conTraza.trazas = Object.fromEntries(Object.keys(conTraza.trazas).sort().map(id => [id, conTraza.trazas[id]]));

  const sha = async (f) => createHash('sha256').update(await readFile(join(RAIZ, f))).digest('hex').slice(0, 16);
  const grabacion = {
    formato: 2,
    serie: ejemplo.serie, semilla: ejemplo.semilla, reto: conTraza.reto,
    programas: Object.fromEntries(Object.entries(instrumentados).map(([id, r]) => [id, {
      lenguaje: 'js', fuente: fuentes[id], nodos: r.nodos, comentarios: r.comentarios, eventos: conTraza.trazas[id],
    }])),
    partida: conTraza.partida,
    comparaciones,
    verificacion: {
      mismaPartidaSinTraza: 'mismo resultado y mismos eventos por máquina', eventosDelJuego: conTraza.partida.eventos.length,
      eventosDeTraza: Object.fromEntries(Object.entries(conTraza.trazas).map(([id, e]) => [id, e.length])),
      versiones: {
        'juego.js': await sha('Prototypes/Rocket Launcher/js/juego.js'), 'war.js': await sha('Prototypes/Rocket Launcher/js/war.js'),
        'runtime.js': await sha('Prototypes/Rocket Launcher/js/runtime.js'), 'trazador.js': await sha('educational-animation/revision/motor/trazador.js'),
      },
    },
  };
  const destino = join(carpeta, 'grabacion.js');
  await writeFile(destino, '/* Generado por grabar.mjs: partida real del juego con traza. No editar a mano. */\n'
    + `(window.GRABACIONES_REVISION ||= {})[${JSON.stringify(ejemplo.id)}] = ${JSON.stringify(grabacion)};\n`);
  const p = grabacion.partida;
  console.log(`${ejemplo.id}: ${p.resultado} (${p.mensaje}) · t ${p.t} s · ${p.derribos}/${p.enemigos} derribos · ${p.brechas} brechas · ${p.atascos.length} atascos`);
  console.log(`traza: ${JSON.stringify(grabacion.verificacion.eventosDeTraza)} eventos · misma partida sin traza: sí (${p.eventos.length} eventos del juego)`);
  for (const c of comparaciones) console.log(`${c.titulo}: ${c.partida.resultado} · ${c.partida.derribos}/${c.partida.enemigos} · ${c.partida.brechas} brechas · ${c.partida.atascos.length} atascos`);
  console.log(`→ ${destino}`);
} finally {
  await navegador.close();
  servidor.close();
}
