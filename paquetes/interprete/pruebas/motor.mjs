import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { crearInterprete, PresupuestoAgotado } from '../index.js';
const acorn = createRequire(import.meta.url)('../../../shared/vendor/acorn-8.11.3.js');
for (const codigo of ['while(true){}','const o={get x(){while(true){}}};o.x;',
  'const o={get x(){return 3}};while(true){o.x}',
  'Promise.resolve().then(function f(){return Promise.resolve().then(f)})']) {
  const cortes=[];
  for(let i=0;i<2;i++) {
    const e=crearInterprete({acorn,presupuesto:3000});
    let error;
    try{e.ejecutar(codigo);e.vaciarTrabajos()}catch(x){error=x;}
    assert.ok(error instanceof PresupuestoAgotado,codigo);
    assert.equal(error.code,'CBL_PRESUPUESTO');assert.equal(error.cuenta,3001);
    cortes.push([error.cuenta,error.linea]);e.liberar();
  }
  assert.deepEqual(cortes[0],cortes[1]);
}
{
  const e=crearInterprete({acorn});
  assert.throws(()=>e.ejecutar('let a=1;\na++;\nnoExiste();'),x=>x.name==='ReferenceError'&&x.linea===3&&x.message==='noExiste is not defined');
  e.reiniciarPresupuesto();assert.deepEqual([e.medir().nodos,e.medir().linea],[0,null]);e.liberar();
}
{
  const traza=[],e=crearInterprete({acorn,depurar:true,globales:{registro:x=>traza.push(x)}});
  const p=e.ejecutar('(async function(){let x=1;\nconst f=()=>++x;\nregistro(f());\nawait Promise.resolve();\nregistro(f());\nreturn x;})()');
  const lineas=[];let valor;
  p.then(v=>valor=v);
  while(e.pausasPendientes().length){lineas.push(e.pausasPendientes()[0].linea);e.reanudar();e.vaciarTrabajos()}
  assert.deepEqual(lineas,[1,2,3,4,5,6]);assert.deepEqual(traza,[2,3]);assert.equal(valor,3);
  e.liberar();assert.equal(e.medir().trabajos,0);assert.equal(e.medir().pausas,0);
  assert.throws(()=>e.ejecutar('1'),/liberado/);assert.throws(()=>e.vaciarTrabajos(),/liberado/);
}
{
  const e=crearInterprete({acorn});
  const fn=e.ejecutar('new Function("a","return a+2")');assert.equal(fn(3),5);
  e.ejecutar('Object.defineProperty(globalThis,"fijo",{value:1});');
  e.liberar();e.liberar();assert.equal(Object.keys(e.global).length,0);
  assert.throws(()=>fn(4),/liberado/);
}
{
  const e=crearInterprete({acorn});
  for(let i=0;i<160;i++)e.ejecutar(String(i));
  assert.equal(e.medir().cache.arboles,128);assert.ok(e.medir().cache.caracteres<=2_000_000);e.liberar();
}
console.log('Intérprete motor: presupuesto repetible, getter, trabajos, loc, pausa/cierres, compilación, caché y liberación.');

execFileSync(process.execPath, [new URL('../../../herramientas/espina-interprete/generacion/rapido.mjs', import.meta.url).pathname, '--comprobar']);
