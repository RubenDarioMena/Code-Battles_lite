// Mando táctil de V2 (paquetes/interfaz/mando-tactil.js) con un DOM mínimo: la zona de ratón mueve el cursor,
// L y R envían clics de ratón al lienzo bajo el cursor, L mantenido + arrastre llega como movimiento al lienzo,
// el joystick desplaza la cámara y el botón de mostrar/ocultar se recuerda.
import assert from 'node:assert/strict';
import { montarMandoTactil } from '../paquetes/interfaz/mando-tactil.js';

class El {
  constructor(tag) { Object.assign(this, { tagName: tag.toUpperCase(), hijos: [], oyentes: {}, style: {}, hidden: false, padre: null, atributos: {} }); }
  append(h) { h.padre = this; this.hijos.push(h); }
  remove() { if (this.padre) this.padre.hijos = this.padre.hijos.filter(h => h !== this); }
  contains(e) { for (let p = e; p; p = p.padre) if (p === this) return true; return false; }
  addEventListener(k, f) { (this.oyentes[k] ??= []).push(f); }
  dispatchEvent(ev) { ev.target ??= this; for (const f of this.oyentes[ev.type] ?? []) f(ev); return true; }
  setAttribute(k, v) { this.atributos[k] = v; }
  setPointerCapture() {}
  get classList() { const el = this; return { add: c => { el.className += ' ' + c; }, remove: c => { el.className = el.className.replace(' ' + c, ''); },
    toggle: (c, si) => { el.className = el.className.replace(' ' + c, '') + (si ? ' ' + c : ''); } }; }
  getBoundingClientRect() { return this.rect ?? { left: 0, top: 0, width: 0, height: 0 }; }
}
const campo = new El('div'), lienzo = new El('canvas');
campo.rect = { left: 0, top: 0, width: 400, height: 600 };
campo.append(lienzo);
const recibidos = [];
for (const tipo of ['pointerdown', 'pointermove', 'pointerup']) lienzo.addEventListener(tipo, ev => recibidos.push([tipo, ev.button, ev.clientX, ev.clientY, ev.pointerType]));
const marcos = [];
Object.assign(globalThis, {
  document: { createElement: tag => new El(tag), elementsFromPoint: () => [campo.hijos.find(h => h.className === 'mando-tactil'), lienzo] },
  PointerEvent: class { constructor(type, o) { Object.assign(this, { type }, o); } },
  requestAnimationFrame: f => { marcos.push(f); return marcos.length; }, cancelAnimationFrame() {},
  location: { search: '' }, matchMedia: () => ({ matches: true }),
});
const pasos = [], guardado = new Map();
const almacen = { leer: k => guardado.get(k) ?? null, escribir: (k, v) => guardado.set(k, v) };
const mando = montarMandoTactil(campo, { desplazar: (dx, dy) => pasos.push([dx, dy]), almacen });
const buscar = clase => { const pila = [campo]; while (pila.length) { const e = pila.pop(); if (e.className?.split(' ').includes(clase)) return e; pila.push(...e.hijos); } };
const ev = (tipo, x, y, pointerId = 1) => ({ type: tipo, clientX: x, clientY: y, pointerId, button: 0, preventDefault() {}, stopPropagation() {} });
const toque = (el, tipo, x, y, id) => el.dispatchEvent(ev(tipo, x, y, id));

// Visible por omisión en pantallas táctiles; el cursor arranca en el centro del campo.
assert.equal(mando.visible, true);
assert.deepEqual(mando.cursor(), { x: 200, y: 300, puesto: true });

// Zona de ratón: arrastre relativo × 1,6.
const zona = buscar('mando-raton');
toque(zona, 'pointerdown', 300, 500); toque(zona, 'pointermove', 250, 450); toque(zona, 'pointerup', 250, 450);
assert.deepEqual(mando.cursor(), { x: 120, y: 220, puesto: true });
assert.equal(recibidos.length, 0, 'mover el cursor sin botón no toca el lienzo');

// L: clic izquierdo de ratón en el cursor; R: clic derecho.
const izq = buscar('mando-izq'), der = buscar('mando-der');
toque(izq, 'pointerdown', 0, 0, 5); toque(izq, 'pointerup', 0, 0, 5);
toque(der, 'pointerdown', 0, 0, 6); toque(der, 'pointerup', 0, 0, 6);
assert.deepEqual(recibidos.splice(0), [['pointerdown', 0, 120, 220, 'mouse'], ['pointerup', 0, 120, 220, 'mouse'],
  ['pointerdown', 2, 120, 220, 'mouse'], ['pointerup', 2, 120, 220, 'mouse']]);

// L mantenido + arrastre en la zona: el lienzo recibe el movimiento (recuadro o apuntar) y suelta donde acaba.
toque(izq, 'pointerdown', 0, 0, 5);
toque(zona, 'pointerdown', 300, 500, 2); toque(zona, 'pointermove', 310, 520, 2);
toque(izq, 'pointerup', 0, 0, 5);
assert.deepEqual(recibidos.splice(0), [['pointerdown', 0, 120, 220, 'mouse'], ['pointermove', -1, 136, 252, 'mouse'], ['pointerup', 0, 136, 252, 'mouse']]);

// El cursor no sale del campo.
toque(zona, 'pointermove', 2000, -2000, 2); toque(zona, 'pointerup', 0, 0, 2);
assert.deepEqual(mando.cursor(), { x: 399, y: 0, puesto: true });

// Joystick: palanca arriba a fondo → la cámara avanza (arrastre hacia abajo) cada fotograma; al soltar se para.
const joy = buscar('mando-joystick');
joy.rect = { left: 0, top: 0, width: 112, height: 112 };
toque(joy, 'pointerdown', 56, 56, 9); toque(joy, 'pointermove', 56, -100, 9);
marcos.shift()(); marcos.shift()();
assert.equal(pasos.length, 2);
assert.ok(Math.abs(pasos[0][0]) < 1e-9 && pasos[0][1] > 8, JSON.stringify(pasos[0]));
toque(joy, 'pointerup', 56, -100, 9);
marcos.shift()?.();
assert.equal(pasos.length, 2, 'al soltar el joystick la cámara se para');
// Zona muerta: un toque casi en el centro no mueve.
toque(joy, 'pointerdown', 58, 57, 9); marcos.shift()(); toque(joy, 'pointerup', 58, 57, 9);
assert.equal(pasos.length, 2);

// Ocultar: se recuerda y deja de mandar clics.
const alternar = campo.hijos.find(h => h.className?.startsWith('mando-alternar'));
alternar.dispatchEvent({ type: 'click', stopPropagation() {} });
assert.equal(mando.visible, false);
assert.equal(guardado.get('cv2-mando'), '0');
assert.equal(buscar('mando-tactil').hidden, true);
mando.destruir();
assert.equal(campo.hijos.length, 1);
console.log('Mando táctil V2: zona de ratón, clics L/R al lienzo, arrastre con L, cursor dentro del campo, joystick con zona muerta y ocultar recordado.');
