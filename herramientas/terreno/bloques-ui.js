// Blocking y edición de vértices/caras; los cambios de documento pasan por mutar().
export function crearBloquesUI({ THREE, escena, camara, canvas, contenedor, obtenerMapa, mutar, estado, avisar }) {
  const T = window.CMGTerreno;
  if (!T?.BLOQUES) throw new Error('No se cargaron las herramientas de bloques.');
  const B = T.BLOQUES, seleccion = new Set(), objetos = new Map();
  const grupo = new THREE.Group(), ayudas = new THREE.Group();
  const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let activo = false, modo = 'objeto', principal = null, vertice = null, cara = null;
  let firma = null, ultimoLugar = { x: 16, z: 9 }, destruido = false;
  grupo.name = 'Bloques editables'; ayudas.name = 'Selección de bloques';
  escena.add(grupo, ayudas);

  contenedor.innerHTML = `
    <div class="bloques-intro"><p class="ceja">CONSTRUIR LA ESCENA</p><h2>Bloques y polígonos</h2><p>Crea volúmenes sencillos y ajusta su forma. Son elementos visuales del mapa.</p></div>
    <fieldset class="bloques-crear"><legend>Añadir una primitiva</legend><div class="bloques-botones">
      <button type="button" data-bloque-crear="caja">＋ Caja</button><button type="button" data-bloque-crear="rampa">＋ Rampa</button>
      <button type="button" data-bloque-crear="cilindro">＋ Cilindro</button><button type="button" data-bloque-crear="plano">＋ Plano</button>
    </div><p class="bloques-ayuda">Se añade junto al último punto señalado; por defecto, en el centro del campo.</p></fieldset>
    <div class="bloques-modos" role="group" aria-label="Modo de selección">
      <button type="button" data-bloque-modo="objeto" aria-pressed="true">Objeto</button>
      <button type="button" data-bloque-modo="vertice" aria-pressed="false">Vértice</button>
      <button type="button" data-bloque-modo="cara" aria-pressed="false">Cara</button>
    </div>
    <p class="bloques-ayuda" data-bloques-pista></p>
    <fieldset class="bloques-escena"><legend>Objetos de la escena <span data-bloques-cuenta></span></legend>
      <div class="bloques-lista" data-bloques-lista></div>
      <div class="bloques-acciones"><button type="button" data-bloques-unir disabled>Unir mallas</button><button type="button" data-bloques-eliminar disabled>Eliminar</button></div>
      <p class="bloques-ayuda">Shift + clic añade objetos a la selección. Las casillas también permiten seleccionar varios.</p>
    </fieldset>
    <section class="bloques-inspector" aria-label="Propiedades del objeto" data-bloques-inspector hidden>
      <h3 data-bloques-titulo></h3><p class="bloques-ayuda" data-bloques-seleccion></p>
      <div data-bloques-objeto>
        <div class="bloques-identidad"><label>Nombre<input data-bloques-nombre type="text" maxlength="80"></label><label>Color<input data-bloques-color type="color"></label></div>
        <fieldset><legend>Posición en el mundo (m)</legend><div class="bloques-xyz" data-bloques-posicion></div></fieldset>
        <fieldset><legend>Rotación (grados)</legend><div class="bloques-xyz" data-bloques-rotacion></div></fieldset>
        <fieldset><legend>Escala</legend><div class="bloques-xyz" data-bloques-escala></div></fieldset>
        <button type="button" class="bloques-aplicar" data-bloques-aplicar-objeto>Aplicar al objeto activo</button>
      </div>
      <div data-bloques-vertice hidden><p class="bloques-ayuda" data-bloques-vertice-info></p>
        <fieldset data-bloques-vertice-campos disabled><legend>Vértice en coordenadas locales (m)</legend><div class="bloques-xyz" data-bloques-vertice-xyz></div>
          <button type="button" class="bloques-aplicar" data-bloques-aplicar-vertice>Aplicar al vértice</button>
        </fieldset>
      </div>
      <div data-bloques-cara hidden><p class="bloques-ayuda" data-bloques-cara-info></p>
        <fieldset data-bloques-cara-campos disabled><legend>Extruir la cara triangular</legend>
          <label class="bloques-distancia">Distancia local (m)<input type="number" min="-8" max="8" step="0.25" value="1" data-bloques-distancia></label>
          <button type="button" class="bloques-aplicar" data-bloques-extruir>Extruir cara</button>
        </fieldset><p class="bloques-ayuda">La distancia sigue la normal local. Unir mallas conserva las piezas; no elimina sus intersecciones.</p>
      </div>
    </section>`;
  const $ = selector => contenedor.querySelector(selector);
  const vectores = [
    ['posicion', -256, 256, .1], ['rotacion', -360, 360, 5],
    ['escala', .05, 20, .05], ['vertice-xyz', -256, 256, .1],
  ];
  for (const [nombre, min, max, paso] of vectores) {
    const fila = $(`[data-bloques-${nombre}]`);
    for (const [i, eje] of ['X', 'Y', 'Z'].entries()) {
      const label = document.createElement('label'), input = document.createElement('input');
      label.append(document.createTextNode(eje)); input.type = 'number'; input.min = min; input.max = max; input.step = paso;
      input.dataset.bloquesEje = i; input.setAttribute('aria-label', `${nombre === 'vertice-xyz' ? 'Vértice' : nombre} ${eje}`);
      label.append(input); fila.append(label);
    }
  }
  const avisarError = error => avisar?.(error?.message || String(error));
  const bloqueActivo = () => obtenerMapa().bloques.find(b => b.id === principal) || null;

  function liberar(objeto) {
    objeto.traverse(n => {
      if (n.isInstancedMesh) n.dispose();
      n.geometry?.dispose();
      if (Array.isArray(n.material)) n.material.forEach(m => m.dispose());
      else n.material?.dispose();
    });
    objeto.clear();
  }
  function ajustarPrincipal() {
    const validos = new Set(obtenerMapa().bloques.map(b => b.id));
    for (const id of seleccion) if (!validos.has(id)) seleccion.delete(id);
    if (!seleccion.has(principal)) { principal = [...seleccion].at(-1) || null; vertice = cara = null; }
    const b = bloqueActivo();
    if (b && (vertice === null || vertice >= b.vertices.length / 3)) vertice = null;
    if (b && (cara === null || cara >= b.indices.length / 3)) cara = null;
  }
  function ponerVector(nombre, valores) {
    $(`[data-bloques-${nombre}]`).querySelectorAll('input').forEach((n, i) => {
      n.value = Number(valores[i].toFixed(5));
      n.dataset.bloquesTexto = n.value; n.dataset.bloquesValor = String(valores[i]);
    });
  }
  function leerNumero(input, nombre) {
    const numero = Number(input.value), min = Number(input.min), max = Number(input.max);
    if (!input.value.trim() || !Number.isFinite(numero) || numero < min || numero > max) {
      throw new Error(`${nombre}: escribe un número entre ${min} y ${max}.`);
    }
    // Los valores sin editar conservan toda su precisión aunque la vista los abrevie.
    return input.value === input.dataset.bloquesTexto ? Number(input.dataset.bloquesValor) : numero;
  }
  function leerVector(nombre) {
    return [...$(`[data-bloques-${nombre}]`).querySelectorAll('input')].map((n, i) => leerNumero(n, `${nombre} ${'XYZ'[i]}`));
  }
  function dibujarLista() {
    const lista = $('[data-bloques-lista]'), bloques = obtenerMapa().bloques;
    lista.replaceChildren(); $('[data-bloques-cuenta]').textContent = `(${bloques.length}/64)`;
    if (!bloques.length) {
      const vacio = document.createElement('p'); vacio.className = 'bloques-vacio'; vacio.textContent = 'Añade una primitiva para empezar.'; lista.append(vacio);
    }
    for (const bloque of bloques) {
      const label = document.createElement('label'), checkbox = document.createElement('input');
      const nombre = document.createElement('span'), detalle = document.createElement('small');
      label.className = 'bloques-fila'; label.classList.toggle('bloques-activo', bloque.id === principal);
      checkbox.type = 'checkbox'; checkbox.dataset.bloqueId = bloque.id; checkbox.checked = seleccion.has(bloque.id);
      checkbox.setAttribute('aria-label', `Seleccionar ${bloque.nombre}`);
      nombre.textContent = bloque.nombre; detalle.textContent = `${bloque.vertices.length / 3} vértices`;
      label.append(checkbox, nombre, detalle); lista.append(label);
    }
    $('[data-bloques-unir]').disabled = seleccion.size < 2;
    $('[data-bloques-eliminar]').disabled = seleccion.size === 0;
    contenedor.querySelectorAll('[data-bloque-crear]').forEach(b => { b.disabled = bloques.length >= 64; });
  }
  function dibujarPanel() {
    dibujarLista();
    contenedor.querySelectorAll('[data-bloque-modo]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bloqueModo === modo)));
    $('[data-bloques-pista]').textContent = {
      objeto: 'Haz clic en un objeto para seleccionarlo. Ajusta sus valores y pulsa Aplicar.',
      vertice: 'Selecciona un objeto y toca un punto amarillo. Sus coordenadas son locales al objeto.',
      cara: 'Haz clic en una cara triangular para resaltarla y extruirla.',
    }[modo];
    const b = bloqueActivo(); $('[data-bloques-inspector]').hidden = !b;
    if (!b) return;
    $('[data-bloques-titulo]').textContent = b.nombre;
    $('[data-bloques-seleccion]').textContent = `${seleccion.size} seleccionado${seleccion.size === 1 ? '' : 's'} · Los campos editan el objeto activo.`;
    $('[data-bloques-objeto]').hidden = modo !== 'objeto';
    $('[data-bloques-vertice]').hidden = modo !== 'vertice';
    $('[data-bloques-cara]').hidden = modo !== 'cara';
    $('[data-bloques-nombre]').value = b.nombre; $('[data-bloques-color]').value = b.color;
    ponerVector('posicion', b.posicion); ponerVector('rotacion', b.rotacion.map(n => n * 180 / Math.PI)); ponerVector('escala', b.escala);
    $('[data-bloques-vertice-info]').textContent = vertice === null ? 'Toca uno de los puntos del objeto en el visor.' : `Vértice ${vertice + 1} de ${b.vertices.length / 3}.`;
    $('[data-bloques-vertice-campos]').disabled = vertice === null;
    if (vertice !== null) ponerVector('vertice-xyz', b.vertices.slice(vertice * 3, vertice * 3 + 3));
    $('[data-bloques-cara-info]').textContent = cara === null ? 'Toca una cara del objeto en el visor.' : `Cara triangular ${cara + 1} de ${b.indices.length / 3}.`;
    $('[data-bloques-cara-campos]').disabled = cara === null;
  }
  function dibujarAyudas() {
    liberar(ayudas); ayudas.visible = activo;
    for (const [id, objeto] of objetos) {
      objeto.borde.material.color.set(activo && seleccion.has(id) ? '#f6ca77' : '#273632');
      objeto.borde.material.opacity = activo && seleccion.has(id) ? 1 : .55;
    }
    const b = bloqueActivo(), objeto = objetos.get(principal);
    if (!activo || !b || !objeto) return;
    objeto.mesh.updateMatrixWorld(true);
    if (modo === 'vertice') {
      const geometria = new THREE.SphereGeometry(.13, 7, 5);
      const material = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, depthWrite: false });
      const puntos = new THREE.InstancedMesh(geometria, material, b.vertices.length / 3);
      const matriz = new THREE.Matrix4(), posicion = new THREE.Vector3();
      for (let i = 0; i < b.vertices.length / 3; i++) {
        posicion.fromArray(b.vertices, i * 3).applyMatrix4(objeto.mesh.matrixWorld);
        matriz.makeTranslation(posicion.x, posicion.y, posicion.z); puntos.setMatrixAt(i, matriz);
        puntos.setColorAt(i, new THREE.Color(i === vertice ? '#ffffff' : '#efba66'));
      }
      puntos.renderOrder = 12; puntos.frustumCulled = false; ayudas.add(puntos);
    }
    if (modo === 'cara' && cara !== null) {
      const puntos = b.indices.slice(cara * 3, cara * 3 + 3).map(i => new THREE.Vector3().fromArray(b.vertices, i * 3).applyMatrix4(objeto.mesh.matrixWorld));
      const geometria = new THREE.BufferGeometry().setFromPoints(puntos);
      const resaltado = new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({ color: '#ffd285', transparent: true, opacity: .5, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
      resaltado.renderOrder = 10; ayudas.add(resaltado);
      const borde = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(puntos), new THREE.LineBasicMaterial({ color: '#ffe6ae', depthTest: false }));
      borde.renderOrder = 11; ayudas.add(borde);
    }
  }
  function refrescarSeleccion() { ajustarPrincipal(); dibujarAyudas(); dibujarPanel(); }
  function seleccionar(id, sumar = false) {
    if (!sumar) seleccion.clear();
    if (id) {
      if (sumar && seleccion.has(id)) seleccion.delete(id);
      else seleccion.add(id);
    }
    const nuevo = id && seleccion.has(id) ? id : [...seleccion].at(-1) || null;
    if (nuevo !== principal) vertice = cara = null;
    principal = nuevo; refrescarSeleccion();
  }
  function actualizar() {
    if (destruido) return;
    const mapa = obtenerMapa(), nuevaFirma = JSON.stringify(mapa.bloques);
    if (nuevaFirma === firma) return;
    firma = nuevaFirma; liberar(grupo); objetos.clear(); ajustarPrincipal();
    for (const bloque of mapa.bloques) {
      const geometria = B.geometria(THREE, bloque);
      const material = new THREE.MeshStandardMaterial({ color: bloque.color, flatShading: true, roughness: .86, metalness: 0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometria, material);
      mesh.name = bloque.nombre; mesh.userData.bloqueId = bloque.id;
      mesh.position.fromArray(bloque.posicion); mesh.rotation.set(...bloque.rotacion); mesh.scale.fromArray(bloque.escala);
      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(geometria, 25), new THREE.LineBasicMaterial({ color: '#273632', transparent: true, opacity: .55 }));
      borde.raycast = () => {}; mesh.add(borde); grupo.add(mesh); objetos.set(bloque.id, { mesh, borde });
    }
    grupo.updateMatrixWorld(true); refrescarSeleccion();
  }
  function cambiar(fn, despues) {
    try {
      const resultado = mutar(fn);
      if (resultado === false) return false;
      despues?.(resultado); actualizar(); refrescarSeleccion(); return true;
    } catch (error) { avisarError(error); return false; }
  }
  function editarObjeto() {
    if (!principal) return;
    const id = principal, nombre = $('[data-bloques-nombre]').value.trim(), color = $('[data-bloques-color]').value;
    if (!nombre || nombre.length > 80 || /[\u0000-\u001f\u007f]/.test(nombre)) throw new Error('El nombre debe tener entre 1 y 80 caracteres, sin caracteres de control.');
    const original = bloqueActivo(); if (!original) return;
    const entradasRotacion = [...$('[data-bloques-rotacion]').querySelectorAll('input')];
    const posicion = leerVector('posicion'), rotacion = leerVector('rotacion').map((n, i) =>
      entradasRotacion[i].value === entradasRotacion[i].dataset.bloquesTexto ? original.rotacion[i] : n * Math.PI / 180), escala = leerVector('escala');
    cambiar(mapa => {
      const b = mapa.bloques.find(n => n.id === id); if (!b) return false;
      const antes = JSON.stringify(b); Object.assign(b, { nombre, color, posicion, rotacion, escala });
      return JSON.stringify(b) !== antes;
    });
  }
  function editarVertice() {
    if (!principal || vertice === null) return;
    const id = principal, i = vertice, xyz = leerVector('vertice-xyz');
    cambiar(mapa => {
      const b = mapa.bloques.find(n => n.id === id); if (!b || i >= b.vertices.length / 3) return false;
      if (xyz.every((n, k) => n === b.vertices[i * 3 + k])) return false;
      b.vertices.splice(i * 3, 3, ...xyz); return true;
    });
  }
  function alClick(e) {
    const boton = e.target.closest('button'); if (!boton || !contenedor.contains(boton)) return;
    try {
      if (boton.dataset.bloqueCrear) {
        const punto = estado?.()?.punto;
        if (punto && Number.isFinite(punto.x) && Number.isFinite(punto.z)) ultimoLugar = { x: punto.x, z: punto.z };
        cambiar(m => B.crear(m, boton.dataset.bloqueCrear, ultimoLugar).id, id => { seleccion.clear(); seleccion.add(id); principal = id; vertice = cara = null; });
      } else if (boton.dataset.bloqueModo) {
        modo = boton.dataset.bloqueModo; vertice = cara = null; refrescarSeleccion();
      } else if (boton.hasAttribute('data-bloques-aplicar-objeto')) editarObjeto();
      else if (boton.hasAttribute('data-bloques-aplicar-vertice')) editarVertice();
      else if (boton.hasAttribute('data-bloques-extruir') && principal && cara !== null) {
        const id = principal, indice = cara, distancia = leerNumero($('[data-bloques-distancia]'), 'Distancia de extrusión');
        if (distancia === 0) throw new Error('La distancia de extrusión debe ser distinta de cero.');
        const hecho = cambiar(m => { const b = m.bloques.find(n => n.id === id); return b ? B.extruir(b, indice, distancia) : false; }, () => { cara = vertice = null; });
        if (!hecho) avisar?.('No se pudo extruir esta cara. Comprueba su forma y los límites de la malla.');
      } else if (boton.hasAttribute('data-bloques-unir') && seleccion.size >= 2) {
        const ids = [...seleccion];
        cambiar(m => B.unir(THREE, m, ids), id => { seleccion.clear(); seleccion.add(id); principal = id; cara = vertice = null; });
      } else if (boton.hasAttribute('data-bloques-eliminar') && seleccion.size) {
        const ids = [...seleccion]; cambiar(m => B.eliminar(m, ids), () => { seleccion.clear(); principal = cara = vertice = null; });
      }
    } catch (error) { avisarError(error); }
  }
  function alCambiar(e) {
    if (!e.target.matches('input[data-bloque-id]')) return;
    const id = e.target.dataset.bloqueId;
    if (e.target.checked) { seleccion.add(id); if (principal !== id) cara = vertice = null; principal = id; }
    else seleccion.delete(id);
    refrescarSeleccion();
  }
  function verticeCercano(clientX, clientY) {
    const bloque = bloqueActivo(), objeto = objetos.get(principal); if (!bloque || !objeto) return null;
    const r = canvas.getBoundingClientRect(), punto = new THREE.Vector3();
    objeto.mesh.updateMatrixWorld(true); camara.updateMatrixWorld();
    let mejor = null, distancia = 14;
    for (let i = 0; i < bloque.vertices.length / 3; i++) {
      punto.fromArray(bloque.vertices, i * 3).applyMatrix4(objeto.mesh.matrixWorld).project(camara);
      if (punto.z < -1 || punto.z > 1) continue;
      const d = Math.hypot(r.left + (punto.x + 1) / 2 * r.width - clientX, r.top + (1 - punto.y) / 2 * r.height - clientY);
      if (d <= distancia) { distancia = d; mejor = i; }
    }
    return mejor;
  }
  function pointerDown(e) {
    if (!activo || destruido || e.button !== 0) return false;
    e.preventDefault();
    const punto = estado?.()?.punto;
    if (punto && Number.isFinite(punto.x) && Number.isFinite(punto.z)) ultimoLugar = { x: punto.x, z: punto.z };
    if (modo === 'vertice') {
      const i = verticeCercano(e.clientX, e.clientY);
      if (i !== null) { vertice = i; cara = null; refrescarSeleccion(); return true; }
    }
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return true;
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    raycaster.setFromCamera(ndc, camara); grupo.updateMatrixWorld(true);
    const interseccion = raycaster.intersectObjects([...objetos.values()].map(o => o.mesh), false)[0];
    if (interseccion) {
      const id = interseccion.object.userData.bloqueId;
      if (modo === 'cara') { seleccionar(id); cara = interseccion.faceIndex; vertice = null; refrescarSeleccion(); }
      else seleccionar(id, modo === 'objeto' && e.shiftKey);
    } else if (!e.shiftKey) seleccionar(null);
    return true;
  }
  function activar(valor) { activo = Boolean(valor); contenedor.hidden = !activo; actualizar(); refrescarSeleccion(); }
  function dispose() {
    if (destruido) return; destruido = true;
    contenedor.removeEventListener('click', alClick); contenedor.removeEventListener('change', alCambiar);
    liberar(grupo); liberar(ayudas); escena.remove(grupo, ayudas); objetos.clear(); seleccion.clear();
  }
  contenedor.addEventListener('click', alClick); contenedor.addEventListener('change', alCambiar);
  actualizar(); contenedor.hidden = true;
  return { actualizar, activar, pointerDown, dispose };
}
