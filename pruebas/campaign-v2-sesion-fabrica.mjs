// Campaign-V2 · la página entre fábrica y Batalla, con el mismo almacén en todas las recargas: partida nueva en H0,
// recarga a B1, vuelta a la planta en H1, colocador (fantasma, giro, confirmar y cancelar), guardado en vivo y botón
// Checkpoint. DOM y GPU emulados.
import assert from 'node:assert/strict';
import { cargar, habilitarVM } from './juego-dom.mjs';
import { crearPlataformaMemoria } from '../paquetes/app/index.js';
import { niveles } from '../paquetes/reglas-campaign-v2/index.js';
habilitarVM(import.meta.url);

const plataforma = crearPlataformaMemoria();
const historial = () => JSON.parse(plataforma.almacen.leer('campaign-v2-nivel-1'));
const sello = () => plataforma.almacen.leer('campaign-v2-nivel-1-sello') ?? null;
const tic = () => new Promise(resolve => setImmediate(resolve));
let recargas = 0;
// Los hitos de fábrica arrancan la serie Campaign; las Batallas, la composición de War (juego-dom comprueba cuál).
const abrir = fabrica => cargar('campaign-v2', '2d', false, false, null, 'escritorio', '',
  { plataforma, i18n: true, alRecargar: () => recargas++, ...(fabrica ? { serie: 'campaign' } : {}) });
const juegoDe = banco => { let juego; banco.medirUnidades(ctx => { juego = ctx; }); return juego; };
async function correr(juego, hasta, max) {
  for (let n = 0; n < max && !hasta(); n++) {
    await juego.enVuelo;
    juego.acum = 0.5;
    juego.avanzar();
    await juego.enVuelo;
    await tic();
    if (juego.ES_CAMPAIGN) juego.cicloCampaign(n * 500);
  }
  assert.ok(hasta(), 'sin terminar');
}
const etapas = juego => {
  juego.$('cv2-opciones').click();
  const lista = [...juego.$('cv2-checkpoints').children].map(op => op.value);
  juego.$('cv2-opciones').click();
  return lista;
};

// 1 · Partida nueva: H0 con la bodega inicial; los programas de partida cumplen el hito y la sesión se para.
let banco = await abrir(true), juego = juegoDe(banco);
assert.equal(juego.fabricaV2.hito, 'h0');
assert.equal(historial().ultimo, 'h0');
assert.equal(banco.mundo.arsenal.misiles, niveles['nivel-1'].fabrica.bodegaInicial);
assert.deepEqual(etapas(juego), ['h0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'salida']);
banco.ejecutar();
await correr(juego, () => juego.continuarHito, 4000);
assert.equal(juego.ejec, null);
assert.equal(historial().ultimo, 'b1');
assert.equal(sello(), null, 'al cerrar el hito se borra el sello: volver a H0 resiembra su planta');
assert.equal(recargas, 0);
juego.continuarHito();
assert.equal(recargas, 1);

// 2 · B1 desde su checkpoint: la planta cerrada (ya en H1) viaja dentro de la Batalla y la bodega la abastece.
banco = await abrir(false); juego = juegoDe(banco);
assert.equal(banco.partida.mundo.hito, 'b1');
assert.equal(banco.partida.mundo.fabrica.hito, 1);
banco.programas['LAU-01'] = 'while(true){regularShoot(autoTarget("crawler","visual"));await esperar(0.5);}';
juego.guardarProgramas();
banco.ejecutar();
await correr(juego, () => banco.partida.mundo.hito !== 'b1', 3000);
assert.equal(banco.partida.mundo.hito, 'h1');
assert.equal(historial().ultimo, 'h1');
assert.equal(historial().hitos.h1.fabrica.hito, 1);
juego.continuarHito();
assert.equal(recargas, 2);

// 3 · H1 en la sesión Campaign: la planta siguió en marcha durante la Batalla.
banco = await abrir(true); juego = juegoDe(banco);
assert.equal(juego.fabricaV2.hito, 'h1');
assert.equal(banco.mundo.hito, 1);
const tBatalla = banco.mundo.t;
assert.ok(tBatalla > 0, 'la Batalla hizo avanzar la planta');
assert.deepEqual(banco.mundo.programables.map(u => u.id), ['FRK-01', 'ARM-01', 'PRS-01']);
assert.deepEqual(etapas(juego), ['h0', 'b1', 'h1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'salida']);

// 4 · Colocador: solo con una pieza movible elegida; la orden entra como orden del jugador y el motor decide.
const mover = juego.moverFabrica, boton = juego.$('b-mover');
juego.seleccionar(['BAY-1']); mover.pintar();
assert.equal(boton.disabled, true, 'la bahía no se mueve');
juego.seleccionar(['PAL-2']); mover.pintar();
assert.equal(boton.disabled, false);
boton.click();
assert.equal(mover.activo, true);
boton.click();
assert.equal(mover.activo, false);
assert.equal(mover.colocar('PAL-2', 120, 50), 'fuera_de_losa');
assert.equal(mover.colocar('BAY-1', 80, 50), 'no_movible');
const pal2 = () => [banco.mundo.porId['PAL-2'].cx, banco.mundo.porId['PAL-2'].cy];
const trabajo2 = () => [banco.mundo.porId['PAL-2'].ax, banco.mundo.porId['PAL-2'].ay];

// Fantasma: tocar el suelo solo lo fija (la planta no cambia) y abre la barra; girar lleva el punto de trabajo
// alrededor del centro; cancelar no deja nada; donde no cabe, ✓ se apaga y el aviso dice por qué.
// La vista falsa de juego-dom no proyecta: aquí, 10 px por metro.
const plano = juego.vistaActual();
plano.proyectar = (x, _alto, y) => ({ x: x * 10, y: y * 10, visible: true });
plano.suelo = (px, py) => ({ x: px / 10, y: py / 10, z: 0 });
const pantalla = (x, y) => plano.proyectar(x, 0, y);
const barra = juego.$('cv2-colocar'), ok = juego.$('cv2-colocar-ok');
const [x0, y0] = pal2(), [ax0, ay0] = trabajo2();
boton.click();
assert.equal(mover.fase, 'apuntar');
assert.deepEqual([mover.plan.x, mover.plan.y], [x0, y0], 'el fantasma empieza sobre la pieza');
let s = pantalla(82.6, 47.6);
assert.equal(mover.tocar(s.x, s.y), true);
mover.pintar();
assert.equal(mover.fase, 'fijar');
assert.equal(barra.hidden, false);
assert.equal(ok.disabled, false);
const destino = [mover.plan.x, mover.plan.y];
assert.ok(Math.hypot(destino[0] - 82.6, destino[1] - 47.6) < 0.05, `el toque fija el destino (${destino})`);
assert.deepEqual(pal2(), [x0, y0], 'fijar no mueve la tarima');
mover.girar(); mover.girar();
assert.equal(mover.plan.giro, 2);
assert.deepEqual([mover.plan.respuesta.ax, mover.plan.respuesta.ay].map(v => Math.round(v * 100) / 100),
  [destino[0] - (ax0 - x0), destino[1] - (ay0 - y0)].map(v => Math.round(v * 100) / 100), 'media vuelta: el punto, al otro lado');
juego.$('cv2-colocar-no').click();
assert.equal(mover.fase, null);
assert.equal(barra.hidden, true);
assert.deepEqual([...pal2(), ...trabajo2()], [x0, y0, ax0, ay0], 'cancelar no deja nada');
boton.click();
s = pantalla(80, 46.2);
mover.tocar(s.x, s.y); mover.pintar();
assert.equal(mover.plan.respuesta.resultado, 'ocupado', 'encima de la prensa');
assert.equal(ok.disabled, true);
mover.confirmar();
assert.equal(mover.fase, 'fijar', 'donde no cabe, confirmar (Intro) no coloca');
assert.deepEqual(pal2(), [x0, y0]);
// Tocar otro punto lleva el fantasma; girar un cuarto y confirmar con ✓.
s = pantalla(82.6, 47.6);
mover.tocar(s.x, s.y); mover.girar(); mover.pintar();
ok.click();
assert.equal(mover.fase, null);
assert.deepEqual(pal2(), destino);
const girado = trabajo2();
assert.ok(Math.abs(girado[0] - (destino[0] - (ay0 - y0))) < 0.011 && Math.abs(girado[1] - (destino[1] + (ax0 - x0))) < 0.011,
  `un cuarto en el sentido de las agujas del reloj: (dx, dy) → (−dy, dx) (${girado})`);
// La API directa sigue colocando sin fantasma (también la usan las demos).
assert.equal(mover.colocar('PAL-2', 82.6, 47.6), 'ok');
assert.deepEqual(pal2(), [82.6, 47.6]);

// 5 · Recarga en el mismo hito: sigue desde el guardado en vivo (la tarima donde quedó), no desde el checkpoint.
banco = await abrir(true); juego = juegoDe(banco);
assert.equal(banco.mundo.hito, 1);
assert.deepEqual(pal2(), [82.6, 47.6]);

// 6 · Botón Checkpoint (dos toques): vuelve al inicio del hito; la recarga resiembra la planta del checkpoint.
juego.$('b-reiniciar').dispatchEvent({ type: 'click' });
assert.equal(recargas, 2, 'el primer toque solo pide confirmación');
juego.$('b-reiniciar').dispatchEvent({ type: 'click' });
assert.equal(recargas, 3);
assert.equal(sello(), null);
banco = await abrir(true); juego = juegoDe(banco);
assert.equal(banco.mundo.hito, 1);
assert.equal(banco.mundo.t, tBatalla);
assert.deepEqual(pal2(), [82.2, 47.6]);

// 7 · H1 con el programa que piden sus pistas, escrito en el editor: intérprete, reglamento y motor de punta a punta.
banco.programas['ARM-01'] = [
  'while (true) {',
  '  await pickUp(PAL_1, "steel");',
  '  await deliver(PRS_01);',
  '  while (PRS_01.output === 0) { await wait(0.3); }',
  '  await pickUp(PRS_01, "nose");',
  '  await deliver(PAL_2);',
  '}',
].join('\n');
juego.guardarProgramas();
banco.ejecutar();
await correr(juego, () => juego.continuarHito, 3000);
assert.ok(banco.mundo.porId['PAL-2'] && juego.campaign.cuantos(banco.mundo, 'PAL-2', 'nose') >= 6);
assert.equal(historial().ultimo, 'b2');
assert.equal(historial().hitos.b2.fabrica.hito, 2, 'la Batalla B2 lleva la planta ya en H2');

// 8 · Desde el menú, H0: su checkpoint trae la planta recién instalada.
juego.$('cv2-opciones').click();
juego.$('cv2-checkpoints').value = 'h0';
juego.$('cv2-volver').click();
assert.equal(recargas, 4);
banco = await abrir(true); juego = juegoDe(banco);
assert.equal(juego.fabricaV2.hito, 'h0');
assert.equal(banco.mundo.hito, 0);
assert.equal(banco.mundo.t, 0);
console.log('Sesión de fábrica V2: H0 → B1 → H1 con recargas, planta en marcha durante la Batalla, colocador con fantasma, giro y confirmación, guardado en vivo, Checkpoint, H1 resuelto con el programa de sus pistas y vuelta a H0.');
