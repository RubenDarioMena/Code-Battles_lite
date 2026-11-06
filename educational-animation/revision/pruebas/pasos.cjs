// Pruebas de catálogo, explicaciones y pasos sobre la grabación real del reto 5.
// node educational-animation/revision/pruebas/pasos.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const R = path.join(__dirname, '..');
globalThis.window = globalThis;
globalThis.acorn = require(path.join(R, '../../shared/vendor/acorn-8.11.3.js'));
for (const f of ['motor/trazador.js', 'motor/catalogo.js', 'motor/explicar.js', 'motor/pasos.js', 'ejemplos/reto-5/grabacion.js'])
  vm.runInThisContext(fs.readFileSync(path.join(R, f), 'utf8'), { filename: f });
const { CMGTrazador: T, CMGCatalogo: C, CMGExplicar: E, CMGPasos: PS } = globalThis;
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const plano = (P, seg) => seg.flat().map(s => typeof s === 'string' ? s : s.b || (s.c != null ? P.txt(s.c) : s.k || ('v' in s ? E.valor(s.v).texto : s.nota || ''))).join('');

const G = window.GRABACIONES_REVISION['reto-5'];
// 1 · La grabación: partida real, la misma sin traza, y la variante para comparar.
eq([G.partida.resultado, G.partida.brechas, G.partida.atascos.length], ['victoria', 0, 2], 'partida grabada: victoria, 0 brechas, 2 atascos');
ok(G.verificacion.mismaPartidaSinTraza, 'misma partida con y sin traza');
eq(G.comparaciones.map(c => [c.titulo, c.partida.resultado, c.partida.atascos.length]), [['Sin el if de jammed', 'victoria', 3]], 'sin la regla de jammed: 3 atascos');
for (const [id, p] of Object.entries(G.programas)) {
  const r = T.instrumentar(p.fuente, { acorn });
  eq(r.nodos.length, p.nodos.length, `${id}: la tabla de nodos coincide con la del trazador actual`);
}

const d1 = PS.construir(G, 'LAU-01'), d2 = PS.construir(G, 'LAU-02');
for (const [id, d] of [['LAU-01', d1], ['LAU-02', d2]]) {
  const P = d.P;
  // 2 · Vueltas: todas empiezan con la condición del bucle y cubren la partida.
  ok(d.vueltas.length > 140, `${id}: más de 140 vueltas`);
  ok(d.vueltas.every(v => v.grupos[0].tipo === 'c' && v.grupos[0].valor === true), `${id}: cada vuelta empieza con while (true)`);
  eq(d.vueltas[0].t, 0, `${id}: la primera vuelta empieza a los 0 s`);
  ok(d.vueltas.at(-1).cortada, `${id}: la última vuelta queda cortada por el fin de la partida`);
  // 3 · Pasos: el programa, el tiempo no retrocede, el resultado al final.
  eq(d.pasos[0].tipo, 'programa', `${id}: empieza con el programa en palabras`);
  eq(d.pasos.at(-1).tipo, 'final', `${id}: termina con el resultado`);
  const ts = d.pasos.filter(p => p.tipo === 'detalle' || p.tipo === 'fase').map(p => p.t);
  ok(ts.every((t, i) => !i || t >= ts[i - 1]), `${id}: el tiempo de los pasos no retrocede`);
  ok(d.pasos.length >= 15 && d.pasos.length <= 35, `${id}: entre 15 y 35 pasos (${d.pasos.length})`);
  const lineas = P.fuente.split('\n').length;
  ok(d.pasos.every(p => p.lineas.every(l => l.linea >= 1 && l.linea <= lineas) && p.foco.every(i => P.nodos[i])), `${id}: focos y líneas válidos`);
  const textos = d.pasos.flatMap(p => p.texto ? [plano(P, p.texto)] : p.lineasNL.map(l => plano(P, l.seg)));
  ok(textos.every(t => !/undefined|NaN|\[object/.test(t)), `${id}: ningún texto con undefined, NaN u objetos`);
  // 4 · «¿Qué es?» para cada nodo, sin errores.
  ok(P.nodos.every(x => x.padre == null || E.queEs(P, x.id).cuerpo), `${id}: «qué es» para todos los nodos`);
}
// 5 · La historia del reto: cada uno cubre al otro mientras está atascado.
const tramo = (d, tono) => d.fases.filter(f => f.tono === tono).map(f => [f.t0, f.t1]);
eq(tramo(d1, 'otra'), [[25, 29.75]], 'LAU-01 lee LAU_02.jammed === true de 25 a 29,75 s');
eq(tramo(d2, 'otra'), [[20.5, 24]], 'LAU-02 lee LAU_01.jammed === true de 20,5 a 24 s');
eq(tramo(d1, 'bad'), [[20.5, 24]], 'LAU-01 atascado de 20,5 a 24 s: sus órdenes devuelven "atascado"');
eq(tramo(d2, 'bad'), [[25, 30.25]], 'LAU-02 atascado de 25 a 30,25 s');
const jam = d1.pasos.find(p => p.tipo === 'detalle' && plano(d1.P, p.texto).startsWith('Decisión. LAU_02.jammed es true'));
ok(jam && /LAU-02 está atascado/.test(plano(d1.P, jam.texto)), 'el paso del atasco del compañero lo dice con su valor real');
const notas = d1.pasos.flatMap(p => (p.texto || []).filter(s => s && s.nota).map(s => s.nota));
eq(notas, ['Un solo reparador para LAU-01 y LAU-02', 'Que baje el failureRate', 'El reparador está ocupado'], 'los comentarios del autor aparecen como notas, una vez cada uno');
ok(plano(d1.P, d1.pasos.at(-1).texto).includes('1 atasco más'), 'el resultado compara con la variante sin jammed');

// 6 · Resolución de nombres: propio, de otra máquina y lectura de otra máquina.
const P1 = d1.P, buscar = (t) => P1.nodos.find(x => P1.txt(x.id) === t).id;
eq(E.rol(P1, buscar('LAU_02.jammed')), 'otra', 'LAU_02.jammed es de otra máquina (cian)');
eq(E.rol(P1, buscar('failureRate')), 'propia', 'failureRate sin objeto es de la propia máquina (morado)');
eq(E.rol(P1, buscar('burstFire(pos)')), 'orden', 'burstFire es una orden (cobre)');
eq(E.rol(P1, buscar('autoTarget("drone", "visual")')), 'sensor', 'autoTarget es una lectura de sensor (azul)');
eq(E.queEs(P1, buscar('LAU_02.jammed')).etiqueta, 'propiedad de otra máquina: LAU-02', '«qué es» de LAU_02.jammed');

// 7 · Ampliar el catálogo: una máquina nueva se explica en cuanto se registra.
C.registrar({
  clave: 'dron-propio', nombre: 'dron explorador', patron: /^DRN_\d+$/, idDe: (x) => x.replace(/_/g, '-'),
  descripcion: 'Dron explorador del jugador.',
  propiedades: { bateria: { tipo: 'numero', rol: 'otra', que: 'la batería que le queda', frase: (s) => `la batería de ${s}`, valor: (v) => `${v} %` } },
  metodos: { patrullar: { clase: 'orden', rol: 'orden', args: [{ que: 'zona', valores: { norte: 'la mitad norte del mapa' } }], hace: 'vuela en círculos por esa zona', frase: (a) => `patrulla ${a[0]}`, resultados: { ok: 'el dron sale a patrullar' } } },
});
const src = 'if (DRN_01.bateria > 20) {\n  DRN_01.patrullar("norte")\n}\n';
const r = T.instrumentar(src, { acorn });
const Pd = E.preparar({ fuente: src, nodos: r.nodos }, { id: 'LAU-01', serie: 'war' });
const call = r.nodos.find(x => x.tipo === 'CallExpression').id, test = r.nodos.find(x => x.ganchos.includes('c')).id;
const est = r.nodos.find(x => x.tipo === 'ExpressionStatement').id, bat = r.nodos.find(x => Pd.txt(x.id) === 'DRN_01.bateria').id;
eq(plano(Pd, E.frase(Pd, test, true)), 'la batería de DRN-01 es mayor que 20', 'frase de la condición con la máquina nueva');
ok(plano(Pd, E.narrar(Pd, { tipo: 's', nodo: est, ev: [[call, 'ok']] }, { explicados: new Set() })).includes('vuela en círculos por esa zona. Devuelve "ok": el dron sale a patrullar'), 'narración de la orden nueva');
ok(plano(Pd, E.narrar(Pd, { tipo: 'c', nodo: test, valor: true, ev: [[bat, 64]] })).includes('DRN_01.bateria vale 64, y 64 > 20 es true'), 'narración de la condición con su valor');
eq(E.queEs(Pd, call).etiqueta, 'orden de DRN-01', '«qué es» de la llamada nueva');

console.log(`pasos: ${n} comprobaciones`);
