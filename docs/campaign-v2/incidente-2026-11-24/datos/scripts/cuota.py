import json, glob, os
for cuenta, base in (("codex", "~/.codex"), ("astra", "~/.codex-astra")):
    for f in sorted(glob.glob(os.path.expanduser(base + "/sessions/2026/11/2[2-5]/*.jsonl"))):
        rs = []
        for l in open(f):
            if '"rate_limits"' not in l: continue
            d = json.loads(l); r = d["payload"].get("rate_limits") or {}
            if r.get("primary"): rs.append((r["primary"]["used_percent"], r["secondary"]["used_percent"]))
        if rs: print(cuenta, os.path.basename(f)[8:24], "5h:", rs[0][0], "->", rs[-1][0], "| semana:", rs[0][1], "->", rs[-1][1])
