/* Catálogo y reglas de combate, trasladados de juego.js. */
(() => {
  "use strict";
  const LINEA_BASE = 3, T_LIMITE = 400;
  const TIPOS = {
    crawler: { nombre: "oruga", suelo: true, z: 0, vel: 0.8, hp: 2, frio: false, letra: "O" },
    drone: { nombre: "dron", suelo: false, z: 2.5, vel: 2.0, hp: 1, frio: false, letra: "D" },
    stealth: { nombre: "dron frío", suelo: false, z: 2.0, vel: 1.5, hp: 1, frio: true, letra: "F" },
  };
  const SENSOR = {
    visual: { nombre: "cámara", alcance: 14, niebla: 5.5 },
    thermal: { nombre: "térmico", alcance: 11, niebla: 7 },
  };
  const LAU = { cadencia: 1, cadenciaRafaga: 2.2, cargador: 8, suministro: 1, fallaBase: 0.02, fallaRafaga: 0.04, subida: 0.06, bajada: 0.1, bajadaParado: 0.2 };
  const MISIL = { vel: 14, radio: 1.3 };
  const REP = { vel: 4, tBase: 1.5, tPorFallo: 12 };  // reparar tarda más si el fallo llegó con failureRate alto
  const COSTE = { misil: 10, reparacion: 40 };
  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;
  const coma = (v, d = 1) => v.toFixed(d).replace(".", ",");  // decimales en los textos para personas
  const cadencia = (modo) => modo === "burst" ? LAU.cadenciaRafaga : modo === "regular" ? LAU.cadencia : 0;

  function crearMundo(def, semilla) {
    const pendientes = []; let orden = 0;
    for (const o of def.oleadas) {
      const tp = TIPOS[o.tipo];
      const carriles = o.carriles.length ? o.carriles : [9];
      for (let i = 0; i < o.n; i++) pendientes.push({ tipo: o.tipo, nace: o.t + i * o.cada, y: carriles[i % carriles.length] + .5, hp: o.hp || tp.hp, vel: o.vel || tp.vel, orden: orden++ });
    }
    pendientes.sort((a, b) => a.nace - b.nace || a.orden - b.orden);
    const cuenta = {};
    for (const p of pendientes) { cuenta[p.tipo] = (cuenta[p.tipo] || 0) + 1; p.id = TIPOS[p.tipo].letra + cuenta[p.tipo]; }
    const lanzadores = def.lanzadores.map(l => ({
      id: l.id, clase: "lanzador", cx: l.x + .5, cy: l.y + .5, modo: "idle", lugar: null, cd: 0, misiles: def.cargador, carga: 0,
      falla: LAU.fallaBase, riesgo: 0, umbral: 1, tReparar: 0, atascado: false, yaw: Math.PI, sinMisiles: false,
      st: { consumidos: 0, lanzados: 0, impactos: 0, derribos: 0, atascos: 0, tRafaga: 0, fallaMax: LAU.fallaBase },
    }));
    const sensores = def.sensores.map(s => ({ id: s.id, clase: "vibracion", cx: s.x + .5, cy: s.y + .5, alcance: s.alcance, st: { lecturas: 0 } }));
    const deposito = { id: "DEP-01", clase: "deposito", cx: 1.5, cy: 9.5 };
    const reparadores = [];
    for (let i = 0; i < def.reparadores; i++) {
      const bx = 2.4, by = 7.4 + i * 1.1;
      reparadores.push({ id: `REP-0${i + 1}`, clase: "reparador", cx: bx, cy: by, bx, by, estado: "base", objetivo: null, t: 0, st: { reparaciones: 0 } });
    }
    const maquinas = [...lanzadores, ...sensores, deposito, ...reparadores];
    const rng = mulberry32((semilla * 2654435761) >>> 0);
    for (const l of lanzadores) l.umbral = .75 + rng() / 2;
    return {
      def, semilla, rng, t: 0, activo: false, fin: null,
      programables: lanzadores, lanzadores, sensores, deposito, reparadores, maquinas, porId: Object.fromEntries(maquinas.map(e => [e.id, e])),
      colaReparar: [], pendientes, enemigos: [], misiles: [], explosiones: [], derribados: [], sigMisil: 1,
      brechas: 0, derribos: 0, consumidos: 0, impactos: 0, atascos: 0, reparaciones: 0, total: pendientes.length, detalleAtascos: [],
      eventos: [], uso: {}, consolas: { log: 0, info: 0, warn: 0, error: 0 },
    };
  }


  function conectar(mundo, hooks) {
    const { registrar, terminar, avisoSistema, globo } = hooks;
    const COLS = mundo.def.mapa?.cols || 32;
    const alcance = sensor => mundo.def.niebla ? SENSOR[sensor].niebla : SENSOR[sensor].alcance;
  function visible(l, e, sensor) {
    if (sensor === "thermal" && TIPOS[e.tipo].frio) return false;
    return Math.hypot(e.x - l.cx, e.y - l.cy) <= alcance(sensor) + 1e-9;
  }
  // Dónde estará el enemigo cuando llegue el próximo misil de ese lanzador.
  function predecir(l, e) {
    const espera = Math.max(0, l.cd);
    let t = espera, px = e.x, py = e.y;
    for (let k = 0; k < 4; k++) { px = e.x + e.vx * t; py = e.y + e.vy * t; t = espera + Math.hypot(px - l.cx, py - l.cy) / MISIL.vel; }
    return { x: px, y: py };
  }
  // El más avanzado (el más cerca de la base) de ese tipo que vea ese sensor, salvo los que ya tienen
  // en el aire misiles suficientes para derribarlos.
  function apuntar(l, sensor, tipo, pend) {
    let mejor = null;
    for (const e of mundo.enemigos) {
      if (e.tipo !== tipo || !visible(l, e, sensor) || (pend[e.id] || 0) >= e.hp) continue;
      if (!mejor || e.x < mejor.x - 1e-9) mejor = e;
    }
    if (!mejor) return null;
    const p = predecir(l, mejor);
    return { x: r2(p.x), y: r2(p.y), z: mejor.z, id: mejor.id, tipo: mejor.tipo };
  }
  // La vibración da la posición actual (sin predicción) del enemigo de suelo más avanzado.
  function enRango(s) { return mundo.enemigos.filter(e => TIPOS[e.tipo].suelo && Math.hypot(e.x - s.cx, e.y - s.cy) <= s.alcance + 1e-9); }
  function detectar(s, tipo) {
    let mejor = null;
    for (const e of enRango(s)) if ((!tipo || e.tipo === tipo) && (!mejor || e.x < mejor.x - 1e-9)) mejor = e;
    return mejor ? { x: r2(mejor.x), y: r2(mejor.y), z: 0 } : null;
  }

  function instantanea() {
    const pend = {};
    for (const mi of mundo.misiles) if (mi.objetivo) pend[mi.objetivo] = (pend[mi.objetivo] || 0) + 1;
    const maq = {}, auto = {}, vib = {};
    for (const l of mundo.lanzadores) {
      maq[l.id] = { failureRate: r3(l.falla), missiles: l.misiles, mode: l.modo, jammed: l.atascado, fireRate: cadencia(l.modo), sensors: ["visual", "thermal"], target: l.lugar ? { ...l.lugar } : null };
      auto[l.id] = {};
      for (const s of Object.keys(SENSOR)) { auto[l.id][s] = {}; for (const tp of Object.keys(TIPOS)) auto[l.id][s][tp] = apuntar(l, s, tp, pend); }
    }
    for (const s of mundo.sensores) {
      vib[s.id] = { "*": detectar(s, null) };
      for (const tp of Object.keys(TIPOS)) vib[s.id][tp] = TIPOS[tp].suelo ? detectar(s, tp) : null;
      maq[s.id] = { count: enRango(s).length };
    }
    return { t: r2(mundo.t), maq, auto, vib };
  }

  function paso(dt) {
    const m = mundo;
    m.t += dt;
    while (m.pendientes.length && m.pendientes[0].nace <= m.t + 1e-9) {
      const p = m.pendientes.shift(), tp = TIPOS[p.tipo];
      m.enemigos.push({ id: p.id, tipo: p.tipo, x: COLS + .4, y: p.y, z: tp.z, vx: -p.vel, vy: 0, hp: p.hp, hpMax: p.hp, golpeT: -9 });
    }
    for (const e of m.enemigos) { e.x += e.vx * dt; e.y += e.vy * dt; }
    for (const e of m.enemigos) {
      if (e.x > LINEA_BASE) continue;
      e.fuera = true; m.brechas++;
      registrar("—", null, `${TIPOS[e.tipo].nombre} ${e.id}`, "brecha", "bad");
      avisoSistema(`Brecha: ${TIPOS[e.tipo].nombre} ${e.id} cruzó la línea de la base.`);
    }
    m.enemigos = m.enemigos.filter(e => !e.fuera);
    for (const l of m.lanzadores) pasoLanzador(l, dt);
    for (const mi of m.misiles) if (m.t >= mi.t0 + mi.dur - 1e-9) explotar(mi);
    m.misiles = m.misiles.filter(mi => !mi.hecho);
    for (const r of m.reparadores) pasoReparador(r, dt);
    m.explosiones = m.explosiones.filter(x => m.t - x.t0 < 0.8);
    m.derribados = m.derribados.filter(x => m.t - x.t0 < 1.2);
    evaluar();
  }

  function pasoLanzador(l, dt) {
    const m = mundo;
    if (l.modo === "burst" && !l.atascado) { l.falla = Math.min(0.95, l.falla + LAU.subida * dt); l.st.tRafaga += dt; }
    else l.falla = Math.max(LAU.fallaBase, l.falla - (l.modo === "idle" || l.atascado ? LAU.bajadaParado : LAU.bajada) * dt);
    l.st.fallaMax = Math.max(l.st.fallaMax, l.falla);
    if (l.misiles < m.def.cargador) { l.carga += m.def.suministro * dt; if (l.carga >= 1 - 1e-9) { l.misiles++; l.carga -= 1; } }
    else l.carga = 0;
    l.cd = Math.max(l.cd - dt, -dt);
    if (l.lugar) l.yaw = Math.atan2(l.lugar.y - l.cy, l.lugar.x - l.cx);
    if (l.modo === "idle" || !l.lugar || l.atascado || l.cd > 1e-9) return;
    if (l.misiles < 1) {
      if (!l.sinMisiles) { l.sinMisiles = true; registrar(l.id, null, "disparo", "sin_misiles", "warn"); globo(l.id, "sistema", "Sin misiles: espero al suministro"); }
      return;
    }
    l.sinMisiles = false;
    l.misiles--; l.st.consumidos++; m.consumidos++;
    l.cd += 1 / cadencia(l.modo);
    // failureRate es la probabilidad media de fallo por disparo. Se acumula como riesgo contra un umbral
    // aleatorio entre 0,75 y 1,25: en promedio falla 1 de cada 1/failureRate disparos, pero sin rachas extremas.
    l.riesgo += l.falla;
    if (l.riesgo >= l.umbral) {
      l.riesgo = 0; l.umbral = .75 + m.rng() / 2;
      l.atascado = true; l.st.atascos++; m.atascos++;
      l.tReparar = REP.tBase + REP.tPorFallo * l.falla;
      m.detalleAtascos.push({ t: r2(m.t), id: l.id, falla: r3(l.falla), tReparar: r2(l.tReparar) });
      m.colaReparar.push(l.id);
      m.explosiones.push({ x: l.cx, y: l.cy, z: 1, t0: m.t, atasco: true });
      registrar(l.id, null, `fallo con failureRate ${l.falla.toFixed(2)}`, "atasco", "bad");
      globo(l.id, "sistema", m.reparadores.length ? `¡Atasco con fallo al ${Math.round(l.falla * 100)} %! Reparar: ${coma(l.tReparar)} s` : `¡Atasco! No hay robot reparador.`);
      return;
    }
    const L = l.lugar, d = Math.hypot(L.x - l.cx, L.y - l.cy);
    m.misiles.push({ id: m.sigMisil++, de: l.id, x0: l.cx, y0: l.cy, z0: 1, x1: L.x, y1: L.y, z1: L.z || 0, t0: m.t, dur: Math.max(0.12, d / MISIL.vel), objetivo: L.id || null, arco: 0.6 + d * 0.16 });
    l.st.lanzados++;
  }

  function explotar(mi) {
    const m = mundo;
    mi.hecho = true;
    let golpe = false;
    for (const e of m.enemigos) {
      if (Math.hypot(e.x - mi.x1, e.y - mi.y1, e.z - mi.z1) > MISIL.radio) continue;
      e.hp--; e.golpeT = m.t; golpe = true;
      if (e.hp <= 0) {
        e.muerto = true; m.derribos++;
        const l = m.porId[mi.de]; if (l) l.st.derribos++;
        m.derribados.push({ x: e.x, y: e.y, z: e.z, t0: m.t, tipo: e.tipo });
        registrar(mi.de, null, `${TIPOS[e.tipo].nombre} ${e.id}`, "derribado", "ok");
      }
    }
    if (golpe) { m.impactos++; const l = m.porId[mi.de]; if (l) l.st.impactos++; }
    m.explosiones.push({ x: mi.x1, y: mi.y1, z: mi.z1, t0: m.t, golpe });
    m.enemigos = m.enemigos.filter(e => !e.muerto);
  }

  function moverHacia(e, x, y, d) {
    const dx = x - e.cx, dy = y - e.cy, dist = Math.hypot(dx, dy);
    if (dist <= d) { e.cx = x; e.cy = y; return true; }
    e.cx += dx / dist * d; e.cy += dy / dist * d; return false;
  }
  function pasoReparador(r, dt) {
    const m = mundo;
    if ((r.estado === "base" || r.estado === "volver") && m.colaReparar.length) { r.objetivo = m.colaReparar.shift(); r.estado = "ir"; }
    if (r.estado === "ir") {
      const l = m.porId[r.objetivo];
      if (moverHacia(r, l.cx - .9, l.cy + .7, REP.vel * dt)) { r.estado = "reparar"; r.t = l.tReparar; }
    } else if (r.estado === "volver") {
      if (moverHacia(r, r.bx, r.by, REP.vel * dt)) r.estado = "base";
    } else if (r.estado === "reparar") {
      r.t -= dt;
      if (r.t <= 1e-9) {
        const l = m.porId[r.objetivo];
        l.atascado = false; m.reparaciones++; r.st.reparaciones++;
        registrar(r.id, null, `reparar ${l.id}`, "reparado", "ok");
        globo(l.id, "sistema", "Reparado");
        r.objetivo = null;
        if (m.colaReparar.length) { r.objetivo = m.colaReparar.shift(); r.estado = "ir"; } else r.estado = "volver";
      }
    }
  }

  const coste = () => mundo.consumidos * COSTE.misil + mundo.reparaciones * COSTE.reparacion;
  function evaluar() {
    const m = mundo;
    if (!m.activo || m.fin) return;
    const me = m.def.metas;
    if (m.brechas > me.brechasMax) {
      const quietos = m.lanzadores.every(l => !l.st.consumidos);
      const peor = m.detalleAtascos.reduce((a, x) => !a || x.falla > a.falla ? x : a, null);
      const atascos = peor ? ` Hubo ${m.atascos} ${m.atascos === 1 ? "atasco" : "atascos"}; el peor, con failureRate ${peor.falla.toFixed(2)}, tardó ${coma(peor.tReparar)} s en repararse.` : "";
      return terminar("fallo", "brecha", `Hubo ${m.brechas} ${m.brechas === 1 ? "brecha" : "brechas"} (máximo ${me.brechasMax}).` + (quietos ? " Ningún lanzador llegó a disparar." : atascos));
    }
    if (me.atascosMax != null && m.atascos > me.atascosMax) return terminar("fallo", "atascos", `Hubo ${m.atascos} atascos (máximo ${me.atascosMax}).`);
    if (me.tiempoMax != null && m.t > me.tiempoMax + 1e-9) return terminar("fallo", "tiempo", `Se acabaron los ${me.tiempoMax} s y quedan enemigos.`);
    if (m.t > T_LIMITE) return terminar("fallo", "limite", `La defensa sigue después de ${T_LIMITE} s de juego.`);
    if (!m.pendientes.length && !m.enemigos.length && !m.misiles.length) {
      if (me.derribosMin != null && m.derribos < me.derribosMin) return terminar("fallo", "derribos", `Derribaste ${m.derribos}; la meta pedía ${me.derribosMin}.`);
      terminar("victoria", null, null);
    }
  }


    return { paso, evaluar, instantanea, alcance, enRango, coste };
  }
  window.WAR = { crear: crearMundo, conectar, TIPOS, SENSOR, LAU, MISIL, REP, COSTE, cadencia };
})();
