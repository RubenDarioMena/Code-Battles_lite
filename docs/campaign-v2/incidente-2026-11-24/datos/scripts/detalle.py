import json, glob, os, re
for cuenta, base in (("codex", "~/.codex"), ("astra", "~/.codex-astra")):
    for f in sorted(glob.glob(os.path.expanduser(base + "/sessions/2026/11/2[2-5]/*.jsonl"))):
        L = [json.loads(l) for l in open(f) if l.strip()]
        brief = ""; ctxmax = 0; llamadas = 0; salidas = 0; suites = 0; grandes = 0; compact = 0; first_in = None
        for d in L:
            p = d.get("payload", {})
            t = p.get("type")
            if t == "message" and p.get("role") == "user" and not brief:
                for c in p.get("content", []):
                    m = re.search(r"#\s*Brief[^\n]*|>\s*Una sesión[^\n]*", c.get("text", ""))
                    if m: brief = m.group(0)[:80]
            if t == "token_count" and p.get("info"):
                li = p["info"]["last_token_usage"]["input_tokens"]; ctxmax = max(ctxmax, li); llamadas += 1
                if first_in is None: first_in = li
            if t in ("function_call_output", "custom_tool_call_output"):
                o = p.get("output"); s = json.dumps(o) if not isinstance(o, str) else o
                salidas += len(s)
                if len(s) > 20000: grandes += 1
            if t in ("function_call", "custom_tool_call"):
                s = json.dumps(p.get("input") or p.get("arguments") or "")
                suites += s.count("pruebas/todas.mjs")
            if d.get("type") == "compacted" or t == "context_compacted": compact += 1
        if llamadas: print(cuenta, os.path.basename(f)[8:24], "| llamadas modelo", llamadas, "| ctx inicial", first_in, "| ctx max", ctxmax, "| chars salidas herramientas", salidas, "| salidas>20k", grandes, "| menciones todas.mjs", suites, "| compactaciones", compact, "|", brief)
