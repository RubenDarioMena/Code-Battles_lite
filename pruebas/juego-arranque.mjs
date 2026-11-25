// Carga real de la composición con DOM, editor y GPU emulados.
import assert from 'node:assert/strict';
import { cargar, habilitarVM } from './juego-dom.mjs';
import { crearPlataformaMemoria, componerCampaignV2 } from '../paquetes/app/index.js';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { escribirCheckpointV2 } from '../paquetes/app/juego/checkpoints-v2.js';
habilitarVM(import.meta.url);
// La campaña tras H0: checkpoints de H0 y de B1 con la planta cerrada, como los deja la sesión de fábrica.
function trasH0() {
  const plataforma = crearPlataformaMemoria(), { reglas, escenario } = componerCampaignV2(new URLSearchParams());
  const { mundo } = crearPartida({ reglas, escenario: escenario(-1), semilla: 1 });
  escribirCheckpointV2(plataforma.almacen, reglas.serializar(mundo));
  assert(reglas.cerrarFabrica(mundo));
  escribirCheckpointV2(plataforma.almacen, reglas.serializar(mundo));
  return plataforma;
}
let casos = 0;
for (const forma of ['escritorio', 'movil'])
for (const serie of ['war', 'factory', 'campaign']) for (const vista of ['2d', '3d']) {
  for (const propio of serie === 'campaign' ? [false] : [false, true]) {
    await cargar(serie, vista, propio, false, null, forma); casos++;
  }
  await cargar(serie, vista, false, true, null, forma); casos++;
}
for (const vista of ['2d', '3d']) {
  // Partida nueva: la página arranca la sesión Campaign sobre la planta de H0, con su colocador.
  const fabrica = await cargar('campaign-v2', vista, false, false, null, 'escritorio', '', { serie: 'campaign' });
  fabrica.medirUnidades(ctx => {
    assert.equal(ctx.fabricaV2.hito, 'h0');
    assert.equal(ctx.ES_CAMPAIGN, true);
    assert.ok(ctx.moverFabrica);
  });
  assert.equal(fabrica.partida.mundo.hito, 0);
  casos++;
  for (const [consulta, hito, modo] of [['', 'b1', 'campaign'], ['&ensayo=b3', 'b3', 'ensayo'], ['&modo=paridad&batalla=b5', 'b5', 'paridad']]) {
    let recargas = 0;
    const banco = await cargar('campaign-v2', vista, false, false, null, 'escritorio', consulta,
      modo === 'campaign' ? { plataforma: trasH0(), alRecargar: () => recargas++ } : {});
    const previa = banco.partida;
    let ui;
    banco.medirUnidades(ctx => { ui = ctx; });
    if (modo === 'paridad') assert.equal(ui.colocador, null);
    else {
      assert.equal(ui.pielBatalla, true);
      ui.$('b-piel').dispatchEvent({ type: 'click' });
      assert.equal(ui.pielBatalla, false);
      ui.colocador.colocar(0);
      assert.equal(previa.pasoActual, 0);
      assert.equal(previa.serializar().ordenes.at(-1).origen, 'jugador');
      assert.equal(banco.mundo.lanzadores[0].cy, 5.5);
      ui.colocador.colocar(1); // Recuperar el puesto inicial antes del recorrido de victoria.
      if (modo === 'ensayo') ui.colocador.colocar(2);
    }
    banco.ejecutar();
    assert.notEqual(banco.partida, previa);
    assert.equal(banco.partida.serializar().reglas, 'campaign-v2');
    assert.equal(banco.partida.mundo.hito, hito);
    assert.equal(banco.partida.mundo.modo, modo);
    if (modo !== 'paridad') assert.equal(ui.pielBatalla, true);
    if (modo === 'ensayo') assert.equal(banco.mundo.lanzadores[0].cy, 13.5);
    assert.equal(banco.mundo, banco.partida.mundo.batalla);
    if (modo === 'campaign') {
      let juego;
      banco.medirUnidades(ctx => { juego = ctx; });
      banco.programas['LAU-01'] = 'while(true){regularShoot(autoTarget("crawler","visual"));await esperar(0.5);}';
      juego.guardarProgramas();
      banco.ejecutar();
      for (let n = 0; n < 2000 && banco.partida.mundo.hito === 'b1'; n++) {
        await juego.enVuelo;
        juego.acum = 0.5;
        juego.avanzar();
      }
      await juego.enVuelo;
      // Tras B1 viene la fábrica H1: la tarjeta de transición espera con la simulación parada y la recarga la abre.
      assert.equal(banco.partida.mundo.hito, 'h1');
      assert.equal(juego.ejec, null);
      assert.equal(banco.partida.mundo.superado.hito, 'b1');
      assert.equal(banco.checkpoints.length, 3);
      assert.equal(recargas, 0);
      juego.continuarHito();
      assert.equal(recargas, 1);
      const actual = banco.programas['LAU-01'];
      banco.volverA(1, false);
      assert.equal(banco.programas['LAU-01'], actual);
      banco.volverA(1, true);
      assert.notEqual(banco.programas['LAU-01'], actual);
    }
    casos++;
  }
}
// Recorre las acciones del jugador y lee las filas que escribió la consola.
async function probarControlesIntento(paridad) {
  const consulta = paridad ? '&modo=paridad&batalla=b5' : '&ensayo=b5&repetir=1';
  const banco = await cargar('campaign-v2', '2d', false, false, null, 'escritorio', consulta);
  let juego;
  banco.medirUnidades(ctx => { juego = ctx; });
  const pulsar = id => juego.$(id).dispatchEvent({ type: 'click' });
  const escribir = texto => {
    juego.$codigo.value = texto;
    juego.$codigo.dispatchEvent({ type: 'input' });
  };
  const filas = () => juego.$('consola').children.map(e => e.innerHTML);
  const id = 'LAU-01';
  banco.abrirPrograma(id);
  escribir('// una\n// dos\nthrow new Error("prueba P3a");');
  pulsar('b-ejecutar');
  await juego.enVuelo;
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(filas().some(f => f.includes(id) && f.includes('L3') && f.includes('prueba P3a')));
  assert.equal(juego.$('orden-manual').hidden, paridad);
  if (paridad) {
    assert.equal(juego.finActual, 'error');
    assert.equal(juego.puedeRepetir, false);
    return;
  }
  const partida = juego.partida;
  assert.ok(juego.ejec);
  assert.equal(juego.$codigo.readOnly, false);
  pulsar('b-pausa');
  const mandar = verbo => {
    const select = juego.$('orden-manual');
    select.value = verbo;
    select.dispatchEvent({ type: 'change', target: select });
  };
  juego.$('coordenadas').value = '{x:20,y:6}';
  mandar('regularShoot');
  escribir('log("programa nuevo");');
  pulsar('b-ejecutar-cod');
  mandar('stopFire');
  const acciones = ['regularShoot', 'Aplicar ahora', 'stopFire'];
  assert.deepEqual(filas().filter(f => f.includes('En espera')).map(f => acciones.find(a => f.includes(a))), acciones);
  assert.equal(partida.serializar().intento.entradas.length, 0);
  pulsar('b-pausa');
  juego.acum = juego.DT;
  juego.avanzar();
  await juego.enVuelo;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(juego.partida, partida);
  assert.deepEqual(filas().filter(f => f.includes('Paso 0')).map(f => acciones.find(a => f.includes(a))), acciones);
  assert.ok(filas().some(f => f.includes(id) && f.includes('L1') && f.includes('programa nuevo')));
  pulsar('b-reiniciar');
  assert.equal(juego.$('b-reiniciar').textContent, 'Repetir último intento');
  pulsar('b-reiniciar');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(filas().some(f => f.includes('Repetición · paso 1 · detenido')));
}
// Clic real del colocador sobre el plano emulado, arranque desde esa posición y descarte en la FIFO.
{
  const banco = await cargar('campaign-v2', '2d', false, false, null, 'escritorio', '&ensayo=b5');
  let ui;
  banco.medirUnidades(ctx => { ui = ctx; });
  const libre = () => ui.reglas.escenaMetros(banco.partida.mundo).bastiones.find(b => !b.ocupado);
  const unidad = ui.seleccion, b = libre(), campo = ui.$('campo');
  Object.assign(ui.vistaActual(), { proyectar: (x, _, y) => ({ x: x * 20, y: y * 20, visible: true }), elegir: () => null });
  ui.colocador.pintar();
  const marca = campo.children.find(el => el.className === 'bastion-libre' && !el.hidden);
  const evento = { button: 0, pointerId: 1, pointerType: 'mouse', target: { tagName: 'CANVAS', setPointerCapture() {} },
    clientX: parseFloat(marca.style.left), clientY: parseFloat(marca.style.top) };
  for (const type of ['pointerdown', 'pointerup']) campo.dispatchEvent({ ...evento, type });
  assert.equal(banco.partida.serializar().ordenes.at(-1).args[0], b.indice);
  assert.equal(banco.mundo.porId[unidad].cy, b.cy - 72);
  banco.ejecutar();
  await ui.enVuelo;
  await ui.conductor.avanzar(2);
  assert.equal(banco.mundo.porId[unidad].cy, b.cy - 72);
  ui.$('b-pausa').dispatchEvent({ type: 'click' });
  const siguiente = libre(), ocupado = ui.reglas.escenaMetros(banco.partida.mundo).bastiones.find(x => x.ocupado && x.ocupado !== unidad);
  ui.colocador.colocar(siguiente.indice);
  ui.colocador.colocar(ocupado.indice);
  assert.equal(banco.partida.serializar().intento.entradas.length, 0);
  ui.$('b-pausa').dispatchEvent({ type: 'click' });
  await ui.conductor.avanzar(1);
  assert.equal(banco.mundo.porId[unidad].cy, b.cy - 72);
  assert.equal(ui.reglas.serializar(banco.partida.mundo).torretas[unidad].y, siguiente.cy - 72.5);
  assert.ok(ui.$('avisos').children.some(el => el.innerHTML.includes('El bastión ya está ocupado.')));
  ui.conductor.cerrar();
}
// Ruta de uso completa: editor, botón Ejecutar, clic de campo y etiquetas de ambas vistas.
for (const [lenguaje, vista] of [['js', '2d'], ['python', '3d']]) {
  const banco = await cargar('campaign-v2', vista, false, false, null, 'escritorio', '&ensayo=b5');
  let juego;
  banco.medirUnidades(ctx => { juego = ctx; });
  const id = 'LAU-01';
  banco.fijarSemilla(29);
  banco.abrirPrograma(id);
  if (lenguaje === 'python') juego.cambiarLenguaje(lenguaje);
  juego.$codigo.value = lenguaje === 'js' ? 'terrain.onClick(p => { regularShoot(p); });' :
    'async def al_clic(p):\n    await wait(0.05)\n    regular_shoot(p)\nterrain.on_click(al_clic)';
  juego.$codigo.dispatchEvent({ type: 'input' });
  juego.$('b-ejecutar').dispatchEvent({ type: 'click' });
  await juego.enVuelo;
  assert.ok(juego.anfitrion.escucha(id, 'terrain.onClick'));
  assert.ok(juego.$('consola').children.some(e => e.innerHTML.includes('Escuchando terrain.onClick')));
  banco.seleccionar([id]);
  Object.assign(juego.vistaActual(), { elegir: () => null, suelo: () => ({ x: 18, y: 5 }),
    proyectar: () => ({ x: 100, y: 80, visible: true }) });
  juego.$('campo').dispatchEvent({ type: 'pointerdown', target: { tagName: 'CANVAS' }, button: 2,
    clientX: 18, clientY: 5, preventDefault() {}, stopPropagation() {} });
  await juego.enVuelo;
  await juego.conductor.avanzar(2);
  assert.equal(banco.mundo.porId[id].lugar?.x, 18);
  juego.pintarCapa(0, 1);
  assert.ok(juego.etiquetas.get(id).etq.textContent.includes('⌖'));
  juego.conductor.cerrar();
}
casos += 2;
await probarControlesIntento(false);
await probarControlesIntento(true);
casos += 2;
// Autoprueba de una TDZ indirecta: el nombre existe, pero se lee mediante una
// llamada durante la carga, antes de inicializarse. La VM debe rechazarla.
await assert.rejects(cargar('war', '2d', false, false,
  'const leerDespues = () => despues; leerDespues(); const despues = 1;'),
  /Cannot access 'despues' before initialization/);
console.log(`Arranque emulado en Node: ${casos} cargas (4 series, 2D/3D, propio, sin GPU, poc, escritorio/móvil y marco); sin ReferenceError/TDZ ni servicios leídos antes de conectarse. TDZ indirecta inyectada rechazada. DOM/editor/GPU emulados; no sustituye QA de navegador.`);
