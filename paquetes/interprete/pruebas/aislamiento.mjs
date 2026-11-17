import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { crearInterprete } from '../index.js';
const acorn = createRequire(import.meta.url)('../../../shared/vendor/acorn-8.11.3.js');
const e = crearInterprete({ acorn });
const vias = [
  '(function(){}).constructor', '(()=>{}).constructor', '[].map.constructor',
  'Object.getPrototypeOf(function(){}).constructor',
  'Object.getPrototypeOf(Object).constructor',
  'Reflect.get([].map,"constructor")',
  'Object.getOwnPropertyDescriptor(Object.getPrototypeOf(function(){}),"constructor").value',
  'Object.getOwnPropertyDescriptors(Object.getPrototypeOf(function(){})).constructor.value',
  'Reflect.getOwnPropertyDescriptor(Object.getPrototypeOf(function(){}),"constructor").value',
  'Object.getOwnPropertyDescriptor(Object.prototype,"__proto__").get.call(function(){}).constructor',
  'Reflect.getPrototypeOf(Reflect.apply).constructor',
  '(function(){}).bind(null).constructor', 'Object.constructor',
  'Reflect.get(globalThis,"Object").constructor',
  'Object.getOwnPropertyDescriptor(globalThis,"Object").value.constructor',
  'Object.getOwnPropertyDescriptors(globalThis).Array.value.constructor',
  'new Proxy(function(){},{}).constructor',
  '[...new Map().keys()].constructor.constructor',
];
let n=0;
for (const via of vias) {
  assert.equal(e.ejecutar(`${via}(${JSON.stringify('return typeof process+":"+typeof require+":"+typeof Date+":"+typeof eval')})()`), 'undefined:undefined:undefined:undefined', via);
  assert.equal(e.ejecutar(`${via}("return globalThis")()`), e.global, via); n+=2;
}
assert.equal(e.ejecutar('typeof Math.random'), 'undefined');
assert.equal(e.ejecutar('typeof process+typeof require+typeof performance'), 'undefinedundefinedundefined');
for (const codigo of ['import("x")','with({}){}','async function* f(){}']) {
  assert.throws(()=>e.ejecutar(codigo), /no soportada/); n++;
}
// Cada vía se compara con V8 sobre los mismos intrínsecos congelados, en modo estricto.
const congelar = `
  const vistos=new Set();function congelar(o){if(!o||!["object","function"].includes(typeof o)||vistos.has(o))return;vistos.add(o);
    congelar(Object.getPrototypeOf(o));for(const k of Reflect.ownKeys(o)){const d=Object.getOwnPropertyDescriptor(o,k);congelar(d.value);congelar(d.get);congelar(d.set)}Object.freeze(o);}
  for(const o of [Object,Function,Array,String,Number,Boolean,Map,Set,WeakMap,WeakSet,Proxy,Reflect,JSON,Math,RegExp,Error,TypeError,Symbol,
    Object.getPrototypeOf([][Symbol.iterator]()), Object.getPrototypeOf(new Map().keys()),Object.getPrototypeOf(new Set().keys()),Object.getPrototypeOf(''[Symbol.iterator]())])congelar(o);
`;
const objetivos = ['new Proxy(Array.prototype,{})','Proxy.revocable(Object.prototype,{}).proxy','Number.prototype','String.prototype','Boolean.prototype','Symbol.prototype','Map.prototype','Set.prototype','WeakMap.prototype','WeakSet.prototype','RegExp.prototype','Error.prototype','Reflect','Number','Boolean','Symbol','Map','Set','RegExp','Error','TypeError','Array.prototype','Object.prototype','Math','JSON','Object','Array',
  'Object.getPrototypeOf([])','Reflect.getPrototypeOf({})',
  'Object.getOwnPropertyDescriptor(Array,"prototype").value',
  'Object.getOwnPropertyDescriptors(Object).prototype.value',
  'Object.getPrototypeOf([][Symbol.iterator]())',
  'Object.getPrototypeOf(new Map().keys())', 'Object.getPrototypeOf(new Set().keys())',
  'Object.getPrototypeOf(""[Symbol.iterator]())'];
const acciones = [o=>`${o}.intruso=1`, o=>`Object.defineProperty(${o},"intruso",{value:1})`,
  o=>`Object.assign(${o},{intruso:1})`,o=>`Object.setPrototypeOf(${o},{})`,
  o=>`Reflect.defineProperty(${o},"intruso",{value:1})`, o=>`Reflect.set(${o},"intruso",1)`,
  o=>`Reflect.setPrototypeOf(${o},{})`,o=>`${o}.__defineGetter__("intruso",()=>1)`];
const resultado = fn => {try{return {valor:fn()}}catch(x){return {error:[x.name,x.message]}}};
let fallos=0;
for (const objetivo of objetivos) for (const accion of acciones) {
  const codigo=`"use strict";${accion(objetivo)}`;
  const esperado=resultado(()=>vm.runInNewContext(congelar+`(()=>{"use strict";return (${accion(objetivo)})})()`,{}, {timeout:2000}));
  const actual=resultado(()=>e.ejecutar(`(()=>{"use strict";return (${accion(objetivo)})})()`));
  // El script V8 conserva el valor de la última expresión.
  try{assert.deepEqual(actual,esperado,codigo);n++;}catch(x){fallos++;console.error(x.message);}
}
for(const [obj,k] of [['Array.prototype','push'],['Object.prototype','toString'],['Math','abs'],['JSON','parse'],['Object','keys'],['Array','from']]){
  for(const accion of [`${obj}.${k}=1`,`delete ${obj}.${k}`,`Object.assign(${obj},{${k}:1})`]){
    const esperado=resultado(()=>vm.runInNewContext(congelar+`(()=>{"use strict";return (${accion})})()`));
    const actual=resultado(()=>e.ejecutar(`(()=>{"use strict";return (${accion})})()`));
    try{assert.deepEqual(actual,esperado,accion);n++;}catch(x){fallos++;console.error(x.message);}
  }
}
for (const accion of ['new Proxy(Array.prototype,{set(){return true}}).push=1',
  'Object.defineProperty(new Proxy(Object.prototype,{defineProperty(){return true}}),"intruso",{value:1})']) {
  const esperado=resultado(()=>vm.runInNewContext(congelar+`(()=>{"use strict";return (${accion})})()`));
  const actual=resultado(()=>e.ejecutar(`(()=>{"use strict";return (${accion})})()`));
  try{assert.deepEqual(actual,esperado,accion);n++;}catch(x){fallos++;console.error(x.message);}
}
assert.equal(fallos,0,'Diferencias de aislamiento');
assert.equal(Array.prototype.intruso,undefined);assert.equal(Object.prototype.intruso,undefined);
for(const o of [Object.prototype,Array.prototype,Number.prototype,String.prototype,Boolean.prototype,Symbol.prototype,Map.prototype,Set.prototype,WeakMap.prototype,WeakSet.prototype,Math,JSON,Reflect,Object,Array,Number]) assert.equal(Object.hasOwn(o,'intruso'),false);
assert.equal(Object.isFrozen(Array.prototype),false);assert.equal(Object.isFrozen(Math),false);
e.liberar();
console.log(`Intérprete aislamiento: ${n} comprobaciones; anfitrión intacto.`);
