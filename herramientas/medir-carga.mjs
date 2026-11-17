#!/usr/bin/env node
// Medida manual de GPU real; NO pertenece a npm test ni test:navegador.
// Uso y límites: herramientas/medir-carga/README.md. --help no abre aplicaciones.
import { _electron, chromium } from 'playwright';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { medirPagina } from './medir-carga/pagina.mjs';
import { resumir } from './medir-carga/estadisticas.mjs';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const uso = 'node herramientas/medir-carga.mjs [--segundos 10] [--ritmo 120] [--salida <dir>] [--origen http://127.0.0.1:PUERTO]';
const args = process.argv.slice(2);
let segundos = 10, ritmo = 120, salida = path.resolve('tmp/medir-carga'), origen = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') { console.log(uso); process.exit(0); }
  const opcion = args[i], valor = args[++i];
  if (!valor) throw Error(uso);
  if (opcion === '--segundos') segundos = Number(valor);
  else if (opcion === '--ritmo') ritmo = Number(valor);
  else if (opcion === '--salida') salida = path.resolve(valor);
  else if (opcion === '--origen') {
    const url = new URL(valor);
    if (!/^https?:$/.test(url.protocol)) throw Error('El origen debe ser HTTP(S)');
    origen = url.origin;
  } else throw Error(uso);
}
if (!Number.isFinite(segundos) || segundos <= 0) throw Error('--segundos debe ser positivo');
if (!Number.isFinite(ritmo) || ritmo <= 0) throw Error('--ritmo debe ser positivo');
const datos = await mkdtemp(path.join(tmpdir(), 'cbl-carga-'));
let app, navegador, contexto, page, visible = !!origen;
const errores = [], resultados = [];
const presupuestos = { alto: 2000, medio: 1200, bajo: 600, no: 0 };
try {
  if (origen) {
    // Ventana visible, sin flags de renderizado por software ni GPU desactivada.
    navegador = await chromium.launch({ headless: false });
    contexto = await navegador.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
    page = await contexto.newPage();
  } else {
    /** @type {NodeJS.ProcessEnv} */
    const env = { ...process.env, CBL_DATOS: datos, CBL_OCULTA: '1', CBL_STEAM_APPID: '0' };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({ args: [raiz], cwd: raiz, env, chromiumSandbox: true, timeout: 45000 });
    page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  page.on('pageerror', e => errores.push(e.message));
  const entrada = `${origen || 'cbl://app'}/Prototypes/Rocket%20Launcher/index.html`;
  await page.goto(entrada);
  await page.waitForFunction(() => window.__juegoListo === true, null, { timeout: 45000 });
  // Prueba acotada: si la ventana oculta inhibe rAF, muestra y vuelve a comprobar.
  const latidos = () => page.evaluate(() => new Promise(resolve => {
    let n = 0, activo = true;
    const contar = () => { if (activo) { n++; requestAnimationFrame(contar); } };
    requestAnimationFrame(contar);
    setTimeout(() => { activo = false; resolve(n); }, 1200);
  }));
  const gpuInicial = await page.evaluate(() => {
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c3d'));
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl ? String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : '';
  });
  const gpuSoftware = /swiftshader|llvmpipe|software|softpipe/i.test(gpuInicial);
  if (app && (await latidos() < 20 || gpuSoftware || !gpuInicial)) {
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.show(); w.focus(); });
    visible = true;
    console.log('Se usa ventana visible: la prueba oculta limita rAF o no confirma GPU real. Revisa el renderer de cada caso.');
  }
  if (await latidos() < 20) throw Error('rAF no funciona normalmente; mantén la ventana visible y vuelve a medir.');
  for (const calidad of ['alto', 'medio', 'bajo', 'no']) {
    for (const vista of ['2d', '3d']) {
      for (const escenario of ['real', 'saturacion']) {
        errores.length = 0;
        // Recarga aislada por caso: ninguna cola del caso anterior sobrevive.
        await page.goto(`${entrada}?serie=war&vfx=${calidad}`);
        await page.waitForFunction(() => window.__juegoListo === true, null, { timeout: 45000 });
        console.log(`${calidad} / ${vista} / ${escenario}: ${segundos} s + 2 s de calentamiento`);
        const medida = await page.evaluate(medirPagina, { segundos, vista, escenario, ritmo });
        const fila = { calidad, vista, escenario, ...resumir(medida), errores: [...errores] };
        fila['presupuesto'] = presupuestos[calidad];
        fila['presupuestoAlcanzado'] = fila.vivasMax >= presupuestos[calidad];
        resultados.push(fila);
        if (escenario === 'saturacion' && !fila['presupuestoAlcanzado']) console.warn(`No se llenó el presupuesto: ${fila.vivasMax}/${presupuestos[calidad]}`);
        // Conserva resultados parciales si un caso posterior falla.
        await guardar();
        if (errores.length) throw Error(`Errores de página: ${errores.join('; ')}`);
        if (!fila.pasosMax) throw Error('La partida no avanzó; revisa el programa/arranque.');
      }
    }
  }
  console.log(`Medida guardada en ${salida}`);
} finally {
  try { await app?.close(); await contexto?.close(); await navegador?.close(); }
  finally { await rm(datos, { recursive: true, force: true }); }
}

async function guardar() {
  await mkdir(salida, { recursive: true });
  const metadatos = { backend: origen ? 'chromium' : 'electron', origen: origen || 'cbl://app',
    visible, segundos, calentamientoSegundos: 2, fecha: new Date().toISOString(),
    saturacion: `${ritmo} tríos/s real (disparo, derribo, explosion con golpe), ambas colas vía __banco.sucesosVistas`,
    ventanaSolicitada: { ancho: 1280, alto: 720 }, resultados };
  await writeFile(path.join(salida, 'resumen.json'), JSON.stringify(metadatos, null, 2) + '\n');
  const f = n => n == null ? '—' : n.toFixed(3);
  const filas = resultados.map(r => `| ${r.calidad} | ${r.vista} | ${r.escenario} | ${r.fotogramas} | ${f(r.fotograma.mediaMs)} | ${f(r.fotograma.p95Ms)} | ${f(r.fotograma.p99Ms)} | ${r.fotogramasMas33} | ${r.vivasMax}/${r['presupuesto']} | ${f(r.cpu.particulas.mediaMs)} | ${f(r.cpu.dibujar.mediaMs)} | ${f(r.cpu.total.p95Ms)} | ${r.reinicios} |`);
  const entornos = resultados.map(r => `- ${r.calidad}/${r.vista}/${r.escenario}: ${JSON.stringify(r.entorno)}`);
  await writeFile(path.join(salida, 'resumen.md'), [
    '# Medida de carga VFX', '', `${metadatos.backend}, ${visible ? 'ventana visible' : 'CBL_OCULTA=1'}, ${segundos} s/caso + 2 s de calentamiento.`,
    'Reto 1, semilla 7, programa RETOS[1] de LAU-01, velocidad 1×. En «real» la ventana empieza con la primera explosión. Reinicia el mismo intento si termina.',
    metadatos.saturacion + '.', '',
    '| Calidad | Vista | Escenario | Frames | Media ms | p95 ms | p99 ms | >33 ms | Vivas/presupuesto | CPU partículas ms | CPU dibujo ms | CPU total p95 ms | Reinicios |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|', ...filas, '',
    'CPU = evaluación + envío de partículas al dibujante; excluye render GPU, render de escena e inyección. Los intervalos rAF sí incluyen toda la carga.',
    'Una saturación por debajo del presupuesto no valida el peor caso. Revisa renderer real (SwiftShader/llvmpipe/Software no es GPU real), errores, DPR y tamaño antes de comparar.',
    '', '## Entorno por caso', '', ...entornos, '',
  ].join('\n'));
}
