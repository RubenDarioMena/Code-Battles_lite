#!/usr/bin/env node
/* Renderiza una infografía a vídeo: misma fuente → horizontal 1920×1080 y vertical 1080×1920, en JS y Python.
 *
 *   node infografias/render.mjs infografias/ejemplos/while-cinta            # los 4 vídeos
 *   node infografias/render.mjs <carpeta> --lang py --formato vertical      # solo uno
 *   node infografias/render.mjs <carpeta> --hoja                            # hoja de revisión PNG por variante (rápido)
 *
 * Opciones: --lang js,py  --formato horizontal,vertical  --fps 30  --escala 2  --seguro (márgenes Shorts/Reels)
 *           --salida <dir> (por defecto renders/infografias)  --chrome <ruta>  --permitir-avisos  --paralelo N
 *
 * Cómo funciona: sirve infografias/ por HTTP local, abre index.html?modo=video, y para cada fotograma
 * llama a __infografia.seek(t) y captura. La animación es una línea GSAP en pausa: el resultado no depende
 * del reloj ni de la velocidad de la máquina. FFmpeg codifica H.264 y mezcla la voz por pasos (si existe).
 * Escribe además <nombre>.vtt (subtítulos de la narración) y <nombre>.json (manifiesto reproducible). */
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = path.dirname(fileURLToPath(import.meta.url)); // educational-animation/infografias
const BANCO = path.dirname(RAIZ);                             // educational-animation

// ------------------------------------------------------------------ argumentos
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const carpeta = args.find((a) => !a.startsWith('--') && !['--lang', '--formato', '--fps', '--escala', '--salida', '--chrome', '--paralelo'].includes(args[args.indexOf(a) - 1]));
if (!carpeta) { console.error('Uso: node infografias/render.mjs <carpeta de la infografía> [--lang js,py] [--formato horizontal,vertical] [--hoja]'); process.exit(2); }
const dirConcepto = path.resolve(carpeta);
if (!dirConcepto.startsWith(RAIZ + path.sep)) { console.error(`La infografía debe estar dentro de ${RAIZ}`); process.exit(2); }
const LANGS = String(opt('lang', 'js,py')).split(',');
const FORMATOS = String(opt('formato', 'horizontal,vertical')).split(',');
const FPS = +opt('fps', 30);
const ESCALA = +opt('escala', 2);
const HOJA = !!opt('hoja', false);
const SEGURO = !!opt('seguro', false);
const PERMITIR = !!opt('permitir-avisos', false);
const SALIDA = path.resolve(String(opt('salida', path.join(BANCO, 'renders', 'infografias'))));
const PARALELO = +opt('paralelo', Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2))));
const TAM = { horizontal: [960, 540], vertical: [540, 960] };
const ASPECTO = { horizontal: '16x9', vertical: '9x16' };

let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('playwright-core')); } catch { console.error('Falta playwright. En educational-animation: pnpm add -D playwright (y usa --chrome si no quieres descargar Chromium).'); process.exit(2); } }

// ------------------------------------------------------------------ servidor estático
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const servidor = createServer(async (req, res) => {
  try {
    const ruta = path.normalize(path.join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!ruta.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
    const datos = await readFile(ruta);
    res.writeHead(200, { 'content-type': TIPOS[path.extname(ruta)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(datos);
  } catch { res.writeHead(404).end(); }
});
servidor.listen(0, '127.0.0.1'); await once(servidor, 'listening');
const BASE = `http://127.0.0.1:${servidor.address().port}/${path.relative(RAIZ, dirConcepto).split(path.sep).join('/')}/`;

// ------------------------------------------------------------------ utilidades
const ffmpeg = (a, entrada) => new Promise((ok, mal) => {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: [entrada ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
  p.on('exit', (c) => (c === 0 ? ok() : mal(new Error('ffmpeg salió con ' + c)))); p.on('error', mal);
  if (entrada) entrada(p.stdin);
});
const vtt = (s) => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = (s % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x}`; };
const version = (cmd, a) => { try { return execFileSync(cmd, a, { encoding: 'utf8' }).split('\n')[0].trim(); } catch { return null; } };
const sha = async (f) => createHash('sha256').update(await readFile(f)).digest('hex');

async function abrir(navegador, lang, formato) {
  const [w, h] = TAM[formato];
  const pagina = await navegador.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: ESCALA });
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  // La voz es opcional: un 404 bajo audio/ solo significa "sin clip para ese paso".
  pagina.on('console', (m) => { if (m.type() === 'error' && !/\/audio\//.test(m.location()?.url || '')) errores.push(m.text()); });
  await pagina.goto(`${BASE}index.html?modo=video&lang=${lang}&formato=${formato}${SEGURO ? '&seguro=1' : ''}`);
  await pagina.waitForFunction(() => window.__infografia, null, { timeout: 15000 });
  await pagina.evaluate(() => window.__infografia.listo);
  if (errores.length) throw new Error(`${lang}/${formato}: ${errores.join(' | ')}`);
  return pagina;
}

// Desbordes: paneles cuyo contenido no cabe (típico en 9:16 con líneas largas de Python).
const revisarDesbordes = (pagina) => pagina.evaluate(() => {
  const out = [];
  document.querySelectorAll('.ig-panel, .ig-texto, .ig-titulo').forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) out.push(`${el.dataset.id || el.className.split(' ')[0]} (${el.scrollWidth}×${el.scrollHeight} > ${el.clientWidth}×${el.clientHeight})`);
  });
  const esc = document.querySelector('.ig-escena').getBoundingClientRect(), pie = document.querySelector('.ig-pie').getBoundingClientRect();
  if (esc.bottom > pie.top + 1) out.push('la escena invade el pie');
  return out;
});

async function variante(navegador, lang, formato) {
  const nombre = `${path.basename(dirConcepto)}-${lang}-${ASPECTO[formato]}`;
  const pagina = await abrir(navegador, lang, formato);
  const info = await pagina.evaluate(() => window.__infografia.info());
  const avisos = [...info.avisos];
  // Revisión por paso (instante asentado de cada paso).
  const instantes = info.pasos.map((p) => p.inicio + Math.min(1.4, p.revelar ?? 1.4));
  const fotos = [];
  for (const [i, t] of instantes.entries()) {
    await pagina.evaluate((x) => window.__infografia.seek(x), t);
    for (const d of await revisarDesbordes(pagina)) avisos.push(`paso ${i + 1}: desborde en ${d}`);
    if (HOJA) fotos.push(await pagina.screenshot({ type: 'png' }));
  }
  // El reproductor interactivo tiene botones en el pie (más alto): revisa también sus desbordes.
  {
    const [w, h] = TAM[formato];
    const pi = await navegador.newPage({ viewport: { width: w, height: h } });
    await pi.goto(`${BASE}index.html?modo=interactivo&auto=0&lang=${lang}&formato=${formato}`);
    await pi.waitForFunction(() => window.__infografia, null, { timeout: 15000 });
    await pi.evaluate(() => window.__infografia.listo);
    for (let i = 0; i < info.pasos.length; i++) {
      await pi.evaluate((k) => window.__infografia.irA(k, { animar: false }), i);
      for (const d of await revisarDesbordes(pi)) avisos.push(`paso ${i + 1} (interactivo): desborde en ${d}`);
    }
    await pi.close();
  }
  if (avisos.length) console.warn(`⚠ ${nombre}\n  - ${[...new Set(avisos)].join('\n  - ')}`);
  if (avisos.length && !PERMITIR && !HOJA) throw new Error(`${nombre}: corrige los avisos o usa --permitir-avisos`);

  if (HOJA) {
    const cols = formato === 'horizontal' ? 3 : 5; const filas = Math.ceil(fotos.length / cols);
    const destino = path.join(SALIDA, `${nombre}-hoja.png`);
    await ffmpeg(['-f', 'image2pipe', '-c:v', 'png', '-i', '-', '-vf', `scale=${formato === 'horizontal' ? 640 : 360}:-1,tile=${cols}x${filas}:padding=8:color=0x05080A`, '-frames:v', '1', destino],
      async (stdin) => { for (const f of fotos) stdin.write(f); stdin.end(); });
    await pagina.close();
    console.log(`✓ ${path.relative(BANCO, destino)} (${fotos.length} pasos)`);
    return;
  }

  const total = Math.ceil(info.duracion * FPS);
  const mudo = path.join(SALIDA, `${nombre}.mudo.mp4`), final = path.join(SALIDA, `${nombre}.mp4`);
  const t0 = Date.now();
  // Captura por CDP: PNG sin pérdida con compresión rápida (≈2× más rápida que page.screenshot) y la escala
  // explícita en el recorte (sin ella CDP captura a 1×). En las pausas de lectura solo avanza la barra del paso:
  // se captura 1 de cada REUSO fotogramas y se repite el último (la barra avanza a FPS/REUSO).
  const cdp = await pagina.context().newCDPSession(pagina);
  const [w, h] = TAM[formato];
  const recorte = { x: 0, y: 0, width: w, height: h, scale: ESCALA };
  const REUSO = 3, margen = 1.5 / FPS;
  const activo = (t) => info.intervalos.some(([a, b]) => t >= a - margen && t <= b + margen);
  let capturas = 0;
  await ffmpeg(['-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'fast', '-tune', 'animation', '-movflags', '+faststart', mudo],
    async (stdin) => {
      let buf = null;
      for (let f = 0; f < total; f++) {
        const t = f / FPS;
        if (!buf || f % REUSO === 0 || activo(t)) {
          await pagina.evaluate((x) => window.__infografia.seek(x), t);
          buf = Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: recorte })).data, 'base64'); capturas++;
          if (capturas === 1 && (buf.readUInt32BE(16) !== w * ESCALA || buf.readUInt32BE(20) !== h * ESCALA)) throw new Error(`captura de ${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}, se esperaba ${w * ESCALA}×${h * ESCALA}`);
        }
        if (!stdin.write(buf)) await once(stdin, 'drain');
        if (f % (FPS * 10) === 0) process.stdout.write(`  ${nombre}: ${Math.round((100 * f) / total)}%\n`);
      }
      stdin.end();
    });
  await pagina.close();

  // Voz: un clip por paso, colocado en el inicio del paso + plomo.
  const clips = info.pasos.map((p) => p.audio && { archivo: path.join(dirConcepto, p.audio.url), retraso: Math.round((p.inicio + info.ajustes.plomo) * 1000) }).filter(Boolean);
  if (clips.length) {
    const entradas = clips.flatMap((c) => ['-i', c.archivo]);
    const filtro = clips.map((c, k) => `[${k + 1}:a]adelay=${c.retraso}|${c.retraso}[a${k}]`).join(';') + ';' + clips.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${clips.length}:normalize=0[voz]`;
    await ffmpeg(['-i', mudo, ...entradas, '-filter_complex', filtro, '-map', '0:v', '-map', '[voz]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', info.duracion.toFixed(3), final]);
  } else await ffmpeg(['-i', mudo, '-c', 'copy', final]);
  await import('node:fs/promises').then((fs) => fs.rm(mudo));

  const cues = info.pasos.map((p, i) => `${i + 1}\n${vtt(p.inicio)} --> ${vtt(p.inicio + p.duracion)}\n${p.texto}\n`).join('\n');
  await writeFile(path.join(SALIDA, `${nombre}.vtt`), `WEBVTT\n\n${cues}`);
  // Dimensiones medidas en el archivo final, no supuestas.
  const [ancho, alto, fotogramasReales] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=width,height,nb_read_packets', '-of', 'csv=p=0', final], { encoding: 'utf8' }).trim().split(',').map(Number);
  if (ancho !== w * ESCALA || alto !== h * ESCALA || fotogramasReales !== total) throw new Error(`${nombre}: el MP4 mide ${ancho}×${alto} y ${fotogramasReales} fotogramas; se esperaba ${w * ESCALA}×${h * ESCALA} y ${total}`);
  const manifiesto = {
    archivo: path.relative(BANCO, final), concepto: info.id, lang, formato, ancho, alto, fps: FPS,
    duracion: +info.duracion.toFixed(3), fotogramas: total, voz: clips.length ? `${clips.length} clips` : 'sin voz', seguro: SEGURO,
    pasos: info.pasos.map((p) => ({ inicio: +p.inicio.toFixed(3), duracion: +p.duracion.toFixed(3), texto: p.texto })),
    herramientas: { node: process.version, playwright: require('playwright/package.json').version, chromium: navegador.version(), gsap: '3.13.0', ffmpeg: version('ffmpeg', ['-version']) },
    comando: `node ${path.relative(BANCO, fileURLToPath(import.meta.url))} ${path.relative(BANCO, dirConcepto)} --lang ${lang} --formato ${formato} --fps ${FPS}${SEGURO ? ' --seguro' : ''}`,
    capturas, reuso: REUSO, creado: new Date().toISOString(), avisos: [...new Set(avisos)], sha256: await sha(final), tamaño: (await stat(final)).size,
  };
  await writeFile(path.join(SALIDA, `${nombre}.json`), JSON.stringify(manifiesto, null, 2) + '\n');
  console.log(`✓ ${path.relative(BANCO, final)} · ${manifiesto.duracion}s · ${total} fotogramas (${capturas} capturados) · ${((Date.now() - t0) / 1000).toFixed(0)}s de render`);
}

// ------------------------------------------------------------------ principal
await mkdir(SALIDA, { recursive: true });
const ruta = opt('chrome', process.env.INFOGRAFIA_CHROME || null);
const navegador = await chromium.launch(ruta && ruta !== true ? { executablePath: ruta } : {});
const tareas = LANGS.flatMap((l) => FORMATOS.map((f) => [l, f]));
let fallo = false;
try {
  const cola = [...tareas];
  await Promise.all(Array.from({ length: Math.min(PARALELO, cola.length) }, async () => {
    while (cola.length) {
      const [l, f] = cola.shift();
      try { await variante(navegador, l, f); } catch (e) { fallo = true; console.error(`✗ ${l}/${f}: ${e.message}`); }
    }
  }));
} finally { await navegador.close(); servidor.close(); }
process.exit(fallo ? 1 : 0);
