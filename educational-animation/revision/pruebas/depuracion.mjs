// Regresión del informe de depuración. Recibe un Page de Ego Browser (servidor dedicado 8771).
// Incluye descarga real; portapapeles permitido/denegado simulado para no tocar el del usuario.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function probarDepuracion(page) {
  let n = 0;
  const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
  const ok = (c, m) => { assert.ok(c, m); n++; };
  const url = 'http://127.0.0.1:8771/educational-animation/revision/';
  const abrir = async (ej, modo = '') => {
    await page.goto(`${url}?ej=${ej}${modo}`);
    await page.waitForFunction(() => window.__revision && document.querySelector('.rv-depurar'));
    await page.evaluate(() => CMGI18n.cambiarIdioma('es'));
  };
  const informe = () => page.evaluate(() => JSON.parse(document.querySelector('.rv-debug-json').value));
  for (const ancho of [1280, 390, 320]) {
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: 844, deviceScaleFactor: 1, mobile: ancho < 900 });
    await abrir('reto-5');
    await page.evaluate(() => { __revision.cambiarPrograma('LAU-02'); __revision.ir(2); });
    await page.click('.rv-nodo[data-fila="3"]');
    const antes = await page.evaluate(() => JSON.stringify(__revision.estado));
    // Leer por API no cambia selección, paso, programa ni HTML. La copia no comparte referencias.
    const api = await page.evaluate(() => {
      const html = document.querySelector('.rv-rejilla').innerHTML;
      const r = __revision.depurar();
      r.entrada.programas['LAU-02'].fuente = 'alterado'; r.salida['LAU-02'].filas[0].num = 99;
      return [document.querySelector('.rv-rejilla').innerHTML === html,
        __revision.datos['LAU-02'].P.fuente !== 'alterado', __revision.datos['LAU-02'].F.filas[0].num];
    });
    eq(api, [true, true, 1], `${ancho}: API separada de la vista y los datos vivos`);
    eq(await page.evaluate(() => JSON.stringify(__revision.estado)), antes, `${ancho}: API conserva el estado`);
    await page.click('[data-accion="depurar"]');
    const r = await informe();
    eq([r.formato, r.version, r.contexto.programa, r.contexto.modo], ['cmg-revision-debug', 1, 'LAU-02', 'lectura'], `${ancho}: esquema y programa actual`);
    eq(Object.keys(r.entrada.programas), ['LAU-01', 'LAU-02'], `${ancho}: incluye todos los programas`);
    for (const id of Object.keys(r.entrada.programas)) {
      eq(r.entrada.programas[id].fuente, await page.evaluate(id => __revision.datos[id].P.fuente, id), `${ancho}: fuente original de ${id}`);
      eq(r.salida[id].filas.map(f => [f.num, f.sig, f.si ?? null, f.no ?? null]), await page.evaluate(id => __revision.datos[id].F.filas.map(f => [f.num, f.sig, f.si ?? null, f.no ?? null]), id), `${ancho}: ramas y destinos de ${id}`);
      for (const f of r.salida[id].filas) eq(f.codigo, r.entrada.programas[id].fuente.slice(f.rango.a, f.rango.b), `${ancho}: rango original de fila ${f.num}`);
    }
    eq(r.salida['LAU-01'].filas[2].etiqueta, '¿LAU-02 está atascado?', `${ancho}: textos del primer programa`);
    eq(r.salida['LAU-02'].filas[2].etiqueta, '¿LAU-01 está atascado?', `${ancho}: textos del segundo programa`);
    ok(r.salida['LAU-02'].filas[2].lectura.includes('sigue en 4'), `${ancho}: frase de lectura`);
    ok(r.salida['LAU-02'].rieles.length > 0 && r.vista.html.includes('rv-riel'), `${ancho}: flechas estructurales y dibujadas`);
    ok(Array.isArray(r.salida['LAU-02'].recorrido.pasos[0].vals), `${ancho}: Maps del recorrido serializados`);
    ok(r.motor.some(x => x.includes('/motor/revision.js?v=11')), `${ancho}: versión del renderizador`);
    eq(r.vista.filas.length, 8, `${ancho}: medidas de cada fila`);
    eq(await page.evaluate(() => [document.querySelector('.rv-debug-json').readOnly, document.querySelector('.rv-debug-json').scrollTop]), [true, 0], `${ancho}: JSON de solo lectura y empieza arriba`);
    ok(await page.evaluate(() => {
      const d = document.querySelector('.rv-depuracion').getBoundingClientRect();
      return d.x >= 0 && d.y >= 0 && d.right <= innerWidth && d.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth;
    }), `${ancho}: diálogo dentro de la pantalla sin desbordamiento`);
    await page.keyboard.press('ArrowRight');
    eq(await page.evaluate(() => JSON.stringify(__revision.estado)), antes, `${ancho}: el teclado del JSON no mueve el recorrido`);
    // La captura queda congelada aunque cambie el idioma de los controles del diálogo.
    const jsonEs = await page.evaluate(() => document.querySelector('.rv-debug-json').value);
    await page.evaluate(() => CMGI18n.cambiarIdioma('en'));
    eq(await page.evaluate(() => document.querySelector('[data-accion="copiarDepuracion"]').textContent), 'Copy JSON', `${ancho}: controles en inglés`);
    eq(await page.evaluate(() => document.querySelector('.rv-debug-json').value), jsonEs, `${ancho}: captura inmutable al traducir`);
    await page.keyboard.press('Escape');
    eq(await page.evaluate(() => [document.querySelector('.rv-depuracion').open, document.activeElement.dataset.accion]), [false, 'depurar'], `${ancho}: Escape cierra y devuelve el foco`);
    eq(await page.evaluate(() => [__revision.estado.prog, __revision.estado.paso, __revision.estado.foco.fila]), ['LAU-02', 2, 3], `${ancho}: selección conservada`);
    // Se reserva una franja: el botón no cubre filas, tampoco después de desplazar o ampliar el diagrama.
    await page.evaluate(() => { __revision.fijarReparto(0); document.querySelector('.rv-flujo').scrollTop = 9999; });
    ok(await page.evaluate(() => {
      const b = document.querySelector('.rv-depurar').getBoundingClientRect(), d = document.querySelector('.rv-diagrama').getBoundingClientRect(), f = document.querySelector('.rv-flujo').getBoundingClientRect();
      return b.height >= 44 && b.top >= f.bottom && d.bottom - b.bottom <= 5 && d.right - b.right <= 17;
    }), `${ancho}: botón accesible en la esquina inferior derecha sin tapar el flujo`);
    await page.click('[data-accion="depurar"]');
    eq((await informe()).contexto.idioma, 'en', `${ancho}: una nueva captura usa el idioma actual`);
    // Simular permiso denegado y permitido, sin modificar el portapapeles del sistema.
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denegado'); } } }));
    await page.click('[data-accion="copiarDepuracion"]');
    await page.waitForFunction(() => document.querySelector('.rv-debug-estado').dataset.t === 'debug.copiaManual');
    ok(await page.evaluate(() => { const a = document.querySelector('.rv-debug-json'); return a.selectionStart === 0 && a.selectionEnd === a.value.length; }), `${ancho}: sin permiso, selección completa para copiar manualmente`);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async x => { window.__copiaDebug = x; } } }));
    await page.click('[data-accion="copiarDepuracion"]');
    await page.waitForFunction(() => document.querySelector('.rv-debug-estado').dataset.t === 'debug.copiado');
    eq(await page.evaluate(() => __copiaDebug), await page.evaluate(() => document.querySelector('.rv-debug-json').value), `${ancho}: copia el informe exacto`);
    await page.evaluate(() => { delete navigator.clipboard; delete window.__copiaDebug; });
    const dir = await mkdtemp(join(tmpdir(), 'revision-debug-'));
    try {
      const contenido = await page.evaluate(() => document.querySelector('.rv-debug-json').value);
      const promesa = page.waitForEvent('download');
      await page.click('[data-accion="descargarDepuracion"]');
      const descarga = await promesa;
      await descarga.saveAs(join(dir, 'informe.json'));
      eq(await readFile(join(dir, 'informe.json'), 'utf8'), contenido, `${ancho}: descarga real idéntica a la captura`);
    } finally { await rm(dir, { recursive: true, force: true }); }
    await page.click('[data-accion="cerrarDepuracion"]');
    await abrir('reto-5-py');
    const py = await page.evaluate(() => __revision.depurar());
    eq(py.entrada.programas['LAU-01'].lenguaje, 'python', `${ancho}: conserva Python como fuente`);
    ok(py.entrada.programas['LAU-01'].fuente.includes('while True:'), `${ancho}: Python original sin traducir a JS`);
    ok(py.salida['LAU-01'].filas.some(f => f.codigo.includes('wait(0.25)')), `${ancho}: referencias al Python original`);
    // Cambiar programa al montar de nuevo quita el diálogo y libera su modalidad.
    await page.click('[data-accion="depurar"]');
    await page.evaluate(() => __revision.destruir());
    eq(await page.evaluate(() => document.querySelectorAll('.rv-depuracion').length), 0, `${ancho}: destruir elimina el diálogo abierto`);
  }
  await abrir('cafes', '&modo=traza');
  const traza = await page.evaluate(() => __revision.depurar());
  eq(traza.contexto.modo, 'traza', 'traza: indica que son pasos ejecutados');
  const id = Object.keys(traza.entrada.programas)[0];
  ok(traza.entrada.programas[id].eventos.length > 0 && traza.salida[id].recorrido.pasos.some(p => p.vals.length > 0), 'traza: conserva eventos y valores de los Maps');
  // Reproducción desde el informe: mismo diagrama y textos. No se ejecuta el programa.
  eq(await page.evaluate(() => {
    const r = __revision.depurar(), esperado = r.salida;
    __revision.destruir();
    window.__revision = CMGRevision.montar(document.querySelector('#revision'), r.entrada, r.contexto);
    return JSON.stringify(__revision.depurar().salida) === JSON.stringify(esperado);
  }), true, 'el informe vuelve a producir exactamente las filas, textos y recorrido');
  const fuente = '// emoji 😀, comillas y HTML literal\nconst texto = "<img src=x onerror=globalThis.__ejecutado=1>";\nglobalThis.__ejecutado = 1;\nthrow new Error("no ejecutar");\n';
  const especial = await page.evaluate(fuente => {
    __revision.destruir();
    const x = CMGTrazador.instrumentar(fuente, { acorn });
    const p = CMGPythonRevision.leer('# Python original 😀\nif True:\n    print("<b>hola</b>")\n', { nombre: CMGCatalogoRevision.desdePython });
    window.__revision = CMGRevision.montar(document.querySelector('#revision'), {
      programas: { js: { fuente, nodos: x.nodos, comentarios: x.comentarios, eventos: [] }, py: p },
      metadatos: { grande: 123n, infinito: Infinity },
    });
    return __revision.depurar();
  }, fuente);
  eq(especial.entrada.programas.js.fuente, fuente, 'fuente exacta con Unicode, comentarios y HTML');
  eq(especial.entrada.metadatos, { grande: { $: 'bigint', v: '123' }, infinito: { $: 'number', v: 'Infinity' } }, 'valores especiales serializables sin pérdida silenciosa');
  ok(especial.salida.py.filas[0].codigo.includes('if True:'), 'varios lenguajes en el mismo informe');
  await page.click('[data-accion="depurar"]');
  eq(await page.evaluate(() => [window.__ejecutado || null, document.querySelectorAll('.rv-depuracion img, .rv-depuracion b').length]), [null, 0], 'el informe no ejecuta el programa ni interpreta su HTML');
  eq(await page.evaluate(() => {
    const r = JSON.parse(document.querySelector('.rv-debug-json').value, (_, v) => v && v.$ === 'bigint' ? BigInt(v.v) : v && v.$ === 'number' ? Number(v.v) : v);
    return [r.entrada.metadatos.grande === 123n, r.entrada.metadatos.infinito === Infinity];
  }), [true, true], 'reviver documentado recupera BigInt e Infinity');

  // Acceso real dentro del juego: binoculares en PC, menú ⋯ en móvil, JS y Python en ambas series.
  for (const ancho of [1280, 390]) for (const serie of ['war', 'factory']) {
    const forma = ancho < 900 ? 'movil' : 'escritorio', id = serie === 'factory' ? 'R1' : 'LAU-01';
    const js = serie === 'factory' ? 'await pickUp("ENT-1", "cobre");\nawait deliver("FUN");' : 'const pos = autoTarget("drone", "visual");\nregularShoot(pos);';
    const py = serie === 'factory' ? 'pick_up("ENT-1", "cobre")\ndeliver("FUN")\n' : 'pos = auto_target("drone", "visual")\nregular_shoot(pos)\n';
    await page.cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: 844, deviceScaleFactor: 1, mobile: ancho < 900 });
    await page.goto(`http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?serie=${serie}&forma=${forma}`);
    await page.waitForFunction(() => window.__juegoListo && window.__banco);
    await page.evaluate(({ id, js }) => {
      CMGI18n.cambiarIdioma('es');
      document.querySelector('[data-vista="2d"]')?.click();
      delete __banco.fuentes[id]; __banco.programas[id] = js; __banco.abrirPrograma(id);
    }, { id, js });
    if (forma === 'movil') {
      await page.evaluate(() => document.getElementById('app').dispatchEvent(new CustomEvent('cmg:pantalla', { detail: 'codigo' })));
      await page.click('#b-menu-cod');
      await page.click('#menu-cod [data-menu="revisar"]');
    } else await page.click('#b-revisar');
    await page.waitForFunction(() => window.__revisionJuego && __revisionJuego.vista);
    await page.click('#revision-juego [data-accion="depurar"]');
    const r = await informe();
    eq([r.entrada.serie, r.entrada.programas[id].fuente], [serie, js], `${serie} ${ancho}: código del editor en el informe`);
    eq(await page.evaluate(() => __revisionJuego.vista.depurar().salida), r.salida, `${serie} ${ancho}: API y diálogo tienen la misma salida`);
    await page.click('[data-accion="cerrarDepuracion"]');
    await page.click('#revision-juego [data-accion="codigo"]');
    eq(await page.evaluate(() => window.cmg.codigo.value), js, `${serie} ${ancho}: volver conserva el editor`);
    await page.evaluate(({ id, py }) => { __banco.fuentes[id] = { lenguaje: 'python', enUso: true, texto: py }; CMGRevisionJuego.abrir(); }, { id, py });
    await page.waitForFunction(() => window.__revisionJuego && __revisionJuego.vista);
    await page.evaluate(id => __revisionJuego.vista.cambiarPrograma(id), id);
    const python = await page.evaluate(() => __revisionJuego.vista.depurar());
    eq([python.entrada.programas[id].fuente, python.entrada.programas[id].lenguaje], [py, 'python'], `${serie} ${ancho}: fuente Python del editor`);
    ok(python.salida[id].filas[0].etiqueta.length > 0, `${serie} ${ancho}: salida Python disponible`);
    eq(await page.evaluate(() => __banco.mundo.activo), false, `${serie} ${ancho}: revisión y depuración no arrancan la partida`);
    await page.evaluate(() => CMGRevisionJuego.cerrar());
  }
  return { comprobaciones: n };
}
