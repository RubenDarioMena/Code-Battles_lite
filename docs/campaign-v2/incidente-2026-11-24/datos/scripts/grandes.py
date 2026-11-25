import json, glob, os, re, sys
from collections import Counter
cat = Counter(); total = 0
for cuenta, base in (("codex", "~/.codex"), ("astra", "~/.codex-astra")):
    for f in sorted(glob.glob(os.path.expanduser(base + "/sessions/2026/11/24/*.jsonl"))):
        L = [json.loads(l) for l in open(f) if l.strip()]
        calls = {}; eventos = []
        n_llamadas = sum(1 for d in L if d.get("payload", {}).get("type") == "token_count" and d["payload"].get("info"))
        k = 0
        for d in L:
            p = d.get("payload", {}); t = p.get("type")
            if t == "token_count" and p.get("info"): k += 1
            if t in ("function_call", "custom_tool_call"):
                calls[p.get("call_id")] = str(p.get("input") or p.get("arguments") or "")
            if t in ("function_call_output", "custom_tool_call_output"):
                o = p.get("output"); s = o if isinstance(o, str) else json.dumps(o)
                cmd = calls.get(p.get("call_id"), "")
                restantes = n_llamadas - k
                peso = len(s) / 4 * restantes  # tokens re-enviados aprox
                total += peso
                c = re.findall(r"(sed -n|cat |rg |grep |git diff|git show|node pruebas/todas|node pruebas/[\w-]+|ls |find |wc |apply_patch|python3)", cmd)
                cat[c[0] if c else "otro"] += peso
                eventos.append((peso, len(s), restantes, cmd[:150].replace("\\n", " ")))
        eventos.sort(reverse=True)
        print("==", cuenta, os.path.basename(f)[8:24])
        for e in eventos[:4]: print(f"  {e[0]/1e6:5.2f}M re-enviados | {e[1]:7d} chars | {e[2]:3d} llamadas después | {e[3]}")
print("\nTokens re-enviados aprox por tipo de comando (24-nov):")
for k, v in cat.most_common(12): print(f"  {k:22s} {v/1e6:6.1f}M  ({100*v/total:4.1f}%)")
print(f"  total {total/1e6:.1f}M")
