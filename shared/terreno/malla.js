/* Adaptador de malla común a Three r128 (juego) y Three moderno (editor). */
(() => {
  "use strict";
  const terreno = window.CMGTerreno;
  function colores(THREE) {
    return terreno.PALETA.map(({ color }) => {
      const c = new THREE.Color(color);
      // Cada versión conserva la gestión de color de su visor: el juego r128
      // trabaja en su espacio legado; el editor moderno convierte hex a lineal.
      return c;
    });
  }
  function actualizarGeometria(THREE, geometria, mapa) {
    const posiciones = geometria.getAttribute("position"), color = geometria.getAttribute("color");
    const paleta = colores(THREE);
    for (let i = 0; i < mapa.alturas.length; i++) {
      posiciones.setXYZ(i, mapa.origen.x + i % mapa.columnas * mapa.paso, mapa.alturas[i], mapa.origen.z + Math.floor(i / mapa.columnas) * mapa.paso);
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < 4; k++) {
        const peso = mapa.pesos[i * 4 + k];
        r += paleta[k].r * peso; g += paleta[k].g * peso; b += paleta[k].b * peso;
      }
      color.setXYZ(i, r, g, b);
    }
    posiciones.needsUpdate = color.needsUpdate = true;
    geometria.computeVertexNormals();
    geometria.computeBoundingBox();
    geometria.computeBoundingSphere();
    return geometria;
  }
  function crearGeometria(THREE, mapa) {
    const geometria = new THREE.BufferGeometry(), total = mapa.columnas * mapa.filas;
    geometria.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    geometria.setAttribute("color", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    const indices = new (mapa.columnas * mapa.filas > 65535 ? Uint32Array : Uint16Array)((mapa.columnas - 1) * (mapa.filas - 1) * 6);
    let n = 0;
    for (let f = 0; f < mapa.filas - 1; f++) for (let c = 0; c < mapa.columnas - 1; c++) {
      const a = f * mapa.columnas + c, b = a + 1, d = a + mapa.columnas, e = d + 1;
      // Orden antihorario visto desde +Y; ambos renderizadores ven la cara superior.
      indices[n++] = a; indices[n++] = d; indices[n++] = b;
      indices[n++] = b; indices[n++] = d; indices[n++] = e;
    }
    geometria.setIndex(new THREE.BufferAttribute(indices, 1));
    return actualizarGeometria(THREE, geometria, mapa);
  }
  function actualizarGeometriaAgua(THREE, geometria, mapa) {
    const posiciones = geometria.getAttribute("position"), color = geometria.getAttribute("color");
    const c = new THREE.Color(terreno.AGUA.color), nivel = mapa.agua.nivel;
    for (let i = 0; i < mapa.alturas.length; i++) {
      posiciones.setXYZ(i, mapa.origen.x + i % mapa.columnas * mapa.paso, nivel, mapa.origen.z + Math.floor(i / mapa.columnas) * mapa.paso);
      color.setXYZW(i, c.r, c.g, c.b, mapa.alturas[i] < nivel ? mapa.agua.mascara[i] : 0);
    }
    const indices = geometria.index.array;
    let n = 0;
    const agregar = (a, b, d) => {
      if (color.getW(a) <= 0 && color.getW(b) <= 0 && color.getW(d) <= 0) return;
      indices[n++] = a; indices[n++] = b; indices[n++] = d;
    };
    for (let f = 0; f < mapa.filas - 1; f++) for (let col = 0; col < mapa.columnas - 1; col++) {
      const a = f * mapa.columnas + col, b = a + 1, d = a + mapa.columnas, e = d + 1;
      agregar(a, d, b); agregar(b, d, e);
    }
    posiciones.needsUpdate = color.needsUpdate = geometria.index.needsUpdate = true;
    // El búfer conserva capacidad fija; solo se dibujan los triángulos mojados.
    geometria.setDrawRange(0, n);
    geometria.computeBoundingBox(); geometria.computeBoundingSphere();
    return geometria;
  }
  function crearGeometriaAgua(THREE, mapa) {
    const geometria = new THREE.BufferGeometry(), total = mapa.columnas * mapa.filas;
    geometria.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    // Three r128 y moderno activan alpha de vértice con color.itemSize === 4.
    geometria.setAttribute("color", new THREE.BufferAttribute(new Float32Array(total * 4), 4));
    const normales = new Float32Array(total * 3);
    for (let i = 0; i < total; i++) normales[i * 3 + 1] = 1;
    geometria.setAttribute("normal", new THREE.BufferAttribute(normales, 3));
    geometria.setIndex(new THREE.BufferAttribute(new (mapa.columnas * mapa.filas > 65535 ? Uint32Array : Uint16Array)((mapa.columnas - 1) * (mapa.filas - 1) * 6), 1));
    return actualizarGeometriaAgua(THREE, geometria, mapa);
  }
  Object.assign(terreno, { crearGeometria, actualizarGeometria, crearGeometriaAgua, actualizarGeometriaAgua });
})();
