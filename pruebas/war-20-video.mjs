import {readFile} from 'node:fs/promises';
import {configurarSalida,preparar,grabar,grabarSeleccion} from './grabar-regresiones-war.mjs';
import {salida} from './war-20-ciclos.mjs';
export async function videos(p){
 configurarSalida(salida+'/videos','/Users/rubenmena/Documents/Dev/Code-battle-lite/.qa-recuperacion/war-20-video-20261030');
 const c=JSON.parse(await readFile(salida+'/evidencia/14-traza.json','utf8'));
 await preparar(p,c.trasPerturbacion.codigo,true);
 const f=await grabar(p,'04-sugerencias-asa','WAR-20-UI-01 · sugerencias sobre el asa de línea',async({rotulo,esperar})=>{
  await rotulo('1. Tocar el mensaje: abre la hoja de sugerencias.');await p.click('#bloques-texto span[data-a="123"]');await esperar(600);
  const punto=await p.evaluate(()=>{const e=document.querySelector('.gutter-in>div:nth-child(5)'),r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return{x,y,objetivo:document.elementFromPoint(x,y)?.outerHTML};});
  await rotulo('2. El número 5 queda bajo una opción. Clic en su posición.');await esperar(1700);await p.mouse.click(punto.x,punto.y);await esperar(700);
  const despues=await p.evaluate(()=>cmg.codigo.value);
  await rotulo('3. Se eligió un valor: no la línea. Deshacer el valor.');await esperar(1600);await p.click('#edicion [data-accion="deshacer"]');await esperar(500);
  await rotulo('4. Recuperación: cerrar sugerencias → línea 5 → Borrar.');
  if(await p.evaluate(()=>!!document.querySelector('.sugerencias:not([hidden]) .sug-x')))await p.click('.sugerencias:not([hidden]) .sug-x');
  await p.click('.gutter-in>div:nth-child(5)');await esperar(500);await p.click('#edicion [data-accion="borrar"]');await esperar(700);
  const final=await p.evaluate(()=>cmg.codigo.value);await rotulo('5. Comparación del texto final con la referencia.');await esperar(1900);
  return {punto,despues,recuperado:final===c.objetivo.codigo,final};
 });console.log(f);
 console.log(await grabarSeleccion(p,false));console.log(await grabarSeleccion(p,true));
}
