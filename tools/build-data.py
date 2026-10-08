"""Bihurtu ../ereduak/NN-*.md fitxategiak app/data/ereduak.json formatura.

Erabilera: python3 tools/build-data.py ../ereduak data/ereduak.json
"""
import glob
import json
import os
import re
import sys

BASES = {"2026 ohikoa": "X", "2026 ez-ohikoa": "Y", "2025 ohikoa": "Z", "2025 ez-ohikoa": "W"}


def between(s, start, end=None):
    i = s.index(start) + len(start)
    if end is None:
        return s[i:]
    j = s.find(end, i)
    return s[i:] if j < 0 else s[i:j]


def alts(text):
    """«x, y / z» → ['x', 'y', 'z'] (parentesiak kenduta)."""
    text = re.sub(r"\([^)]*\)", "", text)
    out = [p.strip(" .…") for p in re.split(r"[,/]", text)]
    return [p for p in out if p]


def lettered_inline(line):
    """«a) x · b) y» → {'a': 'x', 'b': 'y'}"""
    parts = re.findall(r"([a-e])\) (.*?)(?= · [a-e]\) |$)", line.strip())
    return {k: v.strip() for k, v in parts}


def lettered_lines(block):
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"^([a-e])\) (.+)$", block, re.M)}


def parse_text(head):
    raw = between(head, "### Irakurgaia", "### A.1").strip()
    lines = [l for l in raw.split("\n\n") if l.strip()]
    title = lines[0].strip().strip("*")
    return {"title": title, "paragraphs": [l.strip() for l in lines[1:]]}


def parse_a1(head, key):
    sec = between(head, "### A.1", "### A.2")
    k = between(key, "**A.1**", "**A.2.1")
    if "Aukeratu erantzun zuzena" in sec:
        qs = []
        for m in re.finditer(r"^(\d+)\. (.+?)\n((?:   [a-d]\) .+\n?)+)", sec, re.M):
            opts = re.findall(r"^   ([a-d])\) (.+)$", m.group(3), re.M)
            qs.append({"q": m.group(2).strip(), "options": [{"k": a, "t": t.strip()} for a, t in opts]})
        answers = dict(re.findall(r"(\d+) ([a-d])", k))
        for i, q in enumerate(qs, 1):
            q["correct"] = answers[str(i)]
        return {"type": "test", "questions": qs}
    qs = lettered_lines(sec)
    ans = lettered_lines(k)
    return {"type": "open", "questions": [{"q": qs[x], "answer": ans[x]} for x in sorted(qs)]}


def parse_a2(head, key):
    sec = between(head, "### A.2", "### A.3")
    ctx = re.search(r"\*\*Testuingurua:\*\* (.+)", sec).group(1).strip()
    gaia = re.search(r"\*\*A\.2\.1 Gaia:\*\* (.+)", key).group(1).strip()
    lab = between(key, "**A.2.2 Eredu-laburpena:**\n", "\n\n").strip()
    return {"context": ctx, "gaia": gaia, "laburpena": lab}


def a3_blocks(head):
    sec = between(head, "### A.3", "## B ATALA")
    pieces = re.split(r"^\*\*(A\.3\.\d) ([^*]+)\*\* \(0,5 puntu\)\.? ?", sec, flags=re.M)
    out = []
    for i in range(1, len(pieces), 3):
        body = pieces[i + 2]
        instr, _, rest = body.partition("\n")
        out.append((pieces[i], pieces[i + 1].strip(), instr.strip(), rest.strip()))
    return out


def key_for(key, num):
    start = f"**{num}**"
    i = key.index(start) + len(start)
    j = key.find("\n\n**", i)
    return key[i:j if j > 0 else None].strip()


def parse_a3(head, key, text_plain):
    items = []
    for num, name, instr, body in a3_blocks(head):
        k = key_for(key, num)
        low = name.lower()
        if low.startswith("akatsak"):
            quote = "\n".join(l[1:].strip() for l in body.split("\n") if l.startswith(">"))
            pairs = []
            for part in k.split(" · "):
                wrong, _, right = part.partition(" → ")
                main, *edo = re.split(r"\s*\((?:edo|hobeto)[: ]", right)
                pairs.append({"wrong": wrong.strip(), "right": [main.strip()] + [e.strip(" )") for e in edo]})
            items.append({"kind": "akatsak", "title": name, "instr": instr, "text": quote, "pairs": pairs})
        elif low.startswith("sinonimoak"):
            words = lettered_inline(body.split("\n")[0])
            acc = lettered_inline(k)
            items.append({"kind": "sinonimoak", "title": name, "instr": instr,
                          "items": [{"w": re.sub(r"\s*\(.*\)", "", words[x]), "accepted": alts(acc[x])} for x in sorted(words)]})
        elif low.startswith("aditz"):
            qs = lettered_lines(body)
            acc = lettered_inline(k)
            out = []
            for x in sorted(qs):
                m = re.match(r"(.*?)\s*\(([^)]*)\)\s*$", qs[x])
                out.append({"sentence": m.group(1), "hint": m.group(2), "accepted": alts(acc[x])})
            items.append({"kind": "aditzak", "title": name, "instr": instr, "items": out})
        elif low.startswith("definizioak"):
            acc = lettered_inline(k)
            if "sinonimo" in instr:
                words = lettered_inline(body.split("\n")[0])
                items.append({"kind": "sinonimoak", "title": name, "instr": instr,
                              "items": [{"w": words[x], "accepted": alts(acc[x])} for x in sorted(words)]})
            else:
                qs = lettered_lines(body)
                items.append({"kind": "definizioak", "title": name, "instr": instr,
                              "items": [{"def": qs[x], "accepted": alts(acc[x])} for x in sorted(qs)]})
        elif low.startswith("berridazketak"):
            qs = lettered_lines(body)
            props = lettered_lines(k)
            with_el = "parentesi arteko elementua" in instr
            out = []
            for x in sorted(qs):
                s, el = qs[x], None
                if with_el:
                    m = re.match(r"(.*?)\s*\(([^)]*)\)\s*$", s)
                    s, el = m.group(1), m.group(2)
                out.append({"sentence": s, "element": el, "proposal": props.get(x, "")})
            items.append({"kind": "berridazketak", "title": name, "instr": instr, "items": out})
        elif low.startswith("eratorpena"):
            opts = []
            for part in k.split(" · "):
                m = re.match(r"(-\S+) \(([^)]*)\)", part.strip())
                opts.append({"suffix": m.group(1), "words": alts(m.group(2))})
            items.append({"kind": "eratorpena", "title": name, "instr": instr, "options": opts})
        else:
            raise ValueError(f"A.3 mota ezezaguna: {name}")
    return items


def parse_b(head, key):
    b1 = between(head, "### B.1", "### B.2")
    ctx = re.search(r"\*\*Testuingurua:\*\* (.+)", b1).group(1).strip()
    opts = [{"label": m.group(1), "genre": m.group(2).strip(), "desc": m.group(3).strip()}
            for m in re.finditer(r"^- \*\*([AB]) aukera — ([^*]+)\*\*:? (.+)$", b1, re.M)]
    notes = key_for(key, "B.1")
    b2 = between(head, "### B.2")
    intro = b2.strip().split("\n")[0].strip()
    lines = [l[1:].strip() for l in b2.split("\n") if l.startswith(">")]
    model = between(key, "**B.2 Eredu-erantzuna:**\n").strip()
    return {"context": ctx, "options": opts, "notes": notes}, {"intro": intro, "lines": lines, "model": model}


def main(src, out):
    models = []
    for p in sorted(glob.glob(os.path.join(src, "[0-9][0-9]-*.md"))):
        s = open(p, encoding="utf-8").read()
        head, _, key = s.partition("\n---\n")
        m = re.match(r"# (\d+)\. eredua — (.*)", head)
        struct = re.search(r"> Egitura: (.*)", head).group(1)
        base = next(b for b in sorted(BASES, key=len, reverse=True) if b in struct)
        text = parse_text(head)
        b1, b2 = parse_b(head, key)
        models.append({
            "id": "e" + m.group(1), "num": m.group(1), "title": m.group(2).strip(),
            "base": base, "mota": BASES[base],
            "text": text,
            "a1": parse_a1(head, key),
            "a2": parse_a2(head, key),
            "a3": parse_a3(head, key, " ".join(text["paragraphs"])),
            "b1": b1, "b2": b2,
        })
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(models, f, ensure_ascii=False, indent=1)
    return models


if __name__ == "__main__":
    ms = main(sys.argv[1], sys.argv[2])
    for m in ms:
        a3 = ", ".join(f"{x['kind']}:{len(x.get('items') or x.get('pairs') or x.get('options'))}" for x in m["a3"])
        print(m["id"], m["mota"], m["a1"]["type"], len(m["a1"]["questions"]), "|", a3, "|", len(m["b1"]["options"]), "aukera,", len(m["b2"]["lines"]), "lerro")
