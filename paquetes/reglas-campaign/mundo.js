/* Simulación continua: encargos, modos, paso fijo e hitos. */
import { anotarSuceso } from '../nucleo/index.js';
import { ROBOT, MAQUINAS, PIEZAS, RECETAS, TARIMA_CAP, BANDA, COSTE, PEDIDO, ARSENAL,
  TORRETA, r2, esMaquina, esRobot, tarimaDe, totalEntrada, capSalida, indexar,
  instantanea, metas, cuantos } from './estado.js';

// ---------- Simulación ----------
/** @param {import('./index.js').Mundo} m @param {import('./index.js').Ganchos} hooks */
export function conectar(m, hooks = {}) {
  const def = m.def;
  const registrar = hooks.registrar || (() => {}), terminarOriginal = hooks.terminarOrden || (() => {});
  function terminarOrden(unidad, encargo, resultado) {
    anotarSuceso(m, "encargo-terminado", unidad, { encargo, resultado });
    return terminarOriginal(unidad, encargo, resultado);
  }
  const puntoDe = l => {
    if (!l || !l.presente) return null;
    if (esMaquina(l)) { if (l.enVilo) return null; const p = l.pad ? m.porId[l.pad] : l; return { x: p.ax, y: p.ay }; }
    return l.ax == null ? null : { x: l.ax, y: l.ay };
  };

  // --- Encargos de los robots ---
  function iniciarOrden(id, encargo) {
    const r = m.porId[id], [lugarId, pieza] = encargo.args, l = m.porId[lugarId];
    const ya = res => { terminarOrden(id, encargo.id, res); return res; };
    if (!esRobot(r) || !r.presente) return ya("no_disponible");
    if (r.tarea) return ya("ocupado");
    r.st.encargos++;
    if (encargo.verbo === "pickUp" && r.carga) return ya("manos_llenas");
    if (encargo.verbo === "deliver" && !r.carga) return ya("manos_vacias");
    const p = puntoDe(l);
    if (!p) return ya(esMaquina(l) && l.enVilo ? "no_disponible" : "rechazado");
    const op = encargo.verbo === "goTo" ? 0 : ROBOT[r.clase].op;
    r.tarea = { id: encargo.id, verbo: encargo.verbo, lugar: lugarId, pieza: pieza ?? null, x: p.x, y: p.y, x0: r.cx, y0: r.cy, fase: "ir", op, op0: op };
    return null;
  }
  function cancelarTareas() { for (const r of m.robots) r.tarea = null; }

  function resolver(r, t) {
    const l = m.porId[t.lugar];
    if (t.verbo === "goTo") return "ok";
    if (!l || !l.presente || (esMaquina(l) && l.enVilo)) return "no_disponible";
    return r.clase === "obrero" ? (t.verbo === "pickUp" ? obreroRecoge(r, l, t.pieza) : obreroEntrega(r, l))
      : (t.verbo === "pickUp" ? montacargasRecoge(r, l) : montacargasEntrega(r, l));
  }
  function obreroRecoge(r, l, pieza) {
    if (l.clase === "lugar" || l.clase === "bahia") {
      const t = tarimaDe(m, l);
      if (!t) return "sin_tarima";
      const i = pieza ? t.piezas.lastIndexOf(pieza) : t.piezas.length - 1;
      if (i < 0) return "viaje_vacio";
      r.carga = t.piezas.splice(i, 1)[0]; return "ok";
    }
    if (esMaquina(l)) {
      const i = pieza ? l.salida.lastIndexOf(pieza) : l.salida.length - 1;
      if (i >= 0) { r.carga = l.salida.splice(i, 1)[0]; return "ok"; }
      // Una pieza que quedó en la entrada (por ejemplo, tras cambiar de receta) también se puede retirar.
      if (pieza && l.entrada[pieza] > 0 && !l.proceso) { l.entrada[pieza]--; r.carga = pieza; return "ok"; }
      return "viaje_vacio";
    }
    return "rechazado";
  }
  function cabeEnMaquina(q, pieza) {
    const c = MAQUINAS[q.clase], R = RECETAS[q.receta];
    if (!R.entra[pieza]) return "rechazado";
    if (c.ranuras) {
      const clase = PIEZAS[pieza].clase;
      let usadas = 0; for (const [p, n] of Object.entries(q.entrada)) if (PIEZAS[p].clase === clase) usadas += n;
      return usadas < c.ranuras[clase] ? "ok" : "lleno";
    }
    return totalEntrada(q) < c.entrada ? "ok" : "lleno";
  }
  function obreroEntrega(r, l) {
    const pieza = r.carga;
    if (l.clase === "lugar" || l.clase === "bahia") {
      const t = tarimaDe(m, l);
      if (!t) return "sin_tarima";
      if (t.piezas.length >= TARIMA_CAP) return "lleno";
      t.piezas.push(pieza); r.carga = null; return "ok";
    }
    if (esMaquina(l)) {
      if (!l.encendida) return "no_disponible";
      const res = cabeEnMaquina(l, pieza);
      if (res !== "ok") return res;
      l.entrada[pieza] = (l.entrada[pieza] || 0) + 1; r.carga = null; return "ok";
    }
    if (l.clase === "banda") {
      if (pieza !== "missile" || !l.encendida) return "rechazado";
      const ultimo = l.piezas[l.piezas.length - 1];
      if (ultimo && ultimo.s < BANDA.paso) return "lleno";
      l.piezas.push({ pieza, s: 0 }); r.carga = null; anotarSuceso(m, "misil-banda", l.id, { desde: r.id }); return "ok";
    }
    if (l.clase === "arsenal") {
      if (pieza !== "missile") return "rechazado";
      if (l.misiles >= ARSENAL.cap) return "lleno";
      l.misiles++; l.aMano++; cobrar(); anotarSuceso(m, "misil-arsenal", l.id, { desde: r.id, misiles: l.misiles }); r.carga = null; return "ok";
    }
    return "rechazado";
  }
  function montacargasRecoge(r, l) {
    if (l.clase === "lugar" || l.clase === "bahia") {
      const t = tarimaDe(m, l);
      if (!t) return "viaje_vacio";
      l.tarima = null; t.en = r.id; r.carga = { tipo: "tarima", id: t.id }; return "ok";
    }
    if (l.clase === "pila") {
      const t = { id: `T${m.sigTarima++}`, piezas: [], en: r.id };
      m.tarimas.push(t); m.tarimaPorId[t.id] = t; r.carga = { tipo: "tarima", id: t.id }; return "ok";
    }
    if (esMaquina(l)) {
      if (MAQUINAS[l.clase].peso > ROBOT.montacargas.cargaMax) return "muy_pesado";
      if (l.proceso || l.cambio) return "ocupado";
      if (l.pad) m.porId[l.pad].maquina = null;
      l.pad = null; l.enVilo = true; r.carga = { tipo: "maquina", id: l.id }; return "ok";
    }
    return "rechazado";
  }
  function montacargasEntrega(r, l) {
    const c = r.carga;
    if (c.tipo === "tarima") {
      const t = m.tarimaPorId[c.id];
      if (l.clase === "lugar" || l.clase === "bahia") {
        if (l.tarima) return "ocupado";
        l.tarima = t.id; t.en = l.id; r.carga = null; return "ok";
      }
      if (l.clase === "pila") {
        if (t.piezas.length) return "rechazado";
        m.tarimas.splice(m.tarimas.indexOf(t), 1); delete m.tarimaPorId[t.id]; r.carga = null; return "ok";
      }
      return "rechazado";
    }
    if (l.clase !== "pad") return "rechazado";
    if (l.maquina) return "ocupado";
    const q = m.porId[c.id];
    l.maquina = q.id; q.pad = l.id; q.cx = l.cx; q.cy = l.cy; q.enVilo = false; r.carga = null; return "ok";
  }

  // --- Modos: se aplican al instante ---
  function aplicarModo(id, verbo, args) {
    const e = m.porId[id];
    if (!e || !e.presente) return "no_disponible";
    if ((esMaquina(e) || e.clase === "banda") && !e.encendida) return "apagada";
    if (verbo === "start" || verbo === "stop") { e.marcha = verbo === "start"; return "ok"; }
    if (verbo === "light") { e.luz = args[0] === "off" ? "off" : args[0]; return "ok"; }
    if (verbo === "setRecipe") {
      const destino = e.cambio ? e.cambio.a : e.receta;
      if (destino === args[0]) return "ok";
      if (e.proceso || e.cambio) return "ocupado";
      e.cambio = { a: args[0], falta: MAQUINAS[e.clase].cambio, total: MAQUINAS[e.clase].cambio };
      return "ok";
    }
    if (verbo === "request") {
      const pieza = args[0], coste = COSTE[pieza];
      if (e.pedidos.length >= PEDIDO.cola) return "ocupado";
      if (m.presupuesto < coste) return "sin_fondos";
      m.presupuesto -= coste; m.gastado += coste; m.pedidos++;
      const antes = e.pedidos[e.pedidos.length - 1];
      e.pedidos.push({ pieza, n: PEDIDO.n, pide: m.t, llega: r2(Math.max(m.t, antes ? antes.llega : 0) + PEDIDO.espera) });
      return "ok";
    }
    return "rechazado";
  }
  // Los programas dejaron de correr: las luces vuelven a su cableado (el sensor de salida).
  function soltarLuces() { for (const q of m.estaciones) q.luz = null; }

  // --- Paso fijo ---
  function cobrar() { m.presupuesto += ARSENAL.pago; m.ingresado += ARSENAL.pago; }
  function pasoRobot(r, dt) {
    const t = r.tarea;
    if (!t) return;
    if (t.fase === "ir") {
      const dx = t.x - r.cx, dy = t.y - r.cy, d = Math.hypot(dx, dy), mov = ROBOT[r.clase].vel * dt;
      if (d > mov + 1e-9) { r.cx += dx / d * mov; r.cy += dy / d * mov; r.rumbo = Math.atan2(dy, dx); r.st.metros += mov; return; }
      r.cx = t.x; r.cy = t.y; r.st.metros += d; t.fase = "op";
      if (t.op > 1e-9) return;  // la operación empieza en el paso siguiente
    } else t.op -= dt;
    if (t.op <= 1e-9) { r.tarea = null;
      const carga = r.carga, resultado = resolver(r, t);
      if (resultado === "ok" && (t.verbo === "pickUp" || t.verbo === "deliver"))
        anotarSuceso(m, t.verbo === "pickUp" ? "recogida" : "entrega", r.id,
          { lugar: t.lugar, carga: t.verbo === "pickUp" ? r.carga : carga });
      terminarOrden(r.id, t.id, resultado); }
  }
  function tiene(q, R) { for (const [p, n] of Object.entries(R.entra)) if ((q.entrada[p] || 0) < n) return false; return true; }
  function pasoMaquina(q, dt, factor) {
    if (!q.encendida || q.enVilo) return;
    if (q.cambio) {
      q.cambio.falta -= dt;
      if (q.cambio.falta <= 1e-9) { q.receta = q.cambio.a; q.cambio = null; }
      return;
    }
    if (q.proceso) {
      q.proceso.prog += dt * factor; q.st.tTrabajo += dt;
      const R = RECETAS[q.proceso.receta];
      if (q.proceso.prog >= R.t - 1e-9) {
        q.salida.push(R.sale); q.hechos++; q.st.ciclos++; q.proceso = null;
        m.producidos[R.sale] = (m.producidos[R.sale] || 0) + 1;
        anotarSuceso(m, "produccion", q.id, { pieza: R.sale, hechos: q.hechos });
      }
    }
    if (!q.proceso && q.marcha) {
      const R = RECETAS[q.receta];
      if (q.salida.length >= capSalida(q)) q.st.tBloqueo += dt;
      else if (!tiene(q, R)) q.st.tSinMaterial += dt;
      else {
        for (const [p, n] of Object.entries(R.entra)) q.entrada[p] -= n;
        q.proceso = { receta: q.receta, prog: 0 };
      }
    }
  }
  function pasoBanda(b, dt, factor) {
    if (!b || !b.presente || !b.marcha) return;
    const avance = BANDA.vel * dt * factor, ars = m.arsenal;
    for (let i = 0; i < b.piezas.length; i++) {
      const lim = i === 0 ? b.largo : b.piezas[i - 1].s - BANDA.paso;
      b.piezas[i].s = Math.max(b.piezas[i].s, Math.min(lim, b.piezas[i].s + avance));
    }
    if (b.piezas.length && b.piezas[0].s >= b.largo - 1e-9 && ars.misiles < ARSENAL.cap) {
      b.piezas.shift(); ars.misiles++; ars.porBanda++; b.st.movidos++; cobrar();
      anotarSuceso(m, "misil-arsenal", ars.id, { desde: b.id, misiles: ars.misiles });
    }
    // La banda toma sola los misiles terminados de la ensambladora.
    const asm = m.porId["ASM-01"], ultimo = b.piezas[b.piezas.length - 1];
    if (asm && asm.encendida && (!ultimo || ultimo.s >= BANDA.paso)) {
      const k = asm.salida.indexOf("missile");
      if (k >= 0) { asm.salida.splice(k, 1); b.piezas.push({ pieza: "missile", s: 0 }); anotarSuceso(m, "misil-banda", b.id, { desde: asm.id }); }
    }
  }
  function pasoBahia(b) {
    const p = b.pedidos[0];
    if (!p || m.t < p.llega - 1e-9 || b.tarima) return;
    b.pedidos.shift();
    const t = { id: `T${m.sigTarima++}`, piezas: Array(p.n).fill(p.pieza), en: b.id };
    m.tarimas.push(t); m.tarimaPorId[t.id] = t; b.tarima = t.id;
    anotarSuceso(m, "entrega-pedido", b.id, { pieza: p.pieza, n: p.n, tarima: t.id });
    registrar(b.id, null, `entrega: ${p.n} × ${p.pieza}`, "ok", "sensor");
    if (hooks.entrega) hooks.entrega(b, p);
  }
  // La bodega abastece a las torretas de la muralla: el consumidor militar de la fábrica.
  function pasoArsenal(dt) {
    const ars = m.arsenal;
    if (m.hito < 5 || !ars.misiles || (m.salva && !m.salva.hecha)) return;
    m.tSuministro += dt;
    if (m.tSuministro < ARSENAL.suministro) return;
    const t = [...m.torretas].sort((a, b) => a.misiles - b.misiles)[0];
    if (t && t.misiles < TORRETA.cap) { t.misiles++; ars.misiles--; m.tSuministro = 0; anotarSuceso(m, "suministro", t.id, { desde: ars.id, misiles: t.misiles }); }
  }
  function pasoSalva() {
    const s = m.salva;
    for (const mi of m.misiles) if (!mi.hecho && m.t >= mi.t0 + mi.dur - 1e-9) { mi.hecho = true; m.explosiones.push({ t0: m.t, x: mi.x1, y: mi.y1, z: mi.z1 }); anotarSuceso(m, "explosion", null, { misil: mi.id, x: mi.x1, y: mi.y1, z: mi.z1 }); }
    if (m.misiles.some(mi => mi.hecho)) m.misiles = m.misiles.filter(mi => !mi.hecho);
    if (m.explosiones.length) m.explosiones = m.explosiones.filter(x => m.t - x.t0 < 0.8);
    if (!s || s.hecha || m.t < s.sig - 1e-9) return;
    const con = m.torretas.filter(t => t.misiles > 0);
    if (!con.length) { s.hecha = true; if (hooks.salva) hooks.salva(s); return; }
    const t = con[s.n % con.length], d = def.mapa.dianas[s.n % def.mapa.dianas.length];
    t.misiles--; t.lanzados++; t.yaw = Math.atan2(d.y - t.cy, d.x - t.cx);
    const dist = Math.hypot(d.x - t.cx, d.y - t.cy);
    m.misiles.push({ id: m.sigMisil++, x0: t.cx, y0: t.cy, z0: TORRETA.alto, x1: d.x, y1: d.y, z1: 0, t0: m.t, dur: dist / TORRETA.vel, arco: 2.5 });
    anotarSuceso(m, "disparo", t.id, { misil: m.sigMisil - 1, x: d.x, y: d.y });
    s.n++; s.sig = m.t + TORRETA.cadencia;
  }
  // Salva de prueba: las torretas disparan a las dianas lo que les dio la bodega.
  function salva() {
    if (m.salva && !m.salva.hecha) return false;
    if (!m.torretas.some(t => t.misiles > 0)) return false;
    m.salva = { sig: m.t + 1, n: 0, hecha: false };
    return true;
  }

  function paso(dt) {
    m.t += dt;
    for (const r of m.robots) pasoRobot(r, dt);
    for (const r of m.robots) if (r.carga && r.carga.tipo === "maquina") { const q = m.porId[r.carga.id]; q.cx = r.cx; q.cy = r.cy; }
    let uso = 0;
    for (const q of m.estaciones) if (q.proceso) uso += MAQUINAS[q.clase].kw;
    const b = m.banda;
    if (b && b.presente && b.marcha && b.piezas.length) uso += BANDA.kw;
    const factor = uso > m.energia.max ? m.energia.max / uso : 1;
    m.energia.uso = uso; m.energia.factor = factor;
    for (const q of m.estaciones) pasoMaquina(q, dt, factor);
    pasoBanda(b, dt, factor);
    pasoBahia(m.bahia);
    pasoArsenal(dt);
    pasoSalva();
    evaluar();
  }

  // --- Hitos ---
  function empezarHito(n) {
    indexar(m);
    /** @type {import('./index.js').Hito['alEmpezar']} */
    const al = def.hitos[n].alEmpezar || {};
    for (const g of al.entregas || []) {
      const b = m.porId[g.lugar], antes = b.pedidos[b.pedidos.length - 1];
      b.pedidos.push({ pieza: g.pieza, n: g.n, pide: m.t, llega: r2(Math.max(m.t, antes ? antes.llega : 0) + PEDIDO.programada), programada: true });
    }
  }
  function evaluar() {
    if (m.completado || !metas(m).every(x => x.cumplida)) return;
    const hecho = m.hito;
    m.hitosT[hecho] = r2(m.t);
    m.presupuesto += def.premioHito; m.ingresado += def.premioHito;
    if (hecho + 1 < def.hitos.length) { m.hito = hecho + 1; empezarHito(m.hito); }
    else { m.completado = true; salva(); }
    anotarSuceso(m, "hito", null, { hecho, siguiente: m.completado ? null : m.hito, completado: m.completado });
    if (hooks.hito) hooks.hito({ hecho, siguiente: m.completado ? null : m.hito, completado: m.completado });
  }
  // Nada puede cambiar ya: sin tareas, procesos, cambios, pedidos, banda en marcha ni salva.
  function quieto() {
    if (m.robots.some(r => r.tarea) || m.misiles.length || (m.salva && !m.salva.hecha) || m.bahia.pedidos.length) return false;
    for (const q of m.estaciones) {
      if (q.proceso || q.cambio) return false;
      if (q.encendida && !q.enVilo && q.marcha && q.salida.length < capSalida(q) && tiene(q, RECETAS[q.receta])) return false;
    }
    const b = m.banda;
    if (b && b.presente && b.marcha) {
      if (b.piezas.some((x, i) => x.s < (i === 0 ? b.largo : b.piezas[i - 1].s - BANDA.paso) - 1e-6)) return false;
      if (b.piezas.length && m.arsenal.misiles < ARSENAL.cap) return false;
      const asm = m.porId["ASM-01"]; if (asm && asm.salida.includes("missile")) return false;
    }
    if (m.hito >= 5 && m.arsenal.misiles && m.torretas.some(t => t.misiles < TORRETA.cap)) return false;
    return true;
  }
  return { paso, iniciarOrden, cancelarTareas, aplicarModo, soltarLuces, evaluar, salva, quieto,
    instantanea: () => instantanea(m), metas: () => metas(m), cuantos: (id, pieza) => cuantos(m, id, pieza) };
}

