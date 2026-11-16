/* Laboratorio de batalla · runtime de los programas.
 * Un Web Worker por unidad, como War: el mundo solo avanza cuando todos los programas esperan (lockstep).
 * Lo nuevo es que un programa puede tener varios hilos: su cuerpo y los oyentes de eventos (onClick, onDamage).
 * Cada hilo aparcado en wait()/arrive() cuenta como «en espera»; el mundo avanza cuando no queda ninguno corriendo.
 * Sin DOM: la página y pruebas/lab-batalla.cjs le pasan cómo crear un Worker. */
(function (raiz) {
  "use strict";

  // ---------- Código del Worker (se convierte en texto; no puede usar nada de fuera) ----------
  const trabajador = function () {
    const AF = Object.getPrototypeOf(async function () {}).constructor;
    let SNAP = null, YO = "", CLASE = "", NOMBRES = [], CONF = {}, OFF = null, seq = 0;
    const esperas = new Map();
    const oyentes = { click: [], terrain: [], enemy: [], damage: [] };
    const r2 = (v) => Math.round(v * 100) / 100;
    const nombreVar = (id) => id.replace(/-/g, "_");
    const copia = (v) => v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v;
    const redondo = (x) => typeof x === "number" ? Math.round(x * 1000) / 1000 : x;
    function fmt(v) {
      if (typeof v === "string") return v;
      if (typeof v === "number") return String(redondo(v));
      if (v === undefined) return "undefined";
      try { return JSON.stringify(v, (k, x) => redondo(x)); } catch (_) { return String(v); }
    }
    const q = (v) => typeof v === "string" ? JSON.stringify(v) : fmt(v);
    const lista = (a) => a.map(x => '"' + x + '"').join(", ");
    function lineaDe(e) {
      const s = String((e && e.stack) || "");
      const m = s.match(/<anonymous>:(\d+):\d+/) || s.match(/> Function:(\d+):\d+/) || s.match(/(?:eval code|anonymous)[^\n]*?:(\d+):\d+/);
      return m ? +m[1] : null;
    }
    const yo = () => SNAP.unidades[YO];

    // ----- Lecturas: no avanzan el tiempo; salen de la instantánea del último despertar -----
    const veo = (u, e) => e.marked || Math.hypot(e.x - u.x, e.y - u.y) <= u.sensor + 1e-9;
    // Dónde estará el enemigo cuando llegue mi disparo (o yo misma, si soy una rueda).
    function predecir(u, e) {
      const vel = u.kind === "rueda" ? u.vel : CONF.velMisil, espera = Math.max(0, u.cd || 0);
      let t = espera, px = e.x, py = e.y;
      for (let k = 0; k < 4; k++) { px = e.x + e.vx * t; py = e.y + e.vy * t; t = espera + Math.hypot(px - u.x, py - u.y) / vel; }
      return { x: r2(px), y: r2(py), z: e.z, id: e.id, type: e.type, hp: e.hp };
    }
    function tipoValido(fn, tipo) {
      if (tipo !== undefined && tipo !== null && !CONF.tipos.includes(tipo)) throw Error(fn + " acepta un tipo de enemigo (" + lista(CONF.tipos) + ") o nada. Recibió " + q(tipo) + ".");
    }
    function autoTarget(tipo) {
      tipoValido("autoTarget", tipo);
      const u = yo();
      let mejor = null, d0 = Infinity;
      for (const e of SNAP.enemigos) {
        if ((tipo && e.type !== tipo) || !veo(u, e)) continue;
        const d = Math.hypot(e.x - u.x, e.y - u.y);
        if (u.range && d > u.range + 1e-9) continue;                 // con arma: solo lo que puede alcanzar
        if (u.range && (SNAP.pend[e.id] || 0) >= e.hp) continue;     // ya tiene en el aire misiles suficientes
        const clave = u.kind === "torreta" ? e.x : d;                // torreta: el más avanzado; vehículo: el más cercano
        if (clave < d0 - 1e-9) { mejor = e; d0 = clave; }
      }
      return mejor ? predecir(u, mejor) : null;
    }
    // Seguimiento por identidad: solo si mi sensor lo ve o el jugador lo tiene marcado con un clic.
    function track(ref) {
      const id = typeof ref === "string" ? ref : ref && typeof ref === "object" ? ref.id : null;
      if (!id) return null;
      const e = SNAP.enemigos.find(k => k.id === id), u = yo();
      return e && veo(u, e) ? predecir(u, e) : null;
    }
    const dato = (e) => ({ x: e.x, y: e.y, z: e.z, id: e.id, type: e.type, hp: e.hp, vx: e.vx, vy: e.vy });
    function radar(id) {
      const enRango = () => { const r = SNAP.radares[id]; return SNAP.enemigos.filter(e => Math.hypot(e.x - r.x, e.y - r.y) <= r.range + 1e-9); };
      const o = {
        detect(tipo) { tipoValido(nombreVar(id) + ".detect", tipo); let m = null; for (const e of enRango()) if ((!tipo || e.type === tipo) && (!m || e.x < m.x - 1e-9)) m = e; return m ? dato(m) : null; },
        locate(ref) { const k = typeof ref === "string" ? ref : ref && ref.id; const e = enRango().find(x => x.id === k); return e ? dato(e) : null; },
        list(tipo) { tipoValido(nombreVar(id) + ".list", tipo); return enRango().filter(e => !tipo || e.type === tipo).sort((a, b) => a.x - b.x).map(dato); },
      };
      Object.defineProperty(o, "count", { enumerable: true, get: () => enRango().length });
      Object.defineProperty(o, "id", { enumerable: true, value: id });
      return o;
    }
    const PROPS = { position: (u) => u.alive ? { x: u.x, y: u.y } : null, hp: (u) => u.alive ? u.hp : null, missiles: (u) => u.alive ? u.missiles : null,
      mode: (u) => u.mode, moving: (u) => u.moving, home: (u) => copia(u.home), alive: (u) => u.alive, target: (u) => copia(u.target), destination: (u) => copia(u.destination) };
    function otra(id) {
      if (SNAP.radares[id]) return radar(id);
      const o = {};
      for (const [k, f] of Object.entries(PROPS)) Object.defineProperty(o, k, { enumerable: true, get: () => f(SNAP.unidades[id]) });
      Object.defineProperty(o, "id", { enumerable: true, value: id });
      return new Proxy(o, { get(t, p) {
        if (typeof p === "symbol" || p in t || p === "then" || p === "toJSON") return t[p];
        throw Error(nombreVar(id) + "." + String(p) + " no existe. Desde otro programa solo se puede leer: " + Object.keys(t).join(", ") + ".");
      } });
    }

    // ----- Órdenes: modos instantáneos, solo para la unidad dueña del programa -----
    const PUEDE = {
      torreta: ["regularShoot", "stopFire"],
      vehiculo: ["regularShoot", "stopFire", "moveTo", "stop", "arrive"],
      rueda: ["moveTo", "stop", "arrive", "detonate"],
    };
    function puede(verbo) {
      if (!PUEDE[CLASE].includes(verbo)) throw Error(YO + " es " + CONF.articulos[CLASE] + ": no tiene " + verbo + "(). Puede: " + PUEDE[CLASE].join(", ") + ".");
    }
    function lugarDe(fn, v) {
      if (v == null) return null;
      if (typeof v !== "object" || !Number.isFinite(+v.x) || !Number.isFinite(+v.y)) throw Error(fn + " necesita un lugar con x e y, como el que devuelve autoTarget() o el clic. Recibió " + q(v) + ".");
      return { x: +v.x, y: +v.y, z: Number.isFinite(+v.z) ? +v.z : 0, id: typeof v.id === "string" ? v.id : null };
    }
    function regularShoot(pos) {
      puede("regularShoot");
      const u = yo(), lugar = lugarDe("regularShoot", pos);
      postMessage({ type: "cmd", verbo: "regularShoot", lugar });
      if (!lugar) { u.mode = "idle"; u.target = null; return "sin_objetivo"; }
      u.mode = "regular"; u.target = lugar;
      return u.missiles < 1 ? "sin_misiles" : Math.hypot(lugar.x - u.x, lugar.y - u.y) > u.range + 1e-9 ? "fuera_de_alcance" : "ok";
    }
    function stopFire() { puede("stopFire"); const u = yo(); u.mode = "idle"; u.target = null; postMessage({ type: "cmd", verbo: "stopFire" }); return "ok"; }
    function moveTo(pos) {
      puede("moveTo");
      const lugar = lugarDe("moveTo", pos);
      if (!lugar) throw Error("moveTo necesita un lugar con x e y. Recibió " + q(pos) + ". Para quedarse quieta usa stop().");
      const u = yo(); u.moving = true; u.destination = { x: lugar.x, y: lugar.y };
      postMessage({ type: "cmd", verbo: "moveTo", lugar });
      return "ok";
    }
    function stop() { puede("stop"); const u = yo(); u.moving = false; u.destination = null; postMessage({ type: "cmd", verbo: "stop" }); return "ok"; }
    function detonate() { puede("detonate"); postMessage({ type: "cmd", verbo: "detonate" }); return "ok"; }

    // ----- Esperas: aparcan este hilo y dejan avanzar el mundo -----
    function aparcar(mensaje) {
      if (esperas.size >= 40) throw Error("Hay demasiadas esperas pendientes: ¿falta un await delante de wait() o arrive()?");
      const id = ++seq;
      postMessage({ ...mensaje, id });
      return new Promise((resolve) => esperas.set(id, resolve));
    }
    function wait(s) {
      if (typeof s !== "number" || !(s >= 0.05) || s > 60) throw Error("wait necesita segundos entre 0.05 y 60, por ejemplo await wait(0.5). Recibió " + q(s) + ".");
      return aparcar({ type: "espera", s });
    }
    function arrive() { puede("arrive"); return aparcar({ type: "llegar" }); }

    // ----- Eventos: el jugador hace clic durante la batalla y los oyentes corren en ese instante -----
    function oir(clase, fn, nombre) {
      if (typeof fn !== "function") throw Error(nombre + " necesita una función, por ejemplo " + nombre + "((lugar) => { … }). Recibió " + q(fn) + ".");
      oyentes[clase].push(fn);
      postMessage({ type: "oyentes", click: oyentes.click.length + oyentes.terrain.length + oyentes.enemy.length > 0, damage: oyentes.damage.length > 0 });
    }
    function reportar(e) {
      let linea = lineaDe(e);
      if (linea != null && OFF != null && !isNaN(OFF)) linea -= OFF; else linea = null;
      postMessage({ type: "error", mensaje: String((e && e.message) || e), linea });
    }
    async function despachar(m) {
      const ev = m.ev;
      let llamadas = [];
      if (ev.kind === "click") {
        llamadas = oyentes.click.map(f => () => f(copia(ev)));
        if (ev.enemy) llamadas.push(...oyentes.enemy.map(f => () => f(copia(ev.enemy))));
        else llamadas.push(...oyentes.terrain.map(f => () => f({ x: ev.x, y: ev.y, z: 0 })));
      } else if (ev.kind === "damage") llamadas = oyentes.damage.map(f => () => f(copia(ev)));
      try { await Promise.all(llamadas.map(f => f())); postMessage({ type: "evfin" }); }
      catch (e) { reportar(e); }
    }

    function consola(nivel, a) { postMessage({ type: "consola", nivel, texto: a.map(fmt).join(" ") }); }
    function instalar() {
      const g = self;
      Object.assign(g, {
        autoTarget, track, regularShoot, stopFire, moveTo, stop, detonate, wait, esperar: wait, arrive,
        onClick: (fn) => oir("click", fn, "onClick"), onDamage: (fn) => oir("damage", fn, "onDamage"),
        terrain: { onClick: (fn) => oir("terrain", fn, "terrain.onClick") },
        enemies: { onClick: (fn) => oir("enemy", fn, "enemies.onClick") },
        distance: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
        log: (...a) => consola("log", a),
        console: { log: (...a) => consola("log", a), info: (...a) => consola("info", a), warn: (...a) => consola("warn", a), error: (...a) => consola("error", a) },
      });
      for (const [k, f] of Object.entries(PROPS)) Object.defineProperty(g, k, { configurable: true, get: () => f(yo()) });
      Object.defineProperty(g, "time", { configurable: true, get: () => SNAP.t });
      Object.defineProperty(g, "wall", { configurable: true, get: () => SNAP.wall });
      for (const id of NOMBRES) Object.defineProperty(g, nombreVar(id), { configurable: true, get: () => otra(id) });
    }

    self.onmessage = async (ev) => {
      const m = ev.data;
      if (m.type === "despierta") {
        SNAP = m.snap;
        const resolver = esperas.get(m.id);
        if (resolver) { esperas.delete(m.id); resolver(m.resultado === undefined ? "ok" : m.resultado); }
        return;
      }
      if (m.type === "evento") { SNAP = m.snap; despachar(m); return; }
      if (m.type !== "run") return;
      SNAP = m.snap; YO = m.propia; CLASE = m.clase; NOMBRES = m.nombres; CONF = m.conf;
      if (OFF === null) {
        try { await new AF("\nthrow new Error('x')")(); } catch (e) { const n = lineaDe(e); OFF = n == null ? NaN : n - 2; }
      }
      instalar();
      let fn;
      try { fn = new AF(m.codigo); }
      catch (e) { postMessage({ type: "error", mensaje: "Error de sintaxis: " + e.message, linea: null }); return; }
      try { await fn(); postMessage({ type: "done" }); }
      catch (e) { reportar(e); }
    };
  };
  const fuente = "(" + trabajador.toString() + ")();";

  // ---------- Gestor de programas (hilo principal) ----------
  const VIGIA_MS = 2500, MAX_MENSAJES = 4000;
  function crear({ mundo, sim, codigos, conf, crearTrabajador, ahora = () => Date.now(), alConsola = () => {}, alError = () => {}, alCambio = () => {} }) {
    const progs = new Map(), cola = [], quietos = [];
    let cerrado = false;
    const nombres = mundo.unidades.map(u => u.id);
    const corre = (p) => p.estado === "vivo" && p.activos > 0;
    const quieto = () => { for (const p of progs.values()) if (corre(p)) return false; return true; };
    function avisarQuieto() { if (!quieto()) return; for (const f of quietos.splice(0)) f(); if (api.alAsentar) api.alAsentar(); }
    function sumar(p, n) {
      if (n > 0 && p.activos === 0) { p.desde = ahora(); p.mensajes = 0; }
      p.activos = Math.max(0, p.activos + n);
    }
    function matar(p, estado) { try { p.worker.terminate(); } catch (_) { /* ya no existe */ } p.estado = estado; p.activos = 0; p.esperas.clear(); p.oyentes = { click: false, damage: false }; }
    function fallar(p, mensaje, linea) { matar(p, "error"); p.error = { mensaje, linea }; alError(p.id, mensaje, linea); alCambio(); avisarQuieto(); }

    function lanzar(id) {
      const u = mundo.porId[id], codigo = codigos[id];
      if (!u || u.clase === "radar" || !codigo || !codigo.trim()) return;
      const worker = crearTrabajador();
      const p = { id, worker, estado: "vivo", activos: 1, esperas: new Map(), oyentes: { click: false, damage: false }, cuerpo: true, desde: ahora(), mensajes: 0, error: null, ordenes: 0 };
      progs.set(id, p);
      worker.onmessage = (ev) => { if (!cerrado && progs.get(id) === p && p.estado === "vivo") alMensaje(p, ev.data); };
      worker.postMessage({ type: "run", codigo, propia: id, clase: u.clase, nombres, snap: sim.instantanea(), conf });
    }
    function alMensaje(p, m) {
      if (++p.mensajes > MAX_MENSAJES) return fallar(p, "El programa manda órdenes sin parar: le falta un await wait(...) dentro del bucle.", null);
      if (m.type === "espera") { p.esperas.set(m.id, { hasta: mundo.t + m.s }); sumar(p, -1); }
      else if (m.type === "llegar") { p.esperas.set(m.id, { llegar: true, listo: mundo.porId[p.id].moviendo ? null : "ok" }); sumar(p, -1); }
      else if (m.type === "cmd") { p.ordenes++; sim.ordenar(p.id, m.verbo, m.lugar); }
      else if (m.type === "consola") alConsola(p.id, m.nivel, m.texto);
      else if (m.type === "oyentes") { p.oyentes = { click: !!m.click, damage: !!m.damage }; alCambio(); }
      else if (m.type === "done") { p.cuerpo = false; sumar(p, -1); alCambio(); }
      else if (m.type === "evfin") sumar(p, -1);
      else if (m.type === "error") return fallar(p, m.mensaje, m.linea);
      avisarQuieto();
    }
    // Despierta los hilos cuya espera venció: todos reciben la misma instantánea.
    function despertar() {
      let snap = null, alguno = false;
      for (const p of progs.values()) {
        if (p.estado !== "vivo") continue;
        for (const [id, e] of p.esperas) {
          if (e.llegar ? !e.listo : e.hasta > mundo.t + 1e-9) continue;
          snap = snap || sim.instantanea();
          p.esperas.delete(id); sumar(p, 1); alguno = true;
          p.worker.postMessage({ type: "despierta", id, snap, resultado: e.llegar ? e.listo : "ok" });
        }
      }
      return alguno;
    }
    // Reparte los eventos en cola a los programas que los escuchan.
    function entregar() {
      let snap = null, alguno = false;
      for (const c of cola.splice(0)) {
        if (c.programa) {
          // Reprogramar en caliente: esa unidad empieza de nuevo con el código recibido. Queda grabado como una entrada más.
          const p = progs.get(c.programa.id), u = mundo.porId[c.programa.id];
          codigos[c.programa.id] = c.programa.codigo;
          mundo.entradas.push({ paso: mundo.pasos, programa: { ...c.programa } });
          if (p && p.estado === "vivo") matar(p, "fin");
          if (u && u.viva) { lanzar(c.programa.id); alguno = true; }
          alCambio();
          continue;
        }
        const ev = c.clic ? sim.clic(c.clic.x, c.clic.y, c.clic.enemigo, c.ids) : c.ev;
        const clase = ev.kind === "click" ? "click" : "damage";
        for (const p of progs.values()) {
          if (p.estado !== "vivo" || !p.oyentes[clase] || (c.ids && !c.ids.includes(p.id))) continue;
          snap = snap || sim.instantanea();
          sumar(p, 1); alguno = true;
          p.worker.postMessage({ type: "evento", ev, snap });
        }
      }
      return alguno;
    }
    const api = {
      progs, quieto, despertar, entregar,
      iniciar() { for (const id of nombres) lanzar(id); alCambio(); },
      // ids: unidades que reciben el clic; null = todas las que tengan oyentes.
      clic(x, y, enemigo, ids) { cola.push({ clic: { x, y, enemigo: enemigo || null }, ids: ids && ids.length ? [...ids] : null }); },
      reprogramar(id, codigo) { cola.push({ programa: { id, codigo } }); },
      alLlegar(id, res) { const p = progs.get(id); if (p) for (const e of p.esperas.values()) if (e.llegar && !e.listo) e.listo = res; },
      alDano(id, info) { cola.push({ ev: { kind: "damage", hp: info.hp, by: info.by }, ids: [id] }); },
      alDestruir(id) { const p = progs.get(id); if (p && p.estado === "vivo") { matar(p, "destruida"); alCambio(); } },
      alReponer(id) { lanzar(id); alCambio(); },
      alQuieto: () => new Promise((resolve) => { if (quieto()) resolve(); else quietos.push(resolve); }),
      vigia() {
        const t = ahora();
        for (const p of progs.values()) if (corre(p) && t - p.desde > VIGIA_MS) fallar(p, "El programa lleva más de 2,5 s sin ceder el turno: ¿un bucle sin await wait(...)?", null);
      },
      oyen(clase) { return [...progs.values()].filter(p => p.estado === "vivo" && p.oyentes[clase]).map(p => p.id); },
      cerrar() { cerrado = true; for (const p of progs.values()) if (p.estado === "vivo") matar(p, "fin"); for (const f of quietos.splice(0)) f(); },
    };
    return api;
  }

  // Avanza hasta «max» pasos fijos mientras ningún programa esté corriendo. «inyectar» repone clics grabados.
  function bombear(mundo, sim, rt, max, inyectar) {
    let n = 0;
    while (n < max && mundo.activo && !mundo.fin && rt.quieto()) {
      if (inyectar) inyectar(mundo.pasos);
      if (rt.entregar()) break;
      if (rt.despertar()) break;
      sim.paso(mundo.DT || 0.05); n++;
    }
    return n;
  }

  const API = { fuente, crear, bombear, VIGIA_MS };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else raiz.LAB_RUNTIME = API;
})(typeof window !== "undefined" ? window : globalThis);
