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
 * - Romper: quita los vóxeles de una esfera según el poder del golpe y la resistencia del material.
 *   Reparar es volver a planear las paredes: solo entran los vóxeles vacíos. */
(() => {
  "use strict";
  const LADO = 16, MASC = 15, L3 = LADO * LADO * LADO;
  const TRAMO_OBRA = 2; // metros por tramo de obra

  // Materiales provisionales del laboratorio: color, variación de tono y resistencia (0–1) frente a `romper`.
  // No son valores de juego: costes, resistencias y reparación de Campaign siguen pendientes (VISION-CAMPANA §7).
  const MATERIALES = [
    null,
    { id: "piedra", nombre: "Piedra", color: 0x85887f, variacion: .09, resistencia: .25 },
    { id: "hormigon", nombre: "Hormigón", color: 0xaaa79c, variacion: .04, resistencia: .5 },
    { id: "acero", nombre: "Acero", color: 0x5f6d78, variacion: .03, resistencia: .8 },
  ];
  const MAT = {};
  MATERIALES.forEach((m, n) => { if (m) MAT[m.id] = n; });
  const idMaterial = (m) => typeof m === "number" ? m : (MAT[m] || 1);

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
    let total = 0, ultimaClave = -1, ultimo = null;
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
    function vaciar() { for (const c of trozos.keys()) sucios.add(c); for (const t of trozos.values()) { t.d.fill(0); t.n = 0; } total = 0; }
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
      }
    }
    return {
      get, set, recorrer, vaciar, tomarSucios, marcarTodo, exportar, importar,
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

  // ---------- Muralla ----------
  function crear(op = {}) {
    const tam = op.tam || .5, origen = (op.origen || [0, 0, 0]).slice(0, 3);
    const rejilla = crearRejilla(), plano = crearRejilla();
    const ejes = {}, paredes = [], obras = [];
    let sigId = 1, version = 0;

    const indice = (x, y, z) => [Math.floor((x - origen[0]) / tam), Math.floor((y - origen[1]) / tam), Math.floor((z - origen[2]) / tam)];
    const centro = (i, j, k) => [origen[0] + (i + .5) * tam, origen[1] + (j + .5) * tam, origen[2] + (k + .5) * tam];
    // Rango de índices cuyo centro cae en [a, b) a lo largo de un eje.
    const rango = (a, b, o) => [Math.ceil((a - o) / tam - .5), Math.ceil((b - o) / tam - .5)];

    function eje(nombre, puntos) {
      if (!puntos || puntos.length < 2) throw new Error(`El eje «${nombre}» necesita al menos dos puntos.`);
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

    // Vóxeles de una pared en orden de obra: tramos de 2 m a lo largo del eje, de abajo arriba, a lo largo y de lado.
    function voxelesDe(p, filtro = {}) {
      const pts = ejes[p.eje], ext = Math.max(Math.abs(p.s0), Math.abs(p.s1)) + tam;
      const u0 = Math.max(p.u0, filtro.u0 ?? -Infinity), u1 = Math.min(p.u1 ?? Infinity, filtro.u1 ?? Infinity);
      const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
      const [i0, i1] = rango(Math.min(...xs) - ext, Math.max(...xs) + ext, origen[0]);
      const [j0, j1] = rango(Math.min(...ys) - ext, Math.max(...ys) + ext, origen[1]);
      const [k0, k1] = rango(p.z0, p.z1, origen[2]);
      const al = p.almenas, [ka0, ka1] = al ? rango(p.z1, p.z1 + al.alto, origen[2]) : [0, 0];
      const lista = [];
      for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
        const pr = proyectar(pts, origen[0] + (i + .5) * tam, origen[1] + (j + .5) * tam);
        if (pr.extremo || pr.u < u0 || pr.u >= u1) continue;
        if (pr.s >= p.s0 && pr.s < p.s1) for (let k = k0; k < k1; k++) lista.push([i, j, k, pr.u, pr.s]);
        if (al && Math.floor(pr.u / al.paso) % 2 === 0 && (al.lado === "dentro" ? pr.s >= p.s0 && pr.s < p.s0 + al.ancho : pr.s >= p.s1 - al.ancho && pr.s < p.s1))
          for (let k = ka0; k < ka1; k++) lista.push([i, j, k, pr.u, pr.s]);
      }
      lista.sort((a, b) => Math.floor(a[3] / TRAMO_OBRA) - Math.floor(b[3] / TRAMO_OBRA) || a[2] - b[2] || a[3] - b[3] || a[4] - b[4] || a[0] - b[0] || a[1] - b[1]);
      const out = new Int32Array(lista.length * 3);
      lista.forEach((v, n) => { out[n * 3] = v[0]; out[n * 3 + 1] = v[1]; out[n * 3 + 2] = v[2]; });
      return out;
    }

    // Planea una obra: una pared nueva (objeto) o una existente (id), opcionalmente solo un tramo (filtro.u0/u1).
    function planear(def, filtro) {
      const p = typeof def === "number" ? pared(def) : normalizar(def);
      if (!p) throw new Error(`No existe la pared ${def}.`);
      if (typeof def !== "number") paredes.push(p);
      const todos = voxelesDe(p, filtro), faltan = [];
      for (let n = 0; n < todos.length; n += 3) if (!rejilla.get(todos[n], todos[n + 1], todos[n + 2])) faltan.push(todos[n], todos[n + 1], todos[n + 2]);
      const obra = { id: sigId++, pared: p.id, material: p.material, lista: Int32Array.from(faltan), sig: 0, hechos: 0 };
      for (let n = 0; n < obra.lista.length; n += 3) if (!plano.get(obra.lista[n], obra.lista[n + 1], obra.lista[n + 2])) plano.set(obra.lista[n], obra.lista[n + 1], obra.lista[n + 2], p.material);
      if (obra.lista.length) obras.push(obra);
      version++;
      return resumenObra(obra);
    }
    const resumenObra = (o) => ({ id: o.id, pared: o.pared, total: o.lista.length / 3, hechos: o.hechos, pendientes: o.lista.length / 3 - o.sig / 3 });

    // Coloca hasta n vóxeles de una obra (la primera de la cola si no se indica). Saltar uno ya lleno no gasta.
    function colocarDe(obra, n, colocados) {
      let puestos = 0;
      while (obra.sig < obra.lista.length && puestos < n) {
        const i = obra.lista[obra.sig], j = obra.lista[obra.sig + 1], k = obra.lista[obra.sig + 2];
        obra.sig += 3;
        if (plano.get(i, j, k)) plano.set(i, j, k, 0);
        if (rejilla.get(i, j, k)) continue;
        rejilla.set(i, j, k, obra.material); obra.hechos++; puestos++;
        if (colocados) colocados.push(i, j, k);
      }
      return puestos;
    }
    function avanzar(n = 1) {
      const colocados = [], terminadas = [];
      let resto = n;
      while (resto > 0 && obras.length) {
        const o = obras[0];
        resto -= colocarDe(o, resto, colocados);
        if (o.sig >= o.lista.length) { obras.shift(); terminadas.push(o.id); }
      }
      if (colocados.length || terminadas.length) version++;
      return { colocados: colocados.length / 3, lista: colocados, terminadas };
    }
    function completar(idObra) {
      const n = obras.findIndex(o => o.id === idObra);
      if (n < 0) return 0;
      const puestos = colocarDe(obras[n], Infinity);
      obras.splice(n, 1); version++;
      return puestos;
    }
    function construir(def, filtro) { const o = planear(def, filtro); completar(o.id); return { ...o, hechos: o.total, pendientes: 0 }; }
    function cancelar(idObra) {
      const n = obras.findIndex(o => o.id === idObra);
      if (n < 0) return false;
      obras.splice(n, 1);
      plano.vaciar();
      for (const o of obras) for (let q = o.sig; q < o.lista.length; q += 3) if (!rejilla.get(o.lista[q], o.lista[q + 1], o.lista[q + 2])) plano.set(o.lista[q], o.lista[q + 1], o.lista[q + 2], o.material);
      version++;
      return true;
    }

    // Golpe: energía = poder · (1 − d/radio) en el centro de cada vóxel; cae si supera la resistencia de su material.
    function romper(x, y, z, radio, poder = 1) {
      const [i0, i1] = rango(x - radio, x + radio, origen[0]), [j0, j1] = rango(y - radio, y + radio, origen[1]), [k0, k1] = rango(z - radio, z + radio, origen[2]);
      const quitados = [];
      for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
        const m = rejilla.get(i, j, k);
        if (!m) continue;
        const [cx, cy, cz] = centro(i, j, k), d = Math.hypot(cx - x, cy - y, cz - z);
        if (d >= radio || poder * (1 - d / radio) <= MATERIALES[m].resistencia) continue;
        rejilla.set(i, j, k, 0); quitados.push(i, j, k, m);
      }
      if (quitados.length) version++;
      return { quitados: quitados.length / 4, lista: quitados };
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
      pts.push([+punto[0], +punto[1]]); version++;
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
      const enc = (a) => Array.from(a);
      return {
        formato: "cmg-muralla", v: 1, tam, origen: origen.slice(), sigId,
        ejes: JSON.parse(JSON.stringify(ejes)), paredes: JSON.parse(JSON.stringify(paredes)),
        obras: obras.map(o => ({ id: o.id, pared: o.pared, material: o.material, hechos: o.hechos, lista: enc(o.lista.subarray(o.sig)) })),
        trozos: rejilla.exportar(),
      };
    }
    function estadisticas() { return { voxeles: rejilla.total, planeados: plano.total, trozos: rejilla.numTrozos, obras: obras.length, paredes: paredes.length, version }; }

    const m = {
      tam, origen, rejilla, plano, ejes, paredes, obras,
      eje, pared, planear, avanzar, completar, construir, cancelar, romper, reparar, capa, hilada, ampliar,
      indice, centro, solido, altoEn, huella, serializar, estadisticas,
      largo: (nombre) => largoDe(ejes[nombre]),
      obrasResumen: () => obras.map(resumenObra),
      get version() { return version; },
      _cargar(d) {
        Object.assign(ejes, d.ejes); paredes.push(...d.paredes); sigId = d.sigId;
        rejilla.importar(d.trozos);
        for (const o of d.obras) {
          const ob = { id: o.id, pared: o.pared, material: o.material, hechos: o.hechos, lista: Int32Array.from(o.lista), sig: 0 };
          obras.push(ob);
          for (let n = 0; n < ob.lista.length; n += 3) if (!rejilla.get(ob.lista[n], ob.lista[n + 1], ob.lista[n + 2])) plano.set(ob.lista[n], ob.lista[n + 1], ob.lista[n + 2], ob.material);
        }
        version++;
      },
    };
    return m;
  }
  function cargar(datos) {
    if (!datos || datos.formato !== "cmg-muralla" || datos.v !== 1) throw new Error("Formato de muralla desconocido.");
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

  function colorDe(hex) { return [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255]; }
  const paletaBase = () => MATERIALES.map(m => m ? { color: colorDe(m.color), variacion: m.variacion } : null);

  function mallar(rejilla, clave, op = {}) {
    const t = rejilla.trozo(clave), tam = op.tam || .5, o = op.origen || [0, 0, 0], ao = op.ao !== false;
    const paleta = op.paleta || paletaBase(), fijo = op.color ? colorDe(op.color) : null;
    const pos = [], nor = [], col = [], ind = [];
    if (!t || !t.n) return { posiciones: new Float32Array(0), normales: new Float32Array(0), colores: new Float32Array(0), indices: new Uint32Array(0), caras: 0 };
    const bi = t.ci * LADO, bj = t.cj * LADO, bk = t.ck * LADO, d = t.d;
    // Vecino en coordenadas de celda Three (a0 = i, a1 = k, a2 = j).
    const g = (a0, a1, a2) => {
      const li = a0 - bi, lj = a2 - bj, lk = a1 - bk;
      if (li >= 0 && li < LADO && lj >= 0 && lj < LADO && lk >= 0 && lk < LADO) return d[li | lj << 4 | lk << 8];
      return rejilla.get(a0, a2, a1);
    };
    const a = [0, 0, 0], v = [0, 0, 0], q = [0, 0, 0];
    for (let idx = 0; idx < L3; idx++) {
      const m = d[idx];
      if (!m) continue;
      const i = bi + (idx & MASC), j = bj + (idx >> 4 & MASC), k = bk + (idx >> 8);
      a[0] = i; a[1] = k; a[2] = j;
      let base;
      if (fijo) base = fijo;
      else { const p = paleta[m] || paleta[1], f = 1 + p.variacion * (hash3(i, j, k) * 2 - 1); base = [p.color[0] * f, p.color[1] * f, p.color[2] * f]; }
      for (const c of CARAS) {
        q[0] = a[0]; q[1] = a[1]; q[2] = a[2]; q[c.na] += c.sg;
        if (g(q[0], q[1], q[2])) continue;
        const n0 = pos.length / 3, aos = [];
        for (const [ea, eb] of c.esq) {
          v[0] = a[0]; v[1] = a[1]; v[2] = a[2];
          if (c.sg > 0) v[c.na] += 1;
          v[c.ta] += ea; v[c.tb] += eb;
          pos.push(o[0] + v[0] * tam, o[2] + v[1] * tam, o[1] + v[2] * tam);
          nor.push(c.normal[0], c.normal[1], c.normal[2]);
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
        if (aos[0] + aos[2] < aos[1] + aos[3]) ind.push(n0 + 1, n0 + 2, n0 + 3, n0 + 1, n0 + 3, n0);
        else ind.push(n0, n0 + 1, n0 + 2, n0, n0 + 2, n0 + 3);
      }
    }
    return { posiciones: new Float32Array(pos), normales: new Float32Array(nor), colores: new Float32Array(col), indices: new Uint32Array(ind), caras: ind.length / 6 };
  }

  const api = { crear, cargar, crearRejilla, mallar, proyectar, largoDe, hash3, claveDe, deClave, MATERIALES, MAT, LADO, TRAMO_OBRA, paletaBase, colorDe };
  if (typeof window !== "undefined") window.CMGMuralla = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
