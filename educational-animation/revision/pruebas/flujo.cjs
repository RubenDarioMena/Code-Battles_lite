// Pruebas del diagrama, el recorrido y las frases del modo revisión, sin navegador.
// node educational-animation/revision/pruebas/flujo.cjs
// Comprueba que sale todo del programa (nada escrito para un reto): la forma del diagrama de los seis cafés,
// los valores de cada vuelta, la recursión, el reto 5 grabado en el juego, los dos idiomas y que cualquier
// programa se puede explicar sin errores ni claves sin traducir.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { RAIZ, grabacion, plano } = require('./cargar.cjs');
const FL = globalThis.CMGFlujo, E = globalThis.CMGExplicar, DOC = globalThis.CMGDocumentacion, C = globalThis.CMGCatalogoRevision, EJ = globalThis.CMGEjecutar, I18N = globalThis.CMGI18n;
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// Programa → { P, F, R, filas: [«num etiqueta»], pasos: [«num narración»] }.
async function revisar(src, idioma = 'es') {
  I18N.cambiarIdioma(idioma);
  const r = await EJ.ejecutar(src, { acorn });
  const P = FL.preparar(r.programa, { serie: 'libre' }), F = FL.construir(P), R = FL.recorrer(P, F);
  const G = { salida: r.salida, error: r.error, cortado: r.cortado };
  const etiqueta = (i) => `${F.filas[i].num} ${plano(P, F, E.etiqueta(P, F, i))}`;
  const narra = (p) => `${p.fila == null ? '-' : F.filas[p.fila].num} ${plano(P, F, E.detalle(P, F, R, p, G))}`;
  return { r, P, F, R, G, etiqueta, narra, pasos: R.pasos.map(narra) };
}
const sinClaves = (txt, m) => ok(!/revision\.|\{\w+\}/.test(txt), `${m}: sin claves ni huecos sin rellenar («${(txt.match(/.{0,30}(revision\.|\{\w+\}).{0,30}/) || [''])[0]}»)`);

(async () => {
  // ---------- 1 · Los seis cafés: la misma forma que la infografía ----------
  const CAFES = fs.readFileSync(path.join(RAIZ, 'educational-animation/revision/ejemplos/cafes/cafes.js'), 'utf8');
  const c = await revisar(CAFES);
  const orden = c.F.orden.filter(e => e.fila != null).map(e => c.etiqueta(e.fila));
  eq(orden, ['1 [drinkCoffee] empieza en 0', '2 ¿[drinkCoffee] es menor que 10?', '3 Suma 1 a [drinkCoffee]', '4 ¿[drinkCoffee] vale 8?', '6 ¿[drinkCoffee] vale 5?', '8 Imprime \'Café\''], 'cafés: filas en orden de lectura');
  const fila = (num) => c.F.filas.find(f => f.num === num);
  eq([fila(4).salida.tipo, c.etiqueta(fila(4).salida.fila)], ['fila', '5 break'], 'cafés: ¿vale 8? → true → break, al lado');
  eq(c.etiqueta(fila(6).salida.fila), '7 continue', 'cafés: ¿vale 5? → true → continue, al lado');
  eq(fila(2).salida, { tipo: 'fin', etiqueta: 'false' }, 'cafés: el while sale por false a «fin del bucle»');
  eq(c.F.orden.filter(e => e.conector).map(e => e.etiqueta), [null, 'true', null, 'false', 'false'], 'cafés: flechas ↓, ↓ true y ↓ false como en la infografía');
  eq(c.F.rieles.map(x => `${c.F.filas[x.de].num}→${c.F.filas[x.a].num}`).sort(), ['7→2', '8→2'], 'cafés: vuelven al while la última fila y el continue');
  eq([fila(4).si, fila(4).sig, fila(6).sig, fila(5).sig, fila(7).sig].map(x => x == null ? null : c.F.filas[x].num), [5, 6, 8, null, 2], 'cafés: a dónde sigue cada fila');
  eq(new Set(c.F.filas.map(f => f.color)).size, c.F.filas.length, 'cafés: cada fila tiene su color');
  eq(c.R.vueltas.length, 8, 'cafés: 8 vueltas');
  eq(c.r.salida.map(x => x.texto), Array(6).fill('Café'), 'cafés: seis cafés en la consola');
  eq(c.R.vueltas.map(v => v.fila == null ? '-' : c.F.filas[v.fila].num).join(''), '----7--5', 'cafés: la vuelta 5 toma el continue y la 8 el break');
  eq(c.pasos[1], '2 [drinkCoffee] vale «0»; 0 < 10 es «true». Entra en la vuelta 1.', 'cafés: la condición lee el valor de antes de sumar');
  ok(c.pasos.includes('6 [drinkCoffee] vale «5»; 5 === 5 es «true». Como es true, sigue en (7).'), 'cafés: el continue de la vuelta 5');
  ok(c.pasos.includes('5 break: sale del bucle aquí mismo y el programa termina.'), 'cafés: el break de la vuelta 8');
  eq(c.pasos.at(-1), '- El programa termina. | Consola:Café / Café / Café / Café / Café / Café', 'cafés: el final enseña la consola');
  eq(c.R.cuentas.get(fila(4).i), { veces: 8, si: 1, no: 7 }, 'cafés: ¿vale 8? se pregunta 8 veces: 1 true, 7 false');

  // ---------- 2 · Inglés: las mismas filas, otras palabras ----------
  const en = await revisar(CAFES, 'en');
  eq(en.F.orden.filter(e => e.fila != null).map(e => en.etiqueta(e.fila)).slice(1, 4), ['2 Is [drinkCoffee] less than 10?', '3 Add 1 to [drinkCoffee]', '4 Is [drinkCoffee] equal to 8?'], 'inglés: etiquetas');
  eq(en.pasos[2], '3 0 + 1 = «1». [drinkCoffee] is now «1».', 'inglés: narración');
  I18N.cambiarIdioma('es');

  // ---------- 3 · Funciones, for…of, if/else con bloques ----------
  const PARES = fs.readFileSync(path.join(RAIZ, 'educational-animation/revision/ejemplos/pares/pares.js'), 'utf8');
  const p = await revisar(PARES);
  const fp = (num) => p.F.filas.find(f => f.num === num);
  eq(p.etiqueta(fp(3).i), '3 Por cada [n] de [numeros]', 'pares: for…of en palabras');
  eq(fp(4).tipo === 'decision' && fp(4).salida === undefined, true, 'pares: un if con bloque no va al lado');
  ok(p.F.secciones.length === 1 && p.etiqueta(p.F.secciones[0]).startsWith('9 Función esPar(n)'), 'pares: la función es una sección aparte');
  eq(p.R.vueltas.map(v => v.fila == null ? '-' : p.F.filas[v.fila].num).join(''), '7575', 'pares: el camino de cada vuelta (else, then, else, then)');
  ok(p.pasos.includes('5 [pares] pasa de «0» a «1».'), 'pares: pares++ cuenta de 0 a 1');
  ok(p.pasos.includes('10 Devuelve «true» a quien llamó a la función.'), 'pares: el return de la función con su valor');
  ok(p.pasos.includes('4 [esPar(n)] es «false». Como es false, va al else: (7).'), 'pares: el if vuelve con el valor de la llamada');
  ok(p.R.pasos.at(-2).fuera, 'pares: el último console.log está después del bucle');

  // ---------- 4 · Recursión: cada return con su propio valor ----------
  const f = await revisar(`function factorial(n) {
  if (n <= 1) return 1
  return n * factorial(n - 1)
}
for (let i = 1; i <= 4; i++) {
  console.log(i, factorial(i))
}`);
  const devuelve = f.pasos.filter(x => / Devuelve /.test(x)).map(x => x.match(/«(.*?)»/)[1]);
  eq(devuelve, ['1', '2', '1', '6', '2', '1', '24', '6', '2', '1'], 'recursión: los return de fuera reciben su valor después de los de dentro');
  eq(f.r.salida.map(x => x.texto), ['1 1', '2 2', '3 6', '4 24'], 'recursión: consola');

  // ---------- 5 · El reto 5 grabado en el juego ----------
  const G = grabacion('reto-5');
  for (const id of ['LAU-01', 'LAU-02']) {
    const P = FL.preparar(G.programas[id], { id, serie: G.serie }), F = FL.construir(P), R = FL.recorrer(P, F, { fin: G.partida });
    const otro = id === 'LAU-01' ? 'LAU-02' : 'LAU-01';
    const et = F.orden.filter(e => e.fila != null).map(e => `${F.filas[e.fila].num} ${plano(P, F, E.etiqueta(P, F, e.fila))}`);
    eq(et, ['1 Repite siempre', '2 Guarda en [pos]: dron, si no dron frío, si no oruga', `3 ¿${otro} está atascado?`, '5 ¿[failureRate] es menor que 0.12?', '7 Dispara normal a [pos]', '8 Espera 0,25 s'], `${id}: diagrama con el catálogo del juego`);
    const lado = F.filas.filter(x => x.lateral).map(x => `${x.num} ${plano(P, F, E.etiqueta(P, F, x.i))}`);
    eq(lado, ['4 Dispara normal a [pos]', '6 Dispara en ráfaga a [pos]'], `${id}: las órdenes de cada rama, al lado`);
    eq(R.vueltas.length, 146, `${id}: 146 vueltas en 36,45 s`);
    const atascado = R.vueltas.filter(v => v.fila != null && F.filas[v.fila].num === 4).length;
    eq(atascado, id === 'LAU-01' ? 19 : 14, `${id}: vueltas en que vio a ${otro} atascado (camino de la fila 4)`);
    const narr = R.pasos.map(x => plano(P, F, E.detalle(P, F, R, x, G)));
    ok(narr.some(x => x.includes(`es «true»: ${otro} está atascado. Como es true, sigue en (4).`)), `${id}: lee que el otro está atascado`);
    ok(narr.some(x => /Espera 0,25 s: de \d+(,\d+)? s a \d+(,\d+)? s\./.test(x)), `${id}: las esperas con sus tiempos`);
    eq(narr.at(-1), 'La partida termina a los 36,45 s: victoria. 31 de 31 derribados · 0 brechas · 2 atascos.', `${id}: el final es el de la partida`);
    const q = E.queEs(P, F, R, F.filas.find(x => x.num === 3).test, R.pasos[10]);
    ok(plano(P, F, q.cuerpo).includes('Es de otra máquina'), `${id}: tocar ${otro.replace('-', '_')}.jammed explica que es de otra máquina`);
  }

  // ---------- 6 · Textos: los dos idiomas, las mismas claves y huecos ----------
  const mapas = { es: {}, en: {} };
  require('node:vm').runInNewContext(fs.readFileSync(path.join(RAIZ, 'educational-animation/revision/motor/textos.js'), 'utf8'),
    { window: { CMGI18n: { registrar: (i, m) => Object.assign(mapas[i], m) } } });
  eq(Object.keys(mapas.en).sort(), Object.keys(mapas.es).sort(), 'textos: mismas claves en español e inglés');
  const huecos = (x) => [...x.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const k of Object.keys(mapas.es)) assert.deepEqual(huecos(mapas.en[k]), huecos(mapas.es[k]), `${k}: mismos huecos`);
  n++;
  for (const tipo of C.tipos) for (const k of C.clavesDe(tipo)) ok(mapas.es['revision.' + k] && mapas.en['revision.' + k], `catálogo ${tipo.clave}: falta revision.${k}`);
  // Un robot nuevo se registra con sus textos y se explica solo.
  I18N.registrar('es', { 'revision.cat.dron.nombre': 'dron explorador', 'revision.cat.dron.descripcion': 'Dron del jugador.', 'revision.cat.dron.bateria.que': 'La batería que le queda.',
    'revision.cat.dron.patrullar.hace': 'Vuela en círculos por esa zona.', 'revision.cat.dron.patrullar.etiqueta': 'Patrulla {0}', 'revision.cat.dron.patrullar.arg0': 'la zona',
    'revision.cat.dron.patrullar.resultado.ok': 'el dron sale a patrullar' });
  C.registrar({ clave: 'dron', patron: /^DRN_\d+$/, idDe: (x) => x.replace(/_/g, '-'), propiedades: { bateria: { tipo: 'numero' } }, metodos: { patrullar: { clase: 'orden', args: [{}], resultados: ['ok'] } } });
  const d = await revisar(`if (DRN_01.bateria > 20) DRN_01.patrullar("norte")`);
  eq(d.etiqueta(d.F.filas.find(x => x.lateral).i), '2 Patrulla "norte"', 'catálogo: un robot nuevo da su etiqueta');
  ok(C.clavesDe(C.tipos.find(t => t.clave === 'dron')).includes('cat.dron.patrullar.resultado.ok'), 'catálogo: sabe qué textos necesita un robot nuevo');

  // ---------- 7 · Cualquier programa: se explica sin errores ni claves sueltas ----------
  const VARIOS = [
    `let a = 0; let s = ''\nfuera: for (let i = 0; i < 3; i++) {\n  for (let j = 0; j < 3; j++) {\n    if (j === 1) continue fuera\n    a += i * j\n  }\n}\nif (a > 99) s = 'x'\nelse if (typeof nada === 'undefined') s = 'y'\nelse s = 'z'\nconst k = ({ b: 2 })?.b ?? 5\nconst m = (k > 1) ? 'grande' : 'chico'\nwhile (a < 3) a++\nconsole.log(a, s, k, m)`,
    `const xs = [4, 1, 3]\nconst dobles = xs.map((x) => x * 2)\nconst total = dobles.reduce((t, x) => { return t + x }, 0)\nconsole.log(total)`,
    `let n = 0\ndo { n += 2 } while (n < 5)\nswitch (n) {\n  case 6: console.log('seis'); break\n  default: console.log('otro')\n}`,
    `try {\n  null.x\n} catch (e) {\n  console.log('falló')\n} finally {\n  console.log('fin')\n}`,
    `const o = { a: 1, b: 2 }\nfor (const k in o) {\n  if (!o[k]) continue\n  console.log(k)\n}`,
    `let t = 0\nwhile (true) {\n  t++\n  if (t > 3 && t % 2 === 0 || t > 9) break\n  await esperar(0.5)\n}\nconsole.log(t)`,
    `function f() { throw new Error('ay') }\nf()`,
    `while (true) {}`,
    `console.log('sin bucles')`,
  ];
  for (const [k, src] of VARIOS.entries()) {
    const v = await revisar(src);
    const textos = [...v.F.filas.map(x => v.etiqueta(x.i)), ...v.pasos];
    for (const nodo of v.P.nodos) if (nodo.padre != null) textos.push(plano(v.P, v.F, E.queEs(v.P, v.F, v.R, nodo.id, v.R.pasos[0]).cuerpo));
    for (const nodo of v.P.nodos) textos.push(DOC.tema(v.P, nodo.id).titulo);
    sinClaves(textos.join(' ‖ '), `programa ${k + 1}`);
    ok(v.R.pasos.at(-1).fin, `programa ${k + 1}: termina con un paso final`);
  }
  const inf = await revisar(`while (true) {}`);
  ok(inf.r.cortado && inf.pasos.at(-1).includes('el programa no terminaba'), 'un bucle sin fin se corta y lo dice');
  const err = await revisar(`function f() { throw new Error('ay') }\nf()`);
  ok(err.pasos.at(-1).includes('Error: ay'), 'un error se cuenta al final');
  const esp = await revisar(VARIOS[5]);
  ok(esp.R.conReloj && esp.pasos.some(x => x.includes('Espera 0,5 s: de 0 s a 0,5 s.')), 'esperar() adelanta un reloj virtual sin juego');

  // ---------- 8 · Documentación: el tema de cada elemento sale del árbol ----------
  const tema = (v, num) => DOC.tema(v.P, v.F.filas.find(f => f.num === num).nodo).titulo;
  I18N.cambiarIdioma('es');
  eq([1, 2, 3, 4, 5, 7, 8].map(x => tema(c, x)), ['LET', 'WHILE', 'ASIGNACIÓN =', 'IF', 'BREAK', 'CONTINUE', 'CONSOLE · log'], 'documentación: el tema de cada fila de los cafés');
  const dc = await revisar(`function saluda(nombre = 'Ada') { return nombre }\nconst xs = [3, 1]\nxs.push(saluda().length)\nfor (const x of xs) { if (x > 2) console.log(x) }`);
  const nodoDe = (v, tipo) => v.P.nodos.find(x => x.tipo === tipo).id;
  eq(DOC.tema(dc.P, nodoDe(dc, 'AssignmentPattern')).titulo, 'ARGUMENTO CON VALOR POR DEFECTO', 'documentación: un argumento con valor por defecto');
  eq(DOC.tema(dc.P, dc.P.nodos.find(x => x.tipo === 'Identifier' && x.nombre === 'push').id).titulo, 'MÉTODO DE LISTA · push', 'documentación: un método de lista, desde su nombre');
  eq(DOC.tema(dc.P, nodoDe(dc, 'ForOfStatement')).titulo, 'FOR…OF', 'documentación: for…of');
  eq(DOC.tema(dc.P, nodoDe(dc, 'FunctionDeclaration')).clave, 'funcion', 'documentación: una función');
  const g5 = grabacion('reto-5'), P5 = FL.preparar(g5.programas['LAU-01'], { id: 'LAU-01', serie: g5.serie }), F5 = FL.construir(P5);
  const t5 = (num) => DOC.tema(P5, F5.filas.find(f => f.num === num).nodo).titulo;
  eq([t5(3), t5(6)], ['IF', 'ORDEN DEL JUEGO · burstFire'], 'documentación: reto 5, el if y una orden del juego');
  eq(DOC.tema(P5, F5.filas.find(f => f.num === 3).test).titulo, 'LECTURA DEL JUEGO · jammed', 'documentación: LAU_02.jammed es una lectura del juego');
  eq(DOC.tema(P5, F5.filas.find(f => f.num === 5).nodo).titulo, 'ELSE IF', 'documentación: else if');
  I18N.cambiarIdioma('en');
  eq(t5(6), 'GAME COMMAND · burstFire', 'documentación: en inglés');
  I18N.cambiarIdioma('es');

  // ---------- 9 · Recorrido de lectura: el programa explicado sin ejecutarlo ----------
  const T = globalThis.CMGTrazador;
  const leer = (src, { idioma = 'es', id = null, serie = 'libre' } = {}) => {
    I18N.cambiarIdioma(idioma);
    const x = T.instrumentar(src, { acorn });
    const P = FL.preparar({ fuente: x.fuente, nodos: x.nodos, comentarios: x.comentarios, eventos: [] }, { id, serie }), F = FL.construir(P), R = FL.estructura(P, F);
    const textos = R.pasos.map(p => p.fin ? plano(P, F, E.resumen(P, F, R)) : `${F.filas[p.fila].num} ${plano(P, F, E.describir(P, F, p.fila))}`);
    return { P, F, R, textos };
  };
  const lc = leer(CAFES);
  eq(lc.R.estructural && lc.R.pasos.length, 9, 'lectura: los cafés, 8 filas y el final, sin ejecutar nada');
  eq(lc.R.pasos.slice(0, -1).map(p => lc.F.filas[p.fila].num), [1, 2, 3, 4, 5, 6, 7, 8], 'lectura: en orden de lectura, cada salida lateral tras su decisión');
  eq(lc.textos, [
    '1 Crea [drinkCoffee], que empieza valiendo 0 y puede cambiar después.',
    '2 Mientras [drinkCoffee] es menor que 10, repite las filas (3) a (8). Al acabar, el programa acaba.',
    '3 Suma 1 a [drinkCoffee].',
    '4 Si [drinkCoffee] vale 8, sigue en (5); si no, salta a (6).',
    '5 Sale del bucle (2) aunque su condición siga cumpliéndose, y el programa acaba. Solo pasa por aquí si (4) se cumple.',
    '6 Si [drinkCoffee] vale 5, sigue en (7); si no, salta a (8).',
    '7 Se salta lo que queda de la vuelta y vuelve a (2). Solo pasa por aquí si (6) se cumple.',
    "8 Escribe 'Café' en la consola. Después vuelve a (2).",
    'Ese es todo el programa.',
  ], 'lectura: los cafés, fila a fila');
  const JUEGO = 'while (true) {\n  const pos = autoTarget("drone", "visual")\n  if (pos) regularShoot(pos)\n  stopFire()\n  await esperar(0.25)\n}';
  const lj = leer(JUEGO, { id: 'LAU-01', serie: 'war' });
  eq(lj.textos[1], '2 Sensor cámara: busca el dron más avanzado y calcula dónde estará cuando llegue el misil. Lo guarda en [pos]. Si no ve ninguno, [pos] queda en null.', 'lectura: una lectura del juego dice qué busca y qué pasa si no hay nada');
  eq(lj.textos[2], '3 Si [pos] tiene un valor, sigue en (4); si no, salta a (5).', 'lectura: «if (pos)» es «si pos tiene un valor»');
  eq(lj.textos[3], '4 Pone al lanzador a disparar a [pos], 1 misil por segundo, hasta que reciba otra orden. Solo pasa por aquí si (3) se cumple.', 'lectura: una orden dentro de un if');
  ok(lj.textos[5].endsWith('Después vuelve a (1).'), 'lectura: la última fila de la vuelta vuelve al bucle');
  ok(lj.textos.at(-1).includes('mientras dure la partida'), 'lectura: en el juego, el bucle sin fin dura lo que la partida');
  const ls = leer('while (true) {\n  const pos = autoTarget("drone", "visual")\n  regularShoot(pos)\n  await esperar(0.25)\n}', { id: 'LAU-01', serie: 'war' });
  ok(ls.textos[2].endsWith('Si [pos] es null, se queda parado.'), 'lectura: una orden con un lugar que puede ser null avisa');
  const le = leer(JUEGO, { idioma: 'en', id: 'LAU-01', serie: 'war' });
  eq(le.textos[2], '3 If [pos] has a value, it goes on at (4); if not, it jumps to (5).', 'lectura: en inglés');
  ok(le.textos[1].startsWith('2 With the camera sensor, finds the most advanced drone'), 'lectura: la frase breve del catálogo, en inglés');
  I18N.cambiarIdioma('es');
  // La tarjeta de una orden: lo secundario plegado y sin cuentas (no se ejecutó nada).
  const nodoShoot = lj.P.nodos.find(x => x.tipo === 'CallExpression' && lj.P.txt(x.id).startsWith('regularShoot')).id;
  const q = E.queEs(lj.P, lj.F, lj.R, nodoShoot, lj.R.pasos[3]);
  ok(q.cuerpo.some(x => x && x.mas) && !plano(lj.P, lj.F, q.cuerpo).includes('Se ejecutó'), 'lectura: la tarjeta de regularShoot pliega lo que puede devolver y no cuenta ejecuciones');
  ok(plano(lj.P, lj.F, q.cuerpo.filter(x => !(x && x.mas))).length < 140, 'lectura: lo que se ve sin desplegar es corto');
  for (const idioma of ['es', 'en']) for (const [k, src] of [...VARIOS, CAFES, JUEGO, 'function apunta(t) {\n  return autoTarget(t, "thermal")\n}\nlet listo = false\nwhile (!listo) {\n  const p = apunta("drone")\n  if (!p) continue\n  listo = true\n}\nfor (const id of ["a", "b"]) { if (LAU_02.jammed) break }'].entries()) {
    const v = leer(src, { idioma, id: 'LAU-01', serie: 'war' });
    sinClaves(v.textos.join(' ‖ '), `lectura ${idioma} ${k + 1}`);
    eq(v.R.pasos.length, v.F.filas.length + 1, `lectura ${idioma} ${k + 1}: un paso por fila y el final`);
  }
  const lb = leer('let listo = false\nwhile (!listo) {\n  listo = true\n}\nwhile (true) {\n  if (listo) break\n}');
  ok(lb.textos[1].startsWith('2 Mientras [listo] es false, repite la fila (3).'), 'lectura: una variable de true/false se dice con true y false');
  ok(lb.textos.some(x => x.includes('hasta que un break lo saca')), 'lectura: un bucle sin fin con break dice que el break lo saca');
  I18N.cambiarIdioma('es');

  console.log(`flujo: ${n} comprobaciones`);
})().catch(e => { console.error(e); process.exit(1); });
