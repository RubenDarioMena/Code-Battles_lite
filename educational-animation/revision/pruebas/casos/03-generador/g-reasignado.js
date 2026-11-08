function* g() { console.log("cuerpo"); }
function* k() {}
let it = g();
it = k();
it.next();
