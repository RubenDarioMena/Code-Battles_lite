import { crearDibujanteEfectos as crear3D } from '../../paquetes/vista-3d/index.js';
import { crearDibujanteEfectos as crear2D } from '../../paquetes/vista-2d/index.js';

export function crearVisores(THREE, canvas3, canvas2, colores, texto) {
  const W = 640, H = 400;
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3, antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(colores.suelo);
  escena.fog = new THREE.Fog(colores.suelo, 33 * .55, 33 * 1.75);
  const camara = new THREE.PerspectiveCamera(38, W / H, .1, 500);
  const pitch = .93;
  camara.position.set(16, 33 * Math.sin(pitch), 8.2 + 33 * Math.cos(pitch));
  camara.lookAt(16, 0, 8.2);
  const grid = new THREE.GridHelper(32, 32, colores.edge, colores['grid-2']);
  grid.position.set(16, .005, 9); escena.add(grid);
  const testigo = new THREE.Mesh(new THREE.BoxGeometry(1, .4, .6), new THREE.MeshBasicMaterial({ color: colores.edge }));
  testigo.position.set(16, .2, 9); escena.add(testigo);
  const anillo = new THREE.Mesh(new THREE.RingGeometry(.62, .66, 48),
    new THREE.MeshBasicMaterial({ color: colores.ok, side: THREE.DoubleSide, depthTest: false }));
  anillo.rotation.x = -Math.PI / 2; anillo.position.set(16, .03, 9); anillo.renderOrder = 4; escena.add(anillo);
  const grupo = new THREE.Group(); escena.add(grupo);
  const gl = renderer.getContext();
  const dib3 = crear3D(THREE, grupo, { alturaBufer: H, pixelRatio: 1, fov: 38,
    maxPunto: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] });
  const T = Math.min(W / 32, (H - 40) / 18), ox = (W - T * 32) / 2, oy = Math.max(36, (H - T * 18) / 2);
  const dib2 = crear2D({ T, ox, oy });
  const ctx = canvas2.getContext('2d');
  function proyectar(x, y, z = 0) {
    const v = new THREE.Vector3(x, z, y).project(camara);
    return { x: (v.x + 1) * W / 2, y: (1 - v.y) * H / 2 };
  }
  function dibujar(particulas) {
    dib3.dibujar(particulas); renderer.render(escena, camara);
    ctx.fillStyle = colores.suelo; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = colores['grid-2']; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= 32; i++) { ctx.moveTo(ox + i * T, oy); ctx.lineTo(ox + i * T, oy + 18 * T); }
    for (let j = 0; j <= 18; j++) { ctx.moveTo(ox, oy + j * T); ctx.lineTo(ox + 32 * T, oy + j * T); }
    ctx.stroke();
    ctx.fillStyle = colores.edge; ctx.fillRect(ox + 15.5 * T, oy + 8.7 * T, T, .6 * T);
    dib2.dibujar(ctx, particulas);
    ctx.strokeStyle = colores.ok; ctx.beginPath(); ctx.arc(ox + 16 * T, oy + 9 * T, .65 * T, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '12px sans-serif'; ctx.fillStyle = colores.ink; ctx.fillText(texto('testigoMetro'), ox + 16 * T - 40, oy + 9 * T - 20);
  }
  return { dibujar, proyectar, centroPlano: { x: ox + 16 * T, y: oy + 9 * T },
    destruir() {
      dib3.destruir(); dib2.destruir(); renderer.dispose();
      for (const m of [grid, testigo, anillo]) { m.geometry.dispose(); m.material.dispose(); }
    } };
}
