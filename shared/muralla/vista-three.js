/* Code Battle Lite · muralla de vóxeles en Three.js (r128). Necesita shared/muralla/voxeles.js.
 * Una malla por trozo de 16³; `actualizar()` solo rehace los trozos que cambiaron.
 * El plano (lo que falta por construir) va en otra malla translúcida que no escribe profundidad.
 * Las piezas que cuelgan o caen son mallas propias que se mueven con `matrizPieza(p, t)`: `actualizar(t)` con el
 * tiempo de la simulación (más la interpolación del fotograma). No se rehace su geometría mientras se mueven.
 * `seleccionable: false` quita el raycast, como los demás adornos de Campaign. */
(() => {
  "use strict";
  const PROFUNDIDAD_GOLPE = .12, DIVISIONES_GOLPE = 8;
  // En cada canto, el candidato más cercano al impacto. El id desempata las esquinas simétricas.
  function remachePerdido(p) {
    const u = p.abolladura.u / p.ancho, h = p.abolladura.h / p.alto;
    let mejor = Infinity, id = 0;
    const primero = Math.floor(window.CMGMuralla.hash3(p.id, 0, 0) * 4);
    for (let n = 0; n < 4; n++) {
      const canto = (primero + n) % 4, vertical = canto < 2;
      const tramo = Math.min(3, Math.floor(4 * (vertical ? h : u)));
      const borde = canto % 2 ? .95 : .05, centro = (tramo + .5) / 4;
      const d = (u - (vertical ? borde : centro)) ** 2 + (h - (vertical ? centro : borde)) ** 2;
      if (d < mejor) { mejor = d; id = 1 + canto * 4 + tramo; }
    }
    return id;
  }
  const ahora = () => typeof performance !== "undefined" ? performance.now() : 0;
  function crear(THREE, muralla, op = {}) {
    const V = window.CMGMuralla;
    const grupo = new THREE.Group(); grupo.name = "muralla-voxeles";
    let matSolido = op.material || new THREE.MeshLambertMaterial({ vertexColors: true });
    let materialPropio = !op.material;
    const matPlano = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op.opacidadPlano ?? .2, depthWrite: false });
    const solidas = new Map(), planos = new Map(), moviles = new Map();
    let paleta = op.paleta || V.paletaBase(), colorPlano = op.colorPlano ?? 0x7fa8ff, caras = 0;
    let mostrarRotura = op.rotura !== false;
    let mostrarTension = op.tension !== false, versionTension = -1, niveles;
    const nivelEn = (i, j, k) => niveles.get(V.K(i, j, k)) || 0;

    function geometria(r, solida = true) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(r.posiciones, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(r.normales, 3));
      g.setAttribute("color", new THREE.BufferAttribute(r.colores, 3));
      if (solida) g.setAttribute("material", new THREE.BufferAttribute(r.materiales, 1));
      if (r.rotura && solida) g.setAttribute("rotura", new THREE.BufferAttribute(r.rotura, 1));
      g.setIndex(new THREE.BufferAttribute(r.indices, 1));
      g.computeBoundingSphere();
      return g;
    }
    // Three calcula intersecciones en CPU. Usa la superficie lógica previa al acabado visual.
    function raycastLogico(malla, g) {
      const logica = new THREE.Mesh(g, malla.material);
      malla.raycast = function (rayo, hits) {
        const inicio = hits.length;
        logica.matrixWorld.copy(this.matrixWorld);
        logica.material = this.material;
        logica.raycast(rayo, hits);
        for (let i = inicio; i < hits.length; i++) hits[i].object = this;
      };
      malla.geometry.addEventListener("dispose", () => g.dispose());
    }
    function rejillaParaRayos(r) {
      const p = r.posiciones.slice(), o = [muralla.origen[0], muralla.origen[2], muralla.origen[1]];
      for (let i = 0; i < p.length; i++) {
        const base = o[i % 3];
        p[i] = base + Math.round((p[i] - base) / muralla.tam) * muralla.tam;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      g.setIndex(new THREE.BufferAttribute(r.indices, 1));
      return g;
    }
    function rehacer(rejilla, mapa, material, opMalla) {
      let n = 0;
      for (const clave of rejilla.tomarSucios()) {
        const vieja = mapa.get(clave);
        if (vieja) { grupo.remove(vieja); vieja.geometry.dispose(); mapa.delete(clave); }
        const r = V.mallar(rejilla, clave, { tam: muralla.tam, origen: muralla.origen, ...opMalla });
        n++;
        if (!r.caras) continue;
        const malla = new THREE.Mesh(geometria(r, material !== matPlano), material);
        malla.userData = { trozo: clave, caras: r.caras, plano: material === matPlano };
        if (op.seleccionable === false || material === matPlano) malla.raycast = () => {};
        else if (r.deformada) raycastLogico(malla, rejillaParaRayos(r));
        if (material === matPlano) malla.renderOrder = 2;
        mapa.set(clave, malla); grupo.add(malla);
      }
      return n;
    }
    // Una malla por pieza, construida una vez en su posición original; la matriz la lleva a su pose.
    function mallaPieza(p, nivelTension) {
      const r = V.crearRejilla();
      for (let n = 0; n < p.vox.length; n += 4) r.set(p.vox[n], p.vox[n + 1], p.vox[n + 2], p.vox[n + 3]);
      const tension = nivelTension ? () => nivelTension : null;
      const partes = r.claves().map(c => V.mallar(r, c, { tam: muralla.tam, origen: muralla.origen, paleta, tension, rotura: mostrarRotura, enPared: muralla.enPared })).filter(x => x.caras);
      const unir = (campo, T) => { const out = new T(partes.reduce((s, x) => s + x[campo].length, 0)); let o = 0; for (const x of partes) { out.set(x[campo], o); o += x[campo].length; } return out; };
      const ind = unir("indices", Uint32Array);
      let o = 0, base = 0;
      for (const x of partes) { for (let q = 0; q < x.indices.length; q++) ind[o + q] += base; o += x.indices.length; base += x.posiciones.length / 3; }
      const malla = new THREE.Mesh(geometria({
        posiciones: unir("posiciones", Float32Array), normales: unir("normales", Float32Array),
        colores: unir("colores", Float32Array), materiales: unir("materiales", Uint8Array), rotura: unir("rotura", Uint8Array), indices: ind
      }), matSolido);
      malla.matrixAutoUpdate = false; malla.raycast = () => {}; malla.userData = { pieza: p.id, nivelTension, revisionVolumen: muralla.revisionVolumen, rotura: mostrarRotura };
      return malla;
    }
    function moverPiezas(t) {
      const vivas = new Set();
      for (const p of muralla.piezas) {
        vivas.add(p.id);
        let malla = moviles.get(p.id);
        const nivelTension = mostrarTension && p.estado === "cuelga" ? 4 : 0;
        if (malla && (malla.userData.nivelTension !== nivelTension || malla.userData.rotura !== mostrarRotura || malla.userData.revisionVolumen !== muralla.revisionVolumen)) {
          grupo.remove(malla); malla.geometry.dispose(); malla = null;
        }
        if (!malla) { malla = mallaPieza(p, nivelTension); moviles.set(p.id, malla); grupo.add(malla); }
        malla.matrix.fromArray(muralla.matrizPieza(p, t)); malla.matrixWorldNeedsUpdate = true;
      }
      for (const [id, malla] of moviles) if (!vivas.has(id)) { grupo.remove(malla); malla.geometry.dispose(); moviles.delete(id); }
    }
    const chapasMoviles = new Map();
    let chapasFijas, planoChapas, revisionChapas = -1, revisionPlano = -1, carasPaneles = 0;
    function quitar(malla) {
      if (malla) { grupo.remove(malla); malla.geometry.dispose(); }
    }
    // Combina las cajas en un solo buffer indexado. Los rangos de triángulos conservan el panel del raycast.
    function geometriaPaneles(lista, logica = false) {
      const pos = [], nor = [], col = [], uv = [], remaches = [], ind = [], rangos = [];
      const normal = new THREE.Vector3(), vertice = new THREE.Vector3();
      for (const p of lista) {
        const dent = p.abolladura, n = dent ? (logica ? 4 : DIVISIONES_GOLPE) : 1, base = pos.length / 3;
        const caja = new THREE.BoxGeometry(p.ancho, p.alto, p.grosor, n, n, 1);
        const P = caja.attributes.position, signo = p.lado === "fuera" ? -1 : 1;
        // Una chapa ya en el suelo no avisa de nada, aunque cayera abollada.
        const nivel = mostrarTension && p.estado !== "suelo" ? (p.estado === "cuelga" ? 4 : dent ? 2 : 0) : 0;
        const color = V.colorConTension(paleta[V.MAT.acero].color, V.colorDe(paleta.colorTension ?? 0xd8452f), nivel);
        const final = p.poseFinal && new THREE.Matrix4().fromArray(p.poseFinal);
        // El guardado v3 expresa la intensidad como fracción del grosor, también en partidas antiguas.
        const maxAnterior = p.grosor * V.BLINDAJE.fraccionAbolladuraMaxima;
        const profundidad = dent && (logica ? dent.profundidad : PROFUNDIDAD_GOLPE * Math.min(1, dent.profundidad / maxAnterior));
        const perdido = dent && !logica ? remachePerdido(p) : 0;
        for (let i = 0; i < P.count; i++) {
          const u = signo * P.getX(i) + p.ancho / 2, h = P.getY(i) + p.alto / 2;
          let d = P.getZ(i) + p.grosor / 2;
          let quemado = 1;
          const frontal = d > p.grosor / 2;
          if (dent && frontal) {
            const r2 = ((u - dent.u) / p.ancho) ** 2 + ((h - dent.h) / p.alto) ** 2;
            const perfil = Math.exp(-16 * r2);
            d -= profundidad * (logica ? Math.exp(-10 * r2) : perfil);
            quemado -= .26 * perfil;
          }
          const q = V.puntoPanel(p, u, h, d);
          vertice.set(q[0], q[2], q[1]);
          if (final) vertice.applyMatrix4(final);
          P.setXYZ(i, vertice.x, vertice.y, vertice.z);
          // UV normalizada de esta chapa. El sesgo la distingue del acero histórico sin UV.
          pos.push(vertice.x, vertice.y, vertice.z);
          if (logica) uv.push(2 + u / p.ancho, h / p.alto);
          else {
            uv.push(2 + Math.min(1, Math.max(0, u / p.ancho)), Math.min(1, Math.max(0, h / p.alto)));
            remaches.push(frontal ? perdido : 0);
            col.push(color[0] * quemado, color[1] * quemado, color[2] * quemado);
          }
        }
        if (!logica) {
          caja.computeVertexNormals();
          for (let i = 0; i < P.count; i++) {
            normal.fromBufferAttribute(caja.attributes.normal, i); nor.push(normal.x, normal.y, normal.z);
          }
        }
        for (const i of caja.index.array) ind.push(i + base);
        rangos.push({ hasta: ind.length / 3, id: p.id });
        caja.dispose();
      }
      if (logica) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(ind);
        return { g, rangos };
      }
      const g = geometria({
        posiciones: Float32Array.from(pos), normales: Float32Array.from(nor), colores: Float32Array.from(col),
        materiales: new Uint8Array(pos.length / 3).fill(V.MAT.acero), indices: Uint32Array.from(ind),
      });
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute("remachePerdido", new THREE.Uint8BufferAttribute(remaches, 1));
      return { g, rangos };
    }
    function mallaPaneles(lista, plano = false) {
      if (!lista.length) return null;
      const { g, rangos } = geometriaPaneles(lista);
      const malla = new THREE.Mesh(g, plano ? matPlano : matSolido);
      malla.userData = { paneles: rangos, plano, caras: g.index.count / 6 };
      if (plano || op.seleccionable === false) malla.raycast = () => {};
      else if (lista.some(p => p.abolladura)) {
        const logica = geometriaPaneles(lista, true);
        malla.userData.panelesLogicos = logica.rangos;
        raycastLogico(malla, logica.g);
      }
      if (plano) malla.renderOrder = 2;
      grupo.add(malla);
      return malla;
    }
    function actualizarPaneles(t) {
      if (revisionPlano !== muralla.versionPlanoPaneles) {
        revisionPlano = muralla.versionPlanoPaneles;
        quitar(planoChapas);
        planoChapas = mallaPaneles(muralla.obras.filter(o => o.tipo === "blindaje").flatMap(o => o.lista.slice(o.sig)), true);
      }
      if (revisionChapas !== muralla.versionPaneles) {
        revisionChapas = muralla.versionPaneles;
        const fijas = [], activos = new Set();
        for (const p of muralla.paneles) {
          if (p.estado !== "cuelga" && p.estado !== "cae") { fijas.push(p); continue; }
          activos.add(p.id);
          let item = chapasMoviles.get(p.id);
          if (!item || item.estado !== p.estado) {
            if (item) quitar(item.malla);
            const malla = mallaPaneles([p]); malla.matrixAutoUpdate = false;
            chapasMoviles.set(p.id, { p, malla, estado: p.estado });
          }
        }
        for (const [id, item] of chapasMoviles) if (!activos.has(id)) { quitar(item.malla); chapasMoviles.delete(id); }
        quitar(chapasFijas); chapasFijas = mallaPaneles(fijas);
        carasPaneles = chapasFijas?.userData.caras || 0;
        for (const { malla } of chapasMoviles.values()) carasPaneles += malla.userData.caras;
      }
      for (const { p, malla } of chapasMoviles.values()) {
        malla.matrix.fromArray(muralla.matrizPieza(p, t)); malla.matrixWorldNeedsUpdate = true;
      }
    }
    function invalidarChapas() {
      revisionChapas = -1;
      for (const item of chapasMoviles.values()) quitar(item.malla);
      chapasMoviles.clear();
    }
    function contarCaras() { caras = 0; for (const m of solidas.values()) caras += m.userData.caras; }
    function actualizar(t = 0) {
      const t0 = ahora();
      if (mostrarTension && versionTension !== muralla.versionTension) {
        niveles = muralla.tension();
        versionTension = muralla.versionTension;
      }
      const inicioSolida = ahora();
      const a = rehacer(muralla.rejilla, solidas, matSolido, { paleta, rotura: mostrarRotura, tension: mostrarTension ? nivelEn : null });
      const msSolida = ahora() - inicioSolida;
      moverPiezas(t);
      actualizarPaneles(t);
      const b = rehacer(muralla.plano, planos, matPlano, { color: colorPlano, ao: false, rotura: false });
      if (a) contarCaras();
      return { trozos: a + b, trozosSolidos: a, msSolida, ms: ahora() - t0, caras: caras + carasPaneles };
    }
    function verPlano(si) { for (const m of planos.values()) m.visible = si; matPlano.visible = si; }
    // El llamante conserva la propiedad de los materiales que entrega a la vista.
    function ponerMaterial(nuevo) {
      if (nuevo === matSolido) return;
      if (materialPropio) matSolido.dispose();
      materialPropio = false;
      matSolido = nuevo;
      for (const malla of solidas.values()) malla.material = nuevo;
      for (const malla of moviles.values()) malla.material = nuevo;
      if (chapasFijas) chapasFijas.material = nuevo;
      for (const { malla } of chapasMoviles.values()) malla.material = nuevo;
    }
    function verRotura(si) {
      if (si === mostrarRotura) return;
      mostrarRotura = si;
      muralla.rejilla.marcarTodo();
    }
    function verTension(si) {
      if (mostrarTension === si) return;
      mostrarTension = si; invalidarChapas();
      muralla.rejilla.marcarTodo();
    }
    // Colores por piel: lista indexada por material, como V.paletaBase(); obliga a rehacer todo.
    function ponerPaleta(nueva, nuevoPlano) {
      invalidarChapas(); revisionPlano = -1;
      paleta = nueva || V.paletaBase(); if (nuevoPlano != null) colorPlano = nuevoPlano; muralla.rejilla.marcarTodo(); muralla.plano.marcarTodo();
      for (const [id, malla] of moviles) { grupo.remove(malla); malla.geometry.dispose(); moviles.delete(id); }
    }
    // Del punto de un raycast al vóxel tocado (se mete medio vóxel contra la normal).
    function voxelDe(hit) {
      if (hit.object?.userData.paneles) {
        const { x, y: z, z: y } = hit.point;
        const rangos = hit.object.userData.panelesLogicos || hit.object.userData.paneles;
        const panel = rangos.find(r => hit.faceIndex < r.hasta).id;
        return { x, y, z, indice: muralla.indice(x, y, z), panel };
      }
      const n = hit.face ? hit.face.normal : { x: 0, y: 0, z: 0 }, e = muralla.tam / 2;
      const x = hit.point.x - n.x * e, z = hit.point.y - n.y * e, y = hit.point.z - n.z * e;
      return { x, y, z, indice: muralla.indice(x, y, z) };
    }
    function liberar() {
      for (const m of [...solidas.values(), ...planos.values(), ...moviles.values()]) { grupo.remove(m); m.geometry.dispose(); }
      invalidarChapas(); quitar(chapasFijas); quitar(planoChapas);
      solidas.clear(); planos.clear(); moviles.clear();
      if (materialPropio) matSolido.dispose();
      matPlano.dispose();
    }
    muralla.rejilla.marcarTodo(); muralla.plano.marcarTodo();
    function mallas() {
      const lista = [...solidas.values()];
      if (chapasFijas) lista.push(chapasFijas);
      for (const { malla } of chapasMoviles.values()) lista.push(malla);
      return lista;
    }
    return { grupo, actualizar, verPlano, verRotura, verTension, ponerMaterial, ponerPaleta, voxelDe, liberar, mallas,
      get caras() { return caras + carasPaneles; } };
  }
  window.CMGMurallaVista = { crear };
})();
