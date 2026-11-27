// Hitos de fábrica de Campaign-V2 (h0…h5): la página se arranca como una sesión de la serie Campaign sobre la planta del nivel.
// La planta es el mismo mundo que abastece la bodega en las Batallas: al cumplir un hito de fábrica su estado entra en
// el checkpoint de la Batalla siguiente y la página se recarga; al terminar la Batalla, el checkpoint del hito de
// fábrica trae la planta de vuelta.
import { crearPartida } from '../../nucleo/index.js';
import { niveles, esFabrica, hitosFabrica, moduloFabrica, salida } from '../../reglas-campaign-v2/index.js';
import { componerCampaignV2, avisoMunicion, tituloBatalla } from './campaign-v2.js';
import { leerHistorialV2, escribirCheckpointV2, guardarHistorialV2, purgarHistorialV2 } from './checkpoints-v2.js';
import { crearFabricaCV2, puertasDelMarco } from '../../vista-3d/index.js';

// Guardado en vivo de la sesión Campaign (paquetes/app/juego/campaign.js) visto desde el almacén aislado de la página.
const CLAVE_VIVO = 'cmg-banco03:campaign-1-vivo';
// Qué checkpoint sembró el guardado en vivo: si no cambia, la recarga sigue donde el jugador lo dejó.
const CLAVE_SELLO = 'campaign-v2-nivel-1-sello';
const CLAVES_NIVEL = ['campaign-v2-nivel-1', 'campaign-v2-nivel-1-programas', CLAVE_SELLO, CLAVE_VIVO];

const leer = (almacen, k) => { try { return JSON.parse(almacen.leer(k)); } catch { return null; } };
const escribir = (almacen, k, v) => { try { almacen.escribir(k, JSON.stringify(v)); } catch { /* Sesión en memoria. */ } };

/** Si toca un hito de fábrica, devuelve las opciones con las que la página arranca la sesión Campaign; si no, null.
 * @param {any} opciones las de arrancarJuego (serie 'campaign-v2', servicios y plataforma con el almacén aislado) */
export function prepararFabricaV2(opciones) {
  if (opciones.serie !== 'campaign-v2') return null;
  const params = new URLSearchParams(location.search);
  // Paridad y ensayos son Batallas sueltas: no tocan la planta ni el progreso.
  if (params.get('modo') === 'paridad' || params.has('ensayo')) return null;
  const almacen = opciones.plataforma?.almacen;
  const servicios = opciones.servicios ?? {};
  const contenido = niveles['nivel-1'], nivel = contenido.default;
  const config = componerCampaignV2(params, contenido, servicios.catalogoNivel1);
  const historial = almacen ? leerHistorialV2(almacen) : { ultimo: null, hitos: {} };
  // Los checkpoints de otra revisión del nivel ya no valen: se quitan todos (no solo el último) y se avisa una vez.
  const aviso = purgarHistorialV2(historial, nivel) ? 'cv2.revision' : null;
  if (aviso && almacen) guardarHistorialV2(almacen, historial);
  let cp = historial.hitos[historial.ultimo];
  if (cp && !esFabrica(cp.hito)) return null;
  if (!cp) {
    // Partida nueva: el checkpoint de H0 tiene la planta recién instalada, la bodega inicial y las torretas de partida.
    const { mundo } = crearPartida({ reglas: config.reglas, escenario: config.escenario(-1), semilla: 1 });
    cp = config.reglas.serializar(mundo);
    if (almacen) escribirCheckpointV2(almacen, cp);
  }
  // Textos del nivel antes de montar nada: los títulos y objetivos de los hitos de fábrica viven en el catálogo V2.
  for (const [idioma, catalogo] of Object.entries(servicios.catalogoNivel1 ?? {})) servicios.CMGI18n?.registrar?.(idioma, catalogo);
  const sello = `${cp.hito}@${cp.fabrica?.t ?? 'inicio'}`;
  if (almacen && leer(almacen, CLAVE_SELLO) !== sello) {
    escribir(almacen, CLAVE_VIVO, { cuando: Date.now(), mundo: cp.fabrica });
    escribir(almacen, CLAVE_SELLO, sello);
  }
  const claves = hitosFabrica(nivel);
  const inicio = cp;
  return {
    ...opciones, serie: 'campaign', serieFija: 'campaign', campaign: moduloFabrica(contenido),
    fabricaV2: {
      hito: cp.hito, claves, etapas: [...nivel.hitos, salida.clave], contenido, aviso,
      alCumplirHito: (ctx, h) => cerrarHito(ctx, h, { almacen, inicio, nivel, claves, config }),
      reiniciar: () => reiniciarNivel(almacen),
      volver: hito => volverA(almacen, hito),
      tieneCheckpoint: hito => !!(almacen && leerHistorialV2(almacen).hitos[hito]),
      // La planta se dibuja en el mapa papercraft, pegada a la muralla, con el lenguaje de las máquinas de Campaign 1.
      crearVista3D: (estado, deps) => crearFabricaCV2(estado, { ...deps, origen: nivel.fabrica.origen, puertas: puertasDelMarco(nivel.marco) }),
    },
  };
}

// Al cumplir un hito de fábrica la sesión se para: su planta pasa a la Batalla siguiente (o se cierra la misión).
function cerrarHito(ctx, h, { almacen, inicio, nivel, claves, config }) {
  const clave = claves[h.hecho], siguiente = nivel.hitos[nivel.hitos.indexOf(clave) + 1];
  ctx.__banco?.alHito?.(h);
  if (ctx.ejec) ctx.cerrarProgramas();
  ctx.pausa = false;
  ctx.guardarProgramas?.();
  const titulo = ctx.ti18n(`campaign.hito.${h.hecho}.titulo`);
  const misiles = ctx.mundo.arsenal?.misiles ?? 0;
  const stats = ctx.ti18n('campaign.banner.stats', { t: ctx.coma(ctx.mundo.t), presupuesto: ctx.mundo.presupuesto });
  const superado = ctx.ti18n('cv2.fab.superado', { hito: clave.toUpperCase(), titulo });
  if (!siguiente) {
    // Tras el último hito (H6) no hay más Batallas: la planta queda en marcha y el jugador puede seguir mirándola.
    const reiniciar = () => { reiniciarNivel(almacen); location.reload(); };
    ctx.mostrarBanner('victoria', ctx.ti18n('cv2.fab.fin'), `<p>${ctx.esc(superado)}</p><p>${ctx.esc(ctx.ti18n('cv2.fab.finTexto', { n: misiles }))}</p>`, stats,
      [[ctx.ti18n('cv2.fin.otra'), 'primario', ctx.ocultarBanner], [ctx.ti18n('cv2.fin.reiniciar'), '', reiniciar]]);
    ctx.continuarHito = null;
    return true;
  }
  // El mundo V2 del checkpoint de partida, cerrado con la planta jugada: su serialización es el checkpoint de la Batalla.
  const mundo = config.reglas.restaurar(inicio, 1);
  config.reglas.cerrarFabrica(mundo, ctx.mundo);
  const cp = config.reglas.serializar(mundo);
  if (almacen) escribirCheckpointV2(almacen, cp);
  // Sin sello: si el jugador vuelve a este hito desde la Batalla, la planta sale de su checkpoint y no del guardado en
  // vivo, que ya tiene el hito cumplido.
  almacen?.borrar?.(CLAVE_SELLO);
  const reto = config.retos[config.batallas.indexOf(siguiente)];
  const aviso = reto && avisoMunicion(misiles, reto);
  const html = `<p>${ctx.esc(ctx.ti18n('cv2.fab.siguiente', { titulo: tituloBatalla(ctx.ti18n, reto, siguiente) }))}</p>`
    + `<p>${ctx.esc(ctx.ti18n('cv2.fab.bodega', { n: misiles }))}</p>`
    + (aviso ? `<p class="aviso">${ctx.esc(ctx.ti18n(aviso.k, aviso))}</p>` : '');
  // `continuarHito` también lo usan las pruebas para saltar la tarjeta.
  ctx.continuarHito = () => { ctx.continuarHito = null; location.reload(); };
  ctx.mostrarBanner('victoria', superado, html, stats, [[ctx.ti18n('cv2.fab.continuar'), 'primario', () => ctx.continuarHito?.()]]);
  ctx.pintarControles?.();
  return true;
}

// Volver a una etapa con checkpoint: se elige y la página se recarga en su modo (fábrica o Batalla).
function volverA(almacen, hito) {
  const historial = leerHistorialV2(almacen);
  if (!historial.hitos[hito]) return false;
  historial.ultimo = hito;
  escribir(almacen, 'campaign-v2-nivel-1', historial);
  // Sin sello, la recarga siembra la planta del checkpoint aunque sea el mismo hito en el que estaba el jugador.
  almacen.borrar?.(CLAVE_SELLO);
  return true;
}

function reiniciarNivel(almacen) {
  for (const k of CLAVES_NIVEL) almacen?.borrar?.(k);
}
