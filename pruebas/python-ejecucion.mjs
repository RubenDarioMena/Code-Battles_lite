// E5/E7 · Ejecutar Python en el juego. Importable con el mismo puerto de navegador que las demás suites.
// Compuerta de E5: el mismo programa en JS y en Python, con la misma semilla, da los mismos eventos
// (con sus líneas), tiempos y resultados en War y en Factory. Además: errores y diagnósticos con la línea
// de Python, consola, telemetría y récords con el lenguaje, y la conversión de JS a Python desde Py (E7).
import assert from 'node:assert/strict';
export async function probarPythonEjecucion(page, origen = 'http://127.0.0.1:8771') {
  let checks = 0;
  const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; console.log('OK ejecución ' + checks + ': ' + m); };
  const abrir = async (serie = '') => {
    await page.goto(origen + '/Prototypes/Rocket%20Launcher/index.html' + (serie ? '?serie=' + serie : ''));
    await page.waitForFunction(() => !!window.__banco && !!window.cmg?.editor);
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^cmg-banco03:(fuentes-|records)/.test(k)) localStorage.removeItem(k); window.cmg.edicion.activar(false); });
  };
  // Corre un programa (JS o Python) en el reto dado con semilla fija y devuelve lo que pasó.
  const correr = (reto, id, lenguaje, texto) => page.evaluate(async ([reto, id, lenguaje, texto]) => {
    const b = window.__banco;
    b.elegirReto(reto); b.fijarSemilla(11);
    if (lenguaje === 'python') b.fuentes[id] = { lenguaje: 'python', texto, enUso: true };
    else { b.programas[id] = texto; if (b.fuentes[id]) b.fuentes[id].enUso = false; }
    b.abrirPrograma(id); b.turbo(20); b.ejecutar();
    const t0 = Date.now();
    while (b.mundo.activo && !b.mundo.fin && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 40));
    const m = b.mundo, ultimo = b.telemetria.at(-1);
    return { fin: m.fin, t: m.t, eventos: m.eventos.map(e => ({ ...e })), derribos: m.derribos ?? null, consumidos: m.consumidos ?? null,
      banner: document.querySelector('#banner').hidden ? null : document.querySelector('#banner h2').textContent, texto: document.querySelector('#banner').textContent,
      lenguajes: ultimo && ultimo.lenguajes, codigo: ultimo && ultimo.codigos && ultimo.codigos[id] };
  }, [reto, id, lenguaje, texto]);

  // ---------- War: equivalencia, línea a línea ----------
  await abrir();
  const warJS = [
    'while (true) {',
    '  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");',
    '  if (pos !== null) {',
    '    regularShoot(pos); }',
    '  else {',
    '    stopFire(); }',
    '  await esperar(0.5); }', ''].join('\n');
  const warPy = [
    'while True:',
    '    pos = auto_target("drone", "visual") or auto_target("crawler", "visual")',
    '    if pos is not None:',
    '        regular_shoot(pos)',
    '    else:',
    '        stop_fire()',
    '    await wait(0.5)', ''].join('\n');
  for (const reto of [0, 1]) {
    const js = await correr(reto, 'LAU-01', 'js', warJS), py = await correr(reto, 'LAU-01', 'python', warPy);
    eq([py.fin, py.t, py.derribos, py.consumidos, py.eventos.length > 20], [js.fin, js.t, js.derribos, js.consumidos, true], `War reto ${reto + 1}: mismo resultado, tiempo, derribos y misiles`);
    eq(py.eventos, js.eventos, `War reto ${reto + 1}: los mismos eventos, con las mismas líneas`);
  }
  // Telemetría y récords con el lenguaje (D6: una tabla por reto, el lenguaje como etiqueta).
  const ult = await page.evaluate(() => ({ t: window.__banco.telemetria.at(-1), rl: JSON.parse(localStorage.getItem('cmg-banco03:records-lenguaje') || '{}'), banner: document.querySelector('#banner .record')?.textContent || '' }));
  eq([ult.t.lenguajes, ult.t.codigos['LAU-01'], ult.rl['1']], [{ 'LAU-01': 'python' }, warPy, 'js'], 'la telemetría guarda el lenguaje y el texto Python; el récord del reto 2 lo puso JS');
  eq(ult.banner.includes('Python'), true, 'el récord muestra el lenguaje del intento');

  // ---------- Consola, errores del runtime y diagnósticos con la línea de Python ----------
  const conPrint = await correr(0, 'LAU-01', 'python', 'print("hola", 1, None, [True])\nwarn(f"{2 + 3} m")\nregular_shoot(5)\n');
  eq([conPrint.banner, conPrint.texto.includes('regular_shoot necesita un lugar con x e y, como el que devuelve auto_target(). Recibió 5.')], ['Error en la línea 3 de LAU-01', true], 'un error de la API llega con la línea de Python y los nombres de Python');
  eq(await page.evaluate(() => [...document.querySelectorAll('#consola .c')].map(c => c.textContent).filter(t => /hola|5 m/.test(t))), ['LAU-01 L1hola 1 None [True]', 'LAU-01 L2warn 5 m'], 'print y warn van a la consola con su línea y al estilo de Python (D3)');
  eq(await page.evaluate(() => window.__banco.mundo.eventos.filter(e => e.que === 'print' || e.que === 'warn').map(e => [e.que, e.linea])), [['print', 1], ['warn', 2]], 'el registro nombra print y warn');
  const hueco = await correr(0, 'LAU-01', 'python', 'pos = auto_target("crawler", "visual")\nregular_shoot(__lugar__)\n');
  eq([hueco.banner, hueco.texto.includes('Rellena el hueco __lugar__'), await page.evaluate(() => window.cmg.marcas.err)], ['Línea 2 de LAU-01', true, 2], 'un hueco sin rellenar se avisa antes de ejecutar, con su línea marcada');
  const sangria = await correr(0, 'LAU-01', 'python', 'while True:\nawait wait(1)\n');
  eq([sangria.banner, sangria.texto.includes("IndentationError: expected an indented block after 'while' statement on line 1")], ['Línea 2 de LAU-01', true], 'la sangría se revisa antes de ejecutar');
  const nombre = await correr(0, 'LAU-01', 'python', 'x = 1\nwhile True:\n    regular_shoot(objetivo)\n    await wait(1)\n');
  eq([nombre.banner, nombre.texto.includes("NameError: name 'objetivo' is not defined")], ['Error en la línea 3 de LAU-01', true], 'un nombre que no existe es un NameError con su línea');

  // ---------- E7: Py convierte el JS de la unidad ----------
  await page.evaluate(() => { const b = window.__banco; b.elegirReto(0); delete b.fuentes['LAU-01']; b.programas['LAU-01'] = 'while (true) {\n  const pos = autoTarget("crawler", "visual"); // mira\n  if (pos) regularShoot(pos);\n  await esperar(0.5);\n}\n'; b.abrirPrograma('LAU-01'); });
  await page.click('.herramientas [data-lenguaje-programa="python"]');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, cmg.codigo.value]), ['python', 'while True:\n    pos = auto_target("crawler", "visual")  # mira\n    if pos:\n        regular_shoot(pos)\n    await wait(0.5)\n'], 'Py convierte el programa JavaScript por el árbol');
  const convertido = await page.evaluate(() => cmg.codigo.value);
  const a = await correr(0, 'LAU-01', 'js', 'while (true) {\n  const pos = autoTarget("crawler", "visual"); // mira\n  if (pos) regularShoot(pos);\n  await esperar(0.5);\n}\n');
  const b = await correr(0, 'LAU-01', 'python', convertido);
  eq([b.fin, b.t, b.eventos.map(e => ({ ...e, linea: 0 }))], [a.fin, a.t, a.eventos.map(e => ({ ...e, linea: 0 }))], 'el programa convertido hace lo mismo que el JavaScript');
  await page.evaluate(() => { const b = window.__banco; b.elegirReto(0); delete b.fuentes['LAU-01']; b.programas['LAU-01'] = 'const datos = { a: 1 };\n'; b.abrirPrograma('LAU-01'); });
  await page.click('.herramientas [data-lenguaje-programa="python"]');
  eq(await page.evaluate(() => [cmg.editor.documento().lenguaje, cmg.codigo.value.includes('no se pudo convertir'), document.body.textContent.includes('Los objetos { … } (diccionarios) aún no están en el Python del juego.'), window.__banco.programas['LAU-01']]),
    ['python', true, true, 'const datos = { a: 1 };\n'], 'si no cabe, lo explica y el JavaScript se conserva');
  await page.click('.herramientas [data-modo-codigo="js"]');

  // ---------- Factory: equivalencia y errores ----------
  await abrir('factory');
  const facJS = [
    'for (let i = 0; i < 3; i++) {',
    '  if (count(ENT_1, "cobre") > 0) {',
    '    await pickUp(ENT_1, "cobre");',
    '    await deliver(FUN); } }', ''].join('\n');
  const facPy = [
    'for i in range(3):',
    '    if count(ENT_1, "cobre") > 0:',
    '        await pick_up(ENT_1, "cobre")',
    '        await deliver(FUN)', ''].join('\n');
  const fj = await correr(0, 'R1', 'js', facJS), fp = await correr(0, 'R1', 'python', facPy);
  eq([fp.fin, fp.t, fp.lenguajes], [fj.fin, fj.t, { R1: 'python' }], 'Factory: mismo resultado y tiempo; la telemetría lleva el lenguaje');
  eq(fp.eventos, fj.eventos, 'Factory: los mismos eventos, con las mismas líneas');
  eq([await page.evaluate(() => JSON.parse(localStorage.getItem('cmg-banco03:records'))['factory-0'].lenguaje), fp.texto.includes('Python')], ['js', true], 'el récord de Factory lleva el lenguaje del intento que lo puso; el aviso, el del intento');
  const local = await correr(0, 'R1', 'python', 'def count():\n    return 3\nfor i in range(count()):\n    await yo.pick_up(ENT_1, "cobre")\n    await yo.deliver(FUN)\n');
  eq([local.fin, local.t], [fj.fin, fj.t], 'Factory: una función local llamada count sigue siendo local, y yo.pick_up funciona');
  const malo = await correr(0, 'R1', 'python', 'await pick_up(ENT_1, "cobre")\nawait pick_up(ENT_1, "cobre")\n');
  eq([malo.fin, malo.banner, malo.eventos.at(-1)?.linea], ['fallo', 'Aún no', 2], 'Factory: la orden rechazada queda en la línea de Python');
  const sinAwait = await correr(0, 'R1', 'python', 'pick_up(ENT_1, "cobre")\n');
  eq([sinAwait.banner, sinAwait.texto.includes('Falta await')], ['Línea 1 de R1', true], 'Factory: falta await se avisa antes de ejecutar (D2)');
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^cmg-banco03:(fuentes-|records)/.test(k)) localStorage.removeItem(k); });
  return checks;
}
