import { crearEscenario } from './escenarios.mjs';
import { instrumentarMedida } from './instrumentacion.mjs';

// Solo llamado por __banco.medirUnidades. Configura las fuentes en memoria y después
// usa ejecutar/avanzar del juego, incluyendo UI, pulsos, sucesos, escena y dibujo.
export async function prepararJuego(ctx, e) {
  ctx.cerrarProgramas();
  ctx.def = e.escenario.reto; ctx.programas = { ...e.programas }; ctx.fuentes = {};
  ctx.estadoCampaign = null; ctx.semillaFija = true; ctx.semilla = e.semilla;
  ctx.velocidad = 1; ctx.turbo = 1;
  ctx.nuevoMundo();
  ctx.configurarEdicion([Object.keys(e.programas)[0]], true);
  const descriptor = Object.getOwnPropertyDescriptor(ctx, 'crearConductor');
  const crear = ctx.crearConductor;
  /** @type {ReturnType<typeof instrumentarMedida>} */
  let medida;
  Object.defineProperty(ctx, 'crearConductor', { configurable: true, value: opciones => {
    medida = instrumentarMedida(ctx.partida, ctx.anfitrion, () => performance.now());
    return medida.envolverConductor(crear(opciones));
  } });
  const inicio = performance.now();
  try {
    ctx.ejecutar(); ctx.pausa = true;
    await ctx.enVuelo;
    // Deja finalizar también la cadena de callbacks del ciclo en vivo.
    await Promise.resolve(); await Promise.resolve();
    if (!medida || !ctx.ejec || ctx.conductor.error) throw Error('No arrancaron los programas del banco');
    if (ctx.mundo.programables.length !== e.unidades) throw Error('Número de programables incorrecto');
    return { medida, arranqueMs: performance.now() - inicio };
  } finally { Object.defineProperty(ctx, 'crearConductor', descriptor); }
}

export async function medirEnJuego({ serie, unidades, segundos = 60, semilla = 7, vista = '2d' }) {
  const B = window.__banco, e = crearEscenario(serie, unidades, semilla);
  return B.medirUnidades(async ctx => {
    const { medida, arranqueMs } = await prepararJuego(ctx, e);
    ctx.aplicarVista(vista);
    if (ctx.vista !== vista || (vista === '3d' && !ctx.V3)) throw Error(`Vista ${vista} no disponible`);
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('c3d')), gl = canvas.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    const entorno = { userAgent: navigator.userAgent, ancho: innerWidth, alto: innerHeight, dpr: devicePixelRatio,
      campo: document.getElementById('campo').getBoundingClientRect().toJSON(),
      canvas: { ancho: canvas.width, alto: canvas.height }, calidad: ctx.calidadEfectos.leer(),
      gpu: gl ? String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : null };
    const intervalos = [];
    let inicio = null, inicioReloj = 0, pasoInicial = 0, indice = 0, recortados = 0, sinAcumularMs = 0, ultimoLatido = performance.now();
    let vigia;
    try {
      return await new Promise((resolve, reject) => {
        const acabar = async () => {
          ctx.pausa = true;
          try {
            await ctx.enVuelo;
            resolve({ intervalos, muestras: medida.muestras.slice(indice), duracionMs: performance.now() - inicioReloj,
              pasos: ctx.partida.pasoActual - pasoInicial, recortados, sinAcumularMs, entorno, arranqueMs,
              error: ctx.conductor.error || ctx.finActual || (!ctx.ejec ? 'Ejecución detenida' : null) });
          } catch (error) { reject(error); }
        };
        vigia = setInterval(() => {
          if (performance.now() - ultimoLatido > 10000) reject(Error('Sin fotogramas durante 10 s; ventana suspendida'));
        }, 1000);
        B.alFotograma = f => {
          ultimoLatido = performance.now();
          if (inicio === null) {
            inicio = f.ahora; inicioReloj = performance.now(); pasoInicial = ctx.partida.pasoActual; indice = medida.muestras.length;
            ctx.acum = 0; ctx.pausa = false; return;
          }
          intervalos.push(f.transcurrido * 1000);
          if (f.transcurrido > .25) recortados++;
          if (f.sinAcumular) sinAcumularMs += f.real * 1000;
          if (f.ahora - inicio >= segundos * 1000 || !ctx.ejec || ctx.conductor.error || ctx.finActual) {
            B.alFotograma = null; clearInterval(vigia); void acabar();
          }
        };
      });
    } finally { B.alFotograma = null; clearInterval(vigia); ctx.pausa = true; ctx.conductor?.cerrar(); }
  });
}
