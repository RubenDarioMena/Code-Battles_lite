// Campaign-V2 · los seis hitos de fábrica jugados en la página con programas escritos como los escribiría el jugador
// (solo órdenes y propiedades del editor), el colocador de H2 y recargas entre hitos. Cada Batalla se sustituye por
// 40 s de planta sin programas, como en campaign-v2-fabrica.mjs; las Batallas reales las cubren sus propias pruebas.
import assert from 'node:assert/strict';
import { cargar, habilitarVM } from './juego-dom.mjs';
import { crearPlataformaMemoria } from '../paquetes/app/index.js';
import { escribirCheckpointV2 } from '../paquetes/app/juego/checkpoints-v2.js';
import { niveles, nivelFabrica, motorFabrica as motor } from '../paquetes/reglas-campaign-v2/index.js';
import { DT } from '../paquetes/nucleo/index.js';
habilitarVM(import.meta.url);

const plataforma = crearPlataformaMemoria(), def = nivelFabrica(niveles['nivel-1']);
const historial = () => JSON.parse(plataforma.almacen.leer('campaign-v2-nivel-1'));
const tic = () => new Promise(resolve => setImmediate(resolve));
const abrir = () => cargar('campaign-v2', '2d', false, false, null, 'escritorio', '',
  { plataforma, i18n: true, serie: 'campaign', alRecargar() {} });

// La Batalla bN: la planta sigue 40 s sin programas ni cambio de hito y el checkpoint pasa al hito de fábrica hN.
function pasarBatalla(n) {
  const h = historial(), cp = h.hitos['b' + n];
  assert.equal(h.ultimo, 'b' + n);
  const m = motor.crear(def, cp.fabrica), c = motor.conectar(m);
  for (let t = 0; t < 40; t += DT) c.paso(DT, { sinHitos: true });
  escribirCheckpointV2(plataforma.almacen, { ...cp, hito: 'h' + n, fabrica: motor.serializar(m), bodega: m.arsenal.misiles });
}

/** Abre el hito, carga los programas, ejecuta y corre hasta que la sesión lo cierra. Devuelve { juego } (el contexto es
 * un Proxy estricto: devolverlo suelto desde una función async haría leer `then`). */
async function jugar(hito, programas, antes = () => {}) {
  const banco = await abrir();
  let juego;
  banco.medirUnidades(ctx => { juego = ctx; });
  assert.equal(juego.fabricaV2.hito, hito);
  const hechos = [];
  banco.alHito = h => hechos.push(h.hecho);
  antes(juego);
  for (const [id, fuente] of Object.entries(programas)) banco.programas[id] = fuente;
  juego.guardarProgramas();
  banco.ejecutar();
  const t0 = banco.mundo.t;
  for (let n = 0; n < 6000 && !hechos.length; n++) {
    await juego.enVuelo;
    juego.acum = 0.5;
    juego.avanzar();
    await juego.enVuelo;
    await tic();
    juego.cicloCampaign(n * 500);
    if (process.env.DEMO_TRAZA && n % 200 === 0) console.log(hito, n, banco.mundo.t.toFixed(1), JSON.stringify(juego.campaign.metas(banco.mundo).map(x => [x.k, x.valor, x.n])),
      juego.$('consola').children.slice(-2).map(e => e.innerHTML.replace(/<[^>]+>/g, '')).join(' | '));
  }
  assert.deepEqual(hechos, [Number(hito.slice(1))], `${hito} sin cumplir: ${JSON.stringify(juego.campaign.metas(banco.mundo).map(x => [x.k, x.valor, x.n]))}`);
  tiempos[hito] = Math.round(banco.mundo.t - t0);
  // Con la planta restaurada a t > 0, una orden sellada con el reloj del mundo esperaría ese desfase (conductor.js):
  // H1 pasaba de ~30 s a más de 1000 s.
  assert.ok(tiempos[hito] <= 150, `${hito}: ${tiempos[hito]} s de planta; ¿órdenes retrasadas?`);
  return { juego };
}
const tiempos = {};
const libre = '// Sin tarea en este hito.';

// El ciclo de un brazo anclado: materia a la máquina, espera su pieza y la deja en su tarima (o espera a que la haya).
const brazo = (entrada, maquina, materia, pieza, salida) => `while (true) {
  const r = await pickUp(${entrada}, "${materia}");
  if (r !== "ok") { await wait(1); continue; }
  await deliver(${maquina});
  while (${maquina}.output === 0) { await wait(0.3); }
  await pickUp(${maquina}, "${pieza}");
  while ((await deliver(${salida})) !== "ok") { await wait(0.5); }
}`;

// H0 · el programa de partida de FRK-01, tal cual.
await jugar('h0', {});
pasarBatalla(1);

// H1 · el ciclo de ARM-01 con espera y bucle (sus pistas).
await jugar('h1', { 'ARM-01': brazo('PAL_1', 'PRS_01', 'steel', 'nose', 'PAL_2') });
pasarBatalla(2);

// H2 · PAL-3 queda fuera del alcance de ARM-02: el colocador la acerca antes de ejecutar.
await jugar('h2', {
  'FRK-01': 'while (!BAY_1.pallet) { await wait(0.5); }\nawait pickUp(BAY_1);\nawait deliver(PAL_3);',
  'ARM-01': brazo('PAL_1', 'PRS_01', 'steel', 'nose', 'PAL_2'),
  'ARM-02': brazo('PAL_3', 'MLD_01', 'polymer', 'base', 'PAL_4'),
}, juego => assert.equal(juego.moverFabrica.colocar('PAL-3', 86.8, 47.6), 'ok'));
pasarBatalla(3);

// H3 · dos tarimas a la mezcladora (llegan de una en una) y una vacía de la pila para sus cargas.
await jugar('h3', {
  'FRK-01': `for (let i = 0; i < 2; i++) {
  while (!BAY_1.pallet) { await wait(0.5); }
  await pickUp(BAY_1);
  await deliver(MIX_01);
}
await pickUp(STK_1);
await deliver(MIX_01);`,
  'ARM-01': libre, 'ARM-02': libre,
});
pasarBatalla(4);

// H4 · ojivas, bases y la tarima de cargas a la ensambladora.
await jugar('h4', {
  'FRK-01': `for (const origen of [PAL_2, PAL_4, MIX_01]) {
  await pickUp(origen);
  await deliver(ASM_01);
}`,
});
pasarBatalla(5);

// H5 · la cadena entera: FRK-01 repone tarimas, cambia la materia de las células y reparte a la ensambladora.
const { juego } = await jugar('h5', {
  'FRK-01': `async function llevar(origen, destino) {
  if ((await pickUp(origen)) !== "ok") return "no";
  const r = await deliver(destino);
  if (r !== "ok") await deliver(origen);
  return r;
}
let conSalida = false;
while (true) {
  if (!PAL_2.pallet) { await llevar(STK_1, PAL_2); continue; }
  if (!PAL_4.pallet) { await llevar(STK_1, PAL_4); continue; }
  if (!conSalida) { conSalida = (await llevar(STK_1, MIX_01)) === "ok"; continue; }
  if (BAY_1.pallet) {
    const acero = count(BAY_1, "steel") > 0;
    const celda = acero ? PAL_1 : PAL_3;
    if (count(celda, acero ? "steel" : "polymer") === 0) {
      if (celda.pallet) await llevar(celda, STK_1);
      await llevar(BAY_1, celda);
      continue;
    }
  }
  if (count(ASM_01, "nose") === 0 && count(PAL_2, "nose") >= 3) { await llevar(PAL_2, ASM_01); continue; }
  if (count(ASM_01, "base") === 0 && count(PAL_4, "base") >= 3) { await llevar(PAL_4, ASM_01); continue; }
  if (count(ASM_01, "charge") === 0 && count(MIX_01, "charge") >= 3) {
    if ((await llevar(MIX_01, ASM_01)) === "ok") conSalida = false;
    continue;
  }
  await wait(0.5);
}`,
  'ARM-01': brazo('PAL_1', 'PRS_01', 'steel', 'nose', 'PAL_2'),
  'ARM-02': brazo('PAL_3', 'MLD_01', 'polymer', 'base', 'PAL_4'),
});
assert.ok(juego.mundo.completado, 'la misión termina con H5');
// DEMO_PLANTAS=ruta.json vuelca el historial final: guarda el checkpoint con que empieza cada hito H1–H5, y el menú
// de pruebas lo usa para abrir la fábrica de un hito ya construida (Prototypes/Campaign-V2/datos/plantas-demo.json).
if (process.env.DEMO_PLANTAS) (await import('node:fs')).writeFileSync(process.env.DEMO_PLANTAS, JSON.stringify(historial()) + '\n');
assert.equal(historial().ultimo, 'b6', 'tras H5 viene la B6');
console.log(`Campaign-V2 · demo de fábrica en la página: H0→H5 con programas del editor (${Object.entries(tiempos).map(([k, v]) => `${k} ${v} s`).join(', ')}), colocador en H2 y recarga entre hitos.`);
