import { crearRegistro, modelos } from './modelos.js';
import { montarReparador, montarSensor } from '../maquinas-war.js';
import { enemigoMesh } from '../instancias-war.js';

// Una escena pequeña para la ficha. Las plantillas y el contexto WebGL duran la página.
export function crearFicha3D(canvas, { THREE: T, cargarGLTFLoader }, tipos) {
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const escena = new T.Scene(), soporte = new T.Group(), camara = new T.PerspectiveCamera(32, 1, .01, 80);
  escena.add(soporte, new T.HemisphereLight(0xfffaef, 0x8aa2ad, 2));
  const sol = new T.DirectionalLight(0xffffff, 2); sol.position.set(3, 4, 2); escena.add(sol);
  const material = color => new T.MeshStandardMaterial({ color, roughness: .7 });
  const M = { edificio: material(0x617887), borde: material(0x344954), rol: material(0x6ac4ba),
    enemigo: material(0xbd9469), frio: material(0x86b9d6), sombra: material(0x293842) };
  const caja = (w, h, d) => new T.BoxGeometry(w, h, d);
  const registro = crearRegistro(async url => {
    const Loader = await cargarGLTFLoader();
    const { scene } = await new Loader().loadAsync(url);
    scene.traverse(o => { if (/^L[12]_/.test(o.name)) o.visible = false; });
    return scene;
  }, f => new T.Mesh(caja(...f.tam), M.rol));
  const cache = new Map();
  function modelo(e) {
    const clave = e.clase || e.tipo;
    if (cache.has(clave)) return cache.get(clave);
    let grupo = new T.Group();
    if (e.modelo && modelos[e.modelo]?.url) return registro(e.modelo);
    if (e.clase === 'lanzador') return registro('torreta-esfera');
    if (e.clase === 'vibracion') montarSensor(T, grupo, M, M.rol);
    else if (e.clase === 'reparador') montarReparador(T, grupo, M, M.rol);
    else if (tipos[e.tipo]) {
      const G = { caja, esfera: new T.SphereGeometry(1, 12, 10), rotor: new T.CylinderGeometry(.15, .15, .025, 12), disco: new T.CircleGeometry(1, 12) };
      const enemigo = enemigoMesh(T, G, M, { altura: new T.LineDashedMaterial() }, tipos, e);
      grupo = enemigo.cuerpoG ?? enemigo.grupo;
    } else {
      grupo.add(new T.Mesh(caja(1.4, .95, 1.7), M.edificio));
      const tapa = new T.Mesh(caja(1.2, .16, 1.45), M.rol); tapa.position.y = .55; grupo.add(tapa);
    }
    cache.set(clave, grupo); return grupo;
  }
  let solicitud = 0, raf = 0, ancho = 0, alto = 0;
  function pausar() { solicitud++; cancelAnimationFrame(raf); }
  async function mostrar(e) {
    pausar();
    const turno = solicitud;
    soporte.clear();
    const unidad = await modelo(e);
    if (turno !== solicitud) return;
    const objeto = unidad.clone(true);
    const limites = new T.Box3().setFromObject(objeto), centro = limites.getCenter(new T.Vector3());
    objeto.position.sub(centro); soporte.add(objeto);
    const radio = limites.getSize(new T.Vector3()).length() / 2 || 1;
    function dibujar(t) {
      if (turno !== solicitud) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w && h) {
        if (w !== ancho || h !== alto) {
          renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix();
          ancho = w; alto = h;
        }
        camara.position.set(0, radio * 1.35, radio * 3.7 / Math.min(1, camara.aspect)); camara.lookAt(0, 0, 0);
        soporte.rotation.y = .4 + t * .00024; renderer.render(escena, camara);
      }
      raf = requestAnimationFrame(dibujar);
    }
    raf = requestAnimationFrame(dibujar);
  }
  return { mostrar, pausar };
}
