// Solo War, fase 0 paso 3a. Servidor dedicado YA activo en 127.0.0.1:8771.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { canonico, registro } from '../herramientas/partida/huella.mjs';
import { ejecutarWar, resultadoWar } from '../herramientas/partida/anfitrion-war.mjs';

const origen = 'http://127.0.0.1:8771';

/** Instala la observación antes del primer script del juego; conserva Workers y reloj reales.
 * @param {import('playwright').Page} page */
export async function instalarGancho(page) {
  // Una sola fuente de serialización y formato de registro en ambos entornos.
  await page.addInitScript(`(() => {
    const canonico = ${canonico.toString()};
    const registro = ${registro.toString()};
    const resultadoWar = ${resultadoWar.toString()};
    const captura = window.__partidaContraste = { registros: [], resultado: null, conectado: null, mundo: null };
    Object.defineProperty(window, 'WAR', { configurable: true,
      get() { return this.__warContraste; },
      set(valor) {
        const conectar = valor.conectar;
        valor.conectar = function(mundo, hooks) {
          const terminar = hooks.terminar;
          const conectado = conectar.call(this, mundo, { ...hooks, terminar(...args) {
            captura.resultado = resultadoWar(mundo, ...args);
            return terminar(...args);
          } });
          captura.conectado = conectado; captura.mundo = mundo;
          captura.registros = []; captura.resultado = null;
          return conectado;
        };
        this.__warContraste = valor;
      }
    });
    Object.defineProperty(window, 'NUCLEO', { configurable: true,
      get() { return this.__nucleoContraste; },
      set(valor) {
        const avanzar = valor.avanzar;
        valor.avanzar = function(acum, mundo, opciones) {
          const paso = opciones.paso;
          return avanzar.call(this, acum, mundo, { ...opciones, paso(dt) {
            paso(dt);
            captura.registros.push(registro(captura.registros.length + 1, captura.conectado.instantanea()));
          } });
        };
        this.__nucleoContraste = valor;
      }
    });
    captura.final = async () => {
      // errorPrograma llama a terminar directamente; esos finales se observan
      // mediante la telemetría real, sin redondear el t guardado en el mundo.
      if (!captura.resultado) {
        const ultimo = window.__banco.telemetria.at(-1);
        if (ultimo) captura.resultado = resultadoWar(captura.mundo, ultimo.resultado,
          ultimo.motivo, ultimo.mensaje, ultimo.linea, ultimo.programa);
      }
      const bytes = new TextEncoder().encode(captura.registros.join(''));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return { hash: [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join(''),
        pasos: captura.registros.length, resultado: captura.resultado, instantanea: captura.conectado.instantanea() };
    };
  })();`);
}

/** Contrasta un caso real y devuelve evidencia, sin modificar fuentes del juego.
 * @param {import('playwright').Browser} browser
 * @param {import('../herramientas/partida/anfitrion-war.mjs').OpcionesWar} caso */
export async function probarCaso(browser, caso) {
  const registros = [];
  const sinPantalla = ejecutarWar({ ...caso, alPaso: (n, snap) => registros.push(registro(n, snap)) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errores = [];
  page.on('pageerror', error => errores.push(error.message));
  try {
    await instalarGancho(page);
    await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?forma=escritorio`);
    await page.waitForFunction(() => window.__juegoListo);
    await page.evaluate(({ reto, semilla, programas }) => {
      const B = window.__banco;
      B.elegirReto(reto - 1); B.fijarSemilla(semilla); B.turbo(30);
      const fuentes = programas ?? Object.fromEntries(Object.entries(B.def.inicial).map(([id, lineas]) => [id, lineas.join('\n')]));
      for (const l of B.mundo.programables) {
        const f = fuentes[l.id] ?? '';
        if (typeof f === 'string' || f.lenguaje === 'js') {
          B.programas[l.id] = typeof f === 'string' ? f : f.codigo;
          // Cada página tiene un contexto nuevo, pero se fija también la fuente activa.
          delete B.fuentes[l.id];
        } else {
          B.fuentes[l.id] = { lenguaje: 'python', texto: f.codigo, enUso: true };
        }
      }
      // Refresca el editor con los programas que ejecutar() leerá.
      B.abrirPrograma(B.mundo.programables[0].id);
      B.ejecutar();
    }, caso);
    await page.waitForFunction(() => !!window.__banco.mundo.fin, null, { timeout: 60000 });
    const juego = await page.evaluate(() => window.__partidaContraste.final());
    const ok = juego.hash === sinPantalla.hash && juego.pasos === sinPantalla.metricas.pasos
      && canonico(juego.resultado) === canonico(sinPantalla.resultado) && errores.length === 0;
    if (!ok) {
      const registrosJuego = await page.evaluate(() => window.__partidaContraste.registros);
      const indice = registrosJuego.findIndex((r, i) => r !== registros[i]);
      console.error('Diagnóstico:', JSON.stringify({ caso, primerPasoDistinto: indice >= 0 ? indice + 1 : null,
        pasos: { juego: juego.pasos, sinPantalla: sinPantalla.metricas.pasos },
        resultado: { juego: juego.resultado, sinPantalla: sinPantalla.resultado }, errores }));
      if (indice >= 0) console.error('Juego:', registrosJuego[indice], 'Sin pantalla:', registros[indice]);
    }
    return { ok, juego, sinPantalla };
  } finally { await page.close(); }
}

async function principal() {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let diferencias = 0;
  try {
    console.log('caso · hash juego · hash sin pantalla · contraste');
    for (let reto = 1; reto <= 5; reto++) for (const semilla of [1, 7]) {
      const { ok, juego, sinPantalla } = await probarCaso(browser, { reto, semilla });
      console.log(`War ${reto}/${semilla} · ${juego.hash.slice(0, 12)} · ${sinPantalla.hash.slice(0, 12)} · ${ok ? 'OK' : 'DIFERENCIA'}`);
      if (!ok) diferencias++;
    }
  } finally { await browser.close(); }
  if (diferencias) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  principal().catch(error => { console.error(error); process.exitCode = 1; });
