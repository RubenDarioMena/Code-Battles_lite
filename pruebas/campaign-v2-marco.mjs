import assert from 'node:assert/strict';
import { crearPartida } from '../paquetes/nucleo/index.js';
import { componerCampaignV2 } from '../paquetes/app/index.js';
import { validarNivel, puntoEnMarco, puntoEnMetros, niveles } from '../paquetes/reglas-campaign-v2/index.js';

const partida = (consulta, extra = {}, semilla = 7) => {
  const c = componerCampaignV2(new URLSearchParams(consulta));
  const indice = consulta.includes('ensayo') || consulta.includes('paridad') ? c.indiceInicial : -1;
  return { c, p: crearPartida({ reglas: c.reglas, escenario: { ...c.escenario(indice), ...extra }, semilla }) };
};
const colocar = (reglas, m, unidad, indice) =>
  reglas.aplicarOrden(m, { verbo: 'colocar', unidad, args: [indice], origen: 'jugador' });
const tipos = (p, desde = 0) => p.sucesos(desde).map(s => s.tipo);

// 1. La escena en metros: misma escena desplazada por el origen del marco, sin tocar la original.
{
  const { c, p } = partida('serie=campaign-v2&ensayo=b1');
  for (let i = 0; i < 200; i++) p.paso();
  const antes = structuredClone(c.reglas.escena(p.mundo));
  const e = c.reglas.escenaMetros(p.mundo);
  assert.deepEqual(c.reglas.escena(p.mundo), antes, 'escenaMetros no modifica la escena de War');
  assert.ok(antes.enemigos.length > 0);
  assert.deepEqual(e.marco, { origen: [204, 72], tam: [32, 18] });
  // War guarda las máquinas en cx/cy y los enemigos en x/y: ambos pares se trasladan.
  const pos = x => x.cx !== undefined ? [x.cx, x.cy] : [x.x, x.y];
  for (const k of ['enemigos', 'lanzadores', 'reparadores'])
    antes[k].forEach((x, i) => assert.deepEqual(pos(e[k][i]), [pos(x)[0] + 204, pos(x)[1] + 72], k));
  assert.deepEqual([e.deposito.cx, e.deposito.cy], [antes.deposito.cx + 204, antes.deposito.cy + 72]);
  assert.deepEqual([e.reparadores[0].bx, e.reparadores[0].by], [antes.reparadores[0].bx + 204, antes.reparadores[0].by + 72]);
  assert.equal(e.porId['LAU-01'], e.maquinas.find(x => x.id === 'LAU-01'));
  assert.deepEqual(e.bastiones.map(b => [b.indice, b.cx, b.cy, b.ocupado]),
    [[0, 210.5, 77.5, null], [1, 210.5, 81.5, 'LAU-01'], [2, 210.5, 85.5, null]]);
  const punto = { x: 220.25, y: 85.75, otro: 1 };
  assert.deepEqual(puntoEnMetros(puntoEnMarco(punto, e.marco.origen), e.marco.origen), punto);
}

// 2. H0: la fábrica también llega en metros, con su propio origen.
{
  const { c, p } = partida('serie=campaign-v2');
  const crudo = c.reglas.escena(p.mundo), e = c.reglas.escenaMetros(p.mundo);
  assert.deepEqual(e.marco.origen, [103, 22]);
  const m0 = crudo.maquinas[0];
  assert.deepEqual([e.maquinas[0].cx, e.maquinas[0].cy], [m0.cx + 103, m0.cy + 22]);
  // La prensa queda dentro de casa, tras la muralla (x = 207 m, la línea base de War: 3 + 204).
  assert.ok(e.maquinas[0].cx < 207);
  assert.equal(e.porId[m0.id], e.maquinas[0]);
}

// 3. El validador exige bastiones distintos.
{
  const base = niveles['nivel-1'];
  const conMarco = marco => ({ ...base, default: { ...base.default, marco: { ...base.default.marco, ...marco } } });
  assert.deepEqual(validarNivel('nivel-1', base, {}, null).filter(x => x.includes('marco')), []);
  assert.ok(validarNivel('nivel-1', conMarco({ bastiones: [[6, 5], [6, 5]] }), {}, null).some(x => x.includes('bastión repetido')));
  assert.ok(validarNivel('nivel-1', conMarco({ bastiones: undefined }), {}, null).some(x => x.includes('marco.bastiones')));
  assert.ok(validarNivel('nivel-1', conMarco({ tam: [32] }), {}, null).some(x => x.includes('marco.tam')));
}

// 4. Colocar antes de empezar: la Batalla se vuelve a montar con la misma semilla.
{
  const { c, p } = partida('serie=campaign-v2&ensayo=b1');
  const { p: testigo } = partida('serie=campaign-v2&ensayo=b1');
  const semilla = p.mundo.semillaIntento;
  colocar(c.reglas, p.mundo, 'LAU-01', 0);
  assert.equal(p.mundo.semillaIntento, semilla);
  assert.deepEqual([p.mundo.batalla.lanzadores[0].cx, p.mundo.batalla.lanzadores[0].cy], [6.5, 5.5]);
  assert.deepEqual(p.mundo.torretas, { 'LAU-01': { x: 6, y: 5 } });
  for (let i = 0; i < 120; i++) { p.paso(); testigo.paso(); }
  // Sin programas nadie dispara: los enemigos coinciden porque la semilla es la misma.
  assert.deepEqual(p.mundo.batalla.enemigos.map(x => [x.x, x.y]), testigo.mundo.batalla.enemigos.map(x => [x.x, x.y]));
  assert.ok(tipos(p).includes('colocada'));
}

// 5. Lo que no se puede colocar se descarta con su motivo y no cambia nada.
{
  const { c, p } = partida('serie=campaign-v2&ensayo=b5');
  const antes = structuredClone(p.mundo.torretas);
  colocar(c.reglas, p.mundo, 'LAU-01', 2);
  colocar(c.reglas, p.mundo, 'LAU-01', 7);
  colocar(c.reglas, p.mundo, 'LAU-09', 1);
  assert.deepEqual(p.sucesos(0).filter(s => s.tipo === 'colocar-descartada').map(s => s.datos.motivo),
    ['ocupado', 'bastion', 'unidad']);
  assert.deepEqual(p.mundo.torretas, antes);
  // El bastión del centro está libre: LAU-01 pasa a él.
  colocar(c.reglas, p.mundo, 'LAU-01', 1);
  assert.deepEqual(p.mundo.batalla.lanzadores.map(l => [l.id, l.cy]), [['LAU-01', 9.5], ['LAU-02', 13.5]]);
}

// 6. Colocar con la Batalla en marcha vale para la siguiente y entra en el checkpoint.
{
  const { c, p } = partida('serie=campaign-v2&ensayo=b1');
  for (let i = 0; i < 40; i++) p.paso();
  colocar(c.reglas, p.mundo, 'LAU-01', 2);
  assert.equal(p.mundo.batalla.lanzadores[0].cy, 9.5, 'la torreta no se mueve en mitad de la Batalla');
  const cp = c.reglas.serializar(p.mundo);
  assert.deepEqual(cp.torretas, { 'LAU-01': { x: 6, y: 13 } });
  const vuelta = c.reglas.restaurar(cp, 11);
  assert.deepEqual([vuelta.batalla.lanzadores[0].cx, vuelta.batalla.lanzadores[0].cy], [6.5, 13.5]);
}

// 7. Paridad: sin bastiones en la escena y el colocador no existe.
{
  const { c, p } = partida('serie=campaign-v2&modo=paridad&batalla=b1', {}, 3);
  const e = c.reglas.escenaMetros(p.mundo);
  assert.equal('bastiones' in e, false);
  assert.deepEqual(e.marco.origen, [204, 72]);
  const antes = [p.mundo.batalla.lanzadores[0].cx, p.mundo.batalla.lanzadores[0].cy];
  colocar(c.reglas, p.mundo, 'LAU-01', 0);
  assert.deepEqual([p.mundo.batalla.lanzadores[0].cx, p.mundo.batalla.lanzadores[0].cy], antes);
  assert.equal(tipos(p).some(t => t.startsWith('coloca')), false);
}

console.log('Marco V2: escena en metros (+204,+72 y fábrica +103,+22), bastiones validados, colocador con remontaje, checkpoint y paridad intacta.');
