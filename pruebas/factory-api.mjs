import assert from 'node:assert/strict';
export async function probarFactoryAPI(page) {
  await page.goto('http://127.0.0.1:8771/Prototypes/Rocket%20Launcher/?serie=factory');
  await page.waitForFunction(()=>!!window.__banco);
  await page.cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
  const casos = [
    ['sin prefijo', 'for(let i=0;i<3;i++){await recoger("ENT-1","cobre");await entregar("FUN");}'],
    ['máquinas reutilizables', 'const origen=ENT_1;const destino=FUN;for(let i=0;i<3;i++){await yo.recoger(origen,"cobre");await yo.entregar(destino);}'],
    ['inglés', 'while(count(ENT_1,"cobre")>0){await pickUp(ENT_1,"cobre");await deliver(FUN);}'],
    ['inglés con yo', 'for(let i=0;i<3;i++){await yo.pickUp(ENT_1,"cobre");await yo.deliver(FUN);}'],
    ['lecturas y función local', 'function count(){return 3;} if(yo.count("FALTA","cobre")!==null || yo.count(ENT_1,"silicio")!==0) throw Error("lectura");for(let i=0;i<count();i++){await pickUp(ENT_1,"cobre");await deliver(FUN);}'],
    ['método local', 'const datos={count(){return 3;}};for(let i=0;i<datos.count();i++){await pickUp(ENT_1,"cobre");await deliver(FUN);}'],
    ['await en lectura', 'while(await yo.cuantos("ENT-1","cobre")>0){await recoger("ENT-1","cobre");await entregar("FUN");}'],
  ];
  try {
    for(const [nombre,codigo] of casos){
      await page.evaluate(code=>{const b=window.__banco;b.elegirReto(0);b.programas.R1=code;b.abrirPrograma('R1');b.turbo(20);b.ejecutar();},codigo);
      await page.waitForFunction(()=>!!window.__banco.mundo.fin,undefined,{timeout:15000});
      const r=await page.evaluate(()=>({fin:__banco.mundo.fin,t:__banco.mundo.t,ultimo:__banco.telemetria.at(-1)}));
      assert.equal(r.fin,'victoria',nombre+JSON.stringify(r.ultimo));assert(Math.abs(r.t-8.7)<1e-9,nombre);
      console.log('OK API: '+nombre);
    }
  } finally {await page.cdp('Emulation.setFocusEmulationEnabled',{enabled:false});}
  return casos.length;
}
