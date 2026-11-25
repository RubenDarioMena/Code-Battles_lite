import { montarInterfazHito, montarHudHito } from '../../interfaz/index.js';
import { crearVinculos } from './vinculos-v2.js';
import { volverACheckpoint } from './checkpoints-v2.js';
import { crearFicha3D, crearVistaCV2 } from '../../vista-3d/index.js';
import { instalarGestosClic } from './gestos-clic.js';
import { crearExtensionV2 } from './proveedor-v2.js';
import { crearPlanoCampaign, dibujarIconoHito } from '../../vista-2d/index.js';
import war, { retos, fijarSuministro, pasoConIntentoPuntual, leerEnemigos, danoEnArea, MISIL } from '../../reglas-war/index.js';
import { crearReglamento, puntoEnMarco, puntoEnMetros, salida, fichas, mundoPantalla, piezasMoviles, fichaClic, lugarDeObjetivo, repartirClic, niveles, validarNivel } from '../../reglas-campaign-v2/index.js';

export function componerCampaignV2(params, contenido = niveles['nivel-1'], catalogo = undefined) {
  const errores = validarNivel('nivel-1', contenido, war.api.tipos, catalogo);
  if (errores.length) throw new Error(errores.join('\n'));
  const { hitos } = contenido.default;
  const modo = params.get('modo') === 'paridad' ? 'paridad' : params.has('ensayo') ? 'ensayo' : 'campaign';
  const clave = (modo === 'paridad' ? params.get('batalla') ?? 'b1' : params.get('ensayo')) ?? hitos[0];
  const ensayo = modo === 'ensayo' && clave === salida.clave ? salida : null;
  if ((!ensayo && !hitos.includes(clave)) || (modo === 'paridad' && clave === 'h0'))
    throw new Error(`nivel-1/nivel.js · hitos · Batalla desconocida: ${clave}`);
  // La pantalla de War numera solo las Batallas. H0 se dibuja con el plano de Campaign.
  const batallas = hitos.filter(h => h !== 'h0');
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
    const hito = indice === -1 ? 'h0' : batallas[indice];
    if (modo === 'paridad' && !('war' in contenido[hito]) && !/^b[1-5]$/.test(hito))
      throw new Error(`${hito}.js · war · sin reto original para paridad`);
    return { hito, modo, reto: porHito[hito] ?? null };
  }
  return {
    reglas: crearReglamento({ ...war, fijarSuministro, pasoConIntentoPuntual, leerEnemigos, danoEnArea, velMisil: MISIL.vel }, contenido, porHito),
    runtime: modo !== 'paridad' ? { aislarErrores: true, iconoUnidad: dibujarIconoHito, crearVinculos, montarInterfaz: ctx => montarInterfazHito(ctx, {
      crearFicha: canvas => crearFicha3D(canvas, ctx.servicios, ctx.TIPOS),
      volver: (h, programas) => elegirEtapa(ctx, h, programas),
    }), crearVista3D: crearVistaCV2, instalarGestosClic, camaraPlano: { zoom: 1, x: 0, y: 0 }, crearExtension: traducir => crearExtensionV2(activas, traducir, catalogo), repartirClic,
      tiposHostiles, eventos: activas.flatMap(f => f.eventos ?? []).map(e => [e.objeto, e.nombre].filter(Boolean).join('.')), piezas: { lugarDeObjetivo, ...piezasMoviles }, repetir: params.get('repetir') === '1' } : null,
    etapas: [...hitos, salida.clave], reglasProgramas: war, modo, batallas, indiceInicial: batallas.indexOf(clave),
    retos: batallas.map(h => porHito[h]), escenario, h0: contenido.h0,
    mundoPantalla,
  };
}

// Las etapas sin checkpoint se abren en ensayo para conservar el progreso de campaña.
function elegirEtapa(ctx, hito, programas) {
  if (ctx.checkpointsV2?.lista.some(cp => cp.hito === hito)) {
    if (ctx.partida) volverACheckpoint(ctx, hito, programas);
    else if (ctx.checkpointsV2.volver(hito, programas)) location.reload();
    return;
  }
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
  if (ctx.batallasV2 && !runtime) {
    const hud = montarHudHito(ctx, ctx.$('campo'), {
      sinGestos: true, titulo: () => ctx.textoReto('titulo'), texto: () => ctx.textoReto('objetivo'),
      etapas: () => ctx.batallasV2.etapas, actual: () => ctx.partida.mundo.hito,
      ajustes: () => ctx.$('b-ajustes').click(), volver: h => elegirEtapa(ctx, h, false),
    });
    return { vinculos: null, uiHito: { ...hud,
      metas: filas => hud.metas(filas, ctx.$('metas')) } };
  }
  return { vinculos: runtime?.crearVinculos(ctx), uiHito: runtime?.montarInterfaz(ctx) };
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

// H0 comparte el paisaje de la Batalla y conserva el plano de Campaign. Al alcanzar B1 se monta la interfaz de combate habitual.
export function abrirFabrica(ctx, empezarBatalla) {
  const config = ctx.batallasV2;
  if (!config) return false;
  document.title = 'Code Battle Lite · Campaign-V2';
  const historial = ctx.checkpointsV2;
  const cp = historial?.ultimo();
  if (cp ? cp.hito !== 'h0' : config.indiceInicial !== -1) return false;
  const escenario = { ...config.escenario(-1), checkpoint: cp ?? null, ...historial?.actuales };
  const partida = ctx.crearPartida({ reglas: config.reglas, escenario, semilla: 1 });
  const m = partida.mundo;
  if (historial && !cp) historial.guardar(m);
  const seccion = ctx.$('fabrica-v2'), canvas = ctx.$('plano-h0');
  ctx.$('app').hidden = true;
  seccion.hidden = false;
  const css = getComputedStyle(document.documentElement);
  const col = Object.fromEntries(['suelo', 'edge', 'ink', 'accent', 'bg', 'building', 'rol-fabrica']
    .map(k => [k, css.getPropertyValue('--' + k).trim()]));
  const dibujar = crearPlanoCampaign({ get escena() { return config.reglas.escena(m); }, col, seleccionadas: [] },
    { iconoUnidad: config.runtime.iconoUnidad, $c2d: canvas, ctx2: canvas.getContext('2d'), funcionDe: ctx.funcionDe, radioDe: ctx.radioDe,
      rgba: (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0'),
      mapa: config.h0.mapa, reglas: { esRobot: e => e.clase === "obrero" || e.clase === "montacargas" } });
  const lienzo3d = ctx.$('volumen-h0'), selector = ctx.$('vista-h0');
  const volumen = config.runtime.crearVista3D(ctx.$('campo-h0'), { ...ctx.servicios, canvas: lienzo3d,
    $: ctx.$, TIPOS: ctx.TIPOS, dt: ctx.DT, fabrica: true });
  let en3D = !!volumen && ctx.vista === '3d';
  const ajustes = ctx.$('cv2-ajustes-h0'), preferida = ctx.$('cv2-vista-preferida');
  const hud = montarHudHito(ctx, ctx.$('campo-h0'), {
    fabrica: true, titulo: () => ctx.ti18n(config.h0.titulo), texto: () => ctx.ti18n('cv2.h0.texto'),
    etapas: () => config.etapas, actual: () => 'h0',
    volver(hito, programas) { elegirEtapa(ctx, hito, programas); },
    ajustes() {
      for (const el of ajustes.querySelectorAll('[data-cv2-texto]')) el.textContent = ctx.ti18n(el.dataset.cv2Texto);
      ajustes.showModal();
    },
  });
  hud.rotulos();
  function mostrarVista() {
    canvas.hidden = en3D; lienzo3d.hidden = !en3D;
    selector.textContent = ctx.ti18n(en3D ? 'cv2.ui.2d' : 'cv2.ui.volumen');
    preferida.value = en3D ? '3d' : '2d';
    preferida.disabled = !volumen;
    selector.hidden = !volumen;
    if (en3D) volumen.redimensionar();
  }
  function elegirVista(si) {
    en3D = !!volumen && si; ctx.vista = en3D ? '3d' : '2d';
    ctx.guardado.escribir(ctx.PREFIJO + 'vista', ctx.vista);
    mostrarVista();
    if (partida.evaluar()) pintar();
  }
  selector.onclick = () => elegirVista(!en3D);
  preferida.onchange = () => elegirVista(preferida.value === '3d');
  const medida = new ResizeObserver(() => { if (en3D) volumen.redimensionar(); });
  medida.observe(ctx.$('campo-h0'));
  mostrarVista();
  let anterior = performance.now(), acum = 0;
  function pintar() {
    ctx.$('titulo-h0').textContent = ctx.ti18n(config.h0.titulo);
    const [meta] = config.reglas.instantanea(m).metas;
    ctx.$('meta-h0').textContent = ctx.ti18n(meta.k, meta);
    hud.metas([{ nombre: ctx.$('meta-h0').textContent }]);
    if (en3D) volumen.dibujar(null, config.reglas.escenaMetros(m), 0);
    else dibujar();
  }
  function fotograma(ahora) {
    acum += Math.min((ahora - anterior) / 1000, .25);
    anterior = ahora;
    while (acum >= ctx.DT && m.hito === 'h0' && !partida.evaluar()) {
      partida.paso();
      acum -= ctx.DT;
    }
    if (m.hito === 'h0') {
      pintar();
      if (!partida.evaluar()) requestAnimationFrame(fotograma);
      return;
    }
    historial?.guardar(m);
    if (ajustes.open) ajustes.close();
    window.removeEventListener('cmg:idioma', pintar);
    hud.destruir(); preferida.onchange = null;
    medida.disconnect(); volumen?.destruir(); selector.onclick = null;
    dibujar.destruir?.();
    seccion.hidden = true;
    ctx.$('app').hidden = false;
    ctx.retoIdx = config.batallas.indexOf(m.hito);
    empezarBatalla();
  }
  window.addEventListener('cmg:idioma', pintar);
  pintar();
  ctx.__banco = window.__banco = { partida, get mundo() { return m.fabrica; },
    get checkpoints() { return historial?.lista ?? []; } };
  window.__juegoListo = true;
  requestAnimationFrame(fotograma);
  return true;
}
