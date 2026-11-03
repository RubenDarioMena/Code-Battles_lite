// Adaptación de factory-editor.mjs a las herramientas compartidas de la aplicación común.
import assert from 'node:assert/strict';
export async function probarFactoryEditorComun(page) {
  let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);console.log(`OK editor ${++checks}: ${msg}`);};
  const url='http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?serie=factory&forma=escritorio';
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false});
  await page.goto(url);await page.waitForFunction(()=>!!window.cmg?.seudo);
  await page.evaluate(()=>{__banco.elegirReto(0);cmg.seudo.aplicarModo('js');cmg.edicion.activar(false);});
  await page.fill('#codigo','await deliver(FUN);');
  await page.click('[data-modo-codigo="bloques"] >> nth=0');
  eq(await page.evaluate(()=>[...document.querySelectorAll('#paleta-seudo [data-ladrillo]')].map(x=>x.dataset.ladrillo)),['recoger','entregar','repetir'],'ladrillos por reto');
  await page.click('#paleta-seudo [data-ladrillo="recoger"]');
  eq(await page.evaluate(()=>cmg.seudo.modelo.cuerpo.length),2,'insertar bloque actualiza el árbol');
  eq(await page.evaluate(()=>cmg.codigo.value.includes('await pickUp(ENT_1, "cobre");')),true,'el bloque escribe JS con referencia a máquina');
  await page.click('#edicion [data-accion="deshacer"]');
  eq(await page.evaluate(()=>cmg.codigo.value),'await deliver(FUN);','deshacer recupera texto exacto');
  await page.click('#edicion [data-accion="rehacer"]');
  eq(await page.evaluate(()=>cmg.seudo.modelo.cuerpo.length),2,'rehacer recupera árbol');
  await page.click('#prog .fila.simple >> nth=0');await page.click('#edicion [data-accion="copiar"]');
  await page.click('[data-modo-codigo="pseudo"] >> nth=0');await page.click('#edicion [data-accion="pegar"]');
  eq(await page.evaluate(()=>cmg.seudo.modelo.cuerpo.length),3,'copiar y pegar entre vistas');
  await page.click('#edicion [data-accion="cortar"]');
  eq(await page.evaluate(()=>cmg.seudo.modelo.cuerpo.length),2,'cortar bloque');
  await page.click('#edicion [data-accion="deshacer"]');
  eq(await page.evaluate(()=>cmg.seudo.modelo.cuerpo.length),3,'deshacer corte');
  await page.click('#prog [data-campo="lugar"] >> nth=0');
  await page.click('.sugerencias:not([hidden]) [data-i="0"]');
  eq(await page.evaluate(()=>cmg.codigo.value.includes('deliver(ENT_1)')),true,'editar destino desde sus opciones');
  await page.click('[data-modo-codigo="js"] >> nth=0');
  await page.fill('#codigo','');await page.click('#b-teclado');
  await page.click('#paleta [data-i="5"]');
  await page.waitForSelector('.sugerencias:not([hidden]) .sug[data-i]');
  eq(await page.evaluate(()=>document.querySelector('.sugerencias:not([hidden])').textContent.includes('ENT_1')),true,'sugerencias del robot sin teclado');
  await page.click('.sugerencias:not([hidden]) .sug[data-i="0"]');
  await page.waitForFunction(()=>document.querySelector('.sugerencias:not([hidden])')?.textContent.includes('material'));
  await page.click('.sugerencias:not([hidden]) .sug[data-i="0"]');
  eq(await page.evaluate(()=>cmg.codigo.value),'await pickUp(ENT_1, "cobre");','rellena lugar y material');
  eq(await page.evaluate(()=>document.activeElement!==cmg.codigo),true,'no abre teclado al elegir valores');
  await page.click('#edicion [data-accion="deshacer"]');await page.click('#edicion [data-accion="rehacer"]');
  eq(await page.evaluate(()=>cmg.codigo.value),'await pickUp(ENT_1, "cobre");','historial de edición sin teclado');
  await page.evaluate(()=>cmg.edicion.activar(false));
  await page.fill('#codigo','await wait(2);');
  await page.evaluate(()=>{__banco.elegirReto(1);__banco.elegirReto(0);});
  eq(await page.evaluate(()=>cmg.codigo.value),'await wait(2);','cambio inmediato de reto conserva texto');
  await page.click('[data-modo-codigo="bloques"] >> nth=0');
  await page.reload();await page.waitForFunction(()=>!!window.cmg?.seudo);
  eq(await page.evaluate(()=>[document.querySelector('#app').dataset.modo,cmg.codigo.value]),['bloques','await wait(2);'],'persisten modo por serie y JS');
  // Arrastre real de ratón y táctil emulado, heredado del editor común.
  for(const tactil of [false,true]) {
    const antes=await page.evaluate(()=>cmg.seudo.modelo.cuerpo.length);
    const pts=await page.evaluate(()=>{const a=document.querySelector('#paleta-seudo [data-ladrillo="recoger"]').getBoundingClientRect(),b=document.querySelector('#prog').getBoundingClientRect();return {ax:a.x+a.width/2,ay:a.y+a.height/2,bx:b.x+80,by:b.y+b.height-25};});
    if(tactil){
      await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
      for(const [type,x,y] of [['touchStart',pts.ax,pts.ay],['touchMove',pts.ax,pts.ay+24],['touchMove',pts.bx,pts.by],['touchEnd',0,0]]) await page.cdp('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
      await page.cdp('Emulation.setTouchEmulationEnabled',{enabled:false});
    }
    else{await page.mouse.move(pts.ax,pts.ay);await page.mouse.down();await page.mouse.move(pts.bx,pts.by,{steps:12});await page.mouse.up();}
    eq(await page.evaluate(()=>cmg.seudo.modelo.cuerpo.length),antes+1,`arrastre ${tactil?'táctil emulado':'ratón'}`);
  }
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await page.goto(url.replace('escritorio','movil'));await page.waitForFunction(()=>!!window.cmg?.seudo);
  eq(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),true,'móvil sin desborde horizontal');
  return checks;
}
