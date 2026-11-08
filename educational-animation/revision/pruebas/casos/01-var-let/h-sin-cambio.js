const f = [];
for (let i = 0; i < 3; i++) { const base = 10; f.push(() => base); }
console.log(f[0]());
