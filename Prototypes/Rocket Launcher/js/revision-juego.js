/* Modo revisión dentro del juego (War, JavaScript).
 *
 * El botón de los binoculares repite el último intento con la misma semilla y los programas instrumentados
 * por el trazador (educational-animation/revision/motor/trazador.js). La traza no cambia la partida: es la
 * misma comprobación que hace grabar.mjs. Mientras se repite, juego.js guarda una foto del mundo por paso
 * (0,05 s); después se monta CMGRevision con esa grabación:
 *   - completo: tapa el juego. En PC, código a la izquierda y diagrama a la derecha; en el teléfono, apilados.
 *   - junto (solo PC): código y diagrama apilados en el panel del código y el mapa en su sitio. El mapa sigue
 *     al paso (cmg.revision.ver con la foto de ese instante): las tres cosas se reproducen a la vez.
 * El motor del modo revisión se carga la primera vez que se abre, no al arrancar el juego. */
(() => {
  "use strict";
  const BASE = "../../educational-animation/revision/";
  const MOTOR = ["motor/textos.js", "motor/trazador.js", "motor/catalogo.js", "motor/flujo.js", "motor/explicar.js", "motor/documentacion.js", "motor/revision.js"];
  // Lo que el programa «ve» en cada despertar (la instantánea del Worker), como en grabar.mjs.
  const ESTADO = 'Object.fromEntries(Object.entries(SNAP.maq).map(([k,v])=>[k,("jammed" in v)?{jammed:v.jammed,failureRate:v.failureRate,missiles:v.missiles,mode:v.mode}:{count:v.count}]))';
  const $ = (id) => document.getElementById(id);
  const app = $("app"), boton = $("b-revisar");
  const ti = (k, p) => window.CMGI18n ? window.CMGI18n.t(k, p) : k;
  const R = () => window.cmg && window.cmg.revision;
  const escritorio = () => app.dataset.forma !== "movil" && matchMedia("(min-width: 900px)").matches;
  let carga = null, caja = null, vista = null, sesion = null, aviso = null, preparando = null;

  function cargar() {
    if (carga) return carga;
    carga = (async () => {
      if (!document.querySelector("link[data-revision]")) {
        const l = document.createElement("link"); l.rel = "stylesheet"; l.href = BASE + "motor/revision.css"; l.dataset.revision = "";
        document.head.append(l);
      }
      for (const f of MOTOR) await new Promise((ok, mal) => {
        const s = document.createElement("script"); s.src = BASE + f; s.onload = ok; s.onerror = () => mal(new Error(f));
        document.head.append(s);
      });
    })();
    carga.catch(() => { carga = null; });
    return carga;
  }

  function avisar(texto) {
    if (!aviso) { aviso = document.createElement("div"); aviso.className = "rj-aviso"; aviso.setAttribute("role", "status"); document.body.append(aviso); }
    aviso.textContent = texto; aviso.hidden = false;
    clearTimeout(avisar.t); avisar.t = setTimeout(() => { aviso.hidden = true; }, 3200);
  }

  function ponerCaja(junto) {
    if (!caja) { caja = document.createElement("div"); caja.id = "revision-juego"; caja.className = "revision-juego"; }
    const dentro = junto ? $("zona-codigo") : document.body;
    if (caja.parentElement !== dentro) dentro.append(caja);
    caja.dataset.modo = junto ? "junto" : "completo";
    caja.hidden = false;
    app.dataset.revision = junto ? "junto" : "completo";
  }

  function mostrarPreparando(s) {
    if (!preparando) {
      preparando = document.createElement("div"); preparando.className = "rj-preparando"; preparando.setAttribute("role", "status");
      preparando.innerHTML = '<p></p><div class="rj-barra"><span></span></div><button type="button" class="mini"></button>';
      preparando.querySelector("button").addEventListener("click", () => { const r = R(); cerrar(); if (r) r.detener(); });
      document.body.append(preparando);
    }
    preparando.hidden = false;
    preparando.querySelector("button").textContent = ti("juego.accion.cerrar");
    const total = Math.max(0.1, s.u.t || 1);
    const pintar = () => {
      if (sesion !== s || s.listo) { preparando.hidden = true; return; }
      const t = R() && R().mundo ? R().mundo.t : 0;
      preparando.querySelector("p").textContent = ti("juego.revision.preparando", { t: t.toFixed(1) });
      preparando.querySelector(".rj-barra span").style.width = `${Math.min(100, t / total * 100).toFixed(1)}%`;
      requestAnimationFrame(pintar);
    };
    pintar();
  }

  async function abrir() {
    const r = R();
    if (!r) return;
    if (r.serie === "factory") return avisar(ti("juego.revision.factory"));
    const u = r.ultimo;
    if (!u || r.corriendo) return avisar(ti("juego.revision.sin_intento"));
    if (Object.values(u.lenguajes || {}).some(l => l !== "js")) return avisar(ti("juego.revision.python"));
    cerrar();
    const s = sesion = { u, junto: false, listo: false };
    try { await cargar(); }
    catch (e) { sesion = null; return avisar(ti("juego.revision.error", { m: e.message })); }
    if (sesion !== s) return;
    const T = window.CMGTrazador;
    s.instr = {};
    for (const [id, src] of Object.entries(u.codigos)) s.instr[id] = T.instrumentar(src, { reloj: "SNAP.t", estado: ESTADO });
    r.alCambiar = () => cerrar();
    mostrarPreparando(s);
    r.grabar({
      codigos: Object.fromEntries(Object.entries(s.instr).map(([id, x]) => [id, x.codigo])), fuentes: u.codigos, semilla: u.semilla,
      hasta: u.resultado === "detenido" ? u.t : null,
      alTerminar: (rev, m) => { if (sesion === s) montar(s, rev, m); },
    });
  }

  function grabacion(s, rev, m) {
    const programas = {};
    for (const [id, x] of Object.entries(s.instr)) programas[id] = { lenguaje: "js", fuente: x.fuente, nodos: x.nodos, comentarios: x.comentarios, eventos: rev.trazas[id] || [] };
    const reto = R().reto, r2 = (v) => Math.round(v * 100) / 100;
    return {
      formato: 2, serie: "war", semilla: s.u.semilla, reto: { numero: reto.numero, titulo: reto.titulo }, programas,
      partida: { resultado: m.fin, motivo: rev.motivo, mensaje: rev.mensaje, t: r2(m.t), brechas: m.brechas, derribos: m.derribos, enemigos: m.total,
        atascos: m.detalleAtascos, reparaciones: m.reparaciones, eventos: m.eventos },
      // La repetición tiene que dar la misma partida que el intento (misma semilla; la traza no la cambia).
      verificacion: { mismaPartida: m.fin === s.u.resultado && m.derribos === s.u.derribos && m.brechas === s.u.brechas && Math.abs(m.t - s.u.t) < 0.06 },
    };
  }

  function montar(s, rev, m) {
    s.listo = true; s.fotos = rev.fotos; s.pendientes = rev.pendientes; s.base = m;
    s.G = grabacion(s, rev, m);
    ponerCaja(false);
    vista = window.CMGRevision.montar(caja, s.G, {
      junto: false,
      alJuntar: escritorio() ? (on) => { s.junto = on; ponerCaja(on); } : null,
      alMapa: () => salir("mapa"), alCodigo: () => salir("codigo"),
      alInstante: (t) => verInstante(s, t),
    });
    window.__revisionJuego = { vista, get sesion() { return sesion; } };
  }

  // La foto más reciente que no pasa de t; el resto (< 0,05 s) lo interpola el dibujo del mapa.
  function verInstante(s, t) {
    const f = s.fotos;
    let lo = 0, hi = f.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (f[mid].t <= t + 1e-9) lo = mid; else hi = mid - 1; }
    R().ver(f[lo], Math.max(0, Math.min(0.05, t - f[lo].t)), s.base, s.pendientes);
  }

  function cerrar() {
    const s = sesion;
    sesion = null;
    if (vista) { vista.destruir(); vista = null; }
    if (caja) caja.hidden = true;
    delete app.dataset.revision;
    if (preparando) preparando.hidden = true;
    const r = R();
    if (r) { r.alCambiar = null; if (s && s.base) r.soltar(s.base); }
    window.__revisionJuego = null;
  }
  function salir(panel) {
    cerrar();
    app.dispatchEvent(new CustomEvent("cmg:pantalla", { detail: panel }));
  }

  if (boton) boton.addEventListener("click", abrir);
  window.CMGRevisionJuego = { abrir, cerrar, get abierta() { return !!vista; } };
})();
