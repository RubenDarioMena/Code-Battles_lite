// Campaign · reglas del nivel 1 con paso fijo real: encargos, modos, lecturas, hitos y checkpoints.
// Los «programas» de esta prueba son funciones async sobre las mismas órdenes que usa el juego.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const c = vm.createContext({ window: {}, console });
for (const f of ['campaign-nivel', 'campaign']) vm.runInContext(fs.readFileSync(`${__dirname}/../Prototypes/Rocket Launcher/js/${f}.js`, 'utf8'), c);
const { CAMPAIGN: C, CAMPAIGN_NIVEL: N } = c.window;
const DT = 0.05;
const v = id => id.replace(/-/g, '_');
// Los objetos del mundo nacen en otro contexto (vm): se comparan como datos planos.
const igual = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, msg);

// Mundo con un pequeño lockstep: el reloj avanza cuando todos los programas esperan.
function planta(guardado) {
  const m = C.crear(N.NIVEL, guardado); m.activo = true;
  const pend = new Map(), esperas = [], hitos = [];
  let seq = 0;
  const sim = C.conectar(m, { terminarOrden: (id, n, res) => { const p = pend.get(n); pend.delete(n); if (p) p(res); }, hito: h => hitos.push(h) });
  const snap = () => C.instantanea(m);
  const api = propia => {
    const comprobar = (unidad, verbo, args) => { const e = C.validar(snap(), propia, unidad, verbo, args); if (e) throw new Error(e); };
    const encargo = (unidad, verbo, args) => { args = args.map(a => a && a.id ? a.id : a); comprobar(unidad, verbo, args); return new Promise(ok => { const n = ++seq; pend.set(n, ok); sim.iniciarOrden(unidad, { id: n, verbo, args }); }); };
    const modo = (unidad, verbo, args) => { comprobar(unidad, verbo, args); return sim.aplicarModo(unidad, verbo, args); };
    const de = id => new Proxy({ id }, { get: (t, k) => k === 'id' ? id : ['pickUp', 'deliver', 'goTo'].includes(k) ? (...a) => encargo(id, k, a) : ['start', 'stop', 'light', 'setRecipe', 'request'].includes(k) ? (...a) => modo(id, k, a) : snap().u[id][k] });
    const o = { yo: de(propia), wait: s => new Promise(ok => esperas.push({ t: m.t + s, ok })), count: (l, p) => sim.cuantos(l.id || l, p) };
    for (const u of m.unidades) o[v(u.id)] = de(u.id);
    for (const k of ['pickUp', 'deliver', 'goTo', 'start', 'stop', 'light', 'setRecipe', 'request']) o[k] = (...a) => o.yo[k](...a);
    return o;
  };
  const tic = () => new Promise(ok => setImmediate(ok));
  // Corre los programas hasta que `fin()` sea cierto. Devuelve el tiempo de juego transcurrido.
  async function correr(programas, fin, limite = 1500) {
    const t0 = m.t; let parar = false;
    const errores = [];
    for (const [id, f] of Object.entries(programas)) f(api(id), () => parar).catch(e => { if (e !== 'alto') errores.push(`${id}: ${e.stack || e}`); });
    for (;;) {
      await tic(); await tic();
      if (errores.length) throw new Error(errores.join('\n'));
      if (fin()) break;
      assert.ok(m.t - t0 < limite, `sin terminar tras ${limite} s (hito ${m.hito}, metas ${JSON.stringify(sim.metas())}, inventario ${JSON.stringify(inventario(m))}, robots ${JSON.stringify(m.robots.map(r => [r.id, r.carga, r.tarea && r.tarea.verbo + ':' + r.tarea.lugar]))})`);
      sim.paso(DT);
      for (let i = esperas.length - 1; i >= 0; i--) if (esperas[i].t <= m.t + 1e-9) esperas.splice(i, 1)[0].ok();
    }
    parar = true; pend.clear(); esperas.length = 0; sim.cancelarTareas(); sim.soltarLuces();
    return m.t - t0;
  }
  return { m, sim, api, correr, hitos, snap };
}
const inventario = m => {
  const n = {};
  const suma = (p, k = 1) => { n[p] = (n[p] || 0) + k; };
  for (const t of m.tarimas) for (const p of t.piezas) suma(p);
  for (const u of m.unidades) {
    if (C.esMaquina(u)) { for (const [p, k] of Object.entries(u.entrada)) if (k) suma(p, k); for (const p of u.salida) suma(p); if (u.proceso) suma(`proceso:${u.proceso.receta}`); }
    if (u.clase === 'obrero' && u.carga) suma(u.carga);
    if (u.clase === 'banda') for (const x of u.piezas) suma(x.pieza);
    if (u.clase === 'arsenal' || u.clase === 'torreta') if (u.misiles) suma('missile', u.misiles);
  }
  return n;
};

(async () => {
  // ---------- Estado inicial ----------
  {
    const { m, snap } = planta();
    assert.equal(m.hito, 0); assert.equal(m.t, 0);
    igual(inventario(m), { steel: 12 });
    assert.equal(m.porId['PRS-01'].encendida, false, 'las estaciones empiezan apagadas');
    assert.equal(m.porId['BOT-02'].presente, false); assert.equal(m.porId['BLT-01'].presente, false);
    igual(m.programables.map(u => u.id), ['FRK-01', 'BOT-01']);
    const s = snap();
    assert.equal(s.u['BAY-1'].pallet, true); assert.equal(s.u['BAY-1'].items, 12); assert.equal(s.maestro, null);
    assert.equal(C.cuantos(m, 'NO-EXISTE', 'steel'), null, 'null: el lugar no existe');
    assert.equal(C.cuantos(m, 'SUP-1', 'steel'), 0, '0: existe y no tiene');
    // Todos los puntos de trabajo caen dentro del pasillo: los robots no cruzan máquinas.
    const p = N.MAPA.pasillo;
    for (const u of m.unidades) if (u.ax != null) assert.ok(u.ax >= p.x0 && u.ax <= p.x1 && u.ay >= p.y0 && u.ay <= p.y1, `${u.id} fuera del pasillo`);
    console.log('OK: estado inicial, null frente a 0 y puntos de trabajo dentro del pasillo');
  }

  // ---------- Validación y propiedad de las órdenes ----------
  {
    const { m, snap } = planta();
    const val = (propia, unidad, verbo, ...args) => C.validar(snap(), propia, unidad, verbo, args);
    assert.equal(val('FRK-01', 'FRK-01', 'pickUp', 'BAY-1'), null);
    assert.match(val('FRK-01', 'FRK-01', 'pickUp', 'NADA'), /No hay ningún lugar/);
    assert.match(val('FRK-01', 'FRK-01', 'pickUp', 7), /necesita un lugar/);
    assert.match(val('BOT-01', 'BOT-01', 'pickUp', 'SUP-1', 'oro'), /No existe la pieza/);
    assert.match(val('BOT-01', 'FRK-01', 'pickUp', 'BAY-1'), /van en su propio programa/);
    assert.match(val('BOT-01', 'BOT-01', 'setRecipe', 'motor'), /no tiene la orden setRecipe/);
    assert.match(val('BOT-01', 'PRS-01', 'start'), /van en su propio programa/);
    assert.match(val('BOT-01', 'BAY-1', 'request', 'oro'), /materia prima/);
    assert.equal(val('BOT-01', 'BAY-1', 'request', 'steel'), null, 'la bahía no tiene programa: cualquiera puede pedir');
    assert.match(val('BOT-01', 'BOT-01', 'count', 'SUP-1'), /necesita la pieza/);
    m.hito = 4; C.indexar(m);
    assert.equal(val('CTL-01', 'BOT-01', 'pickUp', 'SUP-1', 'steel'), null, 'el control maestro ordena a todas');
    assert.match(val('CTL-01', 'ASM-01', 'setRecipe', 'pastel'), /no conoce la receta/);
    assert.match(val('CTL-01', 'PRS-01', 'setRecipe', 'nose'), /no tiene la orden setRecipe/);
    assert.match(val('CTL-01', 'PRS-01', 'light', 'azul'), /necesita un color/);
    assert.match(val('CTL-01', 'BAY-1', 'request', 'nose'), /materia prima/);
    console.log('OK: validación de órdenes, propiedad por programa y control maestro');
  }

  // ---------- Encargos sueltos: resultados y conservación ----------
  {
    const { m, api, correr } = planta();
    const res = {};
    await correr({ 'FRK-01': async a => {
      res.vacio = await a.pickUp(a.SUP_1);            // no hay tarima en SUP-1
      res.sinCarga = await a.deliver(a.SUP_1);
      res.pesado = await a.pickUp(a.ASM_01);
      res.ok = await a.pickUp(a.BAY_1);
      res.llenas = await a.pickUp(a.STK_1);
      res.aMaquina = await a.deliver(a.PRS_01);
      res.aPad = await a.deliver(a.PAD_4);
      res.ocupado = await a.deliver(a.LOT_1);          // LOT-1 ya tiene su tarima
      res.noVacia = await a.deliver(a.STK_1);          // la pila solo recibe tarimas vacías
      res.aparca = await a.deliver(a.LOT_5);           // el hueco libre
      res.otraVez = await a.pickUp(a.LOT_5);
      res.deja = await a.deliver(a.SUP_1);
      res.fin = true;
    } }, () => res.fin);
    igual(res, { vacio: 'viaje_vacio', sinCarga: 'manos_vacias', pesado: 'muy_pesado', ok: 'ok', llenas: 'manos_llenas', aMaquina: 'rechazado', aPad: 'rechazado', ocupado: 'ocupado', noVacia: 'rechazado', aparca: 'ok', otraVez: 'ok', deja: 'ok', fin: true });
    assert.equal(m.hito, 1, 'H0 se cumple al dejar el acero en SUP-1');
    assert.equal(m.porId['PRS-01'].encendida, true);
    const r = {};
    await correr({ 'BOT-01': async a => {
      r.vacias = await a.deliver(a.PRS_01);
      r.sinTarima = await a.pickUp(a.SUP_2, 'steel');
      r.noHay = await a.pickUp(a.SUP_1, 'nose');
      r.toma = await a.pickUp(a.SUP_1, 'steel');
      r.llenas = await a.pickUp(a.SUP_1, 'steel');
      r.apagada = await a.deliver(a.MLD_01);           // todavía apagada
      r.pila = await a.deliver(a.STK_1);
      r.mete = await a.deliver(a.PRS_01);
      r.sinSalida = await a.pickUp(a.PRS_01);
      await a.wait(2.2);
      r.saca = await a.pickUp(a.PRS_01);
      r.aLote = await a.deliver(a.LOT_1);
      r.fin = true;
    } }, () => r.fin);
    igual(r, { vacias: 'manos_vacias', sinTarima: 'sin_tarima', noHay: 'viaje_vacio', toma: 'ok', llenas: 'manos_llenas', apagada: 'no_disponible', pila: 'rechazado', mete: 'ok', sinSalida: 'viaje_vacio', saca: 'ok', aLote: 'ok', fin: true });
    igual(inventario(m), { steel: 11, nose: 1 }, 'ninguna pieza se pierde ni se duplica');
    console.log('OK: resultados de los encargos y conservación de piezas');
  }

  // ---------- Máquina: buffer de salida y espera sin perder piezas ----------
  {
    const { m, api, correr } = planta();
    await correr({ 'FRK-01': async a => { await a.pickUp(a.BAY_1); await a.deliver(a.SUP_1); } }, () => m.hito === 1);
    let fin = false, lleno = null;
    await correr({ 'BOT-01': async a => {
      for (let i = 0; i < 4; i++) { await a.pickUp(a.SUP_1, 'steel'); await a.deliver(a.PRS_01); }
      await a.pickUp(a.SUP_1, 'steel'); lleno = await a.deliver(a.PRS_01);   // entrada 4: puede caber o no según el ritmo
      await a.wait(12);
      fin = true;
    } }, () => fin);
    const q = m.porId['PRS-01'];
    assert.equal(q.salida.length, 3, 'la salida guarda 3');
    assert.equal(q.proceso, null, 'con la salida llena no empieza otro ciclo');
    assert.equal(C.estadoMaquina(q), 'blocked');
    assert.ok(q.st.tBloqueo > 0);
    assert.equal(C.instantanea(m).u['PRS-01'].outputFull, true);
    assert.equal(inventario(m).steel + inventario(m).nose, 12);
    console.log(`OK: buffer de salida de 3 y bloqueo sin pérdidas (5.ª entrega: ${lleno})`);
  }

  // ---------- Partida de referencia: H0 → H5 con programas como los del jugador ----------
  const ref = planta();
  {
    const { m, sim, correr, hitos } = ref, tiempos = [];
    const llevar = (desde, hasta) => async a => { await a.pickUp(a[desde]); await a.deliver(a[hasta]); };
    const luz = async (a, alto) => { while (!alto()) { a.light(a.yo.outputFull ? 'red' : 'green'); await a.wait(0.5); } };
    // H0: la acción guiada del montacargas.
    tiempos.push(await correr({ 'FRK-01': llevar('BAY_1', 'SUP_1') }, () => m.hito === 1));
    const cp1 = C.serializar(m);
    // H1: prensa rápida. Carga varias láminas y luego retira ojivas de una en una.
    tiempos.push(await correr({ 'PRS-01': luz, 'BOT-01': async (a, alto) => {
      while (!alto()) {
        if (a.PRS_01.input < 2 && a.count(a.SUP_1, 'steel') > 0) { await a.pickUp(a.SUP_1, 'steel'); await a.deliver(a.PRS_01); }
        else if (a.PRS_01.output > 0) { await a.pickUp(a.PRS_01); await a.deliver(a.LOT_1); }
        else await a.wait(0.5);
      }
    } }, () => m.hito === 2));
    assert.equal(C.enLotes(m, 'nose') >= 6, true);
    assert.equal(m.porId['MLD-01'].encendida && m.porId['MIX-01'].encendida, true);
    // H2: dos estaciones lentas con un solo obrero, y la tarima de polímero.
    const dosEstaciones = async (a, alto) => {
      while (!alto()) {
        if (a.MLD_01.output > 0) { await a.pickUp(a.MLD_01); await a.deliver(a.LOT_2); }
        else if (a.MIX_01.output > 0) { await a.pickUp(a.MIX_01); await a.deliver(a.LOT_3); }
        else if (a.PRS_01.output > 0) { await a.pickUp(a.PRS_01); await a.deliver(a.LOT_1); }
        else if (a.count(a.SUP_2, 'polymer') > 0 && (a.MLD_01.input === 0 || a.MIX_01.input === 0)) {
          await a.pickUp(a.SUP_2, 'polymer');
          const hay = (q, pieza) => C.enLotes(m, pieza) + q.output + q.input + (q.state === 'working' ? 1 : 0);
          const res = await a.deliver(a.MLD_01.input === 0 && (a.MIX_01.input > 0 || hay(a.MLD_01, 'base') <= hay(a.MIX_01, 'charge')) ? a.MLD_01 : a.MIX_01);
          // La mezcladora puede ir en el montacargas (no_disponible): la pieza vuelve a su tarima.
          if (res !== 'ok') { await a.deliver(a.SUP_2); await a.wait(1); }
        } else if (a.count(a.SUP_1, 'steel') > 0 && a.PRS_01.input === 0) { await a.pickUp(a.SUP_1, 'steel'); await a.deliver(a.PRS_01); }
        else await a.wait(0.5);
      }
    };
    tiempos.push(await correr({ 'FRK-01': async a => { while (!a.BAY_1.pallet) await a.wait(1); await a.pickUp(a.BAY_1); await a.deliver(a.SUP_2); }, 'BOT-01': dosEstaciones }, () => m.hito === 3));
    // H3: pedir polímero, retirar la tarima vacía, traer la nueva y acercar la mezcladora.
    const antes = m.presupuesto;
    tiempos.push(await correr({ 'BOT-01': dosEstaciones, 'FRK-01': async a => {
      assert.equal(a.BAY_1.request('polymer'), 'ok');
      await a.pickUp(a.MIX_01); await a.deliver(a.PAD_4);
      while (a.count(a.SUP_2, 'polymer') > 0) await a.wait(1);
      await a.pickUp(a.SUP_2); await a.deliver(a.STK_1);
      while (!a.BAY_1.pallet) await a.wait(1);
      await a.pickUp(a.BAY_1); await a.deliver(a.SUP_2);
    } }, () => m.hito === 4));
    assert.equal(m.porId['MIX-01'].pad, 'PAD-4', 'la mezcladora quedó reubicada');
    assert.equal(m.porId['PAD-1'].maquina, null);
    assert.equal(m.gastado, C.COSTE.polymer);
    assert.equal(m.presupuesto, antes - C.COSTE.polymer + N.NIVEL.premioHito);
    igual(m.programables.map(u => u.id).sort(), ['ASM-01', 'BOT-01', 'CTL-01', 'FRK-01', 'MIX-01', 'MLD-01', 'PRS-01']);
    // H4: lotes en la ensambladora, coordinados desde el control maestro.
    const cp4 = C.serializar(m);
    // Al detener, un obrero puede quedarse con una pieza en la mano: un programa robusto la devuelve primero.
    const SITIO = { steel: 'SUP_1', polymer: 'SUP_2', nose: 'LOT_1', base: 'LOT_2', charge: 'LOT_3', motor: 'LOT_4', missile: 'LOT_4' };
    tiempos.push(await correr({ 'CTL-01': async (a, alto) => {
      const mover = async (de, pieza, a2) => { await a.BOT_01.pickUp(de, pieza); return a.BOT_01.deliver(a2); };
      if (a.BOT_01.cargo) await a.BOT_01.deliver(a[SITIO[a.BOT_01.cargo]]);
      a.ASM_01.setRecipe('motor');
      for (let i = 0; i < 6; i++) {
        await mover(a.LOT_2, 'base', a.ASM_01); await mover(a.LOT_3, 'charge', a.ASM_01);
        while (a.ASM_01.output === 0) await a.wait(0.5);
        await mover(a.ASM_01, 'motor', a.LOT_4);
      }
      while (a.ASM_01.state === 'working') await a.wait(0.5);
      assert.equal(a.ASM_01.setRecipe('missile'), 'ok');
      while (a.ASM_01.state === 'changeover') await a.wait(0.5);
      for (let i = 0; i < 6 && !alto(); i++) {
        await mover(a.LOT_1, 'nose', a.ASM_01); await mover(a.LOT_4, 'motor', a.ASM_01);
        while (a.ASM_01.output === 0) await a.wait(0.5);
        await mover(a.ASM_01, 'missile', a.LOT_4);
      }
    } }, () => m.hito === 5));
    assert.equal(C.enLotes(m, 'missile'), 6);
    assert.equal(m.porId['BOT-02'].presente, true, 'BOT-02 llega con H5'); assert.equal(m.porId['BLT-01'].presente, true);
    // H5: banda, dos obreros y más material.
    tiempos.push(await correr({
      'BLT-01': async a => { a.start(); },
      'BOT-02': async (a, alto) => { while (!alto()) { if (a.count(a.LOT_4, 'missile') > 0) { await a.pickUp(a.LOT_4, 'missile'); while (await a.deliver(a.BLT_01) === 'lleno') await a.wait(0.5); } else await a.wait(0.5); } },
      'BOT-01': dosEstaciones,
      'CTL-01': async (a, alto) => {
        const mover = async (de, pieza, a2) => { await a.BOT_02.pickUp(de, pieza); return a.BOT_02.deliver(a2); };
        while (C.enLotes(m, 'base') < 6 || C.enLotes(m, 'charge') < 6 || C.enLotes(m, 'nose') < 6 || C.enLotes(m, 'missile') > 0) await a.wait(1);
        a.ASM_01.setRecipe('motor'); while (a.ASM_01.state === 'changeover') await a.wait(0.5);
        for (let i = 0; i < 6; i++) { await mover(a.LOT_2, 'base', a.ASM_01); await mover(a.LOT_3, 'charge', a.ASM_01); while (a.ASM_01.output === 0) await a.wait(0.5); await mover(a.ASM_01, 'motor', a.LOT_4); }
        while (a.ASM_01.state === 'working') await a.wait(0.5);
        a.ASM_01.setRecipe('missile'); while (a.ASM_01.state === 'changeover') await a.wait(0.5);
        for (let i = 0; i < 6 && !alto(); i++) { await mover(a.LOT_1, 'nose', a.ASM_01); await mover(a.LOT_4, 'motor', a.ASM_01); }
      },
    }, () => m.completado && m.salva && m.salva.hecha && !m.misiles.length));
    assert.equal(m.arsenal.porBanda, 12);
    assert.equal(m.torretas.reduce((n, t) => n + t.lanzados, 0) > 0, true, 'la salva de prueba dispara');
    igual(hitos.map(h => h.hecho), [0, 1, 2, 3, 4, 5]); assert.equal(hitos[5].completado, true);
    assert.equal(m.ingresado, 6 * N.NIVEL.premioHito + 12 * C.ARSENAL.pago);
    console.log(`OK: partida de referencia H0–H5 · tiempos de juego ${tiempos.map(t => t.toFixed(0)).join(' / ')} s · total ${m.t.toFixed(0)} s · ₵ ${m.presupuesto}`);

    // ---------- Checkpoints: ida y vuelta exacta, y volver atrás ----------
    const a1 = planta(cp1);
    assert.equal(a1.m.hito, 1); igual(C.serializar(a1.m), JSON.parse(JSON.stringify(cp1)), 'guardar → cargar → guardar no cambia nada');
    igual(inventario(a1.m), { steel: 12 });
    const a4 = planta(cp4);
    assert.equal(a4.m.hito, 4); assert.equal(a4.m.porId['MIX-01'].pad, 'PAD-4'); assert.equal(a4.m.porId['MIX-01'].cx, a4.m.porId['PAD-4'].cx);
    assert.equal(C.enLotes(a4.m, 'base') >= 8, true);
    assert.equal(a4.m.porId['BOT-02'].presente, false);
    assert.equal(planta({ ...cp4, rev: 99 }).m.hito, 0, 'un guardado de otra revisión del nivel se descarta');
    assert.equal(planta({ version: 0 }).m.hito, 0);
    console.log('OK: checkpoints (ida y vuelta, volver a un hito anterior y guardados incompatibles)');
  }

  // ---------- Determinismo: los mismos programas dan el mismo mundo ----------
  {
    const una = async () => {
      const p = planta();
      await p.correr({ 'FRK-01': async a => { await a.pickUp(a.BAY_1); await a.deliver(a.SUP_1); } }, () => p.m.hito === 1);
      await p.correr({ 'BOT-01': async (a, alto) => { while (!alto()) { if (await a.pickUp(a.SUP_1, 'steel') !== 'ok') break; await a.deliver(a.PRS_01); while (a.PRS_01.output === 0) await a.wait(0.5); await a.pickUp(a.PRS_01); await a.deliver(a.LOT_1); } } }, () => p.m.hito === 2);
      return JSON.stringify(C.serializar(p.m));
    };
    assert.equal(await una(), await una());
    console.log('OK: mismo programa, mismo mundo');
  }

  // ---------- Ensambladora: ranuras por clase, receta y cambio; energía ----------
  {
    const { m, sim } = planta();
    m.hito = 4; C.indexar(m);
    const asm = m.porId['ASM-01'], bot = m.porId['BOT-01'];
    let ultimo = null;
    const sim2 = C.conectar(m, { terminarOrden: (id, n, res) => { ultimo = res; } });
    const orden = (verbo, lugar, pieza) => { ultimo = null; sim2.iniciarOrden('BOT-01', { id: 1, verbo, args: [lugar, pieza] }); for (let i = 0; ultimo === null && i < 4000; i++) sim2.paso(DT); return ultimo; };
    const dar = pieza => { bot.carga = pieza; return orden('deliver', 'ASM-01'); };
    asm.marcha = false;                                 // parada: solo se llenan sus ranuras
    assert.equal(dar('nose'), 'rechazado', 'la receta motor no usa ojivas');
    bot.carga = null;
    assert.deepEqual([dar('base'), dar('base'), dar('base')], ['ok', 'ok', 'lleno'], '2 ranuras grandes');
    bot.carga = null;
    assert.deepEqual([dar('charge'), dar('charge'), dar('charge'), dar('charge'), dar('charge')], ['ok', 'ok', 'ok', 'ok', 'lleno'], '4 ranuras pequeñas');
    bot.carga = null;
    assert.equal(sim2.aplicarModo('ASM-01', 'setRecipe', ['motor']), 'ok', 'la misma receta no cambia nada');
    assert.equal(asm.cambio, null);
    asm.marcha = true; sim2.paso(DT);
    assert.equal(sim2.aplicarModo('ASM-01', 'setRecipe', ['missile']), 'ocupado', 'no cambia a mitad de un ciclo');
    for (let i = 0; i < 400; i++) sim2.paso(DT);
    assert.equal(asm.salida.length, 2, 'salida de 2'); assert.equal(C.estadoMaquina(asm), 'blocked');
    assert.equal(sim2.aplicarModo('ASM-01', 'setRecipe', ['missile']), 'ok');
    assert.equal(C.estadoMaquina(asm), 'changeover'); assert.equal(C.instantanea(m).u['ASM-01'].recipe, 'missile');
    for (let i = 0; i < 6 / DT + 2; i++) sim2.paso(DT);
    assert.equal(asm.receta, 'missile');
    assert.equal(orden('pickUp', 'ASM-01', 'charge'), 'ok', 'lo que quedó en la entrada se puede retirar');
    // Energía: con más demanda que suministro todo va más lento, en proporción.
    const e = planta(); e.m.hito = 4; C.indexar(e.m);
    for (const id of ['PRS-01', 'MLD-01', 'MIX-01', 'ASM-01']) { const q = e.m.porId[id]; q.proceso = { receta: q.receta, prog: 0 }; }
    e.sim.paso(DT);
    assert.equal(e.m.energia.uso, 13); assert.ok(Math.abs(e.m.energia.factor - 9 / 13) < 1e-9);
    assert.ok(Math.abs(e.m.porId['PRS-01'].proceso.prog - DT * 9 / 13) < 1e-9);
    console.log('OK: ranuras por clase, cambio de receta y energía compartida');
  }

  // ---------- Pedidos: coste, cola, fondos y bahía ocupada ----------
  {
    const { m, sim } = planta();
    assert.equal(sim.aplicarModo('BAY-1', 'request', ['polymer']), 'ok');
    assert.equal(sim.aplicarModo('BAY-1', 'request', ['steel']), 'ok');
    assert.equal(sim.aplicarModo('BAY-1', 'request', ['steel']), 'ocupado', 'dos pedidos en camino como mucho');
    assert.equal(m.presupuesto, 300 - 60 - 40);
    for (let i = 0; i < 30 / DT; i++) sim.paso(DT);
    assert.equal(m.bahia.pedidos.length, 2, 'con la bahía ocupada el camión espera');
    const t = m.tarimaPorId[m.bahia.tarima]; m.bahia.tarima = null; m.porId['SUP-1'].tarima = t.id; t.en = 'SUP-1';
    sim.paso(DT);
    assert.equal(C.cuantos(m, 'BAY-1', 'polymer'), 12); assert.equal(m.bahia.pedidos.length, 1);
    m.presupuesto = 10;
    assert.equal(sim.aplicarModo('BAY-1', 'request', ['steel']), 'sin_fondos');
    const s = C.instantanea(m); s.presupuesto = 300;
    assert.equal(C.modoEnSnap(s, 'BAY-1', 'request', ['steel']), 'ok'); assert.equal(s.presupuesto, 260); assert.equal(s.u['BAY-1'].pending, 2);
    assert.equal(C.modoEnSnap(s, 'BAY-1', 'request', ['steel']), 'ocupado');
    console.log('OK: pedidos (coste, cola, fondos) y bahía ocupada');
  }
  console.log('Campaign · reglas: todo correcto');
})().catch(e => { console.error(e); process.exit(1); });
