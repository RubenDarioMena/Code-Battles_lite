import { crearAcidoVista } from './acido-vista.js';
import { crearBisagra } from './bisagra.js';
import { superficie } from './superficie.js';
export function crearVista(T, canvas) {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new T.Scene(), grupo = new T.Group();
  grupo.rotation.x = -Math.PI / 2; scene.add(grupo);
  const cam = new T.PerspectiveCamera(35, 1, .015, 80);
  const suelo = new T.Mesh(new T.PlaneGeometry(120, 120), new T.MeshStandardMaterial({ color: '#39464a', roughness: .9 }));
  suelo.rotation.x = -Math.PI / 2; scene.add(suelo);
  const grid = new T.GridHelper(28, 112, '#788584', '#536364');
  grid.position.y = .001; scene.add(grid);
  const ambiente = new T.HemisphereLight(0xe9f3ff, 0x81735e, 1.0);
  const sol = new T.DirectionalLight(0xffebc7, 1.6); sol.position.set(-2, 5, 4);
  const destello = new T.PointLight(0xffaf60, 0, 5);
  scene.add(ambiente, sol, destello);
  const acido = crearAcidoVista(T, grupo);
  const dibujadas = new Map(), bisagras = new Map(), trazos = [];
  let objetivo = new T.Vector3(), distancia = 4, azimut = .27, altura = .30, aspectoMinimo = 1.85;
  function colocar() {
    const escala = Math.max(1, aspectoMinimo / cam.aspect);
    const r = distancia * escala;
    cam.position.copy(objetivo).add(new T.Vector3(Math.sin(azimut) * Math.cos(altura) * r, Math.sin(altura) * r, Math.cos(azimut) * Math.cos(altura) * r));
    cam.lookAt(objetivo); cam.updateMatrixWorld();
  }
  function encuadrar(demo) {
    const tomas = {
      granada: { centro: [0, .39, .05], radio: 3.35, giro: .25, elevacion: .34, aspecto: 1.5 },
      chorro: { centro: [0, .62, 3.37], radio: 6.55, giro: 1.28, elevacion: .16, aspecto: 1.9 },
      general: { centro: [0, .51, 0], radio: 4.15, giro: .27, elevacion: .26, aspecto: 1.85 },
      laser: { centro: [0, .78, -.35], radio: 1.9, giro: .85, elevacion: .16, aspecto: 1 },
      cinetico: { centro: [0, .52, -1.05], radio: 3.25, giro: 1.05, elevacion: .26, aspecto: 1.65 },
      acido: { centro: [0, .52, 0], radio: 2.05, giro: .44, elevacion: .26, aspecto: 1.25 },
      corte: { centro: [.25, .5, -.2], radio: 2.3, giro: .62, elevacion: .3, aspecto: 1.25 },
      puente: { centro: [.26, .52, 0], radio: 1.95, giro: .28, elevacion: .20, aspecto: 1.2 },
      tanque: { centro: [.04, .21, 0], radio: 1.95, giro: .46, elevacion: .32, aspecto: 1.45 },
      comparar: { centro: [0, .45, -.9], radio: 5.2, giro: .42, elevacion: .4, aspecto: 1.85 },
    };
    const toma = tomas[demo === 'chorro-caotico' ? 'chorro' : demo] ?? tomas.general;
    objetivo.fromArray(toma.centro);
    distancia = toma.radio; azimut = toma.giro; altura = toma.elevacion; aspectoMinimo = toma.aspecto;
    colocar();
  }
  function retirar(t) {
    for (const o of [t.mesh, t.emisor]) {
      grupo.remove(o);
      o.traverse(h => { if (h.isMesh) { h.geometry.dispose(); h.material.dispose(); } });
    }
  }
  function limpiar() {
    acido.limpiar();
    for (const o of dibujadas.values()) { grupo.remove(o.mesh); o.destruir(); }
    dibujadas.clear();
    for (const b of bisagras.values()) { grupo.remove(b.mesh); b.destruir(); }
    bisagras.clear();
    trazos.splice(0).forEach(retirar);
  }
  function trazo(orden, informe, t) {
    if (informe.emisor) { acido.montarEmisor(informe.emisor); return; }
    if (informe.proyectil) return;
    const a = new T.Vector3(...orden.origen), b = informe.impacto ? new T.Vector3(...informe.impacto.pos) :
      a.clone().addScaledVector(new T.Vector3(...orden.direccion).normalize(), 9);
    const color = { laser: 0xff672b, acido: 0xa5f156, cinetico: 0xffdc83, explosivo: 0xff983e }[orden.arma];
    const dir = b.clone().sub(a), largo = dir.length();
    if (!largo) return;
    dir.normalize();
    // Haz: núcleo blanco fino dentro de un halo del color del arma (cilindros de radio 1 escalados).
    const capa = (radio, c, opacidad) => {
      const m = new T.Mesh(new T.CylinderGeometry(radio, radio, 1, 12, 1, true),
        new T.MeshBasicMaterial({ color: c, transparent: true, opacity: opacidad, depthWrite: false, blending: T.AdditiveBlending }));
      m.userData.opacidad = opacidad;
      return m;
    };
    const mesh = new T.Group();
    mesh.add(capa(1, color, .45), capa(.38, 0xffffff, .95));
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); grupo.add(mesh);
    // Emisor visible: un cañón corto que apunta al blanco, en el origen del disparo.
    const emisor = new T.Group();
    const tubo = new T.Mesh(new T.CylinderGeometry(.045, .06, .32, 14), new T.MeshStandardMaterial({ color: '#3a3f46', metalness: .5, roughness: .4 }));
    const boca = new T.Mesh(new T.CylinderGeometry(.03, .03, .02, 14), new T.MeshBasicMaterial({ color }));
    boca.position.y = .17; emisor.add(tubo, boca);
    emisor.position.copy(a); emisor.quaternion.copy(mesh.quaternion); grupo.add(emisor);
    trazos.push({ a, b, mesh, emisor, dir, largo, t, arma: orden.arma });
  }
  function dibujar(e, sucesos = []) {
    acido.dibujar(e, sucesos);
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (cam.aspect !== w / h || renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio())
      || renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); colocar();
    }
    scene.background = new T.Color(e.terminada ? '#d1d6ce' : '#1b292f');
    scene.fog = new T.FogExp2(scene.background, e.terminada ? .062 : .10);
    ambiente.intensity = e.terminada ? 2.5 : .78; sol.intensity = e.terminada ? 3.4 : 1.25;
    let flash = 0;
    for (let i = trazos.length - 1; i >= 0; i--) {
      const tr = trazos[i], f = (e.tiempo - tr.t) / .23;
      if (f >= 1 || e.terminada) { retirar(tr); trazos.splice(i, 1); continue; }
      const haz = tr.arma === 'laser', r = haz ? .016 : tr.arma === 'acido' ? .022 : .017;
      const largo = haz ? tr.largo : Math.min(tr.largo, tr.arma === 'acido' ? .48 : .26);
      tr.mesh.scale.set(r, largo, r);
      tr.mesh.position.copy(tr.a).addScaledVector(tr.dir, largo / 2 + (haz ? 0 : (tr.largo - largo) * Math.min(1, f * 2)));
      tr.mesh.children.forEach(c => { c.material.opacity = c.userData.opacidad * (1 - f); });
      flash = Math.max(flash, 1 - f);
      destello.position.set(tr.b.x, tr.b.z + .14, -tr.b.y);
    }
    destello.intensity = flash * 5;
    const presentes = new Set();
    for (const p of e.piezas) {
      presentes.add(p.uid);
      let o = dibujadas.get(p.uid);
      if (!o) { o = superficie(T, p); dibujadas.set(p.uid, o); grupo.add(o.mesh); }
      o.actualizar(p, e.tiempo, e.terminada, flash);
    }
    for (const [uid, o] of dibujadas) if (!presentes.has(uid)) {
      grupo.remove(o.mesh); o.destruir(); dibujadas.delete(uid);
    }
    const colgadas = new Set();
    for (const h of e.piezas) if (h.puente) {
      colgadas.add(h.uid);
      let b = bisagras.get(h.uid);
      if (!b) { b = crearBisagra(T, h.color); bisagras.set(h.uid, b); grupo.add(b.mesh); }
      b.actualizar(h, e.piezas.find(p => p.uid === h.padre));
    }
    for (const [uid, b] of bisagras) if (!colgadas.has(uid)) {
      grupo.remove(b.mesh); b.destruir(); bisagras.delete(uid);
    }
    renderer.render(scene, cam);
  }
  function rayo(x, y) {
    const rect = canvas.getBoundingClientRect();
    const dir = new T.Vector3(2 * (x - rect.left) / rect.width - 1, 1 - 2 * (y - rect.top) / rect.height, .5)
      .unproject(cam).sub(cam.position).normalize();
    const mapa = v => [v.x, -v.z, v.y];
    return { origen: mapa(cam.position), direccion: mapa(dir) };
  }
  return {
    encuadrar, dibujar, rayo, trazo, limpiar,
    girar(dx, dy) { azimut -= dx * .008; altura = Math.min(1.45, Math.max(.055, altura + dy * .008)); colocar(); },
    zoom(delta) { distancia = Math.min(10, Math.max(.6, distancia * Math.exp(delta * .001))); colocar(); }
  };
}
