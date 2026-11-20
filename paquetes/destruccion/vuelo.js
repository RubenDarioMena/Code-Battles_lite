import { FISICA } from './tablas.js';
import { penetracion, resolverContacto } from './contacto.js';
import { resto } from './estado.js';
import { suma, resta, punto, escalar, norma, unidad, rotar, conj, producto, cruz, eje, muestra, hash, global } from './geometria.js';

export function familia(w, p) {
  const grupo = [p];
  for (let i = 0; i < grupo.length; i++) {
    for (const hija of w.piezas) if (hija.vivas && hija.padre === grupo[i].uid) grupo.push(hija);
  }
  return grupo;
}
export function emitir(w, p, tipo, datos = {}) {
  w.eventos.push({ paso: w.paso, tipo, unidad: p.robot, datos: { pieza: p.id, fragmento: p.fragmento, ...structuredClone(datos) } });
}
// Centro de masa de la máscara. La suma de cantidades da la masa provisional.
export function masa(p, vivas = p.vivas) {
  return p.d.materiales.reduce((s, m) => s + m.cantidad, 0) * vivas / p.g.total;
}
export function centroGrupo(grupo) {
  let m = 0, sum = [0, 0, 0];
  for (const p of grupo) {
    const k = masa(p); m += k;
    sum = suma(sum, escalar(global(p, p.centro), k));
  }
  return escalar(sum, 1 / m);
}
function raiz(w, p) {
  while (p.padre !== null) p = w.piezas[p.padre];
  return p;
}
// Capturar antes de cambiar la topología. Un punto de un cuerpo rígido hereda
// v + ω × (punto - centro), incluso si se separa a mitad del vuelo.
export function campoVelocidad(w, p) {
  const r = raiz(w, p);
  if (r.mov) return { v: [...r.mov.v], w: [...r.mov.w], centro: centroGrupo(familia(w, r)) };
  let campo = null;
  for (let q = p; q.padre !== null; q = w.piezas[q.padre]) {
    const b = q.puente;
    if (!b?.omega) continue;
    const padre = w.piezas[q.padre], omega = escalar(rotar(padre.rot, b.eje), b.omega);
    campo ??= { centro: [...p.pos], v: [0, 0, 0], w: [0, 0, 0] };
    campo.w = suma(campo.w, omega);
    campo.v = suma(campo.v, cruz(omega, resta(campo.centro, global(padre, b.local))));
  }
  return campo;
}
export function soltar(w, p, motivo, impulso = [0, 0, 0], impacto = p.pos, campo = campoVelocidad(w, p)) {
  const grupo = familia(w, p);
  const mov = campo ? { v: suma(campo.v, cruz(campo.w, resta(centroGrupo(grupo), campo.centro))), w: [...campo.w], quietos: 0 }
    : { v: [0, 0, 0], w: [0, 0, 0], quietos: 0 };
  if (p.padre !== null) emitir(w, p, 'union-rota', { padre: p.padre, motivo });
  p.puente = null; p.padre = null; p.mov = mov;
  if (norma(impulso) > 0) {
    const m = grupo.reduce((s, q) => s + masa(q), 0);
    const h = hash(w.semilla, p.robot, p.id, p.fragmento, w.disparos);
    mov.v = suma(mov.v, escalar(impulso, 1 / m));
    mov.v[2] += norma(impulso) / m * (.18 + .08 * muestra(h, 0));
    const brazo = resta(impacto, centroGrupo(grupo));
    const inercia = m * Math.max(.025, p.g.dim.reduce((s, n) => s + (n * FISICA.celda) ** 2, 0) / 12);
    mov.w = suma(mov.w, suma(escalar(cruz(brazo, impulso), 1 / inercia), [1, 2, 3].map(i => muestra(h, i) - .5)));
  }
  for (const q of grupo) {
    if (q.salida !== 'vuelo') emitir(w, q, 'pieza-suelta', { motivo });
    q.salida = 'vuelo'; q.reposo = null;
  }
}

// Una pieza queda como resto: guarda dónde y cómo quedó, y lo anuncia.
export function reposar(w, p) {
  p.salida = 'reposo'; p.reposo = resto(w, p);
  emitir(w, p, 'reposo', { pos: [...p.pos], rot: [...p.rot] });
}

// Tras un corte, una pieza en reposo conserva el apoyo si aún toca suelo u otro grupo.
export function revisarReposo(w, p) {
  if (!p.vivas || p.salida !== 'reposo') return;
  const r = raiz(w, p), grupo = familia(w, r), margen = FISICA.contactoReposo;
  if (!grupo.some(q => suelo(q) <= margen) && !penetracion(w, grupo, margen)) {
    soltar(w, r, 'apoyo perdido');
    return;
  }
  for (const q of grupo) q.reposo = resto(w, q);
}

export function actualizarRobot(w, robot) {
  const r = w.robots.find(r => r.id === robot);
  if (r.caido) return;
  const enPie = w.piezas.filter(p => p.robot === robot && p.vivas && p.salida === 'en-pie');
  if (enPie.length && r.def.piezas.every(d => d.funcion !== 'energia' || enPie.some(p => p.id === d.id && p.funcion === 'energia'))) return;
  r.caido = true;
  const testigo = w.piezas.find(p => p.robot === robot);
  emitir(w, testigo, 'robot-caido');
  for (const p of enPie) if (p.padre === null) soltar(w, p, 'robot-caido');
}

// Extremo inferior analítico en una primitiva entera. En cortes se intersecta
// esa cota con el soporte de las columnas ocupadas de la máscara.
export function suelo(p) {
  const vertical = rotar(conj(p.rot), [0, 0, 1]), f = p.d.forma;
  let soporte;
  if (f.tipo === 'esfera') soporte = f.radio;
  else if (f.tipo === 'cilindro') {
    const c = vertical[eje(f)];
    soporte = Math.abs(c) * f.alto / 2 + f.radio * Math.sqrt(Math.max(0, 1 - c * c));
  } else soporte = f.medidas.reduce((s, m, i) => s + m * Math.abs(vertical[i]) / 2, 0);
  if (p.vivas < p.g.total) {
    let bajo = Infinity;
    for (const v of p.extremos) bajo = Math.min(bajo, punto(v, vertical));
    const margen = FISICA.celda / 2 * vertical.reduce((s, n) => s + Math.abs(n), 0);
    soporte = Math.min(soporte, margen - bajo);
  }
  return p.pos[2] - soporte;
}
export function pasoVuelo(w, registrar) {
  const dt = FISICA.dt;
  for (const p of w.piezas) {
    if (!p.vivas || p.salida !== 'vuelo' || p.padre !== null) continue;
    const mov = p.mov, grupo = familia(w, p), centro = centroGrupo(grupo);
    mov.v[2] -= FISICA.gravedad * dt;
    const omega = norma(mov.w), medio = omega * dt / 2;
    const giro = [...escalar(mov.w, omega ? Math.sin(medio) / omega : 0), Math.cos(medio)];
    const destino = suma(centro, escalar(mov.v, dt));
    const anteriores = grupo.map(q => ({ pos: q.pos, rot: q.rot }));
    let fondo = Infinity;
    for (const q of grupo) {
      q.rot = unidad(producto(giro, q.rot));
      q.pos = suma(destino, rotar(giro, resta(q.pos, centro)));
      fondo = Math.min(fondo, suelo(q));
    }
    if (fondo <= 0) {
      for (const q of grupo) q.pos[2] -= fondo;
      mov.v = [mov.v[0] * FISICA.friccion, mov.v[1] * FISICA.friccion, Math.abs(mov.v[2]) * FISICA.restitucion];
      mov.w = escalar(mov.w, FISICA.amortiguacion);
    }
    const apoyo = resolverContacto(w, grupo, mov, anteriores);
    // Apoyado y casi quieto: sirve de obstáculo a los demás grupos aunque aún no sea un resto (por ejemplo,
    // un robot caído al que el ácido todavía corroe).
    mov.apoyado = (fondo <= 0 || apoyo) && norma(mov.v) < FISICA.umbral && norma(mov.w) < FISICA.umbral;
    mov.quietos = (fondo <= 0 || apoyo) && norma(mov.v) < FISICA.umbral && norma(mov.w) < FISICA.umbral
      && grupo.every(q => !q.acidos.length) ? mov.quietos + 1 : 0;
    if (mov.quietos >= FISICA.pasosReposo) {
      for (const q of grupo) registrar(q);
      p.mov = null;
    }
  }
}
