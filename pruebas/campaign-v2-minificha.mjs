// Campaign-V2 · minificha y fábrica papercraft: piezas puras que no necesitan navegador.
// - rotuloCorto: el rótulo de Campaign 1 («pickUp()») para los tokens de orden, en JS y en Python.
// - elegirFilas: solo las columnas de la ficha (no la leyenda), dos propiedades y tres órdenes.
// - crearMinificha: solo pinta en estado «tira», pone el dibujo de la clase y deja las filas tras la cabecera.
// - puertasDelMarco: la puerta del marco en metros, donde paso.js coloca el muro (x0 + 3).
import assert from 'node:assert/strict';
import { crearMinificha, elegirFilas, rotuloCorto, urlDibujo, DIBUJOS } from '../paquetes/interfaz/minificha.js';
import { puertasDelMarco, paletaFabrica } from '../paquetes/vista-3d/index.js';
import { niveles } from '../paquetes/reglas-campaign-v2/index.js';

assert.equal(rotuloCorto('await pickUp(lugar, pieza)'), 'pickUp()');
assert.equal(rotuloCorto('await ARM_01.deliver(lugar)'), 'ARM_01.deliver()');
assert.equal(rotuloCorto('light(color)'), 'light()');
assert.equal(rotuloCorto('await pick_up(lugar, pieza)'), 'pick_up()');
assert.equal(rotuloCorto('stopFire()'), 'stopFire()');

// DOM mínimo: lo justo para las consultas de la minificha.
class Nodo {
  constructor(clases = '', hijos = [], texto = '') {
    this.classList = new Set(clases.split(' ').filter(Boolean));
    this.classList.contains = c => this.classList.has(c);
    this.children = hijos; this.dataset = {}; this.textContent = texto; this.antes = []; this.despues = [];
  }
  cloneNode() { const c = new Nodo([...this.classList].join(' '), this.children.map(h => h.cloneNode()), this.textContent); c.dataset = { ...this.dataset }; return c; }
  append(...n) { this.children.push(...n); }
  prepend(...n) { this.antes.unshift(...n); }
  after(...n) { this.despues.push(...n); }
  set className(v) { this.classList = new Set(v.split(' ')); this.classList.contains = c => this.classList.has(c); }
  get className() { return [...this.classList].join(' '); }
  *recorrer() { for (const h of this.children) { yield h; yield* h.recorrer(); } }
  // «.ins-cols .fila-tk» y «.ins-cols .tk.tk-fn»: clases del último tramo dentro de un .ins-cols.
  querySelectorAll(sel) {
    const tramos = sel.split(' '), clases = tramos.at(-1).split('.').filter(Boolean);
    const raices = tramos.length > 1 ? [...this.recorrer()].filter(n => n.classList.has(tramos[0].slice(1))) : [this];
    return raices.flatMap(c => [...c.recorrer()].filter(n => clases.every(k => n.classList.has(k))));
  }
  querySelector(sel) { return sel === '.ins-cab' ? this.cab : this.querySelectorAll(sel)[0]; }
}
globalThis.document = { createElement: () => new Nodo(), baseURI: 'http://localhost:8779/Prototypes/Campaign-V2/index.html' };
const tok = (tipo, texto) => new Nodo(`tk tk-${tipo}`, [], texto);
const filaProp = (p, v) => new Nodo('fila-tk', [tok('prop', p), new Nodo('sep', [], '='), tok('num', v), new Nodo('nota', [], '/ 2')]);
const cols = new Nodo('ins-cols', [
  new Nodo('fila-tk', [tok('var', 'PRS_01')]),
  new Nodo('fila-tk', [tok('fn', 'start()')]), new Nodo('fila-tk', [tok('fn', 'stop()')]),
  new Nodo('fila-tk', [tok('fn', 'light(color)')]), new Nodo('fila-tk', [tok('fn', 'count(PRS_01, pieza)')]),
  filaProp('output', '0'), filaProp('outputFull', 'false'), filaProp('input', '{}'),
]);
const leyenda = new Nodo('leyenda-tk', [new Nodo('tk-fn', [], 'función'), new Nodo('tk-prop', [], 'propiedad')]);
const cuerpo = new Nodo('', [cols, leyenda]);
const { props, ordenes } = elegirFilas(cuerpo);
assert.deepEqual(ordenes.map(t => t.textContent), ['start()', 'stop()', 'light(color)'], 'tres órdenes, sin la leyenda');
assert.deepEqual(props.map(f => f.children[0].textContent), ['output', 'outputFull'], 'dos propiedades');

const app = new Nodo(), tira = new Nodo('ins-tira'); tira.cab = new Nodo('ins-cab');
const ctx = { $: id => ({ app, 'ins-tira': tira, 'ins-cuerpo': cuerpo })[id] };
const mini = crearMinificha(ctx);
assert.equal(app.dataset.minificha, 'true');
await null; // el valor de móvil se pone al terminar la instalación (después de layout.js)
assert.equal(app.dataset.inspectorMovil, 'tira', 'en el teléfono, la minificha y no la ficha entera');
mini({ id: 'PRS-01', clase: 'prensa' }, 'abierto');
assert.equal(tira.cab.antes.length + tira.cab.despues.length, 0, 'con la ficha abierta no pinta nada');
mini({ id: 'PRS-01', clase: 'prensa' }, 'tira');
assert.equal(tira.cab.antes[0].src, 'http://localhost:8779/Prototypes/Campaign-V2/img/campaign/' + DIBUJOS.prensa);
// En raw.githack el PNG va a raw.githubusercontent (403 en githack) y el SVG se queda.
const gh = 'https://raw.githack.com/autor/repo/rama/Prototypes/Campaign-V2/index.html';
assert.equal(urlDibujo('img/campaign/robots/bot-01-agarre.png', gh), 'https://raw.githubusercontent.com/autor/repo/rama/Prototypes/Campaign-V2/img/campaign/robots/bot-01-agarre.png');
assert.equal(urlDibujo('img/campaign/maquinas/prensa.svg', gh), 'https://raw.githack.com/autor/repo/rama/Prototypes/Campaign-V2/img/campaign/maquinas/prensa.svg');
const [cajaProps, cajaOrd] = tira.cab.despues;
assert.equal(cajaProps.className, 'cv2-mini-props');
assert.deepEqual(cajaProps.children.map(p => p.children.map(h => h.textContent).join('')), ['output=0', 'outputFull=false'], 'sin las notas sin valor vivo');
assert.deepEqual(cajaOrd.children.map(t => [t.textContent, t.title]), [['start()', 'start()'], ['stop()', 'stop()'], ['light()', 'light(color)']]);
for (const ruta of Object.values(DIBUJOS)) assert.match(ruta, /^(maquinas\/[a-z-]+\.svg|robots\/[a-z0-9-]+\.png)$/);

// La puerta del marco del nivel 1, en metros, es la de la muralla de las Batallas.
const marco = niveles['nivel-1'].marco ?? niveles['nivel-1'].default?.marco;
assert.ok(marco, 'el nivel 1 trae su marco');
assert.deepEqual(puertasDelMarco(marco), marco.puertas.map(f => ({ x: marco.origen[0] + 3, y: marco.origen[1] + f + .5 })));
assert.deepEqual(puertasDelMarco({ origen: [204, 72], puertas: [7] }), [{ x: 207, y: 79.5 }]);
assert.equal(paletaFabrica.entrada, 0x3fc1e0, 'bandeja de entrada cian de Campaign 1');
assert.equal(paletaFabrica.salida, 0xf6b817, 'bandeja de salida amarilla de Campaign 1');

console.log('Minificha: rótulos cortos, dos propiedades y tres órdenes de las columnas (sin la leyenda), dibujo por clase y solo en «tira»; puerta del marco a x0 + 3 y paleta de Campaign 1.');
