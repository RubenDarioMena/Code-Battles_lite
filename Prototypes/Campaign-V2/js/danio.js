// Banco de daño (P8, consolidado 13.B): las reglas de reglas-campaign-v2/danio deciden; la vista de
// vista-3d/cv2/restos.js solo dibuja. El panel lee el balance, el estado funcional y los fragmentos de las reglas.
import * as THREE from 'three';
import { OrbitControls } from '../../../shared/vendor/three-r180/OrbitControls.js';
import { danio, catalogoFabrica } from '../../../paquetes/reglas-campaign-v2/index.js';
import { crearRestos3D } from '../../../paquetes/vista-3d/index.js';

const { crearRestos, golpear, balance, fragmentos, estado, recuperar, PERFILES, VEHICULOS } = danio;
const $ = id => document.getElementById(id);
const kg = g => (g / 1000).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NOMBRES = { proa: 'Proa', centro: 'Chasis central', popa: 'Popa', motor: 'Motor', 'oruga-izq': 'Oruga izquierda',
  'oruga-der': 'Oruga derecha', arma: 'Arma', electronica: 'Electrónica' };
const NOTAS = {
  explosivo: 'Radio 1,4 m: arranca mucha masa y la reparte en chatarra (60 %) y perdida (40 %). Rompe muchas uniones.',
  preciso: 'Radio 0,3 m, solo el componente más cercano: le quita la función con muy poca masa (el corte se volatiliza).',
  corrosivo: 'Radio 0,7 m, por dosis: erosiona la masa poco a poco; la mitad queda como chatarra corroída y la otra se disuelve.',
};
const CATEGORIAS = [['reutilizable', 'Reutilizable'], ['fragmento', 'Fragmento'], ['chatarra', 'Chatarra'], ['perdido', 'Perdido']];

// ---------- Escena ----------
const lienzo = $('lienzo');
const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
const escena = new THREE.Scene();
escena.background = new THREE.Color(0xd8cdb5);
escena.fog = new THREE.Fog(escena.background, 9, 20);
const camara = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
camara.position.set(4.3, 3.4, 4.6);
const hemi = new THREE.HemisphereLight(0xfff5da, 0x898175, 1.9), sol = new THREE.DirectionalLight(0xffeed6, 2.3);
sol.position.set(-3, 6, 2.5); sol.castShadow = true; sol.shadow.mapSize.set(1024, 1024);
Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
escena.add(hemi, sol);
const controles = new OrbitControls(camara, lienzo);
controles.target.set(0, 0.45, 0); controles.enableDamping = true; controles.maxPolarAngle = Math.PI * 0.48;
controles.minDistance = 1.5; controles.maxDistance = 9;

let calidad = 'alta';
let vista = crearRestos3D(THREE, { perfiles: PERFILES, calidad });
escena.add(vista.grupo);
// Esfera que enseña el alcance del ataque bajo el cursor.
const alcance = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0xe5383b, transparent: true, opacity: 0.16, depthWrite: false }));
alcance.visible = false;
escena.add(alcance);

// ---------- Estado ----------
let restos = crearRestos(VEHICULOS.oruga);
let perfil = 'explosivo';
const energia = () => Number($('energia').value);

function redibujar() {
  const frags = fragmentos(restos);
  vista.actualizar(restos, frags);
  pintarPanel(frags);
}

function pintarPanel(frags) {
  const b = balance(restos);
  $('barra').innerHTML = CATEGORIAS.map(([k]) => `<span style="width:${(b[k] / b.original) * 100}%;background:var(--${k})"></span>`).join('');
  $('barra').setAttribute('aria-label', CATEGORIAS.map(([k, n]) => `${n} ${kg(b[k])} kg`).join(', '));
  $('balance').innerHTML = CATEGORIAS.map(([k, n]) => `<dt style="--c:var(--${k})">${n}</dt><dd>${kg(b[k])} kg</dd>`).join('')
    + `<dt>Total</dt><dd>${kg(b.total)} de ${kg(b.original)} kg${b.total === b.original ? ' ✓' : ' ✗'}</dd>`;
  const e = estado(restos);
  const marca = v => v ? '<span class="si">sí</span>' : '<span class="no">no</span>';
  $('estado').innerHTML = `Movilidad: ${marca(e.funciones.movilidad)} · Fuego: ${marca(e.funciones.fuego)}`
    + (e.fueraDeCombate ? ' · <span class="no">fuera de combate</span>' : '');
  $('fragmentos').innerHTML = frags.length ? frags.map(f => `<li>${f.componentes.map(id => NOMBRES[id]).join(' + ')} — ${kg(f.masa)} kg`
    + (f.reutilizable ? ` (${kg(f.reutilizable)} reutilizables)` : '') + '</li>').join('') : '<li>Nada: todo es chatarra o se perdió.</li>';
  $('componentes').tBodies[0].innerHTML = restos.componentes.map(c => {
    const pct = Math.round(c.integridad * 100), color = c.integridad >= danio.UMBRAL_FUNCION ? 'var(--reutilizable)' : 'var(--perdido)';
    return `<tr><td>${NOMBRES[c.id]}</td><td>${kg(c.masa)} / ${kg(c.masa0)}</td>`
      + `<td><span class="integridad" title="${pct} %"><span style="width:${pct}%;background:${color}"></span></span></td></tr>`;
  }).join('');
  $('recoger').disabled = restos.recogido;
  if (!restos.recogido) $('recogida').innerHTML = '';
  $('calidad-nota').textContent = `Máscara de ${vista.triangulos()}×${vista.triangulos()} cuadros por cara. Cambiarla no toca el balance: mismo resultado lógico.`;
}

function contarGolpe(s) {
  if (!s.efectos.length) { $('ultimo').textContent = `${s.perfil} en (${s.punto.join(', ')}): no alcanzó nada con masa.`; return; }
  $('ultimo').innerHTML = `<b>${s.perfil}</b> en (${s.punto.join(', ')}), energía ${s.energia}:<br>` + s.efectos.map(x =>
    `${NOMBRES[x.id]}: −${kg(x.quitar)} kg (${kg(x.chatarra)} chatarra, ${kg(x.perdido)} perdido), integridad ${Math.round(x.integridad * 100)} %`).join('<br>');
}

function atacar(punto, p = perfil, e = energia()) {
  if (restos.recogido) return;
  contarGolpe(golpear(restos, { perfil: p, punto, energia: e }));
  redibujar();
}

const CASOS = {
  acido: () => { for (let i = 0; i < 4; i++) atacar([0, 0, 0.45], 'corrosivo', 1); },
  precisos: () => { atacar([-0.65, 0, 0.8], 'preciso', 1); atacar([0.1, 0, 0.92], 'preciso', 1); },
  explosion: () => atacar([0, 0, 0.45], 'explosivo', 1),
  leve: () => atacar([0.6, 0, 0], 'explosivo', 0.5),
  reiniciar: () => {},
};
for (const b of document.querySelectorAll('[data-caso]')) b.addEventListener('click', () => {
  restos = crearRestos(VEHICULOS.oruga);
  $('ultimo').textContent = 'Ninguno todavía.';
  redibujar();
  CASOS[b.dataset.caso]();
});

function elegir(grupo, valor) {
  for (const b of document.querySelectorAll(`[data-${grupo}]`)) b.setAttribute('aria-pressed', String(b.dataset[grupo] === valor));
}
for (const b of document.querySelectorAll('[data-perfil]')) b.addEventListener('click', () => {
  perfil = b.dataset.perfil; elegir('perfil', perfil); $('perfil-nota').textContent = NOTAS[perfil];
});
$('perfil-nota').textContent = NOTAS[perfil];
$('energia').addEventListener('input', () => { $('energia-v').textContent = energia().toFixed(1); });
for (const b of document.querySelectorAll('[data-calidad]')) b.addEventListener('click', () => {
  calidad = b.dataset.calidad; elegir('calidad', calidad);
  vista.fijarCalidad(calidad, restos, fragmentos(restos));
  pintarPanel(fragmentos(restos));
});

// Recogida (7.5) y fundición con la receta del catálogo de la fábrica: 3 recortes → 1 placa.
$('recoger').addEventListener('click', () => {
  const lote = catalogoFabrica.PIEZAS.scrap.masa, receta = catalogoFabrica.RECETAS.plate;
  const porPlaca = receta.entra.scrap, masaPlaca = catalogoFabrica.PIEZAS.plate.masa;
  const perdidoCombate = balance(restos).perdido;
  const r = recuperar(restos, { masaLote: lote, fundirReutilizables: $('fundir').checked });
  const placas = Math.floor(r.lotes / porPlaca), sueltos = r.lotes % porPlaca;
  const escoria = placas * (porPlaca * lote - masaPlaca);
  const aparte = r.reutilizables.reduce((s, x) => s + x.masa, 0);
  $('recogida').innerHTML = `<p><b>${r.lotes} lotes de recortes</b> de ${lote} kg para la fundidora`
    + `${r.reutilizables.length ? `, y ${r.reutilizables.length} componentes reutilizables aparte (${kg(aparte)} kg)` : ''}.</p>`
    + `<p>En la fundidora: <b>${placas} placas</b> de ${masaPlaca} kg y ${escoria} kg de escoria; ${sueltos} recortes sueltos.</p>`
    + `<p class="nota">Quedan ${kg(r.sobra)} kg en el campo (menos de un lote) y se pierden ${kg(r.perdidoRecogida)} kg de chatarra que no se recoge.`
    + ` En combate se perdieron ${kg(perdidoCombate)} kg.</p>`;
  $('recoger').disabled = true;
});

// ---------- Clic para golpear (sin confundirlo con arrastrar la cámara) ----------
const rayo = new THREE.Raycaster(), cursor = new THREE.Vector2();
let abajo = null;
function tocar(ev) {
  const caja = lienzo.getBoundingClientRect();
  cursor.set(((ev.clientX - caja.left) / caja.width) * 2 - 1, -((ev.clientY - caja.top) / caja.height) * 2 + 1);
  rayo.setFromCamera(cursor, camara);
  return rayo.intersectObjects(vista.mallas(), false)[0] ?? null;
}
lienzo.addEventListener('pointerdown', ev => { abajo = { x: ev.clientX, y: ev.clientY }; });
lienzo.addEventListener('pointermove', ev => {
  const i = ev.pointerType === 'mouse' ? tocar(ev) : null;
  alcance.visible = !!i && !restos.recogido;
  if (i) { alcance.position.copy(i.point); alcance.scale.setScalar(PERFILES[perfil].radio); }
});
lienzo.addEventListener('pointerleave', () => { alcance.visible = false; });
lienzo.addEventListener('pointerup', ev => {
  if (!abajo || Math.hypot(ev.clientX - abajo.x, ev.clientY - abajo.y) > 6) { abajo = null; return; }
  abajo = null;
  const i = tocar(ev);
  if (i) atacar(vista.puntoLocal(i));
});

// ---------- Bucle ----------
function ajustar() {
  const { clientWidth: w, clientHeight: h } = lienzo;
  if (lienzo.width !== Math.round(w * renderer.getPixelRatio()) || lienzo.height !== Math.round(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camara.aspect = w / Math.max(1, h);
    camara.updateProjectionMatrix();
  }
}
let antes = performance.now();
function cuadro(ahora) {
  const dt = Math.min(0.1, (ahora - antes) / 1000);
  antes = ahora;
  ajustar();
  vista.animar(dt);
  controles.update();
  renderer.render(escena, camara);
  requestAnimationFrame(cuadro);
}
redibujar();
requestAnimationFrame(cuadro);
// Para inspeccionar desde la consola.
window.bancoDanio = { get restos() { return restos; }, atacar, balance: () => balance(restos) };
