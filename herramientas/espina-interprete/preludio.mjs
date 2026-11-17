// Aislar la decisión de __py: misma fábrica, inicialización y llamadas desde el motor.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { preludio } from '../../paquetes/lenguaje/index.js';
import { crearInterprete } from '../../paquetes/interprete/index.js';
import { guardarMedidas } from './medidas.mjs';
const acorn = createRequire(import.meta.url)('../../shared/vendor/acorn-8.11.3.js');
const fuente = `(${preludio.toString()})()`;
const datos = {};
for (const nativo of [false, true]) {
  const motor = crearInterprete({ acorn, presupuesto: 10000000 });
  const crear = nativo ? preludio : () => { motor.reiniciarPresupuesto(); return motor.ejecutar(fuente, { usuario: false }); };
  crear(); // Calienta la caché AST; no incluye construir el reino ni cargar módulos.
  let inicio = performance.now(), py;
  for (let i = 0; i < 500; i++) py = crear();
  const inicioMs = performance.now() - inicio;
  motor.global.__py = py;
  const muestras = [];
  for (let i = 0; i < 6; i++) {
    motor.reiniciarPresupuesto(); inicio = performance.now();
    const valor = motor.ejecutar('(function(){let x=0; for(let i=0;i<10000;i++) x=__py.bin("+",x,1); return x;})()');
    assert.equal(valor, 10000); if (i) muestras.push(performance.now() - inicio);
  }
  datos[nativo ? 'nativo' : 'interpretado'] = { inicializaciones: 500, inicioMs, msPorUnidad: inicioMs / 500,
    llamadas: 10000, mediaMs: muestras.reduce((a, b) => a + b, 0) / muestras.length, muestrasMs: muestras };
  motor.liberar();
}
guardarMedidas('paso-4a-preludio', datos);
console.log(JSON.stringify(datos));
