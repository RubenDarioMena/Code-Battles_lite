/** Contexto vivo de la composición. Las sustituciones se propagan mediante get/set. */
export interface ContextoInterfaz {
  mundo: any;
  def: any;
  partida: any;
  ejec: any;
  programas: Record<string, string>;
  fuentes: Record<string, { lenguaje: string; texto: string; enUso: boolean }>;
  seleccion: string | null;
  seleccionadas: Set<string>;
  vista: string;
  pausa: boolean;
  /** Datos de reglas, i18n, servicios del editor y callbacks de otras secciones. */
  [servicio: string]: any;
}

export function instalarConsola(ctx: ContextoInterfaz): ReturnType<typeof import('./consola.js').instalarConsola>;
export function instalarInfoReto(ctx: ContextoInterfaz): ReturnType<typeof import('./info-reto.js').instalarInfoReto>;
export function instalarMaquinas(ctx: ContextoInterfaz): ReturnType<typeof import('./maquinas.js').instalarMaquinas>;
export function instalarInspector(ctx: ContextoInterfaz): ReturnType<typeof import('./inspector.js').instalarInspector>;
export function instalarPestanas(ctx: ContextoInterfaz): ReturnType<typeof import('./pestanas.js').instalarPestanas>;
export function instalarRegistro(ctx: ContextoInterfaz): ReturnType<typeof import('./registro.js').instalarRegistro>;
export function instalarAyuda(ctx: ContextoInterfaz): ReturnType<typeof import('./ayuda.js').instalarAyuda>;
export function instalarVariantes(ctx: ContextoInterfaz): ReturnType<typeof import('./variantes.js').instalarVariantes>;
export function instalarEtiquetas(ctx: ContextoInterfaz): ReturnType<typeof import('./etiquetas.js').instalarEtiquetas>;
export function instalarRetosPantalla(ctx: ContextoInterfaz): ReturnType<typeof import('./retos.js').instalarRetosPantalla>;
export function instalarEditorTexto(ctx: ContextoInterfaz): ReturnType<typeof import('./editor-texto.js').instalarEditorTexto>;
export function instalarSugerencias(ctx: ContextoInterfaz): ReturnType<typeof import('./sugerencias.js').instalarSugerencias>;
export { CAMPAIGN_UI } from './campaign-ui.js';
export { FACTORY_FORM } from './factory-form.js';
export { registrarIconosFactory } from './factory-iconos.js';
export { instalarLayout } from './layout.js';
export { montarInterfazHito } from './panel-hito.js';
export { montarHudHito } from './hud-hito.js';
export { montarMandoTactil } from './mando-tactil.js';
