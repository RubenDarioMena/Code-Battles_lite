// Campaign-V2 · revisión del nivel y checkpoints de otra revisión.
// - Huella: las unidades de la planta y los hitos del nivel 1 van ligados a `revision`. Si cambian sin subirla, un guardado
//   anterior se restaura con la planta vieja (pasó con P7: H6 no se podía cumplir). Al subirla, anota aquí la huella nueva.
// - Purga: al escribir un checkpoint de la revisión nueva, y al abrir la página, desaparecen todos los de otra revisión,
//   no solo el último; la lista, el menú de checkpoints y la sesión de fábrica dejan de ofrecerlos.
import assert from 'node:assert/strict';
import { niveles } from '../paquetes/reglas-campaign-v2/index.js';
import { componerCampaignV2, crearPlataformaMemoria } from '../paquetes/app/index.js';
import { abrirCheckpoints, leerHistorialV2, escribirCheckpointV2 } from '../paquetes/app/juego/checkpoints-v2.js';
import { crearPartida } from '../paquetes/nucleo/index.js';

const contenido = niveles['nivel-1'], nivel = contenido.default;
const HUELLAS = {
  3: 'h0 b1 h1 b2 h2 b3 h3 b4 h4 b5 h5 b6 b7 b8 h6 | ' + [
    'ARM-01', 'ARM-02', 'ASM-01', 'BAY-1', 'BOT-01', 'DEP-01', 'EMB-01', 'FND-01', 'FRK-01', 'LSR-01', 'MIX-01', 'MLD-01',
    'PAL-1', 'PAL-2', 'PAL-3', 'PAL-4', 'PAL-5', 'PAL-6', 'PAL-7', 'PAL-8', 'PRS-01', 'SAW-01', 'STK-1'].join(' '),
};
const huella = `${nivel.hitos.join(' ')} | ${contenido.fabrica.unidades.map(u => u.id).sort().join(' ')}`;
assert.equal(huella, HUELLAS[nivel.revision],
  `La planta o los hitos del nivel 1 cambiaron: sube \`revision\` en nivel.js y anota la huella nueva.\n${huella}`);

// Un historial sucio como el que dejaba la versión anterior: H0 nuevo encima de checkpoints de la revisión 2.
const config = componerCampaignV2(new URLSearchParams('serie=campaign-v2'));
const { mundo } = crearPartida({ reglas: config.reglas, escenario: config.escenario(-1), semilla: 1 });
const h0 = config.reglas.serializar(mundo);
assert.equal(h0.revision, nivel.revision);
const viejo = h => ({ ...h0, hito: h, revision: nivel.revision - 1 });
const almacen = crearPlataformaMemoria().almacen;
const sucio = { ultimo: 'b3', hitos: Object.fromEntries(['h0', 'b1', 'h1', 'b2', 'b3'].map(h => [h, viejo(h)])) };

// Escribir un checkpoint de la revisión actual quita todos los de la anterior.
almacen.escribir('campaign-v2-nivel-1', JSON.stringify(sucio));
escribirCheckpointV2(almacen, h0);
assert.deepEqual(Object.keys(leerHistorialV2(almacen).hitos), ['h0']);

// Abrir la página con el último vigente y otros viejos: se purgan y se avisa.
almacen.escribir('campaign-v2-nivel-1', JSON.stringify({ ultimo: 'h0', hitos: { ...sucio.hitos, h0 } }));
const abierto = abrirCheckpoints(config, almacen);
assert.deepEqual(abierto.lista.map(cp => cp.hito), ['h0']);
assert.equal(abierto.aviso, 'cv2.revision');
assert.deepEqual(Object.keys(leerHistorialV2(almacen).hitos), ['h0'], 'la purga queda escrita');
assert.equal(abrirCheckpoints(config, almacen).aviso, null, 'el aviso sale una sola vez');

// Guardar en la página de Batalla también purga.
almacen.escribir('campaign-v2-nivel-1', JSON.stringify({ ultimo: 'h0', hitos: { h0, b2: viejo('b2') } }));
const pagina = abrirCheckpoints(config, almacen);
config.reglas.cerrarFabrica(mundo);
pagina.guardar(mundo);
assert.deepEqual(pagina.lista.map(cp => cp.hito).sort(), ['b1', 'h0']);
console.log('Revisión: huella de la planta y purga de checkpoints de otra revisión.');
