import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { crearMundo, cargar, definirRobot, etiqueta, ARMAS, PUENTE, RESTOS, FISICA, RENDIMIENTO } from '../index.js';
import { compactar } from '../celdas.js';
import { global, cruz, resta } from '../geometria.js';
import { razonCarga } from '../puente.js';
import { normal as normalContacto, sdf } from '../contacto.js';

let casos = 0;
function prueba(nombre, f) { f(); casos++; console.log('✓ ' + nombre); }
const casi = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const caja = (...medidas) => ({ tipo: 'caja', medidas });
function pieza(id, z, padre, forma = caja(.48, .48, .48), funcion = null, resistencia = 6) {
  return {
    id, pos: [0, 0, z], rot: [0, 0, 0, 1], forma, padre, funcion, union: { resistencia }, aguante: 1,
    zonaFuncion: funcion ? { tipo: 'esfera', pos: [0, -.08, 0], radio: .052 } : null,
    materiales: [{ material: 'acero', cantidad: 3 }, { material: 'cobre', cantidad: 1 }], color: '#E7DFCE'
  };
}
const trio = () => ({
  id: 'R', piezas: [pieza('base', .24, null, undefined, null, 24),
  pieza('torso', .72, 'base', undefined, 'energia', 6),
  pieza('cabeza', 1.12, 'torso', caja(.40, .32, .32), 'sensor', 5)]
});
function mundo(def = trio(), semilla = 7) {
  const m = crearMundo({ semilla }); m.agregarRobot(def); return m;
}
const orden = (arma, z, x = 0, potencia = 1) => ({ arma, potencia, origen: [x, -2, z], direccion: [0, 1, 0] });
const piezas = m => m.estado().piezas;
const porId = (m, id, fragmento = 0) => piezas(m).find(q => q.id === id && q.fragmento === fragmento);
const mask = p => p.mascara.flatMap((v, i, r) => i % 2 ? [] : Array(r[i + 1]).fill(v));
const centro = (p, i) => [i % p.dim[0], Math.floor(i / p.dim[0]) % p.dim[1], Math.floor(i / (p.dim[0] * p.dim[1]))]
  .map((n, k) => (n + .5 - p.dim[k] / 2) * p.celda);
const contar = (m, tipo) => m.sucesos().filter(e => e.tipo === tipo).length;

prueba('Árbol válido, copia propia congelada, referencias, zonas y dimensiones', () => {
  const d = trio(), def = definirRobot(d);
  d.piezas[0].materiales[0].cantidad = 45;
  assert.equal(def.piezas[0].materiales[0].cantidad, 3);
  assert(Object.isFrozen(def.piezas[1].zonaFuncion.pos));
  for (const alterar of [
    d => d.piezas[1].padre = 'otro', d => d.piezas[1].padre = 'cabeza', d => d.piezas[0].padre = 'torso',
    d => d.piezas[2].id = 'base', d => d.piezas[0].rot = [0, 0, 0, 0], d => d.piezas[0].forma.medidas[1] = -1,
    d => d.piezas[1].zonaFuncion.pos = [2, 2, 2], d => d.piezas[0].materiales[0].cantidad = 0,
    d => d.piezas[1].funcion = 7, d => d.piezas[0].union.resistencia = NaN,
  ]) { const d = trio(); alterar(d); assert.throws(() => definirRobot(d)); }
  const p = piezas(mundo(def))[0];
  assert.deepEqual(p.dim, [12, 12, 12]); assert.equal(p.celdas, 1728);
  for (const m of p.materiales) casi(mask(p).reduce((s, v) => s + (v ? m.cantidad / p.celdas : 0), 0), m.cantidad);
  for (const forma of [{ tipo: 'esfera', radio: .24 }, ...['x', 'y', 'z'].map(eje => ({ tipo: 'cilindro', radio: .16, alto: .48, eje }))]) {
    const curvo = mundo({ id: 'f', piezas: [pieza('f', .3, null, forma)] });
    const q = piezas(curvo)[0];
    curvo.disparar(orden('laser', .3));
    assert.equal(cargar(curvo.serializar()).serializar(), curvo.serializar());
    mask(q).forEach((v, i) => {
      const c = centro(q, i), k = ['x', 'y', 'z'].indexOf(forma.eje);
      const radio = Math.hypot(...c.filter((_, j) => j !== k));
      assert.equal(!!v, radio <= forma.radio + 1e-10 && (k < 0 || Math.abs(c[k]) <= forma.alto / 2 + 1e-10));
    });
  }
});
prueba('Etiquetas con cantidades actuales, mezcla, módulo ausente o perdido', () => {
  const una = { materiales: [{ material: 'acero', cantidad: 4 }], funcion: 'sensor', estado: 'intacta' };
  assert.equal(etiqueta(una), 'acero-4-sensor-intacta');
  const mezcla = { ...una, estado: 'dañada', materiales: trio().piezas[0].materiales };
  assert.equal(etiqueta(mezcla), 'acero-3+cobre-1-sensor-dañada');
  assert.equal(etiqueta({
    ...una, funcion: null, funcionOriginal: 'sensor', estado: 'partida',
    materiales: [{ material: 'cristal', cantidad: .753 }]
  }), 'cristal-0.8-sin-partida');
  assert.equal(etiqueta(piezas(mundo())[0]), 'acero-3+cobre-1-sin-intacta');
});
prueba('DDA local con rumbo y pose girada, hueco pasante, fallo y origen interior', () => {
  const m = mundo(), d = trio(); m.agregarRobot(d, { pos: [0, 1, 0], rumbo: Math.PI / 2 });
  const o = orden('laser', 1.12, 0, .55);
  assert.equal(m.raycast(o).pieza, 'cabeza'); assert.equal(m.disparar(o).impacto.robot, 'R');
  assert.equal(m.raycast(o).robot, 'R#2');
  assert.equal(m.raycast({ ...o, origen: [0, 1, 1.12] }).distancia, 0);
  assert.equal(m.disparar(orden('laser', 5)).impacto, null);
  const inclinado = trio(); inclinado.piezas[2].rot = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const q = mundo(inclinado); assert.equal(q.raycast(orden('laser', 1.29)).pieza, 'cabeza');
  assert.throws(() => m.raycast({ ...o, direccion: [0, 0, 0] }));
});
prueba('Impulso bajo y alto, transmisión a hijas, rebote y contacto del conjunto', () => {
  const m = mundo();
  m.disparar(orden('cinetico', .72, 0, .5)); assert.equal(contar(m, 'union-rota'), 0);
  const antes = porId(m, 'torso'); m.disparar(orden('cinetico', .72, .10, 1));
  const q = porId(m, 'torso'), hija = porId(m, 'cabeza');
  assert.equal(q.estado, 'dañada'); assert.equal(q.salida, 'vuelo'); assert.equal(hija.padre, q.uid);
  assert.equal(hija.salida, 'vuelo'); assert(q.celdas > antes.celdas * .985);
  assert.equal(contar(m, 'robot-caido'), 1);
  const distancia = Math.hypot(...hija.pos.map((x, i) => x - q.pos[i]));
  let rebote = false, previo = Infinity, bajando = false;
  for (let i = 0; i < 250; i++) {
    m.avanzar(FISICA.dt);
    const t = porId(m, 'torso'), h = porId(m, 'cabeza');
    casi(Math.hypot(...h.pos.map((x, k) => x - t.pos[k])), distancia);
    for (const p of [h, t]) {
      const [x, y, z, w] = p.rot;
      const vertical = [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
      const bajo = p.pos[2] - p.forma.medidas.reduce((s, n, k) => s + Math.abs(vertical[k]) * n / 2, 0);
      assert(bajo >= -1e-9);
    }
    if (bajando && t.pos[2] > previo + .001) rebote = true;
    bajando = t.pos[2] < previo - .001; previo = t.pos[2];
  }
  assert(rebote); assert.equal(contar(m, 'reposo'), 3);
  const fuerte = mundo();
  assert(fuerte.disparar(orden('cinetico', 1.12, 0, 3)).unionesRotas.length >= 2);
});
prueba('Explosión radial con caída, cráter mayor y robot distante intacto', () => {
  const m = mundo(), k = mundo(); m.agregarRobot(trio(), { pos: [4, 0, 0] });
  const lejano = piezas(m).slice(3), rep = m.disparar(orden('explosivo', .72));
  assert(rep.afectadas.length >= 3);
  assert(rep.quitadas[0].cantidad > k.disparar(orden('cinetico', .72)).quitadas[0].cantidad);
  assert.deepEqual(piezas(m).slice(3), lejano);
});
prueba('Cápsula exacta, anillo fundido, pérdida proporcional y sensor localizado', () => {
  const m = mundo(), antes = piezas(m), informe = m.disparar(orden('laser', 1.12)), p = porId(m, 'cabeza');
  assert.deepEqual(piezas(m).slice(0, 2), antes.slice(0, 2));
  const v = p.volumenes[0], valores = mask(p);
  valores.forEach((valor, i) => {
    const [x, y, z] = centro(p, i), d = Math.hypot(x, Math.max(v.a[1] - y, 0, y - v.b[1]), z);
    assert.equal(valor, d <= v.radio ? 0 : d <= v.radio + ARMAS.laser.anillo ? 2 : 1);
  });
  assert.equal(p.funcionOriginal, 'sensor'); assert.equal(p.funcion, null);
  assert.equal(informe.funcionesPerdidas.length, 1); assert.equal(p.estado, 'partida');
  assert(p.celdas / p.celdasIniciales > .90);
  p.materiales.forEach((m, i) => {
    casi(m.cantidad, antes[2].materiales[i].cantidad * p.celdas / p.celdasIniciales);
    casi(informe.quitadas[i].cantidad, antes[2].materiales[i].cantidad - m.cantidad);
  });
  m.agregarRobot(trio(), { pos: [0, .55, 0] });
  const otro = mundo(); otro.agregarRobot(trio(), { pos: [0, .55, 0] });
  assert.equal(otro.disparar(orden('laser', 1.12, 0, 2)).afectadas.length, 2);
  const cerca = mundo();
  cerca.agregarRobot({ id: 'lateral', piezas: [pieza('placa', 1.12, null, caja(.04, .16, .16))] }, { pos: [.065, 0, 0] });
  cerca.disparar(orden('laser', 1.12));
  const placa = porId(cerca, 'placa');
  assert(placa.fundidas > 0 && placa.celdas === placa.celdasIniciales);
  assert.equal(placa.estado, 'dañada');
});
prueba('Ácido adherido, corrosión temporal y corte por gravedad', () => {
  const d = trio(); d.piezas[2] = pieza('antena', 1.18, 'torso', { tipo: 'cilindro', eje: 'z', radio: .095, alto: .44 });
  const m = mundo(d); m.disparar(orden('acido', .975, 0, 1.6));
  const primeras = porId(m, 'antena').celdas;
  m.avanzar(.8); assert(porId(m, 'antena').celdas < primeras); assert.equal(contar(m, 'union-rota'), 0);
  let prev;
  while (!contar(m, 'union-rota') && m.estado().paso < 150) { prev = porId(m, 'antena'); m.avanzar(FISICA.dt); }
  const libre = porId(m, 'antena');
  assert.equal(libre.salida, 'vuelo'); assert.equal(libre.pos[0], prev.pos[0]); assert.equal(libre.pos[1], prev.pos[1]);
  // Sin impulso: como mucho cae lo que da la gravedad en un paso (puede quedar apoyada en el torso).
  const caida = prev.pos[2] - libre.pos[2];
  assert(caida >= -2e-5 && caida <= FISICA.gravedad * FISICA.dt ** 2 + 1e-12);
  assert.deepEqual(libre.rot, prev.rot); m.avanzar(2);
  const final = porId(m, 'antena'); assert(final.celdas < libre.celdas);
  m.avanzar(5); assert.deepEqual(porId(m, 'antena').mascara, final.mascara);
  assert.equal(porId(m, 'torso').estado, 'intacta');
});
prueba('Las piezas sueltas reposan fuera de las piezas fijas', () => {
  // Rota un vector por un cuaternión [x, y, z, w] conjugado: del mundo al marco local de la pieza fija.
  const aLocal = (q, v) => {
    const [x, y, z, w] = [-q[0], -q[1], -q[2], q[3]];
    const u = [y * v[2] - z * v[1], z * v[0] - x * v[2], x * v[1] - y * v[0]];
    const t = [u[0] * w + (y * u[2] - z * u[1]), u[1] * w + (z * u[0] - x * u[2]), u[2] * w + (x * u[1] - y * u[0])];
    return v.map((c, i) => c + 2 * t[i]);
  };
  const dentro = (f, v) => f.tipo === 'caja' ? v.every((c, i) => Math.abs(c) < f.medidas[i] / 2 - .01)
    : f.tipo === 'esfera' ? Math.hypot(...v) < f.radio - .01
      : (() => { const k = 'xyz'.indexOf(f.eje); return Math.abs(v[k]) < f.alto / 2 - .01
        && Math.hypot(...v.filter((_, i) => i !== k)) < f.radio - .01; })();
  const formas = Object.fromEntries(trio().piezas.map(q => [q.id, q.forma]));
  const casos = [
    m => m.disparar(orden('acido', .975, 0, 1.6)),
    m => m.disparar({ arma: 'cinetico', origen: [-3, 0, 1.2], direccion: [1, 0, -.12], potencia: 1 }),
    m => m.disparar({ arma: 'cinetico', origen: [0, -3, 1.25], direccion: [0, 1, .05], potencia: 1.6 }),
    // Ácido fuerte en el centro del torso: la antena cae en el hueco, sobre un eje de simetría (gradiente nulo).
    m => m.disparar({ arma: 'acido', origen: [0, -3, .9], direccion: [0, 1, 0], potencia: 2.3 }),
  ];
  for (const disparar of casos) {
    const d = trio(); d.piezas[2] = pieza('antena', 1.18, 'torso', { tipo: 'cilindro', eje: 'z', radio: .095, alto: .44 });
    formas.antena = d.piezas[2].forma;
    const m = mundo(d); disparar(m); m.avanzar(6); m.terminarBatalla();
    const todas = piezas(m), fijas = todas.filter(q => q.salida === 'en-pie');
    assert(todas.every(q => [...q.pos, ...q.rot].every(Number.isFinite)), 'pose no finita');
    for (const q of todas) if (q.salida !== 'en-pie') for (const f of fijas) {
      assert(!dentro(formas[f.id], aLocal(f.rot, q.pos.map((c, i) => c - f.pos[i]))), `${q.id} dentro de ${f.id}`);
    }
  }
});
prueba('Normal de contacto: nula en un eje de simetría, unitaria fuera de él', () => {
  const caja = { tipo: 'caja', medidas: [.48, .40, .40] };
  assert.equal(normalContacto(caja, [0, 0, 0]), null);
  assert.deepEqual(normalContacto(caja, [0, 0, .19]).map(x => Math.round(x * 1e6) / 1e6), [0, 0, 1]);
  const n = normalContacto({ tipo: 'cilindro', eje: 'z', radio: .1, alto: .4 }, [.09, 0, 0]);
  assert(Math.abs(Math.hypot(...n) - 1) < 1e-9 && n[0] > .99);
});
prueba('Ácido fuerte en el torso: sin poses NaN y la batalla termina', () => {
  // El Andador del laboratorio con ácido fuerte en el torso (la escena «comparar»): la cabeza baja al hueco
  // y algún punto de contacto queda en el centro de una caja, donde el gradiente del SDF es nulo.
  const andador = {
    id: 'Andador', piezas: [
      { ...pieza('chasis', .14, null, caja(.76, .56, .28), null, 25) },
      { ...pieza('torso', .48, 'chasis', caja(.48, .40, .40), 'energia', 7), zonaFuncion: { tipo: 'esfera', pos: [0, 0, 0], radio: .055 } },
      { ...pieza('cabeza', .82, 'torso', caja(.44, .32, .28), 'sensor', 5), zonaFuncion: { tipo: 'esfera', pos: [0, -.10, 0], radio: .053 } },
    ]
  };
  const m = crearMundo({ semilla: 129 }); m.agregarRobot(definirRobot(andador), { pos: [1.5, 0, 0] });
  m.avanzar(26 / 60); m.disparar({ arma: 'acido', potencia: 2.3, origen: [1.5, -6, .48], direccion: [0, 1, 0] });
  m.avanzar(7); m.terminarBatalla();
  assert(piezas(m).every(q => [...q.pos, ...q.rot].every(Number.isFinite)), 'pose no finita');
  assert(piezas(m).every(q => q.salida !== 'vuelo'));
});
prueba('Dos componentes disjuntas, conservación del material y módulo único', () => {
  const d = trio(); d.piezas[2] = pieza('viga', 1.12, 'torso', caja(.84, .24, .24), 'sensor');
  d.piezas[2].zonaFuncion.pos = [.32, 0, 0];
  const m = mundo(d), antes = porId(m, 'viga'), perdidas = new Map();
  for (const z of [1.02, 1.10, 1.18, 1.22]) {
    const inf = m.disparar(orden('laser', z, .12));
    for (const q of inf.quitadas) perdidas.set(q.material, (perdidas.get(q.material) ?? 0) + q.cantidad);
  }
  const pares = piezas(m).filter(p => p.id === 'viga'); assert.equal(pares.length, 2);
  const [a, b] = pares.map(mask);
  assert(a.every((v, i) => !(v && b[i]))); assert.equal(pares[0].salida, 'en-pie'); assert.equal(pares[1].salida, 'vuelo');
  assert.equal(pares[1].funcion, 'sensor'); assert.equal(pares[0].funcion, null);
  antes.materiales.forEach((q, i) => casi(pares.reduce((s, p) => s + p.materiales[i].cantidad, 0) + perdidas.get(q.material), q.cantidad));
  assert.equal(contar(m, 'fragmento'), 1); assert.equal(contar(m, 'funcion-perdida'), 0);
});
prueba('Fundida, destrucción total, hueco null y escoria', () => {
  const d = { id: 'placa', piezas: [pieza('p', .2, null, caja(.12, .12, .12))] }, m = mundo(d);
  m.disparar(orden('laser', .2));
  // Quedan cuatro islas de tres celdas, todas por debajo del mínimo recuperable.
  assert.deepEqual(m.estado().robots[0].piezas, [null]); assert.equal(piezas(m).length, 0); assert.equal(contar(m, 'robot-caido'), 1);
  const p = mundo({ id: 'f', piezas: [pieza('p', .2, null, caja(.16, .32, .16))] });
  p.disparar(orden('laser', .2, -.02)); p.disparar(orden('laser', .2, .035));
  assert(piezas(p).some(q => q.estado === 'fundida'));
});
prueba('Restos en reposo, exposición desde las dos salidas y congelación', () => {
  for (const modo of ['hundiendose', 'desvaneciendose']) {
    const m = mundo(); m.desaparicion(modo); m.disparar(orden('cinetico', 1.12));
    while (!contar(m, 'reposo') && m.estado().paso < 600) m.avanzar(FISICA.dt);
    const p = porId(m, 'cabeza'), r = m.estado().restos[0];
    assert.equal(p.salida, 'reposo'); assert.deepEqual(r.pos, p.pos); assert.deepEqual(r.rot, p.rot);
    assert.deepEqual(r.mascara, p.mascara); assert.equal(r.instante, m.estado().tiempo);
    m.avanzar(RESTOS.visible + RESTOS.salida / 2);
    const sale = porId(m, 'cabeza'); assert.equal(sale.salida, modo);
    if (modo === 'hundiendose') assert(sale.hundimiento > 0); else casi(sale.opacidad, .5);
    m.avanzar(RESTOS.salida / 2); assert.equal(porId(m, 'cabeza').salida, 'oculto');
    assert.equal(contar(m, 'resto-oculto'), 1); assert.deepEqual(m.estado().restos[0], r);
    m.terminarBatalla(); const exp = porId(m, 'cabeza');
    assert.equal(exp.salida, 'expuesto'); assert.equal(exp.opacidad, 1); assert.equal(exp.hundimiento, 0); assert.deepEqual(exp.pos, r.pos);
    const fijo = m.serializar(); m.avanzar(8); m.terminarBatalla(); assert.equal(m.serializar(), fijo);
  }
});
prueba('Botín de la misma víctima, factores, borde fundido y módulos', () => {
  const comparar = arma => {
    const m = mundo(); m.disparar(orden(arma, .72, 0, arma === 'acido' ? 2.6 : 1.2)); m.terminarBatalla();
    assert(m.estado().robots[0].caido);
    const b = m.botin(); assert.equal(b.restos.length, 3);
    for (const p of piezas(m)) {
      const r = b.restos.find(r => r.pieza === p.id);
      casi(r.materiales[0].cantidad, p.materiales[0].cantidad * RENDIMIENTO[p.estado] *
        ((p.celdas - p.fundidas) + p.fundidas * RENDIMIENTO.bordeFundido) / p.celdas);
    }
    assert.equal(b.total.funciones.sensor, 1);
    casi(b.total.materiales.acero, b.restos.reduce((s, r) => s + r.materiales[0].cantidad, 0));
    return b;
  };
  const k = comparar('cinetico'), l = comparar('laser'), a = comparar('acido');
  assert(k.total.materiales.acero > l.total.materiales.acero); assert(l.total.materiales.acero > a.total.materiales.acero);
  assert.equal(k.total.funciones.energia, 1); assert.equal(l.total.funciones.energia, undefined);
  assert.deepEqual(l.restos.find(r => r.pieza === 'base').materiales, a.restos.find(r => r.pieza === 'base').materiales);
});
prueba('Repetición binaria, resto de subpaso, guardado intermedio y continuación', () => {
  function iniciar() { const m = mundo(); m.disparar(orden('acido', .72)); m.avanzar(.253); m.disparar(orden('cinetico', 1.12)); return m; }
  const m = iniciar(), b = iniciar(), c = cargar(m.serializar()); assert.equal(b.serializar(), c.serializar());
  const datos = JSON.parse(m.serializar()); assert.equal(datos.formato, 'cbl-destruccion'); assert.equal(datos.v, 2);
  for (const x of [m, b, c]) { x.avanzar(.758); x.disparar(orden('explosivo', .24)); x.avanzar(5); }
  assert.equal(b.serializar(), m.serializar()); assert.equal(c.serializar(), m.serializar());
  for (const x of [m, b, c]) x.terminarBatalla();
  assert.equal(m.serializar(), c.serializar()); const guardado = m.serializar(); b.cargar(guardado); assert.equal(b.serializar(), guardado);
  assert.throws(() => b.cargar('{"v":2}')); assert.equal(b.serializar(), guardado);
  const x = mundo(), y = mundo(); x.avanzar(.5); for (let j = 0; j < 60; j++)y.avanzar(1 / 120);
  assert.equal(x.serializar(), y.serializar());
  for (const [n, dt] of [[600, .001], [30, .017], [123, 1 / 144]]) {
    const a = iniciar(), b = iniciar();
    a.avanzar(n * dt);
    for (let i = 0; i < n; i++) b.avanzar(dt);
    assert.equal(a.serializar(), b.serializar());
  }
});

function barraConMuesca(ancho, masaTotal = 1.3, longitud = .84) {
  const base = pieza('soporte', .50, null, caja(.12, .24, .40));
  base.pos[0] = -longitud / 2 + .04;
  const barra = pieza('barra', .82, 'soporte', caja(longitud, .24, .24));
  barra.materiales = [{ material: 'acero', cantidad: masaTotal }];
  const original = mundo({ id: 'Voladizo', piezas: [base, barra] });
  const q = porId(original, 'barra'), datos = JSON.parse(original.serializar());
  // Una capa transversal: las dos filas superiores del ligamento y un último
  // testigo delante. El láser elimina el testigo y dispara la detección real.
  const celdas = mask(q).map((v, i) => {
    const [x, y, z] = centro(q, i);
    if (Math.abs(x) > .001) return v;
    return Number(z > .05 && Math.abs(y) < ancho * q.celda / 2 || y < -.09 && z < 0 && z > -.04);
  });
  datos.piezas[1].mascara = compactar(celdas);
  const m = cargar(JSON.stringify(datos)), antes = porId(m, 'barra');
  const informe = m.disparar(orden('laser', .80));
  return { m, antes, informe, preparada: JSON.stringify(datos) };
}
prueba('Sección 2 × 2, monotonía, giro en carga y rotura sin perder material', () => {
  assert(Object.isFrozen(PUENTE));
  const { m } = barraConMuesca(2), inicial = piezas(m).find(q => q.puente);
  assert(inicial); assert.equal(inicial.puente.seccion, 4);
  assert(inicial.puente.razon >= PUENTE.ceder && inicial.puente.razon < 1);
  const razon = (ancho, masa, largo) => barraConMuesca(ancho, masa, largo).m.sucesos()
    .find(e => e.tipo === 'puente-cede' || e.tipo === 'puente-roto')?.datos.razon;
  assert(razon(2, 1.6, .84) > inicial.puente.razon);
  assert(razon(2, 1.3, 1.32) > inicial.puente.razon);
  assert(razon(4, 3.4, .84) < razon(2, 3.4, .84));
  const cm = q => {
    const indices = mask(q).flatMap((v, i) => v ? [i] : []);
    return global(q, [0, 1, 2].map(k => indices.reduce((s, i) => s + centro(q, i)[k], 0) / indices.length));
  };
  const oscilando = cargar(m.serializar());
  oscilando.avanzar(FISICA.dt);
  const h = porId(oscilando, 'barra', inicial.fragmento), omega = JSON.parse(oscilando.serializar()).piezas[h.uid].puente.omega;
  assert(omega > 0);
  const incidir = oscilando.disparar({ arma: 'laser', origen: [0, 0, 2], direccion: [0, 0, -1] });
  assert(incidir.sucesos.some(e => e.tipo === 'puente-roto'));
  const libre = porId(oscilando, 'barra', h.fragmento), mov = JSON.parse(oscilando.serializar()).piezas[h.uid].mov;
  casi(Math.hypot(...mov.w), omega);
  cruz(mov.w, resta(cm(libre), h.puente.pivote)).forEach((v, i) => casi(mov.v[i], v));
  let angulo = 0;
  for (let i = 0; i < 30; i++) {
    m.avanzar(FISICA.dt);
    const q = porId(m, 'barra', inicial.fragmento);
    assert.equal(q.padre, porId(m, 'barra').uid);
    assert(q.puente.angulo >= angulo && q.puente.angulo - angulo <= PUENTE.giroPorPaso + 1e-10);
    assert(q.puente.angulo > 0 && cm(q)[2] < cm(inicial)[2]);
    angulo = q.puente.angulo;
  }
  assert.equal(contar(m, 'puente-cede'), 1);
  for (const potencia of [.20, .40]) {
    const copia = cargar(m.serializar());
    const inf = copia.disparar(orden('cinetico', .80, .24, potencia));
    assert.equal(inf.impacto.fragmento, inicial.fragmento);
    assert.equal(contar(copia, 'puente-roto'), Number(potencia === .40));
  }
  const { m: pesado, antes, informe } = barraConMuesca(2, 4);
  assert(informe.sucesos.some(e => e.tipo === 'puente-roto' && e.datos.razon >= 1));
  const par = piezas(pesado).filter(p => p.id === 'barra');
  assert.equal(par.length, 2); assert.equal(par[1].salida, 'vuelo');
  const altura = cm(par[1])[2];
  pesado.avanzar(.12);
  assert(cm(porId(pesado, 'barra', par[1].fragmento))[2] < altura);
  pesado.avanzar(2);
  assert.equal(porId(pesado, 'barra', par[1].fragmento).salida, 'reposo');
  casi(par.reduce((s, q) => s + q.materiales[0].cantidad, informe.quitadas[0].cantidad), antes.materiales[0].cantidad);
});
prueba('La misma muesca vuela rígida y admite un puente al quedar en reposo', () => {
  const { preparada } = barraConMuesca(2);
  const m = cargar(preparada);
  const impacto = m.disparar(orden('cinetico', .50, -.38, .8));
  assert.equal(impacto.impacto.pieza, 'soporte');
  const enVuelo = cargar(m.serializar());
  enVuelo.disparar(orden('laser', .80));
  assert.equal(piezas(enVuelo).length, 2);
  assert.equal(porId(enVuelo, 'barra').salida, 'vuelo');
  // El conjunto termina de rodar antes de repetir el disparo en la pose de reposo.
  while (porId(m, 'barra').salida === 'vuelo' && m.estado().paso < 600) m.avanzar(FISICA.dt);
  const barra = porId(m, 'barra');
  assert.equal(barra.salida, 'reposo');
  const origen = global(barra, [0, -2, -.02]), fin = global(barra, [0, 0, -.02]);
  m.disparar({ arma: 'laser', origen, direccion: fin.map((v, i) => v - origen[i]) });
  assert(m.sucesos().some(e => e.tipo === 'puente-cede' || e.tipo === 'puente-roto'));
});
prueba('Sin falso puente en bloque perforado y torso a compresión', () => {
  const grande = mundo({ id: 'Bloque', piezas: [pieza('bloque', .5, null, caja(.88, .88, .88))] });
  grande.disparar({ arma: 'acido', origen: [0, 0, .5], direccion: [0, 1, 0], potencia: 1 });
  grande.avanzar(3);
  assert.equal(piezas(grande).length, 1); assert(piezas(grande)[0].celdas < piezas(grande)[0].celdasIniciales);
  const base = pieza('base', .2, null, caja(.4, .4, .4)), torso = pieza('torso', .82, 'base', caja(.24, .24, .84));
  torso.materiales = [{ material: 'acero', cantidad: 12 }];
  const m = mundo({ id: 'Vertical', piezas: [base, torso] });
  const q = porId(m, 'torso'), datos = JSON.parse(m.serializar());
  datos.piezas[1].mascara = compactar(mask(q).map((v, i) => {
    const [x, y, z] = centro(q, i);
    return Math.abs(z) > .001 ? v : Number(Math.abs(x) < .061 && Math.abs(y) < .061 || x > .09 && y < -.09);
  }));
  m.cargar(JSON.stringify(datos));
  const inf = m.disparar(orden('laser', .82, .10));
  assert(inf.quitadas.length && contar(m, 'fragmento') === 0);
  const seccion = mask(porId(m, 'torso')).filter((v, i) => v && Math.abs(centro(q, i)[2]) < .001);
  assert.equal(seccion.length, 12);
  assert.equal(porId(m, 'torso').salida, 'en-pie');
  assert.equal(razonCarga(5, [0, 0, 1], [0, 0, .5], 4, 1), 0);
  assert(razonCarga(5, [0, 0, 0], [0, 0, .5], 4, 1) > 1);
});
prueba('Pared y cavidad discretas, raycast al interior y apoyo sobre el suelo', () => {
  const casco = pieza('casco', .3, null, { ...caja(.48, .48, .48), hueco: .04 });
  const interior = pieza('modulo', .28, 'casco', caja(.12, .12, .12));
  const def = { id: 'Casco', piezas: [casco, interior] }, m = mundo(def);
  assert.equal(piezas(m)[0].celdas, 12 ** 3 - 10 ** 3);
  const tiro = orden('laser', .28, 0, .09);
  assert.equal(m.raycast(tiro).pieza, 'casco'); m.disparar(tiro);
  assert.equal(m.raycast(tiro).pieza, 'modulo');
  assert(JSON.parse(m.serializar()).piezas[1].contactoPadre.every(i => centro(piezas(m)[0], i)[2] < -.19));
  // Quitar desde abajo todo el parche sin tocar la hija: pierde apoyo y cae.
  const t = mundo(def);
  for (const x of [-.045, .025]) for (const y of [-.045, .025])
    t.disparar({ arma: 'laser', origen: [x, y, -1], direccion: [0, 0, 1], potencia: .075 });
  assert.equal(porId(t, 'modulo').padre, null);
  t.avanzar(1); assert(porId(t, 'modulo').pos[2] < interior.pos[2]);
  const dentro = mundo(def);
  dentro.disparar({ arma: 'laser', origen: [0, -.16, .24], direccion: [0, 1, 0], potencia: .20 });
  dentro.avanzar(1);
  const suelta = porId(dentro, 'modulo');
  assert.equal(suelta.padre, null); assert.equal(suelta.salida, 'reposo');
  const bajo = Math.min(...mask(suelta).flatMap((v, i) => v ? [global(suelta, centro(suelta, i))[2] - suelta.celda / 2] : []));
  casi(bajo, .10, .0001);
  assert.throws(() => mundo({ ...def, piezas: [casco, { ...interior, pos: [.17, 0, .3] }] }), /solapa.*pared/);
  for (const hueco of [.02, .24, .239]) assert.throws(() => mundo({ id: 'f', piezas: [{ ...casco, forma: { ...casco.forma, hueco } }] }), /hueco/);
  for (const eje of ['x', 'y', 'z']) {
    const f = { tipo: 'cilindro', eje, radio: .18, alto: .48, hueco: .04 };
    const p = piezas(mundo({ id: 'tubo', piezas: [{ ...casco, forma: f }] }))[0], k = 'xyz'.indexOf(eje);
    mask(p).forEach((valor, i) => {
      const v = centro(p, i), r = Math.hypot(...v.filter((_, j) => j !== k));
      assert.equal(!!valor, r <= .18 + 1e-10 && (r >= .14 - 1e-10 || Math.abs(v[k]) >= .20 - 1e-10));
    });
  }
  assert(sdf(casco.forma, [0, 0, 0]) > 0 && sdf(casco.forma, [0, 0, -.21]) < 0);
  assert(normalContacto(casco.forma, [0, 0, -.205])[2] > .99);
});

prueba('Guiones reales: continuación del puente, interiores, botín y coste del paso', () => {
  const guiones = new URL('../../../herramientas/laboratorio-destruccion/pruebas-escenas.mjs', import.meta.url);
  execFileSync(process.execPath, [fileURLToPath(guiones)], { stdio: 'inherit' });
});

prueba('Granada, chorro y charco', () => {
  execFileSync(process.execPath, [fileURLToPath(new URL('./acido-balistica.mjs', import.meta.url))], { stdio: 'inherit' });
});

const duraciones = [], rayos = [];
let celdas = 0;
for (let tanda = 0; tanda < 12; tanda++) {
  const m = crearMundo({ semilla: 7 });
  for (let j = 0; j < 3; j++) { m.agregarRobot(trio(), { pos: [j, 0, 0] }); m.disparar(orden('cinetico', .72, j)); }
  celdas = piezas(m).reduce((s, p) => s + p.celdasIniciales, 0);
  assert.equal(piezas(m).filter(p => p.salida === 'vuelo').length, 9);
  const r = orden('laser', .72); let t = performance.now();
  for (let i = 0; i < 400; i++)m.raycast(r);
  rayos.push((performance.now() - t) / 400);
  t = performance.now(); for (let i = 0; i < 16; i++)m.avanzar(FISICA.dt);
  duraciones.push((performance.now() - t) / 16);
}
const mediana = a => a.sort((a, b) => a - b)[Math.floor(a.length / 2)].toFixed(4);
console.log(`${casos} grupos correctos · 3 robots, 9 piezas, ${celdas} celdas · paso ${mediana(duraciones)} ms · raycast ${mediana(rayos)} ms`);
