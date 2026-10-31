// Ejecutar desde ego-browser nodejs. Captura Page.screencastFrame; no modifica recursos del juego.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const salida = join(root, 'docs/qa/war-2026-10-30/videos');
const raw = join(root, '.qa-recuperacion/war-video-20261030');
const pausa = ms => new Promise(r => setTimeout(r, ms));
const fuente = async n => JSON.parse(await readFile(join(root, `docs/qa/war-2026-10-29/evidencia/caso-${String(n).padStart(2,'0')}.json`), 'utf8'));
async function preparar(p, codigo, movil = false) {
  await p.goto('http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?forma=' + (movil ? 'movil' : 'escritorio'));
  const ancho = movil ? 393 : 1366, alto = movil ? 852 : 900;
  await p.cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: 1, mobile: movil });
  await p.waitForFunction(({ ancho, alto }) => innerWidth === ancho && innerHeight === alto && !!window.cmg?.edicion, { ancho, alto });
  if (await p.evaluate(() => document.querySelector('#b-barras').getAttribute('aria-expanded') === 'false')) await p.click('#b-barras');
  await p.click('loc=role:tab[name="PROGRAMA"]');
  await p.click('.modos-codigo [data-modo-codigo="js"]');
  await p.click('#b-reto'); await p.click('.reto-btn[data-i="3"]');
  if (!await p.evaluate(() => document.querySelector('#hoja-reto').hidden)) await p.click('#b-reto');
  if (await p.evaluate(() => cmg.edicion.activo)) await p.click(movil ? '#edicion .b-teclado' : '#b-teclado');
  await p.fill('#codigo', codigo);
  await p.click(movil ? '#edicion .b-teclado' : '#b-teclado');
  await p.waitForTimeout(500);
}
async function estado(p) { return p.evaluate(() => { const c = cmg.codigo; let sintaxis = true; try { acorn.parse(c.value, {ecmaVersion:2022,allowAwaitOutsideFunction:true}); } catch { sintaxis = false; } return {codigo:c.value,seleccion:[c.selectionStart,c.selectionEnd],sintaxis,viewport:[innerWidth,innerHeight]}; }); }
async function grabar(p, id, titulo, acciones) {
  const framesDir = join(raw,id); await mkdir(framesDir,{recursive:true}); await mkdir(salida,{recursive:true});
  await p.evaluate(({titulo}) => {
    document.querySelector('#qa-video-hud')?.remove(); document.querySelector('#qa-video-cursor')?.remove();
    const h=document.createElement('div');h.id='qa-video-hud';h.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483646;pointer-events:none;background:#111827f5;color:#f8fafc;padding:9px 14px;font:14px/1.4 system-ui;border-bottom:2px solid #38bdf8;box-sizing:border-box;min-height:75px';
    const t=document.createElement('strong');t.textContent=titulo;const l=document.createElement('div');l.id='qa-video-paso';l.textContent='Preparación completada. Captura real del navegador.';h.append(t,l);document.body.append(h);
    const m=document.createElement('div');m.id='qa-video-cursor';m.style.cssText='position:fixed;width:18px;height:18px;border:3px solid #fb7185;border-radius:50%;pointer-events:none;z-index:2147483647;display:none;transform:translate(-50%,-50%)';document.body.append(m);
    window.__qaVideo={titulo,inicio:performance.now(),inicioUTC:Date.now(),inputs:[]};
    document.addEventListener('pointerdown',ev=>{if(!ev.isTrusted)return;const q=window.__qaVideo,c=window.cmg?.codigo;const b=ev.target.closest?.('button');q.inputs.push({ms:performance.now()-q.inicio,utc:Date.now(),x:ev.clientX,y:ev.clientY,tipo:ev.pointerType,target:b?{id:b.id,nombre:b.getAttribute('aria-label')||b.title||b.textContent,datos:{...b.dataset}}:{texto:ev.target.textContent?.slice(0,80),offset:ev.target.dataset?.a},seleccion:c&&[c.selectionStart,c.selectionEnd]});m.style.left=ev.clientX+'px';m.style.top=ev.clientY+'px';m.style.display='block';},true);
  },{titulo});
  await p.cdp('Page.enable'); await p.events();
  await p.cdp('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:1366,maxHeight:900,everyNthFrame:1});
  let stop=false, pumpError=null; const frames=[];
  const pump=(async()=>{try{while(!stop){const evs=await p.events();for(const ev of evs){if(ev.method!=='Page.screencastFrame')continue;const f=ev.params;const archivo=join(framesDir,`${String(frames.length).padStart(6,'0')}.jpg`);await writeFile(archivo,Buffer.from(f.data,'base64'));frames.push({archivo,timestamp:f.metadata.timestamp,recibido:Date.now(),metadata:f.metadata});await p.cdp('Page.screencastFrameAck',{sessionId:f.sessionId});}await pausa(35);}}catch(e){pumpError=String(e);}})();
  const pasos=[];
  const rotulo=async texto=>{await p.evaluate(texto=>{document.querySelector('#qa-video-paso').textContent=texto;},texto);pasos.push({texto,utc:Date.now(),estado:await estado(p)});};
  let resultado, errorAcciones=null;
  try { await pausa(900); resultado=await acciones({rotulo,esperar:pausa}); await pausa(800); }
  catch(e){errorAcciones=String(e);}
  await p.cdp('Page.stopScreencast');await pausa(120);stop=true;await pump;
  const inputs=await p.evaluate(()=>window.__qaVideo);
  if(pumpError)throw new Error(pumpError);if(errorAcciones)throw new Error(errorAcciones);if(frames.length<3)throw new Error('Captura insuficiente: '+frames.length+' frames');
  const primero=frames[0].timestamp;
  const lines=['ffconcat version 1.0'];
  for(let i=0;i<frames.length;i++){lines.push("file '"+frames[i].archivo.replaceAll("'","'\\''")+"'");lines.push('duration '+(i+1<frames.length?Math.max(.001,frames[i+1].timestamp-frames[i].timestamp):.1).toFixed(6));}
  lines.push("file '"+frames.at(-1).archivo.replaceAll("'","'\\''")+"'");const concat=join(framesDir,'frames.ffconcat');await writeFile(concat,lines.join('\n')+'\n');
  const video=join(salida,id+'.mp4');const proceso=spawnSync('/opt/homebrew/bin/ffmpeg',['-y','-hide_banner','-loglevel','error','-safe','0','-f','concat','-i',concat,'-vf','fps=30,pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',video],{encoding:'utf8'});
  if(proceso.status!==0)throw new Error(proceso.stderr);
  const info=JSON.parse(spawnSync('/opt/homebrew/bin/ffprobe',['-v','error','-show_streams','-show_format','-of','json',video],{encoding:'utf8'}).stdout);
  const log={id,titulo,metodo:'CDP Page.startScreencast; JPEG reales, tiempos originales; MP4 30 fps con duplicados. HUD y marcador QA superpuestos.',video,resultado,pasos,inputs,frames:frames.map(({archivo,...f})=>({...f,archivo:archivo.slice(raw.length+1)})),captura:{frames:frames.length,duracion:frames.at(-1).timestamp-primero,intervaloMax:Math.max(...frames.slice(1).map((f,i)=>f.timestamp-frames[i].timestamp))},ffprobe:info,sha256:createHash('sha256').update(await readFile(video)).digest('hex')};
  await writeFile(join(salida,id+'.json'),JSON.stringify(log,null,2)+'\n');
  await p.screenshot({path:join(salida,id+'-final.png')});
  return {id,video,resultado,frames:frames.length,duracion:info.format.duration,sha256:log.sha256};
}
export async function grabarSeleccion(p, movil=false) {
  const caso=await fuente(4),original=caso.objetivo.codigo;await preparar(p,original,movil);
  const ficha=movil?'autoTarget':'console', selector=movil?'#bloques-texto span[data-a="29"]':'#bloques-texto span:text-is("console")', boton=movil?'#paleta button[data-i="9"]':'#paleta button[data-i="10"]', nombre=movil?'Disparo':'Ráfaga', prefijo=movil?'regularShoot(while':'burstFire(while';
  return grabar(p,movil?'01b-seleccion-movil':'01a-seleccion-pc','WAR-SEL-01 · '+(movil?'móvil emulado':'PC')+' · selección pendiente',async({rotulo,esperar})=>{
    await rotulo('1. Seleccionar while: el bloque completo queda elegido.');await p.click('#bloques-texto span[data-a="0"]');await esperar(850);
    await rotulo('2. Clic en '+ficha+' → '+nombre+' en menos de 380 ms.');await esperar(700);
    await p.click(selector);await p.click(boton);await esperar(550);
    const rapido=await estado(p);await rotulo(rapido.codigo.startsWith(prefijo)?'3. Resultado rápido: '+nombre+' envuelve el while anterior.':'3. El fallo de selección no se reprodujo en esta toma.');await esperar(2200);
    await rotulo('4. Deshacer: recuperar el texto original.');await p.click('#edicion [data-accion="deshacer"]');await esperar(650);const recuperado=(await estado(p)).codigo===original;await esperar(1100);
    await rotulo('5. Control: seleccionar while; después '+ficha+' + pausa 450 ms.');await p.click('#bloques-texto span[data-a="0"]');await esperar(700);
    await p.click(selector);await esperar(450);await p.click(boton);await esperar(550);const pausado=await estado(p);
    await rotulo(pausado.codigo.startsWith(prefijo)?'6. El control también envolvió el while: revisar la traza.':'6. Control pausado: el botón usa '+ficha+', no todo el while.');await esperar(2300);
    await p.click('#edicion [data-accion="deshacer"]');await esperar(500);
    return {rapidoEnvuelveWhile:rapido.codigo.startsWith(prefijo),recuperado,pausadoEnvuelveWhile:pausado.codigo.startsWith(prefijo),rapido,pausado};
  });
}
export async function grabarResiduos(p) {
  const c1=await fuente(1),c2=await fuente(2),c3=await fuente(3);
  await preparar(p,c1.trasPerturbacion.codigo);
  return grabar(p,'02-borrado-residuos','WAR-EDIT-02 · fricción de borrado, sin bug confirmado',async({rotulo,esperar})=>{
    const resultados=[];
    await rotulo('1. Caso ?? · seleccionar el comentario /* valor */ y Borrar.');await esperar(1400);await p.click('#bloques-texto span.com');await esperar(500);await p.click('#edicion [data-accion="borrar"]');await esperar(600);resultados.push(await estado(p));await rotulo('Queda ?? sin operando. Borrar el hueco no quita el operador.');await esperar(2200);await p.click('#edicion [data-accion="deshacer"]');await esperar(800);
    // Preparación de cada capítulo visible; fuera de recuperación, sin fingir Deshacer de una inserción no filmada.
    await rotulo('2. Preparar otro caso guardado: Variable antepuesta al while.');await p.click('#b-teclado');await p.fill('#codigo',c2.trasPerturbacion.codigo);await p.click('#b-teclado');await esperar(1100);
    await rotulo('Seleccionar pos del prefijo const pos = y Borrar.');await p.click('#bloques-texto span[data-a="6"]');await esperar(500);await p.click('#edicion [data-accion="borrar"]');await esperar(600);resultados.push(await estado(p));await rotulo('Queda const = while. Deshacer restaura el borrado local.');await esperar(2200);await p.click('#edicion [data-accion="deshacer"]');await esperar(800);
    await rotulo('3. Preparar caso guardado: stopFire(); añadido en línea 2.');await p.click('#b-teclado');await p.fill('#codigo',c3.trasPerturbacion.codigo);await p.click('#b-teclado');await esperar(1100);
    await p.click('#bloques-texto span[data-a="17"]');await esperar(500);await rotulo('Ampliar una vez → Borrar la llamada.');await p.click('#edicion [data-accion="ampliar"]');await p.click('#edicion [data-accion="borrar"]');await esperar(600);resultados.push(await estado(p));await rotulo('Queda ; y una línea residual. No demuestra un bug de Borrar.');await esperar(2400);await p.click('#edicion [data-accion="deshacer"]');await esperar(700);
    return {casos:resultados};
  });
}
export async function grabarVistaMovil(p) {
  const c=await fuente(4);await preparar(p,c.objetivo.codigo,true);
  // Preferencia de coordenadas que estaba activa durante la tanda original.
  await p.click('#b-ajustes');if(!await p.evaluate(()=>document.querySelector('#ajustes-coordenadas').checked))await p.click('#ajustes-coordenadas');await p.click('#ajustes-cerrar');
  await p.mouse.move(240,750,{label:'preparar comienzo del editor'});await p.mouse.wheel(0,-900,{label:'volver al comienzo del programa'});
  return grabar(p,'03-espacio-movil','WAR-VIEW-03 · espacio de edición condicionado por preferencias',async({rotulo,esperar})=>{
    await rotulo('1. 393 × 852: herramientas abiertas; pocas líneas visibles.');await esperar(2600);
    const antes=await p.evaluate(()=>({editor:document.querySelector('#bloques').getBoundingClientRect().toJSON(),barra:document.querySelector('#b-barras').getAttribute('aria-expanded')}));
    await rotulo('2. Plegar herramientas para recuperar espacio de código.');await p.click('#b-barras');await esperar(1300);
    const despues=await p.evaluate(()=>({editor:document.querySelector('#bloques').getBoundingClientRect().toJSON(),barra:document.querySelector('#b-barras').getAttribute('aria-expanded')}));await esperar(2600);
    await rotulo('3. Desplazar el editor: volver a las líneas finales.');await p.mouse.move(240,710,{label:'señalar editor para desplazar'});await p.mouse.wheel(0,510,{label:'mostrar final del programa'});await esperar(2300);
    return {antes,despues};
  });
}
