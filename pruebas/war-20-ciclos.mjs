// QA externa: preparación entre intentos; perturbación y recuperación solo por UI.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {conectarCiclo} from './recuperacion-editor.mjs';
import {ejercicios} from './recuperacion-ejercicios.mjs';
export const salida='/Users/rubenmena/Documents/Dev/Code-battle-lite/docs/qa/war-20-ciclos-2026-10-30';
const pausa=ms=>new Promise(r=>setTimeout(r,ms));
export async function tanda(p,desde,hasta){
 await mkdir(join(salida,'evidencia'),{recursive:true});
 for(let n=desde;n<=hasta;n++){
  const movil=n>10, r=(n-1)%5, nivel=[1,3,4,4,5,4,4,4,4,5][(n-1)%10];
  const fixture=ejercicios[r];
  await p.cdp('Network.enable');await p.cdp('Network.setCacheDisabled',{cacheDisabled:true});
  await p.cdp('Emulation.setDeviceMetricsOverride',{width:movil?393:1366,height:movil?852:900,deviceScaleFactor:1,mobile:movil});
  await p.goto('http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?forma='+(movil?'movil':'escritorio'));
  await p.waitForFunction(()=>!!window.cmg?.edicion);
  const build=await p.evaluate(()=>[...document.scripts].map(s=>s.src));
  if(!build.some(s=>s.endsWith('/juego.js?v=14')) || !build.some(s=>s.endsWith('/edicion.js?v=16')))throw new Error('Build anterior: no iniciar intento.');
  if(await p.evaluate(()=>document.querySelector('#b-barras').getAttribute('aria-expanded')==='false'))await p.click('#b-barras');
  await p.click('loc=role:tab[name="PROGRAMA"]');
  await p.click('.modos-codigo [data-modo-codigo="js"]');
  await p.click('#b-reto');await p.click('.reto-btn[data-i="'+(nivel-1)+'"]');
  if(!await p.evaluate(()=>document.querySelector('#hoja-reto').hidden))await p.click('#b-reto');
  const teclado=movil?'#edicion .b-teclado':'#b-teclado';
  if(await p.evaluate(()=>cmg.edicion.activo))await p.click(teclado);
  await p.fill('#codigo',fixture.codigo);await p.click(teclado);
  await p.mouse.move(movil?220:1100,movil?700:500);await p.mouse.wheel(0,-1800);
  await pausa(450);
  const ciclo=await conectarCiclo(p,{directorio:join(salida,'evidencia'),reanudar:true,config:{semilla:'war-postfix-20-20261030-v1',intentos:20}});
  const prefix=join(salida,'evidencia',String(n).padStart(2,'0'));
  await p.screenshot({path:prefix+'-antes.png'});
  let s=await ciclo.iniciar(fixture.id+' · nivel '+nivel+' · '+(movil?'móvil':'PC'));
  // Gesto neutro de selección; pausa evita convertirlo accidentalmente en doble clic.
  while(s.intento.fase==='espera'){
   s=await ciclo.click('#bloques-texto span[data-a="0"]');
   if(s.intento.fase==='espera')await pausa(450);
  }
  await p.screenshot({path:prefix+'-perturbacion.png'});
  const foto=()=>p.evaluate(()=>window.__qaRecuperacion.foto());
  const detalle=await p.evaluate(()=>({...window.__qaRecuperacion.actual}));
  detalle.overlay=await p.evaluate(()=>[...document.querySelectorAll('.sugerencias:not([hidden])')].map(e=>({rect:e.getBoundingClientRect().toJSON(),opciones:[...e.querySelectorAll('.sug')].map(b=>({texto:b.textContent,rect:b.getBoundingClientRect().toJSON()}))})));
  const objetivo=detalle.objetivo.codigo, pasos=[];
  if(detalle.cambio){
   // Ensayo local sobre la selección que dejó la inserción; observar antes de decidir la siguiente acción.
   let antes=await foto();
   if(antes.seleccion[0]!==antes.seleccion[1]){
    await ciclo.click('#edicion [data-accion="borrar"]');await pausa(420);
    let despues=await foto();pasos.push({accion:'Borrar selección resultante',antes,despues});
    await p.screenshot({path:prefix+'-local.png'});
    if(despues.codigo!==objetivo && despues.codigo!==antes.codigo){
     await ciclo.click('#edicion [data-accion="deshacer"]');pasos.push({accion:'Deshacer reparación local',despues:await foto()});
    }
   }
   if((await foto()).codigo!==objetivo){
    // Si la perturbación añadió una sola línea completa, intentar quitar esa línea con su asa.
    const texto=(await foto()).codigo;
    let inicio=0;while(inicio<objetivo.length && texto[inicio]===objetivo[inicio])inicio++;
    let fin=objetivo.length;while(fin>inicio && objetivo[fin-1]===texto[texto.length-objetivo.length+fin-1])fin--;
    const agregado=texto.slice(inicio,texto.length-objetivo.length+fin);
    if(fin===inicio && agregado.includes('\n') && agregado.trim() && agregado.trim().split('\n').length===1){
     const linea=texto.slice(0,inicio).split('\n').length+(agregado.startsWith('\n')?1:0);
     if(n>10){
      if(await p.evaluate(()=>!!document.querySelector('.sugerencias:not([hidden]) .sug-x')))await ciclo.click('.sugerencias:not([hidden]) .sug-x');
      await ciclo.click('.gutter-in > div:nth-child('+linea+')');
      const elegida=await foto();
      await ciclo.click('#edicion [data-accion="borrar"]');
      const despues=await foto();pasos.push({accion:'Seleccionar línea '+linea+' y Borrar',antes:elegida,despues});
      await p.screenshot({path:prefix+'-linea.png'});
      if(despues.codigo!==objetivo && despues.codigo!==texto){await ciclo.click('#edicion [data-accion="deshacer"]');pasos.push({accion:'Deshacer borrado de línea',despues:await foto()});}
     }else pasos.push({accion:'Candidato a reparación por línea',linea,agregado});
    }
    if((await foto()).codigo!==objetivo){await ciclo.click('#edicion [data-accion="deshacer"]');await pausa(420);pasos.push({accion:'Deshacer perturbación',despues:await foto()});}
   }
  }
  const completo=await p.evaluate(()=>({...window.__qaRecuperacion.actual,final:window.__qaRecuperacion.foto()}));
  await writeFile(prefix+'-traza.json',JSON.stringify({nivel,fixture:fixture.id,movil,pasos,overlay:detalle.overlay,...completo},null,2)+'\n');
  await p.screenshot({path:prefix+'-final.png'});
  const local=pasos.length===1 && completo.final.codigo===objetivo;
  const resumen=await ciclo.cerrar({nota:local?'Recuperación local con Borrar.':'Ensayo local documentado; recuperación con Deshacer si fue necesaria.'});
  console.log(JSON.stringify({n,nivel,fixture:fixture.id,movil,resultado:resumen.resultado,local,pasos:pasos.map(x=>x.accion),boton:detalle.perturbacion.boton.nombre,previo:objetivo,perturbado:detalle.trasPerturbacion.codigo,seleccion:detalle.trasPerturbacion.seleccion,final:completo.final.codigo,viewport:completo.final.viewport}));
 }
}
