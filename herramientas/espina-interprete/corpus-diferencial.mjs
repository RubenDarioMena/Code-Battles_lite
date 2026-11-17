// Arnés de integración de pruebas, fuera del paquete sin dependencias: consume
// únicamente entradas públicas y las mismas fuentes que las herramientas del juego.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { retos as war } from '../../paquetes/reglas-war/index.js';
import { retos as factory } from '../../paquetes/reglas-factory/index.js';
import { nivel } from '../../paquetes/reglas-campaign/index.js';
import { escenario } from './escenarios.mjs';
import { cargar } from '../partida/cargar.mjs';
import { crearPrograma as vm } from '../partida/programa.mjs';
import { crearPrograma as propio } from './propio-paquete.mjs';
import { referencias } from './corpus.mjs';
const require = createRequire(import.meta.url), soluciones = require('../../pruebas/campaign-soluciones.cjs');
const sesion = cargar(), casos = [];
for (const [serie, retos] of [['war',war.RETOS],['factory',factory.RETOS],['campaign',[nivel.NIVEL]]])
  for (const [i,reto] of retos.entries()) for (const [unidad,lineas] of Object.entries(reto.inicial))
    casos.push({id:`inicial-${serie}-${i}-${unidad}`,serie,codigo:lineas.join('\n')});
for(const ref of referencias) for(const [unidad,programa] of Object.entries(ref.parametros.programas || {})) {
  const {codigo,lenguaje} = typeof programa==='string' ? {codigo:programa,lenguaje:'js'} : programa;
  casos.push({id:`referencia-${ref.id}-${unidad}`,serie:ref.reglas,codigo,lenguaje});
}
for(const lenguaje of ['js','python']) for(const [i,programas] of soluciones[lenguaje].entries())
  for(const [unidad,codigo] of Object.entries(programas)) casos.push({id:`solucion-campaign-${lenguaje}-${i}-${unidad}`,serie:'campaign',codigo,lenguaje});
const escenarios = new Map(['war','factory','campaign'].map(s=>[s,escenario(s)]));
function ejecutar(crear, e, mensaje) {
  const traza=[], w=crear(e.fuente,e.propia,m=>traza.push(m),4000);
  try {
    w.postMessage(mensaje); let guardia=0;
    while(w.entregar())assert.ok(++guardia<100);
    // Tres reanudaciones ejercitan cierres y las continuaciones del programa real.
    for(let i=0;i<3;i++) {
      const pedido=traza.findLast(m=>['espera','encargo'].includes(m.type)); if(!pedido)break;
      w.postMessage({type:'despierta',id:pedido.id,snap:e.snap,resultado:'ok'});
      while(w.entregar())assert.ok(++guardia<100);
    }
    return traza;
  } finally {w.terminate();}
}
let traducidos=0;
for(const c of casos) {
  const e=escenarios.get(c.serie);let codigo=c.codigo;
  if(c.lenguaje==='python') {
    const t=sesion.contexto.CMGPythonJS.traducir(codigo,e.lenguaje.opcionesPython());
    assert.ok(t.ok,`${c.id}: ${JSON.stringify(t.diagnosticos)}`);codigo=t.js;traducidos++;
  }
  const mensaje={...e.mensaje(codigo),lenguaje:c.lenguaje||'js'};
  assert.deepEqual(ejecutar(propio,e,mensaje),ejecutar(vm,e,mensaje),c.id);
}
console.log(`Intérprete reales: ${casos.length} fragmentos del juego, ${traducidos} traducidos de Python; Worker íntegro, traza y errores iguales a V8.`);
