import { identidad, matriz, trs, leerTransformacion, escalar, producto, inversa, ejeAngulo } from './matrices.js';
import { crearRestricciones } from './restricciones.js';

const operaciones = new Map(Object.entries({
  '+':(a,b)=>a+b, '-':(a,b)=>a-b, '*':(a,b)=>a*b, '/':(a,b)=>a/b, '**':(a,b)=>a**b,
  neg:a=>-a, abs:Math.abs, sqrt:Math.sqrt, sin:Math.sin, cos:Math.cos, tan:Math.tan,
  min:Math.min, max:Math.max, clamp:(x,a,b)=>Math.min(Math.max(x,a),b)
}));

// Compilar al leer elimina el recorrido del AST y los argumentos temporales por fotograma.
function expresion(expr,nombres) {
  if (Number.isFinite(expr)) return () => expr;
  if (typeof expr==='string') {
    if (!nombres.has(expr)) throw Error('Control desconocido: '+expr);
    return valores => valores[expr];
  }
  if (!Array.isArray(expr)) throw Error('Expresión de rig inválida');
  const [op,...args]=expr, fn=operaciones.get(op);
  if (!fn) throw Error('Operador desconocido: '+op);
  const varios=op==='min'||op==='max';
  if (varios ? args.length<2 : args.length!==fn.length) throw Error('Aridad incorrecta: '+op);
  const operandos=args.map(a=>expresion(a,nombres));
  const [a,b,c]=operandos;
  if (varios) return v=>{
    let valor=a(v);
    for (let i=1;i<operandos.length;i++) valor=fn(valor,operandos[i](v));
    return valor;
  };
  if (c) return v=>fn(a(v),b(v),c(v));
  if (b) return v=>fn(a(v),b(v));
  return v=>fn(a(v));
}

function compilarLocal(r,nombres) {
  const base=trs(r.base.t,r.base.r,r.base.s);
  const t=r.traslacion.map(e=>expresion(e,nombres)), s=r.escala.map(e=>expresion(e,nombres));
  const giros=r.rotaciones.map(({eje,angulo})=>({eje,angulo:expresion(angulo,nombres)}));
  return (out,v,rot,tmp)=>{
    out.set(base);
    const x=t[0](v), y=t[1](v), z=t[2](v);
    for (let i=0;i<3;i++) out[12+i]+=base[i]*x+base[4+i]*y+base[8+i]*z;
    for (let i=0;i<giros.length;i++) {
      const g=giros[i];
      ejeAngulo(rot,g.eje,g.angulo(v));
      producto(tmp,out,rot); out.set(tmp);
    }
    escalar(out,s[0](v),s[1](v),s[2](v));
  };
}

const tipos=new Set(['COPIAR_POSICION','APUNTAR','APUNTAR_BLOQUEADO','ESTIRAR']);
export function leerRig(gltfJson) {
  const {nodes,scenes,scene=0}=gltfJson;
  const niveles=[];
  for (const indice of scenes[scene].nodes) {
    const root=nodes[indice], e=root.extras, match=/^L(\d+)_(.+)$/.exec(root.name);
    if (!match || e?.rig_formato!=='cbl-rig' || e.rig_v!==2)
      throw Error('Se exige cbl-rig v2 en '+root.name+' (versión '+e?.rig_v+')');
    const nivel=Number(match[1]), prefijo='L'+nivel+'_', raiz=match[2];
    if (niveles[nivel]) throw Error('Nivel duplicado: '+nivel);
    const controles=e.controles, nombres=new Set(controles.map(c=>c.nombre));
    const pivotes=Object.create(null), orden=[];
    function visitar(i,padre) {
      const n=nodes[i];
      if (n.mesh!==undefined) return;
      const nombre=n.name.slice(prefijo.length);
      if (!n.name.startsWith(prefijo) || pivotes[nombre]) throw Error('Pivote inválido: '+n.name);
      const p=pivotes[nombre]={nombre,padre,...leerTransformacion(n),reglas:[],local:null};
      if (n.extras?.rig!==undefined) {
        if (typeof n.extras.rig!=='string') throw Error('extras.rig debe ser cadena: '+n.name);
        const rig=JSON.parse(n.extras.rig);
        if (rig.v!==2) throw Error('Versión de regla desconocida: '+rig.v);
        p.reglas=rig.reglas;
        p.reglas.forEach((regla,j)=>{
          if (regla.tipo==='LOCAL') {
            if (j!==0) throw Error('LOCAL debe ir primero: '+n.name);
            p.local=compilarLocal(regla,nombres);
          } else if (!tipos.has(regla.tipo)) throw Error('Tipo desconocido: '+regla.tipo);
          else if (regla.tipo==='ESTIRAR' && (!['Y','Z'].includes(regla.eje_fijo) ||
              !['NO','XZ','X','Z'].includes(regla.volumen))) throw Error('Modo ESTIRAR desconocido: '+n.name);
        });
      }
      for (const hijo of n.children??[]) visitar(hijo,nombre);
    }
    visitar(indice,null);
    const estado=new Map();
    function ordenar(k) {
      if (estado.get(k)===2) return;
      if (estado.has(k)) throw Error('Ciclo del rig: '+k);
      const p=pivotes[k];
      if (!p) throw Error('Objetivo desconocido: '+k);
      estado.set(k,1);
      if (p.padre!==null) ordenar(p.padre);
      for (const regla of p.reglas) if (regla.tipo!=='LOCAL') ordenar(regla.objetivo);
      orden.push(k); estado.set(k,2);
    }
    Object.keys(pivotes).forEach(ordenar);
    niveles[nivel]={raiz,pivotes,orden,controles,bucle:typeof e.bucle==='string'?JSON.parse(e.bucle):e.bucle};
  }
  return {niveles};
}

export function crearSolver(rig,nivel) {
  const datos=rig.niveles[nivel];
  if (!datos) throw Error('Nivel de rig inexistente: '+nivel);
  const {pivotes,orden,controles,raiz}=datos;
  const mundo=Object.create(null), locales=Object.create(null), absoluto=Object.create(null);
  for (const k of orden) { mundo[k]=matriz(); locales[k]=matriz(); absoluto[k]=matriz(); }
  const pasos=orden.map(k=>{
    const p=pivotes[k];
    return {p, local:locales[k], w:absoluto[k], salida:mundo[k], padre:p.padre===null?identidad:absoluto[p.padre],
      pila:p.reglas.filter(r=>r.tipo!=='LOCAL').map(r=>({r,objetivo:absoluto[r.objetivo]}))};
  });
  const valores=Object.create(null), aplicar=crearRestricciones(), rot=matriz(), tmp=matriz(), inv=matriz();
  const marco=matriz(), resultado={mundo,locales};
  function evaluar(entrada=undefined) {
    for (let i=0;i<controles.length;i++) {
      const c=controles[i], x=entrada && Object.hasOwn(entrada,c.nombre)?entrada[c.nombre]:c.reposo;
      if (!Number.isFinite(x)) throw Error('Control no finito: '+c.nombre);
      valores[c.nombre]=c.ciclico?x:Math.min(c.max??Infinity,Math.max(c.min??-Infinity,x));
    }
    for (let i=0;i<pasos.length;i++) {
      const {p,local,w,padre,pila,salida}=pasos[i];
      if (p.local) p.local(local,valores,rot,tmp);
      else local.set(p.reposo);
      producto(w,padre,local);
      for (let j=0;j<pila.length;j++) aplicar(w,pila[j].r,pila[j].objetivo);
      if (pila.length) { inversa(inv,padre); producto(local,inv,w); }
      producto(salida,marco,w);
    }
    return resultado;
  }
  evaluar();
  inversa(marco,absoluto[raiz]);
  return {controles,evaluar};
}
