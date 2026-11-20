// La rejilla original es común a las dos mitades, incluso después de girar la bisagra.
import { FISICA, PUENTE } from './tablas.js';
import { componentes, vecinosDe6, cajaVolumen } from './celdas.js';
import { emitir, familia, soltar, masa, centroGrupo, revisarReposo, actualizarRobot } from './vuelo.js';
import { suma, resta, escalar, punto, global, norma, rotar, producto, unidad, conj } from './geometria.js';

export function apoyo(w, p, grupos) {
  const parches = p.padre !== null ? p.contacto : p.salida === 'en-pie'
    ? w.piezas.filter(h => h.vivas && h.padre === p.uid).flatMap(h => h.contactoPadre) : [];
  const indices = new Set(parches);
  return indices.size ? grupos.find(g => g.some(i => indices.has(i))) : undefined;
}
const promedio = (g, indices) => escalar(indices.reduce((s, i) => suma(s, g.centros[i]), [0, 0, 0]), 1 / indices.length);

export function razonCarga(m, centro, pivote, n, aguante) {
  if (!n) return Number.MAX_VALUE; // El JSON del guardado también debe ser finito.
  const brazo = resta(centro, pivote), peso = m * FISICA.gravedad;
  return Math.max(peso * Math.hypot(brazo[0], brazo[1]) / (PUENTE.flexion * n ** 1.5),
    brazo[2] < -1e-10 ? peso / (PUENTE.traccion * n) : 0) / aguante;
}

function cargaLado(w, p, grupo, hijas) {
  let m = masa(p, grupo.length), s = escalar(global(p, promedio(p.g, grupo)), m);
  for (const h of hijas) {
    for (const q of familia(w, h)) {
      const k = masa(q);
      m += k; s = suma(s, escalar(global(q, q.centro), k));
    }
  }
  return { m, centro: escalar(s, 1 / m) };
}

function cuelloEnPlano(w, p, eje, capa, banda) {
  const { dim } = p.g, salto = [1, dim[0], dim[0] * dim[1]][eje];
  if (capa <= 0 || capa >= dim[eje] - 1) return null;
  const cuello = banda.filter(i => Math.floor(i / salto) % dim[eje] === capa);
  if (!cuello.length) return null;
  const mask = p.mask.slice();
  for (const i of cuello) mask[i] = 0;
  const grupos = componentes({ g: p.g, mask }).filter(g => g.length > FISICA.escoria);
  if (grupos.length < 2) return null;
  const ancla = apoyo(w, p, grupos) ?? (p.padre === null ? grupos[0] : null);
  if (!ancla) return null;
  const etiquetas = new Int32Array(mask.length), fijo = grupos.indexOf(ancla) + 1;
  grupos.forEach((g, k) => { for (const i of g) etiquetas[i] = k + 1; });
  const parches = new Map(), lados = [];
  for (const i of cuello) {
    const vecinos = vecinosDe6(i, dim[0], dim[1]);
    const apoyo = vecinos.filter(j => etiquetas[j] === fijo);
    if (!apoyo.length) continue;
    const cargas = new Map();
    for (const j of vecinos) {
      const grupo = etiquetas[j];
      if (!grupo || grupo === fijo) continue;
      if (!cargas.has(grupo)) cargas.set(grupo, []);
      cargas.get(grupo).push(j);
    }
    for (const [grupo, carga] of cargas) {
      if (!parches.has(grupo)) parches.set(grupo, []);
      parches.get(grupo).push({ i, apoyo, carga });
    }
  }
  const hijas = w.piezas.filter(h => h.padre === p.uid && h.vivas);
  for (const [etiqueta, enlaces] of parches) {
    const grupo = grupos[etiqueta - 1];
    const pivote = promedio(p.g, enlaces.map(e => e.i));
    const montadas = hijas.filter(h => etiquetas[h.contactoPadre.find(i => p.mask[i])] === etiqueta);
    const { m, centro } = cargaLado(w, p, grupo, montadas);
    const razon = razonCarga(m, centro, global(p, pivote), enlaces.length, p.d.aguante);
    lados.push({ grupo, enlaces, pivote, razon });
  }
  return lados.length ? lados : null;
}

export function detectar(w, p, v, vivas) {
  if (!['reposo', 'en-pie'].includes(p.salida)) return null;
  const { min, dim } = p.g, lado = FISICA.celda, radio = v.radio + PUENTE.capas * lado;
  const ab = resta(v.b, v.a), l2 = punto(ab, ab);
  const limite = (x, k) => Math.max(0, Math.min(dim[k] - 1, Math.floor((x - min[k]) / lado)));
  const banda = [], medias = v.a.map((a, k) => (limite(a, k) + limite(v.b[k], k)) / 2);
  for (const i of cajaVolumen(p.g, v, radio)) {
    if (!p.mask[i]) continue;
    const ap = resta(p.g.centros[i], v.a);
    const t = l2 ? Math.min(1, Math.max(0, punto(ap, ab) / l2)) : 0;
    if (norma(resta(ap, escalar(ab, t))) <= radio) banda.push(i);
  }
  let mejor = null, n = Infinity;
  for (let k = 0; k < 3; k++) {
    // Las dos capas que rodean el centro del volumen, con desempate estable x, y, z.
    const u = Math.max(0, Math.min(dim[k] - 1, ((v.a[k] + v.b[k]) / 2 - min[k]) / lado - .5));
    const centro = ab[k] ? medias[k] : u;
    const primera = Math.max(0, Math.min(dim[k] - 2, Math.floor(centro + 1e-10)));
    for (let capa = primera; capa < primera + PUENTE.capas; capa++) {
      const lados = cuelloEnPlano(w, p, k, capa, banda);
      if (!lados) continue;
      const seccion = Math.min(...lados.map(h => h.enlaces.length));
      if (seccion < n) { mejor = lados; n = seccion; }
    }
  }
  const lados = mejor?.filter(h => h.razon >= PUENTE.ceder);
  if (!lados?.length) return null;
  const moviles = new Set(lados.flatMap(h => h.grupo));
  return { grupos: [vivas.filter(i => !moviles.has(i)), ...lados.map(h => h.grupo)], lados };
}

export function colgar(w, p, h, lado) {
  const pivote = global(p, lado.pivote), brazo = resta(centroGrupo(familia(w, h)), pivote);
  let eje = [-brazo[1], brazo[0], 0];
  eje = norma(eje) > 1e-10 ? unidad(eje) : [0, 1, 0];
  h.padre = p.uid;
  h.contacto = [...new Set(lado.enlaces.flatMap(e => e.carga))];
  h.contactoPadre = lado.enlaces.map(e => e.i);
  h.puente = { enlaces: lado.enlaces, local: lado.pivote, eje: rotar(conj(p.rot), eje),
    seccion: lado.enlaces.length, razon: lado.razon, angulo: 0, omega: 0 };
  if (lado.razon >= 1) romper(w, h, 'peso');
  else emitir(w, h, 'puente-cede', { seccion: h.puente.seccion, razon: lado.razon });
}

export function romper(w, h, motivo, impulso = [0, 0, 0], pos = h.pos) {
  const b = h.puente;
  emitir(w, h, 'puente-roto', { seccion: b.seccion, razon: b.razon, motivo });
  soltar(w, h, motivo, impulso, pos);
}

export function actualizarPuentes(w, girar) {
  for (const h of w.piezas) {
    const b = h.puente;
    if (!b || !h.vivas) continue;
    const p = w.piezas[h.padre];
    if (b.uidPadre !== p.uid || b.versionPadre !== p.version || b.versionHija !== h.version) {
      const vivos = b.enlaces.filter(e => p.mask[e.i] && e.apoyo.some(i => p.mask[i]) && e.carga.some(i => h.mask[i]));
      b.seccion = vivos.length;
      if (b.seccion && p.salida !== 'vuelo') {
        b.local = promedio(p.g, vivos.map(e => e.i));
        const ajuste = resta(global(p, b.local), global(h, b.local));
        for (const q of familia(w, h)) q.pos = suma(q.pos, ajuste);
      }
      b.uidPadre = p.uid; b.versionPadre = p.version; b.versionHija = h.version;
    }
    const n = b.seccion;
    if (p.salida === 'vuelo' && n) { b.omega = 0; continue; }
    const grupo = familia(w, h), pivote = global(p, b.local), centro = centroGrupo(grupo);
    b.razon = razonCarga(grupo.reduce((s, q) => s + masa(q), 0), centro, pivote, n, h.d.aguante);
    if (b.razon >= 1) { romper(w, h, 'peso'); actualizarRobot(w, h.robot); continue; }
    if (!girar) continue;
    const meta = PUENTE.caidaMax * (b.razon - PUENTE.ceder) / (1 - PUENTE.ceder);
    const eje = rotar(p.rot, b.eje), brazo = resta(centro, pivote);
    const horizontal = eje[1] * brazo[0] - eje[0] * brazo[1];
    const hastaLaVertical = horizontal > 1e-10 ? Math.atan2(horizontal, -brazo[2]) : 0;
    const delta = Math.max(0, Math.min(PUENTE.giroPorPaso, meta - b.angulo, hastaLaVertical));
    b.omega = delta / FISICA.dt;
    if (!delta) continue;
    const giro = [...escalar(eje, Math.sin(delta / 2)), Math.cos(delta / 2)];
    for (const q of grupo) {
      q.pos = suma(pivote, rotar(giro, resta(q.pos, pivote)));
      q.rot = unidad(producto(giro, q.rot));
    }
    b.angulo += delta;
    revisarReposo(w, h);
  }
}
