import { instrumentar, revisar, opcionesPython, mensajePython, vocabulario, fmtLugar, fmtValor } from '../../paquetes/lenguaje/index.js';

/** @param {any} contexto @param {any} mundo @param {string} [serie] */
export function crearInstrumentador(contexto, mundo, serie = 'war') {
  const nombres = () => (serie === 'campaign' ? mundo.unidades : serie === 'factory' ? mundo.maquinas
    : [...mundo.programables, ...mundo.sensores]).map(e => e.id.replace(/-/g, '_'));
  const proveedor = contexto.CMGProveedor.crear({ serie,
    sensores: () => mundo.sensores.map(e => e.id.replace(/-/g, '_')) });
  const { PROPS } = vocabulario(serie);
  let clave, opciones;
  return {
    instrumentar: src => instrumentar(src, { serie, objetos: nombres(), acorn: contexto.acorn }),
    revisar: src => revisar(src, contexto.acorn),
    opcionesPython() {
      const objetos = nombres(), nueva = objetos.join('|');
      if (!opciones || clave !== nueva) {
        clave = nueva; opciones = opcionesPython(objetos, proveedor.alias('python'), PROPS);
      }
      return opciones;
    },
    mensajePython: m => mensajePython(m, new Map(proveedor.funciones()
      .filter(f => f.nombres?.python).map(f => [f.nombre, f.nombres.python]))),
    fmtLugar, fmtValor,
  };
}
