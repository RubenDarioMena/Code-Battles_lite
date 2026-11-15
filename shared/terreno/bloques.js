/* Primitivas y edición poligonal. Unir combina mallas; no calcula una unión booleana. */
(() => {
  "use strict";
  const terreno = window.CMGTerreno;
  const MAX_VERTICES = 4096, MAX_INDICES = 24576;
  const finito = n => typeof n === "number" && Number.isFinite(n);
  const texto = (v, max) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  const vector = (v, min, max) => Array.isArray(v) && v.length === 3 && v.every(n => finito(n) && n >= min && n <= max);
  function valido(bloque) {
    if (!bloque || !texto(bloque.id, 40) || !texto(bloque.nombre, 80) || typeof bloque.color !== "string" || !/^#[0-9a-f]{6}$/i.test(bloque.color)) return false;
    if (!vector(bloque.posicion, -256, 256) || !vector(bloque.rotacion, -2 * Math.PI, 2 * Math.PI) || !vector(bloque.escala, .05, 20)) return false;
    const { vertices, indices } = bloque;
    if (!Array.isArray(vertices) || vertices.length < 9 || vertices.length % 3 || vertices.length > MAX_VERTICES * 3 || !vertices.every(v => finito(v) && Math.abs(v) <= 256)) return false;
    if (!Array.isArray(indices) || indices.length < 3 || indices.length % 3 || indices.length > MAX_INDICES || !indices.every(i => Number.isInteger(i) && i >= 0 && i < vertices.length / 3)) return false;
    for (let i = 0; i < indices.length; i += 3) {
      if (indices[i] === indices[i + 1] || indices[i] === indices[i + 2] || indices[i + 1] === indices[i + 2]) return false;
    }
    if (bloque.coloresCaras && (bloque.coloresCaras.length !== indices.length / 3 || bloque.coloresCaras.some(c => !/^#[0-9a-f]{6}$/i.test(c)))) return false;
    return true;
  }
  function lista(mapa) {
    if (mapa.bloques === undefined) return [];
    if (!Array.isArray(mapa.bloques)) throw new Error("La lista de bloques no es válida.");
    return mapa.bloques;
  }
  function nuevoId(bloques) {
    const usados = new Set(bloques.map(b => b.id.trim()));
    let numero = 1;
    while (usados.has(`bloque-${numero}`)) numero++;
    return `bloque-${numero}`;
  }
  function confirmar(mapa, bloques) {
    // La validación incluye los límites agregados y sucede antes de escribir en el mapa.
    terreno.validar({ ...mapa, bloques });
    mapa.bloques = bloques;
    if (bloques.some(b => b.coloresCaras)) mapa.version = 3;
  }
  function primitiva(tipo) {
    const base = [-2, 0, -2, 2, 0, -2, 2, 0, 2, -2, 0, 2];
    if (tipo === "plano") return { nombre: "Plano", vertices: base, indices: [0, 2, 1, 0, 3, 2] };
    if (tipo === "caja") return {
      nombre: "Caja", vertices: [...base, -2, 4, -2, 2, 4, -2, 2, 4, 2, -2, 4, 2],
      indices: [0, 1, 2, 0, 2, 3, 4, 7, 6, 4, 6, 5, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0],
    };
    if (tipo === "rampa") return {
      nombre: "Rampa", vertices: [...base, -2, 4, 2, 2, 4, 2],
      indices: [0, 1, 2, 0, 2, 3, 3, 2, 5, 3, 5, 4, 0, 3, 4, 1, 5, 2, 0, 4, 5, 0, 5, 1],
    };
    if (tipo === "cilindro") {
      const vertices = [], indices = [], lados = 16;
      for (const y of [0, 4]) for (let i = 0; i < lados; i++) {
        const angulo = i * 2 * Math.PI / lados;
        vertices.push(2 * Math.cos(angulo), y, 2 * Math.sin(angulo));
      }
      vertices.push(0, 0, 0, 0, 4, 0);
      for (let i = 0; i < lados; i++) {
        const n = (i + 1) % lados, arriba = i + lados, siguiente = n + lados;
        indices.push(32, i, n, 33, siguiente, arriba, i, arriba, siguiente, i, siguiente, n);
      }
      return { nombre: "Cilindro", vertices, indices };
    }
    throw new Error("Elige una primitiva: caja, rampa, cilindro o plano.");
  }
  function crear(mapa, tipo, { x = 16, z = 9 } = {}) {
    if (!finito(x) || !finito(z)) throw new Error("La posición del bloque debe contener números finitos.");
    const bloques = lista(mapa), modelo = primitiva(tipo);
    const bloque = {
      id: nuevoId(bloques), nombre: modelo.nombre, color: "#74828b",
      vertices: modelo.vertices, indices: modelo.indices,
      // El plano queda ligeramente separado del terreno para que ambas superficies se dibujen bien.
      posicion: [x, terreno.alturaEn(mapa, x, z) + (tipo === "plano" ? .04 : 0), z], rotacion: [0, 0, 0], escala: [1, 1, 1],
    };
    confirmar(mapa, [...bloques, bloque]);
    return bloque;
  }
  function geometria(THREE, bloque) {
    if (!valido(bloque)) throw new Error("El bloque contiene una geometría o transformación no válida.");
    let resultado = new THREE.BufferGeometry();
    resultado.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bloque.vertices), 3));
    resultado.setIndex(new THREE.BufferAttribute(new Uint16Array(bloque.indices), 1));
    if (bloque.coloresCaras) {
      const indexada = resultado; resultado = indexada.toNonIndexed(); indexada.dispose();
      const colores = new Float32Array(bloque.indices.length * 3);
      bloque.coloresCaras.forEach((hex, cara) => {
        const color = new THREE.Color(hex);
        for (let i = 0; i < 3; i++) color.toArray(colores, cara * 9 + i * 3);
      });
      resultado.setAttribute("color", new THREE.BufferAttribute(colores, 3));
    }
    resultado.computeVertexNormals(); resultado.computeBoundingBox(); resultado.computeBoundingSphere();
    return resultado;
  }
  function unir(THREE, mapa, ids) {
    if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) throw new Error("Selecciona al menos dos bloques para unir.");
    const elegidos = [...new Set(ids)], bloques = lista(mapa);
    if (elegidos.length < 2) throw new Error("Selecciona al menos dos bloques para unir.");
    const seleccion = elegidos.map(id => bloques.find(b => b.id === id));
    if (seleccion.some(b => !b || !valido(b))) throw new Error("La selección contiene un bloque ausente o no válido.");
    const vertices = [], indices = [], coloresCaras = [], punto = new THREE.Vector3();
    for (const bloque of seleccion) {
      const desplazamiento = vertices.length / 3;
      const matriz = new THREE.Matrix4().compose(
        new THREE.Vector3().fromArray(bloque.posicion),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...bloque.rotacion, "XYZ")),
        new THREE.Vector3().fromArray(bloque.escala),
      );
      for (let i = 0; i < bloque.vertices.length; i += 3) {
        punto.fromArray(bloque.vertices, i).applyMatrix4(matriz);
        vertices.push(punto.x, punto.y, punto.z);
      }
      for (const indice of bloque.indices) indices.push(indice + desplazamiento);
      coloresCaras.push(...(bloque.coloresCaras || new Array(bloque.indices.length / 3).fill(bloque.color)));
    }
    const combinado = {
      id: nuevoId(bloques), nombre: "Unión de bloques", color: seleccion[0].color,
      vertices, indices, coloresCaras, posicion: [0, 0, 0], rotacion: [0, 0, 0], escala: [1, 1, 1],
    };
    confirmar(mapa, [...bloques.filter(b => !elegidos.includes(b.id)), combinado]);
    return combinado.id;
  }
  function extruir(bloque, indiceCara, distancia) {
    if (!valido(bloque) || !Number.isInteger(indiceCara) || indiceCara < 0 || indiceCara >= bloque.indices.length / 3 || !finito(distancia)) return false;
    const d = Math.max(-8, Math.min(8, distancia));
    if (Math.abs(d) < 1e-8) return false;
    const inicio = indiceCara * 3, originales = bloque.indices.slice(inicio, inicio + 3), v = bloque.vertices;
    const [a, b, c] = originales.map(i => v.slice(i * 3, i * 3 + 3));
    const ab = b.map((n, i) => n - a[i]), ac = c.map((n, i) => n - a[i]);
    const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const longitud = Math.hypot(...normal);
    if (!finito(longitud) || longitud < 1e-10) return false;
    const vertices = v.slice(), nuevos = [];
    for (const indice of originales) {
      nuevos.push(vertices.length / 3);
      for (let eje = 0; eje < 3; eje++) vertices.push(v[indice * 3 + eje] + normal[eje] * d / longitud);
    }
    const indices = [...bloque.indices.slice(0, inicio), ...nuevos, ...bloque.indices.slice(inicio + 3)];
    for (let i = 0; i < 3; i++) {
      const n = (i + 1) % 3;
      // El mismo orden también crea las paredes de una cavidad al extruir hacia dentro.
      indices.push(originales[i], originales[n], nuevos[n], originales[i], nuevos[n], nuevos[i]);
    }
    const coloresCaras = bloque.coloresCaras ? [...bloque.coloresCaras, ...new Array(6).fill(bloque.coloresCaras[indiceCara])] : undefined;
    if (!valido({ ...bloque, vertices, indices, coloresCaras })) return false;
    if (coloresCaras) bloque.coloresCaras = coloresCaras;
    bloque.vertices = vertices; bloque.indices = indices;
    return true;
  }
  function eliminar(mapa, ids) {
    if (!Array.isArray(ids)) return false;
    const bloques = lista(mapa), restantes = bloques.filter(b => !ids.includes(b.id));
    if (restantes.length === bloques.length) return false;
    confirmar(mapa, restantes);
    return true;
  }
  terreno.BLOQUES = Object.freeze({ crear, geometria, unir, extruir, eliminar });
})();
