// Gestos, controles y documentos reales sobre el DOM de la prueba de arranque.
import assert from 'node:assert/strict';
import { cargar, habilitarVM } from './juego-dom.mjs';
import { crearPlataformaMemoria, componerCampaignV2 } from '../paquetes/app/index.js';
import { abrirCheckpoints } from '../paquetes/app/juego/checkpoints-v2.js';
import { crearPartida } from '../paquetes/nucleo/index.js';
habilitarVM(import.meta.url);

const plataforma = crearPlataformaMemoria();
async function entrar(consulta, forma = 'escritorio', opciones = {}) {
  const banco = await cargar('campaign-v2', '2d', false, false, null, forma, consulta, { i18n: true, plataforma, ...opciones });
  let ui; banco.medirUnidades(ctx => { ui = ctx; });
  return { ui };
}
const { ui } = await entrar('&ensayo=b5', 'movil');
assert.equal(ui.$('app').dataset.pantallaCompleta, 'true');
assert.equal(ui.$('progs').hidden, true);
assert.equal(ui.$('cv2-unidades').hidden, false);
const filas = () => ui.$('cv2-arbol').children;
const fila = texto => filas().find(f => f.children[0].children[1] === texto);
const input = f => f.children[0].children[0];
const marcar = (f, si) => { input(f).checked = si; input(f).dispatchEvent({ type: 'change' }); };
const escribir = (juego, texto) => { juego.$codigo.value = texto; juego.$codigo.dispatchEvent({ type: 'input' }); };
escribir(ui, 'log(0);');
marcar(fila('Todas las unidades'), true);
assert.equal(ui.programas['LAU-02'], 'log(0);');
assert.equal(ui.seleccionadas.size, ui.unidades().length);
marcar(fila('Torretas'), false);
assert.equal(input(fila('Todas las unidades')).indeterminate, true);
assert.equal(ui.seleccionadas.has('LAU-01'), false);
marcar(fila('Todas las unidades'), false);
assert.equal(ui.seleccionadas.size, 0);
marcar(fila('Torretas'), true);
assert.deepEqual([...ui.edicion.ids], ['LAU-01', 'LAU-02']);
assert.equal(ui.edicion.mixto, false);
escribir(ui, 'log(1);');
assert.equal(ui.programas['LAU-02'], 'log(1);');
assert.match(fila('LAU-01').children[1].textContent, /LAU-02/);

const evento = { button: 0, pointerId: 1, pointerType: 'mouse', target: { tagName: 'CANVAS', setPointerCapture() {} }, clientX: 60, clientY: 80 };
ui.vistaActual().elegir = () => 'LAU-02';
for (const type of ['pointerdown', 'pointerup']) ui.$('campo').dispatchEvent({ ...evento, type });
assert.equal(input(fila('LAU-02')).checked, true);
assert.equal(input(fila('LAU-01')).checked, false);
assert.deepEqual([...ui.edicion.ids], ['LAU-02']);
escribir(ui, 'log(2);');
assert.equal(ui.programas['LAU-01'], 'log(2);');
ui.cambiarLenguaje('python'); escribir(ui, 'print(42)');
assert.equal(ui.fuentes['LAU-01'].texto, 'print(42)');
assert.notEqual(ui.fuentes['LAU-01'], ui.fuentes['LAU-02']);
const { ui: recarga } = await entrar('&ensayo=b5');
assert.equal(recarga.vinculos.miembros('LAU-02').length, 2);

// B5 es la primera batalla con dos torretas. Sembramos esa frontera con el formato de P2.
const config = componerCampaignV2(new URLSearchParams('serie=campaign-v2'));
const historial = abrirCheckpoints(config, plataforma.almacen);
for (const hito of ['b1', 'b5']) {
  const partida = crearPartida({ reglas: config.reglas, escenario: config.escenario(config.batallas.indexOf(hito)), semilla: 1 });
  historial.guardar(partida.mundo, { programas: ui.programas, fuentes: ui.fuentes, vinculos: ui.vinculos.datos });
}
const { ui: camp } = await entrar('');
const unidad = camp.$('cv2-arbol').children.find(f => f.children[0].children[1] === 'LAU-01');
unidad.children.at(-1).click();
escribir(camp, 'print(17)');
assert.equal(camp.fuentes['LAU-02'].texto, 'print(42)');
assert.equal(camp.vinculos.miembros('LAU-01').length, 1);
function volver(hito, restaurar) {
  camp.$('cv2-opciones').click();
  assert.equal(camp.$('cv2-menu').hidden, false);
  camp.$('cv2-checkpoints').value = hito; camp.$('cv2-fuentes').checked = restaurar;
  camp.$('cv2-volver').click();
  assert.equal(camp.partida.mundo.hito, hito);
  assert.equal(camp.$('cv2-menu').hidden, true);
}
volver('b1', false); volver('b5', true);
assert.equal(camp.fuentes['LAU-01'].texto, 'print(42)');
assert.equal(camp.vinculos.miembros('LAU-01').length, 2);

const { ui: b1 } = await entrar('', 'escritorio', {
  plataforma: crearPlataformaMemoria(),
  enH0($, paso) {
    $('cv2-mision').click();
    assert.match($('cv2-titulo').textContent, /Munición/);
    assert.match($('cv2-lista-metas').children[0].textContent, /0\/4/);
    for (let i = 0; i <= 22; i++) paso(i * 100);
    assert.match($('cv2-lista-metas').children[0].textContent, /1\/4/);
  },
});
b1.$('cv2-mision').click();
assert.equal(b1.$('cv2-objetivo').hidden, false);
assert.equal(b1.$('cv2-titulo').textContent, 'Primer blanco');
assert.ok(b1.$('cv2-texto').textContent.length);
assert.match(b1.$('cv2-gestos').textContent, /clic derecho/);
b1.pintarHud();
const metas = () => b1.$('metas').children.map(el => el.textContent);
assert.equal(metas().length, 4);
const antes = metas();
for (let i = 0; i < 40; i++) b1.partida.paso();
b1.pintarHud();
assert.notDeepEqual(metas(), antes);
const enemigo = b1.mundo.enemigos[0];
assert.ok(enemigo);
const proyeccion = { proyectar: () => ({ x: 50, y: 50, visible: true }) };
b1.uiHito.vida([enemigo], proyeccion, 0);
const barra = b1.$('capa').children.find(el => el.className === 'cv2-vida');
assert.equal(barra.style['--vida'], String(enemigo.hp / enemigo.hpMax));
b1.uiHito.vida([{ ...enemigo, hp: enemigo.hpMax / 2 }], proyeccion, 0);
assert.equal(barra.style['--vida'], '0.5');
assert.equal(barra.dataset.herida, 'true');
assert.deepEqual(metas(), b1.$('cv2-lista-metas').children.map(el => el.textContent));
b1.$('cv2-opciones').click(); b1.$('cv2-idioma').click();
assert.equal(b1.$('cv2-titulo').textContent, 'First target');
b1.$('cv2-ajustes').click();
assert.equal(b1.$('ajustes').open, true);
const war = await cargar('war', '2d', false);
war.medirUnidades(juego => {
  assert.equal(juego.$('cv2-unidades'), null);
  assert.equal(juego.$('cv2-hud'), null);
  assert.match(juego.$('progs').innerHTML, /class="prog-tab".*LAU-01/);
});
console.log('H0 y Batallas · misión, metas, idioma, ajustes, selección en ambos sentidos, grupos JS/Python, desvinculación, recarga, checkpoints, móvil y tira clásica de War.');
