import json, glob, os, sys, re
filas = []
for cuenta, base in (("codex", "~/.codex"), ("astra", "~/.codex-astra")):
    for f in sorted(glob.glob(os.path.expanduser(base + "/sessions/2026/11/2[2-5]/*.jsonl"))):
        L = []
        for l in open(f):
            try: L.append(json.loads(l))
            except: pass
        if not L: continue
        t0, t1 = L[0]["timestamp"], L[-1]["timestamp"]
        tot = None; cwd = ""; prompt = ""; modelo = ""; calls = 0; esf = ""
        for d in L:
            p = d.get("payload", {})
            if d.get("type") == "session_meta": cwd = p.get("cwd", "")
            if d.get("type") == "turn_context": modelo = p.get("model", ""); esf = p.get("effort", "") or esf
            if p.get("type") == "token_count" and p.get("info"): tot = p["info"]["total_token_usage"]
            if p.get("type") in ("function_call", "custom_tool_call"): calls += 1
            if not prompt and p.get("type") == "message" and p.get("role") == "user":
                for c in p.get("content", []):
                    tx = c.get("text", "")
                    if tx and not tx.startswith("<"): prompt = tx[:90].replace("\n", " "); break
        filas.append((t0, cuenta, os.path.basename(f)[8:27], t1[11:16], modelo, esf, calls,
                      tot and tot["input_tokens"], tot and tot["cached_input_tokens"], tot and tot["output_tokens"], tot and tot.get("reasoning_output_tokens"), cwd.split("/")[-1], prompt))
for r in sorted(filas):
    print(" | ".join(str(x) for x in r[1:]))
