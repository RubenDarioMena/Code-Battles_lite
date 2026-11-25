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
    if (b.prensa) {
      const texto = (campo, k) => {
        if (!k || (catalogo && !['es', 'en'].every(idioma => typeof catalogo[idioma]?.[k] === 'string')))
          error(clave, campo, 'falta la clave i18n en el catálogo ES/EN');
      };
      texto('titulo', b.titulo);
      if (!Array.isArray(b.metas) || !b.metas.length) error(clave, 'metas', 'se espera una lista de metas');
      else for (const [j, meta] of b.metas.entries()) {
        texto(`metas[${j}].k`, meta.k);
        if (!['en', 'lotes', 'banda'].includes(meta.tipo) || !(meta.n > 0))
          error(clave, `metas[${j}]`, 'meta de producción inválida');
      }
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
