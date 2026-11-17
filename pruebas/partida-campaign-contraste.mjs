import { ejecutarCampaign, programasCampaign } from '../herramientas/partida/anfitrion-campaign.mjs';
import { compararCampaign } from './partida-campaign-comparacion.mjs';
import { diagnosticoPartida } from './partida-diagnostico.mjs';
import { canonico, registro } from '../herramientas/partida/huella.mjs';

/** Contrasta la secuencia Campaign con intérprete real; no ejecuta la salva posterior a H5.
 * @param {import('playwright').Browser} browser @param {any} caso
 * @param {(page: import('playwright').Page) => Promise<void>} instalarGancho */
export async function probarCampaign(browser, caso, instalarGancho) {
  const registros = [], programas = caso.programas ?? programasCampaign(caso.lenguaje);
  const sinPantalla = await ejecutarCampaign({ ...caso, programas,
    alPaso: (n, snap) => registros.push(registro(n, snap)) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  try {
    await instalarGancho(page);
    await page.goto('http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?serie=campaign&forma=escritorio');
    await page.waitForFunction(() => window.__juegoListo && window.__partidaContraste.listo);
    await page.evaluate(() => localStorage.clear());
    await page.reload(); await page.waitForFunction(() => window.__juegoListo && window.__partidaContraste.listo);
    await page.evaluate(() => window.__banco.turbo(30));
    const tramos = [];
    for (const fuentes of programas) {
      const inicio = await page.evaluate(fuentes => {
        const B = window.__banco, C = window.__partidaContraste;
        C.corte = null;
        for (const l of B.mundo.programables) {
          const f = fuentes[l.id] ?? '';
          B.programas[l.id] = typeof f === 'string' ? f : f.lenguaje === 'js' ? f.codigo : '';
          if (typeof f !== 'string' && f.lenguaje === 'python')
            B.fuentes[l.id] = { lenguaje: 'python', texto: f.codigo, enUso: true };
          else delete B.fuentes[l.id];
        }
        B.abrirPrograma(B.mundo.programables[0].id);
        const inicio = { desde: B.mundo.hito, pasos: C.registros.length };
        B.ejecutar(); return inicio;
      }, fuentes);
      await page.waitForFunction(() => {
        const C = window.__partidaContraste;
        // Espera también al procesamiento del banner/checkpoint en cicloCampaign.
        return (C.corte && !document.getElementById('banner').hidden) || !window.cmg.ejecutando;
      }, null, { timeout: 240000 });
      const tramo = await page.evaluate(async inicio => {
        const B = window.__banco, C = window.__partidaContraste;
        if (window.cmg.ejecutando) window.cmg.alternarEjecucion();
        const resultado = C.resultadoCampaign();
        const filas = C.registros.slice(inicio.pasos);
        // Cada hash de tramo renumera desde 1; el hash continuo nunca reinicia.
        const hash = await C.digest(filas.map((r, i) => (i + 1) + r.slice(r.indexOf(':'))));
        const victoria = B.telemetria.findLast(x => x.motivo === 'hito');
        if (C.corte && (!victoria || victoria.tiempoJuego !== resultado.registro.tiempoJuego))
          throw new Error('El banner/checkpoint se registró fuera del paso de corte.');
        const fin = B.telemetria.at(-1);
        // Comprueba el registro REAL al detener, sin fecha, fuentes ni intento.
        for (const k of Object.keys(resultado.registro)) {
          if (JSON.stringify(fin[k]) !== JSON.stringify(resultado.registro[k]))
            throw new Error('Telemetría Campaign distinta al detener: ' + k);
        }
        document.getElementById('banner').hidden = true;
        return { desde: inicio.desde, hito: resultado.hito, completado: resultado.completado,
          pasos: filas.length, t: resultado.t, hash, resultado };
      }, inicio);
      tramos.push(tramo);
      if (tramo.completado || tramo.hito === inicio.desde) break;
    }
    const juego = await page.evaluate(async tramos => {
      const C = window.__partidaContraste;
      return { hash: await C.digest(C.registros), pasos: C.registros.length,
        tramos, resultado: tramos.at(-1).resultado, instantanea: C.instantanea() };
    }, tramos);
    const comparableJuego = compararCampaign(juego), comparableSinPantalla = compararCampaign(sinPantalla);
    const ok = juego.hash === sinPantalla.hash && juego.pasos === sinPantalla.metricas.pasos
      && canonico(comparableJuego.tramos) === canonico(comparableSinPantalla.tramos)
      && canonico(comparableJuego.resultado) === canonico(comparableSinPantalla.resultado) && !errores.length;
    if (!ok) {
      const real = await page.evaluate(() => window.__partidaContraste.registros);
      let i = real.findIndex((r, n) => r !== registros[n]);
      if (i < 0 && real.length !== registros.length) i = Math.min(real.length, registros.length);
      for (const linea of diagnosticoPartida({ juego: comparableJuego, sinPantalla: comparableSinPantalla,
        errores, primerPasoDistinto: i < 0 ? null : i + 1,
        registroJuego: real[i], registroSinPantalla: registros[i] })) console.error(linea);
    }
    return { ok, juego, sinPantalla };
  } finally { await page.close(); }
}
