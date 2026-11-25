import { montarInterfazHito, montarHudHito, montarMandoTactil } from '../../interfaz/index.js';
import { crearVinculos } from './vinculos-v2.js';
import { volverACheckpoint } from './checkpoints-v2.js';
import { crearFicha3D, crearVistaCV2 } from '../../vista-3d/index.js';
import { instalarGestosClic } from './gestos-clic.js';
import { crearExtensionV2 } from './proveedor-v2.js';
import { dibujarIconoHito } from '../../vista-2d/index.js';
import war, { retos, fijarSuministro, pasoConIntentoPuntual, leerEnemigos, danoEnArea, MISIL } from '../../reglas-war/index.js';
import { crearReglamento, puntoEnMarco, puntoEnMetros, salida, fichas, mundoPantalla, piezasMoviles, fichaClic, lugarDeObjetivo, repartirClic, niveles, validarNivel, esFabrica, hitosFabrica } from '../../reglas-campaign-v2/index.js';

export function componerCampaignV2(params, contenido = niveles['nivel-1'], catalogo = undefined) {
  const errores = validarNivel('nivel-1', contenido, war.api.tipos, catalogo);
  if (errores.length) throw new Error(errores.join('\n'));
  const { hitos } = contenido.default;
  const modo = params.get('modo') === 'paridad' ? 'paridad' : params.has('ensayo') ? 'ensayo' : 'campaign';
  const clave = (modo === 'paridad' ? params.get('batalla') ?? 'b1' : params.get('ensayo')) ?? hitos[0];
  const ensayo = modo === 'ensayo' && clave === salida.clave ? salida : null;
  if ((!ensayo && !hitos.includes(clave)) || (modo === 'paridad' && esFabrica(clave)))
    throw new Error(`nivel-1/nivel.js · hitos · Batalla desconocida: ${clave}`);
  // Los hitos de fábrica no tienen ensayo suelto: su planta depende de lo fabricado antes (se abren desde su checkpoint).
  if (modo === 'ensayo' && esFabrica(clave)) throw new Error(`nivel-1/${clave}.js · ensayo · los hitos de fábrica se juegan en la campaña`);
  // La pantalla de War numera solo las Batallas. Los hitos de fábrica (hN) se juegan en la sesión Campaign (fabrica-v2.js).
  const batallas = hitos.filter(h => !esFabrica(h));
  /** @type {Record<string, import('../../reglas-war/index.js').Reto & { unidades?: { tipo: string }[], hostiles?: { tipo: string }[] }>} */
  const porHito = {};
  for (const h of batallas) {
    const { clave: _, ...datos } = contenido[h];
    const original = 'war' in datos ? Number(datos.war) : Number(/^b([1-5])$/.exec(h)?.[1]);
    porHito[h] = 'war' in datos || (modo === 'paridad' && Number.isInteger(original))
      ? retos.normalizar(retos.RETOS[original - 1]) : /** @type {import('../../reglas-war/index.js').Reto} */ (datos);
  }
  if (ensayo) {
    batallas.push(ensayo.clave);
    porHito[ensayo.clave] = ensayo;
  }
  const usadas = new Set(Object.values(porHito).flatMap(reto => [...(reto.unidades ?? []), ...(reto.hostiles ?? [])].map(e => e.tipo)));
  const propias = fichas.filter(f => usadas.has(f.id));
  const activas = [fichaClic, ...propias, ...fichas.filter(f => propias.some(p => p.capacidades?.includes(f.id)))];
  const tiposHostiles = Object.fromEntries(propias.filter(f => f.primitiva).map(f => [f.id, f]));
  function escenario(indice, propio = null) {
    if (indice === batallas.length) return { hito: 'propio', modo: 'ensayo', reto: propio };
    // -1: el primer hito de fábrica (la partida nueva de la campaña).
    const hito = indice === -1 ? hitos.find(esFabrica) : batallas[indice];
    if (modo === 'paridad' && !('war' in contenido[hito]) && !/^b[1-5]$/.test(hito))
      throw new Error(`${hito}.js · war · sin reto original para paridad`);
    return { hito, modo, reto: porHito[hito] ?? null };
  }
  return {
    reglas: crearReglamento({ ...war, fijarSuministro, pasoConIntentoPuntual, leerEnemigos, danoEnArea, velMisil: MISIL.vel }, contenido, porHito),
    runtime: modo !== 'paridad' ? { aislarErrores: true, iconoUnidad: dibujarIconoHito, crearVinculos, montarInterfaz: ctx => {
      const ui = montarInterfazHito(ctx, {
        crearFicha: canvas => crearFicha3D(canvas, ctx.servicios, ctx.TIPOS),
        volver: (h, programas) => elegirEtapa(ctx, h, programas), etapas: () => etapasDisponibles(ctx),
      });
      montarMando(ctx);
      return ui;
    }, crearVista3D: crearVistaCV2, instalarGestosClic, camaraPlano: { zoom: 1, x: 0, y: 0 }, crearExtension: traducir => crearExtensionV2(activas, traducir, catalogo), repartirClic,
      tiposHostiles, eventos: activas.flatMap(f => f.eventos ?? []).map(e => [e.objeto, e.nombre].filter(Boolean).join('.')), piezas: { lugarDeObjetivo, ...piezasMoviles }, repetir: params.get('repetir') === '1' } : null,
    anunciarHito: modo === 'campaign' ? (ctx, m, seguir) => anunciarHito(ctx, m, seguir, porHito, contenido) : null,
    anunciarFin: modo === 'campaign' ? (ctx, m) => anunciarFin(ctx, m, porHito, hitos) : null,
    etapas: [...hitos, salida.clave], reglasProgramas: war, modo, batallas, indiceInicial: batallas.indexOf(clave),
    retos: batallas.map(h => porHito[h]), escenario,
    mundoPantalla,
  };
}

// Mando táctil de las Batallas: el joystick desplaza la cámara de la vista activa (3D o plano).
function montarMando(ctx) {
  const campo = ctx.$('campo');
  if (!campo || typeof document === 'undefined') return null;
  const textos = Object.fromEntries(['ocultar', 'mostrar', 'izq', 'der', 'raton'].map(k => [k, ctx.ti18n('cv2.mando.' + k)]));
  return montarMandoTactil(campo, { almacen: ctx.plataforma?.almacen, textos, desplazar(dx, dy) {
    if (ctx.vistaActual() === ctx.V3) return ctx.V3?.desplazar?.(dx, dy);
    const c = ctx.runtime.camaraPlano;
    c.x += dx; c.y += dy;
  } });
}

// Los hitos de fábrica toman su título del catálogo de la serie Campaign (campaign.hito.N.titulo, N = su posición entre los hN).
const tituloHito = (ctx, h, porHito, contenido) => esFabrica(h)
  ? ctx.ti18n(`campaign.hito.${hitosFabrica(contenido.default).indexOf(h)}.titulo`) : porHito[h]?.titulo ?? h.toUpperCase();
const resumenHito = (ctx, s) => ctx.ti18n('cv2.fin.stats', { derribos: s.derribos, total: s.total, misiles: s.misiles,
  atascos: s.atascos, t: Math.round(s.t) });

/** ¿Alcanza la bodega para la Batalla siguiente? Devuelve una clave i18n con sus datos, o null si no hace falta avisar.
 * Cada torreta empieza la Batalla con el cargador lleno del reto; después solo recarga desde la bodega (ticket 04.6).
 * @param {number} bodega misiles que quedan en la bodega de la muralla
 * @param {{ cargador: number, lanzadores: unknown[], oleadas: { n: number }[] }} reto la Batalla que viene
 * @returns {{ k: string, [dato: string]: unknown } | null} */
export function avisoMunicion(bodega, reto) {
  // Estimación: un misil por enemigo más un 20 % de fallos; los cargadores llenos cubren el principio.
  const enemigos = reto.oleadas.reduce((total, oleada) => total + oleada.n, 0);
  const necesarios = Math.ceil(enemigos * 1.2) - reto.lanzadores.length * reto.cargador;
  return necesarios > 0 && bodega < necesarios ? { k: 'cv2.fin.escasa', n: bodega, falta: necesarios } : null;
}

// Entre hitos: tarjeta con el resultado y la Batalla que viene. La simulación espera parada hasta «Continuar».
function anunciarHito(ctx, m, seguir, porHito, contenido) {
  const s = m.superado, reto = porHito[m.hito], fabrica = esFabrica(m.hito);
  const aviso = reto && avisoMunicion(m.bodega.misiles, reto);
  const titulo = tituloHito(ctx, m.hito, porHito, contenido);
  // Tras la Batalla puede venir un hito de fábrica: «Continuar» recarga la página en la sesión de fábrica.
  const html = `<p>${ctx.esc(fabrica ? ctx.ti18n('cv2.fab.siguienteFabrica', { hito: m.hito.toUpperCase(), titulo }) : ctx.ti18n('cv2.fin.siguiente', { titulo }))}</p>`
    + `<p>${ctx.esc(ctx.ti18n('cv2.fin.bodega', { n: m.bodega.misiles }))}</p>`
    + (aviso ? `<p class="aviso">${ctx.esc(ctx.ti18n(aviso.k, aviso))}</p>` : '');
  // `continuarHito` también lo usan las pruebas y el menú de pruebas para saltar la tarjeta.
  ctx.continuarHito = () => { ctx.continuarHito = null; ctx.ocultarBanner(); seguir(); };
  ctx.mostrarBanner('victoria', ctx.ti18n('cv2.fin.superado', { titulo: tituloHito(ctx, s?.hito ?? '', porHito, contenido) }), html,
    s ? resumenHito(ctx, s) : null, [[ctx.ti18n(fabrica ? 'cv2.fab.irFabrica' : 'cv2.fin.continuar'), 'primario', () => ctx.continuarHito?.()]]);
  ctx.pintarControles?.();
}

// Tras la última Batalla: cierre del nivel en lugar del «Siguiente reto» de War.
function anunciarFin(ctx, m, porHito, hitos) {
  if (!m || m.modo !== 'campaign' || m.hito !== hitos.at(-1)) return;
  const reiniciar = () => {
    // También la planta en vivo de la sesión de fábrica y su sello (fabrica-v2.js).
    for (const k of ['campaign-v2-nivel-1', 'campaign-v2-nivel-1-programas', 'campaign-v2-nivel-1-sello', 'cmg-banco03:campaign-1-vivo'])
      ctx.plataforma?.almacen?.borrar?.(k);
    location.reload();
  };
  ctx.mostrarBanner('victoria', ctx.ti18n('cv2.fin.nivel'), `<p>${ctx.esc(ctx.ti18n('cv2.fin.nivelTexto'))}</p>`,
    m.superado ? resumenHito(ctx, m.superado) : null,
    [[ctx.ti18n('cv2.fin.otra'), 'primario', ctx.ocultarBanner], [ctx.ti18n('cv2.fin.reiniciar'), '', reiniciar]]);
}

// Las Batallas sin checkpoint se abren en ensayo; un hito de fábrica solo desde su checkpoint, porque su planta depende
// de lo fabricado antes.
const etapasDisponibles = ctx => ctx.batallasV2.etapas.filter(h => !esFabrica(h) || ctx.checkpointsV2?.lista.some(cp => cp.hito === h));

// Las etapas sin checkpoint se abren en ensayo para conservar el progreso de campaña.
function elegirEtapa(ctx, hito, programas) {
  if (!hito) return;
  if (ctx.checkpointsV2?.lista.some(cp => cp.hito === hito)) {
    if (ctx.partida) volverACheckpoint(ctx, hito, programas);
    else if (ctx.checkpointsV2.volver(hito, programas)) location.reload();
    return;
  }
  if (esFabrica(hito)) return;
  const url = new URL(location.href);
  if (ctx.batallasV2.modo === 'paridad' && ctx.batallasV2.batallas.includes(hito)) {
    url.searchParams.set('batalla', hito);
  } else {
    url.searchParams.delete('modo');
    url.searchParams.delete('batalla');
    url.searchParams.set('ensayo', hito);
  }
  location.assign(url.href);
}

export function instalarInterfazV2(ctx) {
  const runtime = ctx.runtime;
  if (ctx.fabricaV2) return { vinculos: null, uiHito: hudFabrica(ctx) };
  if (ctx.batallasV2 && !runtime) {
    const hud = montarHudHito(ctx, ctx.$('campo'), {
      sinGestos: true, titulo: () => ctx.textoReto('titulo'), texto: () => ctx.textoReto('objetivo'),
      etapas: () => etapasDisponibles(ctx), actual: () => ctx.partida.mundo.hito,
      ajustes: () => ctx.$('b-ajustes').click(), volver: h => elegirEtapa(ctx, h, false),
    });
    return { vinculos: null, uiHito: { ...hud,
      metas: filas => hud.metas(filas, ctx.$('metas')) } };
  }
  return { vinculos: runtime?.crearVinculos(ctx), uiHito: runtime?.montarInterfaz(ctx) };
}

// Hito de fábrica: el mismo HUD que en las Batallas (misión, etapas con checkpoint, idioma y ajustes). Las metas se
// pintan además en la barra del campo con el presupuesto, la energía y la bodega de la sesión Campaign.
function hudFabrica(ctx) {
  const fabrica = ctx.fabricaV2;
  const hud = montarHudHito(ctx, ctx.$('campo'), {
    fabrica: true, titulo: () => ctx.textoReto('titulo'), texto: () => ctx.textoReto('objetivo'),
    // Como en las Batallas: las que no tienen checkpoint se abren en ensayo; los hitos de fábrica, solo desde el suyo.
    etapas: () => fabrica.etapas.filter(h => !esFabrica(h) || fabrica.tieneCheckpoint(h)), actual: () => fabrica.hito,
    ajustes: () => ctx.$('b-ajustes').click(),
    volver: hito => {
      if (fabrica.tieneCheckpoint(hito)) { if (fabrica.volver(hito)) location.reload(); return; }
      if (!hito || esFabrica(hito)) return;
      const url = new URL(location.href);
      url.searchParams.set('ensayo', hito);
      location.assign(url.href);
    },
  });
  return { ...hud, metas(filas) {
    const cambio = hud.metas(filas);
    const html = filas.map(f => `<span class="meta${f.estado === 'ok' ? ' cumplida' : f.estado === 'rota' ? ' rota' : ''}">${f.nombre} <b>${f.valor}</b></span>`).join('')
      + ctx.uiC.hudExtra();
    if (html === ctx.metasClave) return cambio;
    ctx.metasClave = html;
    ctx.$('metas').innerHTML = html;
    return true;
  } };
}

// El campo, los gestos y las etiquetas manejan casillas; la cámara y su rayo, metros.
export function adaptarVistaMetros(vista, escenaMetros) {
  if (!vista) return null;
  const origen = () => escenaMetros().marco.origen;
  return Object.assign({}, vista, {
    alSuceso(s) {
      if (Number.isFinite(s.datos?.x) && Number.isFinite(s.datos?.y))
        vista.alSuceso({ ...s, datos: puntoEnMetros(s.datos, origen()) });
      else vista.alSuceso(s);
    },
    suelo(x, y) { const p = vista.suelo(x, y); return p && puntoEnMarco(p, origen()); },
    proyectar(x, alto, y) { const p = puntoEnMetros({ x, y }, origen()); return vista.proyectar(p.x, alto, p.y); },
    proyectarUnidad: vista.proyectarUnidad && ((e, alto) => {
      const p = puntoEnMetros({ x: e.cx ?? e.x, y: e.cy ?? e.y }, origen());
      return vista.proyectarUnidad({ clase: e.clase, cx: p.x, cy: p.y }, alto);
    }),
    centrar(x, y) { const p = puntoEnMetros({ x, y }, origen()); vista.centrar(p.x, p.y); },
  });
}
