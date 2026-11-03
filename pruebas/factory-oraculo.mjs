// Oráculo de paridad: navegador y Web Worker originales, sin copiar la simulación.
// Importar desde ego-browser nodejs; instrucciones en factory-oraculo.md. Requiere un checkout de b76411b: el original ya no está en el árbol.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const fixtureURL = new URL('./factory-oraculo.json', import.meta.url);
const archivoFuente = 'Prototypes/Tres vistas/js/juego.js';
const sha256 = texto => createHash('sha256').update(texto).digest('hex');
const viaje = (origen = 'ENT-1', mat = 'cobre', destino = 'FUN') =>
  `await yo.recoger("${origen}", "${mat}");\nawait yo.entregar("${destino}");`;
const repetir = (n, codigo) => `for (let i = 0; i < ${n}; i++) {\n${codigo}\n}`;
const planB = `while (await yo.cuantos("MUELLE", "cobre") > 0) {
  await yo.recoger("MUELLE", "cobre");
  if (await yo.cuantos("FUN", "cobre") < 1) {
    await yo.entregar("FUN");
  } else {
    await yo.entregar("BOD");
  }
}`;

function definirCasos(retos, iniciales) {
  const soluciones = [
    repetir(3, viaje()),
    repetir(3, viaje()) + '\n' + repetir(3, viaje('ENT-1', 'silicio', 'ENS')),
    repetir(4, viaje() + '\n' + viaje('ENT-1', 'silicio', 'ENS') + '\nawait yo.esperar(3);'),
    repetir(2, viaje()) + '\n' + repetir(2, viaje('ENT-1', 'silicio', 'ENS')) + '\n' + repetir(2, viaje('ENT-2')),
    `while (await yo.cuantos("ENT-1", "cobre") > 0) {\n${viaje()}\n}`,
    planB,
    repetir(3, viaje()),
  ];
  const propio = { ...retos[0], titulo: 'Tu reto · oráculo', inicial: [], maxDerrames: null, maxVacios: null, tiempoMax: null };
  const casos = [];
  const agregar = (id, reto, codigo, extra = {}) => casos.push({
    id, reto, intento: 1, codigo, ...(reto === 6 ? { escenario: propio } : {}), ...extra,
  });
  for (let reto = 0; reto <= 6; reto++) {
    agregar(`reto-${reto}-inicial`, reto, iniciales[reto], { categoria: 'inicial' });
    agregar(`reto-${reto}-victoria`, reto, soluciones[reto], { categoria: 'victoria' });
  }
  for (let intento = 2; intento <= retos[4].stockPorIntento.length; intento++) {
    agregar(`stock-intento-${intento}`, 4, soluciones[4], { categoria: 'victoria', intento });
  }
  agregar('derrame-con-limite', 2, repetir(4, viaje()), { categoria: 'derrame', cambiaEtapa3: ['carga-conservada'] });
  const estrecho = JSON.parse(JSON.stringify(propio));
  estrecho.entidades[0].stock.cobre = 5;
  estrecho.entidades[1].cap = 1;
  estrecho.entidades[1].tProceso = 30;
  agregar('derrame-sin-limite', 6, repetir(5, viaje()), { escenario: estrecho, categoria: 'derrame', cambiaEtapa3: ['carga-conservada'] });
  agregar('viaje-vacio', 0, 'await yo.recoger("ENT-1", "silicio");', { categoria: 'vacio' });
  agregar('viaje-vacio-prohibido', 4, 'await yo.recoger("ENT-1", "silicio");', { categoria: 'vacio' });
  agregar('sin-await', 0, 'yo.recoger("ENT-1", "cobre");\nawait yo.entregar("FUN");', { categoria: 'sin-await' });
  agregar('bucle-sin-await', 0, 'while (true) {}', { categoria: 'vigia' });
  agregar('bucle-con-metas', 0, soluciones[0] + '\nwhile (true) { await yo.esperar(60); }', {
    categoria: 'no-termina', cambiaEtapa3: ['victoria-por-metas'],
  });
  agregar('limite-sensores', 0, 'while (await yo.cuantos("ENT-1", "cobre") > 0) {}', { categoria: 'sensores' });
  agregar('lugar-inexistente', 0, 'await yo.cuantos("NO-EXISTE", "cobre");', { categoria: 'validacion' });
  agregar('rechazo-conserva-carga', 1, viaje('ENT-1', 'cobre', 'ENS'), { categoria: 'rechazo' });
  return casos;
}

function comprobarCobertura(casos) {
  for (let reto = 0; reto <= 6; reto++) {
    assert(casos.some(c => c.reto === reto && c.categoria === 'inicial'), `Falta inicial ${reto}`);
    assert(casos.some(c => c.reto === reto && c.categoria === 'victoria' && c.resultado.fin === 'victoria'), `Falta victoria ${reto}`);
  }
  for (const c of casos) {
    const r = c.resultado;
    assert.equal(r.intento, c.intento, `${c.id}: intento`);
    if (c.categoria === 'victoria') assert.equal(r.fin, 'victoria', c.id);
    if (c.categoria === 'derrame') assert(r.derrames > 0, c.id);
    if (r.derrames > 0) assert(c.cambiaEtapa3?.includes('carga-conservada'), `${c.id}: marcar cambio de derrames`);
    if (c.categoria === 'vacio') assert(r.vacios > 0, c.id);
    if (['sin-await', 'vigia', 'sensores', 'validacion'].includes(c.categoria)) assert.equal(r.fin, 'error', c.id);
    if (c.categoria === 'sin-await') assert.match(r.mensaje, /Falta await en la línea 1/, c.id);
    if (c.categoria === 'no-termina') {
      assert.equal(r.motivo, 'limite', c.id);
      assert(r.metas.every(m => m.cumplida), c.id);
    }
    if (c.categoria === 'rechazo') {
      assert.equal(r.robot.carga, 'cobre', c.id);
      assert.equal(r.resultados.rechazado, 1, c.id);
    }
  }
  assert.deepEqual(casos.filter(c => c.reto === 4 && c.categoria === 'victoria').map(c => c.resultado.stockOculto), [7, 3, 6, 4, 5]);
}

// El guardado se restaura aun si falla una comprobación. Nunca se limpia el perfil.
async function conFactory(page, origen, trabajo) {
  const u = new URL(origen);
  assert(['127.0.0.1', 'localhost'].includes(u.hostname) && u.port === '8771' && u.protocol === 'http:', 'Solo se admite el origen local de QA :8771');
  const entrada = `${u.origin}/`;
  await page.goto(entrada);
  const respaldo = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('cmg-banco02:') || k.startsWith('cmg-banco02-ui-'))));
  await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  try {
    return await trabajo(async caso => {
      // Salir primero: beforeunload del juego guarda el programa abierto.
      await page.goto(entrada);
      await page.evaluate(c => {
        for (const k of Object.keys(localStorage)) if (k.startsWith('cmg-banco02:')) localStorage.removeItem(k);
        const datos = {
          modo: 'bloques', reto: c.reto, propio: c.escenario ?? null,
          telemetria: Array.from({ length: c.intento - 1 }, () => ({ reto: c.reto + 1 })),
        };
        for (const [k, v] of Object.entries(datos)) localStorage.setItem(`cmg-banco02:${k}`, JSON.stringify(v));
      }, caso);
      await page.goto(`${u.origin}/Prototypes/Tres%20vistas/index.html?forma=escritorio`);
      await page.waitForFunction(() => !!window.__banco && !!window.cmg);
    });
  } finally {
    await page.goto(entrada);
    await page.evaluate(datos => {
      for (const k of Object.keys(localStorage)) if (k.startsWith('cmg-banco02:') || k.startsWith('cmg-banco02-ui-')) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(datos)) localStorage.setItem(k, v);
    }, respaldo);
    await page.cdp('Emulation.setFocusEmulationEnabled', { enabled: false });
  }
}

async function ejecutarCaso(page, preparar, caso) {
  await preparar(caso);
  await page.evaluate(codigo => {
    window.__banco.aplicarModo('js');
    window.cmg.codigo.value = codigo;
    window.cmg.codigo.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#b-vel').click();
    document.querySelector('#b-vel').click(); // 4× oficial, sin alterar el reloj ni el paso.
    window.cmg.alternarEjecucion();
  }, caso.codigo);
  // Esperas acotadas; el caso de límite dura unos 75 s a 4×.
  for (let i = 0; ; i++) {
    if (await page.evaluate(() => !!window.__banco.mundo.fin)) break;
    assert(i < 150, `Tiempo real agotado: ${caso.id}`);
    if (i > 0 && i % 30 === 0) console.log(`${caso.id}: esperando fin (${i} s reales)`);
    await page.waitForTimeout(1000);
  }
  return page.evaluate(c => {
    const m = window.__banco.mundo;
    const t = JSON.parse(localStorage.getItem('cmg-banco02:telemetria')).at(-1);
    const reto = c.escenario ?? window.__banco.RETOS[c.reto];
    return {
      fin: m.fin, motivo: t.motivo, mensaje: t.mensaje, linea: t.linea,
      t: m.t, intento: t.intento, derrames: m.derrames, vacios: m.vacios, stockOculto: m.stockOculto,
      metas: reto.metas.map(meta => {
        const e = m.porId[meta.id];
        const valor = meta.tipo === 'vaciar' ? (e.stock[meta.mat] || 0) : (e.recibido[meta.mat] || 0);
        return { ...meta, valor, cumplida: meta.tipo === 'vaciar' ? valor === 0 && m.robot.carga !== meta.mat : valor >= meta.n };
      }),
      robot: { x: m.robot.x, y: m.robot.y, carga: m.robot.carga, viajes: m.robot.viajes },
      resultados: m.resultados,
      // Aporta el resultado de lecturas y la secuencia temporal de cada encargo.
      eventos: m.eventos,
    };
  }, caso);
}

export async function generarOraculo(page, origen = 'http://127.0.0.1:8771') {
  const fuente = await readFile(new URL('../' + archivoFuente, import.meta.url), 'utf8');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: raiz, encoding: 'utf8' }).trim();
  const versionada = execFileSync('git', ['show', `${commit}:${archivoFuente}`], { cwd: raiz, encoding: 'utf8' });
  assert.equal(fuente, versionada, 'La referencia Factory debe coincidir con el commit de origen');
  const casos = await conFactory(page, origen, async preparar => {
    await preparar({ reto: 0, intento: 1 });
    const servida = await page.evaluate(async () => (await fetch('js/juego.js', { cache: 'no-store' })).text());
    assert.equal(sha256(servida), sha256(fuente), 'El servidor debe servir este checkout');
    const datos = await page.evaluate(() => {
      const b = window.__banco;
      return { retos: b.RETOS, iniciales: [...b.RETOS.map(r => b.generar({ cuerpo: r.inicial }).codigo), ''] };
    });
    const definidos = definirCasos(datos.retos, datos.iniciales);
    for (let vuelta = 1; vuelta <= 2; vuelta++) {
      for (const caso of definidos) {
        const resultado = await ejecutarCaso(page, preparar, caso);
        if (vuelta === 1) {
          caso.resultado = resultado;
          // También los programas iniciales pueden derramar: marcar todos los afectados.
          if (resultado.derrames > 0) caso.cambiaEtapa3 = [...new Set([...(caso.cambiaEtapa3 || []), 'carga-conservada'])];
        }
        else assert.deepEqual(resultado, caso.resultado, `${caso.id}: dos ejecuciones idénticas`);
        console.log(`Oráculo ${vuelta}/2 · ${caso.id}: ${resultado.fin}, t=${resultado.t}`);
      }
      comprobarCobertura(definidos);
    }
    return definidos;
  });
  const fixture = { version: 1, origen: { commit, archivo: archivoFuente, sha256: sha256(fuente) },
    metodo: 'Factory original, Web Workers reales, paso fijo 0.05, velocidad oficial 4×; dos pasadas idénticas. Sin reloj simulado.', casos };
  // No actualizar silenciosamente el oráculo cuando haya una regresión.
  await writeFile(fixtureURL, JSON.stringify(fixture, null, 2) + '\n', { flag: 'wx' });
  return { casos: casos.length, ejecuciones: casos.length * 2 };
}

export async function probarOraculo(page, origen = 'http://127.0.0.1:8771') {
  const fixture = JSON.parse(await readFile(fixtureURL, 'utf8'));
  comprobarCobertura(fixture.casos);
  return conFactory(page, origen, async preparar => {
    for (const caso of fixture.casos) {
      const actual = await ejecutarCaso(page, preparar, caso);
      const { t, ...resto } = actual;
      const { t: esperado, ...restoEsperado } = caso.resultado;
      assert(Math.abs(t - esperado) <= 1e-9, `${caso.id}: tiempo ${t}, esperado ${esperado}`);
      assert.deepEqual(resto, restoEsperado, caso.id);
      console.log(`OK oráculo: ${caso.id}`);
    }
    return fixture.casos.length;
  });
}
