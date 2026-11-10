// Solo preparación de terceros. El juego sirve el resultado local sin npm ni CDN.
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const aqui = path.dirname(fileURLToPath(import.meta.url));
const destino = path.resolve(aqui, "../../shared/vendor/codemirror");
await mkdir(destino, { recursive: true });
const resultado = await build({ absWorkingDir: aqui, entryPoints: ["entrada.js"], bundle: true, format: "iife", globalName: "CMGCodeMirror", target: "es2020", minify: true, legalComments: "eof", metafile: true, outfile: path.join(destino, "codemirror.min.js") });
const paquetes = new Set(Object.keys(resultado.metafile.inputs).flatMap(p => {
  const m = p.match(/node_modules\/(\@[^/]+\/[^/]+|[^/]+)/); return m ? [m[1]] : [];
}));
const versiones = {}, licencias = [];
for (const nombre of [...paquetes].sort()) {
  const raiz = path.join(aqui, "node_modules", nombre), p = JSON.parse(await readFile(path.join(raiz, "package.json"), "utf8"));
  versiones[nombre] = p.version;
  let licencia;
  for (const f of ["LICENSE", "LICENSE.txt", "LICENSE.md"]) { try { licencia = await readFile(path.join(raiz, f), "utf8"); break; } catch {} }
  if (!licencia) throw Error("Falta licencia de " + nombre);
  licencias.push(`${nombre} ${p.version}\n${licencia}`);
}
await writeFile(path.join(destino, "LICENSES.txt"), licencias.join("\n\n--------------------\n\n"));
const hashes = {};
for (const f of ["codemirror.min.js", "LICENSES.txt"]) hashes[f] = createHash("sha256").update(await readFile(path.join(destino, f))).digest("hex");
await writeFile(path.join(destino, "manifest.json"), JSON.stringify({ paquetes: versiones, sha256: hashes }, null, 2) + "\n");
const manifestGeneral = path.join(destino, "../manifest.json");
const general = JSON.parse(await readFile(manifestGeneral, "utf8"));
for (const f of ["codemirror.min.js", "LICENSES.txt", "manifest.json"]) general["codemirror/" + f] = createHash("sha256").update(await readFile(path.join(destino, f))).digest("hex");
await writeFile(manifestGeneral, JSON.stringify(general, null, 2) + "\n");
console.log("CodeMirror local:", versiones, hashes);
