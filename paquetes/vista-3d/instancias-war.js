/* Modelos y lotes de War. Three r180 inyectado; solo consume la escena visible. */
export function enemigoMesh(THREE, G, M, L, TIPOS, e) {
  const mesh = (g, m) => new THREE.Mesh(g, m);
  const g = new THREE.Group(); g.userData.id = e.id;
  const tp = TIPOS[e.tipo], mat = tp.frio ? M.frio : M.enemigo;
  if (tp.suelo) {
    const cuerpo = mesh(G.caja(.82, .4, .6), mat); cuerpo.position.y = .3;
    const o1 = mesh(G.caja(.9, .2, .14), M.borde); o1.position.set(0, .1, .3);
    const o2 = o1.clone(); o2.position.z = -.3;
    g.add(cuerpo, o1, o2);
    return { grupo: g, cuerpo, mat };
  }
  const cuerpo = mesh(G.esfera, mat); cuerpo.scale.setScalar(.22);
  const brazo1 = mesh(G.caja(.85, .04, .06), M.borde), brazo2 = brazo1.clone(); brazo2.rotation.y = Math.PI / 2;
  const rotores = [[.4, 0], [-.4, 0], [0, .4], [0, -.4]].map(([x, z]) => { const r = mesh(G.rotor, M.borde); r.position.set(x, .06, z); return r; });
  const cuerpoG = new THREE.Group(); cuerpoG.add(cuerpo, brazo1, brazo2, ...rotores);
  const sombra = mesh(G.disco, M.sombra); sombra.rotation.x = -Math.PI / 2; sombra.scale.setScalar(.36); sombra.position.y = .02;
  const alt = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]), L.altura);
  alt.computeLineDistances();
  g.add(cuerpoG, sombra, alt);
  return { grupo: g, cuerpo, cuerpoG, sombra, alt, rotores, mat };
}

export function posMisil(mi, t) {
  const u = Math.min(1, Math.max(0, (t - mi.t0) / mi.dur));
  return [mi.x0 + (mi.x1 - mi.x0) * u, mi.z0 + (mi.z1 - mi.z0) * u + mi.arco * 4 * u * (1 - u), mi.y0 + (mi.y1 - mi.y0) * u];
}

// Una tabla por pareja geometría/material. Los modelos sueltos son también el patrón
// de matrices: conservar su jerarquía evita duplicar las fórmulas de brazos/rotores.
export function crearInstanciasWar({ THREE, G, M, L, TIPOS, movil, alturaSuelo = undefined }) {
  const tiposModelo = { suelo: { suelo: true }, aire: { suelo: false } };
  const modelos = ['suelo', 'aire'].map(tipo => enemigoMesh(THREE, G, M, L, tiposModelo, { tipo }));
  const propias = new Set();
  for (const o of modelos) o.grupo.traverse(n => {
    if (n.geometry && !Object.values(G).includes(n.geometry)) propias.add(n.geometry);
  });
  const lotes = new Map(), alturas = new Map(), estelas = new Map();
  const bola = new THREE.Object3D(); bola.scale.setScalar(.12);
  let destruida = false;

  function reservar(lote, capacidad) {
    const anterior = lote.mesh;
    const m = new THREE.InstancedMesh(lote.geometria, lote.material, capacidad);
    m.name = 'War instancias'; m.count = 0; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.userData.ids = [];
    if (anterior) {
      m.instanceMatrix.array.set(anterior.instanceMatrix.array);
      m.userData.ids.push(...anterior.userData.ids);
      movil.remove(anterior); anterior.dispose();
    }
    movil.add(m); lote.mesh = m; lote.capacidad = capacidad; lote.cambio = true;
  }
  function poner(geometria, material, matriz, id = undefined) {
    const clave = `${geometria.uuid}/${material.uuid}`;
    let lote = lotes.get(clave);
    if (!lote) {
      lote = { geometria, material, mesh: null, capacidad: 0, usados: 0, cambio: false };
      lotes.set(clave, lote); reservar(lote, 1);
    }
    const i = lote.usados++;
    if (i >= lote.capacidad) reservar(lote, lote.capacidad * 2);
    const arr = lote.mesh.instanceMatrix.array, elementos = matriz.elements;
    let cambio = false;
    for (let k = 0; k < 16; k++) if (arr[i * 16 + k] !== Math.fround(elementos[k])) { cambio = true; break; }
    if (cambio) { lote.mesh.setMatrixAt(i, matriz); lote.cambio = true; }
    lote.mesh.userData.ids[i] = id;
  }
  function retirarMuertas(tabla, vivos, liberarGeometria) {
    for (const [id, linea] of tabla) if (!vivos.has(id)) {
      movil.remove(linea);
      if (liberarGeometria) linea.geometry.dispose();
      tabla.delete(id);
    }
  }
  function actualizar(escena, off, ahora) {
    if (destruida) return;
    for (const lote of lotes.values()) { lote.usados = 0; lote.cambio = false; }
    const vivos = new Set(), enVuelo = new Set(), t = escena.t + off;
    for (const e of escena.enemigos) {
      vivos.add(e.id);
      const tp = TIPOS[e.tipo], o = modelos[tp.suelo ? 0 : 1];
      o.grupo.position.set(e.x + e.vx * off, 0, e.y + e.vy * off);
      if (alturaSuelo) o.grupo.position.y = alturaSuelo(o.grupo.position.x, o.grupo.position.z);
      o.cuerpo.material = escena.t - e.golpeT < .25 ? M.golpe : tp.frio ? M.frio : M.enemigo;
      if (o.cuerpoG) {
        o.cuerpoG.position.y = e.z;
        for (const r of o.rotores) r.rotation.y = ahora / 40;
        let alt = alturas.get(e.id);
        if (!alt) { alt = new THREE.Line(o.alt.geometry, L.altura); alt.userData.id = e.id; alturas.set(e.id, alt); movil.add(alt); }
        alt.position.copy(o.grupo.position); alt.scale.set(1, e.z, 1);
        alt.frustumCulled = false;
      }
      o.grupo.updateMatrixWorld(true);
      o.grupo.traverse(n => { if (n.isMesh) poner(n.geometry, n.material, n.matrixWorld, e.id); });
    }
    retirarMuertas(alturas, vivos, false);
    for (const mi of escena.misiles) {
      enVuelo.add(mi.id);
      bola.position.set(...posMisil(mi, t)); bola.updateMatrix();
      poner(G.esfera, M.misil, bola.matrix);
      let estela = estelas.get(mi.id);
      if (!estela) {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
        estela = new THREE.Line(g, L.estela); estela.frustumCulled = false;
        estelas.set(mi.id, estela); movil.add(estela);
      }
      const atributo = estela.geometry.attributes.position, arr = atributo.array;
      let cambio = false;
      for (let k = 0; k < 10; k++) {
        const p = posMisil(mi, t - k * .03);
        for (let j = 0; j < 3; j++) {
          const v = Math.fround(p[j]);
          if (arr[k * 3 + j] !== v) { arr[k * 3 + j] = v; cambio = true; }
        }
      }
      if (cambio) atributo.needsUpdate = true;
    }
    retirarMuertas(estelas, enVuelo, true);
    for (const lote of lotes.values()) {
      const m = lote.mesh;
      m.count = lote.usados; m.visible = m.count > 0; m.userData.ids.length = m.count;
      if (lote.cambio) {
        m.instanceMatrix.needsUpdate = true;
        // Three recalcula la esfera al siguiente raycast de las instancias móviles.
        m.boundingSphere = null;
      }
    }
  }
  function destruir() {
    if (destruida) return;
    destruida = true;
    for (const lote of lotes.values()) { movil.remove(lote.mesh); lote.mesh.dispose(); }
    for (const alt of alturas.values()) movil.remove(alt);
    for (const estela of estelas.values()) { movil.remove(estela); estela.geometry.dispose(); }
    for (const g of propias) g.dispose();
    lotes.clear(); alturas.clear(); estelas.clear(); propias.clear();
    // Materiales y geometrías de G pertenecen al visor; no son clones del lote.
  }
  return { actualizar, destruir };
}

// Las piezas de una misma unidad (incluida sombra/altura) devuelven el mismo id.
export function idDeImpacto(hit) {
  if (hit.instanceId != null) return hit.object.userData.ids?.[hit.instanceId] ?? null;
  let o = hit.object;
  while (o && !o.userData.id) o = o.parent;
  return o?.userData.id ?? null;
}
