// Genera artefactos de la tanda, sin modificar el producto.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {salida} from './war-20-ciclos.mjs';
const dir=join(salida,'evidencia'), resumen=JSON.parse(await readFile(join(dir,'resumen.json'),'utf8'));
if(resumen.intentos.length!==20)throw new Error('Tanda incompleta');
let log='# Cadena de inputs · 20 ciclos\n\nCada JSON conserva código previo, perturbado y final, selección y traza completa. Coordenadas en CSS px; tiempos desde iniciar el intento. Preparación con fill fuera del intento; recuperación con UI.\n\n';
const casos=[];
for(const r of resumen.intentos){
 const id=String(r.numero).padStart(2,'0'),c=JSON.parse(await readFile(join(dir,id+'-traza.json'),'utf8'));casos.push(c);
 log+=`## ${id} · ${r.ejercicio}\n\nUmbral ${r.umbral}; ${r.resultado}; ${r.clicsReparacion} clics de reparación; ${(r.duracionMs/1000).toFixed(2)} s.\n\n`;
 log+=`[Antes](evidencia/${id}-antes.png) → [Perturbación](evidencia/${id}-perturbacion.png) → [Ensayo local](evidencia/${id}-local.png) → [Final](evidencia/${id}-final.png) · [JSON](evidencia/${id}-traza.json)\n\n`;
 log+='| Paso | ms | Input / estado |\n| --- | ---: | --- |\n';
 for(const e of c.traza){if(e.tipo==='clic')log+=`| ${e.orden} | ${e.ms} | Clic (${e.x.toFixed(1)}, ${e.y.toFixed(1)}) · ${typeof e.elemento==='string'?e.elemento:e.elemento.nombre} · selección ${e.antes.seleccion.join('–')} |\n`;else if(['tras-caracter','tras-perturbacion','error','promesa-rechazada'].includes(e.tipo))log+=`| ${e.orden} | ${e.ms} | ${e.tipo} · selección ${e.despues?.seleccion.join('–')??e.mensaje} |\n`;}
 log+='\nRecuperación observada: '+c.pasos.map(p=>p.accion).join(' → ')+'.\n\n';
}
await writeFile(join(salida,'LOG-INPUTS.md'),log);
const rows=resumen.intentos.map((r,i)=>`| ${r.numero} | ${r.ejercicio} | ${r.perturbacion.punto.offset} · ${JSON.stringify(r.perturbacion.punto.caracter)} → ${r.perturbacion.boton.nombre} | ${r.resultado} | ${r.clicsReparacion} | ${(r.duracionMs/1000).toFixed(2)} |`).join('\n');
await writeFile(join(salida,'RESULTADOS.md'),'# Resultados medidos\n\n| # | Contexto | Offset / carácter → botón | Resultado | Clics reparación | s |\n| --- | --- | --- | --- | ---: | ---: |\n'+rows+'\n');
const archivos=await readdir(dir),sha=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
const root='/Users/rubenmena/Documents/Dev/Code-battle-lite';
const recursos=['Prototypes/Rocket Launcher/index.html','Prototypes/Rocket Launcher/js/juego.js','shared/js/edicion.js','shared/js/estructura.js','shared/css/edicion.css'];
await writeFile(join(salida,'MANIFIESTO.json'),JSON.stringify({generado:new Date().toISOString(),semilla:resumen.config.semilla,config:resumen.config,resultados:resumen.intentos.map(r=>({numero:r.numero,resultado:r.resultado,viewport:r.contexto.viewport,recursos:r.contexto.version.recursos})),hashes:await Promise.all(recursos.map(async f=>({archivo:f,sha256:await sha(join(root,f))}))),evidencia:await Promise.all(archivos.map(async f=>({archivo:f,sha256:await sha(join(dir,f))})))},null,2)+'\n');
console.log(JSON.stringify({intentos:casos.length,recuperados:resumen.intentos.filter(r=>r.resultado==='recuperado').length,nivel4:casos.filter(c=>c.nivel===4).length,clics:resumen.intentos.reduce((s,r)=>s+r.clicsReparacion,0),errores:casos.flatMap(c=>c.traza.filter(e=>['error','promesa-rechazada'].includes(e.tipo))),reparaciones:casos.map((c,i)=>({n:i+1,pasos:c.pasos.map(p=>p.accion)}))}));
