const receptor = { push: fn => fn() };
for (let i = 0; i < 2; i++) {
  console.log(receptor.push(() => i));
}
