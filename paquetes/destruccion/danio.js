import { ARMAS, FISICA, PUENTE } from './tablas.js';
import { local, resta, suma, escalar, norma, unidad, punto, hash, ruidoSuave } from './geometria.js';
import { componentes, entradaRayo, cajaVolumen } from './celdas.js';
import { actualizarMascara } from './estado.js';
import { soltar, emitir, actualizarRobot, campoVelocidad, revisarReposo } from './vuelo.js';
import { detectar, apoyo, colgar, actualizarPuentes, romper } from './puente.js';

function seleccionable(p) { return p.vivas && !['oculto', 'saliendo'].includes(p.salida); }
export function buscar(w, origen, direccion, limite = Infinity) {
  let mejor = null;
  for (const p of w.piezas) if (seleccionable(p)) {
    const h = entradaRayo(p, origen, direccion, mejor?.distancia ?? limite);
    if (h && (!mejor || h.t < mejor.distancia)) mejor = {
      uid: p.uid, robot: p.robot, pieza: p.id, fragmento: p.fragmento,
      distancia: h.t, indice: h.indice, pos: suma(origen, escalar(direccion, h.t))
    };
  }
  return mejor;
}
function despertar(w, p) {
  if (!p.reposo) return;
  let r = p;
  while (r.padre !== null) r = w.piezas[r.padre];
  soltar(w, r, 'impacto en reposo');
}
function contabilizar(p, n, informe) {
  if (!informe || !n) return;
  for (const m of p.d.materiales) {
    const linea = informe.quitadas.find(q => q.material === m.material);
    // La mezcla es homogénea: cada celda quitada contiene todos sus materiales.
    const cantidad = n * m.cantidad / p.g.total;
    if (linea) { linea.celdas += n; linea.cantidad += cantidad; }
    else informe.quitadas.push({ material: m.material, celdas: n, cantidad });
  }
}

function repartir(w, p, grupos, corte, lados = null) {
  const original = p.mask, hijas = w.piezas.filter(h => h.vivas && h.padre === p.uid);
  const propietarios = new Map();
  const anclada = lados ? grupos[0] : apoyo(w, p, grupos);
  if (anclada) grupos = [anclada, ...grupos.filter(g => g !== anclada)];
  const funcion = p.funcion, zona = new Set(p.g.modulo);
  let custodio = null, maxZona = 0;
  const campo = campoVelocidad(w, p);
  const nuevos = [];
  for (const [k, grupo] of grupos.entries()) {
    const q = k ? {
      ...p, uid: w.piezas.length, fragmento: ++w.fragmentos, puente: null, padre: null, mov: null, reposo: null,
      pos: [...p.pos], rot: [...p.rot], ...(p.pelicula && { pelicula: structuredClone(p.pelicula) }), acidos: structuredClone(p.acidos), volumenes: structuredClone(p.volumenes)
    } : p;
    q.mask = new Uint8Array(original.length);
    let enZona = 0;
    for (const i of grupo) {
      q.mask[i] = original[i]; propietarios.set(i, q);
      if (zona.has(i)) enZona++;
    }
    q.funcion = null;
    if (enZona > maxZona) { maxZona = enZona; custodio = q; }
    actualizarMascara(q);
    if (k) {
      w.piezas.push(q);
      nuevos.push(q);
      emitir(w, q, 'fragmento', { origen: p.uid });
    }
  }
  if (custodio && maxZona >= zona.size * (1 - FISICA.perdidaFuncion)) custodio.funcion = funcion;
  else if (funcion) emitir(w, p, 'funcion-perdida', { funcion });
  if (!grupos.length) { p.mask.fill(0); actualizarMascara(p); p.estado = null; p.funcion = null; p.mov = null; p.reposo = null; }
  if (p.vivas && p.padre !== null && corte && !anclada && !p.puente) soltar(w, p, 'corte');
  for (const h of hijas) {
    const soporte = h.contactoPadre.map(i => propietarios.get(i)).find(Boolean);
    if (!soporte && h.puente) continue; // Se evalúa después de corroer ambos lados.
    if (!soporte && !corte && p.vivas) continue;
    if (!soporte) soltar(w, h, 'corte', [0, 0, 0], h.pos, campo);
    else if (soporte.uid !== p.uid) {
      h.padre = soporte.uid;
    }
  }
  nuevos.forEach((q, i) => {
    if (lados) colgar(w, p, q, lados[i]);
    else soltar(w, q, 'fragmento', [0, 0, 0], q.pos, campo);
  });
}

function aplicar(w, p, v, informe = null, pintar = false) {
  const ab = resta(v.b, v.a), l2 = punto(ab, ab);
  let quitadas = 0, fundidas = 0;
  const alcance = v.radio + (v.tipo === 'laser' ? ARMAS.laser.anillo : 0);
  for (const i of cajaVolumen(p.g, v, alcance + (pintar ? 2 * FISICA.celda : 0))) {
    if (!p.mask[i]) continue;
    const ap = resta(p.g.centros[i], v.a);
    const f = l2 ? Math.min(1, Math.max(0, punto(ap, ab) / l2)) : 0;
    const d = Math.hypot(ap[0] - ab[0] * f, ap[1] - ab[1] * f, ap[2] - ab[2] * f);
    // Borde del ácido: ruido suave en el espacio local de la pieza (red de 7 cm), no un dado por celda,
    // que dejaba celdas sueltas moteando el hueco.
    if (pintar) {
      const distancia = d - v.radio;
      if (distancia < 2 * FISICA.celda) {
        const fin = v.paso * FISICA.dt + ARMAS.acido.duracion, previa = p.pelicula[i];
        if (!previa) p.pelicula[i] = [distancia, fin];
        else { previa[0] = Math.min(previa[0], distancia); previa[1] = Math.max(previa[1], fin); }
      }
    }
    if (d > alcance) continue;
    const radio = v.tipo === 'acido' ? v.radio * (1 - ARMAS.acido.irregularidad * ruidoSuave(v.hash, p.g.centros[i], .07)) : v.radio;
    if (d <= radio) { p.mask[i] = 0; quitadas++; }
    else if (v.tipo === 'laser' && d <= radio + ARMAS.laser.anillo && p.mask[i] === 1) { p.mask[i] = 2; fundidas++; }
  }
  return resolverDanio(w, p, v, informe, quitadas, fundidas);
}

// Todas las formas de corrosión pasan por el mismo reparto de la máscara y de las monturas.
export function resolverDanio(w, p, v, informe, quitadas, fundidas = 0) {
  const golpe = ['cinetico', 'explosivo'].includes(v.tipo);
  if (!quitadas && !fundidas && !golpe) return false;
  if (golpe) despertar(w, p);
  if (informe && !informe.afectadas.includes(p.uid)) informe.afectadas.push(p.uid);
  contabilizar(p, quitadas, informe);
  if (v.tipo !== 'acido') p.volumenes.push(v);
  p.version++;
  if (v.tipo === 'laser') p.laser += quitadas;
  if (p.laser > p.g.total * FISICA.fraccionFundida) p.estado = 'fundida';
  else if (quitadas && !golpe && p.estado !== 'fundida') p.estado = 'partida';
  else if (p.estado === 'intacta') p.estado = 'dañada';
  if (!quitadas) { actualizarMascara(p); revisarReposo(w, p); return true; }
  const grupos = componentes(p);
  const utiles = grupos.filter(g => g.length > FISICA.escoria);
  contabilizar(p, grupos.filter(g => g.length <= FISICA.escoria).reduce((s, g) => s + g.length, 0), informe);
  const cuello = !golpe && utiles.length === 1 ? detectar(w, p, v, utiles[0]) : null;
  repartir(w, p, cuello?.grupos ?? utiles, !golpe, cuello?.lados);
  revisarReposo(w, p);
  return true;
}
function volumen(w, p, tipo, a, b, radio) {
  return { tipo, a, b, radio, paso: w.paso, hash: hash(w.semilla, p.robot, p.id, p.fragmento, w.disparos) };
}
export function depositar(w, p, pos, hashGota, fuente, potencia, disparo) {
  const perfil = ARMAS[fuente], centro = local(p, pos);
  if (fuente === 'chorro') {
    const cerca = p.acidos.find(a => {
      const v = a.volumen ?? p.volumenes[a.indice];
      return v.fuente === fuente && norma(resta(centro, v.a)) <= perfil.fusion;
    });
    if (cerca) {
      cerca.carga += potencia;
      cerca.final = Math.min(perfil.radioMax, perfil.radio * Math.sqrt(cerca.carga));
      return;
    }
  }
  const inicial = perfil.inicial;
  const v = { tipo: 'acido', fuente, a: centro, b: centro, radio: inicial, paso: w.paso, hash: hashGota, disparo };
  const final = Math.min(perfil.radioMax ?? Infinity, perfil.radio * Math.sqrt(potencia));
  const enMascara = fuente === 'chorro' &&
    p.volumenes.filter(q => q.fuente === fuente).length >= ARMAS.chorro.manchasPorPieza;
  if (enMascara) {
    // Este depósito crece y acepta gotas igual que los seis analíticos. Su borde
    // se pinta en la rejilla local y al secarse se descarta la esfera.
    p.pelicula ??= {};
    p.acidos.push({ volumen: v, inicial, final, carga: potencia });
  } else {
    p.acidos.push({ indice: p.volumenes.length, inicial, final, carga: potencia });
    p.volumenes.push(v);
  }
  aplicar(w, p, v, null, enMascara);
}
function empujar(w, p, fuerza, dir, pos, visitadas, propagar) {
  if (!p?.vivas || visitadas.has(p.uid)) return;
  visitadas.add(p.uid);
  const libre = p.padre === null && p.salida !== 'en-pie';
  const resistencia = p.puente ? PUENTE.impulsoPorCelda * p.puente.seccion * p.d.aguante : p.d.union.resistencia;
  const sobra = fuerza - (libre ? 0 : resistencia);
  if (sobra <= 0) return;
  const vecinas = propagar ? w.piezas.filter(q => q.uid === p.padre || q.padre === p.uid) : [];
  if (p.puente) romper(w, p, 'impulso', escalar(dir, fuerza), pos);
  else soltar(w, p, 'impulso', escalar(dir, fuerza), pos);
  for (const q of vecinas) empujar(w, q, sobra * ARMAS.cinetico.propagacion, dir, pos, visitadas, true);
}

export function disparo(w, { arma, origen, direccion, potencia, duracionAcido }) {
  const inicio = w.eventos.length, impacto = buscar(w, origen, direccion);
  w.disparos++;
  const inf = { impacto, afectadas: [], quitadas: [], unionesRotas: [], funcionesPerdidas: [], sucesos: [] };
  if (!impacto) return inf;
  const blanco = w.piezas[impacto.uid], pos = impacto.pos, perfil = ARMAS[arma];
  emitir(w, blanco, 'impacto', { arma, pos, origen });
  if (arma === 'acido') {
    const a = local(blanco, pos), v = volumen(w, blanco, arma, a, a, perfil.inicial);
    if (duracionAcido !== undefined) v.duracion = duracionAcido;
    blanco.acidos.push({ indice: blanco.volumenes.length, potencia });
    blanco.volumenes.push(v);
    inf.afectadas.push(blanco.uid);
    aplicar(w, blanco, v, inf);
  } else if (arma === 'laser') {
    const fin = suma(pos, escalar(direccion, perfil.alcance * potencia));
    for (const p of w.piezas.filter(seleccionable)) {
      aplicar(w, p, volumen(w, p, arma, local(p, pos), local(p, fin), perfil.radio), inf);
    }
  } else if (arma === 'cinetico') {
    const a = local(blanco, pos);
    aplicar(w, blanco, volumen(w, blanco, arma, a, a, perfil.radio * Math.min(1.2, potencia / blanco.d.aguante)), inf);
    if (blanco.puente) actualizarPuentes(w, false);
    empujar(w, blanco, potencia * perfil.impulso, direccion, pos, new Set(), true);
  } else {
    for (const p of w.piezas.filter(seleccionable)) {
      const a = local(p, pos);
      let cerca = Infinity, superficie = a;
      p.g.centros.forEach((v, i) => {
        if (!p.mask[i]) return;
        const d = norma(resta(v, a));
        if (d < cerca) { cerca = d; superficie = v; }
      });
      const caida = 1 - cerca / perfil.radio;
      if (caida <= 0) continue;
      const delta = resta(p.pos, pos);
      aplicar(w, p, volumen(w, p, arma, superficie, superficie, perfil.crater * caida * Math.min(2, Math.sqrt(potencia / p.d.aguante))), inf);
      empujar(w, p, potencia * perfil.impulso * caida, norma(delta) ? unidad(delta) : direccion, pos, new Set(), false);
    }
  }
  actualizarPuentes(w, false);
  for (const r of w.robots) actualizarRobot(w, r.id);
  inf.sucesos = structuredClone(w.eventos.slice(inicio));
  inf.unionesRotas = inf.sucesos.filter(e => e.tipo === 'union-rota');
  inf.funcionesPerdidas = inf.sucesos.filter(e => e.tipo === 'funcion-perdida');
  for (const e of inf.sucesos) {
    const p = w.piezas.find(p => p.robot === e.unidad && p.id === e.datos.pieza && p.fragmento === e.datos.fragmento);
    if (p && !inf.afectadas.includes(p.uid)) inf.afectadas.push(p.uid);
  }
  return inf;
}
export function pasoAcido(w) {
  for (const p of w.piezas.slice()) {
    if (!p.vivas || !p.acidos.length) continue;
    for (const a of p.acidos.slice()) {
      if (!p.vivas) break;
      const v = a.volumen ?? p.volumenes[a.indice];
      const edad = (w.paso - v.paso) * FISICA.dt, f = Math.min(1, edad / (v.duracion ?? ARMAS.acido.duracion));
      const inicial = a.inicial ?? ARMAS.acido.inicial, final = a.final ?? ARMAS.acido.radio * Math.sqrt(a.potencia);
      v.radio = inicial + Math.max(0, final - inicial) * f;
      aplicar(w, p, v, null, !!a.volumen);
      if (f >= 1) p.acidos = p.acidos.filter(x => x !== a);
    }
    actualizarRobot(w, p.robot);
  }
}
