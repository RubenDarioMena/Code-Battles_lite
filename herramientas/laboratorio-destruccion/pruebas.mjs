// Verifica las secuencias, la conexión de la página y los recursos de Three.
// El rasterizado y el aspecto de cada demo los comprueba el orquestador.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as Three from '../../shared/vendor/three-r180/three.module.min.js';
import { iniciarLaboratorio } from './laboratorio.js';
import { escenario } from './escenas.js';
import { es, en } from './textos.js';

const html = readFileSync(new URL('index.html', import.meta.url), 'utf8');
for (const [, ruta] of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert(existsSync(new URL(ruta, import.meta.url)));
assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
for (const [, k] of html.matchAll(/data-i="([^"]+)"/g)) assert(k in es);
function simular(demo, t) {
  const s = escenario(demo);
  for (let paso = 0; paso < Math.floor(t * 60); paso++)s.avanzar();
  return s.mundo;
}
const vuelo = simular('cinetico', .35);
assert.equal(vuelo.estado().piezas[2].salida, 'vuelo');
const laser = simular('laser', .2).estado().piezas;
assert.equal(laser[2].funcionOriginal, 'sensor'); assert.equal(laser[2].funcion, null);
assert.deepEqual(laser.slice(0, 2), simular('laser', 0).estado().piezas.slice(0, 2));
assert.equal(simular('acido', 2).estado().piezas[2].salida, 'vuelo');
assert.equal(simular('corte', 1).estado().piezas.filter(p => p.id === 'cañón').length, 2);
const enFin = simular('comparar', 7);
assert(enFin.estado().terminada && enFin.estado().robots.every(r => r.caido));
const botin = enFin.botin(); assert.equal(botin.restos.length, 9);
const torsos = botin.restos.filter(r => r.pieza === 'torso').map(r => r.materiales[0].cantidad);
assert(torsos[0] > torsos[1] && torsos[1] > torsos[2]); assert.equal(botin.total.funciones.energia, 1);

let cuadros = 0, mallas = [], uniones = [], charcos = [], instancias, camara, tramos, emisor;
const T = {
  ...Three, WebGLRenderer: class {
    constructor({ canvas }) { this.domElement = canvas; }
    setPixelRatio(dpr) { this.dpr = dpr; }
    getPixelRatio() { return this.dpr; }
    setSize(w, h) { this.domElement.width = w * this.dpr; this.domElement.height = h * this.dpr; }
    render(scene, cam) {
      cuadros++; camara = cam; emisor = null; scene.updateMatrixWorld(); mallas = []; uniones = []; charcos = [];
      scene.traverse(o => {
        if (o.name === 'charco') { charcos.push(o); return; }
        if (o.name === 'acido-en-vuelo') instancias = o;
        if (o.name === 'puente') uniones.push(o);
        if (o.name === 'tramos-chorro') tramos = o;
        if (o.name === 'emisor-chorro') emisor = o;
        if (!o.material?.isShaderMaterial) return;
        o.onBeforeRender(this, scene, cam); mallas.push(o);
        assert(o.material.uniforms.mascara.value.isData3DTexture);
        assert.equal(o.material.uniforms.mascara.value.magFilter, Three.LinearFilter);
        assert(o.material.uniforms.alClip.value.elements.every(Number.isFinite));
      });
    }
  }
};
function tabla() {
  return {
    filas: [], replaceChildren() { this.filas = []; }, insertRow() {
      const celdas = []; this.filas.push(celdas);
      return { insertCell() { const c = { textContent: '' }; celdas.push(c); return c; } };
    }
  };
}
function abrir(search, ancho = 900, alto = 500) {
  const nodos = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, {
    textContent: '', value: '', selectedIndex: 0, setAttribute() { }, add(o) { if (!this.value) this.value = o.value; }
  }]));
  const cuerpo = tabla(), pie = tabla(), canvas = nodos.escena;
  nodos.botin.querySelector = s => s === 'tbody' ? cuerpo : pie;
  nodos.potencia.value = '1';
  Object.assign(canvas, { clientWidth: ancho, clientHeight: alto, getBoundingClientRect: () => ({ left: 0, top: 0, width: ancho, height: alto }), setPointerCapture() { } });
  let siguiente;
  Object.assign(globalThis, {
    location: { search }, devicePixelRatio: 2, requestAnimationFrame: f => { siguiente = f; },
    document: { documentElement: {}, querySelectorAll: () => [], getElementById: id => nodos[id] },
    Option: class { constructor(_, v) { this.value = v; } }, window: { addEventListener() { } },
  });
  iniciarLaboratorio(T);
  return { nodos, cuerpo, pie, cuadro: t => siguiente(t) };
}
const pausa = abrir('?demo=laser&t=0.2');
assert.equal(pausa.nodos.reloj.textContent, 'Batalla · 0.20 s');
pausa.cuadro(100); pausa.cuadro(300); assert.equal(pausa.nodos.reloj.textContent, 'Batalla · 0.20 s');
const cabeza = mallas[2];
assert.equal(cabeza.material.uniforms.n.value, 1);
assert(cabeza.material.uniforms.mascara.value.image.data.includes(0));
pausa.nodos.pausa.onclick(); pausa.nodos.ritmo.selectedIndex = 1; pausa.cuadro(500);
assert.equal(pausa.nodos.reloj.textContent, 'Batalla · 0.25 s');
pausa.nodos.reiniciar.onclick();
const v = new T.Vector3(0, .82, 0).project(camara);
const ev = { clientX: (v.x + 1) * 450, clientY: (1 - v.y) * 250, pointerId: 1 };
pausa.nodos.escena.onpointerdown(ev); pausa.nodos.escena.onpointerup(ev);
assert.equal(pausa.nodos.mensaje.textContent, 'Torreta / cabeza');
const q = abrir('?demo=comparar&fin');
assert(q.nodos.fin.disabled); assert.equal(q.nodos.botin.hidden, false);
assert.equal(q.cuerpo.filas.length, 9); assert.equal(q.pie.filas.length, 4);
assert.equal(q.pie.filas.at(-1)[0].textContent, 'Total'); assert(mallas.every(m => m.visible && m.material.uniforms.normalidad.value === 1));
q.nodos.reiniciar.onclick(); assert(q.nodos.botin.hidden); assert.equal(q.nodos.fin.disabled, false);
// También en vertical, la escena libre y el lugar donde cae la cabeza caben en cámara.
for (const demo of ['libre', 'cinetico']) for (const [ancho, alto] of [[960, 520], [340, 390]]) {
  abrir('?demo=' + demo + '&t=2', ancho, alto);
  for (const mesh of mallas) {
    const caja = mesh.geometry.boundingBox;
    for (const x of [caja.min.x, caja.max.x]) for (const y of [caja.min.y, caja.max.y]) for (const z of [caja.min.z, caja.max.z]) {
      const v = mesh.localToWorld(new T.Vector3(x, y, z)).project(camara);
      assert(Math.abs(v.x) < 1 && Math.abs(v.y) < 1, demo + ' ' + ancho + '×' + alto);
    }
  }
}
abrir('?demo=puente&t=10.5');
assert.equal(uniones.length, 1);
const vertices = uniones[0].geometry.getAttribute('position');
assert(vertices.count >= 24 && vertices.array.every(Number.isFinite));
abrir('?demo=puente&t=12');
assert.equal(uniones.length, 0);
const tanque = abrir('?demo=tanque&fin');
assert.equal(tanque.cuerpo.filas.length, 7);
const texturaCasco = mallas[0].material.uniforms.mascara.value, datos = texturaCasco.image.data;
assert.equal(texturaCasco.format, Three.RGFormat);
const pares = new Set();
for (let i = 0; i < datos.length; i += 2) pares.add(datos[i] + '/' + datos[i + 1]);
assert.deepEqual(pares, new Set(['255/255', '0/255', '0/0']));
// Misma cámara que dibuja el laboratorio, mismo DDA que recibe los clics.
const origen = [camara.position.x, -camara.position.z, camara.position.y];
for (const segundo of [0, 3.33]) {
  const m = simular('tanque', segundo);
  for (const h of m.estado().piezas.filter(p => ['motor', 'municion', 'bateria'].includes(p.id))) {
    const impacto = m.raycast({ origen, direccion: h.pos.map((v, k) => v - origen[k]) });
    assert.equal(impacto?.pieza, segundo ? h.id : 'casco');
  }
}
const granada = abrir('?demo=granada&t=.4&captura');
assert.equal(granada.nodos.arma.value, 'granada'); assert(instancias.count >= 2);
abrir('?demo=granada&t=2.6&captura');
assert(charcos.some(c => c.material.uniforms.activo.value === 1));
assert(mallas.some(m => m.material.uniforms.meta.value.some(v => v.x === 3)));
abrir('?demo=granada&t=8.3&captura');
assert(charcos.some(c => c.material.uniforms.activo.value === 0 && c.material.uniforms.secado.value > 0));
for (const modo of ['chorro','chorro-caotico']) {
  const lab = abrir('?demo='+modo+'&t=.67&captura');
  assert.equal(lab.nodos.controlViento.hidden, modo === 'chorro');
  assert(instancias.isInstancedMesh && instancias.count > 10);
  assert(instancias.instanceMatrix.array.every(Number.isFinite));
  lab.cuadro(100); lab.cuadro(200); assert.equal(lab.nodos.reloj.textContent,'Batalla · 0.67 s');
}
for (const [ancho, alto] of [[960, 520], [340, 390]]) {
  for (const [demo, tiempo] of [['chorro', .88], ['chorro', .9], ['chorro', 1.45], ['chorro-caotico', .88]]) {
    abrir('?demo=' + demo + '&t=' + tiempo + '&captura', ancho, alto);
    const plena = demo === 'chorro' && tiempo <= .9;
    const e = simular(demo, tiempo).estado();
    const longitudes = [];
    for (let i = 0; i < tramos.count; i++) {
      const matriz = new T.Matrix4(); tramos.getMatrixAt(i, matriz);
      const escala = new T.Vector3().setFromMatrixScale(matriz);
      assert(escala.x * 2 >= .025 && escala.x * 2 <= .045); // Tubo de 2,6–4 cm: se lee a la distancia de la toma.
      longitudes.push(escala.y);
    }
    if (plena) {
      // Una unión por cada par de gotas, otra a la boca y otra al impacto.
      assert.equal(tramos.count, e.proyectiles.length + 1);
      const longitud = longitudes.reduce((s, x) => s + x, 0);
      assert(longitud >= 6 && longitud < 6.3);
    } else {
      assert(tramos.count > 0 && tramos.count < e.proyectiles.length / 2);
      if (demo === 'chorro-caotico') assert(Math.max(...longitudes) < .091);
    }
    for (const mesh of [emisor, ...mallas]) {
      mesh.geometry.computeBoundingBox();
      const { min, max } = mesh.geometry.boundingBox;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
        const v = mesh.localToWorld(new T.Vector3(x, y, z)).project(camara);
        assert(Math.abs(v.x) < .99 && Math.abs(v.y) < .99, 'emisor y blanco dentro del encuadre');
      }
    }
  }
}
assert(cuadros >= 5);
console.log('Laboratorio · diez guiones, gotas instanciadas, charco y secado, bisagra, visibilidad de interiores, disparo desde cámara, pausa, velocidad, reinicio, texturas 3D y tabla final en Node, sin rasterizar.');
