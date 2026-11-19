/* Code Battle Lite · muralla de vóxeles en Three.js (r128). Necesita shared/muralla/voxeles.js.
 * Una malla por trozo de 16³; `actualizar()` solo rehace los trozos que cambiaron.
 * El plano (lo que falta por construir) va en otra malla translúcida que no escribe profundidad.
 * Las piezas que cuelgan o caen son mallas propias que se mueven con `matrizPieza(p, t)`: `actualizar(t)` con el
 * tiempo de la simulación (más la interpolación del fotograma). No se rehace su geometría mientras se mueven.
 * `seleccionable: false` quita el raycast, como los demás adornos de Campaign. */
(() => {
  "use strict";
  function crear(THREE, muralla, op = {}) {
    const V = window.CMGMuralla;
    const grupo = new THREE.Group(); grupo.name = "muralla-voxeles";
    const matSolido = op.material || new THREE.MeshLambertMaterial({ vertexColors: true });
    const matPlano = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op.opacidadPlano ?? .2, depthWrite: false });
    const solidas = new Map(), planos = new Map(), moviles = new Map();
    let paleta = op.paleta || V.paletaBase(), colorPlano = op.colorPlano ?? 0x7fa8ff, caras = 0;

    function geometria(r) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(r.posiciones, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(r.normales, 3));
      g.setAttribute("color", new THREE.BufferAttribute(r.colores, 3));
      g.setIndex(new THREE.BufferAttribute(r.indices, 1));
      g.computeBoundingSphere();
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
        const malla = new THREE.Mesh(geometria(r), material);
        malla.userData = { trozo: clave, caras: r.caras, plano: material === matPlano };
        if (op.seleccionable === false || material === matPlano) malla.raycast = () => {};
        if (material === matPlano) malla.renderOrder = 2;
        mapa.set(clave, malla); grupo.add(malla);
      }
      return n;
    }
    // Una malla por pieza, construida una vez en su posición original; la matriz la lleva a su pose.
    function mallaPieza(p) {
      const r = V.crearRejilla();
      for (let n = 0; n < p.vox.length; n += 4) r.set(p.vox[n], p.vox[n + 1], p.vox[n + 2], p.vox[n + 3]);
      const partes = r.claves().map(c => V.mallar(r, c, { tam: muralla.tam, origen: muralla.origen, paleta })).filter(x => x.caras);
      const unir = (campo, T) => { const out = new T(partes.reduce((s, x) => s + x[campo].length, 0)); let o = 0; for (const x of partes) { out.set(x[campo], o); o += x[campo].length; } return out; };
      const ind = unir("indices", Uint32Array);
      let o = 0, base = 0;
      for (const x of partes) { for (let q = 0; q < x.indices.length; q++) ind[o + q] += base; o += x.indices.length; base += x.posiciones.length / 3; }
      const malla = new THREE.Mesh(geometria({ posiciones: unir("posiciones", Float32Array), normales: unir("normales", Float32Array), colores: unir("colores", Float32Array), indices: ind }), matSolido);
      malla.matrixAutoUpdate = false; malla.raycast = () => {}; malla.userData = { pieza: p.id };
      return malla;
    }
    function moverPiezas(t) {
      const vivas = new Set();
      for (const p of muralla.piezas) {
        vivas.add(p.id);
        let malla = moviles.get(p.id);
        if (!malla) { malla = mallaPieza(p); moviles.set(p.id, malla); grupo.add(malla); }
        malla.matrix.fromArray(muralla.matrizPieza(p, t)); malla.matrixWorldNeedsUpdate = true;
      }
      for (const [id, malla] of moviles) if (!vivas.has(id)) { grupo.remove(malla); malla.geometry.dispose(); moviles.delete(id); }
    }
    function contarCaras() { caras = 0; for (const m of solidas.values()) caras += m.userData.caras; }
    function actualizar(t = 0) {
      const t0 = typeof performance !== "undefined" ? performance.now() : 0;
      const a = rehacer(muralla.rejilla, solidas, matSolido, { paleta });
      moverPiezas(t);
      const b = rehacer(muralla.plano, planos, matPlano, { color: colorPlano, ao: false });
      if (a) contarCaras();
      return { trozos: a + b, ms: (typeof performance !== "undefined" ? performance.now() : 0) - t0, caras };
    }
    function verPlano(si) { for (const m of planos.values()) m.visible = si; matPlano.visible = si; }
    // Colores por piel: lista indexada por material, como V.paletaBase(); obliga a rehacer todo.
    function ponerPaleta(nueva, nuevoPlano) {
      paleta = nueva || V.paletaBase(); if (nuevoPlano != null) colorPlano = nuevoPlano; muralla.rejilla.marcarTodo(); muralla.plano.marcarTodo();
      for (const [id, malla] of moviles) { grupo.remove(malla); malla.geometry.dispose(); moviles.delete(id); }
    }
    // Del punto de un raycast al vóxel tocado (se mete medio vóxel contra la normal).
    function voxelDe(hit) {
      const n = hit.face ? hit.face.normal : { x: 0, y: 0, z: 0 }, e = muralla.tam / 2;
      const x = hit.point.x - n.x * e, z = hit.point.y - n.y * e, y = hit.point.z - n.z * e;
      return { x, y, z, indice: muralla.indice(x, y, z) };
    }
    function liberar() {
      for (const m of [...solidas.values(), ...planos.values(), ...moviles.values()]) { grupo.remove(m); m.geometry.dispose(); }
      solidas.clear(); planos.clear(); moviles.clear();
      if (!op.material) matSolido.dispose();
      matPlano.dispose();
    }
    muralla.rejilla.marcarTodo(); muralla.plano.marcarTodo();
    return { grupo, actualizar, verPlano, ponerPaleta, voxelDe, liberar, mallas: () => [...solidas.values()], get caras() { return caras; } };
  }
  window.CMGMurallaVista = { crear };
})();
