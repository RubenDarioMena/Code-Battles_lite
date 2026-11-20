import { ARMAS, CHARCO, FISICA, PROYECTIL } from './tablas.js';
import { suma, resta, escalar, norma, punto, unidad, cruz, hash, muestra, ruidoSuave, local, rotar, conj, vector } from './geometria.js';
import { buscar, depositar } from './danio.js';
import { alimentarCharco } from './charcos.js';
import { actualizarRobot } from './vuelo.js';

const { granada, chorro } = ARMAS, arriba = [0, 0, 1];
function base(dir) {
  const x = unidad(cruz(dir, Math.abs(dir[2]) < .9 ? arriba : [0, 1, 0]));
  return [x, cruz(dir, x)];
}
function azimut(x, y, angulo) {
  return suma(escalar(x, Math.cos(angulo)), escalar(y, Math.sin(angulo)));
}
function contacto(w, inicio, dir, largo) {
  const suelo = inicio[2] <= 0 && dir[2] <= 0 ? 0 : dir[2] < 0 ? -inicio[2] / dir[2] : Infinity;
  const h = buscar(w, inicio, dir, Math.min(suelo, largo));
  if (h) return { pieza: w.piezas[h.uid], pos: h.pos, indice: h.indice };
  if (suelo > largo) return null;
  const pos = suma(inicio, escalar(dir, suelo)); pos[2] = 0;
  return { pieza: null, pos, indice: null };
}
function normalCelda(h, dir) {
  if (!h.pieza) return arriba;
  const p = h.pieza, delta = resta(local(p, h.pos), p.g.centros[h.indice]);
  // Una trayectoria sobre una junta puede rozar dos caras a la vez. Elegir
  // la cara por la que entra, incluso si el redondeo favorece la otra.
  const entrada = rotar(conj(p.rot), dir), borde = Math.max(...delta.map(Math.abs));
  const incidencia = delta.map((v, i) => Math.abs(v) >= borde - 1e-8 ? -Math.sign(v) * entrada[i] : -Infinity);
  const eje = incidencia.indexOf(Math.max(...incidencia));
  const n = [0, 0, 0]; n[eje] = Math.sign(delta[eje]) || 1;
  const normal = rotar(p.rot, n);
  return punto(normal, dir) > 0 ? escalar(normal, -1) : normal;
}
function suceso(w, tipo, h, datos) {
  w.eventos.push({ paso: w.paso, tipo, unidad: h?.pieza?.robot ?? null, datos: {
    ...datos, ...(h && { pos: [...h.pos] }), ...(h?.pieza && { pieza: h.pieza.id, fragmento: h.pieza.fragmento })
  } });
}
function estallar(w, q, h, dir) {
  const normal = normalCelda(h, dir), [x, y] = base(normal);
  suceso(w, 'granada-estalla', h, { disparo: q.disparo, normal });
  if (h.pieza) depositar(w, h.pieza, h.pos, q.hash, 'acido', q.potencia * granada.potenciaPrincipal, q.disparo);
  else alimentarCharco(w, h.pos, CHARCO.radio * Math.sqrt(q.potencia), q.hash);
  // Repartir el líquido por sectores del plano tangente. La altura del arco
  // permite alcanzar tanto una pieza saliente como una cara algo más retrasada.
  const impactos = [], vuelta = 2 * Math.PI;
  const fase = vuelta * muestra(q.hash, 0), retorno = escalar(normal, -1);
  for (let i = 0; i < granada.satelites; i++) {
    const k = hash(w.semilla, q.disparo, i);
    const angulo = fase + vuelta * (i + .3 * muestra(k, 0)) / granada.satelites;
    const distancia = granada.distanciaMin + (granada.distanciaMax - granada.distanciaMin) * muestra(k, 1);
    const destino = suma(h.pos, escalar(azimut(x, y, angulo), distancia));
    const inicio = suma(destino, escalar(normal, granada.alturaRebote));
    const salida = suma(h.pos, escalar(normal, .0001));
    const vuelo = resta(inicio, salida);
    const sat = contacto(w, salida, unidad(vuelo), norma(vuelo)) ?? contacto(w, inicio, retorno, granada.alcance);
    if (sat?.pieza) {
      depositar(w, sat.pieza, sat.pos, k, 'granada', q.potencia * (.55 + .45 * muestra(k, 2)) ** 2, q.disparo);
      actualizarRobot(w, sat.pieza.robot);
    } else if (sat) alimentarCharco(w, sat.pos, CHARCO.gota * Math.sqrt(q.potencia), k);
    impactos.push({ fin: sat?.pos ?? destino, uid: sat?.pieza?.uid ?? null });
  }
  suceso(w, 'salpicadura', h, { disparo: q.disparo, normal, impactos });
  if (h.pieza) actualizarRobot(w, h.pieza.robot);
}
export function lanzar(w, orden) {
  const { arma, origen, direccion, potencia } = orden;
  const disparo = w.disparos + 1;
  const informe = { impacto: null, afectadas: [], quitadas: [], unionesRotas: [], funcionesPerdidas: [], sucesos: [] };
  if (arma === 'granada') {
    const velocidad = orden.velocidad ?? granada.velocidad;
    if (!Number.isFinite(velocidad) || velocidad <= 0) throw TypeError('Velocidad inválida');
    const q = { tipo: arma, disparo, origen, pos: origen, velocidad: escalar(direccion, velocidad), potencia,
      paso: w.paso, hash: hash(w.semilla, disparo, -1) };
    w.proyectiles.push(q); w.disparos = disparo;
    return { ...informe, proyectil: structuredClone(q) };
  }
  const { modo = 'directo', duracion = chorro.duracion, viento = [0, 0, 0] } = orden;
  if (!['directo', 'caotico'].includes(modo) || !vector(viento, 3) || !Number.isFinite(duracion) || duracion <= 0) throw TypeError('Chorro inválido');
  const e = { disparo, origen, direccion, potencia, modo, viento: [...viento], pasos: Math.ceil(duracion / FISICA.dt), indice: 0, presion: 1 };
  w.emisores.push(e); w.disparos = disparo;
  return { ...informe, emisor: structuredClone(e) };
}

function emitirGotas(w) {
  let vivas = w.proyectiles.reduce((n, q) => n + Number(q.tipo === 'gota'), 0);
  for (const e of w.emisores) {
    const f = e.indice / Math.max(1, e.pasos - 1);
    const cola = Math.max(0, (f - chorro.fasePlena) / (1 - chorro.fasePlena));
    e.presion = 1 - (1 - chorro.presionMin) * cola;
    if (vivas < chorro.gotasMax) {
      const k = hash(w.semilla, e.disparo, e.indice), perfil = chorro[e.modo];
      const [x, y] = base(e.direccion);
      const angulo = perfil.cono * (1 + chorro.aperturaFinal * cola) * muestra(k, 0) ** (e.modo === 'directo' ? chorro.concentracion : 1);
      const dir = unidad(suma(e.direccion, escalar(azimut(x, y, muestra(k, 1) * 2 * Math.PI), Math.tan(angulo))));
      w.proyectiles.push({ tipo: 'gota', disparo: e.disparo, indice: e.indice, presion: e.presion, paso: w.paso,
        modo: e.modo, potencia: e.potencia, origen: e.origen, pos: e.origen, velocidad: escalar(dir, chorro.velocidad * e.presion),
        viento: e.viento, hash: k });
      vivas++;
    }
    if (++e.indice === e.pasos) suceso(w, 'chorro-fin', null, { disparo: e.disparo });
  }
  w.emisores = w.emisores.filter(e => e.indice < e.pasos);
}
export function pasoProyectiles(w) {
  emitirGotas(w);
  w.proyectiles = w.proyectiles.filter(q => {
    const dt = FISICA.dt, edad = (w.paso - q.paso) * dt, aceleracion = [0, 0, -FISICA.gravedad];
    if (edad > PROYECTIL.tiempo) return false;
    if (q.tipo === 'gota') {
      const perfil = chorro[q.modo];
      const coord = [q.pos[0], q.pos[1], q.pos[2] + edad];
      for (let k = 0; k < 3; k++) {
        aceleracion[k] += perfil.arrastre * (q.viento[k] - q.velocidad[k]);
        if (perfil.turbulencia) aceleracion[k] += perfil.turbulencia * (2 * ruidoSuave(q.hash + k, coord, chorro.escalaRuido) - 1);
      }
    }
    const delta = escalar(suma(q.velocidad, escalar(aceleracion, .5 * dt)), dt);
    const largo = norma(delta), dir = largo ? escalar(delta, 1 / largo) : arriba;
    const h = contacto(w, q.pos, dir, largo);
    const fin = h?.pos ?? suma(q.pos, delta);
    if (norma(resta(fin, q.origen)) > PROYECTIL.alcance) return false;
    if (h) {
      if (q.tipo === 'granada') estallar(w, q, h, dir);
      else {
        if (h.pieza) {
          depositar(w, h.pieza, h.pos, q.hash, 'chorro', q.potencia, q.disparo);
          actualizarRobot(w, h.pieza.robot);
        } else alimentarCharco(w, h.pos, CHARCO.gota * Math.sqrt(q.potencia), q.hash);
        suceso(w, 'gota', h, { disparo: q.disparo, indice: q.indice, presion: q.presion });
      }
      return false;
    }
    q.pos = fin; q.velocidad = suma(q.velocidad, escalar(aceleracion, dt));
    return true;
  });
}
