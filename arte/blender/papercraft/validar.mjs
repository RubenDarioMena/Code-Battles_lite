// Ejecutar con Node desde cualquier directorio.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const base = path.dirname(fileURLToPath(import.meta.url));
const leer = ruta => fs.readFileSync(path.join(base, ruta));
const json = ruta => JSON.parse(leer(ruta));
const listar = ruta => fs.readdirSync(path.join(base, ruta)).sort();
const mapa = json('mapa-ampliado.json');
const sitios = json('colocaciones.json');
assert.deepEqual(mapa.metros, [400,208]);
assert.deepEqual(mapa.trozos, [4,4]);
for (const pol of Object.values(mapa.zonas)) assert.deepEqual(pol.at(-1), pol[0]);
const kit = listar('glb/kit');
const terreno = listar('glb/mapa');
assert.equal(terreno.length, 16);
for (const p of sitios) {
  assert(kit.includes(p.pieza + '.glb'));
  assert([p.x,p.y,p.z,p.giro,p.escala].every(Number.isFinite));
  assert(p.x >= 0 && p.x <= 400 && p.y >= 0 && p.y <= 208 && p.escala > 0);
}

let triangulos = 0, maximo = 0, maximoKit = 0, bytes = 0;
function medirColor(binario, g, indice, cantidad) {
  const a = g.accessors[indice];
  const vista = g.bufferViews[a.bufferView];
  assert.equal(a.count, cantidad);
  assert(['VEC3','VEC4'].includes(a.type));
  const formato = {
    5121: [1, 255, 'readUInt8'],
    5123: [2, 65535, 'readUInt16LE'],
    5126: [4, 1, 'readFloatLE']
  }[a.componentType];
  assert(formato && (a.componentType === 5126 || a.normalized));
  const [bytes, divisor, leerCanal] = formato;
  const paso = vista.byteStride ?? bytes * Number(a.type.at(-1));
  const inicio = (vista.byteOffset ?? 0) + (a.byteOffset ?? 0);
  let primero, variado = false, suma = 0;
  for (let i = 0; i < cantidad; i++) {
    const rgb = [0,1,2].map(c => binario[leerCanal](inicio+i*paso+c*bytes)/divisor);
    primero ??= rgb;
    variado ||= rgb.some((v,c) => v !== primero[c]);
    suma += .2126*rgb[0] + .7152*rgb[1] + .0722*rgb[2];
  }
  return {variado, media:suma/cantidad};
}
function inspeccionar(ruta) {
  const b = leer(ruta);
  bytes += b.length;
  assert.equal(b.toString('ascii',0,4),'glTF');
  assert.equal(b.readUInt32LE(4),2);
  assert.equal(b.readUInt32LE(8),b.length);
  assert.equal(b.toString('ascii',16,20),'JSON');
  const fin = 20 + b.readUInt32LE(12);
  const g = JSON.parse(b.subarray(20,fin));
  assert.equal(g.asset.version,'2.0');
  assert.equal(b.readUInt32LE(fin+4),0x004e4942);
  assert.equal(fin+8+b.readUInt32LE(fin),b.length);
  assert.equal(g.buffers.length,1);
  assert(g.buffers[0].byteLength <= b.length-fin-8);
  for (const v of g.bufferViews) {
    assert.equal(v.buffer,0);
    assert((v.byteOffset || 0)+v.byteLength <= g.buffers[0].byteLength);
  }
  assert.equal(g.meshes.length,1);
  assert.equal(g.nodes.length,1);
  assert.equal(g.meshes[0].primitives.length,1);
  const prim = g.meshes[0].primitives[0];
  const mat = g.materials[prim.material];
  assert(mat.normalTexture && mat.pbrMetallicRoughness.baseColorTexture);
  for (const imagen of g.images) {
    const png = leer(path.join(path.dirname(ruta),imagen.uri));
    assert.equal(png.readUInt32BE(16),1024);
    assert.equal(png.readUInt32BE(20),1024);

  }
  for (const atr of ['COLOR_0','COLOR_1','NORMAL','POSITION','TEXCOORD_0']) assert(atr in prim.attributes);
  const pos = g.accessors[prim.attributes.POSITION];
  const binario = b.subarray(fin+8);
  const visible = medirColor(binario,g,prim.attributes.COLOR_0,pos.count);
  const limpio = medirColor(binario,g,prim.attributes.COLOR_1,pos.count);
  assert(visible.variado,ruta+' tiene COLOR_0 uniforme');
  assert(visible.media < limpio.media,ruta+' requiere luminancia media de COLOR_0 inferior a COLOR_1');
  const n = g.accessors[prim.indices].count/3;
  assert(Number.isInteger(n) && n>0);
  return {n,pos};
}
for (const f of kit) {
  const {n,pos} = inspeccionar('glb/kit/'+f);
  assert.equal(pos.min[1],0);
  assert(n<=1500,f);
  maximoKit = Math.max(maximoKit,n);
}
for (let y=0;y<4;y++) for (let x=0;x<4;x++) {
  const {n,pos} = inspeccionar('glb/mapa/terreno-'+y+'-'+x+'.glb');
  assert.deepEqual([pos.min[0],pos.min[2],pos.max[0],pos.max[2]],[x*100,y*52,(x+1)*100,(y+1)*52]);
  assert(n<=10000);
  triangulos += n;
  maximo = Math.max(maximo,n);
}
assert(triangulos<=150000 && bytes<=25e6);
assert(leer('kit.blend').length<=20e6);
const html = leer('visor/index.html').toString();
const imports = JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/s)[1]).imports;
const visitados = new Set();
function modulo(ruta) {
  if (visitados.has(ruta)) return;
  visitados.add(ruta);
  const codigo = leer(ruta).toString();
  const lector = "const s=require('node:fs').readFileSync(0,'utf8');"+
    "console.log(JSON.stringify(new (require('node:vm').SourceTextModule)(s).dependencySpecifiers))";
  const prueba = spawnSync(process.execPath,['--experimental-vm-modules','-e',lector],{input:codigo});
  assert.equal(prueba.status,0,prueba.stderr.toString());
  for (const spec of JSON.parse(prueba.stdout)) {
    modulo(imports[spec] ? path.join('visor',imports[spec]) : path.join(path.dirname(ruta),spec));
  }
}
modulo(path.join('visor',html.match(/type="module" src="([^"]+)"/)[1]));
assert.equal(visitados.size,6);
assert(listar('previas').length<=6);
for (const f of listar('previas')) assert.equal(leer('previas/'+f).readUInt16BE(),0xffd8);
function peso(carpeta) {
  return fs.readdirSync(carpeta,{withFileTypes:true}).reduce((s,f)=>{
    const ruta = path.join(carpeta,f.name);
    return s+(f.isDirectory()?peso(ruta):fs.statSync(ruta).size);
  },0);
}
const carpeta = peso(base);
assert(carpeta<=60e6);
console.log({piezas:kit.length,colocaciones:sitios.length,trozos:terreno.length,triangulos,
  maximoPorTrozo:maximo,maximoPorPieza:maximoKit,bytesGLB:bytes,bytesBlend:leer('kit.blend').length,bytesCarpeta:carpeta});
