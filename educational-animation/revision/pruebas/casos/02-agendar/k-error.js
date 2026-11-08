queueMicrotask(() => { throw new Error("fallo callback"); });
console.log("fin");
