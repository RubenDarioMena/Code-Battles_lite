// Batalla 6 · datos propios (formato de un reto de War tras normalizar). Textos por clave i18n.
export default {
  clave: "b6", titulo: "i18n:n1.b6.titulo", objetivo: "i18n:n1.b6.objetivo", pistas: ["i18n:n1.b6.pista1"],
  mapa: { cols: 40 },                        // más campo: copia propia (tickets 08 y 09)
  lanzadores: [{ id: "LAU-01", x: 6, y: 9 }],
  unidades: [{ id: "WHL-01", tipo: "WHL", home: { x: 1, y: 9 } }],
  oleadas: [{ tipo: "crawler", n: 10, t: 0, cada: 2, carriles: [8, 10, 9] }],
  metas: { brechasMax: 2 },
  inicial: { "WHL-01": ["// programa de la lección"] },
};
