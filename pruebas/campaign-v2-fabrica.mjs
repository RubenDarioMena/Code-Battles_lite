// Campaign-V2 · misión 1 jugada de punta a punta sobre el motor compartido, con programas guionizados, y el colocador
// (solapes, losa, giro del punto de trabajo y prueba en seco).
// Cada hito pasa por el mismo camino que en la página: checkpoint → Batalla (planta sin hitos) → checkpoint → fábrica.
import assert from 'node:assert/strict';
import { DT, adjuntarSucesos } from '../paquetes/nucleo/index.js';
import { niveles, nivelFabrica, motorFabrica as motor, esFabrica, hitosFabrica, validarNivel } from '../paquetes/reglas-campaign-v2/index.js';
import { catalogo } from '../shared/i18n/campaign-v2/nivel-1.js';
import war from '../paquetes/reglas-war/index.js';

const contenido = niveles['nivel-1'];
assert.deepEqual(validarNivel('nivel-1', contenido, war.api.tipos, catalogo), []);
assert.deepEqual(hitosFabrica(contenido.default), ['h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
assert.ok(esFabrica('h3') && !esFabrica('b3') && !esFabrica(undefined));
const def = nivelFabrica(contenido);
// Antes de H2, ARM-02 aún no está en la planta, pero su base ya está reservada: si no, aparecería dentro de una tarima.
{
  const m0 = motor.crear(def);
  assert.equal(m0.porId['ARM-02'].presente, false);
  assert.equal(motor.conectar(m0).probarColocar('PAL-3', 89, 48.6).resultado, 'ocupado', 'la base de ARM-02 está reservada');
}

/** Corre guiones (generadores que ceden órdenes) hasta que `fin(m)` se cumple. Devuelve el mundo y los segundos usados. */
function jugar(m, guiones, fin, max = 900) {
  const resultados = new Map();
  const c = motor.conectar(m, { terminarOrden(_u, ref, res) { resultados.set(ref, res); } });
  let seq = 0;
  const vivos = Object.entries(guiones).map(([id, g]) => ({ id, it: g(m), espera: null, ultimo: undefined, hecho: false }));
  function avanzar(g) {
    for (let vueltas = 0; !g.hecho && !g.espera; vueltas++) {
      assert.ok(vueltas < 1000, `${g.id}: el guion no cede`);
      const { value: o, done } = g.it.next(g.ultimo);
      if (done) { g.hecho = true; return; }
      if (o.wait != null) g.espera = { t: m.t + o.wait };
      else if (o.hasta) g.espera = { cond: o.hasta };
      else if (o.colocar) g.ultimo = c.colocar(o.colocar, o.x, o.y);
      else if (['pickUp', 'deliver', 'goTo'].includes(o.verbo)) {
        const ref = `${g.id}#${++seq}`, r = c.iniciarOrden(g.id, { id: ref, verbo: o.verbo, args: o.args });
        if (r == null) g.espera = { ref }; else { g.ultimo = r; resultados.delete(ref); }
      } else g.ultimo = c.aplicarModo(o.unidad ?? g.id, o.verbo, o.args ?? []);
    }
  }
  const t0 = m.t;
  while (!fin(m)) {
    assert.ok(m.t - t0 < max, `sin terminar tras ${max} s (hito ${m.hito}: ${JSON.stringify(motor.metas(m).map(x => [x.k, x.valor, x.n]))})`);
    for (const g of vivos) {
      const e = g.espera;
      if (e && ((e.ref && resultados.has(e.ref)) || (e.t != null && m.t >= e.t - 1e-9) || (e.cond && e.cond(m)))) {
        if (e.ref) { g.ultimo = resultados.get(e.ref); resultados.delete(e.ref); }
        g.espera = null;
      }
      avanzar(g);
    }
    c.paso(DT);
  }
  c.cancelarTareas();
  return Math.round(m.t - t0);
}
// La frontera de la página: checkpoint, Batalla (la planta sigue sin hitos) y vuelta a la fábrica.
function batalla(m, segundos) {
  const enBatalla = motor.crear(def, JSON.parse(JSON.stringify(motor.serializar(m))));
  const c = motor.conectar(enBatalla);
  const hito = enBatalla.hito;
  for (let t = 0; t < segundos; t += DT) c.paso(DT, { sinHitos: true });
  assert.equal(enBatalla.hito, hito, 'la Batalla no cambia el hito de fábrica');
  return motor.crear(def, JSON.parse(JSON.stringify(motor.serializar(enBatalla))));
}
const n = (m, id, pieza) => motor.cuantos(m, id, pieza);
const hito = k => m => m.hito > k || m.completado;

// Brazo: ciclo entrada → máquina → salida. Sostiene la pieza si la tarima de salida no está.
const brazo = (entrada, maquina, materia, pieza, salida) => function* () {
  while (true) {
    const r = yield { verbo: 'pickUp', args: [entrada, materia] };
    if (r === 'viaje_vacio' || r === 'sin_tarima') { yield { wait: 1 }; continue; }
    assert.equal(r, 'ok', `${entrada}: ${r}`);
    assert.equal(yield { verbo: 'deliver', args: [maquina] }, 'ok');
    yield { hasta: m => n(m, maquina, pieza) - (m.porId[maquina].entrada[pieza] || 0) > 0 };
    assert.equal(yield { verbo: 'pickUp', args: [maquina, pieza] }, 'ok');
    while ((yield { verbo: 'deliver', args: [salida] }) !== 'ok') yield { wait: 0.5 };
  }
};

let m = motor.crear(def);
const tiempos = {};
assert.equal(m.arsenal.misiles, contenido.fabrica.bodegaInicial);
assert.equal(n(m, 'BAY-1', 'steel'), 12);

// H0 · el programa de partida de FRK-01, tal cual.
tiempos.h0 = jugar(m, { 'FRK-01': function* () { yield { verbo: 'pickUp', args: ['BAY-1'] }; yield { verbo: 'deliver', args: ['PAL-1'] }; } }, hito(0));
assert.equal(m.hito, 1);
assert.ok(m.porId['ARM-01'].presente && m.porId['PRS-01'].encendida && !m.porId['ARM-02'].presente);
m = batalla(m, 40);

// H1 · el ciclo de partida falla como cuenta la pista (la ojiva aún no está); con espera y bucle se cumple.
{
  const r = [];
  jugar(m, { 'ARM-01': function* () {
    for (const [verbo, ...args] of [['pickUp', 'PAL-1', 'steel'], ['deliver', 'PRS-01'], ['pickUp', 'PRS-01', 'nose'], ['deliver', 'PAL-2']])
      r.push(yield { verbo, args });
  } }, () => r.length === 4);
  assert.deepEqual(r, ['ok', 'ok', 'viaje_vacio', 'manos_vacias']);
}
tiempos.h1 = jugar(m, { 'ARM-01': brazo('PAL-1', 'PRS-01', 'steel', 'nose', 'PAL-2') }, hito(1));
assert.ok(n(m, 'PAL-2', 'nose') >= 6);
m = batalla(m, 40);
assert.equal(n(m, 'BAY-1', 'polymer'), 12, 'el polímero de H2 llega durante la Batalla');

// H2 · PAL-3 está fuera del alcance de ARM-02: el colocador la acerca.
{
  let r;
  jugar(m, { 'ARM-02': function* () { r = yield { verbo: 'pickUp', args: ['PAL-3', 'polymer'] }; } }, () => r);
  assert.equal(r, 'fuera_de_alcance');
  const c = motor.conectar(m);
  assert.equal(c.colocar('PAL-3', 89.2, 46.6), 'ocupado', 'no se solapa con la moldeadora');
  assert.equal(c.colocar('PAL-3', 120, 50), 'fuera_de_losa');
  assert.equal(c.colocar('BAY-1', 80, 50), 'no_movible');
  assert.equal(c.colocar('PAL-3', 86.8, 47.6), 'ok');
  assert.deepEqual([m.porId['PAL-3'].ax, m.porId['PAL-3'].ay], [86.8, 49.5], 'el punto de trabajo se mueve con la tarima');

  // Girar: cuartos de vuelta en el sentido de las agujas del reloj, vistos desde arriba. El punto de trabajo
  // (al sur, a 1,9 m) gira alrededor del centro; probarColocar responde lo mismo que colocar sin tocar el mundo.
  const pal3 = () => [m.porId['PAL-3'].cx, m.porId['PAL-3'].cy, m.porId['PAL-3'].ax, m.porId['PAL-3'].ay];
  const antes = pal3();
  assert.deepEqual(c.probarColocar('PAL-3', 86.8, 47.6, 1), { resultado: 'ok', ax: 84.9, ay: 47.6 }, 'un cuarto: al oeste');
  assert.deepEqual(c.probarColocar('PAL-3', 86.8, 47.6, 2), { resultado: 'ok', ax: 86.8, ay: 45.7 }, 'media vuelta: al norte');
  assert.deepEqual(c.probarColocar('PAL-3', 86.8, 47.6, 5), c.probarColocar('PAL-3', 86.8, 47.6, 1), 'cinco cuartos son uno');
  assert.deepEqual(c.probarColocar('PAL-3', 86.8, 47.6, -1), c.probarColocar('PAL-3', 86.8, 47.6, 3), 'girar al revés');
  assert.deepEqual(pal3(), antes, 'probar no mueve nada');
  assert.equal(c.probarColocar('PAL-3', 71.5, 47.6, 0).resultado, 'ok');
  assert.equal(c.probarColocar('PAL-3', 71.5, 47.6, 1).resultado, 'fuera_de_losa', 'el punto girado cae fuera de la losa');
  assert.equal(c.probarColocar('PAL-3', 89.2, 46.6, 1).resultado, 'ocupado');
  assert.equal(c.probarColocar('BAY-1', 80, 50).resultado, 'no_movible');
  assert.deepEqual(c.probarColocar('ARM-02', 89, 48.6, 1), { resultado: 'ok', ax: null, ay: null }, 'un brazo anclado no tiene frente');
  // En una copia, para no cambiar los recorridos del resto de la misión: el giro queda en el suceso y en el guardado.
  const copia = motor.crear(def, motor.serializar(m)), registro = adjuntarSucesos(copia);
  assert.equal(motor.conectar(copia).colocar('PAL-3', 86.8, 47.6, 1), 'ok');
  assert.deepEqual([copia.porId['PAL-3'].ax, copia.porId['PAL-3'].ay], [84.9, 47.6]);
  assert.deepEqual(registro.desde(0).filter(x => x.tipo === 'colocada').at(-1).datos, { x: 86.8, y: 47.6, giro: 1 });
  const vuelta = motor.crear(def, JSON.parse(JSON.stringify(motor.serializar(copia))));
  assert.deepEqual([vuelta.porId['PAL-3'].ax, vuelta.porId['PAL-3'].ay], [84.9, 47.6], 'el giro viaja en el checkpoint');
}
tiempos.h2 = jugar(m, {
  'FRK-01': function* () { yield { verbo: 'pickUp', args: ['BAY-1'] }; yield { verbo: 'deliver', args: ['PAL-3'] }; },
  'ARM-02': brazo('PAL-3', 'MLD-01', 'polymer', 'base', 'PAL-4'),
  'ARM-01': brazo('PAL-1', 'PRS-01', 'steel', 'nose', 'PAL-2'),
}, hito(2));
m = batalla(m, 40);

// H3 · la mezcladora absorbe de dos tarimas; sin tarima de salida se bloquea en 3 cargas.
const frkMezcla = (conVacia) => function* () {
  for (let i = 0; i < 2; i++) {
    yield { hasta: m => !!m.porId['BAY-1'].tarima };
    assert.equal(yield { verbo: 'pickUp', args: ['BAY-1'] }, 'ok');
    assert.equal(yield { verbo: 'deliver', args: ['MIX-01'] }, 'ok');
  }
  if (!conVacia) return;
  assert.equal(yield { verbo: 'pickUp', args: ['STK-1'] }, 'ok');
  assert.equal(yield { verbo: 'deliver', args: ['MIX-01'] }, 'ok');
};
{
  const prueba = motor.crear(def, motor.serializar(m));
  jugar(prueba, { 'FRK-01': frkMezcla(false) }, p => motor.estadoMaquina(p.porId['MIX-01'], p) === 'blocked', 200);
  assert.equal(prueba.porId['MIX-01'].salida.length, 3);
  assert.equal(prueba.hito, 3);
}
tiempos.h3 = jugar(m, { 'FRK-01': frkMezcla(true) }, hito(3));
assert.ok(m.porId['MIX-01'].tarimaSalida, 'la tarima de salida recoge las cargas');
m = batalla(m, 40);

// H4 · tres tarimas a la ensambladora; solo arranca con 6 kW libres.
{
  const prueba = motor.crear(def, motor.serializar(m)), c = motor.conectar(prueba), asm = prueba.porId['ASM-01'];
  for (const [id, pieza] of [['PRS-01', 'nose'], ['MIX-01', 'charge']]) prueba.porId[id].proceso = { receta: pieza, prog: 0 };
  for (const pieza of ['nose', 'base', 'charge']) {
    const t = { id: `T${prueba.sigTarima++}`, piezas: [pieza], en: asm.id };
    prueba.tarimas.push(t); prueba.tarimaPorId[t.id] = t; asm.zona.push(t.id);
  }
  c.paso(DT);
  assert.equal(motor.estadoMaquina(asm, prueba), 'no_power', 'prensa 2 + mezcladora 3 + ensambladora 6 > 10 kW');
  assert.equal(motor.instantanea(prueba).u['ASM-01'].state, 'no_power');
  prueba.porId['MIX-01'].proceso = null; prueba.porId['MIX-01'].marcha = false;
  c.paso(DT);
  assert.ok(asm.proceso, 'con la mezcladora parada, arranca');
}
const bodegaAntes = m.arsenal.misiles;
tiempos.h4 = jugar(m, { 'FRK-01': function* () {
  for (const origen of ['PAL-2', 'PAL-4', 'MIX-01']) {
    assert.equal(yield { verbo: 'pickUp', args: [origen] }, 'ok');
    assert.equal(yield { verbo: 'deliver', args: ['ASM-01'] }, 'ok');
  }
} }, hito(4));
assert.equal(m.arsenal.misiles, bodegaAntes + 4, 'los misiles van directos a la bodega');
assert.ok(m.presupuesto > def.presupuesto, 'cada misil cobra el contrato');
m = batalla(m, 40);
assert.ok(m.arsenal.misiles >= bodegaAntes + 4, 'la ensambladora sigue durante la Batalla con lo cargado');

// H5 · la cadena entera: brazos, reposición de tarimas vacías y reparto a la ensambladora.
const despachador = function* (m) {
  const zona = () => m.porId['ASM-01'].zona.map(id => m.tarimaPorId[id]);
  const enZona = pieza => zona().reduce((a, t) => a + t.piezas.filter(p => p === pieza).length, 0);
  const origen = { nose: 'PAL-2', base: 'PAL-4', charge: 'MIX-01' };
  while (true) {
    for (const l of ['PAL-2', 'PAL-4']) if (!m.porId[l].tarima) {
      yield { verbo: 'pickUp', args: ['STK-1'] }; yield { verbo: 'deliver', args: [l] };
    }
    if (!m.porId['MIX-01'].tarimaSalida) { yield { verbo: 'pickUp', args: ['STK-1'] }; yield { verbo: 'deliver', args: ['MIX-01'] }; }
    // Materia nueva de la bahía: la tarima vacía de la célula vuelve a la pila y entra la llena.
    const llega = m.porId['BAY-1'].tarima && m.tarimaPorId[m.porId['BAY-1'].tarima].piezas[0];
    const celda = { steel: 'PAL-1', polymer: 'PAL-3' }[llega];
    if (celda && n(m, celda, llega) === 0) {
      if (m.porId[celda].tarima) { yield { verbo: 'pickUp', args: [celda] }; assert.equal(yield { verbo: 'deliver', args: ['STK-1'] }, 'ok'); }
      assert.equal(yield { verbo: 'pickUp', args: ['BAY-1'] }, 'ok');
      assert.equal(yield { verbo: 'deliver', args: [celda] }, 'ok');
      continue;
    }
    if (zona().length < 3) {
      const falta = ['nose', 'base', 'charge'].filter(p => !zona().some(t => t.piezas.includes(p)))
        .sort((a, b) => enZona(a) - enZona(b)).find(p => n(m, origen[p], p) >= 3);
      if (falta) {
        assert.equal(yield { verbo: 'pickUp', args: [origen[falta]] }, 'ok');
        assert.equal(yield { verbo: 'deliver', args: ['ASM-01'] }, 'ok');
        continue;
      }
    }
    yield { wait: 0.5 };
  }
};
tiempos.h5 = jugar(m, {
  'FRK-01': despachador,
  'ARM-01': brazo('PAL-1', 'PRS-01', 'steel', 'nose', 'PAL-2'),
  'ARM-02': brazo('PAL-3', 'MLD-01', 'polymer', 'base', 'PAL-4'),
}, hito(5));
assert.equal(m.hito, 6, 'tras H5 viene el taller de carcasas');
assert.ok(['EMB-01', 'SAW-01', 'LSR-01', 'FND-01'].every(id => m.porId[id].encendida) && m.porId['BOT-01'].presente);
m = batalla(m, 40);

// H6 · producción circular: FRK-01 lleva las placas a PAL-6 y BOT-01 hace la cadena y refunde los recortes.
// Las cinco placas del pedido llegan a la bahía durante la Batalla: son toda la masa de la planta.
const masa0 = motor.masaEnPlanta(m) + m.perdida;
assert.deepEqual([n(m, 'BAY-1', 'plate'), masa0], [5, 50]);
const taller = function* (m) {
  const q = id => m.porId[id];
  const lleva = function* (origen, pieza, destinos) {
    assert.equal(yield { verbo: 'pickUp', args: [origen, pieza] }, 'ok', `${origen}: ${pieza}`);
    for (;;) for (const d of destinos) if ((yield { verbo: 'deliver', args: [d] }) === 'ok') return; else yield { wait: 0.5 };
  };
  while (true) {
    const saw = q('SAW-01'), fnd = q('FND-01'), emb = q('EMB-01');
    if (saw.salida.includes('shell')) { yield* lleva('SAW-01', 'shell', ['PAL-7']); continue; }
    if (saw.salida.includes('scrap')) { yield* lleva('SAW-01', 'scrap', ['FND-01', 'PAL-8']); continue; }
    if (n(m, 'PAL-8', 'scrap') && (fnd.entrada.scrap || 0) < 3 && !fnd.proceso) { yield* lleva('PAL-8', 'scrap', ['FND-01']); continue; }
    if (fnd.salida.includes('plate')) { yield* lleva('FND-01', 'plate', ['EMB-01', 'PAL-6']); continue; }
    if (emb.salida.includes('dome') && !saw.proceso && !saw.entrada.dome) { yield* lleva('EMB-01', 'dome', ['SAW-01']); continue; }
    if (n(m, 'PAL-6', 'plate') && !emb.entrada.plate && !emb.proceso) { yield* lleva('PAL-6', 'plate', ['EMB-01']); continue; }
    yield { wait: 0.5 };
  }
};
tiempos.h6 = jugar(m, {
  'FRK-01': function* (m) {
    yield { hasta: m => n(m, 'BAY-1', 'plate') > 0 };
    assert.equal(yield { verbo: 'pickUp', args: ['BAY-1'] }, 'ok');
    assert.equal(yield { verbo: 'deliver', args: ['PAL-6'] }, 'ok');
  },
  'BOT-01': taller,
}, m => m.completado);
assert.ok(m.completado);
assert.ok(motor.metas(m).every(x => x.cumplida));
assert.ok(m.producidos.plate >= 1 && m.perdida >= 2, 'al menos una placa refundida, con su escoria');
assert.equal(motor.masaEnPlanta(m) + m.perdida, masa0, 'se conserva la masa: lo que queda más la escoria');
assert.ok(n(m, 'PAL-7', 'shell') >= 6);

// El guardado no lleva tareas y deja los brazos en su base.
const g = motor.serializar(m);
assert.ok(g.unidades.filter(u => u.alcance).every(u => u.cx === u.base.x && u.cy === u.base.y && u.tarea === null));
assert.equal(motor.crear(def, g).hito, m.hito);

const total = Object.values(tiempos).reduce((a, b) => a + b, 0);
console.log(`Campaign-V2 · fábrica: H0→H6 cumplidos con programas guionizados (${Object.entries(tiempos).map(([k, v]) => `${k} ${v} s`).join(', ')}; ${total} s de planta). Alcance, colocador con giro, zona de tarimas, tarima de salida, umbral de energía, Batallas sin hitos y taller circular con conservación de masa comprobados.`);
