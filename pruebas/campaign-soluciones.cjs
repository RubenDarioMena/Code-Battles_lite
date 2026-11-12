const luz = 'while (true) {\n  light(outputFull ? "red" : "green");\n  await wait(0.5);\n}\n';
const dos = `const sitio = { steel: SUP_1, polymer: SUP_2, nose: LOT_1, base: LOT_2, charge: LOT_3, motor: LOT_4, missile: LOT_4 };
if (cargo) { await deliver(sitio[cargo]); }
while (true) {
  if (MLD_01.output > 0) { await pickUp(MLD_01); await deliver(LOT_2); }
  else if (MIX_01.output > 0) { await pickUp(MIX_01); await deliver(LOT_3); }
  else if (PRS_01.output > 0) { await pickUp(PRS_01); await deliver(LOT_1); }
  else if (count(SUP_2, "polymer") > 0 && (MLD_01.input === 0 || MIX_01.input === 0)) {
    await pickUp(SUP_2, "polymer");
    const hayBase = count(LOT_2, "base") + MLD_01.output + MLD_01.input, hayCarga = count(LOT_3, "charge") + MIX_01.output + MIX_01.input;
    const res = await deliver(MLD_01.input === 0 && (MIX_01.input > 0 || hayBase <= hayCarga) ? MLD_01 : MIX_01);
    if (res !== "ok") { await deliver(SUP_2); await wait(1); }
  } else if (count(SUP_1, "steel") > 0 && PRS_01.input === 0) { await pickUp(SUP_1, "steel"); await deliver(PRS_01); }
  else { await wait(0.5); }
}
`;
const js = [
  { 'FRK-01': 'await pickUp(BAY_1);\nawait deliver(SUP_1);\n' },
  { 'BOT-01': `while (true) {
  if (PRS_01.input < 2 && count(SUP_1, "steel") > 0) {
    await pickUp(SUP_1, "steel");
    await deliver(PRS_01);
  } else if (PRS_01.output > 0) {
    await pickUp(PRS_01);
    await deliver(LOT_1);
  } else {
    await wait(0.5);
  }
}
`, 'FRK-01': '// libre\n' },
  { 'FRK-01': 'while (!BAY_1.pallet) { await wait(1); }\nawait pickUp(BAY_1);\nawait deliver(SUP_2);\n', 'BOT-01': dos },
  { 'FRK-01': `BAY_1.request("polymer");
await pickUp(MIX_01);
await deliver(PAD_4);
while (count(SUP_2, "polymer") > 0) { await wait(1); }
await pickUp(SUP_2);
await deliver(STK_1);
while (!BAY_1.pallet) { await wait(1); }
await pickUp(BAY_1);
await deliver(SUP_2);
`, 'BOT-01': dos },
  { 'FRK-01': '// libre\n', 'BOT-01': '// lo dirige CTL-01\n', 'ASM-01': luz, 'CTL-01': `async function mover(de, pieza, a) {
  await BOT_01.pickUp(de, pieza);
  return BOT_01.deliver(a);
}
const sitio = { steel: SUP_1, polymer: SUP_2, nose: LOT_1, base: LOT_2, charge: LOT_3, motor: LOT_4, missile: LOT_4 };
if (BOT_01.cargo) { await BOT_01.deliver(sitio[BOT_01.cargo]); }
ASM_01.setRecipe("motor");
for (let i = 0; i < 6; i++) {
  await mover(LOT_2, "base", ASM_01);
  await mover(LOT_3, "charge", ASM_01);
  while (ASM_01.output === 0) { await wait(0.5); }
  await mover(ASM_01, "motor", LOT_4);
}
while (ASM_01.state === "working") { await wait(0.5); }
console.log(ASM_01.setRecipe("missile"));
while (ASM_01.state === "changeover") { await wait(0.5); }
for (let i = 0; i < 6; i++) {
  await mover(LOT_1, "nose", ASM_01);
  await mover(LOT_4, "motor", ASM_01);
  while (ASM_01.output === 0) { await wait(0.5); }
  await mover(ASM_01, "missile", LOT_4);
}
` },
  { 'BLT-01': 'start();\n', 'BOT-01': dos, 'BOT-02': `while (true) {
  if (count(LOT_4, "missile") > 0 && !busy) {
    await pickUp(LOT_4, "missile");
    while (await deliver(BLT_01) === "lleno") { await wait(0.5); }
  } else { await wait(0.5); }
}
`, 'CTL-01': `async function mover(de, pieza, a) {
  await BOT_02.pickUp(de, pieza);
  return BOT_02.deliver(a);
}
while (count(LOT_2, "base") < 6 || count(LOT_3, "charge") < 6 || count(LOT_1, "nose") < 6 || count(LOT_4, "missile") > 0 || BOT_02.busy) { await wait(1); }
ASM_01.setRecipe("motor");
while (ASM_01.state === "changeover") { await wait(0.5); }
for (let i = 0; i < 6; i++) {
  await mover(LOT_2, "base", ASM_01);
  await mover(LOT_3, "charge", ASM_01);
  while (ASM_01.output === 0) { await wait(0.5); }
  await mover(ASM_01, "motor", LOT_4);
}
while (ASM_01.state === "working") { await wait(0.5); }
ASM_01.setRecipe("missile");
while (ASM_01.state === "changeover") { await wait(0.5); }
for (let i = 0; i < 6; i++) {
  await mover(LOT_1, "nose", ASM_01);
  await mover(LOT_4, "motor", ASM_01);
}
` },
];
module.exports = { js };
