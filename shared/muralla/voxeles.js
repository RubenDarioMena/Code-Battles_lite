/* Code Battle Lite · muralla de vóxeles. Solo la muralla: el terreno sigue siendo el relieve de cada serie.
 *
 * - Determinista: sin Math.random ni reloj. La variación de tono sale de un hash de la posición del vóxel.
 * - Unidades en metros. Ejes del mapa: x hacia el este, y hacia el sur, z hacia arriba (como Campaign).
 * - La malla sale en coordenadas de Three (X = x, Y = z, Z = y), las mismas de la vista 3D de Campaign.
 * - Sin dependencias ni DOM: lo usan el laboratorio (herramientas/muralla/), las pruebas de node y, más adelante, Campaign.
 *
 * Conceptos
 * - Eje: polilínea guía con nombre (el trazado de la muralla del boceto, un tramo nuevo…).
 * - Pared: banda alrededor de un eje. `s0..s1` es la distancia lateral con signo (positiva a la izquierda del avance:
 *   en el boceto de Campaign, hacia el campo de batalla), `z0..z1` la altura y `u0..u1` el tramo a lo largo del eje.
 *   Una capa nueva es otra pared sobre el mismo eje con la banda contigua; subir es otra pared encima.
 * - Obra: los vóxeles de una pared que faltan, en orden de construcción (tramos de 2 m, de abajo arriba).
 *   `avanzar(n)` coloca los n siguientes. Lo que falta se ve como «plano».
 * - Romper: quita los vóxeles de una esfera según el poder del golpe y la resistencia del material. Después,
 *   integridad (camino hasta el suelo con voladizo), piezas que cuelgan de una bisagra o caen, y escombro.
 *   Reparar es volver a planear las paredes: entran los vóxeles vacíos y los de escombro. */
(() => {
  "use strict";
  const LADO = 16, MASC = 15, L3 = LADO * LADO * LADO;
  const BORDE_ROTURA = .18, BORDE_CASCAJO = .22; // amplitud máxima por eje, en vóxeles
  const TRAMO_OBRA = 2; // metros por tramo de obra

  // Materiales provisionales del laboratorio: color, variación de tono, resistencia (0–1) frente a `romper`
  // y voladizo: cuántos metros en horizontal aguanta un vóxel lejos de una columna apoyada en el suelo.
  // No son valores de juego: costes, resistencias y reparación de Campaign siguen pendientes (VISION-CAMPANA §7).
  // Cada material tiene su escombro (ids 4–6): más débil, sin voladizo y algo más oscuro.
  const BLINDAJE = Object.freeze({
    panel: Object.freeze([1, 1]), holgura: .04, grosor: .08, resistencia: .3, aguante: 1.6,
    absorcion: .7, unidades: 4, alcanceAnclaje: 1.5, anguloColgado: Math.PI / 6, fraccionAbolladuraMaxima: .9,
  });
  const BASE = [
    { id: "piedra", nombre: "Piedra", color: 0x85887f, variacion: .09, resistencia: .25, voladizo: 1.5 },
    { id: "hormigon", nombre: "Hormigón", color: 0xaaa79c, variacion: .04, resistencia: .5, voladizo: 3 },
    { id: "acero", nombre: "Acero", color: 0x5f6d78, variacion: .03, resistencia: .8, voladizo: 6 },
  ];
  const oscuro = (hex, f) => (Math.round((hex >> 16 & 255) * f) << 16) | (Math.round((hex >> 8 & 255) * f) << 8) | Math.round((hex & 255) * f);
  const MATERIALES = [null, ...BASE, ...BASE.map((m, n) => ({
    id: `${m.id}-escombro`, nombre: `Escombro de ${m.nombre.toLowerCase()}`, color: oscuro(m.color, .74), variacion: m.variacion * 1.8,
    resistencia: m.resistencia * .5, voladizo: 0, escombro: true, de: n + 1,
  }))];
  BASE.forEach((m, n) => { m.aEscombro = n + 1 + BASE.length; });
  const MAT = {};
  MATERIALES.forEach((m, n) => { if (m) MAT[m.id] = n; });
  const idMaterial = (m) => typeof m === "number" ? m : (MAT[m] || 1);
  const aEscombro = (m) => MATERIALES[m].escombro ? m : MATERIALES[m].aEscombro;
  const esEscombro = (m) => !!(m && MATERIALES[m].escombro);
  const solidoReal = (m) => !!m && !MATERIALES[m].escombro;
  const GRAVEDAD = 9.8, AMPLITUD_VAIVEN = .22;

  // Clave de un vóxel (±32768 por eje) para mapas de apoyo e islas.
  const K = (i, j, k) => ((i + 32768) * 65536 + (j + 32768)) * 65536 + (k + 32768);
  const deK = (c) => [Math.floor(c / 4294967296) - 32768, Math.floor(c / 65536) % 65536 - 32768, c % 65536 - 32768];
  const VECINOS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  function hash3(i, j, k) {
    let h = Math.imul(i | 0, 73856093) ^ Math.imul(j | 0, 19349663) ^ Math.imul(k | 0, 83492791);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---------- Rejilla dispersa por trozos de 16³ ----------
  // Claves numéricas: ±512 trozos por eje (con vóxeles de 0,5 m, ±4 km).
  const claveDe = (ci, cj, ck) => ((ci + 512) * 1024 + (cj + 512)) * 1024 + (ck + 512);
  const deClave = (c) => [Math.floor(c / 1048576) - 512, (Math.floor(c / 1024) % 1024) - 512, (c % 1024) - 512];

  function crearRejilla() {
    const trozos = new Map(), sucios = new Set();
    let total = 0, version = 0, ultimaClave = -1, ultimo = null;
    function trozo(ci, cj, ck, crear) {
      const c = claveDe(ci, cj, ck);
      if (c === ultimaClave) return ultimo;
      let t = trozos.get(c);
      if (!t && crear) { t = { ci, cj, ck, d: new Uint8Array(L3), n: 0 }; trozos.set(c, t); }
      if (t) { ultimaClave = c; ultimo = t; }
      return t || null;
    }
    function get(i, j, k) {
      const t = trozo(i >> 4, j >> 4, k >> 4, false);
      return t ? t.d[(i & MASC) | (j & MASC) << 4 | (k & MASC) << 8] : 0;
    }
    function marcar(i, j, k) {
      // El trozo propio y los vecinos que tocan este vóxel (caras y oclusión de las esquinas).
      const ci = i >> 4, cj = j >> 4, ck = k >> 4, li = i & MASC, lj = j & MASC, lk = k & MASC;
      const di = li === 0 ? [-1, 0] : li === MASC ? [0, 1] : [0], dj = lj === 0 ? [-1, 0] : lj === MASC ? [0, 1] : [0], dk = lk === 0 ? [-1, 0] : lk === MASC ? [0, 1] : [0];
      for (const a of di) for (const b of dj) for (const c of dk) {
        const cl = claveDe(ci + a, cj + b, ck + c);
        if (trozos.has(cl)) sucios.add(cl);
      }
    }
    function set(i, j, k, m) {
      const t = trozo(i >> 4, j >> 4, k >> 4, !!m);
      if (!t) return 0;
      const idx = (i & MASC) | (j & MASC) << 4 | (k & MASC) << 8, prev = t.d[idx];
      if (prev === m) return prev;
      version++;
      t.d[idx] = m;
      const delta = (m ? 1 : 0) - (prev ? 1 : 0);
      t.n += delta; total += delta;
      marcar(i, j, k);
      return prev;
    }
    function recorrer(fn) {
      for (const t of trozos.values()) {
        if (!t.n) continue;
        const bi = t.ci * LADO, bj = t.cj * LADO, bk = t.ck * LADO;
        for (let idx = 0; idx < L3; idx++) { const m = t.d[idx]; if (m) fn(bi + (idx & MASC), bj + (idx >> 4 & MASC), bk + (idx >> 8), m); }
      }
    }
    function vaciar() { if (total) version++; for (const c of trozos.keys()) sucios.add(c); for (const t of trozos.values()) { t.d.fill(0); t.n = 0; } total = 0; }
    function tomarSucios() { const out = [...sucios]; sucios.clear(); return out; }
    function marcarTodo() { for (const c of trozos.keys()) sucios.add(c); }
    // Guardado por trozos: pares [material, repeticiones] en el orden del índice interno.
    function rle(t) { const out = []; let m = t.d[0], n = 0; for (let idx = 0; idx < L3; idx++) { if (t.d[idx] === m) n++; else { out.push(m, n); m = t.d[idx]; n = 1; } } out.push(m, n); return out; }
    function exportar() { const out = {}; for (const t of trozos.values()) if (t.n) out[`${t.ci},${t.cj},${t.ck}`] = rle(t); return out; }
    function importar(datos) {
      for (const [k, runs] of Object.entries(datos || {})) {
        const [ci, cj, ck] = k.split(",").map(Number), t = trozo(ci, cj, ck, true);
        let idx = 0;
        for (let r = 0; r < runs.length; r += 2) { t.d.fill(runs[r], idx, idx + runs[r + 1]); idx += runs[r + 1]; }
        let n = 0; for (let q = 0; q < L3; q++) if (t.d[q]) n++;
        total += n - t.n; t.n = n; sucios.add(claveDe(ci, cj, ck));
        version++;
      }
    }
    return {
      get, set, recorrer, vaciar, tomarSucios, marcarTodo, exportar, importar,
      marcarTrozo: (c) => sucios.add(c),
      get version() { return version; },
      trozo: (c) => trozos.get(c) || null,
      claves: () => [...trozos.keys()],
      get total() { return total; },
      get numTrozos() { return trozos.size; },
    };
  }

  // ---------- Ejes ----------
  // Proyección de un punto sobre una polilínea: distancia lateral con signo, recorrido y si cae más allá de un extremo.
  function proyectar(pts, x, y) {
    let mejor = Infinity, s = 0, u = 0, largo = 0, extremo = false;
    for (let n = 0; n < pts.length - 1; n++) {
      const [ax, ay] = pts[n], [bx, by] = pts[n + 1], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      if (!L) continue;
      const tc = ((x - ax) * dx + (y - ay) * dy) / (L * L), t = Math.min(1, Math.max(0, tc));
      const d = Math.hypot(x - ax - dx * t, y - ay - dy * t);
      if (d < mejor - 1e-9) {
        mejor = d;
        // Mismo criterio que campaign-terreno.js: producto cruzado > 0 es «dentro» (derecha del avance).
        s = dx * (y - ay) - dy * (x - ax) > 0 ? -d : d;
        u = largo + t * L;
        extremo = (n === 0 && tc < 0) || (n === pts.length - 2 && tc > 1);
      }
      largo += L;
    }
    return { d: mejor, s, u, largo, extremo };
  }
  const largoDe = (pts) => { let L = 0; for (let n = 0; n < pts.length - 1; n++) L += Math.hypot(pts[n + 1][0] - pts[n][0], pts[n + 1][1] - pts[n][1]); return L; };

  // Punto en la polilínea paralela. En cada vértice coinciden los extremos de ambas bandas desplazadas.
  function ejeDesplazado(pts, s) {
    const nodos = [], segmentos = [];
    let u = 0;
    for (const xy of pts) {
      const a = nodos[nodos.length - 1];
      if (a) {
        const dx = xy[0] - a.xy[0], dy = xy[1] - a.xy[1], l = Math.hypot(dx, dy);
        if (!l) continue;
        const normal = [dy / l, -dx / l];
        segmentos.push(normal); u += l;
      }
      nodos.push({ xy, u });
    }
    for (let i = 0; i < nodos.length && segmentos.length; i++) {
      const a = segmentos[Math.max(0, i - 1)], b = segmentos[Math.min(i, segmentos.length - 1)];
      const den = 1 + a[0] * b[0] + a[1] * b[1];
      nodos[i].xy = nodos[i].xy.map((v, k) => v + s * (den > 1e-6 ? (a[k] + b[k]) / den : b[k]));
    }
    return u => {
      const i = nodos.findIndex((n, j) => j && n.u >= u);
      if (i < 0) return nodos[nodos.length - 1].xy;
      const a = nodos[i - 1], b = nodos[i], f = (u - a.u) / (b.u - a.u);
      return a.xy.map((v, k) => v + f * (b.xy[k] - v));
    };
  }

  const producto = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const diferencia = (a, b) => a.map((v, i) => v - b[i]);
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  // Punto de mapa bajo una matriz de Three (X, altura, Y).
  function transformar(M, [x, y, z]) {
    return [0, 2, 1].map(f => M[f] * x + M[4 + f] * z + M[8 + f] * y + M[12 + f]);
  }
  const vertical = [0, 0, 1];
  function puntoPanel(p, u, h, d = 0) {
    return p.origen.map((v, i) => v + p.tangente[i] * u + p.normal[i] * d + vertical[i] * h);
  }

  // ---------- Muralla ----------
  function crear(op = {}) {
    const tam = op.tam || .5, origen = (op.origen || [0, 0, 0]).slice(0, 3);
    const rejilla = crearRejilla(), plano = crearRejilla();
    const ejes = {}, paredes = [], obras = [], paneles = [];
    let versionPaneles = 0, versionPlanoPaneles = 0;
    let sigId = 1, version = 0;

    const indice = (x, y, z) => [Math.floor((x - origen[0]) / tam), Math.floor((y - origen[1]) / tam), Math.floor((z - origen[2]) / tam)];
    const centro = (i, j, k) => [origen[0] + (i + .5) * tam, origen[1] + (j + .5) * tam, origen[2] + (k + .5) * tam];
    // Rango de índices cuyo centro cae en [a, b) a lo largo de un eje.
    const rango = (a, b, o) => [Math.ceil((a - o) / tam - .5), Math.ceil((b - o) / tam - .5)];

    // Unión del volumen de diseño, incluidas las almenas y las obras pendientes.
    let volumen = null, revisionVolumen = 0;
    function invalidarVolumen() {
      volumen = null;
      revisionVolumen++;
      rejilla.marcarTodo();
    }
    function enPared(i, j, k) {
      if (!volumen) {
        volumen = new Set();
        const incluir = (x, y, z) => volumen.add(K(x, y, z));
        for (const p of paredes) recorrerVolumen(p, {}, incluir);
      }
      return volumen.has(K(i, j, k));
    }
    rejilla.enPared = enPared;

    function eje(nombre, puntos) {
      if (!puntos || puntos.length < 2) throw new Error(`El eje «${nombre}» necesita al menos dos puntos.`);
      if (ejes[nombre]) invalidarVolumen();
      ejes[nombre] = puntos.map(p => [+p[0], +p[1]]);
      version++;
      return largoDe(ejes[nombre]);
    }
    const pared = (id) => paredes.find(p => p.id === id) || null;

    function normalizar(def) {
      if (!ejes[def.eje]) throw new Error(`No existe el eje «${def.eje}».`);
      const p = {
        id: sigId++, eje: def.eje,
        s0: +def.s0, s1: +def.s1, z0: +(def.z0 ?? 0), z1: +def.z1,
        u0: def.u0 == null ? 0 : +def.u0, u1: def.u1 == null ? null : +def.u1,
        material: idMaterial(def.material || "piedra"),
        almenas: def.almenas ? { alto: def.almenas.alto ?? .5, ancho: def.almenas.ancho ?? tam, paso: def.almenas.paso ?? 1, lado: def.almenas.lado || "fuera" } : null,
      };
      if (!(p.s1 > p.s0) || !(p.z1 > p.z0)) throw new Error("La pared necesita s1 > s0 y z1 > z0.");
      return p;
    }

    function recorrerVolumen(p, filtro, visitar) {
      const pts = ejes[p.eje], ext = Math.max(Math.abs(p.s0), Math.abs(p.s1)) + tam;
      const u0 = Math.max(p.u0, filtro.u0 ?? -Infinity), u1 = Math.min(p.u1 ?? Infinity, filtro.u1 ?? Infinity);
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      const [i0, i1] = rango(Math.min(...xs) - ext, Math.max(...xs) + ext, origen[0]);
      const [j0, j1] = rango(Math.min(...ys) - ext, Math.max(...ys) + ext, origen[1]);
      const [k0, k1] = rango(p.z0, p.z1, origen[2]);
      const al = p.almenas, [ka0, ka1] = al ? rango(p.z1, p.z1 + al.alto, origen[2]) : [0, 0];
      for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
        const pr = proyectar(pts, origen[0] + (i + .5) * tam, origen[1] + (j + .5) * tam);
        if (pr.extremo || pr.u < u0 || pr.u >= u1) continue;
        if (pr.s >= p.s0 && pr.s < p.s1) for (let k = k0; k < k1; k++) visitar(i, j, k, pr.u, pr.s);
        if (al && Math.floor(pr.u / al.paso) % 2 === 0 && (al.lado === "dentro" ? pr.s >= p.s0 && pr.s < p.s0 + al.ancho : pr.s >= p.s1 - al.ancho && pr.s < p.s1))
          for (let k = ka0; k < ka1; k++) visitar(i, j, k, pr.u, pr.s);
      }
    }

    // Solo la obra necesita los tramos de 2 m ordenados de abajo arriba, a lo largo y de lado.
    function voxelesDe(p, filtro = {}) {
      const lista = [];
      recorrerVolumen(p, filtro, (i, j, k, u, s) => lista.push([i, j, k, u, s]));
      lista.sort((a, b) => Math.floor(a[3] / TRAMO_OBRA) - Math.floor(b[3] / TRAMO_OBRA) || a[2] - b[2] || a[3] - b[3] || a[4] - b[4] || a[0] - b[0] || a[1] - b[1]);
      const out = new Int32Array(lista.length * 3);
      lista.forEach((v, n) => { out[n * 3] = v[0]; out[n * 3 + 1] = v[1]; out[n * 3 + 2] = v[2]; });
      return out;
    }

    // Planea una obra: una pared nueva (objeto) o una existente (id), opcionalmente solo un tramo (filtro.u0/u1).
    function planear(def, filtro) {
      const p = typeof def === "number" ? pared(def) : normalizar(def);
      if (!p) throw new Error(`No existe la pared ${def}.`);
      if (typeof def !== "number") { paredes.push(p); invalidarVolumen(); }
      const todos = voxelesDe(p, filtro), faltan = [];
      // El escombro que quedó dentro de la pared cuenta como hueco: la obra lo sustituye.
      for (let n = 0; n < todos.length; n += 3) { const v = rejilla.get(todos[n], todos[n + 1], todos[n + 2]); if (!v || esEscombro(v)) faltan.push(todos[n], todos[n + 1], todos[n + 2]); }
      const obra = { id: sigId++, pared: p.id, material: p.material, lista: Int32Array.from(faltan), sig: 0, hechos: 0 };
      for (let n = 0; n < obra.lista.length; n += 3) if (!plano.get(obra.lista[n], obra.lista[n + 1], obra.lista[n + 2])) plano.set(obra.lista[n], obra.lista[n + 1], obra.lista[n + 2], p.material);
      if (obra.lista.length) obras.push(obra);
      version++;
      return resumenObra(obra);
    }
    function blindar({ eje, lado = "fuera", u0 = 0, u1, z0, z1, panel = BLINDAJE.panel, grosor = BLINDAJE.grosor }) {
      const banda = capa(eje, lado, grosor), signo = lado === "fuera" ? 1 : -1;
      const s = (signo > 0 ? banda.s0 : banda.s1) + signo * BLINDAJE.holgura;
      const punto = ejeDesplazado(ejes[eje], s), fin = Math.min(u1 ?? Infinity, largoDe(ejes[eje]));
      u0 = Math.max(0, u0); z0 ??= banda.z0; z1 ??= banda.z1;
      const [ancho, alto] = panel;
      if (![ancho, alto, grosor].every(v => Number.isFinite(v) && v > 0) || ![u0, fin, z0, z1].every(Number.isFinite))
        throw new Error("Medidas de blindaje inválidas.");
      const obra = { id: sigId++, tipo: "blindaje", eje, lista: [], sig: 0, hechos: 0, credito: 0, omitidos: 0 };
      const existentes = [...paneles, ...obras.filter(o => o.tipo === "blindaje").flatMap(o => o.lista.slice(o.sig))];
      for (let i = 0; i < Math.floor((fin - u0) / ancho + 1e-9); i++) {
        const u = u0 + i * ancho, a = punto(u), b = punto(u + ancho), dx = b[0] - a[0], dy = b[1] - a[1];
        const cuerda = Math.hypot(dx, dy);
        if (cuerda < 1e-9) continue;
        const tangente = [dx / cuerda, dy / cuerda, 0], normal = [signo * tangente[1], -signo * tangente[0], 0];
        for (let j = 0; j < Math.floor((z1 - z0) / alto + 1e-9); j++) {
          const z = z0 + j * alto;
          if (existentes.some(p => p.nombreEje === eje && p.s === s && p.u0 < u + ancho - 1e-9 && u < p.u1 - 1e-9 &&
            p.z0 < z + alto - 1e-9 && z < p.z0 + p.alto - 1e-9 && p.estado !== "cae" && p.estado !== "suelo")) continue;
          const p = { id: sigId++, nombreEje: eje, lado, s, u0: u, u1: u + ancho, z0: z,
            origen: [a[0], a[1], z], ancho: cuerda, alto, grosor, tangente, normal };
          ajustarMontaje(p); obra.lista.push(p);
        }
      }
      if (obra.lista.length) { obras.push(obra); versionPlanoPaneles++; version++; volumen = null; }
      return resumenObra(obra);
    }

    function anclajesDe(p) {
      const fondo = tam * BLINDAJE.alcanceAnclaje;
      const esquinas = [0, p.ancho].flatMap(u => [0, -fondo].map(d => puntoPanel(p, u, 0, d)));
      const limites = [0, 1].map(k => {
        const v = esquinas.map(q => q[k]);
        return rango(Math.min(...v) - 1e-9, Math.max(...v) + 1e-9, origen[k]);
      });
      const [k0, k1] = rango(p.z0, p.z0 + p.alto, origen[2]), anclajes = [];
      for (let k = k0; k < k1; k++) for (let j = limites[1][0]; j < limites[1][1]; j++) for (let i = limites[0][0]; i < limites[0][1]; i++) {
        if (!solidoReal(rejilla.get(i, j, k))) continue;
        const v = diferencia(centro(i, j, k), p.origen), u = producto(v, p.tangente), d = producto(v, p.normal);
        if (u >= 0 && u < p.ancho && d <= 0 && d > -fondo) anclajes.push(K(i, j, k));
      }
      return anclajes;
    }
    // El canto de un cubo puede sobresalir de la banda nominal, sobre todo en diagonal.
    // Separa la cara interior lo justo para conservar también la holgura sobre los anclajes reales.
    function ajustarMontaje(p) {
      const a = p.origenNominal || p.origen;
      p.origenNominal = a; p.origen = a;
      const claves = anclajesDe(p);
      const radioCelda = tam / 2 * (Math.abs(p.normal[0]) + Math.abs(p.normal[1]));
      let ajuste = 0;
      for (const c of claves) {
        const profundidad = producto(diferencia(centro(...deK(c)), a), p.normal);
        ajuste = Math.max(ajuste, profundidad + radioCelda + BLINDAJE.holgura);
      }
      if (ajuste <= 1e-9) return claves;
      p.origen = a.map((v, i) => v + ajuste * p.normal[i]);
      return anclajesDe(p);
    }
    function colocarPaneles(o, n, resultado) {
      let gasto = 0;
      while (o.sig < o.lista.length && gasto < n) {
        const unidades = Math.min(BLINDAJE.unidades - o.credito, n - gasto);
        gasto += unidades; o.credito += unidades;
        if (o.credito < BLINDAJE.unidades) break;
        const p = o.lista[o.sig++], anclajes = ajustarMontaje(p);
        o.credito = 0; versionPlanoPaneles++;
        if (!anclajes.length) { o.omitidos++; resultado.omitidos++; continue; }
        paneles.push({ ...p, anclajes, iniciales: anclajes.length, dano: 0, abolladura: null, estado: "fijo" });
        versionPaneles++; o.hechos++; resultado.paneles++;
      }
      return gasto;
    }

    const resumenObra = (o) => o.tipo === "blindaje" ? {
      id: o.id, tipo: o.tipo, eje: o.eje, total: o.hechos + o.omitidos + o.lista.length - o.sig,
      hechos: o.hechos, pendientes: o.lista.length - o.sig, omitidos: o.omitidos,
    } : ({ id: o.id, pared: o.pared, total: o.lista.length / 3, hechos: o.hechos, pendientes: o.lista.length / 3 - o.sig / 3 });

    // Coloca hasta n vóxeles de una obra (la primera de la cola si no se indica). Saltar uno ya lleno no gasta.
    function colocarDe(obra, n, colocados) {
      let puestos = 0;
      while (obra.sig < obra.lista.length && puestos < n) {
        const i = obra.lista[obra.sig], j = obra.lista[obra.sig + 1], k = obra.lista[obra.sig + 2];
        obra.sig += 3;
        if (plano.get(i, j, k)) plano.set(i, j, k, 0);
        const ya = rejilla.get(i, j, k);
        if (ya && !esEscombro(ya)) continue;
        rejilla.set(i, j, k, obra.material); obra.hechos++; puestos++;
        if (colocados) colocados.push(i, j, k);
      }
      return puestos;
    }
    function avanzar(n = 1) {
      const colocados = [], terminadas = [];
      const resultado = { paneles: 0, omitidos: 0 };
      let resto = n;
      while (resto > 0 && obras.length) {
        const o = obras[0];
        resto -= o.tipo === "blindaje" ? colocarPaneles(o, resto, resultado) : colocarDe(o, resto, colocados);
        if (o.sig >= o.lista.length) { obras.shift(); terminadas.push(o.id); }
      }
      if (resto < n || terminadas.length) version++;
      return { colocados: colocados.length / 3, lista: colocados, terminadas, ...resultado };
    }
    function completar(idObra) {
      const n = obras.findIndex(o => o.id === idObra);
      if (n < 0) return 0;
      const o = obras[n], resultado = { paneles: 0, omitidos: 0 };
      if (o.tipo === "blindaje") colocarPaneles(o, Infinity, resultado);
      const puestos = o.tipo === "blindaje" ? resultado.paneles : colocarDe(o, Infinity);
      obras.splice(n, 1); version++;
      return puestos;
    }
    function construir(def, filtro) { const o = planear(def, filtro); completar(o.id); return { ...o, hechos: o.total, pendientes: 0 }; }
    function cancelar(idObra) {
      const n = obras.findIndex(o => o.id === idObra);
      if (n < 0) return false;
      if (obras[n].tipo === "blindaje") versionPlanoPaneles++;
      obras.splice(n, 1);
      plano.vaciar();
      for (const o of obras) if (o.tipo !== "blindaje") for (let q = o.sig; q < o.lista.length; q += 3) if (!solidoReal(rejilla.get(o.lista[q], o.lista[q + 1], o.lista[q + 2]))) plano.set(o.lista[q], o.lista[q + 1], o.lista[q + 2], o.material);
      version++;
      return true;
    }

    // ---------- Destrucción en tres capas (idea tomada de THE FINALS, temporada 12; ver docs/MURALLA-VOXELES.md) ----------
    // 1. Integridad: cada vóxel necesita un camino hasta el suelo; cada paso en horizontal gasta voladizo del material.
    // 2. Destrucción gradual: lo que pierde el apoyo no desaparece. Si queda colgado de un solo lado gira sobre una
    //    bisagra; con una unión ancha se queda colgando (se mece) hasta el próximo golpe. Sujeto por los dos lados, se hunde.
    // 3. Escombro: al asentarse, la pieza vuelve a la rejilla como escombro, que no se recalcula. La onda del golpe
    //    lanza parte de lo roto lejos del centro y forma montones al pie de la muralla.
    // Todo se calcula al golpear (no en cada fotograma). Las piezas en movimiento son una pose en función del tiempo.
    const piezas = [];
    const kSuelo = Math.round(-origen[2] / tam);                       // primera celda con la cara de abajo en z = 0
    const enSuelo = (k) => origen[2] + k * tam <= 1e-9;
    const limite = (m) => Math.floor(MATERIALES[m].voladizo / tam + 1e-9);
    const BISAGRA = 10;                                               // vóxeles que sostiene cada cara de unión

    // Coste de apoyo: metros horizontales (en vóxeles) desde la columna apoyada más cercana. El escombro no entra.
    function apoyo() {
      const coste = new Map();
      let nivel = [];
      rejilla.recorrer((i, j, k, m) => { if (enSuelo(k) && !esEscombro(m)) { const c = K(i, j, k); coste.set(c, 0); nivel.push(c); } });
      for (let c = 0; nivel.length; c++) {
        const sig = [];
        for (let n = 0; n < nivel.length; n++) {
          const key = nivel[n];
          if (coste.get(key) !== c) continue;
          const [i, j, k] = deK(key);
          for (const [di, dj, dk] of VECINOS) {
            const m = rejilla.get(i + di, j + dj, k + dk);
            if (!m || esEscombro(m)) continue;
            const h = dk ? 0 : 1, nc = c + h;
            if (nc > limite(m)) continue;
            const nk = K(i + di, j + dj, k + dk), prev = coste.get(nk);
            if (prev !== undefined && prev <= nc) continue;
            coste.set(nk, nc); (h ? sig : nivel).push(nk);
          }
        }
        nivel = sig;
      }
      return coste;
    }

    let costesApoyo, versionApoyo = -1;
    function costesActuales() {
      if (versionApoyo !== rejilla.version) {
        costesApoyo = apoyo();
        versionApoyo = rejilla.version;
      }
      return costesApoyo;
    }

    function nivelVoladizo(coste, m) {
      if (!coste) return 0;
      const maximo = limite(m);
      if (coste >= maximo) return 4;
      // Piedra a 0,5 m (límite 3): degradado más suave, costes 1 y 2 → niveles 1 y 3 (equivale a redondear 4·r).
      // Decidido mantenerlo así; el resto usa la regla del 50 %.
      if (m === MAT.piedra && tam === .5) return coste === 1 ? 1 : 3;
      if (coste * 2 < maximo) return 0;
      if (coste * 3 < maximo * 2) return 1;
      if (coste * 6 < maximo * 5) return 2;
      return 3;
    }

    let unionesSueltas = 0, versionCalculada = -1, niveles = new Map();
    const versionTension = () => rejilla.version + unionesSueltas;
    function tension() {
      if (versionCalculada === versionTension()) return niveles;
      const costes = costesActuales(), nuevos = new Map();
      function elevarNivel(c, nivel) {
        if (nivel > (nuevos.get(c) || 0)) nuevos.set(c, nivel);
      }
      rejilla.recorrer((i, j, k, m) => {
        if (esEscombro(m)) return;
        const c = K(i, j, k), nivel = nivelVoladizo(costes.get(c) ?? Infinity, m);
        if (nivel) elevarNivel(c, nivel);
      });
      for (const p of piezas) {
        if (p.estado !== "cuelga") continue;
        for (const c of p.soportes) {
          if (solidoReal(rejilla.get(...deK(c)))) elevarNivel(c, 3);
        }
      }
      function marcarCambio(c) {
        const [i, j, k] = deK(c);
        rejilla.marcarTrozo(claveDe(i >> 4, j >> 4, k >> 4));
      }
      for (const [c, nivel] of nuevos) if (niveles.get(c) !== nivel) marcarCambio(c);
      for (const c of niveles.keys()) if (!nuevos.has(c)) marcarCambio(c);
      niveles = nuevos;
      versionCalculada = versionTension();
      return niveles;
    }

    function rotar(P, piv, eje, ang) {
      const [ax, ay, az] = eje, c = Math.cos(ang), s = Math.sin(ang), C = 1 - c, x = P[0] - piv[0], y = P[1] - piv[1], z = P[2] - piv[2];
      return [piv[0] + (c + ax * ax * C) * x + (ax * ay * C - az * s) * y + (ax * az * C + ay * s) * z,
        piv[1] + (ay * ax * C + az * s) * x + (c + ay * ay * C) * y + (ay * az * C - ax * s) * z,
        piv[2] + (az * ax * C - ay * s) * x + (az * ay * C + ax * s) * y + (c + az * az * C) * z];
    }
    // Hasta dónde gira una pieza antes de tocar el suelo o la muralla (pasos de 3°, como mucho 90°).
    function anguloLibre(desde, toca) {
      const paso = Math.PI / 60;
      let ok = desde;
      for (let a = desde + paso; a <= Math.PI / 2 + 1e-9; a += paso) {
        if (toca(a)) break;
        ok = a;
      }
      return ok;
    }
    function anguloFinal(vox, piv, eje, desde, soportes) {
      return anguloLibre(desde, a => {
        for (let n = 0; n < vox.length; n += 4) {
          const P = rotar(centro(vox[n], vox[n + 1], vox[n + 2]), piv, eje, a);
          if (P[2] < tam * .25) return true;
          if (Math.hypot(P[0] - piv[0], P[1] - piv[1], P[2] - piv[2]) < tam * 1.2) continue;
          const [i, j, k] = indice(P[0], P[1], P[2]);
          if (rejilla.get(i, j, k) && !soportes.has(K(i, j, k))) return true;
        }
        return false;
      });
    }
    const duracion = (delta, brazo) => Math.min(2, Math.max(.25, Math.sqrt(2 * Math.abs(delta) / (1.2 * GRAVEDAD / Math.max(brazo, tam))))) ;

    function crearPieza(isla, pares, t, golpe) {
      const vox = new Int32Array(isla.length * 4);
      let cx = 0, cy = 0, cz = 0;
      isla.forEach((key, n) => {
        const [i, j, k] = deK(key), c = centro(i, j, k);
        vox.set([i, j, k, rejilla.get(i, j, k)], n * 4); cx += c[0]; cy += c[1]; cz += c[2];
      });
      cx /= isla.length; cy /= isla.length; cz /= isla.length;
      for (let n = 0; n < vox.length; n += 4) rejilla.set(vox[n], vox[n + 1], vox[n + 2], 0);
      const p = { id: sigId++, t0: t, dur: 0, vox, pivote: [cx, cy, cz], eje: [1, 0, 0], a0: 0, a1: 0, caida: 0, estado: "cae", soportes: [], centro: [cx, cy, cz] };
      p.radio = 0;
      for (let n = 0; n < vox.length; n += 4) { const c = centro(vox[n], vox[n + 1], vox[n + 2]); p.radio = Math.max(p.radio, Math.hypot(c[0] - cx, c[1] - cy, c[2] - cz)); }
      // Puntos de unión: entre el centro del vóxel suelto y el del apoyado.
      let mx = 0, my = 0, mz = Infinity, dm = 0;
      for (const [a, b] of pares) {
        const A = centro(...deK(a)), B = centro(...deK(b)), u = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
        mx += u[0]; my += u[1]; mz = Math.min(mz, u[2]); dm += Math.hypot(u[0] - cx, u[1] - cy);
      }
      const dx = cx - mx / (pares.length || 1), dy = cy - my / (pares.length || 1), dh = Math.hypot(dx, dy);
      dm /= pares.length || 1;
      if (pares.length && dh >= .35 * dm && dh >= tam * .5) {
        // Bisagra en el canto de abajo de la unión; el giro baja el centro de la pieza.
        p.soportes = [...new Set(pares.map(q => q[1]))];
        p.pivote = [mx / pares.length, my / pares.length, mz - tam / 2];
        p.eje = [-dy / dh, dx / dh, 0];
        const fin = anguloFinal(vox, p.pivote, p.eje, 0, new Set(p.soportes));
        if (pares.length * BISAGRA >= isla.length) { p.estado = "cuelga"; p.a1 = Math.min(fin, (8 + 22 * isla.length / (pares.length * BISAGRA)) * Math.PI / 180); }
        else p.a1 = fin;
        p.dur = duracion(p.a1, dh);
      } else {
        // Sin bisagra (suelto, o sujeto por los dos lados): cae recto hasta lo que tenga debajo.
        let caer = Infinity;
        for (let n = 0; n < vox.length && caer > 0; n += 4) {
          let k = vox[n + 2], c = 0;
          while (k - 1 >= kSuelo && !rejilla.get(vox[n], vox[n + 1], k - 1)) { k--; c++; }
          caer = Math.min(caer, c);
        }
        p.caida = (caer === Infinity ? 0 : caer) * tam;
        p.dur = p.caida ? Math.sqrt(2 * p.caida / GRAVEDAD) : 0;
      }
      if (golpe) p.golpe = golpe.slice();
      piezas.push(p);
      return p;
    }

    // Islas sin apoyo y sus caras de unión con lo que sí está apoyado.
    function derrumbar(t = 0, golpe = null) {
      const coste = costesActuales(), sueltos = [];
      rejilla.recorrer((i, j, k, m) => { if (!esEscombro(m) && !coste.has(K(i, j, k))) sueltos.push(K(i, j, k)); });
      if (!sueltos.length) { revisarAnclajes(t); return []; }
      sueltos.sort((a, b) => a - b);
      const libres = new Set(sueltos), nuevas = [];
      for (const s0 of sueltos) {
        if (!libres.has(s0)) continue;
        libres.delete(s0);
        const isla = [s0], pares = [];
        for (let n = 0; n < isla.length; n++) {
          const [i, j, k] = deK(isla[n]);
          for (const [di, dj, dk] of VECINOS) {
            const nk = K(i + di, j + dj, k + dk);
            if (libres.has(nk)) { libres.delete(nk); isla.push(nk); }
            else if (coste.has(nk)) pares.push([isla[n], nk]);
          }
        }
        nuevas.push(crearPieza(isla, pares, t, golpe).id);
      }
      // Solo salieron celdas ausentes de coste. Todos los caminos apoyados siguen intactos.
      versionApoyo = rejilla.version;
      version++;
      revisarAnclajes(t);
      return nuevas;
    }

    // Pose de una pieza en el instante t: ángulo de la bisagra y caída. Cae con aceleración; colgada, se mece y se calma.
    function pose(p, t) {
      if (!p.pivote) return { angulo: 0, caida: 0 };
      const tau = p.dur ? Math.min(1, Math.max(0, (t - p.t0) / p.dur)) : 1, e = tau * tau;
      let angulo = p.a0 + (p.a1 - p.a0) * e;
      if (p.estado === "cuelga" && t > p.t0 + p.dur) { const s = t - p.t0 - p.dur; angulo = p.a1 * (1 + AMPLITUD_VAIVEN * Math.exp(-2.5 * s) * Math.sin(8 * s)); }
      let caida = p.caida * e;
      if (p.inclinacionInicial != null) {
        // La arista inferior puede tocar tierra antes de que la plancha termine de tumbarse.
        const alturaInferior = p.pivote[2] - p.alto * Math.cos(p.inclinacionInicial + angulo);
        caida = Math.min(caida, Math.max(0, alturaInferior));
      }
      return { angulo, caida };
    }
    // Matriz 4 × 4 (orden de columnas, coordenadas de Three) para dibujar la pieza en su pose.
    function matrizPieza(p, t) {
      if (p.poseFinal) return p.poseFinal.slice();
      if (!p.pivote) return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
      const { angulo, caida } = pose(p, t), piv = p.pivote;
      const o = [0, 0, 0], ex = rotar([piv[0] + 1, piv[1], piv[2]], piv, p.eje, angulo), ey = rotar([piv[0], piv[1] + 1, piv[2]], piv, p.eje, angulo), ez = rotar([piv[0], piv[1], piv[2] + 1], piv, p.eje, angulo);
      const R = [ex, ey, ez].map(v => [v[0] - piv[0], v[1] - piv[1], v[2] - piv[2]]);   // columnas de la rotación (mapa)
      const T = rotar(o, piv, p.eje, angulo); T[2] -= caida;                          // a dónde va el origen
      const sw = [0, 2, 1], e = new Array(16).fill(0);
      for (let col = 0; col < 3; col++) for (let fila = 0; fila < 3; fila++) e[col * 4 + fila] = R[sw[col]][sw[fila]];
      e[12] = T[0]; e[13] = T[2]; e[14] = T[1]; e[15] = 1;
      if (p.poseInicial) {
        const inicio = p.poseInicial;
        return e.map((_, i) => {
          const f = i % 4, c = i - f;
          return e[f] * inicio[c] + e[4 + f] * inicio[c + 1] + e[8 + f] * inicio[c + 2] + e[12 + f] * inicio[c + 3];
        });
      }
      return e;
    }

    // Marco del rectángulo en coordenadas de mapa, también durante el balanceo.
    function marcoPanel(p, t) {
      if (!p.pivote) return { o: p.origen, u: p.tangente, h: vertical, n: p.normal };
      const M = matrizPieza(p, t), o = transformar(M, p.origen);
      const vector = (u, h, d) => diferencia(transformar(M, puntoPanel(p, u, h, d)), o);
      return { o, u: vector(1, 0, 0), h: vector(0, 1, 0), n: vector(0, 0, 1) };
    }
    function caerPanel(p, t) {
      const marco = marcoPanel(p, t);
      if (p.estado === "cuelga") p.poseInicial = matrizPieza(p, t);
      const l = Math.hypot(marco.n[0], marco.n[1]);
      p.eje = [marco.n[1] / l, -marco.n[0] / l, 0];
      p.pivote = marco.o.map((v, i) => v + p.alto * marco.h[i]);
      p.inclinacionInicial = Math.asin(limitar(marco.n[2], -1, 1));
      p.a0 = 0; p.a1 = Math.PI / 2 - p.inclinacionInicial; p.caida = p.pivote[2];
      p.t0 = t; p.dur = Math.max(duracion(p.a1, p.alto), Math.sqrt(2 * p.caida / GRAVEDAD));
      p.anclajes = []; p.estado = "cae"; versionPaneles++; version++;
    }
    function colgarPanel(p, borde, t) {
      const izquierda = borde === "izquierdo", superior = borde === "superior";
      p.bisagra = borde;
      p.pivote = puntoPanel(p, izquierda ? 0 : superior ? p.ancho / 2 : p.ancho, superior ? p.alto : p.alto / 2);
      const signo = (p.lado === "fuera" ? -1 : 1) * (izquierda ? 1 : -1);
      p.eje = superior ? [p.normal[1], -p.normal[0], 0] : [0, 0, signo];
      // Muestreamos ambas caras a medio vóxel para incluir suelo y obstáculos en mitad de un panel grande.
      const puntos = [], nu = Math.ceil(2 * p.ancho / tam), nh = Math.ceil(2 * p.alto / tam);
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nh; j++)
        for (const d of [0, p.grosor]) puntos.push(puntoPanel(p, p.ancho * i / nu, p.alto * j / nh, d));
      const soportes = new Set(p.anclajes);
      const fin = anguloLibre(0, a => puntos.some(q => {
        const r = rotar(q, p.pivote, p.eje, a);
        return r[2] < -1e-9 || (solido(...r) && !soportes.has(K(...indice(...r))));
      }));
      p.estado = "cuelga"; p.a0 = 0; p.a1 = Math.min(BLINDAJE.anguloColgado, fin / (1 + AMPLITUD_VAIVEN));
      p.caida = 0; p.t0 = t; p.dur = duracion(p.a1, superior ? p.alto : p.ancho);
      versionPaneles++; version++;
    }
    function revisarAnclajes(t) {
      for (const p of paneles) {
        if (p.estado === "cae" || p.estado === "suelo") continue;
        p.anclajes = p.anclajes.filter(c => solidoReal(rejilla.get(...deK(c))));
        if (!p.anclajes.length) { caerPanel(p, t); continue; }
        if (p.estado === "cuelga" || p.anclajes.length * 2 >= p.iniciales) continue;
        const puntos = p.anclajes.map(c => diferencia(centro(...deK(c)), p.origen));
        let borde;
        if (puntos.every(q => producto(q, p.tangente) < p.ancho / 2)) borde = "izquierdo";
        else if (puntos.every(q => producto(q, p.tangente) >= p.ancho / 2)) borde = "derecho";
        else if (puntos.every(q => q[2] >= p.alto / 2)) borde = "superior";
        if (borde) colgarPanel(p, borde, t);
      }
    }
    // El mismo frente de onda daña la chapa y se atenúa en los rayos que la cruzaban al empezar el golpe.
    function impactoPaneles(golpe, radio, poder, t, alcanzados) {
      const pantallas = [];
      for (const p of paneles) {
        if (p.estado === "cae" || p.estado === "suelo") continue;
        const marco = marcoPanel(p, t), v = diferencia(golpe, marco.o);
        const u = producto(v, marco.u), h = producto(v, marco.h), d = producto(v, marco.n);
        const cu = limitar(u, 0, p.ancho), ch = limitar(h, 0, p.alto);
        const distancia = Math.hypot(u - cu, h - ch, Math.max(0, -d - 1e-9, d - p.grosor - 1e-9));
        if (d > 0 && Math.hypot(u - cu, h - ch, d) <= radio)
          pantallas.push({ marco, p, u, h, d });
        if (distancia >= radio) continue;
        if (p.estado === "cuelga") { caerPanel(p, t); alcanzados.push(p.id); continue; }
        const energia = poder * (1 - distancia / radio);
        if (energia <= BLINDAJE.resistencia) continue;
        alcanzados.push(p.id); p.dano += energia; version++;
        if (p.dano >= BLINDAJE.aguante / 2) {
          p.abolladura = { u: cu, h: ch, profundidad: p.grosor * BLINDAJE.fraccionAbolladuraMaxima * Math.min(1, p.dano / BLINDAJE.aguante) };
          p.estado = "abollado"; versionPaneles++;
        }
        if (p.dano >= BLINDAJE.aguante) caerPanel(p, t);
      }
      return pantallas;
    }
    function protegido(c, pantallas) {
      return pantallas.some(({ marco, p, u, h, d }) => {
        const v = diferencia(c, marco.o), fondo = producto(v, marco.n);
        if (fondo > 0) return false;
        const f = d / (d - fondo), interU = u + f * (producto(v, marco.u) - u), interH = h + f * (producto(v, marco.h) - h);
        return interU >= 0 && interU <= p.ancho && interH >= 0 && interH <= p.alto;
      });
    }
    // Una pieza que termina de caer vuelve a la rejilla como escombro, en la celda de su pose final (sin hundirse).
    function asentar(p) {
      const piv = p.pivote, celdas = [];
      for (let n = 0; n < p.vox.length; n += 4) {
        const c = centro(p.vox[n], p.vox[n + 1], p.vox[n + 2]), P = p.a1 ? rotar(c, piv, p.eje, p.a1) : c;
        const [i, j, k] = indice(P[0], P[1], P[2] - p.caida);
        celdas.push([i, j, k, p.vox[n + 3]]);
      }
      celdas.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
      for (const [i, j, k0, m] of celdas) { let k = Math.max(k0, kSuelo); while (rejilla.get(i, j, k)) k++; rejilla.set(i, j, k, aEscombro(m)); }
      piezas.splice(piezas.indexOf(p), 1);
      version++;
    }
    // Avanza el tiempo de la destrucción: asienta lo que ya terminó de caer. Devuelve los ids asentados.
    function paso(t) {
      const listas = piezas.filter(p => p.estado === "cae" && t >= p.t0 + p.dur).map(p => p.id);
      for (const id of listas) asentar(piezas.find(p => p.id === id));
      for (const p of paneles) if (p.estado === "cae" && t >= p.t0 + p.dur) {
        p.poseFinal = matrizPieza(p, p.t0 + p.dur); p.estado = "suelo"; listas.push(p.id);
        versionPaneles++; version++;
      }
      return listas;
    }
    // Suelta una pieza colgada: sigue girando sobre su bisagra hasta tocar algo.
    function soltar(p, t) {
      const a = pose(p, t).angulo;
      unionesSueltas++;
      p.estado = "cae"; p.t0 = t; p.a0 = a;
      p.a1 = anguloFinal(p.vox, p.pivote, p.eje, a, new Set());
      p.dur = duracion(p.a1 - a, p.radio);
    }
    // Restos que lanza la onda: una parte de lo roto cae lejos del centro y se amontona.
    function lanzar(lista, golpe, radio, poder, fraccion) {
      let n = 0;
      for (let q = 0; q < lista.length; q += 4) {
        const i = lista[q], j = lista[q + 1], k = lista[q + 2], m = lista[q + 3];
        if (hash3(i, j, k) >= fraccion) continue;
        const c = centro(i, j, k), h = hash3(i + 7, j - 3, k + 11);
        let dx = c[0] - golpe[0], dy = c[1] - golpe[1], L = Math.hypot(dx, dy);
        if (L < 1e-6) { const a = hash3(j, k, i) * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); L = 1; }
        const d = poder * radio * (.6 + 1.6 * h), [ti, tj] = indice(c[0] + dx / L * d, c[1] + dy / L * d, 0);
        let kk = Math.max(k, kSuelo);
        while (rejilla.get(ti, tj, kk)) kk++;
        while (kk > kSuelo && !rejilla.get(ti, tj, kk - 1)) kk--;
        rejilla.set(ti, tj, kk, aEscombro(m)); n++;
      }
      return n;
    }

    // Golpe: energía = poder · (1 − d/radio) en el centro de cada vóxel; cae si supera la resistencia de su material.
    // op: t (tiempo de la simulación), escombros (fracción de lo roto que lanza la onda), derrumbe (calcular apoyos).
    function romper(x, y, z, radio, poder = 1, op = {}) {
      const t = op.t ?? 0, fraccion = op.escombros ?? .35, golpe = [x, y, z];
      const [i0, i1] = rango(x - radio, x + radio, origen[0]), [j0, j1] = rango(y - radio, y + radio, origen[1]), [k0, k1] = rango(z - radio, z + radio, origen[2]);
      const alcanzados = [], quitados = [];
      const pantallas = impactoPaneles(golpe, radio, poder, t, alcanzados);
      for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
        const m = rejilla.get(i, j, k);
        if (!m) continue;
        const [cx, cy, cz] = centro(i, j, k), d = Math.hypot(cx - x, cy - y, cz - z);
        if (d >= radio) continue;
        const energia = poder * (1 - d / radio);
        if (energia <= MATERIALES[m].resistencia || (pantallas.length && protegido([cx, cy, cz], pantallas) &&
          energia * (1 - BLINDAJE.absorcion) <= MATERIALES[m].resistencia)) continue;
        rejilla.set(i, j, k, 0); quitados.push(i, j, k, m);
      }
      const escombros = fraccion > 0 ? lanzar(quitados, golpe, radio, poder, fraccion) : 0;
      // Las piezas colgadas caen si el golpe las alcanza o si pierden su unión (también si la unión acaba de soltarse).
      const previas = new Set(piezas.map(p => p.id)), sueltas = [];
      const nuevas = op.derrumbe === false ? [] : derrumbar(t, golpe);
      if (op.derrumbe === false) revisarAnclajes(t);
      for (const p of piezas) {
        if (p.estado !== "cuelga" || !previas.has(p.id)) continue;
        const alcanzada = Math.hypot(p.centro[0] - x, p.centro[1] - y, p.centro[2] - z) < radio + p.radio;
        const sinUnion = p.soportes.some(c => !rejilla.get(...deK(c)));
        if (alcanzada || sinUnion) { soltar(p, t); sueltas.push(p.id); }
      }
      if (quitados.length || escombros || sueltas.length) version++;
      return { quitados: quitados.length / 4, lista: quitados, escombros, piezas: nuevas, sueltas, paneles: alcanzados };
    }
    // Reparar: volver a planear las paredes (todas o una); solo entran los vóxeles vacíos.
    function reparar(idPared) {
      const lista = idPared == null ? paredes.map(p => p.id) : [idPared];
      return lista.map(id => planear(id)).filter(o => o.total);
    }

    // Banda contigua para una capa nueva sobre un eje, y la altura que ya tiene la muralla.
    function capa(nombreEje, lado = "fuera", grosor = 1) {
      const ps = paredes.filter(p => p.eje === nombreEje);
      if (!ps.length) throw new Error(`El eje «${nombreEje}» no tiene paredes.`);
      const sMin = Math.min(...ps.map(p => p.s0)), sMax = Math.max(...ps.map(p => p.s1));
      const z0 = Math.min(...ps.map(p => p.z0)), z1 = Math.max(...ps.map(p => p.z1));
      return lado === "dentro" ? { eje: nombreEje, s0: sMin - grosor, s1: sMin, z0, z1 } : { eje: nombreEje, s0: sMax, s1: sMax + grosor, z0, z1 };
    }
    function hilada(nombreEje, alto = 1) {
      const ps = paredes.filter(p => p.eje === nombreEje);
      if (!ps.length) throw new Error(`El eje «${nombreEje}» no tiene paredes.`);
      const z0 = Math.max(...ps.map(p => p.z1));
      return { eje: nombreEje, s0: Math.min(...ps.map(p => p.s0)), s1: Math.max(...ps.map(p => p.s1)), z0, z1: z0 + alto };
    }
    // Ampliar: añade un punto al final del eje y planea el tramo nuevo de cada pared que llegaba hasta el final.
    function ampliar(nombreEje, punto) {
      const pts = ejes[nombreEje];
      if (!pts) throw new Error(`No existe el eje «${nombreEje}».`);
      const antes = largoDe(pts);
      pts.push([+punto[0], +punto[1]]); invalidarVolumen(); version++;
      return paredes.filter(p => p.eje === nombreEje && p.u1 == null).map(p => planear(p.id, { u0: antes })).filter(o => o.total);
    }

    // Consultas para las demás piezas del juego (torretas sobre la muralla, plano 2D, colisiones).
    function solido(x, y, z) { const [i, j, k] = indice(x, y, z); return rejilla.get(i, j, k); }
    function columna(i, j) {
      let kMax = -Infinity, kMin = Infinity;
      for (const c of rejilla.claves()) { const t = rejilla.trozo(c); if (t.n && t.ci === i >> 4 && t.cj === j >> 4) { kMax = Math.max(kMax, t.ck * LADO + MASC); kMin = Math.min(kMin, t.ck * LADO); } }
      for (let k = kMax; k >= kMin; k--) { const m = rejilla.get(i, j, k); if (m) return { k, m }; }
      return null;
    }
    // Altura (m) de la cara superior de la muralla en (x, y), o null si no hay muralla.
    function altoEn(x, y) { const [i, j] = indice(x, y, 0), c = columna(i, j); return c ? origen[2] + (c.k + 1) * tam : null; }
    // Huella para el plano 2D: el vóxel más alto de cada columna.
    function huella() {
      const cols = new Map();
      rejilla.recorrer((i, j, k, m) => { const c = i * 65536 + j, h = cols.get(c); if (!h || k > h.k) cols.set(c, { i, j, k, m }); });
      return [...cols.values()].map(h => ({ x: origen[0] + h.i * tam, y: origen[1] + h.j * tam, lado: tam, alto: origen[2] + (h.k + 1) * tam, material: h.m }));
    }

    function serializar() {
      const copia = datos => JSON.parse(JSON.stringify(datos));
      function guardarObra(o) {
        if (o.tipo === "blindaje") return copia({ ...o, lista: o.lista.slice(o.sig), sig: 0 });
        return { id: o.id, pared: o.pared, material: o.material, hechos: o.hechos, lista: Array.from(o.lista.subarray(o.sig)) };
      }
      return {
        formato: "cmg-muralla", v: 3, tam, origen: origen.slice(), sigId,
        ejes: copia(ejes), paredes: copia(paredes),
        paneles: copia(paneles), obras: obras.map(guardarObra),
        trozos: rejilla.exportar(),
        piezas: piezas.map(q => ({ ...q, vox: Array.from(q.vox) })),
      };
    }
    function estadisticas() {
      const estados = { fijo: 0, abollado: 0, cuelga: 0, cae: 0, suelo: 0 };
      for (const p of paneles) estados[p.estado]++;
      return { paneles: estados, voxeles: rejilla.total, planeados: plano.total, trozos: rejilla.numTrozos, obras: obras.length, paredes: paredes.length, piezas: piezas.length, version };
    }

    const m = {
      tam, origen, rejilla, plano, ejes, paredes, obras, piezas, paneles, blindar,
      get versionPaneles() { return versionPaneles; },
      get versionPlanoPaneles() { return versionPlanoPaneles; },
      eje, pared, planear, avanzar, completar, construir, cancelar, romper, reparar, capa, hilada, ampliar,
      apoyo, tension, derrumbar, paso, pose, matrizPieza,
      get versionTension() { return versionTension(); },
      get revisionVolumen() { return revisionVolumen; },
      enPared, indice, centro, solido, altoEn, huella, serializar, estadisticas,
      largo: (nombre) => largoDe(ejes[nombre]),
      obrasResumen: () => obras.map(resumenObra),
      get version() { return version; },
      _cargar(d) {
        const copia = datos => JSON.parse(JSON.stringify(datos));
        paneles.push(...copia(d.paneles || []));
        Object.assign(ejes, d.ejes); paredes.push(...d.paredes); sigId = d.sigId;
        invalidarVolumen();
        rejilla.importar(d.trozos);
        for (const q of d.piezas || []) piezas.push({ ...q, vox: Int32Array.from(q.vox) });
        for (const o of d.obras) {
          if (o.tipo === "blindaje") { obras.push(copia(o)); continue; }
          const ob = { id: o.id, pared: o.pared, material: o.material, hechos: o.hechos, lista: Int32Array.from(o.lista), sig: 0 };
          obras.push(ob);
          for (let n = 0; n < ob.lista.length; n += 3) if (!solidoReal(rejilla.get(ob.lista[n], ob.lista[n + 1], ob.lista[n + 2]))) plano.set(ob.lista[n], ob.lista[n + 1], ob.lista[n + 2], ob.material);
        }
        version++;
      },
    };
    return m;
  }
  function cargar(datos) {
    if (!datos || datos.formato !== "cmg-muralla" || ![1, 2, 3].includes(datos.v)) throw new Error("Formato de muralla desconocido.");
    const m = crear({ tam: datos.tam, origen: datos.origen });
    m._cargar(datos);
    return m;
  }

  // ---------- Malla ----------
  // Caras visibles (con vecino vacío) de un trozo, con oclusión ambiental por vértice. Posiciones en coordenadas de Three.
  // Ejes de la «celda Three»: a0 = i (X), a1 = k (Y), a2 = j (Z).
  const CARAS = [];
  for (let na = 0; na < 3; na++) for (const sg of [1, -1]) {
    const ta = (na + 1) % 3, tb = (na + 2) % 3, esq = sg > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
    CARAS.push({ na, sg, ta, tb, esq, normal: [0, 1, 2].map(a => a === na ? sg : 0) });
  }
  const AO = [.5, .68, .84, 1];
  const MEZCLA_TENSION = [0, .16, .30, .45, .60];
  function colorConTension(base, alerta, nivel) {
    const mezcla = MEZCLA_TENSION[nivel], brillo = 1 - .03 * nivel;
    return base.map((v, canal) => (v + (alerta[canal] - v) * mezcla) * brillo);
  }

  function colorDe(hex) { return [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255]; }
  const paletaBase = () => MATERIALES.map(m => m ? { color: colorDe(m.color), variacion: m.variacion } : null);

  function mallar(rejilla, clave, op = {}) {
    const t = rejilla.trozo(clave), tam = op.tam || .5, o = op.origen || [0, 0, 0], ao = op.ao !== false;
    const paleta = op.paleta || paletaBase(), fijo = op.color ? colorDe(op.color) : null;
    const alerta = colorDe(paleta.colorTension ?? 0xd8452f);
    const pos = [], nor = [], col = [], ind = [], materiales = [], rotura = [];
    let deformada = false;
    if (!t || !t.n) return { posiciones: new Float32Array(0), normales: new Float32Array(0), colores: new Float32Array(0), indices: new Uint32Array(0), materiales: new Uint8Array(0), rotura: new Uint8Array(0), deformada, caras: 0 };
    const bi = t.ci * LADO, bj = t.cj * LADO, bk = t.ck * LADO, d = t.d;
    // Vecino en coordenadas de celda Three (a0 = i, a1 = k, a2 = j).
    const g = (a0, a1, a2) => {
      const li = a0 - bi, lj = a2 - bj, lk = a1 - bk;
      if (li >= 0 && li < LADO && lj >= 0 && lj < LADO && lk >= 0 && lk < LADO) return d[li | lj << 4 | lk << 8];
      return rejilla.get(a0, a2, a1);
    };
    const bordes = op.rotura !== false, enPared = op.enPared || rejilla.enPared;
    // Índices locales de vértice 0..16, también en los tres cantos positivos.
    const ladoVertices = LADO + 1;
    const tiposVertice = bordes ? new Int8Array(ladoVertices ** 3).fill(-1) : null;
    function tipoVertice(x, y, z) {
      const id = x - bi + ladoVertices * (y - bk + ladoVertices * (z - bj));
      if (tiposVertice[id] >= 0) return tiposVertice[id];
      let pared = false, cascajo = false, hueco = false;
      for (let dx = -1; dx <= 0; dx++) for (let dy = -1; dy <= 0; dy++) for (let dz = -1; dz <= 0; dz++) {
        const m = g(x + dx, y + dy, z + dz);
        if (esEscombro(m)) cascajo = true;
        else if (m) pared = true;
        else if (!hueco && enPared) hueco = enPared(x + dx, z + dz, y + dy);
      }
      // La pared manda en el contacto: sigue su propio borde o se queda plana.
      return tiposVertice[id] = pared ? (hueco ? 1 : 0) : (cascajo ? 2 : 0);
    }
    const a = [0, 0, 0], v = [0, 0, 0], q = [0, 0, 0];
    for (let idx = 0; idx < L3; idx++) {
      const m = d[idx];
      if (!m) continue;
      const i = bi + (idx & MASC), j = bj + (idx >> 4 & MASC), k = bk + (idx >> 8);
      a[0] = i; a[1] = k; a[2] = j;
      let base;
      if (fijo) base = fijo;
      else { const p = paleta[m] || paleta[1], f = 1 + p.variacion * (hash3(i, j, k) * 2 - 1); base = [p.color[0] * f, p.color[1] * f, p.color[2] * f]; }
      if (op.tension && !esEscombro(m)) {
        const nivel = op.tension(i, j, k);
        if (nivel) base = colorConTension(base, alerta, nivel);
      }
      for (const c of CARAS) {
        q[0] = a[0]; q[1] = a[1]; q[2] = a[2]; q[c.na] += c.sg;
        if (g(q[0], q[1], q[2])) continue;
        const n0 = pos.length / 3, aos = [];
        const partida = bordes && enPared && enPared(q[0], q[2], q[1]) ? 1 : 0;
        let movida = false;
        for (const [ea, eb] of c.esq) {
          v[0] = a[0]; v[1] = a[1]; v[2] = a[2];
          if (c.sg > 0) v[c.na] += 1;
          v[c.ta] += ea; v[c.tb] += eb;
          let x = o[0] + v[0] * tam, y = o[2] + v[1] * tam, z = o[1] + v[2] * tam;
          const tipo = bordes && tipoVertice(v[0], v[1], v[2]);
          if (tipo) {
            const radio = tam * (tipo === 2 ? BORDE_CASCAJO : BORDE_ROTURA);
            x += radio * (2 * hash3(v[0] + 71, v[2], v[1]) - 1);
            y += radio * (2 * hash3(v[0], v[2], v[1] + 53) - 1);
            z += radio * (2 * hash3(v[0], v[2] + 97, v[1]) - 1);
            movida = deformada = true;
          }
          pos.push(x, y, z);
          rotura.push(partida);
          nor.push(c.normal[0], c.normal[1], c.normal[2]);
          materiales.push(m);
          let nivel = 3;
          if (ao) {
            const da = ea ? 1 : -1, db = eb ? 1 : -1;
            const w = [q[0], q[1], q[2]], s1 = w.slice(), s2 = w.slice(), cc = w.slice();
            s1[c.ta] += da; s2[c.tb] += db; cc[c.ta] += da; cc[c.tb] += db;
            const A = g(s1[0], s1[1], s1[2]) ? 1 : 0, B = g(s2[0], s2[1], s2[2]) ? 1 : 0, C = g(cc[0], cc[1], cc[2]) ? 1 : 0;
            nivel = A && B ? 0 : 3 - (A + B + C);
          }
          aos.push(nivel);
          const f = AO[nivel];
          col.push(base[0] * f, base[1] * f, base[2] * f);
        }
        if (movida) {
          // Producto de las diagonales: suma de las normales de los dos triángulos ponderadas por área.
          const p = n0 * 3;
          const ax = pos[p + 6] - pos[p], ay = pos[p + 7] - pos[p + 1], az = pos[p + 8] - pos[p + 2];
          const bx = pos[p + 9] - pos[p + 3], by = pos[p + 10] - pos[p + 4], bz = pos[p + 11] - pos[p + 5];
          const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
          const largo = Math.hypot(nx, ny, nz);
          for (let n = p; n < p + 12; n += 3) {
            nor[n] = nx / largo; nor[n + 1] = ny / largo; nor[n + 2] = nz / largo;
          }
        }
        if (aos[0] + aos[2] < aos[1] + aos[3]) ind.push(n0 + 1, n0 + 2, n0 + 3, n0 + 1, n0 + 3, n0);
        else ind.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
      }
    }
    return { posiciones: new Float32Array(pos), normales: new Float32Array(nor), colores: new Float32Array(col), indices: new Uint32Array(ind), materiales: new Uint8Array(materiales), rotura: new Uint8Array(rotura), deformada, caras: ind.length / 6 };
  }

  const api = { crear, cargar, crearRejilla, mallar, proyectar, largoDe, hash3, claveDe, deClave, K, deK, esEscombro, aEscombro, MATERIALES, MAT, LADO, TRAMO_OBRA, BLINDAJE, paletaBase, colorDe, colorConTension, puntoPanel };
  if (typeof window !== "undefined") window.CMGMuralla = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
