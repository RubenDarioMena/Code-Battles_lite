import { PIEZAS } from './fabrica/catalogo.js';

// El nombre del archivo viene del módulo del nivel, incluso si el contenido pierde su clave.
export function validarNivel(carpeta, contenido, tipos, catalogo) {
  const errores = [];
  const error = (archivo, campo, motivo) => errores.push(`${carpeta}/${archivo}.js · ${campo} · ${motivo}`);
  const nivel = contenido?.default;
  if (!nivel?.clave) error('nivel', 'clave', 'falta la clave del nivel');
  if (!Number.isInteger(nivel?.revision) || nivel.revision < 1) error('nivel', 'revision', 'se espera un entero positivo');
  const marco = nivel?.marco;
  if (!Array.isArray(marco?.origen) || marco.origen.length !== 2 || !marco.origen.every(Number.isFinite))
    error('nivel', 'marco.origen', 'se esperan dos coordenadas');
  if (!Array.isArray(marco?.puertas) || !marco.puertas.every(Number.isInteger))
    error('nivel', 'marco.puertas', 'se esperan filas locales');
  const par = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  if (marco?.tam !== undefined && !par(marco.tam)) error('nivel', 'marco.tam', 'se esperan columnas y filas');
  if (!Array.isArray(marco?.bastiones) || !marco.bastiones.every(par))
    error('nivel', 'marco.bastiones', 'se esperan casillas locales [x, y]');
  else if (new Set(marco.bastiones.map(String)).size !== marco.bastiones.length)
    error('nivel', 'marco.bastiones', 'bastión repetido');
  if (nivel?.fabrica !== undefined && !par(nivel.fabrica?.origen))
    error('nivel', 'fabrica.origen', 'se esperan dos coordenadas');
  if (nivel?.hitos?.some?.(h => /^h\d+$/.test(h))) validarPlanta(contenido.fabrica, error);
  if (!Array.isArray(nivel?.hitos) || !nivel.hitos.length) {
    error('nivel', 'hitos', 'se espera una secuencia con al menos un hito');
    return errores;
  }

  const vistos = new Set();
  for (const [i, clave] of nivel.hitos.entries()) {
    const campo = `hitos[${i}]`;
    if (vistos.has(clave)) error('nivel', campo, `hito repetido: ${clave}`);
    vistos.add(clave);
    if (typeof clave !== 'string' || !clave || !Object.hasOwn(contenido, clave) || clave === 'default') {
      error('nivel', campo, `falta el módulo de la Batalla ${clave}`);
      continue;
    }
    const b = contenido[clave];
    if (b?.clave !== clave) error(clave, 'clave', `se esperaba ${clave}`);
    if (!b || typeof b !== 'object') continue;
    if (b.fabrica) {
      validarHitoFabrica(clave, b, nivel.hitos.filter(h => /^h\d+$/.test(h)).indexOf(clave), contenido.fabrica, catalogo, error);
      continue;
    }
    if (Object.hasOwn(b, 'war')) {
      if (!Number.isInteger(b.war) || b.war < 1 || b.war > 5) error(clave, 'war', 'se espera un entero de 1 a 5');
      for (const k of Object.keys(b)) if (k !== 'war' && k !== 'clave') error(clave, k, 'una referencia a War solo lleva clave y war');
      continue;
    }
    const comprobar = (campo, valido) => { if (!valido) error(clave, campo, 'campo obligatorio del reto normalizado'); };
    for (const k of ['titulo', 'objetivo', 'leccion', 'pista']) comprobar(k, typeof b[k] === 'string');
    for (const k of ['reparadores', 'cargador', 'suministro']) comprobar(k, Number.isFinite(b[k]));
    comprobar('niebla', typeof b.niebla === 'boolean');
    comprobar('inicial', b.inicial && typeof b.inicial === 'object' && !Array.isArray(b.inicial));
    comprobar('metas.brechasMax', Number.isFinite(b.metas?.brechasMax));
    for (const k of ['lanzadores', 'sensores', 'oleadas']) {
      comprobar(k, Array.isArray(b[k]) && (k !== 'lanzadores' || b[k].length > 0));
      if (!Array.isArray(b[k])) continue;
      for (const [j, dato] of b[k].entries()) {
        const ruta = `${k}[${j}]`;
        const numeros = k === 'oleadas' ? ['n', 't', 'cada'] : k === 'sensores' ? ['x', 'y', 'alcance'] : ['x', 'y'];
        for (const n of numeros) comprobar(`${ruta}.${n}`, Number.isFinite(dato?.[n]));
        if (k === 'oleadas') {
          if (!Object.hasOwn(tipos, dato?.tipo)) error(clave, `${ruta}.tipo`, 'tipo de enemigo desconocido');
          comprobar(`${ruta}.carriles`, Array.isArray(dato?.carriles) && dato.carriles.every(Number.isFinite));
        } else comprobar(`${ruta}.id`, typeof dato?.id === 'string' && dato.id.length > 0);
      }
    }
  }
  return errores;
}

// La planta de la fábrica: unidades con id único y programas de unidades que existen.
function validarPlanta(planta, error) {
  if (!planta || !Array.isArray(planta.unidades)) return error('fabrica', 'unidades', 'falta la planta de los hitos de fábrica');
  const ids = new Set();
  for (const [i, u] of planta.unidades.entries()) {
    if (typeof u?.id !== 'string' || !u.id) error('fabrica', `unidades[${i}].id`, 'se espera un id');
    else if (ids.has(u.id)) error('fabrica', `unidades[${i}].id`, `id repetido: ${u.id}`);
    ids.add(u?.id);
    if (u?.alcance !== undefined && !(u.alcance > 0)) error('fabrica', `unidades[${i}].alcance`, 'se espera un alcance positivo');
  }
  for (const id of Object.keys(planta.inicial ?? {})) if (!ids.has(id)) error('fabrica', `inicial.${id}`, 'unidad desconocida');
  for (const k of ['energia', 'presupuesto', 'premioHito', 'bodegaInicial'])
    if (!Number.isFinite(planta[k]) || planta[k] < 0) error('fabrica', k, 'se espera un número no negativo');
}

// Un hito de fábrica: metas sobre piezas y lugares de la planta, y sus textos en el catálogo ES/EN.
function validarHitoFabrica(clave, h, indice, planta, catalogo, error) {
  const ids = new Set((planta?.unidades ?? []).map(u => u.id));
  const texto = k => {
    if (catalogo && !['es', 'en'].every(idioma => typeof catalogo[idioma]?.[k] === 'string'))
      error(clave, k, 'falta la clave i18n en el catálogo ES/EN');
  };
  for (const k of ['titulo', 'objetivo', 'leccion']) texto(`campaign.hito.${indice}.${k}`);
  if (!Number.isInteger(h.pistas) || h.pistas < 0) error(clave, 'pistas', 'se espera un entero');
  else for (let i = 0; i < h.pistas; i++) texto(`campaign.hito.${indice}.pista.${i}`);
  if (!Array.isArray(h.metas) || !h.metas.length) error(clave, 'metas', 'se espera una lista de metas');
  else for (const [j, meta] of h.metas.entries()) {
    if (!['en', 'lotes', 'hechos', 'tarima'].includes(meta.tipo) || !(meta.n > 0)) error(clave, `metas[${j}]`, 'meta de producción inválida');
    if (meta.pieza !== undefined && !Object.hasOwn(PIEZAS, meta.pieza)) error(clave, `metas[${j}].pieza`, `pieza desconocida: ${meta.pieza}`);
    if ((meta.tipo === 'en' || meta.tipo === 'tarima') && !ids.has(meta.lugar)) error(clave, `metas[${j}].lugar`, `lugar desconocido: ${meta.lugar}`);
  }
  for (const [j, g] of (h.alEmpezar?.entregas ?? []).entries()) {
    if (!ids.has(g.lugar)) error(clave, `alEmpezar.entregas[${j}].lugar`, `lugar desconocido: ${g.lugar}`);
    if (!Object.hasOwn(PIEZAS, g.pieza) || !(g.n > 0)) error(clave, `alEmpezar.entregas[${j}]`, 'entrega inválida');
  }
}
