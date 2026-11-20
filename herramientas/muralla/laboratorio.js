/* Laboratorio de la muralla de vóxeles. Fuera del juego: no toca War, Factory ni Campaign.
 * El ritmo de obra usa el reloj de la página solo aquí; en el juego lo decidirá el paso fijo de la simulación. */
(() => {
  "use strict";
  const V = window.CMGMuralla, VV = window.CMGMurallaVista, $ = (s) => document.querySelector(s);
  // Trazado de la muralla del nivel 1 (campaign-nivel.js, rama campaign-nivel-1) y la torreta LAU-01 que va encima.
  const BOCETO = [[104.5, 26.5], [104.5, 62], [104, 68], [102.5, 74], [99.5, 80], [94.5, 85], [87, 88.6], [78, 90.6], [66, 91.8], [51, 92.8]];
  const MAPA = { cols: 200, rows: 104 }, TORRETA = { x: 104.5, y: 47 };
  const ALMENAS = { alto: .5, paso: 1 };
  const parametros = new URLSearchParams(location.search);

  // ---------- Escena ----------
  const cont = $("#escena");
  const render = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: parametros.has("captura") });
  render.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  cont.appendChild(render.domElement);
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x141b21);
  escena.fog = new THREE.Fog(0x141b21, 140, 260);
  const camara = new THREE.PerspectiveCamera(45, 1, .3, 600);
  escena.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3328, .75));
  const sol = new THREE.DirectionalLight(0xfff2dc, .75); sol.position.set(60, 90, 30); escena.add(sol);

  // Suelo: lado de la fábrica (pasto) y campo de batalla (seco), con cuadrícula de 1 m.
  function texturaSuelo() {
    const px = 4, cv = document.createElement("canvas"); cv.width = MAPA.cols * px; cv.height = MAPA.rows * px;
    const g = cv.getContext("2d");
    for (let x = 0; x < MAPA.cols; x += .5) for (let y = 0; y < MAPA.rows; y += .5) {
      const pr = V.proyectar(BOCETO, x + .25, y + .25), fuera = pr.s > 0 && !(pr.extremo && pr.d > 3);
      g.fillStyle = fuera ? "#8a7a49" : "#4f7a3a"; g.fillRect(x * px, y * px, px / 2 + .5, px / 2 + .5);
    }
    g.strokeStyle = "rgba(0,0,0,.13)"; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x <= MAPA.cols; x++) { g.moveTo(x * px + .5, 0); g.lineTo(x * px + .5, cv.height); }
    for (let y = 0; y <= MAPA.rows; y++) { g.moveTo(0, y * px + .5); g.lineTo(cv.width, y * px + .5); }
    g.stroke();
    g.strokeStyle = "rgba(0,0,0,.28)"; g.beginPath();
    for (let x = 0; x <= MAPA.cols; x += 10) { g.moveTo(x * px + .5, 0); g.lineTo(x * px + .5, cv.height); }
    for (let y = 0; y <= MAPA.rows; y += 10) { g.moveTo(0, y * px + .5); g.lineTo(cv.width, y * px + .5); }
    g.stroke();
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
    return t;
  }
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(MAPA.cols, MAPA.rows), new THREE.MeshLambertMaterial({ map: texturaSuelo() }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.set(MAPA.cols / 2, -.002, MAPA.rows / 2);
  escena.add(suelo);

  // Torreta sobre la muralla: su base sigue la cima (altoEn) cuando la muralla sube o pierde vóxeles.
  const torreta = new THREE.Group();
  {
    const metal = new THREE.MeshLambertMaterial({ color: 0x3d4a55 }), acento = new THREE.MeshLambertMaterial({ color: 0xe0634f });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.55, .65, .5, 10), metal); base.position.y = .25;
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(.8, .45, .7), acento); cuerpo.position.y = .72;
    const tubo = new THREE.Mesh(new THREE.BoxGeometry(1.1, .16, .16), metal); tubo.position.set(.6, .8, 0);
    torreta.add(base, cuerpo, tubo);
  }
  escena.add(torreta);
  const marca = new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 8), new THREE.MeshBasicMaterial({ color: 0x7fa8ff }));
  marca.visible = false; escena.add(marca);
  const fogonazo = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, depthWrite: false }));
  fogonazo.visible = false; escena.add(fogonazo);
  let fogonazoT = 0;

  // ---------- Muralla ----------
  const rotura = $("#rotura");
  rotura.checked = parametros.get("rotura") !== "0";
  rotura.onchange = () => vista.verRotura(rotura.checked);
  const textura = $("#textura");
  textura.checked = parametros.get("textura") !== "0";
  const crearAcabado = () => window.CMGMurallaMaterial.crear(THREE, { textura: textura.checked });
  let acabado = crearAcabado();
  // Con textura, el tono lo pone cada sillar: la variación por vóxel baja para que no asome la rejilla de 0,5 m.
  const paletaPara = (conTextura) => V.paletaBase().map(p => p && { ...p, variacion: p.variacion * (conTextura ? .2 : 1) });
  let m, vista, ejeActivo = "principal", numPared = 0, ultimaMalla = { ms: 0, trozos: 0 };
  let versionMedida = -1, escenaMedida, tiemposMalla;
  function nueva(tam) {
    if (vista) { escena.remove(vista.grupo); vista.liberar(); }
    m = V.crear({ tam });
    m.eje("principal", BOCETO);
    m.construir({ eje: "principal", s0: -.75, s1: .75, z0: 0, z1: 3.5, material: "piedra", almenas: ALMENAS });
    ejeActivo = "principal"; numPared = 0;
    montar();
  }
  function montar() {
    versionMedida = -1; escenaMedida = null;
    vista = VV.crear(THREE, m, { material: acabado, rotura: rotura.checked, paleta: paletaPara(textura.checked), tension: $("#verTension").checked });
    vista.verPlano($("#verPlano").checked);
    escena.add(vista.grupo);
  }

  // ---------- Interfaz ----------
  let material = "piedra", modo = null, puntoA = null, pausa = false, nota = "", tSim = 0;
  const cola = [];   // golpes programados de las demostraciones: { t, x, y, z, radio, poder }
  const mats = $("#materiales");
  for (const mt of V.MATERIALES) {
    if (!mt || mt.escombro) continue;
    const b = document.createElement("button");
    const blindaje = mt.id === "acero";
    b.innerHTML = `<span class="muestra" style="background:#${mt.color.toString(16).padStart(6, "0")}"></span>${blindaje ? "Blindaje" : mt.nombre}`;
    b.dataset.material = blindaje ? "blindaje" : mt.id;
    b.onclick = () => { material = b.dataset.material; pintar(); };
    mats.appendChild(b);
  }
  const grosor = () => +$("#grosor").value, ritmo = () => Math.round(10 ** +$("#ritmo").value);
  function pintar() {
    mats.querySelectorAll("button").forEach(b => b.classList.toggle("activo", b.dataset.material === material));
    document.querySelectorAll("[data-modo]").forEach(b => b.classList.toggle("activo", b.dataset.modo === modo));
    $("#grosor").disabled = material === "blindaje";
    $("#vGrosor").textContent = material === "blindaje" ? `${V.BLINDAJE.grosor * 100} cm` : `${grosor().toLocaleString("es")} m`;
    $("#vRitmo").textContent = `${ritmo()} unidades/s`;
    $("#vRadio").textContent = `${(+$("#radio").value).toLocaleString("es")} m`;
    $("#vPoder").textContent = (+$("#poder").value).toLocaleString("es");
    $("#vEscombro").textContent = `${Math.round(100 * +$("#escombro").value)} %`;
    $("#pausa").textContent = pausa ? "Seguir" : "Pausar";
    $("#pausa").setAttribute("aria-pressed", pausa);
    const textos = {
      null: `Eje activo: <b>${ejeActivo}</b>. Elige una obra; las capas y la subida van sobre el eje activo.`,
      ampliar: `<b>Ampliar</b>: toca el suelo para alargar <b>${ejeActivo}</b> desde su extremo. Cada capa sigue al tramo nuevo.`,
      pared: puntoA ? "<b>Pared nueva</b>: toca el punto final." : "<b>Pared nueva</b>: toca el punto de inicio en el suelo.",
      disparar: "<b>Disparar</b>: toca la muralla. Toca una chapa para abollarla o soltarla de sus anclajes.",
    };
    $("#modo").innerHTML = textos[modo] + (nota ? `<br>${nota}` : "");
  }
  function avisar(t) { nota = t; pintar(); }
  function obra(def) {
    const o = m.planear({ ...def, material });
    avisar(o.total ? `Obra ${o.id}: ${o.total} vóxeles de ${V.MATERIALES[V.MAT[material]].nombre.toLowerCase()}.` : "No falta nada: esa obra ya está hecha.");
  }
  function capa(lado) {
    if (material === "blindaje") {
      const o = m.blindar({ eje: ejeActivo, lado });
      return avisar(o.total ? `Obra ${o.id} · ${o.total} paneles de blindaje.` : "No caben más paneles en esa cara.");
    }
    const banda = m.capa(ejeActivo, lado, grosor());
    obra(lado === "fuera" ? { ...banda, almenas: ALMENAS } : banda);
  }
  function avance(n) {
    const r = m.avanzar(n);
    if (r.omitidos) avisar(`Se omitieron ${r.omitidos} paneles sin anclajes.`);
    return r;
  }
  const acciones = {
    fuera: () => capa("fuera"),
    dentro: () => capa("dentro"),
    subir: () => material === "blindaje" ? avisar("El blindaje necesita una cara de pared. Usa Capa por fuera o por dentro.") : obra({ ...m.hilada(ejeActivo, 1), almenas: ALMENAS }),
    reparar: () => { const os = m.reparar(); avisar(os.length ? `Reparación: ${os.reduce((s, o) => s + o.total, 0)} vóxeles en ${os.length} obras.` : "No hay nada que reparar."); },
    terminar: () => { if (!avance(Infinity).omitidos) avisar("Obras terminadas."); },
    cancelar: () => { while (m.obras.length) m.cancelar(m.obras[0].id); avisar("Obras canceladas."); },
    reiniciar: () => { nueva(+$("#tam").value); avisar(""); },
    socavar: () => {
      [27, 28, 29.2, 30.2].forEach((y, n) => cola.push({ t: tSim + .2 + n * .9, x: 104.5, y, z: .3, radio: 1.4, poder: 1.3 }));
      orb.objetivo.set(104.5, 1.5, 31); orb.r = 24; orb.theta = .35; orb.phi = 1.05; colocarCamara();
      avisar("Socavando la base del extremo norte: el voladizo cuelga y el siguiente golpe lo suelta.");
    },
    tunel: () => {
      [45, 47.2].forEach((y, n) => cola.push({ t: tSim + .2 + n * .6, x: 104.5, y, z: .3, radio: 1.6, poder: 1.4 }));
      orb.objetivo.set(104.5, 1.5, 46); orb.r = 22; orb.theta = .2; orb.phi = 1.1; colocarCamara();
      avisar("Túnel en la base: el dintel, sujeto por los dos lados, se hunde.");
    },
    guardado: () => {
      const json = JSON.stringify(m.serializar());
      escena.remove(vista.grupo); vista.liberar();
      m = V.cargar(JSON.parse(json)); montar();
      avisar(`Guardado de ${(json.length / 1024).toFixed(1)} KB; sigue la copia cargada.`);
    },
  };
  document.querySelectorAll("[data-accion]").forEach(b => b.onclick = () => acciones[b.dataset.accion]());
  document.querySelectorAll("[data-modo]").forEach(b => b.onclick = () => { modo = modo === b.dataset.modo ? null : b.dataset.modo; puntoA = null; marca.visible = false; nota = ""; pintar(); });
  $("#pausa").onclick = () => { pausa = !pausa; pintar(); };
  ["grosor", "ritmo", "radio", "poder", "escombro"].forEach(id => $("#" + id).oninput = pintar);
  $("#verPlano").onchange = (e) => vista.verPlano(e.target.checked);
  textura.onchange = () => {
    const anterior = acabado;
    acabado = crearAcabado();
    vista.ponerMaterial(acabado);
    vista.ponerPaleta(paletaPara(textura.checked));
    anterior.dispose();
  };
  $("#verTension").checked = parametros.get("tension") !== "0";
  $("#verTension").onchange = (e) => vista.verTension(e.target.checked);
  $("#tam").onchange = () => acciones.reiniciar();
  if (parametros.get("tam")) $("#tam").value = parametros.get("tam");

  function listarObras() {
    const os = m.obrasResumen();
    $("#obras").innerHTML = os.length ? os.slice(0, 5).map(o => {
      const p = m.pared(o.pared), pct = Math.round(100 * (o.total - o.pendientes) / o.total);
      const nombre = o.tipo === "blindaje" ? `${o.eje} · Blindaje` : `${p.eje} · ${V.MATERIALES[p.material].nombre}`;
      return `<div>Obra ${o.id} · ${nombre} · ${pct} %</div><div class="barra"><i style="width:${pct}%"></i></div>`;
    }).join("") + (os.length > 5 ? `<div>y ${os.length - 5} más</div>` : "") : "Sin obras en curso.";
  }

  function medirTension() {
    if (versionMedida === m.versionTension) return;
    const inicio = performance.now(), mapa = m.tension(), ms = performance.now() - inicio;
    versionMedida = m.versionTension;
    const cuentas = [0, 0, 0, 0, 0];
    m.rejilla.recorrer((i, j, k, material) => {
      if (!V.esEscombro(material)) cuentas[mapa.get(V.K(i, j, k)) || 0]++;
    });
    for (const p of m.piezas) if (p.estado === "cuelga") cuentas[4] += p.vox.length / 4;
    $("#statsTension").textContent = `Vóxeles por nivel · ${cuentas.map((n, nivel) => `N${nivel} ${n}`).join(" · ")} · Cálculo ${ms.toFixed(2)} ms`;
  }

  // ---------- Cámara orbital (ratón y tacto) ----------
  const orb = { objetivo: new THREE.Vector3(97, 0, 62), r: 58, phi: .95, theta: .62 };
  function colocarCamara() {
    orb.phi = Math.min(1.45, Math.max(.12, orb.phi)); orb.r = Math.min(260, Math.max(6, orb.r));
    const s = Math.sin(orb.phi);
    camara.position.set(orb.objetivo.x + orb.r * s * Math.cos(orb.theta), orb.objetivo.y + orb.r * Math.cos(orb.phi), orb.objetivo.z + orb.r * s * Math.sin(orb.theta));
    camara.lookAt(orb.objetivo);
  }
  function desplazar(dx, dy) {
    const f = orb.r / cont.clientHeight * 1.1, a = orb.theta;
    // Se arrastra el suelo: derecha de la cámara (sen θ, −cos θ) y su «adelante» sobre el suelo (−cos θ, −sen θ).
    orb.objetivo.x += (-Math.sin(a) * dx - Math.cos(a) * dy) * f;
    orb.objetivo.z += (Math.cos(a) * dx - Math.sin(a) * dy) * f;
  }
  const punteros = new Map();
  let gesto = null;
  cont.addEventListener("contextmenu", e => e.preventDefault());
  cont.addEventListener("pointerdown", (e) => {
    cont.setPointerCapture(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 1) gesto = { x0: e.clientX, y0: e.clientY, mov: 0, boton: e.button, t: performance.now() };
    else if (gesto) gesto.mov = 99;
  });
  cont.addEventListener("pointermove", (e) => {
    const p = punteros.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (d0 && d1) orb.r *= d0 / d1;
      desplazar(dx / 2, dy / 2);
    } else if (gesto) {
      p.x = e.clientX; p.y = e.clientY;
      gesto.mov += Math.abs(dx) + Math.abs(dy);
      if (gesto.mov > 6) {
        if (gesto.boton === 2 || e.shiftKey) desplazar(dx, dy);
        else { orb.theta += dx * .008; orb.phi -= dy * .006; }
      }
    }
    colocarCamara();
  });
  const soltar = (e) => {
    const era = punteros.size;
    punteros.delete(e.pointerId);
    if (era === 1 && gesto && gesto.mov <= 6 && gesto.boton === 0) tocar(e.clientX, e.clientY);
    if (!punteros.size) gesto = null;
  };
  cont.addEventListener("pointerup", soltar);
  cont.addEventListener("pointercancel", (e) => { punteros.delete(e.pointerId); gesto = null; });
  cont.addEventListener("wheel", (e) => { e.preventDefault(); orb.r *= Math.exp(e.deltaY * .0012); colocarCamara(); }, { passive: false });

  // ---------- Toques en la escena ----------
  const rayo = new THREE.Raycaster(), ndc = new THREE.Vector2(), plano0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmp = new THREE.Vector3();
  function lanzar(cx, cy) {
    const r = render.domElement.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
  }
  function enSuelo(cx, cy) { lanzar(cx, cy); return rayo.ray.intersectPlane(plano0, tmp) ? [tmp.x, tmp.z] : null; }
  function tocar(cx, cy) {
    if (modo === "disparar") {
      lanzar(cx, cy);
      const hit = rayo.intersectObjects(vista.mallas(), false)[0];
      if (!hit) return avisar("Ese toque no dio en la muralla.");
      const v = vista.voxelDe(hit);
      return golpear(v.x, v.y, v.z, +$("#radio").value, +$("#poder").value);
    }
    const p = enSuelo(cx, cy);
    if (!p) return;
    if (modo === "ampliar") {
      const os = m.ampliar(ejeActivo, p);
      return avisar(`Tramo nuevo de ${ejeActivo}: ${os.reduce((s, o) => s + o.total, 0)} vóxeles en ${os.length} obras.`);
    }
    if (modo === "pared") {
      if (material === "blindaje") return avisar("Elige piedra u hormigón para levantar la pared que sostendrá el blindaje.");
      if (!puntoA) { puntoA = p; marca.position.set(p[0], .2, p[1]); marca.visible = true; return pintar(); }
      if (Math.hypot(p[0] - puntoA[0], p[1] - puntoA[1]) < 1) return avisar("Elige un punto final más lejos.");
      const nombre = `pared-${++numPared}`;
      m.eje(nombre, [puntoA, p]); ejeActivo = nombre; puntoA = null; marca.visible = false;
      return obra({ eje: nombre, s0: -.75, s1: .75, z0: 0, z1: 3.5, almenas: ALMENAS });
    }
  }

  function golpear(x, y, z, radio, poder) {
    const g = m.romper(x, y, z, radio, poder, { t: tSim, escombros: +$("#escombro").value, derrumbe: $("#derrumbe").checked });
    fogonazo.position.set(x, z, y); fogonazo.scale.setScalar(radio); fogonazo.visible = true; fogonazoT = performance.now();
    const partes = [];
    if (g.quitados) partes.push(`cayeron ${g.quitados} vóxeles`);
    if (g.paneles.length) partes.push(`${g.paneles.length} paneles alcanzados`);
    if (!partes.length) partes.push("el material aguantó");
    if (g.escombros) partes.push(`${g.escombros} salen despedidos`);
    const cuelgan = g.piezas.filter(id => (m.piezas.find(p => p.id === id) || {}).estado === "cuelga").length;
    if (g.piezas.length) partes.push(`${g.piezas.length} piezas sin apoyo${cuelgan ? ` (${cuelgan} cuelgan)` : ""}`);
    if (g.sueltas.length) partes.push(`${g.sueltas.length} piezas colgadas se sueltan`);
    avisar(`Impacto: ${partes.join(", ")}.`);
  }

  function demoTension() {
    // Las medidas de la máquina quedan en el panel para que la captura de la escena sea reproducible.
    $("#statsTension").after($("#stats"));
    m.construir({ ...m.capa("principal", "fuera", 1), u0: 11, u1: 18, material: "hormigon" });
    // Dos túneles y un mordisco en el extremo libre. Un segundo simulado entre golpes.
    const golpes = [[104.5, 34, 1.7, 1.8], [104.5, 41, 1.7, 1.8], [105.75, 41, 2.1, 2],
      [104.5, 27, 1.4, 1.3], [104.5, 28, 1.4, 1.3]];
    for (const [x, y, radio, poder] of golpes) {
      m.romper(x, y, .45, radio, poder, { t: tSim, escombros: 0 });
      m.paso(++tSim);
    }
    pausa = true;
    orb.objetivo.set(104.5, 1.5, 35);
    orb.theta = -.18; orb.phi = 1.32;
    orb.r = Math.max(15, 25 / camara.aspect);
  }

  function demoRotura() {
    const y = 40;
    // El túnel queda abierto para la captura. La chapa recibe un golpe real, justo bajo su umbral de caída.
    m.romper(104.5, y, .9, 1.65, 1.5, { t: 0, derrumbe: false, escombros: 0 });
    const o = m.blindar({ eje: "principal", u0: 15, u1: 17, z0: 1, z1: 2 });
    m.completar(o.id);
    const p = m.paneles[0];
    m.romper(...V.puntoPanel(p, .5, .5, p.grosor), .25, 1.55, { t: 0, derrumbe: false, escombros: 0 });
    // Montón compacto a un lado de la boca. Las columnas se apoyan desde el suelo.
    const [i, j, k] = m.indice(106, y - 2, 0);
    const radio = Math.max(1, Math.round(.8 / m.tam));
    for (let dx = -radio; dx <= radio; dx++) for (let dy = -radio; dy <= radio; dy++) {
      const alto = radio + 1 - Math.ceil(Math.hypot(dx, dy));
      for (let dz = 0; dz < alto; dz++)
        if (!m.rejilla.get(i + dx, j + dy, k + dz)) m.rejilla.set(i + dx, j + dy, k + dz, V.aEscombro(V.MAT.piedra));
    }
    pausa = true;
    $("#statsTension").after($("#stats"));
    orb.objetivo.set(105.45, 1.2, y + .35);
    orb.theta = .48; orb.phi = 1.37;
    orb.r = Math.max(6.4, (9.4 + 1.6 * m.tam) / camara.aspect);
    nota = "Túnel, cascajo y chapa abollada.";
  }

  function demoBlindaje() {
    // Paneles de dos vóxeles o más por lado para poder socavar solo una esquina a cualquier resolución.
    const lado = Math.max(1, 2 * m.tam), u0 = 6;
    const o = m.blindar({ eje: "principal", u0, u1: u0 + 5 * lado, z0: 0, z1: lado, panel: [lado, lado] });
    m.completar(o.id);
    const [abollado, , colgado, , caido] = m.paneles;
    const golpearPanel = (p, desplazamiento, radio, poder) => {
      const q = V.puntoPanel(p, p.ancho / 2, p.alto / 2, p.grosor + .01);
      q[1] += desplazamiento;
      m.romper(...q, radio, poder, { t: tSim, escombros: 0 });
    };
    golpearPanel(abollado, 0, 1.35 * lado, 1);
    golpearPanel(abollado, 7 * lado, 1.35 * lado, 1);
    golpearPanel(caido, 0, .4 * lado, 2);
    // Golpes en el centro de cada anclaje salvo la esquina izquierda superior.
    const anclajes = colgado.anclajes.map(c => m.centro(...V.deK(c))).sort((a, b) => b[1] - a[1]);
    for (const q of anclajes) {
      if (q[1] < colgado.origen[1] + colgado.ancho / 2 && q[2] >= colgado.alto / 2) continue;
      m.romper(...q, .35 * m.tam, 1, { t: tSim, escombros: 0 });
    }
    tSim += 2;
    m.paso(tSim);
    pausa = true;
    orb.objetivo.set(abollado.origen[0], lado * .8, abollado.origen[1] + 3.7 * lado);
    orb.theta = -.16; orb.phi = 1.17;
    orb.r = Math.max(8, 13 / camara.aspect) * lado;
    nota = "El tramo blindado recibió el mismo golpe que la piedra descubierta a su lado.";
  }

  // ---------- Bucle ----------
  let anterior = performance.now(), acumulado = 0, fps = 0, cuadros = 0, tFps = anterior, tLista = 0;
  function ajustar() {
    const w = cont.clientWidth, h = cont.clientHeight;
    render.setSize(w, h, false); camara.aspect = w / Math.max(1, h); camara.updateProjectionMatrix();
  }
  window.addEventListener("resize", ajustar);
  function cuadro(ahora) {
    const dt = Math.min(.1, (ahora - anterior) / 1000); anterior = ahora;
    if (!pausa) tSim += dt;
    if (!pausa && m.obras.length) { acumulado += dt * ritmo(); const n = Math.floor(acumulado); acumulado -= n; if (n) avance(n); } else acumulado = 0;
    while (cola.length && cola[0].t <= tSim) { const g = cola.shift(); golpear(g.x, g.y, g.z, g.radio, g.poder); }
    m.paso(tSim);
    medirTension();
    const r = vista.actualizar(tSim);
    if (r.trozos) {
      ultimaMalla = r;
      const estado = [m.version, m.rejilla.version, textura.checked, $("#verTension").checked].join("/");
      if (estado !== escenaMedida) { tiemposMalla = ["—", "—"]; escenaMedida = estado; }
      if (r.trozosSolidos === m.rejilla.numTrozos) tiemposMalla[Number(rotura.checked)] = r.msSolida.toFixed(1) + " ms";
      $("#statsMallado").textContent = `Malla sólida completa · con bordes ${tiemposMalla[1]} · sin bordes ${tiemposMalla[0]}`;
    }
    const alto = m.altoEn(TORRETA.x, TORRETA.y);
    torreta.visible = alto != null; if (alto != null) torreta.position.set(TORRETA.x, alto, TORRETA.y);
    if (fogonazo.visible) { const t = (ahora - fogonazoT) / 260; fogonazo.material.opacity = Math.max(0, .85 * (1 - t)); fogonazo.visible = t < 1; }
    render.render(escena, camara);
    cuadros++;
    if (ahora - tFps > 500) { fps = cuadros * 1000 / (ahora - tFps); cuadros = 0; tFps = ahora; }
    if (ahora - tLista > 200) {
      tLista = ahora; listarObras();
      const e = m.estadisticas();
      $("#statsPaneles").textContent = `Paneles · ${e.paneles.fijo} fijos · ${e.paneles.abollado} abollados · ${e.paneles.cuelga} colgados · ${e.paneles.cae} cayendo · ${e.paneles.suelo} en el suelo`;
      $("#stats").textContent = `${e.voxeles} vóxeles · ${e.planeados} en plano · ${e.trozos} trozos · ${vista.caras} caras · ${e.piezas} piezas · malla ${ultimaMalla.ms.toFixed(1)} ms (${ultimaMalla.trozos} trozos) · ${fps.toFixed(0)} fps`;
    }
    requestAnimationFrame(cuadro);
  }

  nueva(+$("#tam").value);
  ajustar();
  if (parametros.get("demo") === "tension") demoTension();
  if (parametros.get("demo") === "rotura") demoRotura();
  if (parametros.get("demo") === "blindaje") demoBlindaje();
  pintar(); colocarCamara();
  requestAnimationFrame(cuadro);
  window.__muralla = { get m() { return m; }, get vista() { return vista; }, escena, camara, render, orb, colocarCamara, acciones, tocar, enSuelo, ponerModo: (x) => { modo = x; puntoA = null; pintar(); }, ponerMaterial: (x) => { material = x === "acero" ? "blindaje" : x; pintar(); }, ponerPausa: (x) => { pausa = x; pintar(); }, golpear, get tSim() { return tSim; } };
})();
