// P5a. El intérprete, los pasos y la entrega de eventos son los de la aplicación.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { montar } from './campaign-v2-intento-base.mjs';
import { fichas, salida } from '../paquetes/reglas-campaign-v2/index.js';
import { crearPartida } from '../paquetes/nucleo/index.js';
import war from '../paquetes/reglas-war/index.js';
import { componerCampaignV2 } from '../paquetes/app/index.js';
import { crearHuella } from '../herramientas/partida/huella.mjs';
import { catalogo } from '../shared/i18n/campaign-v2/nivel-1.js';
import { cargar, habilitarVM } from './juego-dom.mjs';

habilitarVM(import.meta.url);
const raiz = new URL('../paquetes/reglas-campaign-v2/', import.meta.url);
const config = componerCampaignV2(new URLSearchParams('serie=campaign-v2&ensayo=salida'), undefined, catalogo);
const ext = config.runtime.crearExtension(k => catalogo.es[k]);
for (const f of fichas) {
  const carpeta = new URL('mecanicas/' + f.id + '/', raiz);
  assert.deepEqual((await readdir(carpeta)).sort(), ['ficha.js', 'reglas.js']);
  assert.equal((await import(new URL('reglas.js', carpeta))).ficha, f);
  assert.doesNotMatch(await readFile(new URL('reglas.js', carpeta), 'utf8'), /reglas-war|puntoEnMarco|puntoEnMetros/);
  for (const v of f.verbos) {
    assert.ok(ext.funciones().some(x => x.nombre === v.nombre && x.nombres?.python === v.nombres.python));
    for (const clave of [v.nota, ...v.firma, v.seudo?.rotulo].filter(Boolean))
      assert.ok(catalogo.es[clave] && catalogo.en[clave], clave);
  }
}
// Un tipo que solo aporta sus dos archivos entra por la misma importación y línea de paso.
// Este módulo temporal existe en memoria y reutiliza la V2 del árbol.
const fuentePaso = await readFile(new URL('paso.js', raiz), 'utf8');
const codigo = fuentePaso.replace(/from '([^']+)'/g, (_, ruta) => 'from ' + JSON.stringify(new URL(ruta, raiz)))
  .replace('const pasos = [', 'const prueba = { ficha: { id: "test" }, crear: d => d, paso(c) { c.llamadas++; } };\nconst pasos = [\n[prueba, (c, dt) => prueba.paso(c, dt)],');
const registro = await import('data:text/javascript,' + encodeURIComponent(codigo));
assert.ok(registro.fichas.some(f => f.id === 'test'));
const ensayo = structuredClone(salida);
ensayo.hostiles.push({ id: 'X', tipo: 'test', home: { x: 0, y: 0 } });
const sim = await montar({ consulta: 'ensayo=salida' });
const campo = registro.crearCampo(ensayo, { origen: [204, 72], tam: [32, 18], puertas: [7] });
assert.equal(campo.hostiles.at(-1).id, 'X');
campo.llamadas = 0;
const { fijarSuministro, leerEnemigos } = await import('../paquetes/reglas-war/index.js');
registro.paso({ ...sim.partida.mundo, campo }, .05, { paso() {} }, { ...war, fijarSuministro, leerEnemigos });
assert.equal(campo.llamadas, 1);
sim.conductor.cerrar();

const veh = 'VEH-01', textos = { [veh]: [
  'onArrive(p => log(p.y));', 'log("inicio");', ...salida.inicial[veh],
].join('\n'), 'LAU-01': 'while (true) { log(VEH_01 === null); await esperar(.1); }' };
const { partida, b, conductor, avisos, anfitrion, aplicar } = await montar({ consulta: 'ensayo=salida', textos });
const c = partida.mundo.campo;
let anterior = c.aliados[veh].position, cruzo = false, ausencia = false, esperaImpacto = null, aciertos = 0;
let reinicio = false;
while (!partida.evaluar() && partida.pasoActual < 1000) {
  await conductor.avanzar(1);
  const u = partida.instantanea().moviles[veh];
  assert.ok(b.enemigos.every(e => e.tipo !== 'tirador'));
  if (u) {
    const { position: p } = u;
    assert.ok(p.x >= c.limites.x0 && p.x <= c.limites.x1 && p.y >= c.limites.y0 && p.y <= c.limites.y1);
    if (anterior && anterior.x < c.limites.muro && p.x >= c.limites.muro) {
      assert.ok(Math.abs(p.y - c.limites.puertas[0]) < .15);
      cruzo = true;
    }
    if (ausencia) reinicio = true;
    anterior = p;
  } else {
    assert.equal(c.aliados[veh], null);
    assert.equal(anfitrion.estado(veh), 'ausente');
    assert.equal(anfitrion.escucha(veh, 'onArrive'), false);
    if (!ausencia) aplicar(veh, textos[veh].replace('"inicio"', '"repuesto"'));
    ausencia = true;
    anterior = null;
  }
  if (esperaImpacto) {
    const bajas = partida.sucesos(partida.pasoActual).filter(s => s.tipo === 'derribo' && s.datos.por === veh);
    for (const id of esperaImpacto) assert.ok(bajas.some(s => s.unidad === id));
    aciertos += bajas.length;
  }
  esperaImpacto = c.impactos.flatMap(m => b.enemigos.filter(e => Math.hypot(e.x + c.origen[0] - m.x1,
    e.y + c.origen[1] - m.y1) <= m.radio).map(e => e.id));
}
const logs = avisos.filter(m => m.type === 'consola');
assert.deepEqual(avisos.filter(m => m.type === 'errorUnidad'), []);
assert.equal(partida.evaluar()?.fin, 'victoria');
assert.ok(cruzo && ausencia && reinicio && aciertos >= 2);
assert.ok(logs.some(m => m.unidad === 'LAU-01' && m.texto === 'true'));
assert.deepEqual(logs.filter(m => m.unidad === veh).map(m => m.texto), ['inicio', '81.5', 'repuesto', '81.5']);
conductor.cerrar();

const otra = await montar({ consulta: 'ensayo=salida', textos: { [veh]: `
moveTo({x: 999, y: -999});
const anterior = arrive();
moveTo(home);
log(await anterior);
const ultima = arrive();
stop();
log(await ultima);` } });
assert.deepEqual(otra.avisos.filter(m => m.type === 'consola').map(m => m.texto), ['redirigida', 'detenida']);
otra.aplicar(veh, 'moveTo({x:999, y:-999});');
await otra.conductor.avanzar(0);
assert.deepEqual(otra.partida.mundo.campo.aliados[veh].ruta.at(-1), { x: 236, y: 72 });
otra.conductor.cerrar();

// Incluso con datos de unidades presentes, la rama de paridad mantiene la huella de War.
const par = componerCampaignV2(new URLSearchParams('serie=campaign-v2&modo=paridad'));
const escenario = { ...par.escenario(0), reto: salida };
const p = crearPartida({ reglas: par.reglas, escenario, semilla: 41 });
const w = crearPartida({ reglas: war, escenario: { reto: salida }, semilla: 41 });
const hp = crearHuella(), hw = crearHuella();
assert.equal(par.runtime, null);
for (let i = 0; i < 200; i++) {
  p.paso(); w.paso(); hp.paso(p.instantanea()); hw.paso(w.instantanea());
}
assert.equal(p.mundo.campo, undefined);
assert.equal(p.instantanea().moviles, undefined);
assert.deepEqual(hp.terminar(), hw.terminar());

// La URL, el programa jugable y la cuenta atrás del árbol pasan por la pantalla común.
const banco = await cargar('campaign-v2', '2d', false, false, null, 'movil', '&ensayo=salida', { i18n: true });
let ui;
banco.medirUnidades(ctx => { ui = ctx; });
assert.equal(ui.textoReto('titulo'), 'Salida');
ui.seleccionar([veh]);
assert.match(ui.textoDe(veh), /^moveTo/);
const { preparar: modelo } = await import('../paquetes/editor/seudo-modelo.js');
const { configurar } = await import('../paquetes/editor/index.js');
configurar({ acorn: ui.acorn });
const seudo = { cmg: ui.cmg, $: ui.$, preferencias: {} };
modelo(seudo)();
const fuente = ui.textoDe(veh);
const bloques = seudo.parsear(fuente);
assert.deepEqual(bloques.cuerpo.slice(0, 2).map(n => n.nombre), ['moveTo', 'arrive']);
assert.equal(seudo.generar(bloques).codigo.trim(), fuente.trim());
ui.cambiarLenguaje('python');
assert.match(ui.textoDe(veh), /^puesto = home/);
ui.seleccionar(['LAU-01']);
ui.cambiarLenguaje('python');
ui.$codigo.value = 'while True:\n    print(VEH_01 is None)\n    await wait(0.1)';
ui.$codigo.dispatchEvent({ type: 'input' });
ui.ejecutar();
await ui.enVuelo;
for (let i = 0; i < 300 && !ui.mundo.ausentes.length; i++) await ui.conductor.avanzar(1);
ui.uiHito.arbol();
const fila = ui.$('cv2-arbol').children.find(el => el.className.includes('cv2-ausente'));
assert.match(fila.textContent, /VEH-01.*6 s/);
assert.ok(ui.partida.mundo.batalla.derribos > 0);
await ui.conductor.avanzar(2);
assert.ok(ui.anfitrion.registro().eventos.some(e => e.maquina === 'LAU-01' && e.resultado === 'True'));
ui.conductor.cerrar();
console.log('Salida · registro, puerta, llegada, disparos, reaparición, árbol y paridad comprobados.');
