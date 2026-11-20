// Se ejecuta también desde la suite del paquete con los guiones publicados.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { escenario } from './escenas.js';
import { cargar, FISICA, PUENTE } from '../../paquetes/destruccion/index.js';

const { dt } = FISICA;
function vivos(p) {
  return p.mascara.flatMap((v, i, r) => i % 2 ? [] : Array(r[i + 1]).fill(!!v));
}
const esCasco = p => p.id === 'casco';
const interiores = ps => ps.filter(p => ['bateria', 'motor', 'municion'].includes(p.id));

const granada = escenario('granada');
while (granada.paso() < 198) granada.avanzar();
const impactos = granada.mundo.sucesos().filter(e => e.tipo === 'granada-estalla');
assert.deepEqual(impactos.map(e => [e.paso, e.unidad]), [[43, 'Andador'], [125, null]]);
assert.deepEqual(impactos[0].datos.normal, [0, -1, 0]);
const manchas = granada.mundo.estado().piezas.filter(p => p.robot === 'Andador').flatMap(p =>
  p.volumenes.map(v => ({ fuente: v.fuente, pieza: p.id, radio: v.radio, centro: v.a.map((x, k) => x + p.pos[k]) })));
const principal = manchas.find(m => m.fuente === 'acido'), satelites = manchas.filter(m => m.fuente === 'granada');
assert(principal && principal.radio > .085 && principal.radio < .10);
assert(satelites.length >= 4 && new Set(manchas.map(m => m.pieza)).size >= 2);
const distancia = (a, b) => Math.hypot(...a.centro.map((x, k) => x - b.centro[k]));
const media = satelites.reduce((s, m) => s + distancia(m, principal), 0) / satelites.length;
assert(media >= .10 && satelites.every(m => m.radio < principal.radio));
assert(new Set(satelites.map(m => m.radio.toFixed(2))).size >= 2);
for (const [i, m] of manchas.entries()) for (const otra of manchas.slice(0, i)) {
  assert(distancia(m, otra) > m.radio + otra.radio, 'manchas separadas tras crecer');
}
console.log('Granada a 3,3 s · ' + manchas.length + ' manchas, distancia media ' + (100 * media).toFixed(1) + ' cm.');

const s = escenario('puente');
let guardado, ultimoAngulo = 0, primeraSeccion, antesDeCeder = false, cede, roto;
while (s.paso() < s.finSecuencia) {
  s.avanzar();
  const ps = s.mundo.estado().piezas, original = ps.find(p => p.id === 'cañón' && !p.fragmento);
  const q = ps.find(p => p.puente);
  if (!guardado && !q) {
    // x local = 6 cm, en la mitad atravesada por el ácido. El cilindro intacto tiene 37 celdas ahí.
    const x = Math.floor(.06 / original.celda + original.dim[0] / 2);
    const n = vivos(original).filter((v, i) => v && i % original.dim[0] === x).length;
    if (n > 25 && n < 37) {
      assert.equal(ps.filter(p => p.id === original.id).length, 1);
      antesDeCeder = true;
    }
  }
  if (q) {
    if (cede === undefined) { cede = s.paso(); primeraSeccion = q.puente.seccion; }
    assert.equal(q.padre, original.uid);
    assert(q.puente.angulo >= ultimoAngulo && q.puente.angulo - ultimoAngulo <= PUENTE.giroPorPaso + 1e-9);
    assert(q.puente.seccion < 25);
    ultimoAngulo = q.puente.angulo;
    if (!guardado && ultimoAngulo > 0) guardado = s.mundo.serializar();
  } else if (guardado && !roto) {
    roto = s.paso();
    assert.equal(ps.find(p => p.fragmento).salida, 'vuelo');
  }
}
assert(antesDeCeder && (roto - cede) * dt >= 2 && ultimoAngulo > .1);
const eventos = s.mundo.sucesos().filter(e => e.tipo.startsWith('puente-'));
assert.deepEqual(eventos.map(e => e.tipo), ['puente-cede', 'puente-roto']);
assert(eventos[1].datos.seccion < primeraSeccion && eventos[1].datos.razon >= 1);
const copia = cargar(guardado);
assert.equal(copia.serializar(), guardado);
copia.avanzar((s.paso() - copia.estado().paso) * dt);
assert.equal(copia.serializar(), s.mundo.serializar());

const t = escenario('tanque');
const cascoInicial = t.mundo.estado().piezas.find(esCasco);
assert.equal(cascoInicial.pos[2] - cascoInicial.forma.medidas[2] / 2, 0);
const montajes = JSON.parse(t.mundo.serializar()).piezas;
let referencia = t.mundo.serializar(), previo, pasoCorte;
while (t.paso() < 200) {
  if (!pasoCorte) previo = referencia;
  t.avanzar();
  if (!pasoCorte) {
    if (t.mundo.estado().piezas.filter(esCasco).length === 2) pasoCorte = t.paso();
    else referencia = t.mundo.serializar();
  }
}
assert.equal(pasoCorte, 108);
t.mundo.terminarBatalla();
const e = t.mundo.estado(), cascos = e.piezas.filter(esCasco);
assert.equal(cascos.length, 2);
assert(e.robots[0].caido && e.piezas.every(p => p.salida === 'expuesto'));
const [a, b] = cascos.map(vivos);
assert(a.every((v, i) => !(v && b[i])));
const botin = t.mundo.botin();
assert.equal(botin.restos.filter(r => r.pieza === 'casco').length, 2);
assert.equal(botin.restos.length, 7);
assert.deepEqual(botin.total.funciones, { motor: 1, arma: 2, energia: 1 });
assert.equal(t.mundo.sucesos().filter(e => e.tipo === 'reposo' && e.datos.forzado).length, 0);
for (const h of interiores(e.piezas)) {
  const padre = cascos.find(p => p.uid === h.padre), parche = montajes[h.uid].contactoPadre;
  assert(padre && vivos(padre).some((v, i) => v && parche.includes(i)));
  assert(cascos.filter(p => p !== padre).every(p => !vivos(p).some((v, i) => v && parche.includes(i))));
  assert.equal(padre.fragmento > 0, h.id === 'bateria');
  const resto = botin.restos.find(r => r.pieza === h.id);
  assert.equal(resto.funcion, h.funcionOriginal); assert(resto.etiqueta.includes(h.funcionOriginal));
  assert.deepEqual(resto.materiales, h.materiales);
  // Las dos mitades de este guion caen verticales. Comprueba el volumen de cada vóxel interior
  // contra las celdas de ambas paredes, incluidos los bordes de las celdas no alineadas.
  for (const casco of cascos) {
    assert.deepEqual(casco.rot, [0, 0, 0, 1]); assert.deepEqual(h.rot, casco.rot);
    const pared = vivos(casco), { dim, celda } = casco;
    vivos(h).forEach((v, i) => {
      if (!v) return;
      const indices = [i % h.dim[0], Math.floor(i / h.dim[0]) % h.dim[1], Math.floor(i / (h.dim[0] * h.dim[1]))];
      const c = indices.map((n, k) => (h.pos[k] - casco.pos[k]) / celda + n + .5 + (dim[k] - h.dim[k]) / 2);
      const bajo = c.map(n => Math.floor(n - .5 + 1e-8)), alto = c.map(n => Math.floor(n + .5 - 1e-8));
      for (let z = bajo[2]; z <= alto[2]; z++) for (let y = bajo[1]; y <= alto[1]; y++)
        for (let x = bajo[0]; x <= alto[0]; x++) assert(!pared[x + dim[0] * (y + dim[1] * z)], h.id + ' dentro de la pared');
    });
  }
}

function medir(texto, pasos) {
  const ms = [];
  for (let i = 0; i < 15; i++) {
    const mundo = cargar(texto), inicio = performance.now();
    mundo.avanzar(pasos * dt);
    if (i >= 3) ms.push((performance.now() - inicio) / pasos);
  }
  return ms.sort((a, b) => a - b)[Math.floor(ms.length / 2)].toFixed(3);
}
console.log('Guiones del laboratorio · cañón colgado ' + ((roto - cede) * dt).toFixed(2) + ' s, ' +
  primeraSeccion + ' → ' + eventos[1].datos.seccion + ' celdas, ' + (ultimoAngulo * 180 / Math.PI).toFixed(1) + '°. ' +
  'Tanque partido en el paso ' + pasoCorte + ', siete restos.');
console.log('Mediana de 12 tandas · paso con puente activo ' + medir(guardado, roto - cede - 1) +
  ' ms · paso que parte el tanque ' + medir(previo, 1) + ' ms.');
