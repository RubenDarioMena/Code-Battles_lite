import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { guardarMedidas } from './medidas.mjs';
import os from 'node:os';
import { crearPrograma as vm } from '../partida/programa.mjs';
import { crearPrograma as propio } from './propio/index.mjs';
import { cargarQuickJS, motorQuickJS } from './quickjs.mjs';
import { escenario, programaWar, programaCampaign } from './escenarios.mjs';
const MB = 1024 * 1024;
export async function medir(motor, serie, n) {
  const Q = motor === 'Q' ? await cargarQuickJS() : null;
  if (motor === 'Q' && !Q) return { omitido: 'Falta CBL_QUICKJS' };
  const crear = motor === 'Q' ? motorQuickJS(Q) : motor === 'P' ? propio : vm;
  const e = escenario(serie), workers = [], muestras = [], arranques = [], respuestas = [];
  // El corpus de War tiene objetivos en el mundo; aquí fijamos uno para ejercitar órdenes completas.
  if (serie === 'war') e.snap.auto[e.propia].visual.crawler = { id: 'enemigo-fijo', x: 30, y: 20, z: 0 };
  let paso = 0, errores = [], mensajes = 0;
  global.gc?.(); const base = process.memoryUsage();
  const inicio = performance.now();
  try {
    for (let i = 0; i < n; i++) {
      const t = performance.now(), pendiente = [];
      const w = crear(e.fuente, e.propia, m => {
        mensajes++;
        if (m.type === 'error') errores.push(m);
        if (['espera', 'encargo'].includes(m.type)) pendiente.push({ id: m.id,
          paso: paso + (m.type === 'espera' ? Math.round(m.s / 0.05) : 3) });
      }, 4000);
      workers.push(w); respuestas.push(pendiente);
      w.postMessage(e.mensaje(serie === 'war' ? programaWar(0.1 + (i % 5) * 0.1) : programaCampaign));
      while (w.entregar()) { /* Incluye los timers Campaign(0). */ }
      arranques.push(performance.now() - t);
    }
    const arranqueMs = performance.now() - inicio;
    for (paso = 1; paso <= 120; paso++) {
      const t = performance.now();
      for (let i = 0; i < n; i++) {
        const p = respuestas[i], ahora = p.filter(x => x.paso <= paso);
        respuestas[i] = p.filter(x => x.paso > paso);
        // El callback cierra sobre la cola original; la conservamos, no la reemplazamos.
        p.splice(0, p.length, ...respuestas[i]); respuestas[i] = p;
        for (const x of ahora) workers[i].postMessage({ type: 'despierta', id: x.id, snap: e.snap, resultado: 'ok' });
        while (workers[i].entregar()) { /* Drena una cesión completa. */ }
      }
      if (paso > 20) muestras.push(performance.now() - t);
    }
    global.gc?.(); const memoria = process.memoryUsage();
    let qBytes = 0, qMin = Infinity, qMax = 0;
    if (Q) for (const w of workers) {
      const m = w.medir().memoria.memory_used_size;
      qBytes += m; qMin = Math.min(qMin, m); qMax = Math.max(qMax, m);
    }
    const ordenadas = [...muestras].sort((a, b) => a - b);
    return { motor, serie, unidades: n, turnos: muestras.length, mensajes, errores,
      ms: { media: muestras.reduce((a, b) => a + b, 0) / muestras.length,
        p95: ordenadas[Math.ceil(ordenadas.length * 0.95) - 1], max: ordenadas.at(-1) },
      arranque: { totalMs: arranqueMs, porUnidadMs: arranqueMs / n, maxUnidadMs: Math.max(...arranques) },
      memoria: { rssMB: memoria.rss / MB, deltaRssMB: (memoria.rss - base.rss) / MB,
        heapMB: memoria.heapUsed / MB, deltaHeapMB: (memoria.heapUsed - base.heapUsed) / MB,
        arrayBuffersMB: memoria.arrayBuffers / MB, externalMB: memoria.external / MB,
        ...(Q ? { quickjsBytes: qBytes, porContextoBytes: qBytes / n, minContextoBytes: qMin, maxContextoBytes: qMax,
          wasmHeapBytes: Q.getWasmMemory().buffer.byteLength } : {}) }, muestrasMs: muestras };
  } finally { workers.forEach(w => w.terminate()); }
}
if (process.argv[2] === '--caso') {
  console.log(JSON.stringify(await medir(process.argv[3], process.argv[4], Number(process.argv[5]))));
} else {
  const motores = ['vm', ...(process.env.CBL_QUICKJS ? ['Q'] : []), 'P'];
  if (!process.env.CBL_QUICKJS) console.warn('Q omitido: falta CBL_QUICKJS (node_modules externo).');
  const datos = { equipo: { plataforma: process.platform, arquitectura: process.arch, cpu: os.cpus()[0].model,
    node: process.version, memoriaGB: os.totalmem() / MB / 1024 }, protocolo: '120 turnos DT=.05; descarta 20; proceso separado por celda; GC antes/después; instantáneas fijas; respuestas de encargos a los 3 pasos', casos: [] };
  for (const motor of motores) for (const serie of ['war', 'campaign']) for (const n of [50, 200, 500]) {
    const salida = execFileSync(process.execPath, ['--expose-gc', new URL(import.meta.url).pathname, '--caso', motor, serie, String(n)],
      { encoding: 'utf8', env: process.env, maxBuffer: 10 * MB });
    const r = JSON.parse(salida); datos.casos.push(r);
    console.log(`${motor} ${serie} ${n}: ${r.ms.media.toFixed(2)} ms media; p95 ${r.ms.p95.toFixed(2)}; max ${r.ms.max.toFixed(2)}; RSS ${r.memoria.rssMB.toFixed(1)} MiB; arranque ${r.arranque.porUnidadMs.toFixed(2)} ms/u; errores ${r.errores.length}`);
    guardarMedidas('carga', datos);
  }
}
