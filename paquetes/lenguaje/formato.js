const r2 = v => Math.round(v * 100) / 100;
export const fmtLugar = (l) => l ? `{x: ${r2(l.x)}, y: ${r2(l.y)}, z: ${r2(l.z || 0)}${l.id ? `, id: "${l.id}"` : ""}}` : "null";
export const fmtValor = (v) => v == null ? "null" : typeof v === "object" ? fmtLugar(v) : String(v);
