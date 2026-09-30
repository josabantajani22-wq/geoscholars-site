#!/usr/bin/env python3
"""
Convert the Geoscholars PYQ compilations (GATE GG, IIT JAM, CSIR NET Earth Sciences, UPSC CGSE Prelims)
into per-paper test files for the website:
  data/pyq/<id>.json          one full paper (questions + key + sections + marking)
  data/pyq-index.js           catalogue (window.GSA_PYQ) used by tests.html / test.html to load papers on demand

Usage:  pip install python-docx
        python tools/convert_pyq.py "path/to/folder with the 4 docx"
"""
import glob, json, os, re, sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "pyq")
os.makedirs(OUT, exist_ok=True)

OPT_RE = re.compile(r"^\(([A-Da-d1-4])\)\s*(.*)$")
Q_RE = re.compile(r"^(GA\s+)?Q\.(\d+)\s+(.*)$")           # GATE / JAM / CSIR
QN_RE = re.compile(r"^(\d{1,3})\.\s+(.*)$")                # CGSE
MARK_RE = re.compile(r"\s*\[(\d+(?:\.\d+)?) marks?\]\s*")
BAD = ("[Options could not be separated reliably]",)


def items(path):
    d = Document(path)
    out = []
    for el in d.element.body.iterchildren():
        if el.tag.endswith("}p"):
            p = Paragraph(el, d)
            out.append(("P", p.style.name if p.style is not None else "", p.text.strip()))
        elif el.tag.endswith("}tbl"):
            t = Table(el, d)
            out.append(("T", "", [[c.text.strip() for c in r.cells] for r in t.rows]))
    return out


def chapters(it):
    """Split by Heading 1; skip the front matter (before the second occurrence of the first H1 title, i.e. after TOC)."""
    h1 = [i for i, x in enumerate(it) if x[0] == "P" and x[1].startswith("Heading 1")]
    # the TOC repeats H1 titles as plain paragraphs, real chapters are Heading 1 styled – fine.
    chaps = []
    for k, i in enumerate(h1):
        e = h1[k + 1] if k + 1 < len(h1) else len(it)
        chaps.append((it[i][2], it[i + 1:e]))
    return chaps


def parse_questions(block, numbered):
    """Return list of dicts {sec, prefix, num, text, options[]} in document order, plus section list."""
    qs, secs, cur, sec = [], [], None, None
    for kind, style, text in block:
        if kind != "P":
            continue
        if style.startswith("Heading 2"):
            if text.lower().startswith("answer key"):
                sec = None
                continue
            sec = text
            secs.append(sec)
            continue
        if sec is None or not text:
            continue
        m = (QN_RE if numbered else Q_RE).match(text)
        if m and not OPT_RE.match(text):
            if numbered:
                prefix, num, body = "", int(m.group(1)), m.group(2)
            else:
                prefix, num, body = ("GA" if m.group(1) else ""), int(m.group(2)), m.group(3)
            marks = None
            mm = MARK_RE.search(body)
            if mm:
                marks = float(mm.group(1)); body = MARK_RE.sub(" ", body).strip()
            cur = {"sec": sec, "prefix": prefix, "num": num, "text": body, "options": [], "marks": marks}
            qs.append(cur)
            continue
        om = OPT_RE.match(text)
        if cur and om:
            cur["options"].append(om.group(2).strip())
            continue
        if cur:  # continuation line of the question stem (before options) or option text
            if cur["options"]:
                cur["options"][-1] += " " + text
            else:
                cur["text"] += " " + text
    return qs, secs


def parse_keys(block):
    """Answer-key tables → {(prefix,num): {"key": str, "type": str, "marks": float|None}}"""
    keys = {}
    for kind, _, rows in block:
        if kind != "T" or not rows:
            continue
        head = [h.lower() for h in rows[0]]
        if "q. no." not in head[0]:
            continue
        # find column groups
        groups = [i for i, h in enumerate(head) if h.startswith("q. no")]
        for r in rows[1:]:
            for g in groups:
                q = r[g].strip() if g < len(r) else ""
                if not q:
                    continue
                pm = re.match(r"^(GA)?\s*(\d+)$", q)
                if not pm:
                    continue
                typ = r[g + 1].strip() if "type" in head[g + 1:g + 2][0:1] or (g + 1 < len(head) and head[g + 1] == "type") else "MCQ"
                if g + 1 < len(head) and head[g + 1] == "type":
                    key = r[g + 2].strip(); marks = r[g + 3].strip() if g + 3 < len(r) else ""
                else:
                    key = r[g + 1].strip(); marks = ""
                keys[((pm.group(1) or ""), int(pm.group(2)))] = {"key": key, "type": typ.upper(), "marks": float(marks) if re.match(r"^\d+(\.\d+)?$", marks) else None}
    return keys


LETTER = {"A": 0, "B": 1, "C": 2, "D": 3, "1": 0, "2": 1, "3": 2, "4": 3}


def build(qs, keys, scheme):
    """Attach keys; return (questions, sections) in site format. scheme(q) -> (marks, negative)"""
    out, sections, sec_start, last_sec = [], [], 0, None
    for q in qs:
        k = keys.get((q["prefix"], q["num"]))
        if not k:
            continue
        key = k["key"].strip()
        if key in ("", "X", "—", "-", "MTA", "DROP", "*"):
            continue
        typ = k["type"] if k["type"] in ("MCQ", "MSQ", "NAT") else "MCQ"
        if any(b in o for o in q["options"] for b in BAD):
            continue
        # unusable without the original figure / expression, or OCR junk
        if "[figure" in q["text"].lower() or "[shown as an image" in q["text"].lower():
            continue
        if typ != "NAT" and (any("[shown as an image" in o.lower() or not re.search(r"[A-Za-z0-9]", o) for o in q["options"]) or len(q["options"]) < 2):
            continue
        item = {"text": q["text"].strip(), "type": typ.lower(), "solution": ""}
        if typ == "NAT":
            rm = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*(?:to|-|–)\s*(-?\d+(?:\.\d+)?)\s*$", key)
            if rm:
                lo, hi = float(rm.group(1)), float(rm.group(2))
            elif re.match(r"^-?\d+(\.\d+)?$", key):
                lo = hi = float(key)
            else:
                continue
            item["options"] = []; item["answer"] = [min(lo, hi), max(lo, hi)]
        elif typ == "MSQ":
            idx = sorted({LETTER[c] for c in re.findall(r"[A-D1-4]", key.upper()) if c in LETTER})
            if not idx or len(q["options"]) < 2:
                continue
            item["options"] = q["options"]; item["answer"] = idx
        else:
            c = key.upper().strip()
            if c not in LETTER or len(q["options"]) < 2 or LETTER[c] >= len(q["options"]):
                continue
            item["options"] = q["options"]; item["answer"] = LETTER[c]
        m, neg = scheme(q, k, typ)
        item["marks"], item["negative"] = m, neg
        if q["sec"] != last_sec:
            if last_sec is not None:
                sections.append({"name": short(last_sec), "from": sec_start, "to": len(out)})
            sec_start, last_sec = len(out), q["sec"]
        out.append(item)
    if last_sec is not None:
        sections.append({"name": short(last_sec), "from": sec_start, "to": len(out)})
    return out, sections


def short(sec):
    s = re.sub(r"\s*[—–-]\s*Q\.?\s*\d+.*$", "", sec)          # drop "— Q.1 to Q.10 …"
    s = re.sub(r"\s*\(.*?\)\s*$", "", s).strip()
    return s[:60]


def r3(x):
    return round(x, 4)


# ------------------------------------------------------------------ schemes
def gate_scheme(q, k, typ):
    m = k["marks"] or q["marks"] or 1
    return (m, r3(m / 3) if typ == "MCQ" else 0)

def jam_scheme(q, k, typ):
    m = k["marks"] or q["marks"] or 1
    return (m, r3(m / 3) if typ == "MCQ" else 0)

def csir_scheme(q, k, typ):
    if q["sec"].startswith("Part C"):
        return (4.75, 1.1875)
    return (2, 0.5)

def cgse_scheme(paper):
    def f(q, k, typ):
        return (r3(100 / 120), r3(100 / 120 / 3)) if paper == 1 else (2.5, r3(2.5 / 3))
    return f


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main(folder):
    catalog = []

    def emit(test):
        test["questions"] = test.pop("questions")
        with open(os.path.join(OUT, test["id"] + ".json"), "w", encoding="utf-8") as fh:
            json.dump(test, fh, ensure_ascii=False)
        yr = re.search(r"(20\d\d)", test["year"] + " " + test["title"]); mon = 12 if "december" in test["year"].lower() else 6 if "june" in test["year"].lower() else 1
        sort_key = f"{yr.group(1) if yr else '0000'}-{mon:02d}-{'1' if 'Paper I' in test['year'] and 'Paper II' not in test['year'] else '2'}"
        catalog.append({k: test[k] for k in ("id", "exam", "year", "title", "durationMinutes", "category")} | {"sort": sort_key, "questions": len(test["questions"]), "maxMarks": round(sum(q["marks"] for q in test["questions"]), 2), "file": f"data/pyq/{test['id']}.json", "sections": [s["name"] for s in test["sections"]]})
        print(f"  {test['id']}: {len(test['questions'])} questions, {len(test['sections'])} sections")

    # ---- GATE
    for path in glob.glob(os.path.join(folder, "GATE_GG*.docx")):
        print("GATE:", os.path.basename(path))
        for title, block in chapters(items(path)):
            ym = re.search(r"GATE (\d{4})", title)
            if not ym: continue
            qs, _ = parse_questions(block, numbered=False); keys = parse_keys(block)
            questions, sections = build(qs, keys, gate_scheme)
            if not questions: continue
            emit({"id": f"gate-gg-{ym.group(1)}", "exam": "GATE GG", "year": ym.group(1), "title": f"GATE {ym.group(1)} — Geology & Geophysics (Geology)", "category": "Previous year paper", "description": f"Official GATE {ym.group(1)} GG paper (Geology stream) with the official answer key. MCQ: −1/3 of marks for a wrong answer; MSQ and NAT: no negative marking.", "durationMinutes": 180, "sections": sections, "questions": questions})
    # ---- JAM
    for path in glob.glob(os.path.join(folder, "IIT_JAM*.docx")):
        print("JAM:", os.path.basename(path))
        for title, block in chapters(items(path)):
            ym = re.search(r"JAM (\d{4})", title)
            if not ym: continue
            qs, _ = parse_questions(block, numbered=False); keys = parse_keys(block)
            questions, sections = build(qs, keys, jam_scheme)
            if not questions: continue
            emit({"id": f"iit-jam-geology-{ym.group(1)}", "exam": "IIT JAM Geology", "year": ym.group(1), "title": f"IIT JAM {ym.group(1)} — Geology (GG)", "category": "Previous year paper", "description": f"Official JAM {ym.group(1)} Geology paper with the official answer key. MCQ: −1/3 of marks for a wrong answer; MSQ and NAT: no negative marking.", "durationMinutes": 180, "sections": sections, "questions": questions})
    # ---- CSIR NET
    for path in glob.glob(os.path.join(folder, "CSIR_NET*.docx")):
        print("CSIR:", os.path.basename(path))
        for title, block in chapters(items(path)):
            ym = re.search(r"CSIR-UGC NET (.+?) — Earth", title)
            if not ym: continue
            session = ym.group(1).strip().replace(" — ", " ")
            qs, _ = parse_questions(block, numbered=False); keys = parse_keys(block)
            questions, sections = build(qs, keys, csir_scheme)
            if not questions: continue
            sid = slug(session)  # e.g. december-2024-set-1
            emit({"id": f"csir-net-es-{sid}", "exam": "CSIR NET Earth Science", "year": session, "title": f"CSIR-UGC NET {session} — Earth Sciences", "category": "Previous year paper", "description": f"Official CSIR-UGC NET {session} Earth, Atmospheric, Ocean & Planetary Sciences paper with the NTA final key. Part A/B: +2, −0.5 · Part C: +4.75, −1.1875. (In the real exam only 15 of Part A, 35 of Part B and 25 of Part C are counted.)", "durationMinutes": 180, "sections": sections, "questions": questions})
    # ---- UPSC CGSE
    for path in glob.glob(os.path.join(folder, "UPSC_CGSE*.docx")):
        print("CGSE:", os.path.basename(path))
        for title, block in chapters(items(path)):
            ym = re.search(r"Examination, (\d{4})", title)
            if not ym: continue
            year = ym.group(1)
            # split the chapter into Paper I / Paper II by Heading 2
            h2 = [i for i, x in enumerate(block) if x[0] == "P" and x[1].startswith("Heading 2")]
            for k, i in enumerate(h2):
                e = h2[k + 1] if k + 1 < len(h2) else len(block)
                ptitle = block[i][2]; pno = 1 if "Paper I " in ptitle or ptitle.startswith("Paper I —") else 2
                sub = block[i:e]
                qs, _ = parse_questions(sub, numbered=True); keys = parse_keys(sub)
                if not keys: continue
                questions, sections = build(qs, keys, cgse_scheme(pno))
                if not questions: continue
                emit({"id": f"upsc-cgse-{year}-paper-{pno}", "exam": "UPSC Geo-Scientist (Prelims)", "year": f"{year} · Paper {'I' if pno == 1 else 'II'}", "title": f"UPSC Combined Geo-Scientist Prelims {year} — Paper {'I (General Studies)' if pno == 1 else 'II (Geology / Hydrogeology)'}", "category": "Previous year paper", "description": f"Official UPSC CGSE {year} {'Paper I (General Studies, 100 marks)' if pno == 1 else 'Paper II (Geology / Hydrogeology, 300 marks)'} with the official key. Negative marking: one-third of the marks for a wrong answer.", "durationMinutes": 120 if pno == 1 else 180, "sections": [{"name": "Paper " + ("I" if pno == 1 else "II"), "from": 0, "to": len(questions)}], "questions": questions})

    catalog.sort(key=lambda c: (c["exam"], c["sort"]), reverse=False)
    with open(os.path.join(ROOT, "data", "pyq-index.js"), "w", encoding="utf-8") as fh:
        fh.write("// Generated by tools/convert_pyq.py — previous-year papers available as online mock tests.\n")
        fh.write("window.GSA_PYQ = " + json.dumps(catalog, ensure_ascii=False, indent=1) + ";\n")
    print(f"catalogue: {len(catalog)} papers → data/pyq-index.js")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
