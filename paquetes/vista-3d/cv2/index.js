import { crearEfectosWar } from '../efectos-war.js';
import { crearCamara3D } from '../camara.js';
import { crearInstanciasWar, idDeImpacto } from '../instancias-war.js';
import { montarSensor, montarReparador } from '../maquinas-war.js';
import { liberarEscena } from '../recursos.js';
import { altoBastion, crearPaisaje } from './paisaje.js';
import { estadoRig, montarTorreta } from './torreta.js';
import { modelos } from './modelos.js';
import { zoomMax, PITCH_RASANTE } from './decorado.js';

// Fachada en metros. Solo la composición conoce la conversión al marco del jugador.
export function crearVistaCV2(campo, { THREE, cargarGLTFLoader, canvas, $, TIPOS, dt, fabrica = false, MISIL = undefined, estado = undefined }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const escena = new THREE.Scene(), camara = new THREE.PerspectiveCamera(38, 1, .1, 500);
  const movil = new THREE.Group(), maquinas = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0xfff5da, 0x898175, 1.9);
  const sol = new THREE.DirectionalLight(0xffeed6, 2.3);
  sol.position.set(-20, 45, 18);
  escena.add(hemi, sol, maquinas, movil);
  escena.background = new THREE.Color(0xd8cdb5);
  escena.fog = new THREE.Fog(escena.background, 30, 60);
  const paisaje = crearPaisaje(THREE, escena, renderer, cargarGLTFLoader);
  let foto;
  const efectos = MISIL && crearEfectosWar({
    get escena() { return foto; }, get col() { return estado.col; }, get efectos() { return estado.efectos; },
  }, { dt, MISIL, alturaLanzador: l => altoBastion + paisaje.altura(l.cx, l.cy) });
  efectos?.montar({ THREE, escena, renderer, camara });
  // La primera escena fija los límites, también si llega después de redimensionar el canvas.
  const zona = { x0: 0, x1: 1, z0: 0, z1: 1, yaw: fabrica ? -.6 : .15, pitch: fabrica ? 1 : 1.15, pitchMin: PITCH_RASANTE, zoom: [8, zoomMax] };
  let revisionEncuadre = -1;
  const control = crearCamara3D({ THREE, renderer, escena, camara, fijo: maquinas, movil, zona,
    estado: { camaraDosDedos: true }, $: id => id === 'c3d' ? canvas : $(id), interseccionTerreno: paisaje.interseccion });
  const G = { caja: (w, h, d) => new THREE.BoxGeometry(w, h, d), esfera: new THREE.SphereGeometry(1, 16, 12),
    disco: new THREE.CircleGeometry(1, 24), rotor: new THREE.CylinderGeometry(.15, .15, .025, 12) };
  const colores = { enemigo: 0x995655, borde: 0x45575c, frio: 0x7f9ead, sombra: 0x555555,
    golpe: 0xff5151, misil: 0xffae49, edificio: 0x728087, rol: 0x62bcba };
  const M = Object.fromEntries(Object.entries(colores).map(([k, color]) => [k, new THREE.MeshLambertMaterial({ color })]));
  const L = { altura: new THREE.LineDashedMaterial({ color: 0x8ca8ab, dashSize: .15, gapSize: .12 }),
    estela: new THREE.LineBasicMaterial({ color: 0xffc070 }) };
  const instancias = fabrica ? null : crearInstanciasWar({ THREE, G, M, L, TIPOS, movil, alturaSuelo: paisaje.altura });
  const porId = new Map(), disparos = new Map();
  const piloto = new THREE.MeshBasicMaterial({ color: 0xffa226 });
  const caja = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  function crearUnidad(e) {
    const grupo = new THREE.Group();
    grupo.userData.id = e.id;
    maquinas.add(grupo);
    const unidad = { grupo, animar: null, luz: null, copia: null };
    if (e.clase === 'lanzador') {
      const espera = caja(.95, .6, .95, M.rol);
      espera.position.y = .3;
      grupo.add(espera);
      paisaje.montar('torreta-esfera', grupo, (copia, rig) => {
        unidad.copia = copia;
        unidad.animar = montarTorreta(THREE, copia, rig, modelos['torreta-esfera'].rig);
        espera.removeFromParent(); espera.geometry.dispose();
      });
      unidad.luz = new THREE.Mesh(new THREE.TorusGeometry(.71, .07, 8, 32), piloto);
      unidad.luz.rotation.x = Math.PI / 2;
      unidad.luz.position.y = .15;
      grupo.add(unidad.luz);
    } else if (e.modelo && modelos[e.modelo]?.url) {
      paisaje.montar(e.modelo, grupo, copia => {
        unidad.copia = copia;
        copia.traverse(n => { if (/^L[12]_/.test(n.name)) n.visible = false; });
      });
    } else if (e.clase === 'vibracion') montarSensor(THREE, grupo, M, M.rol);
    else if (e.clase === 'reparador') montarReparador(THREE, grupo, M, M.rol);
    else {
      const base = caja(fabrica ? 2.2 : 1.4, .95, 1.7, M.edificio);
      base.position.y = .475;
      const tapa = caja(fabrica ? 1.85 : 1.2, .16, 1.45, M.rol);
      tapa.position.y = 1.03;
      grupo.add(base, tapa);
    }
    porId.set(e.id, unidad);
    return unidad;
  }
  function limpiarUnidades() {
    for (const { grupo, copia } of porId.values()) {
      if (copia) { paisaje.quitar(copia); copia.removeFromParent(); }
      grupo.traverse(o => o.geometry?.dispose());
      grupo.removeFromParent();
    }
    porId.clear(); disparos.clear();
  }
  function alturaUnidad(e) { return paisaje.altura(e.cx ?? e.x, e.cy ?? e.y) + (e.clase === 'lanzador' ? altoBastion : 0); }
  function dibujar(_anterior, e, fraccion, ahora = performance.now()) {
    if (revisionEncuadre !== paisaje.revisionRelieve) {
      if (fabrica) {
        const xs = e.maquinas.map(m => m.cx), zs = e.maquinas.map(m => m.cy);
        Object.assign(zona, { x0: Math.min(...xs) - 6, x1: Math.max(...xs) + 6, z0: Math.min(...zs) - 6, z1: Math.max(...zs) + 6 });
      } else {
        const [x0, z0] = e.marco.origen, [ancho, fondo] = e.marco.tam;
        // También entran la altura de los bastiones y la llegada aérea al este.
        const x1 = x0 + ancho + 1, z1 = z0 + fondo, puntos = [];
        for (const x of [x0, x1]) for (const z of [z0, z1])
          for (const alto of [0, 3]) puntos.push(new THREE.Vector3(x, paisaje.altura(x, z) + alto, z));
        for (const b of e.bastiones) puntos.push(new THREE.Vector3(b.cx, paisaje.altura(b.cx, b.cy) + altoBastion + 2, b.cy));
        const alturas = puntos.map(p => p.y);
        Object.assign(zona, { x0, x1, z0, z1, puntos, alto: (Math.max(...alturas) + Math.min(...alturas)) / 2 });
      }
      const { width, height } = campo.getBoundingClientRect();
      if (width && height) {
        // El primer encuadre manda aunque el jugador tocara la cámara mientras cargaba: antes de él no hay
        // zona y la cámara miraría a un punto vacío.
        const primero = revisionEncuadre < 0;
        control.tamano(width, height);
        if (primero) control.recentrar();
        revisionEncuadre = paisaje.revisionRelieve;
      }
    }
    foto = e;
    paisaje.montarMuralla(e.puertas);
    for (const b of e.bastiones) paisaje.bastion(b);
    const off = fraccion * dt, t = e.t + off;
    // La trayectoria dibujada nace sobre el nudo. War conserva z0 y el punto de impacto.
    const misiles = e.misiles.map(m => {
      disparos.set(m.de, Math.max(disparos.get(m.de) ?? -Infinity, m.t0));
      if (m.movil) return { ...m, z0: m.z0 + paisaje.altura(m.x0, m.y0), z1: m.z1 + paisaje.altura(m.x1, m.y1) };
      const pivote = altoBastion + paisaje.altura(m.x0, m.y0) + .595;
      const z1 = m.z1 + paisaje.altura(m.x1, m.y1);
      const dx = m.x1 - m.x0, dy = m.y1 - m.y0, dz = z1 - pivote;
      const avance = Math.min(1, .858 / (Math.hypot(dx, dy, dz) || 1));
      return { ...m, x0: m.x0 + dx * avance, y0: m.y0 + dy * avance, z0: pivote + dz * avance, z1 };
    });
    for (const { grupo } of porId.values()) grupo.visible = false;
    for (const m of e.maquinas) {
      const u = porId.get(m.id) ?? crearUnidad(m);
      u.grupo.visible = true;
      u.grupo.position.set(m.cx, alturaUnidad(m), m.cy);
      if (u.luz) {
        const ultimo = disparos.get(m.id) ?? -Infinity;
        const tiro = t - ultimo < .18 && e.misiles.find(mi => mi.de === m.id && mi.t0 === ultimo);
        const p = tiro ? { x: tiro.x1, y: tiro.y1, z: tiro.z1 } : m.lugar;
        const apuntado = tiro ? { ...m, lugar: p, yaw: Math.atan2(p.y - m.cy, p.x - m.cx) } : m;
        const pose = estadoRig(apuntado, t, ultimo, u.grupo.position.y + .595, p ? paisaje.altura(p.x, p.y) : 0);
        u.luz.visible = pose.atascado;
        u.animar?.(pose, camara.position.distanceTo(u.grupo.position));
      }
    }
    instancias?.actualizar({ ...e, misiles, enemigos: e.enemigos.map(u => modelos[u.modelo]?.primitiva ? { ...u, tipo: modelos[u.modelo].primitiva } : u) }, off, ahora);
    efectos?.dibujar(off);
    control.render();
  }

  const rayo = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function impactos(x, y, objetos) {
    const { width, height } = campo.getBoundingClientRect();
    rayo.setFromCamera(ndc.set(2 * x / width - 1, 1 - 2 * y / height), camara);
    return rayo.intersectObjects(objetos, true).filter(hit => {
      for (let o = hit.object; o; o = o.parent) if (!o.visible) return false;
      return true;
    });
  }
  function proyectar(x, alto, y) {
    const { width, height } = campo.getBoundingClientRect();
    return control.proyectar(x, alto + paisaje.altura(x, y), y, width, height);
  }
  function batalla(si) {
    escena.background.set(si ? 0x09131a : 0xd8cdb5);
    escena.fog.color.copy(escena.background);
    paisaje.batalla(si);
    for (const [k, m] of Object.entries(M)) m.emissive.set(si ? colores[k] : 0).multiplyScalar(.45);
  }
  return { dibujar, batalla, proyectar, centrar: control.centrar, recentrar: control.recentrar, girar: control.girar, desplazar: control.desplazar,
    inclinacion: control.inclinacion, limitesInclinacion: control.limitesInclinacion,
    camara: control.camara, tamano: control.tamano, redimensionar() {
      const r = campo.getBoundingClientRect();
      if (r.width && r.height) control.tamano(r.width, r.height);
    },
    proyectarUnidad(e, alto) { return proyectar(e.cx ?? e.x, alto + (e.clase === 'lanzador' ? altoBastion : 0), e.cy ?? e.y); },
    proyectarBastion(b) { return proyectar(b.cx, altoBastion + .12, b.cy); },
    bastionEn(x, y) {
      const primero = impactos(x, y, [paisaje.grupo])[0];
      for (let o = primero?.object; o; o = o.parent) if (o.userData.bastion != null) return o.userData.bastion;
      return null;
    },
    elegir(x, y) {
      for (const hit of impactos(x, y, [maquinas, movil, paisaje.grupo])) {
        const id = idDeImpacto(hit);
        if (id != null) return id;
        if (hit.object.isMesh && !hit.object.isInstancedMesh) break;
      }
      return null;
    },
    suelo(x, y) { const r = campo.getBoundingClientRect(); return control.suelo(x, y, r.width, r.height); },
    construir: limpiarUnidades, anillosDe() {}, aplicarColores() {}, vaciar() { disparos.clear(); foto = null; efectos?.vaciar(); },
    alSuceso(s) {
      if (foto) {
        if (s.tipo === 'explosion') {
          const { x, y, z } = s.datos;
          efectos?.alSuceso({ ...s, datos: { ...s.datos, z: (z || 0) + paisaje.altura(x, y) + (s.datos.misil == null ? altoBastion : 0) } });
        } else efectos?.alSuceso(s);
      }
      if (s.tipo === 'disparo') disparos.set(s.unidad, s.paso * dt); },
    retrato() { return null; },
    destruir() {
      limpiarUnidades(); efectos?.destruir(); instancias?.destruir(); control.destruir(); paisaje.destruir();
      liberarEscena(escena, renderer, [...Object.values(G), ...Object.values(M), ...Object.values(L), piloto]);
    },
  };
}
