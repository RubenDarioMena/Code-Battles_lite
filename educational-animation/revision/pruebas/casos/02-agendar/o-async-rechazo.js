setTimeout(async () => {
  await esperar(0.01);
  throw new Error("rechazo asincrono");
}, 0);
console.log("fin");
