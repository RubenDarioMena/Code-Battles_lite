import json, glob, os, csv, sys, re
w = csv.writer(open(sys.argv[1], "w", newline=""))
w.writerow(["cuenta","inicio_local","fin_utc","modelo","esfuerzo","llamadas_modelo","entrada","entrada_cacheada","salida","razonamiento","ctx_max","uso_5h_inicio","uso_5h_fin","uso_semana_inicio","uso_semana_fin","worktree","tarea"])
for cuenta, base in (("codex", "~/.codex"), ("codex-astra", "~/.codex-astra")):
    for f in sorted(glob.glob(os.path.expanduser(base + "/sessions/2026/11/2[2-5]/*.jsonl"))):
        L = [json.loads(l) for l in open(f) if l.strip()]
        tot=None; modelo=esf=cwd=tarea=""; n=0; ctx=0; rs=[]
        for d in L:
            p = d.get("payload", {}); t = p.get("type")
            if d.get("type") == "session_meta": cwd = p.get("cwd","").split("/")[-1]
            if d.get("type") == "turn_context": modelo = p.get("model",""); esf = p.get("effort","") or esf
            if t == "token_count" and p.get("info"):
                tot = p["info"]["total_token_usage"]; n += 1; ctx = max(ctx, p["info"]["last_token_usage"]["input_tokens"])
            if t == "token_count" and (p.get("rate_limits") or {}).get("primary"):
                r = p["rate_limits"]; rs.append((r["primary"]["used_percent"], r["secondary"]["used_percent"]))
            if t == "message" and p.get("role") == "user" and not tarea:
                for c in p.get("content", []):
                    m = re.search(r"#\s*Brief[^\n]*|>\s*Una sesión[^\n]*", c.get("text",""))
                    if m: tarea = m.group(0)[:90]
        if not tot: continue
        w.writerow([cuenta, os.path.basename(f)[8:27], L[-1]["timestamp"][:16], modelo, esf, n, tot["input_tokens"], tot["cached_input_tokens"], tot["output_tokens"], tot.get("reasoning_output_tokens",0), ctx,
                    rs[0][0] if rs else "", rs[-1][0] if rs else "", rs[0][1] if rs else "", rs[-1][1] if rs else "", cwd, tarea])
