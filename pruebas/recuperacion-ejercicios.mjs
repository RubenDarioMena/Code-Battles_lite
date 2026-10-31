// Fixtures del piloto de Rocket Launcher. Son referencias de edición; no se ejecutan.
export const ejercicios = [
  { id: 'R1', foco: 'Dos argumentos: comillas y selección del primero frente al segundo', codigo:
    'const pos = autoTarget("crawler", "visual");\nregularShoot(pos);' },
  { id: 'R2', foco: 'Bloque while, sangría y selección semántica creciente', codigo:
    'while (true) {\n  const pos = autoTarget("crawler", "visual");\n  regularShoot(pos);\n  await esperar(0.5);\n}' },
  { id: 'R3', foco: 'If/else, condición y variable reutilizada', codigo:
    'const pos = autoTarget("crawler", "visual");\nif (pos) {\n  regularShoot(pos);\n} else {\n  stopFire();\n}\nawait esperar(0.5);' },
  { id: 'R4', foco: 'Comentarios placeholder, cadenas y línea vacía', codigo:
    '/* elegir un objetivo */\nconst pos = autoTarget(/* tipo de enemigo */, "visual");\n\nregularShoot(/* lugar */);' },
  { id: 'R5', foco: 'Anidamiento, fallback y línea larga con ajuste en móvil', codigo:
    'while (true) {\n  const pos = autoTarget("drone", "visual") ?? autoTarget("crawler", "visual");\n  if (pos) {\n    burstFire(pos);\n  } else {\n    console.warn("sin objetivo");\n  }\n  await esperar(0.5);\n}' }
];

// Repetir cada ejercicio permite contrastar formato y registrar carencias recurrentes.
export const piloto = ['escritorio', 'movil'].flatMap(formato => ejercicios.map(e => ({ ...e, formato })));
