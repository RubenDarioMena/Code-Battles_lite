import assert from 'node:assert/strict';
export async function probarIdiomasPendientes(page, origen = 'http://127.0.0.1:8771') {
 let checks=0;
 const eq=(a,b,m)=>{assert.deepEqual(a,b,m);console.log(`OK idiomas pendientes ${++checks}: ${m}`);};
 const abrir=async serie=>{await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?serie=${serie}`);await page.waitForFunction(()=>window.__juegoListo);};
 for(const serie of ['war','factory']) {
  await abrir(serie);
  const base=await page.evaluate(()=>{CMGI18n.cambiarIdioma('es');const root=document.querySelector('#v-ayuda');window.__ayudaQA={root,nodos:[...root.querySelectorAll('*')],mundo:__banco.mundo};return {code:[...root.querySelectorAll('code,pre,[data-ins]')].map(n=>[n.textContent,n.dataset.ins]),fuentes:JSON.stringify(__banco.fuentes)};});
  eq(await page.evaluate(()=>{CMGI18n.cambiarIdioma('en');return document.querySelector('#v-ayuda h3').textContent;}),serie==='war'?'How to read the inspector':'Cargo robot',`${serie}: cabecera de ayuda inglesa`);
  eq(await page.evaluate(()=>{const q=__ayudaQA,r=document.querySelector('#v-ayuda');return [r===q.root,[...r.querySelectorAll('*')].every((n,i)=>n===q.nodos[i]),__banco.mundo===q.mundo,{code:[...r.querySelectorAll('code,pre,[data-ins]')].map(n=>[n.textContent,n.dataset.ins]),fuentes:JSON.stringify(__banco.fuentes)}];}),[true,true,true,base],`${serie}: ayuda conserva nodos, código insertable, programa y mundo`);
  eq(await page.evaluate(()=>{CMGI18n.cambiarIdioma('es');return document.querySelector('#v-ayuda h3').textContent;}),serie==='war'?'Cómo leer el inspector':'Robot de carga',`${serie}: ayuda vuelve a español`);
 }
 await abrir('war');
 await page.evaluate(()=>{CMGI18n.cambiarIdioma('en');document.querySelector('#b-info-reto').click();document.querySelector('#info-t-enemigos').click();});
 eq(await page.evaluate(()=>[document.querySelector('.enemigo-ficha h4').textContent.includes('Crawler'),document.querySelector('.enemigo-ficha img').alt]),[true,'Crawler model'],'ficha de enemigo: nombre y texto alternativo traducidos');
 eq(await page.evaluate(()=>{
  const hostile='<img src=x onerror=alert(1)>';
  const raw=`No hay ningún edificio "${hostile}". En este mapa hay FUN.`;
  const box=document.createElement('div');box.innerHTML=CMGPresentacion.html(raw.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'));
  return [box.textContent.includes('There is no building'),box.textContent.includes(hostile),!!box.querySelector('img')];
 }),[true,true,false],'diagnósticos traducen solo presentación y conservan parámetros hostiles como texto');
 eq(await page.evaluate(()=>{
  const source='autoTarget necesita el sensor como segundo argumento: "visual", "thermal". Recibió "error".';
  const r=CMGPresentacion.texto(source);
  return [r,'Mensaje libre del jugador'===CMGPresentacion.texto('Mensaje libre del jugador')];
 }),['autoTarget needs a sensor as its second argument: "visual", "thermal". Received "error".',true],'diagnóstico del Worker conserva nombres de API y valores');
 eq(await page.evaluate(()=>CMGPresentacion.texto('IndentationError: unexpected indent (sobra sangría al principio de la línea)')),
 'IndentationError: unexpected indent (extra indentation at the start of the line)','diagnóstico Python traducido sin cambiar el tipo de excepción');
 await page.evaluate(()=>{
  document.querySelector('#b-info-reto').click();
  __banco.elegirReto(0);__banco.programas['LAU-01']='console.log("Base intacta");\nregularShoot(null);';__banco.abrirPrograma('LAU-01');__banco.turbo(100);__banco.ejecutar();
 });
 await page.waitForFunction(()=>!!__banco.mundo.fin,{},{timeout:30000});
 eq(await page.evaluate(()=>[document.querySelector('#banner h2').textContent,document.querySelector('#banner .acciones button').textContent]),['Not yet','Edit program'],'fallo real de War presenta título y acción en inglés');
 eq(await page.evaluate(()=>document.querySelector('#consola').textContent.includes('Base intacta')),true,'console.log del jugador conserva su texto español');
 eq(await page.evaluate(()=>{
  const b=document.querySelector('#banner .acciones button'),telemetria=JSON.stringify(__banco.telemetria),m=__banco.mundo;b.focus();
  CMGI18n.cambiarIdioma('es');const es=document.querySelector('#banner h2').textContent;
  CMGI18n.cambiarIdioma('en');return [es,b===document.querySelector('#banner .acciones button'),document.activeElement===b,m===__banco.mundo,telemetria===JSON.stringify(__banco.telemetria),document.querySelector('#banner .stats').textContent.startsWith('Hint')];
 }),['Aún no',true,true,true,true,true],'aviso abierto conserva botones, foco, mundo, telemetría y pista al cambiar idioma');
 await abrir('factory');
 await page.evaluate(()=>{CMGI18n.cambiarIdioma('en');__banco.elegirReto(0);cmg.seudo.aplicarModo('js');__banco.programas.R1='for(let i=0;i<3;i++){await pickUp(ENT_1,"cobre");await deliver(FUN);}';__banco.abrirPrograma('R1');__banco.turbo(100);__banco.ejecutar();});
 await page.waitForFunction(()=>!!__banco.mundo.fin,{},{timeout:30000});
 eq(await page.evaluate(()=>[__banco.mundo.fin,document.querySelector('#banner h2').textContent,document.querySelector('#banner').textContent.includes('Everything delivered.'),document.querySelector('#banner .acciones button').textContent]),['victoria','Challenge completed',true,'Again'],'victoria real de Factory traduce resultado y acciones');
 eq(await page.evaluate(()=>{const b=document.querySelector('#banner .acciones button');CMGI18n.cambiarIdioma('es');return [document.querySelector('#banner h2').textContent,b.textContent];}),['Reto cumplido','Otra vez'],'victoria abierta vuelve al español sin reconstruir acciones');
 await page.evaluate(()=>{CMGI18n.cambiarIdioma('en');document.querySelector('#b-ajustes').click();document.querySelector('#ajustes-orden-barra').click();});
 eq(await page.evaluate(()=>[document.querySelector('#orden-titulo').textContent,document.querySelector('.orden-vacio').textContent]),['Editing bar','New group'],'diálogo de orden: título y grupo nuevo traducidos');
 eq(await page.evaluate(()=>{
  const grupos=[...document.querySelectorAll('.orden-grupo')],b=document.querySelector('.orden-btn'),ids=[...document.querySelectorAll('.orden-btn')].map(n=>n.dataset.id);
  CMGI18n.cambiarIdioma('es');CMGI18n.cambiarIdioma('en');
  return [grupos.every((g,i)=>g===document.querySelectorAll('.orden-grupo')[i]),b===document.querySelector('.orden-btn'),JSON.stringify(ids)===JSON.stringify([...document.querySelectorAll('.orden-btn')].map(n=>n.dataset.id))];
 }),[true,true,true],'ordenar: cambio de idioma conserva grupos, botones e identificadores');
 await page.evaluate(()=>{document.querySelector('#orden-barra').close();document.querySelector('#ajustes').close();cmg.aviso('Detén el programa para editarlo.');});
 eq(await page.evaluate(()=>{const e=document.querySelector('#aviso');const en=e.textContent;CMGI18n.cambiarIdioma('es');return [en,e.textContent];}),['Stop the program to edit it.','Detén el programa para editarlo.'],'aviso abierto del editor se actualiza en sitio');
 await page.evaluate(()=>CMGI18n.cambiarIdioma('en'));await page.goto(`${origen}/campaign/`);
 await page.waitForFunction(()=>!!window.CMGI18n);
 eq(await page.evaluate(()=>[document.documentElement.lang,document.querySelector('h1').textContent,document.querySelector('.volver').textContent]),['en','Coming soon.','← Back to home'],'anuncio Campaign respeta el idioma elegido');
 await page.goto(`${origen}/Prototypes/Rocket%20Launcher/probar.html?serie=factory`);
 await page.waitForFunction(()=>document.querySelectorAll('iframe').length===2);
 eq(await page.evaluate(()=>[document.title,document.querySelector('h1').textContent,document.querySelector('#girar').textContent,document.querySelector('#pc button').textContent]),['Factory · Device preview','Device preview','⟳ Rotate','Laptop'],'probador: controles y modelos de PC traducidos');
 eq(await page.evaluate(()=>{const frames=[...document.querySelectorAll('iframe')],source=frames.map(f=>f.src);CMGI18n.cambiarIdioma('es');return [frames.every((f,i)=>f===document.querySelectorAll('iframe')[i]&&f.src===source[i]),document.querySelector('#girar').textContent];}),[true,'⟳ Girar'],'probador: cambiar idioma conserva iframes y URL de cada juego');
 await page.goto(`${origen}/Prototypes/Rocket%20Launcher/?poc=1`);
 await page.waitForFunction(()=>window.__juegoListo && !!document.querySelector('.poc'));
 await page.evaluate(()=>CMGI18n.cambiarIdioma('en'));
 eq(await page.evaluate(()=>[document.querySelector('.poc summary').textContent,document.querySelector('.poc [data-v="no"]').textContent]),['Variants','No halo'],'selector experimental arranca y traduce sus controles');
 return checks;
}
