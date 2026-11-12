// Regresiones del estudio: tamaños, pinceles, precisión y pintura elevada persistente.
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const contexto = vm.createContext({window:{}});
for(const archivo of ['datos','malla','bloques']) vm.runInContext(readFileSync(`${__dirname}/../shared/terreno/${archivo}.js`,'utf8'),contexto);
const T=contexto.window.CMGTerreno, THREE=require('../shared/vendor/three-r128.min.js');
let n=0; const prueba=(nombre,fn)=>{try{fn();n++;}catch(e){e.message=nombre+': '+e.message;throw e;}};
const indice=(m,x,z)=>Math.round((z-m.origen.z)/m.paso)*m.columnas+Math.round((x-m.origen.x)/m.paso);
prueba('ampliar y recortar conservan las muestras originales, pesos, agua y bloques',()=>{
  const m=T.crear(); T.aplicar(m,{x:-8,z:-8,modo:'pintar',material:3}); T.aplicar(m,{x:-8,z:-8,modo:'agua'}); T.BLOQUES.crear(m,'caja');
  const grande=T.redimensionar(m,80,64), vuelta=T.redimensionar(grande,64,48);
  for(const k of ['alturas','pesos','agua','bloques']) assert.equal(JSON.stringify(vuelta[k]),JSON.stringify(m[k]));
  assert.equal(grande.alturas[0],0);assert.equal(grande.agua.mascara[0],0);assert.equal(grande.version,3);
  assert.equal(JSON.stringify(T.validar(JSON.parse(T.serializar(grande)))),T.serializar(grande));
});
prueba('resolución fina interpola y conserva muestras coincidentes',()=>{
 const m=T.crear(), fino=T.redimensionar(m,64,48,.25);
 assert.equal(fino.columnas,257);assert.equal(fino.filas,193);
 assert.equal(T.alturaEn(fino,-8,-8),T.alturaEn(m,-8,-8));
 assert.equal(T.alturaEn(fino,-8.25,-8.25),T.alturaEn(m,-8.25,-8.25));
 assert.doesNotThrow(()=>T.validar(fino));
});
prueba('presupuesto máximo usa índices de 32 bits sin truncar terreno ni agua',()=>{
 const m=T.redimensionar(T.crear({relieve:false}),128,128,.5);
 const g=T.crearGeometria(THREE,m);assert.equal(g.getAttribute('position').count,66049);
 assert.equal(g.index.array.BYTES_PER_ELEMENT,4);assert.equal(g.index.array[g.index.count-1],66048);
 m.agua.mascara.fill(1);const agua=T.crearGeometriaAgua(THREE,m);
 assert.equal(agua.index.array.BYTES_PER_ELEMENT,4);assert.equal(agua.index.array[agua.drawRange.count-1],66048);
 g.dispose();agua.dispose();
});
prueba('rechaza tamaños destructivos inválidos antes de mutar',()=>{
 const m=T.crear(), antes=T.serializar(m);
 for(const opciones of [[20,20,.5],[128,128,.25],[64,48,0],[NaN,48,.5]]) assert.throws(()=>T.redimensionar(m,...opciones));
 assert.equal(T.serializar(m),antes);
 for(const campo of ['columnas','filas','paso']) {const malo=JSON.parse(antes);malo.version=3;malo[campo]=Infinity;assert.throws(()=>T.validar(malo));}
});
prueba('inflar sigue la pendiente y detalle concentra la punta; inversión y protección',()=>{
 const subir=T.crear(), inflar=T.crear(), original=subir.alturas.slice();
 T.aplicar(subir,{x:-8,z:-10,modo:'subir',fuerza:1});T.aplicar(inflar,{x:-8,z:-10,modo:'inflar',fuerza:1});
 const i=indice(subir,-8,-10);assert.ok(inflar.alturas[i]>original[i]);assert.ok(inflar.alturas[i]<subir.alturas[i]);
 const m=T.crear({relieve:false});T.aplicar(m,{x:-8,z:-8,modo:'detalle',fuerza:1});
 assert.equal(m.alturas[indice(m,-8,-8)],1);assert.ok(m.alturas[indice(m,-7,-8)]<.1);
 T.aplicar(m,{x:-8,z:-8,modo:'detalle',fuerza:1,invertir:true});assert.equal(m.alturas[indice(m,-8,-8)],0);
 T.aplicar(m,{x:16,z:9,modo:'inflar',fuerza:1});assert.equal(m.alturas[indice(m,16,9)],0);
});
prueba('forma cuadrada cubre esquinas que el círculo excluye',()=>{
 const a=T.crear({relieve:false}),b=T.crear({relieve:false});
 T.aplicar(a,{x:-8,z:-8,radio:3,fuerza:1,forma:'cuadrado',dureza:.95});T.aplicar(b,{x:-8,z:-8,radio:3,fuerza:1});
 assert.equal(a.alturas[indice(a,-5.5,-5.5)],1);assert.equal(b.alturas[indice(b,-5.5,-5.5)],0);
});
prueba('punto preciso modifica una sola muestra y rechaza campo protegido',()=>{
 const m=T.crear({relieve:false});T.fijarAltura(m,-8.1,2.125,-8.1);
 assert.equal(m.alturas.filter(h=>h!==0).length,1);assert.equal(m.alturas[indice(m,-8,-8)],2.125);
 assert.throws(()=>T.fijarAltura(m,16,2,9));assert.throws(()=>T.fijarAltura(m,-200,2,9));
});
prueba('pintura de caras viaja por JSON, malla, extrusión y unión',()=>{
 const m=T.crear(),b=T.BLOQUES.crear(m,'caja');b.coloresCaras=new Array(b.indices.length/3).fill('#ff0000');b.coloresCaras[0]='#00ff00';
 const copia=T.validar(JSON.parse(T.serializar(m)));assert.equal(copia.bloques[0].coloresCaras[0],'#00ff00');
 const g=T.BLOQUES.geometria(THREE,b);assert.equal(g.getAttribute('color').getY(0),1);assert.equal(g.getAttribute('color').getX(3),1);g.dispose();
 assert.equal(T.BLOQUES.extruir(b,0,1),true);assert.equal(b.coloresCaras.length,b.indices.length/3);assert.equal(b.coloresCaras.at(-1),'#00ff00');
 const otro=T.BLOQUES.crear(m,'caja');T.BLOQUES.unir(THREE,m,[b.id,otro.id]);assert.equal(m.bloques[0].coloresCaras[0],'#00ff00');assert.equal(m.bloques[0].coloresCaras.at(-1),otro.color);
 assert.doesNotThrow(()=>T.validar(m));m.bloques[0].coloresCaras[0]='red';assert.throws(()=>T.validar(m));
});
console.log(`Estudio de terreno: ${n} regresiones correctas.`);
