const cb = () => console.log("cb");
queueMicrotask(cb);
queueMicrotask(cb);
console.log("fin");
