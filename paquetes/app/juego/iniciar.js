import { crearPlataformaMemoria } from '../plataforma.js';
import { factory3d } from '../../vista-3d/index.js';
import { configurar, ICONOS } from '../../editor/index.js';
import { registrarIconosFactory, instalarLayout } from '../../interfaz/index.js';
import { instalarRemota } from './remota.js';
import { instalarRevisionJuego } from './revision-juego.js';
import { instalarInterfazV2 } from './campaign-v2.js';
import { prepararFabricaV2 } from './fabrica-v2.js';
import { instalarMoverFabrica } from './mover-fabrica.js';
import { crearEstadoJuego } from './estado.js';
import { instalarCicloProgramas } from './ciclo-programas.js';
import { instalarCierreIntentos } from './cierre-intentos.js';
import { instalarBucleJuego } from './bucle.js';
import { instalarVistasJuego } from './vistas.js';
import { instalarCampoJuego } from './campo.js';
import { instalarProgramasJuego } from './programas.js';
import { instalarPythonJuego } from './python.js';
import { instalarEscenarioJuego } from './escenario.js';
import { instalarCampaignJuego } from './campaign.js';
import { instalarProveedorJuego } from './proveedor.js';
import { instalarArranqueJuego } from './arranque.js';
import { instalarConsola, instalarInfoReto, instalarMaquinas, instalarInspector,
  instalarPestanas, instalarRegistro, instalarAyuda, instalarVariantes,
  instalarEtiquetas, instalarRetosPantalla, instalarEditorTexto,
  instalarSugerencias } from '../../interfaz/index.js';

/** Arranca sobre el marcado y los proveedores clásicos existentes, una vez por página.
 * Los accesores conservan las variables de cada sección; nunca se copian sus valores.
 * @param {import('../index.js').OpcionesArranqueJuego} [opciones] */
export function arrancarJuego(opciones = {}) {
  const servicios = opciones.servicios || {};
  const plataforma = opciones.plataforma || crearPlataformaMemoria();
  configurar({ sesion: plataforma.sesion, acorn: servicios.acorn, vistas: true, i18n: servicios.CMGI18n, lezer: servicios.LezerPython,
    codemirror: servicios.CMGCodeMirror || undefined,
    presentacion: {
      html: texto => servicios.CMGPresentacion ? servicios.CMGPresentacion.html(texto) : texto,
      texto: texto => servicios.CMGPresentacion ? servicios.CMGPresentacion.texto(texto) : texto,
      rotular: (nodo, texto) => { if (servicios.CMGPresentacion) servicios.CMGPresentacion.rotular(nodo, texto); else nodo.textContent = texto; },
    } });
  registrarIconosFactory(ICONOS);
  // Campaign-V2 en un hito de fábrica: la misma página arranca la sesión Campaign sobre la planta del nivel.
  const fabrica = prepararFabricaV2({ ...opciones, plataforma });
  const ctx = crearEstadoJuego(fabrica ?? { ...opciones, plataforma });
  montarInterfaz(ctx, servicios);
}

function montarInterfaz(ctx, servicios) {
  const conectar = instalar => Object.defineProperties(ctx,
    Object.getOwnPropertyDescriptors(instalar(ctx)));
  conectar(instalarCicloProgramas);
  conectar(instalarInterfazV2);
  conectar(instalarCierreIntentos);
  conectar(instalarConsola);
  conectar(instalarVistasJuego);
  conectar(instalarCampoJuego);
  conectar(instalarVariantes);
  conectar(instalarEtiquetas);
  conectar(instalarRetosPantalla);
  conectar(instalarInfoReto);
  conectar(instalarMaquinas);
  conectar(instalarInspector);
  conectar(instalarPestanas);
  conectar(instalarProgramasJuego);
  conectar(instalarEditorTexto);
  conectar(instalarSugerencias);
  conectar(instalarPythonJuego);
  conectar(instalarRegistro);
  conectar(instalarAyuda);
  conectar(instalarEscenarioJuego);
  conectar(instalarCampaignJuego);
  conectar(instalarMoverFabrica);
  conectar(instalarBucleJuego);
  conectar(instalarProveedorJuego);
  conectar(instalarArranqueJuego);
  ctx.cmg.revisionJuego = instalarRevisionJuego(ctx.cmg, servicios, ctx.paginaV2 ? ctx.plataforma.almacen : undefined);
  instalarLayout(ctx);
  if (!ctx.paginaV2) ctx.cmg.remota = instalarRemota(ctx);
  // Diagnóstico accesible sin publicar los antiguos globales.
  ctx.cmg.pulsos = ctx.CMGPulsos;
  ctx.cmg.estructura = ctx.lenguaje.ESTRUCTURA;
  ctx.cmg.factory3d = factory3d;
  window.__juegoListo = true;
}
