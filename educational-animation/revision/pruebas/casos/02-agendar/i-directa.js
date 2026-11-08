const cb = () => console.log("cb");
queueMicrotask(cb);
cb();
console.log("fin");
