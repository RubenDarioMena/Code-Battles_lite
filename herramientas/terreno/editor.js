import * as THREE from 'three';
import { OrbitControls } from '../../shared/vendor/three-r180/OrbitControls.js';
import { texturas } from './png.js';
import { crearBloquesUI } from './bloques-ui.js?v=2';

const T = window.CMGTerreno, $ = id => document.getElementById(id);
const visor = $('visor');
let canvas = $('terreno');
let mapa, renderer, escena, camara, controles, malla, mallaAgua, pincel, rejilla, bloquesUI, modo = 'subir', material = 0, seccion = 'terreno';
let dibujarPendiente = true;
let baseTerreno, firmaCuadricula = "", impacto = null, capturarPunto = null;
let listo = false, trazo = null, ultimoPunto = null, ultimoPuntoValido = null, guardadoPendiente = null, avisoTimer = null;
let cambios = false, revision = 0, guardadoRevision = 0;
const atras = [], adelante = [], raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
const mouse = { x: 0, y: 0, shift: false };
const pistas = {
  subir: 'Eleva el terreno fuera del campo protegido. Shift invierte Subir y Bajar.',
  inflar: 'Abomba el relieve según su pendiente. Invertir lo desinfla; no crea salientes ni cuevas.',
  detalle: 'Punta concentrada para crestas y surcos finos. Usa paso de 0,25 m para más definición.',
  bajar: 'Excava fuera del campo protegido, hasta −2 m. Shift invierte Subir y Bajar.',
  suavizar: 'Suaviza las diferencias de altura con un pincel de borde suave.',
  aplanar: 'Acerca la altura del terreno a la altura elegida, fuera del campo protegido.',
  pintar: 'Mezcla el material elegido con el suelo. También puedes pintar el campo de batalla.',
  agua: 'Pinta agua sobre el suelo situado bajo su cota. Shift borra la máscara de agua.',
  camara: 'Arrastra para girar. En táctil, usa dos dedos para zoom y desplazamiento.'
};
function aviso(texto) {
  $('aviso').textContent = texto; $('aviso').classList.add('visible');
  clearTimeout(avisoTimer); avisoTimer = setTimeout(() => $('aviso').classList.remove('visible'), 5000);
}
function nombreArchivo() { return (mapa.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'terreno'); }
function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob), enlace = document.createElement('a');
  enlace.href = url; enlace.download = nombre; enlace.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function guardar() {
  clearTimeout(guardadoPendiente); guardadoPendiente = null;
  try {
    // El autoguardado de una operación anterior puede coincidir con otro trazo.
    // Solo persistimos el último estado confirmado, nunca un trazo cancelable.
    localStorage.setItem(T.CLAVE_BORRADOR, trazo ? trazo.antes : T.serializar(mapa));
    guardadoRevision = revision;
    $('estado-guardado').textContent = '● Borrador guardado en este navegador';
    return true;
  } catch {
    $('estado-guardado').textContent = 'No se pudo guardar aquí. Descarga el JSON para conservar el mapa.';
    return false;
  }
}
function cambiado() {
  cambios = true; revision++;
  $('estado-guardado').textContent = 'Guardando borrador…';
  clearTimeout(guardadoPendiente); guardadoPendiente = setTimeout(guardar, 650);
}
function botonesHistorial() { $('deshacer').disabled = !atras.length; $('rehacer').disabled = !adelante.length; }
function recordar(antes) {
  atras.push(antes); if (atras.length > 20) atras.shift(); adelante.length = 0; botonesHistorial(); cambiado();
}
function refrescar() {
  dibujarPendiente = true;
  const firma = `${mapa.columnas}/${mapa.filas}/${mapa.paso}/${mapa.origen.x}/${mapa.origen.z}`;
  if (firma !== firmaCuadricula) {
    malla.geometry.dispose(); malla.geometry = T.crearGeometria(THREE, mapa);
    mallaAgua.geometry.dispose(); mallaAgua.geometry = T.crearGeometriaAgua(THREE, mapa);
    firmaCuadricula = firma;
    const ancho = (mapa.columnas - 1) * mapa.paso, fondo = (mapa.filas - 1) * mapa.paso;
    baseTerreno.scale.set(ancho, 1, fondo);
    baseTerreno.position.set(mapa.origen.x + ancho / 2, -2.55, mapa.origen.z + fondo / 2);
    $('ancho').value = ancho; $('fondo').value = fondo; $('resolucion').value = mapa.paso;
    $('dimensiones').textContent = `${ancho} × ${fondo} m · ${mapa.paso} m / muestra`;
    ultimoPunto = ultimoPuntoValido = impacto = null; if (pincel) pincel.visible = false;
  }
  T.actualizarGeometria(THREE, malla.geometry, mapa);
  T.actualizarGeometriaAgua(THREE, mallaAgua.geometry, mapa);
  mallaAgua.visible = mallaAgua.geometry.drawRange.count > 0;
  $('nombre').value = mapa.nombre; $('nivel-agua').value = mapa.agua.nivel;
  bloquesUI?.actualizar();
}
function mutarMapa(fn) {
  terminarTrazo();
  try {
    const antes = T.serializar(mapa), candidato = T.validar(mapa), resultado = fn(candidato);
    if (resultado === false) return false;
    const nuevo = T.validar(candidato);
    if (T.serializar(nuevo) === antes) return false;
    mapa = nuevo; refrescar(); recordar(antes); return resultado ?? true;
  } catch (e) { aviso(e.message); return false; }
}
function restaurar(serializado) { mapa = T.validar(JSON.parse(serializado)); refrescar(); cambiado(); }
function deshacer() {
  terminarTrazo(); if (!atras.length) return;
  adelante.push(T.serializar(mapa)); restaurar(atras.pop()); botonesHistorial();
}
function rehacer() {
  terminarTrazo(); if (!adelante.length) return;
  atras.push(T.serializar(mapa)); restaurar(adelante.pop()); botonesHistorial();
}
function elegirModo(nuevo) {
  if (nuevo === 'pintar' && material === 4) nuevo = 'agua';
  terminarTrazo(); modo = nuevo;
  if (nuevo !== 'camara' && seccion !== 'terreno') elegirSeccion('terreno');
  const etiqueta = document.querySelector(`[data-modo="${modo === 'agua' ? 'pintar' : modo}"] small`)?.textContent || modo;
  $('titulo-herramienta').textContent = etiqueta + (modo === 'agua' ? ' agua' : ''); $('estado-herramienta').textContent = etiqueta;
  $('navegar').setAttribute('aria-pressed', String(modo === 'camara'));
  document.querySelectorAll('[data-modo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === modo || (b.dataset.modo === 'pintar' && modo === 'agua'))));
  $('ajuste-altura').hidden = modo !== 'aplanar'; $('pista-pincel').textContent = pistas[modo];
  $('ajuste-agua').hidden = modo !== 'agua';
  visor.dataset.camara = String(modo === 'camara');
  if (controles) {
    controles.enabled = true;
    controles.mouseButtons.LEFT = modo === 'camara' ? THREE.MOUSE.ROTATE : null;
    controles.touches.ONE = modo === 'camara' ? THREE.TOUCH.ROTATE : null;
  }
  if (pincel) pincel.visible = false;
}
function elegirSeccion(nueva) {
  if (nueva === 'bloques' && modo === 'camara') elegirModo('subir');
  terminarTrazo(); seccion = nueva;
  $('panel-terreno').hidden = nueva !== 'terreno'; $('panel-bloques').hidden = nueva !== 'bloques';
  $('modo-terreno').setAttribute('aria-pressed', String(nueva === 'terreno'));
  $('modo-bloques').setAttribute('aria-pressed', String(nueva === 'bloques'));
  bloquesUI.activar(nueva === 'bloques');
  if (nueva === 'bloques') { $('titulo-herramienta').textContent = 'Modelar bloques'; abrirAjustes(true); }
  else $('titulo-herramienta').textContent = document.querySelector(`[data-modo="${modo === 'agua' ? 'pintar' : modo}"] small`)?.textContent || modo;
  controles.mouseButtons.LEFT = modo === 'camara' ? THREE.MOUSE.ROTATE : null;
  controles.touches.ONE = modo === 'camara' ? THREE.TOUCH.ROTATE : null;
  mostrarPincel(null);
}
function puntoEn(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  ndc.set((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1);
  camara.updateMatrixWorld(); raycaster.setFromCamera(ndc, camara);
  malla.updateMatrixWorld(true);
  const suelo = raycaster.intersectObject(malla, false)[0], bloque = bloquesUI?.intersectar(raycaster);
  impacto = bloque && (!suelo || bloque.distance < suelo.distance) ? bloque : suelo;
  if (impacto?.object !== malla && modo !== 'pintar' && seccion !== 'bloques') return null;
  return impacto?.point || null;
}
function mostrarPincel(punto) {
  dibujarPendiente = true;
  ultimoPunto = punto;
  if (punto) ultimoPuntoValido = punto.clone();
  pincel.visible = !!punto && modo !== 'camara' && seccion === 'terreno';
  if (!punto) return;
  $('coordenadas').textContent = `X ${punto.x.toFixed(2)}   Y ${punto.y.toFixed(2)}   Z ${punto.z.toFixed(2)} m`;
  const radio = Number($('radio').value), posiciones = pincel.geometry.attributes.position;
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI * 2, x = punto.x + Math.cos(a) * radio, z = punto.z + Math.sin(a) * radio;
    if (impacto && impacto.object !== malla) {
      const normal = impacto.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(impacto.object.matrixWorld));
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      const p = new THREE.Vector3(Math.cos(a) * radio, .04, Math.sin(a) * radio).applyQuaternion(q).add(punto);
      posiciones.setXYZ(i, p.x, p.y, p.z);
    } else {
      const cuadrado = $('forma').value === 'cuadrado', escala = cuadrado ? 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) : 1;
      const px = punto.x + (x - punto.x) * escala, pz = punto.z + (z - punto.z) * escala;
      posiciones.setXYZ(i, px, T.alturaEn(mapa, px, pz) + .08, pz);
    }
  }
  posiciones.needsUpdate = true;
  pincel.geometry.computeBoundingSphere();
}
function presionDe(evento) { return evento.pointerType === 'pen' && $('presion').checked ? Math.max(0, Math.min(1, evento.pressure)) : 1; }
function aplicar(punto, presion, factor = 1) {
  let activo = modo;
  const invertir = mouse.shift || $('invertir').checked;
  if (impacto?.object.userData.bloqueId) {
    if (modo !== 'pintar' || material > 3 || presion <= 0) return false;
    const b = mapa.bloques.find(b => b.id === impacto.object.userData.bloqueId);
    if (!b) return false;
    const cara = impacto.faceIndex, anterior = b.coloresCaras?.[cara] || b.color;
    const nuevo = '#' + new THREE.Color(anterior).lerp(new THREE.Color(T.PALETA[material].color), Math.min(1, Number($('fuerza').value) / 100 * presion * factor)).getHexString();
    if (nuevo === anterior) return false;
    b.coloresCaras ||= new Array(b.indices.length / 3).fill(b.color);
    b.coloresCaras[cara] = nuevo; mapa.version = 3; return true;
  }
  if (invertir && (activo === 'subir' || activo === 'bajar')) activo = activo === 'subir' ? 'bajar' : 'subir';
  if (invertir && activo === 'agua') activo = 'secar';
  return T.aplicar(mapa, { x: punto.x, z: punto.z, radio: Number($('radio').value), fuerza: Number($('fuerza').value) / 100 * .5 * factor, presion, modo: activo, material, altura: Number($('altura').value), dureza: Number($('dureza').value) / 100, forma: $('forma').value, invertir });
}
function empezarTrazo(e) {
  if (modo === 'camara') return;
  if (listo && seccion === 'bloques') { if (e.button === 0) bloquesUI.pointerDown(e); return; }
  if (!listo || e.button !== 0 || trazo) return;
  // Un solo puntero de dibujo; las manos no añaden trazos durante la entrada del lápiz.
  const punto = puntoEn(e.clientX, e.clientY); if (!punto) return;
  if (capturarPunto) {
    if (capturarPunto === 'altura') { $('altura').value = punto.y.toFixed(2); $('altura').dispatchEvent(new Event('input')); }
    else for (const eje of ['x', 'y', 'z']) $('punto-' + eje).value = punto[eje].toFixed(2);
    capturarPunto = null; abrirAjustes(true); aviso('Punto capturado. Ajusta los valores para aplicar.'); return;
  }
  e.preventDefault(); canvas.focus({ preventScroll: true });
  controles.enabled = false;
  trazo = { id: e.pointerId, antes: T.serializar(mapa), punto: punto.clone(), presion: presionDe(e), cambio: false, tiempo: performance.now(), distancia: 0, enTerreno: true, bloque: impacto?.object.userData.bloqueId || null };
  canvas.setPointerCapture(e.pointerId); mouse.shift = e.shiftKey;
  trazo.cambio = aplicar(punto, trazo.presion); if (trazo.cambio) refrescar();
  mostrarPincel(punto);
}
function mover(e) {
  if (!listo) return;
  if (trazo && e.pointerId !== trazo.id) return;
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.shift = e.shiftKey;
  const punto = puntoEn(e.clientX, e.clientY); mostrarPincel(punto);
  if (!trazo) return;
  if (!punto) { trazo.enTerreno = false; return; }
  e.preventDefault();
  if (!trazo.enTerreno) {
    trazo.punto.copy(punto); trazo.distancia = 0; trazo.tiempo = performance.now(); trazo.enTerreno = true;
  }
  const idBloque = impacto?.object.userData.bloqueId || null;
  if (idBloque || trazo.bloque) {
    trazo.bloque = idBloque; trazo.punto.copy(punto); trazo.presion = presionDe(e); trazo.tiempo = performance.now();
    const cambio = aplicar(punto, trazo.presion); trazo.cambio ||= cambio;
    if (cambio) refrescar(); return;
  }
  const distancia = punto.distanceTo(trazo.punto), paso = Math.max(.12, Number($('radio').value) * .12);
  const presion = presionDe(e); let cambio = false;
  if (distancia > .001) {
    let siguiente = paso - trazo.distancia;
    while (siguiente <= distancia) {
      const t = siguiente / distancia;
      cambio = aplicar(trazo.punto.clone().lerp(punto, t), trazo.presion + (presion - trazo.presion) * t) || cambio;
      siguiente += paso;
    }
    trazo.distancia = (trazo.distancia + distancia) % paso;
    trazo.punto.copy(punto); trazo.tiempo = performance.now();
  }
  trazo.presion = presion; trazo.cambio ||= cambio;
  if (cambio) { refrescar(); mostrarPincel(punto); }
}
function terminarTrazo(cancelar = false) {
  if (!trazo) return;
  const terminado = trazo; trazo = null;
  if (canvas.hasPointerCapture(terminado.id)) canvas.releasePointerCapture(terminado.id);
  controles.enabled = true;
  if (cancelar) { mapa = T.validar(JSON.parse(terminado.antes)); refrescar(); }
  else if (terminado.cambio) recordar(terminado.antes);
}
function encuadrar(cenital = false) {
  terminarTrazo();
  const ancho = (mapa.columnas - 1) * mapa.paso, fondo = (mapa.filas - 1) * mapa.paso;
  const aspecto = visor.clientWidth / Math.max(1, visor.clientHeight);
  camara.aspect = aspecto; camara.updateProjectionMatrix();
  controles.target.set(mapa.origen.x + ancho / 2, 0, mapa.origen.z + fondo / 2);
  const usable = visor.clientWidth > 700 ? Math.max(.4, (visor.clientWidth - 420) / visor.clientWidth) : .85;
  const radioMapa = Math.hypot(ancho, fondo) / 2;
  const distancia = radioMapa / Math.sin(Math.atan(Math.tan(THREE.MathUtils.degToRad(21)) * Math.min(1, aspecto * usable))) * 1.05;
  const desplazamiento = (cenital ? new THREE.Vector3(0, 1, .0001) : new THREE.Vector3(.65, .85, .8)).normalize().multiplyScalar(distancia);
  camara.position.copy(controles.target).add(desplazamiento);
  controles.update(); camara.updateMatrixWorld(); mostrarPincel(null);
}
function ajustarProyeccion() {
  const w = visor.clientWidth, h = visor.clientHeight;
  camara.aspect = w / h;
  if (w > 700) camara.setViewOffset(w, h, ($('inspector').hidden ? -80 : 220) / 2, 0, w, h);
  else if (!$('inspector').hidden) camara.setViewOffset(w, h, 0, $('inspector').offsetHeight / 2 + 25, w, h);
  else camara.clearViewOffset();
  camara.updateProjectionMatrix();
}
function abrirAjustes(abrir) {
  $('inspector').hidden = !abrir; $('ajustes-toggle').setAttribute('aria-expanded', String(abrir));
  if (camara) ajustarProyeccion();
}
function cambiarExtension(ancho, fondo, paso) {
  const resultado = mutarMapa(m => { Object.assign(m, T.redimensionar(m, ancho, fondo, paso)); });
  if (resultado !== false) { encuadrar(); aviso('Extensión actualizada. Puedes deshacer el recorte.'); }
}
function registrarUI() {
  for (const evento of ['click', 'input', 'change', 'pointerdown', 'pointerup']) document.addEventListener(evento, () => { dibujarPendiente = true; });
  abrirAjustes(!matchMedia('(max-width:700px)').matches);
  $('ajustes-toggle').addEventListener('click', () => abrirAjustes($('inspector').hidden));
  $('cerrar-ajustes').addEventListener('click', () => abrirAjustes(false));
  $('abrir-archivo').addEventListener('click', () => { terminarTrazo(); const abierto = $('panel-archivo').hidden; $('panel-archivo').hidden = !abierto; $('abrir-archivo').setAttribute('aria-expanded', String(abierto)); });
  $('pantalla').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { aviso('El navegador no permite pantalla completa aquí.'); }
  });
  $('navegar').addEventListener('click', () => {
    const volverABloques = seccion === 'bloques' && modo === 'camara';
    elegirModo(modo === 'camara' ? 'subir' : 'camara');
    if (volverABloques) elegirSeccion('bloques');
  });
  $('redimensionar').addEventListener('click', () => cambiarExtension(Number($('ancho').value), Number($('fondo').value), Number($('resolucion').value)));
  document.querySelectorAll('[data-extension]').forEach(b => b.addEventListener('click', () => {
    const delta = Number(b.dataset.extension);
    cambiarExtension((mapa.columnas - 1) * mapa.paso + delta, (mapa.filas - 1) * mapa.paso + delta, mapa.paso);
  }));
  $('aplicar-punto').addEventListener('click', () => {
    if (['x','y','z'].some(e => !$('punto-' + e).value.trim())) { aviso('Completa las tres coordenadas.'); return; }
    mutarMapa(m => T.fijarAltura(m, Number($('punto-x').value), Number($('punto-y').value), Number($('punto-z').value)));
  });
  for (const [id, tipo] of [['elegir-punto', 'punto'], ['muestrear-altura', 'altura']]) $(id).addEventListener('click', () => {
    capturarPunto = tipo; if (modo === 'camara') elegirModo('aplanar');
    if (matchMedia('(max-width:700px)').matches) abrirAjustes(false);
    aviso('Toca un punto del terreno para tomar sus coordenadas.');
  });
  for (const id of ['radio', 'fuerza']) $(id + '-numero').addEventListener('change', () => {
    const n = $(id + '-numero'); if (!n.value.trim() || !n.checkValidity()) { n.value = $(id).value; return; }
    $(id).value = n.value; $(id).dispatchEvent(new Event('input'));
  });
  document.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => elegirModo(b.dataset.modo)));
  for (const [id, unidad] of [['radio', 'm'], ['fuerza', '%'], ['altura', 'm'], ['dureza', '%']]) $(id).addEventListener('input', () => {
    if ($(id + '-numero')) $(id + '-numero').value = $(id).value;
    $(id + '-valor').textContent = `${Number($(id).value).toLocaleString('es')} ${unidad}`;
    if (ultimoPunto) mostrarPincel(ultimoPunto);
  });
  [...T.PALETA, T.AGUA].forEach((mat, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.material = i;
    b.setAttribute('aria-pressed', String(i === material));
    const muestra = document.createElement('span'); muestra.className = 'muestra'; muestra.style.background = mat.color;
    b.append(muestra, document.createTextNode(mat.nombre));
    b.addEventListener('click', () => { material = i; document.querySelectorAll('[data-material]').forEach(n => n.setAttribute('aria-pressed', String(Number(n.dataset.material) === i))); elegirModo('pintar'); });
    $('paleta').append(b);
  });
  $('modo-terreno').addEventListener('click', () => { elegirSeccion('terreno'); abrirAjustes(true); });
  $('modo-bloques').addEventListener('click', () => elegirSeccion('bloques'));
  $('nivel-agua').addEventListener('change', () => { const nivel = Number($('nivel-agua').value); mutarMapa(m => { m.agua.nivel = nivel; }); $('nivel-agua').value = mapa.agua.nivel; });
  $('deshacer').addEventListener('click', deshacer); $('rehacer').addEventListener('click', rehacer);
  let nombreAntes = '';
  $('nombre').addEventListener('focus', () => { terminarTrazo(); nombreAntes = T.serializar(mapa); });
  $('nombre').addEventListener('change', () => {
    const nombre = $('nombre').value.trim() || 'Mapa sin nombre';
    try {
      T.validar({ ...mapa, nombre });
      if (mapa.nombre !== nombre) { const antes = nombreAntes || T.serializar(mapa); mapa.nombre = nombre; recordar(antes); }
    } catch (e) { aviso(e.message); }
    $('nombre').value = mapa.nombre;
  });
  $('encuadrar').addEventListener('click', () => encuadrar()); $('cenital').addEventListener('click', () => encuadrar(true));
  $('rejilla').addEventListener('click', () => { rejilla.visible = !rejilla.visible; $('rejilla').setAttribute('aria-pressed', String(rejilla.visible)); });
  $('json').addEventListener('click', () => { terminarTrazo(); descargar(new Blob([T.serializar(mapa)], { type: 'application/json' }), nombreArchivo() + '.json'); guardar(); });
  $('png').addEventListener('click', async () => {
    terminarTrazo(); $('png').disabled = true;
    try {
      const { heightmap, splatmap, watermap } = await texturas(mapa), nombre = nombreArchivo();
      descargar(heightmap, nombre + '-altura16.png'); descargar(splatmap, nombre + '-mezcla.png'); descargar(watermap, nombre + '-agua.png');
      aviso('Tres PNG exportados: altura16, mezcla RGBA y agua. Conserva también el JSON con tus bloques.');
    } catch (e) { aviso('No se pudieron exportar las texturas: ' + e.message); }
    finally { $('png').disabled = false; }
  });
  $('importar').addEventListener('click', () => { terminarTrazo(); $('archivo').click(); });
  $('archivo').addEventListener('change', async e => {
    const archivo = e.target.files[0]; if (!archivo) return;
    try {
      if (archivo.size > 32 * 1024 * 1024) throw new Error('El archivo supera el límite de 32 MB.');
      const nuevo = T.validar(JSON.parse(await archivo.text()));
      terminarTrazo();
      const antes = T.serializar(mapa);
      mapa = nuevo; refrescar(); recordar(antes); encuadrar(); aviso('Mapa importado. Puedes deshacer para recuperar el anterior.');
    } catch (e) { aviso('No se abrió el mapa: ' + e.message); }
    e.target.value = '';
  });
  $('nuevo').addEventListener('click', () => { terminarTrazo(); $('nuevo-dialogo').showModal(); });
  $('nuevo-dialogo').addEventListener('close', () => {
    const accion = $('nuevo-dialogo').returnValue; if (!['relieve', 'plano'].includes(accion)) return;
    const antes = T.serializar(mapa); mapa = T.crear({ relieve: accion === 'relieve' }); refrescar(); recordar(antes); encuadrar();
  });
  $('probar').addEventListener('click', () => {
    terminarTrazo();
    try {
      localStorage.setItem(T.CLAVE_JUEGO, T.serializar(mapa)); guardar();
      window.open('../../Prototypes/Rocket%20Launcher/?terreno=editor', '_blank', 'noopener');
      aviso('Mapa enviado a War. El relieve es visual; las reglas de batalla se conservan.');
    } catch { aviso('No se pudo guardar el mapa para War. Descarga el JSON para conservarlo.'); }
  });
  canvas.addEventListener('pointerdown', empezarTrazo); canvas.addEventListener('pointermove', mover);
  canvas.addEventListener('pointerup', e => { if (trazo?.id === e.pointerId) terminarTrazo(); });
  canvas.addEventListener('pointercancel', e => { if (trazo?.id === e.pointerId) terminarTrazo(true); });
  canvas.addEventListener('lostpointercapture', e => { if (trazo?.id === e.pointerId) terminarTrazo(); });
  canvas.addEventListener('pointerleave', () => { if (!trazo) mostrarPincel(null); });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', () => terminarTrazo());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { terminarTrazo(); if (cambios) guardar(); } });
  window.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || $('nuevo-dialogo').open) return;
    if (e.key === 'Escape') { terminarTrazo(true); capturarPunto = null; $('panel-archivo').hidden = true; $('abrir-archivo').setAttribute('aria-expanded', 'false'); return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key.toLowerCase() === 'f') encuadrar();
      const modos = ['subir','bajar','inflar','detalle','suavizar','aplanar','pintar','camara'];
      if (/^[1-8]$/.test(e.key)) elegirModo(modos[Number(e.key)-1]);
      if (['[',']'].includes(e.key)) { $('radio').value = Number($('radio').value) + (e.key === '[' ? -.25 : .25); $('radio').dispatchEvent(new Event('input')); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); }
  });
  window.addEventListener('beforeunload', e => {
    terminarTrazo();
    if (revision !== guardadoRevision && !guardar()) { e.preventDefault(); e.returnValue = ''; }
  });
}
async function iniciar() {
  if (!T?.crear || !T?.crearGeometria) throw new Error('No se cargaron los módulos de terreno. Recarga la página.');
  let avisoInicial = '';
  try { const previo = localStorage.getItem(T.CLAVE_BORRADOR); mapa = previo ? T.validar(JSON.parse(previo)) : T.crear(); }
  catch { mapa = T.crear(); avisoInicial = 'No se pudo recuperar el borrador. Puedes abrir una copia JSON.'; }
  escena = new THREE.Scene(); escena.background = new THREE.Color('#26382f');
  escena.fog = new THREE.Fog('#26382f', 500, 1000);
  camara = new THREE.PerspectiveCamera(42, 1, .1, 1500);
  const forzarWebGL = new URLSearchParams(location.search).get('motor') === 'webgl';
  renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: forzarWebGL });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  try { await renderer.init(); }
  catch (e) {
    if (forzarWebGL) throw e;
    // Un canvas que ya pidió contexto WebGPU no puede pedir un contexto WebGL.
    // Sustituirlo antes de registrar gestos permite recuperar el visor completo.
    try { renderer.dispose(); } catch { /* La inicialización puede estar incompleta. */ }
    const respaldo = canvas.cloneNode(false); canvas.replaceWith(respaldo); canvas = respaldo;
    renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    await renderer.init();
    avisoInicial = 'WebGPU no pudo iniciar. El editor está usando WebGL 2.';
  }
  $('motor').textContent = renderer.backend.isWebGPUBackend ? '● WebGPU' : '● WebGL 2';
  escena.add(new THREE.HemisphereLight('#e8f1d6', '#3d4533', 2));
  const sol = new THREE.DirectionalLight('#fff0d1', 2.4); sol.position.set(-25, 50, 12); escena.add(sol);
  malla = new THREE.Mesh(T.crearGeometria(THREE, mapa), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 }));
  malla.name = 'Terreno editable'; escena.add(malla);
  mallaAgua = new THREE.Mesh(T.crearGeometriaAgua(THREE, mapa), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .72, roughness: .22, metalness: .15, depthWrite: false, side: THREE.DoubleSide }));
  mallaAgua.name = 'Agua'; mallaAgua.renderOrder = 1; escena.add(mallaAgua);
  mallaAgua.visible = mallaAgua.geometry.drawRange.count > 0;
  const base = baseTerreno = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#253322', roughness: 1 }));
  base.position.set(16, -2.55, 6); escena.add(base);
  rejilla = new THREE.GridHelper(32, 32, '#d6c389', '#859f6e');
  rejilla.scale.z = 18 / 32; rejilla.position.set(16, .025, 9); rejilla.material.transparent = true; rejilla.material.opacity = .45; escena.add(rejilla);
  const borde = new THREE.BufferGeometry().setFromPoints([[0,0,0],[32,0,0],[32,0,18],[0,0,18],[0,0,0]].map(p => new THREE.Vector3(...p)));
  const campo = new THREE.Line(borde, new THREE.LineBasicMaterial({ color: '#e3b873' })); campo.position.y = .045; escena.add(campo);
  const gPincel = new THREE.BufferGeometry(); gPincel.setAttribute('position', new THREE.BufferAttribute(new Float32Array(65 * 3), 3));
  pincel = new THREE.Line(gPincel, new THREE.LineBasicMaterial({ color: '#f7d78e', depthTest: false, transparent: true, opacity: .95 }));
  pincel.renderOrder = 5; pincel.visible = false; escena.add(pincel);
  controles = new OrbitControls(camara, canvas); controles.enableDamping = true; controles.dampingFactor = .12;
  controles.minDistance = 2; controles.maxDistance = 1000; controles.maxPolarAngle = Math.PI * .48;
  controles.mouseButtons.MIDDLE = THREE.MOUSE.PAN; controles.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controles.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  bloquesUI = crearBloquesUI({ THREE, escena, camara, canvas, contenedor: $('panel-bloques'), obtenerMapa: () => mapa, mutar: mutarMapa, estado: () => ({ punto: ultimoPuntoValido }), avisar: aviso });
  bloquesUI.actualizar(); bloquesUI.activar(false);
  refrescar(); registrarUI(); elegirModo('subir'); encuadrar(); $('nombre').value = mapa.nombre;
  $('nivel-agua').value = mapa.agua.nivel;
  const resize = new ResizeObserver(() => {
    const w = visor.clientWidth, h = visor.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); ajustarProyeccion(); dibujarPendiente = true;
  }); resize.observe(visor); resize.observe($('inspector'));
  listo = true; $('arranque').hidden = true;
  for (const id of ['json', 'png', 'importar', 'nuevo', 'probar']) $(id).disabled = false;
  function dibujar(ahora) {
    if (trazo?.enTerreno && ahora - trazo.tiempo > 75) {
      const cambio = aplicar(trazo.punto, trazo.presion, .35); trazo.cambio ||= cambio; trazo.tiempo = ahora;
      if (cambio) { refrescar(); mostrarPincel(trazo.punto); }
    }
    const cambioVista = controles.update();
    if (dibujarPendiente || cambioVista) { renderer.render(escena, camara); dibujarPendiente = false; }
    requestAnimationFrame(dibujar);
  }
  requestAnimationFrame(dibujar);
  // Superficie de inspección de solo lectura para QA y herramientas de desarrollo.
  window.__terreno = { get listo() { return listo; }, get motor() { return renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl'; }, get mapa() { return T.validar(mapa); }, proyectar(x, z, y = T.alturaEn(mapa, x, z)) { camara.updateMatrixWorld(); const p = new THREE.Vector3(x, y, z).project(camara), r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; } };
  if (avisoInicial) aviso(avisoInicial);
}
iniciar().catch(e => {
  console.error('Editor de terreno:', e);
  $('arranque').textContent = 'No se pudo iniciar el visor 3D. ' + e.message + ' Usa un navegador con WebGPU o WebGL 2 y abre esta página desde un servidor local o HTTPS.';
  $('motor').textContent = 'Visor no disponible';
});
