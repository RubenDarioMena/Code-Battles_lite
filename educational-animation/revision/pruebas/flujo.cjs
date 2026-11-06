// Pruebas del diagrama, el recorrido y las frases del modo revisión, sin navegador.
// node educational-animation/revision/pruebas/flujo.cjs
// Comprueba que sale todo del programa (nada escrito para un reto): la forma del diagrama de los seis cafés,
// los valores de cada vuelta, la recursión, el reto 5 grabado en el juego, los dos idiomas y que cualquier
// programa se puede explicar sin errores ni claves sin traducir.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { RAIZ, grabacion, plano } = require('./cargar.cjs');
const FL = globalThis.CMGFlujo, E = globalThis.CMGExplicar, C = globalThis.CMGCatalogo, EJ = globalThis.CMGEjecutar, I18N = globalThis.CMGI18n;
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
    sinClaves(textos.join(' ‖ '), `programa ${k + 1}`);
    ok(v.R.pasos.at(-1).fin, `programa ${k + 1}: termina con un paso final`);
  }
  const inf = await revisar(`while (true) {}`);
  ok(inf.r.cortado && inf.pasos.at(-1).includes('el programa no terminaba'), 'un bucle sin fin se corta y lo dice');
  const err = await revisar(`function f() { throw new Error('ay') }\nf()`);
  ok(err.pasos.at(-1).includes('Error: ay'), 'un error se cuenta al final');
  const esp = await revisar(VARIOS[5]);
  ok(esp.R.conReloj && esp.pasos.some(x => x.includes('Espera 0,5 s: de 0 s a 0,5 s.')), 'esperar() adelanta un reloj virtual sin juego');

  console.log(`flujo: ${n} comprobaciones`);
})().catch(e => { console.error(e); process.exit(1); });
