// Une solo las caras de material que siguen en contacto, de su pose fija a la doblada.
const ACABADO = Object.freeze({ penetracion: .0005, rugosidad: .92 });
export function crearBisagra(T, color) {
  const geometria = new T.BufferGeometry(), material = new T.MeshStandardMaterial({
    color, roughness: ACABADO.rugosidad, side: T.DoubleSide
  });
  const mesh = new T.Mesh(geometria, material);
  mesh.name = 'puente';
  mesh.frustumCulled = false;
  const v = new T.Vector3(), qa = new T.Quaternion(), qb = new T.Quaternion();
  const a = new T.Vector3(), b = new T.Vector3();
  return {
    mesh,
    actualizar(h, padre) {
      const caras = h.carasUnion;
      const longitud = caras.length * 24;
      let vertices = geometria.getAttribute('position');
      if (vertices?.count !== longitud) {
        geometria.dispose();
        vertices = new T.Float32BufferAttribute(new Float32Array(longitud * 3), 3);
        geometria.setAttribute('position', vertices);
        geometria.deleteAttribute('normal');
      }
      qa.fromArray(padre.rot); qb.fromArray(h.rot);
      a.fromArray(padre.pos); b.fromArray(h.pos);
      a.z -= padre.hundimiento; b.z -= h.hundimiento;
      let i = 0;
      for (const { centro, eje, signo } of caras) {
        const esquina = (k, movil) => {
          v.fromArray(centro);
          v.setComponent((eje + 1) % 3, centro[(eje + 1) % 3] + (k === 1 || k === 2 ? .5 : -.5) * h.celda);
          v.setComponent((eje + 2) % 3, centro[(eje + 2) % 3] + (k >= 2 ? .5 : -.5) * h.celda);
          // Los extremos penetran medio milímetro en sus respectivos vóxeles.
          v.setComponent(eje, centro[eje] + (movil ? 1 : -1) * signo * ACABADO.penetracion);
          v.applyQuaternion(movil ? qb : qa).add(movil ? b : a);
          vertices.setXYZ(i++, v.x, v.y, v.z);
        };
        for (let k = 0; k < 4; k++) {
          const j = (k + 1) % 4;
          esquina(k, false); esquina(j, false); esquina(k, true);
          esquina(k, true); esquina(j, false); esquina(j, true);
        }
      }
      vertices.needsUpdate = true;
      geometria.computeVertexNormals();
      mesh.visible = h.opacidad > 0 && padre.opacidad > 0;
      material.opacity = Math.min(h.opacidad, padre.opacidad);
      material.transparent = material.opacity < 1;
    },
    destruir() { geometria.dispose(); material.dispose(); }
  };
}
