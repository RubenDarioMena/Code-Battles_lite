// El proveedor común sigue resolviendo alias, objetos, funciones y vocabulario.
export function crearExtensionV2(fichas, traducir, catalogo = undefined) {
  const eventos = fichas.flatMap(f => f.eventos || []).map(e => ({
    ...e, evento: [e.objeto, e.nombre].filter(Boolean).join('.'),
    rotulo: idioma => catalogo?.[idioma]?.[e.seudo] ?? traducir(e.seudo),
  }));
  const verbos = fichas.flatMap(f => f.verbos ?? []);
  const bloques = verbos.filter(f => f.seudo).map(f => ({ ...f, rotulo: idioma =>
    catalogo?.[idioma]?.[f.seudo.rotulo] ?? traducir(f.seudo.rotulo) }));
  const lecturas = fichas.flatMap(f => f.lecturas ?? []);
  const ampliaciones = [...fichas.flatMap(f => f.ampliaciones || []), ...verbos];
  function funciones() {
    return [...eventos.map(e => ({ ...e, nota: traducir(e.nota), grupo: traducir('cv2.eventos') })),
      ...ampliaciones.map(f => ({ ...f, nota: traducir(f.nota), firma: f.firma.map(clave => traducir(clave)) }))];
  }
  function atajos(python, aPython) {
    const propias = verbos.map(f => ({ ico: "apuntar", t: f.nombres?.[python ? "python" : "js"] ?? f.nombre,
      b: python ? aPython(f.paleta) : f.paleta }));
    return propias.concat(eventos.map(e => {
      const fn = 'al_' + (e.objeto || e.nombre);
      const b = python ? `def ${fn}(${e.parametro}):\n    pass\n${[e.objeto, e.nombres.python].filter(Boolean).join('.')}(${fn})` :
        `${e.evento}(async (${e.parametro}) => {\n  \n});`;
      return { ico: 'apuntar', t: traducir(e.seudo), i18n: e.seudo, b };
    }));
  }
  return { bloques, verbos, lecturas, eventos, funciones, atajos };
}
