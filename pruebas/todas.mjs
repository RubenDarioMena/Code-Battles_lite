// Fase 0: listas explícitas; las suites existentes conservan su implementación.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const origen = 'http://127.0.0.1:8771';
const logica = [
  'campaign-reglas', 'editor-contrato', 'editor-lenguajes', 'editor-python',
  'factory-reglas', 'fronteras', 'fronteras-autoprueba', 'i18n-catalogos', 'i18n', 'interaccion',
  'partida-campaign', 'partida-factory', 'partida-war', 'partida-referencias', 'python-conversion-regresiones', 'python-semantica-regresiones', 'python-traductor',
  'terreno', 'terreno-bloques', 'terreno-estudio', 'terreno-png',
  'paquetes/protocolo/pruebas/protocolo.mjs',
  'paquetes/nucleo/pruebas/nucleo.mjs',
  'paquetes/reglas-war/pruebas/reglas-war.mjs',
  'paquetes/reglas-factory/pruebas/reglas-factory.mjs',
  'paquetes/reglas-campaign/pruebas/reglas-campaign.mjs',
  'paquetes/anfitrion/pruebas/anfitrion.mjs',
  'paquetes/app/pruebas/app.mjs',
  'fronteras-fase2',
];
const navegador = ['ejecutar-idiomas', 'campaign-juego', 'partida-contraste', 'ejecutar-terreno', 'ejecutar-editor-demo', 'vista-caliente'];
// vista-caliente: cambio 2D/3D en caliente sin reiniciar la partida (fase 2).
// ejecutar-editor-demo: prueba de frontera 4 de la fase 2 (editor montado solo), adaptador de editor-demo.mjs.
// ejecutar-terreno ejecuta terreno-navegador, terreno-modelado y terreno-estudio (editor de terreno, desde trunk).
// ejecutar-idiomas ejecuta los diez idiomas*.mjs con un adaptador Playwright.
// campaign-juego necesita carpeta de capturas (se crea en el temporal del sistema).
// campaign-juego sale con 1 si no completa H0–H5 o hay errores de página.
// Fuera como ejecutables independientes (solo exportan funciones para page/cdp):
// navegador, editor-movil, editor-movil-regresiones, entrada,
// factory-3d, factory-api, factory-comun, factory-editor-comun, factory-vistas-comunes,
// python-juego, python-ejecucion y todos los idiomas*.mjs.
// factory-oraculo además necesita un checkout histórico b76411b.
// recuperacion-editor, recuperacion-harness, grabar-regresiones-war, war-20-ciclos,
// war-20-video y war-recuperacion-regresion requieren arnés externo/ego-browser.
// campaign-soluciones y recuperacion-ejercicios son datos; uso-tokens e
// informar-war-20 procesan evidencias externas; publicacion requiere dist preparado;
// telemetria es Node, sin navegador, y queda fuera de las once suites solicitadas.

function matar(hijo, senal) {
  if (!hijo.pid) return;
  try {
    if (process.platform === 'win32') hijo.kill(senal);
    else process.kill(-hijo.pid, senal);
  } catch (error) { if (error.code !== 'ESRCH') throw error; }
}

const extensiones = { 'fronteras-fase2': 'mjs', 'partida-referencias': 'mjs', 'partida-campaign': 'mjs', fronteras: 'mjs', 'fronteras-autoprueba': 'mjs', 'partida-war': 'mjs', 'partida-factory': 'mjs', 'partida-contraste': 'mjs', 'terreno-png': 'mjs' };

function ejecutar(nombre, argumentos, limite) {
  return new Promise(resolve => {
    const inicio = performance.now();
    let salida = '', agotado = false;
    const ruta = /^paquetes\/[^/]+\/pruebas\/[^/]+\.mjs$/.test(nombre)
      ? nombre : `pruebas/${nombre}.${extensiones[nombre] || 'cjs'}`;
    const hijo = spawn(process.execPath, [ruta, ...argumentos], {
      cwd: raiz, detached: process.platform !== 'win32',
      env: { ...process.env, CBL_QA_ORIGIN: origen },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const recoger = datos => { salida = (salida + datos.toString()).slice(-32768); };
    hijo.stdout.on('data', recoger);
    hijo.stderr.on('data', recoger);
    hijo.on('error', error => recoger(error.message));
    const reloj = setTimeout(() => { agotado = true; matar(hijo, 'SIGKILL'); }, limite);
    hijo.on('close', (codigo, senal) => {
      clearTimeout(reloj);
      resolve({
        estado: codigo === 0 && !agotado ? 'ok' : 'falla',
        segundos: (performance.now() - inicio) / 1000,
        detalle: agotado ? `límite de ${limite / 1000} s excedido`
          : salida.trim().split(/\r?\n/).at(-1) || `salida ${codigo}, señal ${senal}`,
      });
    });
  });
}

async function responde() {
  try {
    const respuesta = await fetch(origen, { signal: AbortSignal.timeout(1000) });
    await respuesta.body?.cancel();
    return true;
  } catch { return false; }
}

async function detener(servidor) {
  if (!servidor?.pid || servidor.exitCode !== null || servidor.signalCode !== null) return;
  await new Promise(resolve => {
    const reloj = setTimeout(() => matar(servidor, 'SIGKILL'), 2000);
    servidor.once('close', () => { clearTimeout(reloj); resolve(undefined); });
    matar(servidor, 'SIGTERM');
  });
}

async function prepararServidor() {
  if (await responde()) return null;
  const servidor = spawn('python3', ['-m', 'http.server', '8771', '--bind', '127.0.0.1'], {
    cwd: raiz, detached: process.platform !== 'win32', stdio: 'ignore',
  });
  let fallo = '';
  servidor.on('error', error => { fallo = error.message; });
  const inicio = performance.now();
  while (performance.now() - inicio < 10000) {
    if (fallo || servidor.exitCode !== null) break;
    if (await responde()) return servidor;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await detener(servidor);
  throw new Error(`No se pudo iniciar el servidor en ${origen}: ${fallo || 'sin respuesta'}`);
}

async function principal() {
  const opciones = process.argv.slice(2);
  let conNavegador = false, solo = '';
  for (let indice = 0; indice < opciones.length; indice++) {
    const opcion = opciones[indice];
    if (opcion === '--navegador') conNavegador = true;
    else if (opcion === '--solo' && opciones[indice + 1] && !solo) solo = opciones[++indice];
    else throw new Error('Uso: node pruebas/todas.mjs [--navegador] [--solo <nombre>]');
  }
  const disponibles = [...logica, ...(conNavegador ? navegador : [])];
  if (solo && !disponibles.includes(solo)) throw new Error(`Suite no disponible: ${solo}; las de navegador requieren --navegador`);
  const elegidas = solo ? [solo] : disponibles;
  const cuentas = { ok: 0, falla: 0, omitida: 0 };
  const informar = (nombre, resultado) => {
    cuentas[resultado.estado]++;
    console.log(`${resultado.estado} · ${nombre} · ${resultado.segundos.toFixed(2)} s · ${resultado.detalle}`);
  };
  let servidor = null, falloServidor = '';
  try {
    for (const nombre of elegidas) {
      if (nombre === 'python-conversion-regresiones') {
        // Esta suite invoca exactamente python3 -c y python3 --version.
        const python = spawnSync('python3', ['--version'], { cwd: raiz, timeout: 5000 });
        if (/** @type {NodeJS.ErrnoException | undefined} */ (python.error)?.code === 'ENOENT') {
          informar(nombre, { estado: 'omitida', segundos: 0, detalle: 'python3 no está disponible en PATH (requiere CPython)' });
          continue;
        }
      }
      const esNavegador = navegador.includes(nombre);
      if (esNavegador && !falloServidor && !servidor) {
        try { servidor = await prepararServidor(); }
        catch (error) { falloServidor = error.message; }
      }
      if (esNavegador && falloServidor) {
        informar(nombre, { estado: 'falla', segundos: 0, detalle: falloServidor });
        continue;
      }
      const argumentos = nombre === 'campaign-juego'
        ? [await mkdtemp(join(tmpdir(), 'cbl-campaign-'))] : [];
      informar(nombre, await ejecutar(nombre, argumentos, esNavegador ? 900000 : 300000));
    }
  } finally { await detener(servidor); }
  console.log(`Resumen: ${cuentas.ok} ok, ${cuentas.falla} falla, ${cuentas.omitida} omitida`);
  process.exitCode = cuentas.falla ? 1 : 0;
}

principal().catch(error => { console.error(error.message); process.exitCode = 1; });
