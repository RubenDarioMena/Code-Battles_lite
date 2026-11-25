// La cartulina conserva COLOR_0, el mapa de fibra y el normalMap de relieve del GLB.
// El constructor concentra el material WebGL para una futura variante TSL.
function fundirBorde(material) {
  // A ras de la última tesela el pigmento alcanza exactamente el color del fondo,
  // incluso cuando se gira la cámara estrecha y el borde queda cerca del ojo.
  material.onBeforeCompile = shader => {
    const uv = 'varying vec2 vMetrosPapel;\n';
    shader.vertexShader = uv + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvMetrosPapel = (modelMatrix * vec4(transformed, 1.0)).xz;');
    shader.fragmentShader = uv + shader.fragmentShader.replace('#include <fog_fragment>', `
      #include <fog_fragment>
      #ifdef USE_FOG
        vec2 margen = min(vMetrosPapel - vec2(100., 52.), vec2(300., 104.) - vMetrosPapel);
        gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, smoothstep(0., 5., min(margen.x, margen.y)));
      #endif`);
  };
  return material;
}
export function crearMateriales(THREE, anisotropia) {
  let papel;
  const tinta = fundirBorde(new THREE.MeshStandardMaterial({ color: 0x142329, emissive: 0x0b2429, roughness: 1 }));
  const arista = fundirBorde(new THREE.LineBasicMaterial({ color: 0x4aa4a9 }));
  const bordes = new Map();
  function preparar(raiz, cartulina) {
    raiz.traverse(o => {
      if (!o.isMesh) return;
      if (cartulina && o.geometry.attributes.color) {
        const m = o.material;
        if (!papel) {
          papel = fundirBorde(m);
          papel.vertexColors = true;
          for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = anisotropia;
        } else if (m !== papel) {
          if (m.map !== papel.map) m.map?.dispose();
          if (m.normalMap !== papel.normalMap) m.normalMap?.dispose();
          m.dispose();
        }
        o.material = papel;
      }
    });
  }
  // Se aplica a copias ya montadas. Los LOD de una torreta comparten geometría entre instancias.
  function vestir(raiz, combate) {
    const mallas = [];
    raiz.traverse(o => { if (o.isMesh) mallas.push(o); });
    for (const o of mallas) {
      o.userData.materialPapel ??= o.material;
      o.material = combate ? tinta : o.userData.materialPapel;
      let linea = o.children.find(h => h.userData.arista);
      if (combate && !linea) {
        if (!bordes.has(o.geometry)) bordes.set(o.geometry, new THREE.EdgesGeometry(o.geometry, 30));
        linea = new THREE.LineSegments(bordes.get(o.geometry), arista);
        linea.userData.arista = true;
        linea.raycast = () => {};
        o.add(linea);
      }
      if (linea) linea.visible = combate;
    }
  }
  return { preparar, vestir, destruir() {
    for (const g of bordes.values()) g.dispose();
    arista.dispose(); tinta.dispose();
  } };
}
