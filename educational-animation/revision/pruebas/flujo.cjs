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
    '1 Crea [drinkCoffee] con 0; puede cambiar después.',
    '2 Mientras [drinkCoffee] es menor que 10, repite las filas (3) a (8). Después, el programa acaba.',
    '3 Suma 1 a [drinkCoffee].',
    '4 Si [drinkCoffee] vale 8, sigue en (5); si no, salta a (6).',
    '5 Sale del bucle (2) antes de tiempo y el programa acaba.',
    '6 Si [drinkCoffee] vale 5, sigue en (7); si no, salta a (8).',
    '7 Se salta el resto de la vuelta y vuelve a (2).',
    "8 Escribe 'Café' en la consola. Luego vuelve a (2).",
    'Eso es todo el programa.',
  ], 'lectura: los cafés, fila a fila');
  const JUEGO = 'while (true) {\n  const pos = autoTarget("drone", "visual")\n  if (pos) regularShoot(pos)\n  stopFire()\n  await esperar(0.25)\n}';
  const lj = leer(JUEGO, { id: 'LAU-01', serie: 'war' });
  eq(lj.textos[1], '2 Sensor cámara: busca el dron más avanzado y calcula dónde estará. Lo guarda en [pos] (null si no ve ninguno).', 'lectura: una lectura del juego dice qué busca y qué pasa si no hay nada');
  eq(lj.textos[2], '3 Si [pos] tiene un valor, sigue en (4); si no, salta a (5).', 'lectura: «if (pos)» es «si pos tiene un valor»');
  eq(lj.textos[3], '4 Dispara a [pos], 1 misil por segundo, hasta otra orden.', 'lectura: una orden dentro de un if');
  ok(lj.textos[5].endsWith('Luego vuelve a (1).'), 'lectura: la última fila de la vuelta vuelve al bucle');
  ok(lj.textos.at(-1).includes('mientras dure la partida'), 'lectura: en el juego, el bucle sin fin dura lo que la partida');
  ok(lj.textos.every(x => x.length <= 120), 'lectura: ninguna frase del recorrido pasa de 120 caracteres (móvil)');
  const ls = leer('while (true) {\n  const pos = autoTarget("drone", "visual")\n  regularShoot(pos)\n  await esperar(0.25)\n}', { id: 'LAU-01', serie: 'war' });
  ok(ls.textos[2].endsWith('Si [pos] es null, se queda parado.'), 'lectura: una orden con un lugar que puede ser null avisa');
  const le = leer(JUEGO, { idioma: 'en', id: 'LAU-01', serie: 'war' });
  eq(le.textos[2], '3 If [pos] has a value, it goes on at (4); if not, it jumps to (5).', 'lectura: en inglés');
  ok(le.textos[1].startsWith('2 Uses the camera sensor to find the most advanced drone'), 'lectura: la frase breve del catálogo, en inglés');
  ok(le.textos[1].endsWith('(null if it sees none).'), 'lectura: en inglés, null si no ve ninguno');
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

  // ---------- 10 · Python: el mismo diagrama y las mismas frases, con las palabras de Python ----------
  const PY = globalThis.CMGPythonRevision;
  const leerPy = (src, { idioma = 'es', id = 'LAU-01', serie = 'war' } = {}) => {
    I18N.cambiarIdioma(idioma);
    const P = FL.preparar(PY.leer(src, { nombre: C.desdePython }), { id, serie }), F = FL.construir(P), R = FL.estructura(P, F);
    return { P, F, R, et: F.filas.map(f => `${f.num} ${plano(P, F, E.etiqueta(P, F, f.i))}`),
      textos: R.pasos.map(p => p.fin ? plano(P, F, E.resumen(P, F, R)) : `${F.filas[p.fila].num} ${plano(P, F, E.describir(P, F, p.fila))}`) };
  };
  const RETO5_PY = '# Un solo reparador\nwhile True:\n    pos = (auto_target("drone", "visual")\n        or auto_target("stealth", "visual")\n        or auto_target("crawler", "visual"))\n    if LAU_02.jammed:\n        regular_shoot(pos)\n    elif failure_rate < 0.12:\n        burst_fire(pos)\n    else:\n        regular_shoot(pos)\n    wait(0.25)\n';
  const p5 = leerPy(RETO5_PY);
  // El mismo programa en JavaScript da el mismo diagrama (solo cambia el código de las fichas).
  const j5 = leer(grabacion('reto-5').programas['LAU-01'].fuente, { id: 'LAU-01', serie: 'war' });
  eq(p5.F.filas.map(f => [f.tipo, f.num, f.nivel, f.si, f.no, f.sig]), j5.F.filas.map(f => [f.tipo, f.num, f.nivel, f.si, f.no, f.sig]), 'python: el reto 5 da el mismo diagrama que en JavaScript');
  eq(p5.textos.map(x => x.replace(/\[[^\]]*\]/g, '[]')), j5.textos.map(x => x.replace(/\[[^\]]*\]/g, '[]')), 'python: y las mismas frases del recorrido');
  eq(p5.et.slice(0, 3), ['1 Repite siempre', '2 Guarda en [pos]: dron, si no dron frío, si no oruga', '3 ¿LAU-02 está atascado?'], 'python: «or» entre lecturas es «lo primero que encuentre»; LAU_02.jammed, del catálogo');
  eq(p5.textos[4], '5 Si [failure_rate] es menor que 0.12, sigue en (6); si no, va a (7).', 'python: failure_rate es la propiedad failureRate (el código se ve como está escrito)');
  eq(p5.textos[7], '8 Espera 0,25 s; mientras, sigue con su última orden. Luego vuelve a (1).', 'python: wait es esperar');
  const ps = leerPy('while True:\n    pos = auto_target("drone", "visual")\n    if pos:\n        regular_shoot(pos)\n    wait(0.25)\n');
  eq(ps.textos[1], '2 Sensor cámara: busca el dron más avanzado y calcula dónde estará. Lo guarda en [pos] (None si no ve ninguno).', 'python: None en lugar de null');
  eq(ps.textos[2], '3 Si [pos] tiene un valor, sigue en (4); si no, salta a (5).', 'python: «if pos:»');
  const pe = leerPy('while True:\n    pos = auto_target("drone", "visual")\n    if pos:\n        regular_shoot(pos)\n    wait(0.25)\n', { idioma: 'en' });
  ok(pe.textos[1].endsWith('(None if it sees none).'), 'python: en inglés');
  // Precedencia de Python (lezer la deja plana): not, and/or, is not, not in.
  const pp = leerPy('if not LAU_02.jammed and x is not None:\n    stop_fire()\nif not a == b:\n    pass\n', { serie: 'war' });
  const tipo = (P, i) => P.nodos[i].tipo + (P.nodos[i].op ? ' ' + P.nodos[i].op : '');
  const t1 = pp.F.filas[0].test, t2 = pp.F.filas[2].test;
  eq([tipo(pp.P, t1), tipo(pp.P, pp.P.hijo(t1, 'left')), tipo(pp.P, pp.P.hijo(t1, 'right'))], ['LogicalExpression &&', 'UnaryExpression !', 'BinaryExpression !=='], 'python: not a and b es (not a) and b; is not es !==');
  eq([tipo(pp.P, t2), tipo(pp.P, pp.P.hijo(t2, 'argument'))], ['UnaryExpression !', 'BinaryExpression ==='], 'python: not a == b es not (a == b)');
  eq(pp.et[0], '1 ¿LAU-02 funciona y [x] no vale None?', 'python: la pregunta, con None');
  // Un programa de Python cualquiera: bucles, funciones, break, continue, try, tuplas.
  const CAFES_PY = 'drink_coffee = 0\nwhile drink_coffee < 10:\n    drink_coffee += 1\n    if drink_coffee == 8:\n        break\n    if drink_coffee == 5:\n        continue\n    print("Café")\n';
  const pc = leerPy(CAFES_PY, { id: null, serie: 'libre' }), jc = leer(CAFES);
  eq(pc.textos.map(x => x.replace(/\[[^\]]*\]/g, '[]')), jc.textos.map(x => x.replace(/\[[^\]]*\]/g, '[]').replace("'Café'", '"Café"')), 'python: los cafés, igual que en JavaScript');
  for (const idioma of ['es', 'en']) for (const [k, src] of [RETO5_PY, CAFES_PY,
    'def es_par(n):\n    return n % 2 == 0\n\nnumeros = [3, 8, 5, 12]\npares = 0\nfor n in numeros:\n    if es_par(n):\n        pares += 1\n        print(n, "es par")\n    else:\n        print(n, "es impar")\nprint("Pares:", pares)\n',
    'try:\n    x = VIB_01.detect("crawler")\nexcept Exception as e:\n    print("error", e)\nf = lambda t: t * 2\na, b = 1, 2\nfor i, x in enumerate([1]):\n    pass\n',
    'import math\nclass A:\n    pass\nx = [i for i in range(3)]\nwhile x and not y or z:\n    x = x[1:]\n'].entries()) {
    const v = leerPy(src, { idioma });
    sinClaves(v.textos.join(' ‖ ') + v.et.join(' ‖ '), `python ${idioma} ${k + 1}`);
    eq(v.R.pasos.length, v.F.filas.length + 1, `python ${idioma} ${k + 1}: un paso por fila y el final`);
    ok(!/\b(null|true|false|undefined)\b/.test(v.textos.join(' ')), `python ${idioma} ${k + 1}: sin palabras de JavaScript`);
    // Los nodos se anidan (el resaltado del código depende de ello) y caen en el texto de Python.
    ok(v.P.nodos.every(x => x.padre == null || (x.a >= v.P.nodos[x.padre].a && x.b <= v.P.nodos[x.padre].b)), `python ${idioma} ${k + 1}: los nodos se anidan`);
  }
  // La documentación (pulsación larga), con los nombres de Python.
  I18N.cambiarIdioma('es');
  const titulo = (v, pred) => DOC.tema(v.P, v.P.nodos.find(pred).id).titulo;
  eq([titulo(p5, x => x.tipo === 'IfStatement' && x.campo === 'alternate'), titulo(p5, x => x.tipo === 'CallExpression' && p5.P.txt(x.id).startsWith('burst_fire'))], ['ELIF', 'ORDEN DEL JUEGO · burstFire'], 'python: documentación de elif y de una orden');
  const pd = leerPy('for n in [1]:\n    print(n and None)\n');
  eq([titulo(pd, x => x.tipo === 'ForOfStatement'), titulo(pd, x => x.tipo === 'CallExpression'), titulo(pd, x => x.tipo === 'LogicalExpression'), titulo(pd, x => x.tipo === 'Literal' && x.valor === null)], ['FOR…IN', 'CONSOLA · print', 'LÓGICA and', 'NONE'], 'python: for…in, print, and, None');
  let errPy = null;
  try { PY.leer('while True:\n    regular_shoot(\n'); } catch (e) { errPy = e; }
  ok(errPy && errPy.loc && errPy.loc.line >= 2, 'python: un error de sintaxis se avisa con su línea');
  I18N.cambiarIdioma('es');

  // ---------- 11 · lista.forEach(x => { … }) se lee como un bucle «por cada», igual que el for de Python ----------
  const APLANAR_JS = 'function aplanar(lista) {\n  let resultado = []\n  lista.forEach(elemento => {\n    if (Array.isArray(elemento)) {\n      resultado = resultado.concat(aplanar(elemento))\n    } else {\n      resultado.push(elemento)\n    }\n  })\n  return resultado\n}\nconst plana = aplanar([1, [2, 3], 7])\nconsole.log(plana)';
  const APLANAR_PY = 'def aplanar(lista):\n    resultado = []\n    for elemento in lista:\n        if isinstance(elemento, list):\n            resultado = resultado.concat(aplanar(elemento))\n        else:\n            resultado.push(elemento)\n    return resultado\nplana = aplanar([1, [2, 3], 7])\nprint(plana)';
  const fj = leer(APLANAR_JS), fpy = leerPy(APLANAR_PY, { id: null, serie: 'libre' });
  const forma = (v) => v.F.filas.map(f => `${f.num} ${f.tipo} ${f.nivel}`);
  eq(forma(fj), forma(fpy), 'forEach: las mismas filas que el for de Python');
  eq(fj.F.rieles, fpy.F.rieles, 'forEach: las mismas flechas de vuelta al bucle');
  const bj = fj.F.filas.find(f => f.tipo === 'bucle');
  eq(plano(fj.P, fj.F, E.etiqueta(fj.P, fj.F, bj.i)), 'Por cada [elemento] de [lista]', 'forEach: «Por cada elemento de lista»');
  eq(fj.P.txt(bj.foco), 'elemento', 'forEach: en el código se ilumina la variable de cada vuelta');
  eq(fj.F.filas.filter(f => f.tipo === 'funcion').length, 1, 'forEach: la función de la vuelta no sale como función aparte');
  eq(fj.textos.map(x => x.replace(/\[[^\]]*\]/g, '[]')), fpy.textos.map(x => x.replace(/\[[^\]]*\]/g, '[]').replace('True', 'true')), 'forEach: las mismas frases que el for de Python (salvo True)');
  // return dentro de forEach acaba solo esa vuelta: vuelve al bucle, como continue.
  const fr = leer('[1, 2].forEach(function (n) {\n  if (n > 1) return\n  console.log(n)\n})');
  const ret = fr.F.filas.find(f => fr.P.nodos[f.nodo].tipo === 'ReturnStatement');
  eq(ret.salto, 'continue', 'forEach: return sigue con la siguiente vuelta');
  ok(fr.F.rieles.some(r => r.de === ret.i), 'forEach: el return tiene flecha de vuelta');
  // Con la traza: una vuelta por elemento, con su valor.
  {
    const src = 'const xs = [4, 5, 6]\nxs.forEach(x => {\n  console.log(x)\n})';
    const x = T.instrumentar(src, { acorn, enviar: '__enviar' }), eventos = [];
    const AF = Object.getPrototypeOf(async function () {}).constructor;
    await new AF('console', '__enviar', x.codigo + '\n;__T.fin()')({ log() {} }, (ev) => eventos.push(...ev));
    const P = FL.preparar({ fuente: x.fuente, nodos: x.nodos, comentarios: x.comentarios, eventos }), F = FL.construir(P), R = FL.recorrer(P, F);
    const b = F.filas.find(f => f.tipo === 'bucle');
    eq(R.pasos.filter(p => p.fila === b.i && p.valor !== undefined).map(p => [p.iter, p.valor]), [[1, 4], [2, 5], [3, 6]], 'forEach con traza: tres vueltas con su elemento');
    eq(R.vueltas.length, 3, 'forEach con traza: el bucle principal agrupa tres vueltas');
  }

  // ---------- Funciones en línea: cuándo se ejecutan y qué variable leen (caso 01 · var/let) ----------
  {
    const casos = path.join(RAIZ, 'educational-animation/revision/pruebas/casos/01-var-let');
    const leer = (x) => fs.readFileSync(path.join(casos, x), 'utf8');
    const lec = (c, num) => plano(c.P, c.F, E.describir(c.P, c.F, c.F.filas.find(f => f.num === num).i));
    const llamadas = (c) => c.pasos.filter(p => p.includes('Al llamar'));
    const vr = await revisar(leer('a-var.js')), lt = await revisar(leer('b-let.js'));
    eq([vr.r.salida[0].texto, lt.r.salida[0].texto], ['3 3 3', '0 1 2'], 'var/let: las consolas que hay que poder predecir');
    ok(lec(vr, 3).includes('[() => i] no se ejecuta aquí: leerá [i] cuando la llamen, y todas las de este bucle comparten la misma [i].'), 'var: la función comparte la i del bucle');
    ok(lec(lt, 3).includes('[() => i] no se ejecuta aquí: se queda con la [i] de esta vuelta'), 'let: la función se queda con la i de su vuelta');
    eq(llamadas(vr), ['4 Al llamar: [f[0]()] lee [i] «3» · [f[1]()] lee [i] «3» · [f[2]()] lee [i] «3». Escribe «"3 3 3"» en la consola.'], 'var: cada llamada lee 3');
    eq(llamadas(lt), ['4 Al llamar: [f[0]()] lee [i] «0» · [f[1]()] lee [i] «1» · [f[2]()] lee [i] «2». Escribe «"0 1 2"» en la consola.'], 'let: cada llamada lee la i de su vuelta');
    // Lo que se lee al llamar es de ese paso: no vuelve a los pasos del push (antes llegaba invertido, 2·1·0).
    const push = lt.F.filas.find(f => f.num === 3), dentroFn = lt.P.nodos.filter(x => lt.F.enLinea(x.id) != null).map(x => x.id);
    ok(lt.R.pasos.filter(p => p.fila === push.i).every(p => dentroFn.every(x => !p.vals.has(x))), 'let: los pasos del push no reciben lecturas de llamadas posteriores');
    const valor = await revisar(leer('c-valor.js'));
    ok(!lec(valor, 3).includes('no se ejecuta aquí') && !llamadas(valor).length, 'f.push(i) guarda el valor: sin captura ni lecturas');
    const inm = await revisar(leer('d-inmediata.js'));
    ok(!inm.F.filas.some(f => lec(inm, f.num).includes('no se ejecuta aquí')), 'una función llamada ahí mismo no se describe como guardada');
    eq(llamadas(inm).map(p => p.match(/«\d»/)[0]), ['«0»', '«1»'], 'llamada inmediata: lee la i de cada vuelta en su paso');
    const par = await revisar(leer('e-parametro.js'));
    ok(!lec(par, 2).includes('no se ejecuta aquí') && !llamadas(par).length, 'un parámetro con el mismo nombre no es la i del bucle');
    const ext = await revisar(leer('f-externa.js'));
    ok(lec(ext, 4).includes('comparten la misma [i]'), 'let de fuera del for: compartida');
    ok(llamadas(ext)[0].includes('[f[0]()] lee [i] «7» · [f[1]()] lee [i] «7»'), 'let de fuera: leen el valor reasignado después del bucle');
    const dos = await revisar(leer('g-dos-llamadas.js'));
    eq(llamadas(dos), ['3 Al llamar: [f()] lee [i] «0» · [f()] lee [i] «1». Escribe «"1 2"» en la consola.'], 'dos llamadas del mismo nodo, en orden');
    I18N.cambiarIdioma('en');
    ok(lec(vr, 3).includes('[() => i] does not run here: it will read [i] when called'), 'inglés: compartida');
    I18N.cambiarIdioma('es');
    const py = globalThis.CMGPythonRevision.leer(leer('i-python.py')), Ppy = FL.preparar(py, { serie: 'libre' }), Fpy = FL.construir(Ppy);
    ok(plano(Ppy, Fpy, E.describir(Ppy, Fpy, Fpy.filas.find(f => f.num === 3).i)).includes('[lambda: i] no se ejecuta aquí: leerá [i] cuando la llamen, y todas las de este bucle comparten la misma [i].'), 'Python: el bucle comparte su variable (2 2 2)');
    // Turno 2 de Astra: callbacks que sí se ejecutan, llaves, ámbito de bloque y await.
    const mp = await revisar(leer('j-map.js'));
    ok(!mp.pasos.some(p => p.includes('no se ejecuta aquí')) && lec(mp, 2).includes('[() => (i = i + 1)] usa la [i] de esta vuelta'), 'map: no se afirma que el callback no se ejecute');
    ok(llamadas(mp)[0].includes('lee [i] «0», [i] «1»'), 'map: las dos lecturas de i, cada una con su valor');
    const ll = await revisar(leer('k-llaves.js'));
    ok(lec(ll, 3).includes('[() => { return i; }] no se ejecuta aquí: se queda con la [i] de esta vuelta'), 'con llaves: la misma explicación que () => i');
    const bh = await revisar(leer('l-bloque-hermano.js'));
    ok(!bh.F.filas.some(f => /no se ejecuta aquí|usa (la )?\[i\]/.test(lec(bh, f.num))), 'un let i de un bloque hermano no es la i que ve la función');
    eq(llamadas(bh)[0].slice(0, 54), '6 Al llamar: [f[0]()] lee [i] «10» · [f[1]()] lee [i] ', 'bloque hermano: leen la i de fuera');
    eq(llamadas(await revisar(leer('m-await.js'))), ['3 Al llamar: [f()] lee [i] «4». Escribe «"4"» en la consola.'], 'await f(): la lectura es de f(), no de console.log');
    const hc = await revisar(leer('h-sin-cambio.js'));
    ok(lec(hc, 4).includes('[+ [() => base] no se ejecuta aquí'), 'const del cuerpo: la pista va plegada');
    eq(vr.pasos.filter(p => p.includes('no se ejecuta aquí')).length, 1, 'traza: la pista de ámbito solo en la primera visita');
    // Turno 3 de Astra: un método que se llama push no acredita que guarde la función.
    const rp = await revisar(leer('n-receptor-push.js'));
    eq(rp.r.salida.map(x => x.texto), ['0', '1'], 'receptor.push: el callback se ejecuta ahí mismo');
    ok(!rp.pasos.some(p => p.includes('no se ejecuta aquí')) && lec(rp, 3).includes('[() => i] usa la [i] de esta vuelta'), 'receptor.push: frase neutral, sin «no se ejecuta aquí»');
    ok(llamadas(rp)[0].includes('[receptor.push(() => i)] lee [i] «0»'), 'receptor.push: lectura conservada');
  }

  // ---------- Agendar frente a ejecutar ahora (caso 02) ----------
  {
    const casos = path.join(RAIZ, 'educational-animation/revision/pruebas/casos');
    const leer = (x) => fs.readFileSync(path.join(casos, x), 'utf8');
    const lec = (c, num) => plano(c.P, c.F, E.describir(c.P, c.F, c.F.filas.find(f => f.num === num).i));
    const ps = await revisar(leer('01-var-let/o-push-sustituido.js'));
    ok(!ps.pasos.some(p => p.includes('no se ejecuta aquí')) && lec(ps, 4).includes('usa la [i] de esta vuelta'), 'f.push sustituido: el método ya no acredita que guarde');
    const ag = await revisar(leer('02-agendar/a-agendado.js')), ya = await revisar(leer('02-agendar/b-inmediato.js'));
    eq([ag.r.salida.map(x => x.texto), ya.r.salida.map(x => x.texto)], [['fin', 'callback'], ['callback', 'fin']], 'agendar/ahora: las consolas que hay que predecir');
    eq(ag.etiqueta(0), '1 Agenda [() => console.log("callback")] para después', 'agendado: la etiqueta de la fila ya lo dice');
    ok(lec(ag, 1).startsWith('Agenda [() => console.log("callback")] para más tarde: no se ejecuta ahora y el programa sigue sin esperarla.'), 'agendado: lectura');
    ok(lec(ag, 2).includes('Aquí acaba el código principal; después corre lo que siga agendado de (1).'), 'agendado: el programa no acaba en la última fila');
    eq(ag.pasos, ['1 Agenda [() => console.log("callback")]: todavía no se ejecuta, y el programa sigue sin esperarla.', '2 Escribe «"fin"» en la consola.',
      '1 Ya terminó el código principal: ahora se ejecuta [() => console.log("callback")], la que estaba agendada. Escribe «"callback"» en la consola.',
      '- El programa termina. | Consola:fin / callback'], 'agendado: 1 agenda → 2 imprime → 1 callback → final');
    eq(lec(ya, 1), 'Ejecuta [() => console.log("callback")] ahora mismo. Escribe "callback" en la consola.', 'inmediato: lectura');
    eq(ya.pasos.slice(0, 2), ['1 Ejecuta [() => console.log("callback")] ahora mismo. Escribe «"callback"» en la consola.', '2 Escribe «"fin"» en la consola.'], 'inmediato: imprime en su paso');
    const aw = await revisar(leer('02-agendar/c-await.js'));
    eq(aw.pasos.map(p => p.split(' ')[0]), ['1', '2', '1', '3', '-'], 'con await: el callback corre mientras el código principal espera');
    ok(aw.pasos[2].startsWith('1 El código principal está esperando: mientras, se ejecuta'), 'con await: no se dice que el código principal terminó');
    const rd = await revisar(leer('02-agendar/d-redefinido.js'));
    ok(!rd.F.filas.some(f => lec(rd, f.num).includes('Agenda')) && !rd.pasos.some(p => p.includes('agendada')), 'function queueMicrotask propia: no es agendar');
    const fe = await revisar(leer('02-agendar/e-foreach.js'));
    ok(!fe.F.filas.some(f => lec(fe, f.num).includes('Agenda')) && !fe.pasos.some(p => p.includes('agendada')), 'forEach: síncrono, sin agenda');
    const st = await revisar(leer('02-agendar/f-settimeout-nombre.js'));
    eq(st.pasos.map(p => p.split(' ')[0]), ['1', '2', '3', '1', '-'], 'setTimeout(avisar, 0): corre al final, en la fila de avisar');
    ok(lec(st, 2).startsWith('Agenda [avisar] para más tarde'), 'setTimeout con una función por su nombre');
    const th = await revisar(leer('02-agendar/g-then.js'));
    ok(th.pasos[2].includes('Ya terminó el código principal') && !lec(th, 1).includes('Agenda'), 'then: la traza lo muestra después; la lectura no promete nada');
    // Turno 2 de Astra (ciclo 02): cada ejecución es un paso, la llamada directa no es agendada, nada sobrevive
    // al resultado y un error del callback queda en el informe.
    const num = (c) => c.pasos.map(p => p.split(' ')[0]);
    const dv = await revisar(leer('02-agendar/h-dos-veces.js'));
    eq([num(dv), dv.pasos.filter(p => p.includes('la que estaba agendada')).length], [['1', '2', '3', '4', '1', '1', '-'], 2], 'dos queueMicrotask(cb): dos pasos, uno por ejecución');
    const di = await revisar(leer('02-agendar/i-directa.js'));
    ok(di.pasos[2] === '3 [cb()] → «undefined».' && di.pasos.filter(p => p.includes('agendada')).length === 1, 'cb() directo: no se narra como agendado');
    eq(di.r.salida.map(x => x.texto), ['cb', 'fin', 'cb'], 'cb() directo: consola');
    const rt = await revisar(leer('02-agendar/j-retraso.js'));
    eq([rt.r.salida.map(x => x.texto), rt.r.cortado, rt.r.error], [['fin', 'tarde'], false, null], 'setTimeout de 30 ms: corre con el reloj virtual, antes de devolver');
    eq(rt.pasos[2].slice(0, 39), '1 Ya terminó el código principal: ahora', 'setTimeout de 30 ms: su paso');
    const er = await revisar(leer('02-agendar/k-error.js'));
    eq([er.r.error && er.r.error.mensaje, er.r.salida.map(x => x.texto)], ['fallo callback', ['fin']], 'error en un callback: queda en el informe, sin excepción suelta');
    const iv = await revisar(leer('02-agendar/l-intervalo.js'));
    eq([iv.r.salida.map(x => x.texto), iv.pasos[2]], [['n = 2'], '3 Espera 0,25 s: de 0 s a 0,25 s.'], 'setInterval durante una espera: la espera dura lo suyo');
    const mo = await revisar(leer('02-agendar/m-orden.js'));
    eq(mo.r.salida.map(x => x.texto), ['fin', 'a', 'a2', 'b'], 'temporizadores por tiempo y la microtarea de un callback antes del siguiente');
    const ii = await revisar(leer('02-agendar/n-intervalo-infinito.js'));
    ok(ii.r.cortado && ii.pasos.at(-1).includes('no terminaba'), 'setInterval sin parar: se corta');
    // Turno 3 de Astra (ciclo 02): el rechazo de un callback async y agendar guardando el número.
    const ar = await revisar(leer('02-agendar/o-async-rechazo.js'));
    eq([ar.r.error && ar.r.error.mensaje, ar.r.salida.map(x => x.texto)], ['rechazo asincrono', ['fin']], 'callback async que falla: error en el informe');
    const cp = await revisar(leer('02-agendar/p-cancelar-propio.js'));
    eq(cp.r.salida.map(x => x.texto), ['fin', 'una'], 'setInterval que se cancela a sí mismo: una vez');
    ok(lec(cp, 1).startsWith('Agenda [() => { console.log("una"); clearTimeout(id); }] para más tarde y guarda en [id] su número'), 'const id = setInterval(…): agenda y guarda el número');
    ok(lec(cp, 2).includes('Aquí acaba el código principal; después corre lo que siga agendado de (1).'), 'const id = setInterval(…): el principal no es todo el programa');
    const ac = await revisar(leer('02-agendar/q-asignar-cancelar.js'));
    eq([ac.r.salida.map(x => x.texto), ac.pasos[1]], [['fin'], '2 Agenda [() => console.log("nunca")] y guarda su número, «1», en [id]: todavía no se ejecuta, y el programa sigue sin esperarla.'], 'id = setTimeout(…) y clearTimeout: nunca corre');
    I18N.cambiarIdioma('en');
    eq(ag.etiqueta(0), '1 Schedule [() => console.log("callback")] for later', 'inglés: etiqueta');
    I18N.cambiarIdioma('es');
  }

  // ---------- Crear un generador frente a consumirlo (caso 03) ----------
  {
    const leer = (x) => fs.readFileSync(path.join(RAIZ, 'educational-animation/revision/pruebas/casos/03-generador', x), 'utf8');
    const lec = (c, num) => plano(c.P, c.F, E.describir(c.P, c.F, c.F.filas.find(f => f.num === num).i));
    const cr = await revisar(leer('a-creado.js')), co = await revisar(leer('b-consumido.js'));
    eq([cr.r.salida.map(x => x.texto), co.r.salida.map(x => x.texto)], [['fin'], ['cuerpo', 'fin']], 'generador: las consolas que hay que predecir');
    eq([cr.etiqueta(0), co.etiqueta(0)], ['1 Crea un generador con [g()]', '1 Pide el siguiente valor a [g()]'], 'generador: etiquetas de la fila 1');
    eq(lec(cr, 1), 'Crea un generador con [g()]: todavía no ejecuta el cuerpo, en (3).', 'creado: ya no dice que ejecuta la función');
    ok(lec(cr, 3).startsWith('Define el generador g. Llamarlo crea un generador sin ejecutar nada'), 'la fila de function* dice que es un generador');
    ok(plano(cr.P, cr.F, E.resumen(cr.P, cr.F, cr.R)).includes('Los generadores de (3) solo avanzan cuando alguien les pide un valor.'), 'resumen de generadores');
    eq(cr.pasos.slice(0, 1), ['1 Crea un generador con [g()]: el cuerpo, en (3), todavía no se ejecuta.'], 'creado: sin «sigue en (3)» ni «{}»');
    eq(co.pasos, ['1 Pide a [g()] su siguiente valor: corre el cuerpo, en (3), hasta el siguiente yield o hasta el final.', '4 Escribe «"cuerpo"» en la consola.',
      '1 Vuelve de [g().next()]: el cuerpo del generador terminó (done: true) y da «undefined».', '2 Escribe «"fin"» en la consola.', '- El programa termina. | Consola:cuerpo / fin'], 'consumido: el cuerpo antes del resultado de next()');
    const vy = await revisar(leer('c-varios-yield.js'));
    eq(vy.r.salida.map(x => x.texto), ['a', '1', 'b', 'fin'], 'varios yield: consola');
    eq(vy.pasos.map(p => p.split(' ')[0]), ['1', '2', '6', '7', '2', '3', '8', '9', '3', '4', '-'], 'varios yield: cada next() reanuda donde se paró');
    eq(vy.pasos[4], '2 Vuelve de [it.next()]: el generador se paró en un yield y da «1». Escribe «"1"» en la consola.', 'varios yield: vuelve con el valor y lo imprime');
    eq(lec(vy, 7), 'Se para aquí y entrega 1 a quien pidió el siguiente valor; el generador sigue desde aquí cuando le pidan otro.', 'la fila del yield');
    ok(lec(vy, 2).includes('Antes, [it.next()] pide a [it] su siguiente valor'), 'un next() dentro de otra cosa también se dice');
    const nm = await revisar(leer('e-normal.js'));
    eq([nm.etiqueta(0), lec(nm, 1)], ['1 Llama a [h()]', 'Ejecuta la función h ((3)) y, cuando acaba, sigue aquí.'], 'función normal: sin cambios');
    const np = await revisar(leer('f-next-propio.js'));
    ok(!np.F.filas.some(f => /generador/.test(lec(np, f.num))), 'un objeto con next propio no es un generador');
    const ra = await revisar(leer('g-reasignado.js'));
    eq([ra.etiqueta(2), ra.pasos[2]], ['3 [it.next()]', '3 [it.next()] → «{"done":true}».'], 'it reasignado: no se afirma de qué generador es');
    const as = await revisar(leer('h-async.js'));
    ok(!as.F.filas.some(f => /generador/.test(lec(as, f.num))), 'async no es generador');
    const ex = await revisar(leer('i-expresion.js'));
    eq(ex.etiqueta(1), '2 Crea un generador con [g()] y lo guarda en [it]', 'const g = function* (): también');
    const py = (x) => { const p = globalThis.CMGPythonRevision.leer(leer(x)), P = FL.preparar(p, { serie: 'libre' }), F = FL.construir(P); return { P, F, lec: (num) => plano(P, F, E.describir(P, F, F.filas.find(f => f.num === num).i)) }; };
    const pc = py('j-python-creado.py'), pn = py('k-python-next.py');
    eq([pc.lec(1), pn.lec(1).slice(0, 33)], ['Crea un generador con [g()]: todavía no ejecuta el cuerpo, en (3).', 'Pide a [g()] su siguiente valor: '], 'Python: g() frente a next(g())');
    eq(pc.lec(5), 'Se para aquí y entrega None a quien pidió el siguiente valor; el generador sigue desde aquí cuando le pidan otro.', 'Python: yield sin valor (antes, error de sintaxis)');
    // Turno 2 de Astra (ciclo 03): reasignada, yield* y generador async.
    const rs = await revisar(leer('l-reasignada.js'));
    ok(!rs.pasos.some(p => /generador/.test(p)) && !/generador/.test(lec(rs, 2)) && rs.r.salida[0].texto === 'normal', 'function* g reasignada: no se afirma que g() cree un generador');
    eq(rs.pasos[0], '1 Guarda la función en [g]: se ejecuta cuando alguien la llama.', 'asignar una función no es «undefined»');
    const dl = await revisar(leer('m-delega.js'));
    eq([dl.etiqueta(4), dl.pasos[2]], ['5 Entrega uno a uno los valores de [[1, 2]]', '5 Entrega uno a uno los valores de [[1, 2]]: se para en cada uno, y cada next() recibe el siguiente.'], 'yield*: delega, sin inventar el valor');
    ok(dl.pasos[3].startsWith('2 Vuelve de [it.next()]: el generador se paró en un yield y da «1».'), 'yield*: el primer next() da 1');
    const an = await revisar(leer('n-async.js'));
    eq(an.pasos.map(p => p.split(' ')[0]), ['1', '2', '5', '6', '2', '3', '-'], 'generador async: pide → espera → entrega → vuelve');
    ok(an.pasos[4].startsWith('2 Vuelve de [it.next()]: el generador se paró en un yield y da «1».'), 'await it.next(): el resultado, después del cuerpo');
    const pd = (() => { const p = globalThis.CMGPythonRevision.leer(leer('o-python-delega.py')), P = FL.preparar(p, { serie: 'libre' }), F = FL.construir(P); return plano(P, F, E.describir(P, F, F.filas.find(f => f.num === 3).i)); })();
    ok(pd.startsWith('Entrega uno a uno los valores de [1, 2]'), 'Python: yield from');
    // Turno 3 de Astra (ciclo 03): sin enlace al cuerpo viejo, y un next() async sin await.
    eq([rs.etiqueta(1), lec(rs, 2), rs.pasos[1]], ['2 [g()]', 'Ejecuta [g()].', '2 [g()] → «undefined».'], 'g reasignada: no se enlaza al cuerpo de la function* original');
    const sa = await revisar(leer('p-async-sin-await.js'));
    ok(lec(sa, 2).startsWith('Pide a [it] su siguiente valor sin esperarlo: el cuerpo, en (4), empieza a correr, next() devuelve una promesa y el programa sigue aquí sin el valor.'), 'next() async sin await: no promete «después sigue aquí»');
    eq(sa.r.salida.map(x => x.texto), ['fin'], 'next() async sin await: consola');
    I18N.cambiarIdioma('en');
    eq(cr.etiqueta(0), '1 Create a generator with [g()]', 'inglés: etiqueta');
    I18N.cambiarIdioma('es');
  }

  console.log(`flujo: ${n} comprobaciones`);
})().catch(e => { console.error(e); process.exit(1); });
