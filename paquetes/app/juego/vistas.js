import { crearColocador } from './colocador-v2.js';
import { adaptarVistaMetros } from './campaign-v2.js';
import { crearCalidadEfectos } from './calidad-efectos.js';
import * as vista2d from '../../vista-2d/index.js';
import * as vista3d from '../../vista-3d/index.js';

/** Sección extraída del juego; conserva el estado vivo mediante ctx.
 * @param {any} ctx */
export function instalarVistasJuego(ctx) {
  const servicios = ctx.servicios;
  const calidadEfectos = crearCalidadEfectos({ almacen: ctx.plataforma?.almacen,
    search: location.search, media: typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null });
  let medicionEfectos = null;
  // ---------- Vista 3D ----------
  const leerVar = (k) => getComputedStyle(document.documentElement).getPropertyValue(`--${k}`).trim();
  // Fase 2: las vistas dibujan la escena del reglamento (datos planos), no el mundo. Una copia por fotograma:
  // se invalida al empezar cada fotograma y al crear un mundo nuevo.
  const escenaDe = ctx.reglas.escena;
  let escenaFoto = null;
  /** @type {Record<string, string>} */
  let col = {};
  let fotoMetros = null;
  const escenaMetros = () => fotoMetros ??= ctx.reglas.escenaMetros(ctx.partida.mundo);
  const invalidarEscena = () => { escenaFoto = fotoMetros = null; };
  const estadoVista = {
    get escena() { return ctx.mundo ? (escenaFoto ||= { ...escenaDe(ctx.partida?.mundo ?? ctx.mundo), ...(ctx.ES_CAMPAIGN ? { activo: !!ctx.ejec } : {}) }) : null; }, get seleccionadas() { return ctx.seleccionadas; }, get seleccion() { return ctx.seleccion; },
    camaraDosDedos: !!ctx.runtime?.instalarGestosClic,
    camaraPlano: ctx.runtime?.camaraPlano,
    get arrastreCampo() { return ctx.arrastreCampo; }, get cols() { return ctx.COLS; }, get rows() { return ctx.ROWS; },
    get col() { return col; },
    get efectos() { return calidadEfectos.leer(); },
    get medicionEfectos() { return medicionEfectos; },
    get def() { return ctx.def; }, get vista() { return ctx.vista; },
  };
  function leerTerrenoEditor() {
    let terrenoEditor = null;
    if (!ctx.batallasV2 && !ctx.ES_FACTORY && !ctx.ES_CAMPAIGN && typeof servicios.THREE !== "undefined" && new URLSearchParams(location.search).get("terreno") === "editor") {
      try {
        const api = servicios.CMGTerreno;
        if (!api || !api.crearGeometria) throw new Error("No se cargaron los recursos del editor de terreno.");
        const guardado = ctx.plataforma.almacen.leer(api.CLAVE_JUEGO);
        if (!guardado) throw new Error("No hay un terreno guardado para probar.");
        terrenoEditor = api.validar(JSON.parse(guardado));
      } catch (error) {
        console.warn("Terreno del editor: se conserva el paisaje predeterminado.", error.message);
      }
    }
    return terrenoEditor;
  }
  const comunes = { serie: ctx.SERIE, dt: ctx.DT, estado: estadoVista };
  const crearVolumen = ctx.runtime?.crearVista3D;
  const V3 = crearVolumen ? adaptarVistaMetros(crearVolumen(ctx.$("campo"), { ...servicios, $: ctx.$,
    canvas: ctx.$("c3d"), TIPOS: ctx.TIPOS, MISIL: ctx.MISIL, estado: estadoVista, dt: ctx.DT }), escenaMetros) : vista3d.crearVista(ctx.$("campo"), ctx.ES_CAMPAIGN
    ? { ...comunes, THREE: servicios.THREE, cargarGLTFLoader: servicios.cargarGLTFLoader, canvas: ctx.$("c3d"), $: ctx.$, FUNCIONES: ctx.FUNCIONES, funcionDe: ctx.funcionDe, leerVar, radioDe: ctx.radioDe, mapa: ctx.campaign.nivel.MAPA, crearTerreno: vista2d.crearTerreno, reglas: ctx.campaign }
    : { ...comunes, THREE: servicios.THREE, cargarGLTFLoader: servicios.cargarGLTFLoader, canvas: ctx.$("c3d"), $: ctx.$, ES_FACTORY: ctx.ES_FACTORY, ARCO: ctx.ARCO, FR: ctx.FR, FUNCIONES: ctx.FUNCIONES, HALO: ctx.HALO, INTENSIDAD: ctx.INTENSIDAD, LINEA_BASE: ctx.LINEA_BASE, LUCES: ctx.LUCES, MISIL: ctx.MISIL, TIPOS: ctx.TIPOS, alcance: ctx.alcance, direccionDe: ctx.direccionDe, funcionDe: ctx.funcionDe, leerVar, radioDe: ctx.radioDe, visual: ctx.visual, terreno: servicios.CMGTerreno, terrenoEditor: leerTerrenoEditor() });

  // ---------- Vista de plano (2D) ----------
  function leerColores() {
    for (const k of ["bg", "surface", "ink", "muted", "line", "grid", "grid-2", "suelo", "building", "building-top", "edge", "accent", "accent-soft", "bad", "warn", "base", "enemigo", "enemigo-frio", "misil", "explosion", "s-visual", "s-termico", "s-vibra", "sel", "ok", ...Object.keys(ctx.FUNCIONES).map(f => `rol-${f}`)]) col[k] = leerVar(k);
    if (V3) V3.aplicarColores();
  }
  const rgb = (hex) => { const n = parseInt(String(hex).replace("#", ""), 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (hex, a) => `rgba(${rgb(hex).join(",")},${a})`;
  const mezclaBlanco = (hex, u) => `rgb(${rgb(hex).map(v => Math.round(v + (255 - v) * u)).join(",")})`;
  const V2 = vista2d.crearVista(ctx.$("c2d"), ctx.ES_CAMPAIGN ? ({ ...comunes, FUNCIONES: ctx.FUNCIONES, funcionDe: ctx.funcionDe, radioDe: ctx.radioDe, rgba, mezclaBlanco, leerBatalla: () => !!(ctx.__banco && ctx.$("b-piel") && ctx.$("b-piel").getAttribute("aria-pressed") === "true"), mapa: ctx.campaign.nivel.MAPA, reglas: ctx.campaign }) : ({ ...comunes, iconoUnidad: ctx.runtime?.iconoUnidad, ES_FACTORY: ctx.ES_FACTORY, LINEA_BASE: ctx.LINEA_BASE, TIPOS: ctx.TIPOS, MISIL: ctx.MISIL, SENSOR: ctx.SENSOR, LAU: ctx.LAU, FUNCIONES: ctx.FUNCIONES, FR: ctx.FR, HALO: ctx.HALO, INTENSIDAD: ctx.INTENSIDAD, ARCO: ctx.ARCO, LUCES: ctx.LUCES, visual: ctx.visual, funcionDe: ctx.funcionDe, radioDe: ctx.radioDe, direccionDe: ctx.direccionDe, alcance: ctx.alcance, rgba, mezclaBlanco, r2: ctx.r2 }));
  function vaciarEfectos() { V2.vaciar(); V3?.vaciar(); }
  function sucesosVistas(lista) {
    if (ctx.SERIE !== 'war') return;
    invalidarEscena();
    for (const s of lista) { V2.alSuceso(s); V3?.alSuceso(s); }
  }
  const vistaActual = () => ctx.vista === "3d" && V3 ? V3 : V2;
  // Ratón y tacto comparten la selección. La cámara conserva sus botones y los gestos de dos dedos.

  function centrarEn(id) {
    const e = ctx.mundo.porId[id] || ctx.mundo.enemigos.find(x => x.id === id);
    if (e && V3 && ctx.vista === "3d") V3.centrar(e.cx ?? e.x, e.cy ?? e.y);
  }


  return {
    get vista2d() { return vista2d; },
    get vista3d() { return vista3d; },
    get leerVar() { return leerVar; },
    get escenaDe() { return escenaDe; },
    get escenaFoto() { return escenaFoto; }, set escenaFoto(v) { escenaFoto = v; },
    get invalidarEscena() { return invalidarEscena; },
    get estadoVista() { return estadoVista; },
    get leerTerrenoEditor() { return leerTerrenoEditor; },
    get V3() { return V3; },
    get escenaActual() { return crearVolumen && V3 && vistaActual() === V3 ? escenaMetros() : estadoVista.escena; },
    colocador: crearVolumen ? crearColocador(ctx, escenaMetros) : null,
    vistaActual, vaciarEfectos, sucesosVistas, calidadEfectos,
    medirEfectos(registrar) { medicionEfectos = registrar ? { ahora: () => performance.now(), registrar } : null; },
    get col() { return col; }, set col(v) { col = v; },
    get leerColores() { return leerColores; },
    get rgb() { return rgb; },
    get rgba() { return rgba; },
    get mezclaBlanco() { return mezclaBlanco; },
    get centrarEn() { return centrarEn; }
  };
}
