const f = [];
for (let i = 0; i < 2; i++) { f.push((i) => i); }
console.log(f[0](9), f[1](8));
