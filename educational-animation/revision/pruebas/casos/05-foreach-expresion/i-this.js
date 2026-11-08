const o = { k: 10, ver(l) { l.forEach(function (x) { console.log(this.k + x); }, this); } };
o.ver([1]);
