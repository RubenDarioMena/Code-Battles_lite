const f = [];
f.push = cb => cb();
for (let i = 0; i < 2; i++) console.log(f.push(() => i));
