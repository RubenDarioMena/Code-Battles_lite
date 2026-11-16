/* Laboratorio de batalla · reglas del mundo.
 * Maqueta para probar vehículos que salen del muro, ruedas kamikaze y órdenes por clic.
 * Sin DOM ni reloj real: paso fijo y RNG con semilla, como War. Lo cargan la página y pruebas/lab-batalla.cjs. */
(function (raiz) {
  "use strict";
  const COLS = 48, ROWS = 27;      // casillas de 1 m; War usa 32 × 18
  const MURO_X = 7;                // columna del muro: ocupa x de 7 a 8
  const DT = 0.05, T_LIMITE = 600;

  // Enemigos. «para»: x donde se aposta en vez de seguir hasta el muro. «muro»: daño al llegar.
  const TIPOS = {
    crawler: { nombre: "oruga", letra: "O", suelo: true, z: 0, vel: 0.8, hp: 2, muro: 2 },
    drone: { nombre: "dron", letra: "D", suelo: false, z: 2.5, vel: 2.0, hp: 1, muro: 1 },
    gunner: { nombre: "tirador", letra: "T", suelo: true, z: 0, vel: 1.1, hp: 3, muro: 1, para: 25, alcance: 7, vista: 11, cada: 1.3 },
    siege: { nombre: "cañón de asedio", letra: "A", suelo: true, z: 0, vel: 0.7, hp: 8, muro: 4, para: 36, cada: 5 },
    roller: { nombre: "rodador", letra: "R", suelo: true, z: 0, vel: 3, hp: 1, muro: 3, lateral: 2.6, tramo: 1.1 },
  };
  // Unidades del jugador. «sensor»/«niebla»: cuánto ven. «alcance»: hasta dónde llega su arma.
  const CLASES = {
    torreta: { nombre: "torreta", sensor: 14, niebla: 6, alcance: 14, cadencia: 1, cargador: 8, suministro: 1, hp: 0, vel: 0 },
    vehiculo: { nombre: "vehículo con torreta", sensor: 9, niebla: 6, alcance: 8, cadencia: 1, cargador: 10, suministro: 2, hp: 4, vel: 3, reparacion: 0.5 },
    rueda: { nombre: "rueda kamikaze", sensor: 9, niebla: 6, alcance: 0, cadencia: 0, cargador: 0, suministro: 0, hp: 1, vel: 6, radio: 2.5, dano: 8, danoAmigo: 2 },
    radar: { nombre: "radar", sensor: 34, niebla: 34, alcance: 0, cadencia: 0, cargador: 0, suministro: 0, hp: 0, vel: 0 },
  };
  const MISIL = { vel: 14, radio: 1.3 };            // igual que War
  const OBUS = { vel: 8, radio: 0.9, dano: 1 };     // disparo del tirador contra vehículos
  const ASEDIO = { vuelo: 2.2, dano: 1 };           // disparo del cañón de asedio contra el muro
  const RODADOR = { contacto: 1.2, radio: 1.6, dano: 2 };
  const MARCA = 6;                                  // segundos que un enemigo señalado con un clic queda marcado

  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

  function crear(def, semilla) {
    const pendientes = []; let orden = 0;
    for (const o of def.oleadas) {
      const tp = TIPOS[o.tipo], carriles = o.carriles && o.carriles.length ? o.carriles : [13];
      for (let i = 0; i < o.n; i++) pendientes.push({
        tipo: o.tipo, nace: o.t + i * o.cada, y: carriles[i % carriles.length] + .5, hp: o.hp || tp.hp, vel: o.vel || tp.vel,
        para: o.para != null ? o.para : tp.para != null ? tp.para : null, orden: orden++,
      });
    }
    pendientes.sort((a, b) => a.nace - b.nace || a.orden - b.orden);
    const cuenta = {};
    for (const p of pendientes) { cuenta[p.tipo] = (cuenta[p.tipo] || 0) + 1; p.id = TIPOS[p.tipo].letra + cuenta[p.tipo]; }
    const unidades = def.unidades.map(u => {
      const c = CLASES[u.clase];
      return {
        id: u.id, clase: u.clase, cx: u.x + .5, cy: u.y + .5, hx: u.x + .5, hy: u.y + .5, viva: true, vida: 1,
        hp: c.hp, hpMax: c.hp, modo: "idle", lugar: null, cd: 0, misiles: c.cargador, carga: 0, rep: 0, yaw: 0, rumbo: 0, giro: 0,
        ruta: [], destino: null, vx: 0, vy: 0, moviendo: false, detonar: false, reponer: u.reponer || 0, tReponer: 0, golpeT: -9,
        st: { lanzados: 0, impactos: 0, derribos: 0, recorrido: 0, bajas: 0, detonaciones: 0 },
      };
    });
    const muro = def.muro || 20;
    return {
      def, semilla, DT, rng: mulberry32((semilla * 2654435761) >>> 0), t: 0, pasos: 0, activo: false, fin: null,
      unidades, porId: Object.fromEntries(unidades.map(u => [u.id, u])), puertas: (def.puertas || [8, 17]).map(f => f + 1),
      pendientes, enemigos: [], misiles: [], obuses: [], explosiones: [], derribados: [], marcas: {}, sigMisil: 1,
      muro, muroMax: muro, total: pendientes.length, derribos: 0, consumidos: 0, impactos: 0, entradas: [], nClics: 0, golpesMuro: [],
    };
  }

  function conectar(mundo, hooks = {}) {
    const nada = () => {};
    const registrar = hooks.registrar || nada, alLlegar = hooks.alLlegar || nada, alDano = hooks.alDano || nada;
    const alDestruir = hooks.alDestruir || nada, alReponer = hooks.alReponer || nada, terminar = hooks.terminar || nada;
    const m = mundo, centroMuro = MURO_X + .5, dentro = (x) => x < centroMuro;
    const sensorDe = (u) => m.def.niebla ? CLASES[u.clase].niebla : CLASES[u.clase].sensor;
    const moviles = () => m.unidades.filter(u => u.viva && CLASES[u.clase].vel > 0);
    const marcado = (e) => (m.marcas[e.id] || 0) > m.t + 1e-9;

    // ---------- Órdenes (las aplica el runtime cuando llegan del programa) ----------
    // Un vehículo solo cruza el muro por una puerta: la ruta pasa por la que menos rodeo pide.
    function trazar(u, x, y) {
      x = limitar(x, .5, COLS - .5); y = limitar(y, .5, ROWS - .5);
      if (x > MURO_X - .6 && x < MURO_X + 1.6) x = x < centroMuro ? MURO_X - .6 : MURO_X + 1.6;
      const ruta = [];
      // ¿La línea recta ya pasa por el hueco de una puerta? Entonces no hace falta rodeo.
      const xa = Math.max(Math.min(u.cx, x), MURO_X), xb = Math.min(Math.max(u.cx, x), MURO_X + 1);
      const yEn = (px) => Math.abs(x - u.cx) < 1e-9 ? u.cy : u.cy + (y - u.cy) * (px - u.cx) / (x - u.cx);
      const libre = xa > xb || m.puertas.some(p => Math.abs(yEn(xa) - p) <= .75 && Math.abs(yEn(xb) - p) <= .75);
      if (!libre) {
        let g = m.puertas[0];
        for (const p of m.puertas) if (Math.abs(u.cy - p) + Math.abs(y - p) < Math.abs(u.cy - g) + Math.abs(y - g) - 1e-9) g = p;
        const a = { x: MURO_X - .7, y: g }, b = { x: MURO_X + 1.7, y: g };
        ruta.push(...(dentro(u.cx) ? [a, b] : [b, a]));
      }
      ruta.push({ x, y });
      return ruta;
    }
    function ordenar(id, verbo, lugar) {
      const u = m.porId[id];
      if (!u || !u.viva) return "destruida";
      if (verbo === "stopFire") { u.modo = "idle"; u.lugar = null; return "ok"; }
      if (verbo === "regularShoot") {
        if (!lugar) { u.modo = "idle"; u.lugar = null; return "sin_objetivo"; }
        u.modo = "regular"; u.lugar = { x: lugar.x, y: lugar.y, z: lugar.z || 0, id: lugar.id || null };
        return u.misiles < 1 ? "sin_misiles" : Math.hypot(lugar.x - u.cx, lugar.y - u.cy) > CLASES[u.clase].alcance + 1e-9 ? "fuera_de_alcance" : "ok";
      }
      if (verbo === "moveTo") {
        if (u.moviendo) alLlegar(id, "redirigida");
        u.ruta = trazar(u, lugar.x, lugar.y); u.destino = u.ruta[u.ruta.length - 1]; u.moviendo = true;
        return "ok";
      }
      if (verbo === "stop") {
        if (u.moviendo) alLlegar(id, "detenida");
        u.ruta = []; u.destino = null; u.moviendo = false; u.vx = u.vy = 0;
        return "ok";
      }
      if (verbo === "detonate") { u.detonar = true; return "ok"; }
      return "desconocida";
    }

    // ---------- Clics del jugador ----------
    // Un clic cerca de un enemigo lo señala: queda marcado unos segundos y cualquier unidad puede seguirlo con track().
    function enemigoEn(x, y, radio = 1.1) {
      let mejor = null, d0 = radio;
      for (const e of m.enemigos) { const d = Math.hypot(e.x - x, e.y - y); if (d <= d0) { mejor = e; d0 = d; } }
      return mejor;
    }
    const datoEnemigo = (e) => ({ id: e.id, type: e.tipo, x: r2(e.x), y: r2(e.y), z: e.z, vx: r2(e.vx), vy: r2(e.vy), hp: e.hp });
    function clic(x, y, idEnemigo, ids) {
      const e = idEnemigo ? m.enemigos.find(k => k.id === idEnemigo) : null;
      if (e) m.marcas[e.id] = m.t + MARCA;
      m.nClics++;
      m.entradas.push({ paso: m.pasos, clic: { x: r2(x), y: r2(y), enemigo: e ? e.id : null, ids: ids ? [...ids] : null } });
      return e
        ? { kind: "click", target: "enemy", x: r2(e.x), y: r2(e.y), enemy: datoEnemigo(e), t: r2(m.t) }
        : { kind: "click", target: "terrain", x: r2(x), y: r2(y), enemy: null, t: r2(m.t) };
    }

    // ---------- Lo que ven los programas ----------
    function instantanea() {
      const pend = {};
      for (const mi of m.misiles) if (mi.objetivo) pend[mi.objetivo] = (pend[mi.objetivo] || 0) + 1;
      const unidades = {}, radares = {};
      for (const u of m.unidades) {
        const c = CLASES[u.clase];
        unidades[u.id] = {
          kind: u.clase, alive: u.viva, x: r2(u.cx), y: r2(u.cy), hp: u.hp, maxHp: u.hpMax, missiles: u.misiles, maxMissiles: c.cargador,
          mode: u.modo, moving: u.moviendo, target: u.lugar ? { ...u.lugar } : null, destination: u.destino ? { x: r2(u.destino.x), y: r2(u.destino.y) } : null,
          home: { x: u.hx, y: u.hy }, sensor: sensorDe(u), range: c.alcance, vel: c.vel, cd: r2(Math.max(0, u.cd)),
        };
        if (u.clase === "radar") radares[u.id] = { x: u.cx, y: u.cy, range: c.sensor };
      }
      return {
        t: r2(m.t), wall: m.muro, wallMax: m.muroMax, pend, unidades, radares,
        enemigos: m.enemigos.map(e => ({ ...datoEnemigo(e), marked: marcado(e) })),
      };
    }

    // ---------- Paso fijo ----------
    function paso(dt) {
      m.t += dt; m.pasos++;
      while (m.pendientes.length && m.pendientes[0].nace <= m.t + 1e-9) {
        const p = m.pendientes.shift(), tp = TIPOS[p.tipo];
        m.enemigos.push({
          id: p.id, tipo: p.tipo, x: COLS + .4, y: p.y, y0: p.y, z: tp.z, vx: -p.vel, vy: 0, vel: p.vel, hp: p.hp, hpMax: p.hp, para: p.para,
          apostado: false, cd: tp.cada ? tp.cada * .6 : 0, lado: p.orden % 2 ? 1 : -1, tGiro: tp.tramo ? tp.tramo / 2 : 0, yaw: Math.PI, golpeT: -9,
        });
      }
      for (const e of m.enemigos) pasoEnemigo(e, dt);
      for (const e of m.enemigos) {
        if (e.x > MURO_X + 1.4 || e.fuera) continue;
        e.fuera = true;
        danarMuro(TIPOS[e.tipo].muro, e.y, `${TIPOS[e.tipo].nombre} ${e.id} llegó al muro`);
        m.explosiones.push({ x: e.x, y: e.y, z: 0, t0: m.t, r: 1.2, muro: true });
      }
      m.enemigos = m.enemigos.filter(e => !e.fuera && !e.muerto);
      for (const u of m.unidades) pasoUnidad(u, dt);
      for (const mi of m.misiles) if (m.t >= mi.t0 + mi.dur - 1e-9) explotar(mi);
      m.misiles = m.misiles.filter(mi => !mi.hecho);
      for (const o of m.obuses) if (m.t >= o.t0 + o.dur - 1e-9) caer(o);
      m.obuses = m.obuses.filter(o => !o.hecho);
      m.enemigos = m.enemigos.filter(e => !e.muerto);
      m.explosiones = m.explosiones.filter(x => m.t - x.t0 < 0.9);
      m.derribados = m.derribados.filter(x => m.t - x.t0 < 1.4);
      m.golpesMuro = m.golpesMuro.filter(x => m.t - x.t0 < 1.2);
      evaluar();
    }

    function danarMuro(n, y, texto) {
      m.muro = Math.max(0, m.muro - n);
      m.golpesMuro.push({ y, t0: m.t, n });
      registrar("MURO", `${texto}: −${n} (quedan ${m.muro})`, "bad");
    }

    function pasoEnemigo(e, dt) {
      const tp = TIPOS[e.tipo];
      if (!e.apostado && e.para != null && e.x <= e.para + 1e-9) { e.apostado = true; e.vx = 0; e.vy = 0; registrar(e.id, `${tp.nombre} ${e.id} se aposta en x ${r2(e.x)}`, "warn"); }
      if (e.tipo === "roller") {
        // Zigzag en dientes de sierra: entre giro y giro va recto, así una predicción lineal acierta o no según cuándo llegue el misil.
        e.tGiro -= dt;
        if (e.tGiro <= 1e-9) { e.lado = -e.lado; e.tGiro += tp.tramo; }
        if ((e.y < 1.6 && e.lado < 0) || (e.y > ROWS - 1.6 && e.lado > 0)) e.lado = -e.lado;
        e.vy = e.lado * tp.lateral;
        const cerca = moviles().find(u => !dentro(u.cx) && Math.hypot(u.cx - e.x, u.cy - e.y) <= RODADOR.contacto);
        if (cerca) {
          e.muerto = true;
          m.explosiones.push({ x: e.x, y: e.y, z: 0, t0: m.t, r: RODADOR.radio, enemiga: true });
          for (const u of moviles()) if (!dentro(u.cx) && Math.hypot(u.cx - e.x, u.cy - e.y) <= RODADOR.radio) danar(u, RODADOR.dano, `rodador ${e.id}`);
          registrar(e.id, `rodador ${e.id} estalló contra ${cerca.id}`, "warn");
          return;
        }
      }
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.vx || e.vy) e.yaw = Math.atan2(e.vy, e.vx);
      if (e.tipo === "gunner") {
        e.cd = Math.max(0, e.cd - dt);
        let blanco = null, d0 = tp.alcance + 1e-9;
        // El más cercano que no tenga ya en el aire proyectiles suficientes: la misma regla que autoTarget, vista desde el otro lado.
        for (const u of moviles()) {
          if (dentro(u.cx) || m.obuses.filter(o => o.blanco === u.id && !o.hecho).length >= u.hp) continue;
          const d = Math.hypot(u.cx - e.x, u.cy - e.y); if (d <= d0) { blanco = u; d0 = d; }
        }
        e.blanco = blanco ? blanco.id : null;
        if (e.apostado) {
          // Apostado, persigue al vehículo que ve fuera de su alcance y vuelve a su puesto cuando lo pierde.
          let visto = null, v0 = tp.vista + 1e-9;
          if (!blanco) for (const u of moviles()) { if (dentro(u.cx)) continue; const d = Math.hypot(u.cx - e.x, u.cy - e.y); if (d <= v0) { visto = u; v0 = d; } }
          const hacia = visto ? { x: visto.cx, y: visto.cy } : blanco ? null : { x: e.para, y: e.y0 };
          const d = hacia ? Math.hypot(hacia.x - e.x, hacia.y - e.y) : 0;
          if (d > .05) { e.vx = (hacia.x - e.x) / d * e.vel; e.vy = (hacia.y - e.y) / d * e.vel; } else { e.vx = 0; e.vy = 0; }
        }
        if (blanco) {
          // Dispara adonde estará el blanco si sigue recto: la misma predicción que autoTarget, vista desde el otro lado.
          // Punto de encuentro exacto (ecuación de segundo grado): la rueda corre casi tanto como el proyectil y tantear no basta.
          const dx = blanco.cx - e.x, dy = blanco.cy - e.y, a = blanco.vx * blanco.vx + blanco.vy * blanco.vy - OBUS.vel * OBUS.vel;
          const b = 2 * (dx * blanco.vx + dy * blanco.vy), c = dx * dx + dy * dy, disc = b * b - 4 * a * c;
          const t = disc >= 0 && Math.abs(a) > 1e-9 ? (-b - Math.sqrt(disc)) / (2 * a) : Math.sqrt(c) / OBUS.vel;
          const px = blanco.cx + blanco.vx * t, py = blanco.cy + blanco.vy * t;
          e.yaw = Math.atan2(py - e.y, px - e.x);
          if (e.cd <= 1e-9) {
            e.cd = tp.cada;
            m.obuses.push({ de: e.id, blanco: blanco.id, x0: e.x, y0: e.y, x1: px, y1: py, t0: m.t, dur: Math.max(0.15, Math.hypot(px - e.x, py - e.y) / OBUS.vel), clase: "obus" });
          }
        }
      } else if (e.tipo === "siege" && e.apostado) {
        e.cd -= dt;
        if (e.cd <= 1e-9) {
          e.cd += tp.cada;
          const y = 1 + m.rng() * (ROWS - 2);
          e.yaw = Math.atan2(y - e.y, centroMuro - e.x);
          m.obuses.push({ de: e.id, x0: e.x, y0: e.y, x1: centroMuro, y1: y, t0: m.t, dur: ASEDIO.vuelo, clase: "asedio" });
        }
      }
    }

    function caer(o) {
      o.hecho = true;
      if (o.clase === "asedio") {
        danarMuro(ASEDIO.dano, o.y1, `impacto del cañón de asedio ${o.de}`);
        m.explosiones.push({ x: o.x1, y: o.y1, z: 0, t0: m.t, r: 1.5, muro: true });
        return;
      }
      let golpe = false;
      for (const u of moviles()) {
        if (dentro(u.cx) || Math.hypot(u.cx - o.x1, u.cy - o.y1) > OBUS.radio) continue;
        golpe = true; danar(u, OBUS.dano, `tirador ${o.de}`);
      }
      m.explosiones.push({ x: o.x1, y: o.y1, z: 0, t0: m.t, r: OBUS.radio, enemiga: true, golpe });
    }

    function danar(u, n, causa) {
      if (!u.viva) return;
      u.hp -= n; u.golpeT = m.t;
      if (u.hp > 0) { registrar(u.id, `${u.id} recibió un impacto de ${causa} (hp ${u.hp})`, "warn"); alDano(u.id, { hp: u.hp, by: causa }); return; }
      registrar(u.id, `${u.id} destruida por ${causa}`, "bad");
      destruir(u);
    }
    function destruir(u) {
      if (u.moviendo) alLlegar(u.id, "destruida");
      u.viva = false; u.hp = 0; u.modo = "idle"; u.lugar = null; u.ruta = []; u.destino = null; u.moviendo = false; u.vx = u.vy = 0; u.detonar = false;
      u.st.bajas++; u.tReponer = u.reponer;
      m.derribados.push({ x: u.cx, y: u.cy, z: 0, t0: m.t, amiga: true });
      alDestruir(u.id);
    }

    function pasoUnidad(u, dt) {
      const c = CLASES[u.clase];
      if (!u.viva) {
        if (u.reponer && !m.fin) {
          u.tReponer -= dt;
          if (u.tReponer <= 1e-9) {
            Object.assign(u, { viva: true, vida: u.vida + 1, cx: u.hx, cy: u.hy, hp: u.hpMax, misiles: c.cargador, carga: 0, rep: 0, cd: 0, golpeT: -9 });
            registrar(u.id, `${u.id} repuesta en la base`, "ok");
            alReponer(u.id);
          }
        }
        return;
      }
      if (u.detonar) {
        // La carga alcanza todo lo que esté cerca en el suelo: enemigos y también vehículos propios (entre ruedas no se dañan).
        u.st.detonaciones++;
        m.explosiones.push({ x: u.cx, y: u.cy, z: 0, t0: m.t, r: c.radio, carga: true });
        let bajas = 0;
        for (const e of m.enemigos) {
          if (e.muerto || Math.hypot(e.x - u.cx, e.y - u.cy, e.z) > c.radio) continue;
          e.hp -= c.dano; e.golpeT = m.t;
          if (e.hp <= 0) { derribar(e, u); bajas++; }
        }
        for (const v of moviles()) if (v.clase === "vehiculo" && Math.hypot(v.cx - u.cx, v.cy - u.cy) <= c.radio) danar(v, c.danoAmigo, `la carga de ${u.id}`);
        registrar(u.id, `${u.id} detonó: ${bajas} ${bajas === 1 ? "derribo" : "derribos"}`, bajas ? "ok" : "warn");
        destruir(u);
        return;
      }
      // Movimiento por la ruta.
      if (u.moviendo) {
        let queda = c.vel * dt; const x0 = u.cx, y0 = u.cy;
        while (queda > 1e-9 && u.ruta.length) {
          const p = u.ruta[0], dx = p.x - u.cx, dy = p.y - u.cy, d = Math.hypot(dx, dy);
          if (d <= queda) { u.cx = p.x; u.cy = p.y; queda -= d; u.ruta.shift(); }
          else { u.cx += dx / d * queda; u.cy += dy / d * queda; queda = 0; }
        }
        const hecho = Math.hypot(u.cx - x0, u.cy - y0);
        u.vx = (u.cx - x0) / dt; u.vy = (u.cy - y0) / dt; u.st.recorrido += hecho; u.giro += hecho;
        if (hecho > 1e-6) { u.rumbo = Math.atan2(u.vy, u.vx); if (!u.lugar) u.yaw = u.rumbo; }
        if (!u.ruta.length) { u.moviendo = false; u.destino = null; u.vx = u.vy = 0; alLlegar(u.id, "ok"); }
      }
      // Dentro del muro los vehículos se reparan y recargan; las torretas reciben suministro siempre.
      const abastece = u.clase === "torreta" || (u.clase === "vehiculo" && dentro(u.cx));
      if (c.cargador) {
        if (abastece && u.misiles < c.cargador) { u.carga += c.suministro * dt; if (u.carga >= 1 - 1e-9) { u.misiles++; u.carga -= 1; } }
        else if (u.misiles >= c.cargador) u.carga = 0;
      }
      if (c.reparacion && dentro(u.cx) && u.hp < u.hpMax) { u.rep += c.reparacion * dt; if (u.rep >= 1 - 1e-9) { u.hp++; u.rep -= 1; } } else u.rep = 0;
      if (!c.cadencia) return;
      u.cd = Math.max(u.cd - dt, -dt);
      if (u.lugar) u.yaw = Math.atan2(u.lugar.y - u.cy, u.lugar.x - u.cx);
      if (u.modo === "idle" || !u.lugar || u.cd > 1e-9 || u.misiles < 1) return;
      const L = u.lugar, d = Math.hypot(L.x - u.cx, L.y - u.cy);
      if (d > c.alcance + 1e-9) return;                       // sigue apuntando; dispara cuando entre en alcance
      u.misiles--; u.st.lanzados++; m.consumidos++;
      u.cd += 1 / c.cadencia;
      m.misiles.push({ id: m.sigMisil++, de: u.id, x0: u.cx, y0: u.cy, z0: 1, x1: L.x, y1: L.y, z1: L.z || 0, t0: m.t, dur: Math.max(0.12, d / MISIL.vel), objetivo: L.id || null, arco: 0.6 + d * 0.16 });
    }

    function derribar(e, u) {
      e.muerto = true; m.derribos++;
      if (u) u.st.derribos++;
      m.derribados.push({ x: e.x, y: e.y, z: e.z, t0: m.t, tipo: e.tipo });
      registrar(u ? u.id : "—", `${TIPOS[e.tipo].nombre} ${e.id} derribado`, "ok");
    }
    function explotar(mi) {
      mi.hecho = true;
      let golpe = false; const u = m.porId[mi.de];
      for (const e of m.enemigos) {
        if (e.muerto || Math.hypot(e.x - mi.x1, e.y - mi.y1, e.z - mi.z1) > MISIL.radio) continue;
        e.hp--; e.golpeT = m.t; golpe = true;
        if (e.hp <= 0) derribar(e, u);
      }
      if (golpe) { m.impactos++; if (u) u.st.impactos++; }
      m.explosiones.push({ x: mi.x1, y: mi.y1, z: mi.z1, t0: m.t, r: MISIL.radio, golpe });
    }

    function evaluar() {
      if (!m.activo || m.fin) return;
      const limite = m.def.tiempoMax || T_LIMITE;
      if (m.muro <= 0) return terminar("fallo", "muro", "El muro cayó.");
      if (m.t > limite + 1e-9) return terminar("fallo", "tiempo", `Se acabaron los ${limite} s y quedan enemigos.`);
      if (!m.pendientes.length && !m.enemigos.length && !m.misiles.length && !m.obuses.length) terminar("victoria", null, null);
    }

    return { paso, evaluar, instantanea, ordenar, clic, enemigoEn, sensorDe, marcado, dentro, trazar };
  }

  const API = { COLS, ROWS, MURO_X, DT, T_LIMITE, TIPOS, CLASES, MISIL, OBUS, ASEDIO, RODADOR, MARCA, crear, conectar };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else raiz.LAB_MUNDO = API;
})(typeof window !== "undefined" ? window : globalThis);
