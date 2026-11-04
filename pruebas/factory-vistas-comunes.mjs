// Adaptación de tres-vistas.mjs al editor/runtime común. Solo origen de QA.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export async function probarFactoryVistas(page) {
  const origen='http://127.0.0.1:8771', url=origen+'/Prototypes/Rocket%20Launcher/?serie=factory&forma=escritorio';
  const fixture=JSON.parse(await readFile(new URL('./factory-oraculo.json',import.meta.url),'utf8'));
  const deltas=JSON.parse(await readFile(new URL('./factory-deltas.json',import.meta.url),'utf8'));
  let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);console.log(`OK vistas ${++checks}: ${msg}`);};
  await page.goto(origen);
  const backup=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>/^(cmg-banco0[23]:|cmg-juego-factory-)/.test(k))));
  await page.cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:1400,height:900,deviceScaleFactor:1,mobile:false});
  try {
    await page.goto(url);await page.waitForFunction(()=>!!window.cmg?.seudo);
    await page.evaluate(()=>{cmg.edicion.activar(false);cmg.seudo.aplicarModo('js');});
    for(let i=0;i<6;i++) {
      const inicial=await page.evaluate(i=>{__banco.elegirReto(i);return __banco.def.inicial.R1.join('\n')+'\n';},i);
      eq(await page.evaluate(code=>{const s=cmg.seudo;return s.generar(s.parsear(code)).codigo;},inicial),inicial,`inicial ${i+1}: ida y vuelta exacta`);
      const c=fixture.casos.find(c=>c.id===`reto-${i}-victoria`), esperado=deltas.casos[c.id]?.cambios.t??c.resultado.t;
      for(const modo of ['bloques','pseudo','js']) {
        await page.evaluate(({i,codigo,modo})=>{const b=__banco;b.elegirReto(i);b.programas.R1=codigo;b.abrirPrograma('R1');cmg.seudo.aplicarModo(modo);b.turbo(20);b.ejecutar();},{i,codigo:c.codigo,modo});
        await page.waitForFunction(()=>!!__banco.mundo.fin,undefined,{timeout:15000});
        const actual=await page.evaluate(()=>({fin:__banco.mundo.fin,t:__banco.mundo.t,modo:document.querySelector('#app').dataset.modo}));
        // Hasta vaciar cambia stock por intento: el mismo programa se prueba con su cantidad vigente.
        const t=i===4?2.9*(await page.evaluate(()=>__banco.mundo.stockOculto)):esperado;
        eq([actual.fin,Math.abs(actual.t-t)<1e-9,actual.modo],['victoria',true,modo],`reto ${i+1}: ${modo}, tiempo y metas`);
      }
    }
    // Guardado antiguo: manda el árbol si fuente=modelo o es el inicial comentado.
    const modelo={t:'programa',cuerpo:[{t:'repetir',n:3,cuerpo:[{t:'recoger',origen:'ENT-1',mat:'cobre'},{t:'entregar',destino:'FUN'}]}]};
    for(const fuente of ['modelo','texto']) {
      await page.goto(origen);
      await page.evaluate(({modelo,fuente})=>{
        localStorage.setItem('cmg-banco02:prog-0',JSON.stringify({modelo,fuente,texto:'// inicial comentado',comentado:fuente==='texto'?'// inicial comentado':null}));
        localStorage.removeItem('cmg-banco03:prog-factory-0');localStorage.setItem('cmg-banco03:factory-reto','0');
      },{modelo,fuente});
      await page.goto(url);await page.waitForFunction(()=>!!window.cmg?.seudo);
      eq(await page.evaluate(()=>cmg.codigo.value.includes('for (let i = 0; i < 3; i++)')&&!cmg.codigo.value.startsWith('//')),true,`importa ${fuente} con modelo activo`);
      await page.evaluate(()=>{__banco.turbo(20);__banco.ejecutar();});await page.waitForFunction(()=>!!__banco.mundo.fin);
      eq(await page.evaluate(()=>[__banco.mundo.fin,Math.round(__banco.mundo.t*10)]),['victoria',87],`importado ${fuente}: resultado`);
    }
    await page.goto(origen);
    await page.evaluate(()=>{localStorage.setItem('cmg-banco02:prog-0',JSON.stringify({fuente:'texto',texto:'await yo.esperar(2);'}));});
    await page.goto(url);await page.waitForFunction(()=>!!window.cmg?.seudo);
    eq(await page.evaluate(()=>cmg.codigo.value.includes('for (let i')),true,'la importación es única; no pisa el programa común');
    await page.evaluate(()=>{__banco.elegirReto(0);cmg.seudo.aplicarModo('js');});
    await page.fill('#codigo','const custom = () => 42;\nconsole.log(custom());');
    await page.selectOption('#sel-lenguaje', 'bloques');
    eq(await page.evaluate(()=>[document.querySelector('#app').dataset.modo,cmg.codigo.value]),['js','const custom = () => 42;\nconsole.log(custom());'],'programa no traducible conserva JS y vuelve a su vista');
    await page.click('#t-escenario');await page.click('#reto-copiar');
    await page.fill('#rf-titulo','Prueba común');await page.evaluate(()=>document.querySelector('#rf-guardar').scrollIntoView({block:'center'}));await page.click('#rf-guardar');
    eq(await page.evaluate(()=>[__banco.def.titulo,JSON.parse(localStorage.getItem('cmg-banco03:factory-propio')).titulo]),['Prueba común','Prueba común'],'Tu reto copia, edita y guarda');
    return checks;
  } finally {
    await page.goto(origen);
    await page.evaluate(data=>{for(const k of Object.keys(localStorage))if(/^(cmg-banco0[23]:|cmg-juego-factory-)/.test(k))localStorage.removeItem(k);for(const[k,v]of Object.entries(data))localStorage.setItem(k,v);},backup);
    await page.cdp('Emulation.setFocusEmulationEnabled',{enabled:false});
  }
}
