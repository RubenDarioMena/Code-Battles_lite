import { leerRig } from '../../rig/index.js';
import { crearRegistro, modelos, terrenos, urlBinario } from './modelos.js';
import { crearMateriales } from './materiales.js';

const tramo = modelos['muralla-traba-tramo'], nudo = modelos['muralla-traba-nudo'];
export const altoBastion = nudo.apoyo[1] * nudo.escala;
const anchoTramo = tramo.tam[0] * tramo.escala, medioFondo = tramo.tam[2] * tramo.escala / 2;

export function crearPaisaje(THREE, escena, renderer, cargarGLTFLoader) {
  let revisionRelieve = 0;
  const grupo = new THREE.Group(), superficies = [], alturas = new Map(), apoyos = [];
  escena.add(grupo);
  const materiales = crearMateriales(THREE, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  let loader, cerrado = false, oscuro = false;
  const recursos = new Set(), vestidos = new Set();
  const recordar = raiz => raiz.traverse(o => {
    if (!o.isMesh) return;
    recursos.add(o.geometry);
    for (const m of [].concat(o.material)) {
      recursos.add(m);
      for (const t of Object.values(m)) if (t?.isTexture) recursos.add(t);
    }
  });
  const registro = crearRegistro(async (url, ficha) => {
    loader ??= cargarGLTFLoader().then(Loader => {
      const manager = new THREE.LoadingManager();
      manager.setURLModifier(ruta => urlBinario(ruta, url));
      return new Loader(manager);
    });
    const gltf = await (await loader).loadAsync(url);
    const rig = ficha.rig && leerRig(gltf.parser.json);
    if (!cerrado) materiales.preparar(gltf.scene, !rig);
    return { raiz: gltf.scene, rig };
  }, ficha => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...ficha.tam), new THREE.MeshStandardMaterial({ color: 0xbeb092 }));
    m.position.fromArray(ficha.centroProvisional ?? [0, ficha.tam[1] / 2, 0]);
    return { raiz: new THREE.Group().add(m), rig: null };
  });
  function vestir(raiz) { vestidos.add(raiz); materiales.vestir(raiz, oscuro); }
  function quitar(raiz) { vestidos.delete(raiz); }
  function montar(id, padre, alCargar = undefined) {
    const ficha = modelos[id];
    const soporte = new THREE.Group();
    padre.add(soporte);
    registro(id).then(({ raiz, rig }) => {
      if (cerrado) {
        recordar(raiz);
        liberar();
        return;
      }
      recordar(raiz);
      if (!soporte.parent || !padre.parent) return;
      const copia = raiz.clone(true);
      copia.scale.setScalar(ficha.escala);
      copia.position.fromArray(ficha.desplazamiento).addScaledVector(new THREE.Vector3(...ficha.ancla), -ficha.escala);
      soporte.add(copia);
      vestir(copia);
      alCargar?.(copia, rig);
    });
    return soporte;
  }

  const rayo = new THREE.Raycaster(), abajo = new THREE.Vector3(0, -1, 0);
  const interseccion = ray => ray.intersectObjects(superficies, false)[0]?.point;
  function altura(x, z) {
    const ix = Math.round(x * 2), iz = Math.round(z * 2), clave = ix + '/' + iz;
    if (!alturas.has(clave)) {
      rayo.set(new THREE.Vector3(ix / 2, 60, iz / 2), abajo);
      alturas.set(clave, interseccion(rayo)?.y ?? 0);
    }
    return alturas.get(clave);
  }
  for (const id of terrenos) montar(id, grupo, copia => {
    copia.updateWorldMatrix(true, true);
    copia.traverse(o => { if (o.isMesh) superficies.push(o); });
    alturas.clear(); revisionRelieve++;
    for (const { position: p } of apoyos) p.y = altura(p.x, p.z);
  });
  function apoyar(id, x, z, giro = 0, largo = 1) {
    const o = montar(id, grupo);
    o.rotation.y = -giro;
    o.scale.x = largo;
    o.position.set(x, altura(x, z), z);
    apoyos.push(o);
    return o;
  }
  function segmento(x, z, u, v) {
    const dx = u - x, dz = v - z, longitud = Math.hypot(dx, dz);
    const n = Math.ceil(longitud / anchoTramo);
    for (let i = 0; i < n; i++) {
      const f = (i + .5) / n;
      apoyar('muralla-traba-tramo', x + f * dx, z + f * dz, Math.atan2(dz, dx), longitud / (n * anchoTramo));
    }
  }
  async function muralla(puertas) {
    let puntos;
    try {
      const r = await fetch(new URL('../../../arte/blender/papercraft/mapa-ampliado.json', import.meta.url));
      if (!r.ok) throw Error(String(r.status));
      puntos = (await r.json()).muralla;
    } catch { puntos = [[207, 52], [207, 90]]; }
    if (cerrado) return;
    for (let i = 1; i < puntos.length; i++) {
      const [x, z] = puntos[i - 1], [u, v] = puntos[i];
      if (v < 52 || z >= 104) continue;
      const ang = Math.atan2(v - z, u - x);
      // La polilínea marca la cara exterior. El centro del módulo queda dentro de casa.
      const ox = -Math.sin(ang) * medioFondo, oz = Math.cos(ang) * medioFondo;
      const a = z < 52 ? (52 - z) / (v - z) : 0, b = v > 104 ? (104 - z) / (v - z) : 1;
      const dibujar = (desde, hasta) => segmento(x + ox + (u - x) * desde, z + oz + (v - z) * desde,
        x + ox + (u - x) * hasta, z + oz + (v - z) * hasta);
      let desde = a;
      for (const puerta of puertas) {
        if (x !== u || x !== puerta.x || v <= z) continue;
        const inicio = (puerta.y - 1 - z) / (v - z), fin = (puerta.y + 1 - z) / (v - z);
        if (fin <= desde || inicio >= b) continue;
        if (inicio > desde) dibujar(desde, inicio);
        desde = Math.max(desde, fin);
      }
      if (desde < b) dibujar(desde, b);
      if (i + 1 < puntos.length && b === 1) {
        const [px, pz] = puntos[i + 1];
        if (Math.abs(Math.atan2(pz - v, px - u) - ang) > .28) apoyar('torreon-cordon', u + ox, v + oz, ang);
      }
    }
  }
  let montada = false;
  function montarMuralla(puertas = []) {
    if (montada) return;
    montada = true;
    muralla([...puertas].sort((a, b) => a.y - b.y));
  }
  const bastiones = new Map();
  function bastion(b) {
    if (!bastiones.has(b.indice)) {
      const o = apoyar('muralla-traba-nudo', b.cx, b.cy, Math.PI / 2);
      o.userData.bastion = b.indice;
      segmento(207 - medioFondo, b.cy, b.cx, b.cy);
      bastiones.set(b.indice, o);
    }
    return bastiones.get(b.indice);
  }
  function liberar() { for (const r of recursos) r.dispose(); recursos.clear(); }
  return { get revisionRelieve() { return revisionRelieve; }, altura, interseccion, montar, montarMuralla, bastion, quitar, grupo,
    batalla(si) {
      if (oscuro !== si) { oscuro = si; for (const raiz of vestidos) materiales.vestir(raiz, si); }
    },
    destruir() { cerrado = true; vestidos.clear(); materiales.destruir(); liberar(); grupo.removeFromParent(); },
  };
}
