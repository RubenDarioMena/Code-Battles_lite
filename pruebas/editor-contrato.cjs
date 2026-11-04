// E0: módulos reales sin DOM y límites entre editor y aplicación.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const raiz = path.join(__dirname, '..');
const cargar = (contexto, archivo) => vm.runInContext(readFileSync(path.join(raiz, archivo), 'utf8'), contexto, { filename: archivo });
const contexto = vm.createContext({ window: {} });
for (const archivo of ['shared/editor/javascript.js', 'shared/editor/plantillas.js', 'Prototypes/Rocket Launcher/js/paleta.js', 'Prototypes/Rocket Launcher/js/programas.js']) cargar(contexto, archivo);
assert.equal(contexto.window.cmg, undefined);
assert.equal(contexto.document, undefined);
assert.equal(contexto.localStorage, undefined);
const { CMGEditorJS: JS, CMGPaleta, CMGProgramas } = contexto.window;
function puerto(texto) {
  const codigo = { value: texto, readOnly: false, selectionStart: 0, selectionEnd: texto.length,
    setSelectionRange(a,b) { this.selectionStart = a; this.selectionEnd = b; } };
  let cambios = 0;
  const operaciones = JS.crearEdicion({ codigo, estructura: () => contexto.window.ESTRUCTURA,
    aviso: () => {}, escapar: s => String(s),
    insertar(texto, sa = texto.length, sb = sa) {
      if (codigo.readOnly) return false;
      const a = codigo.selectionStart;
      codigo.value = codigo.value.slice(0, a) + texto + codigo.value.slice(codigo.selectionEnd);
      codigo.setSelectionRange(a + sa, a + sb); cambios++; return true;
    },
  });
  return { codigo, operaciones, cambios: () => cambios };
}
(async () => {
  const uno = puerto('uno'), dos = puerto('dos');
  uno.operaciones.envolver('(', ')');
  assert.equal(uno.codigo.value, '(uno)');
  assert.equal(dos.codigo.value, 'dos');
  assert.equal(dos.cambios(), 0);
  dos.codigo.readOnly = true;
  assert.equal(dos.operaciones.envolver('(', ')'), false);
  assert.equal(dos.codigo.value, 'dos');
  // La estructura se publica después del módulo y de su instancia, como en el juego.
  cargar(contexto, 'shared/js/estructura.js');
  const tres = puerto('regularShoot(pos);');
  tres.operaciones.insertarBloque('if (/* condición */) {\n  \n}', ['if (/* condición */) {\n', '\n}']);
  assert.equal(tres.codigo.value, 'if (/* condición */) {\n  regularShoot(pos);\n}');
  const original = 'const emoji = "🦾";\n/* lugar */';
  assert.equal(JS.lexico(original).map(t => t[1]).join(''), original);
  const est = contexto.window.ESTRUCTURA.analizar(original, JS.lexico(original));
  assert.equal(contexto.window.ESTRUCTURA.inicioLinea(est, 1), original.indexOf('\n') + 1);
  let sensor = null;
  const paleta = CMGPaleta.crear({ sensor: () => sensor });
  const otra = CMGPaleta.crear();
  const atajoSensor = paleta.atajos.find(a => a.ico === 'sensor');
  assert.equal(atajoSensor.si(), false);
  sensor = 'VIB_02';
  assert.equal(atajoSensor.si(), true);
  assert(paleta.textoAtajo(atajoSensor).includes('VIB_02.detect'));
  paleta.atajos.find(a => a.ico === 'whileTrue').variantes[0].b = 'cambio';
  assert(otra.atajos.find(a => a.ico === 'whileTrue').variantes[0].b.startsWith('while'));
  paleta.atajos.splice(0, paleta.atajos.length);
  assert(otra.atajos.length > 0);

  // Paridad de series: War y Factory comparten la sección común (bucles, if, operadores, variable,
  // Esperar y consola) en JS y en Python; solo cambian las órdenes de la serie y la pausa del bucle.
  cargar(contexto, 'shared/editor/python.js');
  const forma = atajos => JSON.parse(JSON.stringify(atajos.map(a => a === '|' ? '|' : [a.ico, a.t, (a.variantes || []).map(v => v.ico)])));
  const PROPIAS = { war: ['apuntar', 'disparo', 'rafaga', 'detener', 'sensor'], factory: ['recoger', 'entregar', 'sensor'] };
  const comun = (serie, atajos) => forma(atajos.filter(a => a === '|' || !PROPIAS[serie].includes(a.ico)));
  const py = s => s.replace(/;$/, '');
  for (const [nombre, hacer] of [['JS', serie => CMGPaleta.crear({ serie }).atajos], ['Python', serie => CMGPaleta.crearPython({ serie, aPython: py }).atajos]]) {
    const war = hacer('war'), factory = hacer('factory');
    assert.deepEqual(comun('factory', factory), comun('war', war), `${nombre}: Factory y War con la misma sección común`);
    for (const serie of ['war', 'factory']) {
      const lista = serie === 'war' ? war : factory, i = lista.findIndex(a => PROPIAS[serie].includes(a.ico));
      assert.deepEqual([...lista.slice(i, i + PROPIAS[serie].length).map(a => a.ico)], PROPIAS[serie], `${nombre}: las órdenes de ${serie}, juntas en su sección`);
      assert.equal(lista[i + PROPIAS[serie].length], '|', `${nombre}: separador tras las órdenes de ${serie}`);
    }
  }
  assert.equal(CMGPaleta.crear({ serie: 'factory' }).atajos.find(a => a.ico === 'esperar').b, 'await wait(1);');

  // Una confirmación abierta no debe aplicar dos veces, ni escribir en otro reto
  // o durante la ejecución. Se usa el mismo aplicador que registra juego.js.
  let resolver, aplicaciones = 0;
  let estado = { ejec: null, edicion: { ids: ['A'], mixto: true }, programas: { A: 'viejo' }, texto: 'nuevo' };
  const aplicar = CMGProgramas.crearAplicador({ estado: () => estado,
    confirmarReemplazo: () => new Promise(r => { resolver = r; }), alAplicar: () => aplicaciones++ });
  const pendiente = aplicar(true);
  await aplicar(false);
  assert.equal(estado.programas.A, 'viejo');
  const destinoViejo = estado.programas;
  estado.programas = { A: 'otro reto' };
  resolver(true); await pendiente;
  assert.equal(destinoViejo.A, 'viejo');
  assert.equal(estado.programas.A, 'otro reto');
  assert.equal(aplicaciones, 0);
  const esperando = aplicar(true);
  estado.ejec = {}; resolver(true); await esperando;
  assert.equal(estado.programas.A, 'otro reto');
  estado.ejec = null;
  await aplicar(false);
  assert.equal(estado.programas.A, 'otro reto\nnuevo');
  assert.equal(aplicaciones, 1);
  const cancelado = aplicar(true); resolver(false); await cancelado;
  await aplicar(false);
  assert.equal(aplicaciones, 2); // El bloqueo se libera también al cancelar.
  let rechazar = true;
  const conFallo = CMGProgramas.crearAplicador({ estado: () => estado,
    confirmarReemplazo: async () => { if (rechazar) throw Error('diálogo cerrado'); return true; }, alAplicar: () => aplicaciones++ });
  await assert.rejects(conFallo(true), /diálogo cerrado/);
  rechazar = false;
  await conFallo(true);
  assert.equal(estado.programas.A, 'nuevo');
  assert.equal(aplicaciones, 3);
  console.log('E0: carga sin juego/DOM, aislamiento, offsets UTF-16, estructura diferida y confirmaciones Add/Replace correctos.');
})().catch(e => { console.error(e); process.exitCode = 1; });
