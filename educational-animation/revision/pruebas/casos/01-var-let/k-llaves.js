const f = [];
for (let i = 0; i < 2; i++) { f.push(() => { return i; }); }
console.log(f[0](), f[1]());
