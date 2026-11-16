/* Laboratorio de batalla · pruebas y programas de partida.
 * Cada prueba aísla una pregunta. Las casillas son las de mundo.js: 48 × 27, muro en x = 7, base a su izquierda. */
(function (raiz) {
  "use strict";

  // ---------- Programas de partida ----------
  const TORRETA_SOLA = `// Torreta del muro: dispara sola al enemigo más avanzado que ve.
while (true) {
  const pos = autoTarget("drone") ?? autoTarget();
  regularShoot(pos);
  await wait(0.4);
}
`;

  const VEHICULO_SALIDA = `// Sale del muro hacia donde el radar detecta enemigos y dispara con su torreta.
const DISTANCIA = 6;         // el tirador alcanza 7 casillas; mi cañón, 8
let reponiendo = false;

// El enemigo detectado que me queda más cerca.
function masCercano(lista) {
  let mejor = null;
  for (const e of lista) {
    if (!mejor || distance(position, e) < distance(position, mejor)) mejor = e;
  }
  return mejor;
}

while (true) {
  // Sin misiles o muy dañado: vuelvo. Dentro del muro me recargan y reparan.
  if (missiles === 0 || hp <= 1) reponiendo = true;
  if (missiles === 10 && hp === 4) reponiendo = false;

  const presa = masCercano(RAD_01.list("gunner")) ?? masCercano(RAD_01.list("siege"));
  if (reponiendo || !presa) {
    moveTo(home);
  } else {
    moveTo({ x: presa.x - DISTANCIA, y: presa.y });
  }
  regularShoot(autoTarget());
  await wait(0.4);
}
`;

  const rueda = (objetivo, lejano) => `// Rueda kamikaze. Los tiradores disparan adonde estarás si sigues recto:
// cambia de rumbo antes de que llegue el proyectil.
const OBJETIVO = "${objetivo}";
const LEJANO = ${lejano};   // de los que detecta el radar, ¿voy al más lejano?
const DESVIO = 2;      // casillas hacia un lado en cada tramo. Prueba 0: línea recta
const TRAMO = 2;       // casillas que avanza entre dos cambios de rumbo
let lado = 1;

while (true) {
  const vistos = RAD_01.list(OBJETIVO);
  const meta = (LEJANO ? vistos[vistos.length - 1] : vistos[0]) ?? RAD_01.detect("gunner") ?? RAD_01.detect("siege");
  if (!meta) {
    moveTo(home);
    await wait(0.5);
    continue;
  }
  const d = distance(position, meta);
  if (d < 2.3) {
    detonate();                      // la carga alcanza 2,5 casillas
    break;
  }
  // Un paso hacia la meta y un desvío perpendicular, alternando el lado.
  // Cerca de la meta el desvío se reduce: si no, daría vueltas a su alrededor.
  const desvio = Math.min(DESVIO, d / 2) * lado;
  const ux = (meta.x - position.x) / d;
  const uy = (meta.y - position.y) / d;
  moveTo({
    x: position.x + ux * TRAMO - uy * desvio,
    y: position.y + uy * TRAMO + ux * desvio,
  });
  lado = -lado;
  await arrive();
}
`;

  const TORRETA_CLIC = `// Dispara sola a lo que ve. Con niebla ve poco: tus clics son sus ojos.
let foco = null;     // enemigo señalado con un clic
let zona = null;     // punto del terreno señalado con un clic

// Clic en un enemigo: queda marcado unos segundos y track() lo sigue aunque esté lejos.
enemies.onClick((enemigo) => {
  foco = enemigo.id;
  zona = null;
});

// Clic en el terreno: fuego a ese punto durante 2 segundos.
terrain.onClick(async (lugar) => {
  zona = lugar;
  foco = null;
  await wait(2);
  if (zona === lugar) zona = null;   // si no hubo otro clic, vuelvo a lo mío
});

while (true) {
  const pos = track(foco) ?? zona ?? autoTarget("drone") ?? autoTarget();
  regularShoot(pos);
  await wait(0.3);
}
`;

  const VEHICULO_CLIC = `// Obedece tus clics. Terreno: ir allí. Enemigo: perseguirlo a distancia de tiro.
const DISTANCIA = 7.5;
let presa = null;

terrain.onClick((lugar) => {
  presa = null;
  moveTo(lugar);
});

enemies.onClick((enemigo) => {
  presa = enemigo.id;
});

// Evento del mundo: me dieron. Si queda poca vida, vuelvo sola al muro.
onDamage(() => {
  if (hp <= 1) {
    presa = null;
    moveTo(home);
  }
});

while (true) {
  const e = presa ? RAD_01.locate(presa) : null;
  if (e) {
    moveTo({ x: e.x - DISTANCIA, y: e.y });
  } else {
    presa = null;
  }
  regularShoot(track(presa) ?? autoTarget());
  await wait(0.4);
}
`;

  const RUEDA_CLIC = `// Espera en la base. Clic en un enemigo: voy en zigzag y detono. Clic en el terreno: voy allí.
const DESVIO = 2;
const TRAMO = 2;
let presa = null;
let lado = 1;

enemies.onClick((enemigo) => {
  presa = enemigo.id;
});

terrain.onClick((lugar) => {
  presa = null;
  moveTo(lugar);
});

while (true) {
  const meta = presa ? RAD_01.locate(presa) : null;
  if (!meta) {
    presa = null;
    await wait(0.2);
    continue;
  }
  const d = distance(position, meta);
  if (d < 2.3) {
    detonate();
    break;
  }
  const desvio = Math.min(DESVIO, d / 2) * lado;   // cerca de la meta, menos desvío
  const ux = (meta.x - position.x) / d;
  const uy = (meta.y - position.y) / d;
  moveTo({
    x: position.x + ux * TRAMO - uy * desvio,
    y: position.y + uy * TRAMO + ux * desvio,
  });
  lado = -lado;
  await arrive();
}
`;

  const VEHICULO_CAMPANA = `// Patrulla sola como en «Salida». Un clic tuyo manda durante un rato.
const DISTANCIA = 7.5;
let reponiendo = false;
let orden = null;    // { lugar | presa, hasta }

terrain.onClick((lugar) => {
  orden = { lugar: lugar, presa: null, hasta: time + 10 };
});

enemies.onClick((enemigo) => {
  orden = { lugar: null, presa: enemigo.id, hasta: time + 20 };
});

function masCercano(lista) {
  let mejor = null;
  for (const e of lista) {
    if (!mejor || distance(position, e) < distance(position, mejor)) mejor = e;
  }
  return mejor;
}

while (true) {
  if (orden && time > orden.hasta) orden = null;
  if (missiles === 0 || hp <= 1) reponiendo = true;
  if (missiles === 10 && hp === 4) reponiendo = false;

  let presa = null;
  if (orden && orden.presa) {
    presa = RAD_01.locate(orden.presa);
    if (!presa) orden = null;          // ya no existe
  }
  if (!orden) presa = masCercano(RAD_01.list("gunner")) ?? masCercano(RAD_01.list("siege"));

  if (reponiendo) {
    moveTo(home);
  } else if (orden && orden.lugar) {
    moveTo(orden.lugar);
  } else if (presa) {
    moveTo({ x: presa.x - DISTANCIA, y: presa.y });
  } else {
    moveTo(home);
  }
  regularShoot(track(presa) ?? autoTarget());
  await wait(0.4);
}
`;

  // ---------- Unidades habituales ----------
  const TUR = [{ id: "TUR-01", clase: "torreta", x: 7, y: 5 }, { id: "TUR-02", clase: "torreta", x: 7, y: 21 }];
  const RAD = { id: "RAD-01", clase: "radar", x: 7, y: 13 };
  const VEH = [{ id: "VEH-01", clase: "vehiculo", x: 3, y: 8 }, { id: "VEH-02", clase: "vehiculo", x: 3, y: 18 }];
  const WHL = (n, reponer) => Array.from({ length: n }, (_, i) => ({ id: `WHL-0${i + 1}`, clase: "rueda", x: 5, y: 12 + i, reponer }));

  const ESCENARIOS = [
    {
      clave: "salida", titulo: "1 · Salida", etiqueta: "Vehículos",
      objetivo: "Dos tiradores se apostan fuera del alcance de las torretas y un cañón de asedio castiga el muro desde lejos. VEH-01 y VEH-02 salen por las puertas, se colocan según lo que detecta el radar y disparan con su torreta.",
      pregunta: "¿Se lee bien un vehículo que se mueve según lo que detecta? ¿Tiene interés salir del muro, gastar los misiles y volver a recargar?",
      pista: "El tirador alcanza 7 casillas y el cañón del vehículo 8. Con DISTANCIA en 6 el vehículo recibe impactos y tiene que volver a repararse: súbela a 7.5 y dispara sin recibir. reponiendo es una variable de estado: sin ella volvería a salir con un solo misil.",
      muro: 20, puertas: [8, 17],
      unidades: [...TUR, RAD, ...VEH],
      oleadas: [
        { tipo: "crawler", n: 6, t: 2, cada: 6, carriles: [6, 20, 10, 16, 4, 22] },
        { tipo: "gunner", n: 2, t: 6, cada: 2, carriles: [9, 17] },
        { tipo: "siege", n: 1, t: 16, cada: 1, carriles: [13] },
        { tipo: "gunner", n: 2, t: 55, cada: 2, carriles: [5, 21] },
        { tipo: "siege", n: 1, t: 62, cada: 1, carriles: [20] },
        { tipo: "drone", n: 5, t: 70, cada: 1.2, carriles: [8, 18, 12, 15, 10] },
      ],
      inicial: { "TUR-01": TORRETA_SOLA, "TUR-02": TORRETA_SOLA, "VEH-01": VEHICULO_SALIDA, "VEH-02": VEHICULO_SALIDA },
    },
    {
      clave: "rueda", titulo: "2 · Rueda kamikaze", etiqueta: "Kamikaze",
      objetivo: "Tres tiradores protegen un cañón de asedio. Las ruedas son rápidas, aguantan un solo impacto y llevan una carga que destruye todo lo que tenga cerca. La base repone cada rueda a los 12 s y su programa vuelve a empezar.",
      pregunta: "¿El recorrido raro se entiende como algo que el programa decide? ¿Se ve por qué la línea recta muere y el zigzag pasa?",
      pista: "Pon DESVIO en 0 y mira los disparos: caen justo donde iba a estar la rueda. WHL-01 busca el cañón; WHL-02, al tirador más avanzado, y WHL-03, al más lejano. La carga también daña a tus vehículos si están cerca.",
      muro: 20, puertas: [8, 17],
      unidades: [...TUR, RAD, ...WHL(3, 12)],
      oleadas: [
        { tipo: "gunner", n: 3, t: 0, cada: 1.5, carriles: [10, 13, 16], para: 27, vel: 2.2 },
        { tipo: "siege", n: 1, t: 1, cada: 1, carriles: [13], para: 37, vel: 1.4 },
        { tipo: "crawler", n: 4, t: 12, cada: 7, carriles: [5, 21, 9, 17] },
        { tipo: "gunner", n: 2, t: 40, cada: 1.5, carriles: [4, 8], para: 27, vel: 2.2 },
        { tipo: "siege", n: 1, t: 41, cada: 1, carriles: [6], para: 37, vel: 1.4 },
      ],
      inicial: { "TUR-01": TORRETA_SOLA, "TUR-02": TORRETA_SOLA, "WHL-01": rueda("siege", false), "WHL-02": rueda("gunner", false), "WHL-03": rueda("gunner", true) },
    },
    {
      clave: "observador", titulo: "3 · Observador", etiqueta: "Clic · torretas",
      objetivo: "Hay niebla: las torretas ven 6 casillas, pero su arma llega a 14. Tú ves todo el campo. Haz clic en un enemigo para marcarlo o en el terreno para pedir fuego en ese punto.",
      pregunta: "¿Un clic que cambia una variable del programa hace sentir que participas? ¿Cuántos clics por minuto resultan cómodos?",
      pista: "Sin clics las torretas empiezan a disparar tarde y las orugas blindadas llegan al muro. La marca dura 6 s: vuelve a señalar. Los rodadores giran: un misil acierta solo si llega antes del siguiente giro.",
      muro: 16, puertas: [8, 17], niebla: true,
      unidades: [...TUR],
      oleadas: [
        { tipo: "crawler", n: 5, t: 2, cada: 1.6, carriles: [5, 8, 6, 9, 7], hp: 3 },
        { tipo: "crawler", n: 5, t: 14, cada: 1.6, carriles: [19, 22, 20, 18, 21], hp: 3 },
        { tipo: "drone", n: 6, t: 30, cada: 0.9, carriles: [11, 15, 13, 9, 17, 13] },
        { tipo: "roller", n: 3, t: 42, cada: 5, carriles: [13, 7, 19] },
        { tipo: "crawler", n: 8, t: 55, cada: 1.4, carriles: [4, 22, 8, 18, 12, 14, 6, 20], hp: 3 },
        { tipo: "roller", n: 4, t: 75, cada: 3, carriles: [10, 16, 6, 20] },
      ],
      inicial: { "TUR-01": TORRETA_CLIC, "TUR-02": TORRETA_CLIC },
    },
    {
      clave: "ordenes", titulo: "4 · Órdenes", etiqueta: "Clic · vehículos",
      objetivo: "Los vehículos y las ruedas esperan tus clics. Terreno: ir allí. Enemigo: los vehículos lo persiguen a distancia de tiro y las ruedas van en zigzag y detonan. Elige unidades en la fila de arriba para que solo ellas reciban el clic.",
      pregunta: "¿Mandar con clics a unidades que ya tienen programa se siente como dirigir la batalla? ¿Hace falta elegir quién recibe el clic?",
      pista: "Sin selección el clic llega a todas las que lo escuchan. onDamage es otro evento, este del mundo: el vehículo vuelve solo cuando le queda 1 de vida.",
      muro: 20, puertas: [8, 17],
      unidades: [...TUR, RAD, ...VEH, ...WHL(2, 10)],
      oleadas: [
        { tipo: "crawler", n: 5, t: 2, cada: 7, carriles: [6, 20, 12, 15, 9] },
        { tipo: "gunner", n: 2, t: 4, cada: 2, carriles: [7, 10] },
        { tipo: "siege", n: 1, t: 10, cada: 1, carriles: [14], vel: 1 },
        { tipo: "gunner", n: 3, t: 40, cada: 1.5, carriles: [17, 20, 23], para: 28 },
        { tipo: "siege", n: 1, t: 44, cada: 1, carriles: [21], vel: 1 },
        { tipo: "drone", n: 6, t: 60, cada: 1, carriles: [8, 18, 11, 16, 13, 6] },
      ],
      inicial: { "TUR-01": TORRETA_SOLA, "TUR-02": TORRETA_SOLA, "VEH-01": VEHICULO_CLIC, "VEH-02": VEHICULO_CLIC, "WHL-01": RUEDA_CLIC, "WHL-02": RUEDA_CLIC },
    },
    {
      clave: "campana", titulo: "5 · Campaña 1", etiqueta: "Batalla larga",
      objetivo: "Cuatro minutos y medio con todo a la vez: oleadas contra el muro, tiradores, tres cañones de asedio y rodadores. Los programas funcionan solos; tus clics deciden las prioridades.",
      pregunta: "En una batalla de varios minutos, ¿los clics mantienen al jugador dentro sin convertirla en un juego de reflejos? ¿Qué parte quieres automatizar y cuál mandar a mano?",
      pista: "Los vehículos patrullan solos; un clic manda sobre ellos durante 10 o 20 s y luego vuelven a su programa. Las ruedas solo salen con un clic tuyo sobre un enemigo.",
      muro: 16, puertas: [8, 17],
      unidades: [...TUR, RAD, ...VEH, ...WHL(3, 12)],
      oleadas: [
        { tipo: "crawler", n: 6, t: 2, cada: 4, carriles: [6, 20, 10, 16, 13, 8] },
        { tipo: "drone", n: 5, t: 14, cada: 1.2, carriles: [12, 15, 9, 18, 13] },
        { tipo: "gunner", n: 2, t: 26, cada: 2, carriles: [10, 16] },
        { tipo: "siege", n: 1, t: 32, cada: 1, carriles: [13] },
        { tipo: "crawler", n: 6, t: 60, cada: 2.5, carriles: [4, 22, 7, 19, 11, 15], hp: 3 },
        { tipo: "roller", n: 3, t: 78, cada: 5, carriles: [13, 6, 20] },
        { tipo: "gunner", n: 3, t: 100, cada: 1.5, carriles: [4, 7, 10], para: 27 },
        { tipo: "siege", n: 1, t: 104, cada: 1, carriles: [6] },
        { tipo: "drone", n: 10, t: 125, cada: 0.8, carriles: [20, 17, 22, 15, 19, 12, 9, 14, 6, 11] },
        { tipo: "gunner", n: 3, t: 150, cada: 1.5, carriles: [17, 20, 23], para: 27 },
        { tipo: "siege", n: 1, t: 154, cada: 1, carriles: [21] },
        { tipo: "roller", n: 5, t: 175, cada: 3, carriles: [9, 17, 5, 21, 13] },
        { tipo: "crawler", n: 10, t: 195, cada: 1.8, carriles: [5, 21, 8, 18, 11, 15, 13, 3, 23, 13], hp: 3 },
        { tipo: "drone", n: 8, t: 215, cada: 0.7, carriles: [13, 10, 16, 7, 19, 12, 14, 9] },
      ],
      inicial: {
        "TUR-01": TORRETA_CLIC, "TUR-02": TORRETA_CLIC, "VEH-01": VEHICULO_CAMPANA, "VEH-02": VEHICULO_CAMPANA,
        "WHL-01": RUEDA_CLIC, "WHL-02": RUEDA_CLIC, "WHL-03": RUEDA_CLIC,
      },
    },
  ];

  const API = { ESCENARIOS };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else raiz.LAB_ESCENARIOS = API;
})(typeof window !== "undefined" ? window : globalThis);
