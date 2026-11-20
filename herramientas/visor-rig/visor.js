import { cargar, crearEscena } from './escena.js';

const q=new URLSearchParams(location.search), captura=q.has('captura');
document.body.classList.toggle('captura',captura);
const el=id=>document.getElementById(id);
const t=k=>window.CMGI18n.t('rig.'+k);
const maquina=el('maquina'), nivel=el('nivel'), muestra=el('muestra'), boton=el('bucle');
const nombres={vehiculo:'vehiculo_tubular',VehiculoTubular:'vehiculo_tubular',torreta:'torreta_observacion',
  TorretaObservacion:'torreta_observacion',RobotTransporte:'t1'};
const inicial=q.get('maquina');
if (inicial) maquina.value=nombres[inicial]??inicial;
if (!maquina.value) maquina.selectedIndex=0;
nivel.value='L'+(q.get('nivel')??'0').replace(/^L/i,'');
if (!nivel.value) nivel.selectedIndex=0;
let escena,modelo,vista,datos,valores,sliders=[],peticion=0,animacion=0,inicio=0,cuadro=0;
function detener() {
  cancelAnimationFrame(animacion); animacion=0; boton.textContent=t('reproducir');
}
function sincronizar() {
  for (const {c,input,out} of sliders) {
    input.value=String(valores[c.nombre]);
    out.textContent=valores[c.nombre].toFixed(3)+' '+c.unidad;
  }
}
function posar() {
  const ref=muestra.value===''?null:modelo.muestras[Number(muestra.value)];
  vista.adaptador.aplicar(valores);
  const errores=vista.referencia(ref);
  el('informe').hidden=!ref;
  if (ref) {
    el('peor').textContent=errores[0][0]+' · '+errores[0][1].toExponential(3);
    el('errores').replaceChildren(...errores.flatMap(([k,e])=>{
      const nombre=document.createElement('dt'), valor=document.createElement('dd');
      nombre.textContent=k; valor.textContent=e.toExponential(3);
      return [nombre,valor];
    }));
  }
  sincronizar(); escena.dibujar();
}
function seleccionarMuestra() {
  detener(); cuadro=0;
  if (muestra.value!=='') Object.assign(valores,modelo.muestras[Number(muestra.value)].controles);
  posar();
}
function panel() {
  valores={}; sliders=[];
  const filas=datos.controles.map(c=>{
    const label=document.createElement('label'), out=document.createElement('output'), input=document.createElement('input');
    input.type='range'; input.min=String(c.ciclico?-2*Math.PI:(c.min??c.reposo-1));
    input.max=String(c.ciclico?2*Math.PI:(c.max??c.reposo+1)); input.step='any';
    input.addEventListener('input',()=>{
      detener(); cuadro=0; muestra.value=''; valores[c.nombre]=input.valueAsNumber; posar();
    });
    valores[c.nombre]=c.reposo; sliders.push({c,input,out}); label.append(c.nombre,out,input);
    return label;
  });
  el('controles').replaceChildren(...filas);
  boton.hidden=!datos.bucle;
  el('referencias').hidden=!modelo.muestras.length;
  muestra.replaceChildren(new Option(t('manual'),''),...modelo.muestras.map((_,i)=>new Option(String(i),String(i))));
}
async function seleccionar(indice='') {
  const id=++peticion;
  detener(); cuadro=0;
  document.body.dataset.listo='false'; el('estado').textContent=t('cargando');
  try {
    const recurso=await cargar(maquina.value);
    if (id!==peticion) return;
    modelo=recurso;
    const n=nivel.selectedIndex;
    datos=modelo.rig.niveles[n]; vista=escena.seleccionar(modelo,n);
    panel(); muestra.value=indice;
    if (muestra.selectedIndex<0) muestra.selectedIndex=0;
    seleccionarMuestra(); el('estado').textContent='';
    document.body.dataset.listo='true';
  } catch (e) { if (id===peticion) fallo(e); }
}
function tick(ahora) {
  const {fps,cuadros,claves}=datos.bucle;
  cuadro=((ahora-inicio)*fps/1000)%cuadros;
  const frame=claves[0].cuadro+cuadro;
  let i=1;
  while (i<claves.length-1 && claves[i].cuadro<frame) i++;
  const a=claves[i-1], b=claves[i], f=(frame-a.cuadro)/(b.cuadro-a.cuadro);
  for (const c of datos.controles) valores[c.nombre]=a[c.nombre]+f*(b[c.nombre]-a[c.nombre]);
  posar(); animacion=requestAnimationFrame(tick);
}
boton.onclick=()=>{
  if (animacion) { detener(); return; }
  muestra.value=''; boton.textContent=t('pausar');
  inicio=performance.now()-cuadro*1000/datos.bucle.fps;
  animacion=requestAnimationFrame(tick);
};
maquina.onchange=()=>seleccionar();
nivel.onchange=()=>seleccionar(muestra.value);
muestra.onchange=seleccionarMuestra;
function fallo(e) {
  el('estado').textContent=window.CMGI18n.t('rig.fallo',{detalle:e.message});
  console.error(e);
}
try {
  escena=crearEscena(document.querySelector('canvas'),captura);
  seleccionar(q.get('muestra')??'');
} catch (e) { fallo(e); }
