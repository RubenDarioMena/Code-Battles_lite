/* Formato y pinceles del terreno. No depende de Three.js ni de la simulación. */
(() => {
  "use strict";
  const COLUMNAS = 129, FILAS = 97, PASO = .5, X0 = -16, Z0 = -18;
  const TOTAL = COLUMNAS * FILAS, MIN_ALTURA = -2, MAX_ALTURA = 20;
  const PALETA = Object.freeze([
    Object.freeze({ nombre: "Hierba", color: "#527c53" }),
    Object.freeze({ nombre: "Tierra", color: "#94704c" }),
    Object.freeze({ nombre: "Roca", color: "#74828b" }),
    Object.freeze({ nombre: "Arena", color: "#c6b386" }),
  ]);
  const AGUA = Object.freeze({ nombre: "Agua", color: "#428fbb" });
  const limitar = (n, min, max) => Math.max(min, Math.min(max, n));
  const finito = n => typeof n === "number" && Number.isFinite(n);
  // El margen también mantiene planos los triángulos que llegan al campo jugable.
  const protegida = (x, z) => x >= -1 && x <= 33 && z >= -1 && z <= 19;
  const coordenadas = i => ({ x: X0 + i % COLUMNAS * PASO, z: Z0 + Math.floor(i / COLUMNAS) * PASO });
  function nombreValido(nombre) {
    if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(nombre)) {
      throw new Error("El nombre del mapa debe tener entre 1 y 80 caracteres, sin saltos de línea.");
    }
    return nombre.trim();
  }
  function textoBloque(texto, maximo, etiqueta) {
    if (typeof texto !== "string" || !texto.trim() || texto.trim().length > maximo || /[\u0000-\u001f\u007f]/.test(texto)) {
      throw new Error(`${etiqueta} debe tener entre 1 y ${maximo} caracteres, sin saltos de línea.`);
    }
    return texto.trim();
  }
  function vectorBloque(vector, minimo, maximo, etiqueta) {
    if (!Array.isArray(vector) || vector.length !== 3) throw new Error(`${etiqueta} debe contener tres números.`);
    for (const n of vector) if (!finito(n) || n < minimo || n > maximo) throw new Error(`${etiqueta} contiene un número fuera de rango.`);
    return vector.slice();
  }
  function validarBloques(bloques) {
    if (!Array.isArray(bloques) || bloques.length > 64) throw new Error("El mapa admite hasta 64 bloques.");
    const ids = new Set();
    let totalVertices = 0, totalIndices = 0;
    return Array.from(bloques, bloque => {
      if (!bloque || typeof bloque !== "object" || Array.isArray(bloque)) throw new Error("Uno de los bloques no tiene un formato válido.");
      const id = textoBloque(bloque.id, 40, "El identificador del bloque");
      const nombre = textoBloque(bloque.nombre, 80, "El nombre del bloque");
      if (ids.has(id)) throw new Error("Los identificadores de los bloques deben ser únicos.");
      ids.add(id);
      if (typeof bloque.color !== "string" || !/^#[0-9a-f]{6}$/i.test(bloque.color)) throw new Error("El color de cada bloque debe tener el formato #RRGGBB.");
      const { vertices, indices } = bloque;
      if (!Array.isArray(vertices) || vertices.length < 9 || vertices.length % 3 !== 0) throw new Error("Cada bloque necesita al menos tres vértices XYZ.");
      totalVertices += vertices.length / 3;
      if (totalVertices > 4096) throw new Error("Los bloques del mapa admiten un máximo de 4096 vértices en total.");
      for (const n of vertices) if (!finito(n) || Math.abs(n) > 256) throw new Error("Las coordenadas de los vértices deben estar entre −256 y 256.");
      if (!Array.isArray(indices) || indices.length < 3 || indices.length % 3 !== 0) throw new Error("Los índices de cada bloque deben formar triángulos.");
      totalIndices += indices.length;
      if (totalIndices > 24576) throw new Error("Los bloques del mapa admiten un máximo de 24576 índices en total.");
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i], b = indices[i + 1], c = indices[i + 2];
        if (![a, b, c].every(n => Number.isInteger(n) && n >= 0 && n < vertices.length / 3) || a === b || b === c || a === c) {
          throw new Error("Cada triángulo debe referirse a tres vértices diferentes del bloque.");
        }
      }
      return {
        id, nombre, color: bloque.color, vertices: vertices.slice(), indices: indices.slice(),
        posicion: vectorBloque(bloque.posicion, -256, 256, "La posición del bloque"),
        rotacion: vectorBloque(bloque.rotacion, -2 * Math.PI, 2 * Math.PI, "La rotación del bloque"),
        escala: vectorBloque(bloque.escala, .05, 20, "La escala del bloque"),
      };
    });
  }
  function crear({ nombre = "Valle de entrenamiento", relieve = true } = {}) {
    const mapa = {
      formato: "cbl-terreno", version: 2, nombre: nombreValido(nombre),
      columnas: COLUMNAS, filas: FILAS, paso: PASO, origen: { x: X0, z: Z0 },
      alturas: new Array(TOTAL), pesos: new Array(TOTAL * PALETA.length).fill(0),
      agua: { nivel: .35, mascara: new Array(TOTAL).fill(0) }, bloques: [],
    };
    for (let i = 0; i < TOTAL; i++) {
      const { x, z } = coordenadas(i);
      // Conos suaves y repetibles; no consumen el RNG de una partida.
      const colina = (cx, cz, radio, alto) => alto * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * radio ** 2));
      const distancia = Math.max(-1 - x, x - 33, -1 - z, z - 19, 0);
      const borde = limitar(distancia / 3, 0, 1);
      const h = relieve && !protegida(x, z)
        ? (colina(-8, -11, 5, 7) + colina(13, -13, 6, 10) + colina(39, -9, 5, 8) + colina(43, 26, 4, 3)) * borde * borde * (3 - 2 * borde)
        : 0;
      mapa.alturas[i] = limitar(h, MIN_ALTURA, MAX_ALTURA);
      const roca = limitar((h - 3) / 7, 0, .85);
      mapa.pesos[i * 4] = 1 - roca;
      mapa.pesos[i * 4 + 2] = roca;
    }
    return mapa;
  }
  function validar(dato) {
    if (!dato || typeof dato !== "object" || Array.isArray(dato) || dato.formato !== "cbl-terreno" || ![1, 2].includes(dato.version)) {
      throw new Error("El archivo no es un terreno de Code Battle Lite versión 1 o 2.");
    }
    if (dato.columnas !== COLUMNAS || dato.filas !== FILAS || dato.paso !== PASO || !dato.origen || dato.origen.x !== X0 || dato.origen.z !== Z0) {
      throw new Error("La cuadrícula debe ser de 129 × 97 muestras, con paso de 0,5 m y origen (−16, −18).");
    }
    if (!Array.isArray(dato.alturas) || dato.alturas.length !== TOTAL || !Array.isArray(dato.pesos) || dato.pesos.length !== TOTAL * 4) {
      throw new Error("El mapa tiene una cantidad de alturas o pesos incorrecta.");
    }
    const nombre = nombreValido(dato.nombre);
    let agua, bloques;
    if (dato.version === 1) {
      // Los cuatro canales originales y las claves de guardado se conservan.
      agua = { nivel: .35, mascara: new Array(TOTAL).fill(0) }; bloques = [];
    } else {
      if (!dato.agua || !finito(dato.agua.nivel) || dato.agua.nivel < MIN_ALTURA || dato.agua.nivel > MAX_ALTURA) throw new Error("El nivel del agua debe ser un número entre −2 y 20 m.");
      if (!Array.isArray(dato.agua.mascara) || dato.agua.mascara.length !== TOTAL) throw new Error("La máscara de agua debe tener una muestra por altura.");
      for (const valor of dato.agua.mascara) if (!finito(valor) || valor < 0 || valor > 1) throw new Error("La máscara de agua debe contener números entre 0 y 1.");
      agua = { nivel: dato.agua.nivel, mascara: dato.agua.mascara.slice() };
      bloques = validarBloques(dato.bloques);
    }
    for (let i = 0; i < TOTAL; i++) {
      const h = dato.alturas[i];
      if (!finito(h) || h < MIN_ALTURA || h > MAX_ALTURA) throw new Error("Las alturas deben ser números entre −2 y 20 m.");
      const { x, z } = coordenadas(i);
      if (protegida(x, z) && h !== 0) throw new Error("La zona jugable y su margen deben conservar altura cero.");
      let suma = 0;
      for (let k = 0; k < 4; k++) {
        const peso = dato.pesos[i * 4 + k];
        if (!finito(peso) || peso < 0 || peso > 1) throw new Error("Los pesos de material deben estar entre 0 y 1.");
        suma += peso;
      }
      if (Math.abs(suma - 1) > 1e-5) throw new Error("Los cuatro pesos de cada muestra deben sumar 1.");
    }
    return {
      formato: "cbl-terreno", version: 2, nombre,
      columnas: COLUMNAS, filas: FILAS, paso: PASO, origen: { x: X0, z: Z0 },
      alturas: dato.alturas.slice(), pesos: dato.pesos.slice(),
      agua, bloques,
    };
  }
  function serializar(mapa) { return JSON.stringify(validar(mapa)); }
  function alturaEn(mapa, x, z) {
    if (!finito(x) || !finito(z)) return 0;
    const u = limitar((x - X0) / PASO, 0, COLUMNAS - 1);
    const v = limitar((z - Z0) / PASO, 0, FILAS - 1);
    const c = Math.min(COLUMNAS - 2, Math.floor(u)), f = Math.min(FILAS - 2, Math.floor(v));
    const a = u - c, b = v - f, n = f * COLUMNAS + c, h = mapa.alturas;
    return h[n] * (1 - a) * (1 - b) + h[n + 1] * a * (1 - b) + h[n + COLUMNAS] * (1 - a) * b + h[n + COLUMNAS + 1] * a * b;
  }
  function aplicar(mapa, { x, z, radio = 3, fuerza = .35, presion = 1, modo = "subir", material = 0, altura = 0 } = {}) {
    if (![x, z, radio, fuerza, presion].every(finito) || radio <= 0 || radio > 64 || fuerza <= 0 || presion <= 0) return false;
    if (!["subir", "bajar", "suavizar", "aplanar", "pintar", "agua", "secar"].includes(modo)) return false;
    if (modo === "pintar" && (!Number.isInteger(material) || material < 0 || material > 3)) return false;
    if (modo === "aplanar" && !finito(altura)) return false;
    const amplitud = Math.min(4, fuerza) * limitar(presion, 0, 1);
    const c0 = Math.max(0, Math.ceil((x - radio - X0) / PASO)), c1 = Math.min(COLUMNAS - 1, Math.floor((x + radio - X0) / PASO));
    const f0 = Math.max(0, Math.ceil((z - radio - Z0) / PASO)), f1 = Math.min(FILAS - 1, Math.floor((z + radio - Z0) / PASO));
    // Un solo estado de lectura evita que el orden de recorrido incline el suavizado.
    const anteriores = modo === "suavizar" ? mapa.alturas.slice() : mapa.alturas;
    let cambio = false;
    for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) {
      const px = X0 + c * PASO, pz = Z0 + f * PASO;
      const t = 1 - Math.hypot(px - x, pz - z) / radio;
      if (t <= 0) continue;
      const mezcla = amplitud * t * t * (3 - 2 * t), i = f * COLUMNAS + c;
      if (modo === "agua" || modo === "secar") {
        const previo = mapa.agua.mascara[i], objetivo = modo === "agua" ? 1 : 0;
        const nuevo = previo + (objetivo - previo) * Math.min(1, mezcla);
        if (nuevo !== previo) { mapa.agua.mascara[i] = nuevo; cambio = true; }
        continue;
      }
      if (modo === "pintar") {
        const a = Math.min(1, mezcla);
        let suma = 0;
        for (let k = 0; k < 4; k++) {
          const n = i * 4 + k, previo = mapa.pesos[n];
          mapa.pesos[n] = previo + ((k === material ? 1 : 0) - previo) * a;
          suma += mapa.pesos[n];
          if (mapa.pesos[n] !== previo) cambio = true;
        }
        for (let k = 0; k < 4; k++) mapa.pesos[i * 4 + k] /= suma;
        continue;
      }
      if (protegida(px, pz)) continue;
      const previo = anteriores[i];
      let nuevo;
      if (modo === "subir" || modo === "bajar") nuevo = previo + (modo === "subir" ? mezcla : -mezcla);
      else {
        let objetivo = altura;
        if (modo === "suavizar") {
          let suma = 0, muestras = 0;
          for (let df = -1; df <= 1; df++) for (let dc = -1; dc <= 1; dc++) {
            if (f + df < 0 || f + df >= FILAS || c + dc < 0 || c + dc >= COLUMNAS) continue;
            suma += anteriores[(f + df) * COLUMNAS + c + dc]; muestras++;
          }
          objetivo = suma / muestras;
        }
        nuevo = previo + (limitar(objetivo, MIN_ALTURA, MAX_ALTURA) - previo) * Math.min(1, mezcla);
      }
      nuevo = limitar(nuevo, MIN_ALTURA, MAX_ALTURA);
      if (nuevo !== mapa.alturas[i]) { mapa.alturas[i] = nuevo; cambio = true; }
    }
    return cambio;
  }
  window.CMGTerreno = {
    PALETA, AGUA, crear, validar, serializar, aplicar, alturaEn,
    CLAVE_BORRADOR: "cmg-terreno:borrador-v1", CLAVE_JUEGO: "cmg-terreno:war-v1",
  };
})();
