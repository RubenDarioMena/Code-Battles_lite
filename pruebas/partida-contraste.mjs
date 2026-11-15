// War, Factory y Campaign, fase 0 pasos 3a/3b/3c. Servidor dedicado YA activo en 127.0.0.1:8771.
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { diagnosticoPartida } from './partida-diagnostico.mjs';
import { canonico, registro } from '../herramientas/partida/huella.mjs';
import { ejecutarWar, resultadoWar } from '../herramientas/partida/anfitrion-war.mjs';

import { ejecutarFactory, resultadoFactory } from '../herramientas/partida/anfitrion-factory.mjs';
import { casosReferencia } from '../herramientas/partida/casos.mjs';

import { probarCampaign } from './partida-campaign-contraste.mjs';
import { resultadoCampaign } from '../herramientas/partida/anfitrion-campaign.mjs';

const origen = 'http://127.0.0.1:8771';

/** Instala la observación antes del primer script del juego; conserva Workers y reloj reales.
 * @param {import('playwright').Page} page */
export async function instalarGancho(page) {
  // Una sola fuente de serialización y formato de registro en ambos entornos.
  await page.addInitScript(`(() => {
    const canonico = ${canonico.toString()};
    const registro = ${registro.toString()};
    const resultadoWar = ${resultadoWar.toString()};
    const resultadoFactory = ${resultadoFactory.toString()};
    const resultadoCampaign = ${resultadoCampaign.toString()};
    const captura = window.__partidaContraste = { registros: [], resultado: null, conectado: null, mundo: null };
    for (const serie of ['WAR', 'FACTORY', 'CAMPAIGN']) Object.defineProperty(window, serie, { configurable: true,
      get() { return this['__' + serie + 'Contraste']; },
      set(valor) {
        const conectar = valor.conectar;
        valor.conectar = function(mundo, hooks) {
          const terminar = hooks.terminar, hito = hooks.hito;
          const conectado = conectar.call(this, mundo, { ...hooks, hito(info) { captura.corte = info; hito?.(info); }, terminar(...args) {
            captura.resultado = serie === 'FACTORY'
              ? resultadoFactory(mundo, captura.intento, ...args) : resultadoWar(mundo, ...args);
            return terminar(...args);
          } });
          captura.conectado = conectado; captura.mundo = mundo; captura.serie = serie;
          captura.instantanea = serie === 'CAMPAIGN'
            ? () => ({ t: mundo.t, maq: {}, auto: {}, vib: {}, campaign: conectado.instantanea() })
            : serie === 'FACTORY'
            ? () => ({ t: mundo.t, maq: {}, auto: {}, vib: {}, factory: valor.instantanea(mundo) })
            : () => conectado.instantanea();
          captura.registros = []; captura.resultado = null; captura.corte = null;
          return conectado;
        };
        this['__' + serie + 'Contraste'] = valor;
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
            captura.registros.push(registro(captura.registros.length + 1, captura.instantanea()));
            // Solo QA: bloquea pasos y mensajes posteriores al primer hito. El juego
            // pausa en cicloCampaign, después de vaciar el acumulador del fotograma.
            if (captura.serie === 'CAMPAIGN' && captura.corte) mundo.activo = false;
          } });
        };
        this.__nucleoContraste = valor;
      }
    });
    captura.resultadoCampaign = () => resultadoCampaign(captura.mundo, 'detenido', 'detenido', null);
    captura.digest = async registros => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(registros.join('')));
      return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    };
    captura.final = async () => {
      // errorPrograma llama a terminar directamente; esos finales se observan
      // mediante la telemetría real, sin redondear el t guardado en el mundo.
      if (!captura.resultado) {
        const ultimo = window.__banco.telemetria.at(-1);
        if (ultimo) captura.resultado = captura.serie === 'FACTORY'
          ? resultadoFactory(captura.mundo, ultimo.intento, ultimo.resultado, ultimo.motivo, ultimo.mensaje, ultimo.linea)
          : resultadoWar(captura.mundo, ultimo.resultado, ultimo.motivo, ultimo.mensaje, ultimo.linea, ultimo.programa);
      }
      const bytes = new TextEncoder().encode(captura.registros.join(''));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return { hash: [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join(''),
        pasos: captura.registros.length, resultado: captura.resultado, instantanea: captura.instantanea() };
    };
  })();`);
}

/** Contrasta un caso real y devuelve evidencia, sin modificar fuentes del juego.
 * @param {import('playwright').Browser} browser
 * @param {any} caso */
export async function probarCaso(browser, caso) {
  if (caso.reglas === 'campaign') return probarCampaign(browser, caso, instalarGancho);
  const registros = [];
  const factory = caso.reglas === 'factory';
  const sinPantalla = (factory ? ejecutarFactory : ejecutarWar)({ ...caso, alPaso: (n, snap) => registros.push(registro(n, snap)) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errores = [];
  page.on('pageerror', error => errores.push(error.message));
  try {
    await instalarGancho(page);
    if (factory) {
      // Factory NO usa fijarSemilla: nuevoMundo recibe el número real de intento.
      // Cada browser.newPage tiene contexto aislado; no toca el banco del usuario.
      await page.goto(origen);
      await page.evaluate(({ reto, intento, escenario }) => {
        localStorage.setItem('cmg-banco03:factory-reto', JSON.stringify(reto - 1));
        localStorage.setItem('cmg-banco03:factory-telemetria', JSON.stringify(
          Array.from({ length: intento - 1 }, () => ({ reto }))));
        if (escenario) localStorage.setItem('cmg-banco03:factory-propio', JSON.stringify(escenario));
      }, { ...caso, intento: caso.intento ?? caso.semilla });
    }
    await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?forma=escritorio${factory ? '&serie=factory' : ''}`);
    await page.waitForFunction(() => window.__juegoListo);
    await page.evaluate(({ reglas, reto, semilla, intento, programas }) => {
      const B = window.__banco;
      B.elegirReto(reto - 1);
      if (reglas === 'factory') window.__partidaContraste.intento = intento ?? semilla;
      else B.fijarSemilla(semilla);
      B.turbo(30);
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
      let indice = registrosJuego.findIndex((r, i) => r !== registros[i]);
      if (indice < 0 && registrosJuego.length !== registros.length) indice = Math.min(registrosJuego.length, registros.length);
      for (const linea of diagnosticoPartida({ juego, sinPantalla, errores,
        primerPasoDistinto: indice >= 0 ? indice + 1 : null,
        registroJuego: registrosJuego[indice], registroSinPantalla: registros[indice] })) console.error(linea);
    }
    return { ok, juego, sinPantalla };
  } finally { await page.close(); }
}

async function principal() {
  const { values } = parseArgs({ options: { reglas: { type: 'string', default: 'todas' } } });
  if (!['war', 'factory', 'campaign', 'todas'].includes(values.reglas)) throw new Error('--reglas war|factory|campaign|todas');
  const casos = casosReferencia().filter(c => values.reglas === 'todas' || c.reglas === values.reglas);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let diferencias = 0;
  try {
    console.log('caso · hash juego · hash sin pantalla · contraste');
    for (const caso of casos) {
      const { ok, juego, sinPantalla } = await probarCaso(browser, caso);
      console.log(`${caso.nombre} · ${juego.hash.slice(0, 12)} · ${sinPantalla.hash.slice(0, 12)} · ${ok ? 'OK' : 'DIFERENCIA'}`);
      if (!ok) diferencias++;
    }
  } finally { await browser.close(); }
  console.log(`Contraste: ${casos.length - diferencias}/${casos.length} iguales, ${diferencias} diferencias.`);
  if (diferencias) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  principal().catch(error => { console.error(error); process.exitCode = 1; });
