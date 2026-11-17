#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { opciones, uso } from './medir-unidades/opciones.mjs';

const o = opciones(process.argv.slice(2));
if (o.help) console.log(uso);
else if (o.caso) {
  const { medirSinPantalla } = await import('./medir-unidades/sin-pantalla.mjs');
  console.log(JSON.stringify(await medirSinPantalla({ serie: o.series[0], unidades: o.unidades[0],
    pasos: o.pasos, calentamiento: o.calentamiento, semilla: o.semilla })));
} else {
  const equipo = { plataforma: process.platform, arquitectura: process.arch, cpu: os.cpus()[0]?.model,
    cpus: os.cpus().length, memoriaBytes: os.totalmem(), node: process.version };
  const base = { formato: 1, fecha: new Date().toISOString(), equipo, opciones: o,
    protocolo: 'DT=.05; juego: acum+=min(real,.25) solo sin programas corriendo; total por paso incluye respuestas/órdenes/sucesos; percentil rango más próximo; sin pantalla: huella fuera del reloj, proceso independiente por celda y repetición' };
  await mkdir(o.salida, { recursive: true });
  const guardar = async datos => writeFile(path.join(o.salida, 'resumen.json'), JSON.stringify({ ...base, ...datos }, null, 2) + '\n');
  if (o.modo === 'juego') {
    const { medirNavegador } = await import('./medir-unidades/navegador.mjs');
    await medirNavegador(o, guardar);
  } else {
    const resultados = [], ejecutar = promisify(execFile);
    for (const serie of o.series) for (const unidades of o.unidades) {
      const repeticiones = [];
      for (let i = 0; i < o.repeticiones; i++) {
        const { stdout } = await ejecutar(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url), '--caso',
          '--series', serie, '--unidades', String(unidades), '--pasos', String(o.pasos),
          '--calentamiento', String(o.calentamiento), '--semilla', String(o.semilla)], { maxBuffer: 64 * 1024 * 1024 });
        repeticiones.push(JSON.parse(stdout));
      }
      const r = repeticiones[0];
      const determinista = repeticiones.length < 2 ? null : repeticiones.every(v => JSON.stringify(v.huella) === JSON.stringify(r.huella) && v.huellaOrdenes === r.huellaOrdenes);
      resultados.push({ ...r, determinista, repeticiones });
      if (determinista === false) throw Error(`Huella distinta: ${serie}/${unidades}`);
      const p = k => r.costes[k].p95Ms.toFixed(3);
      console.log(`${serie} ${unidades}: p95 ms sim=${p('simulacion')} instantánea=${p('instantanea')} ceder=${p('ceder')} responder=${p('responder')} total=${p('total')}; RSS máx ${(r.memoria.rssMax / 1048576).toFixed(1)} MiB; arranque ${r.arranqueMs.toFixed(1)} ms; determinista=${determinista}`);
      await guardar({ backend: 'node', resultados });
    }
  }
  console.log(`Salida: ${path.resolve(o.salida, 'resumen.json')}`);
}
