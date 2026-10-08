#!/usr/bin/env python3
"""Build the OPSC Geologist 2019 previous-year papers (official OPSC booklets, GSA answer key)
into data/pyq/*.json and merge them into data/pyq-index.js.

Sources (scanned official booklets, OCR'd + hand-checked):
  T.B.C. GGM-1/2019  Paper I  General Studies & Awareness  100 Q, 200 marks, 2 h   -> tools/opsc_pyq_p1.txt
  T.B.C. GGM-2/2019  Paper II Geology                      150 Q, 300 marks, 3 h   -> tools/opsc_pyq_p2.txt
  T.B.C. GGM-4/2019  Paper II Mining Officer (Applied Geology) 150 Q, 300 marks, 3 h -> tools/opsc_pyq_mo.txt

Text format: "N. question", four "(X) option" lines, "=X" key line. "## Name" starts a section.
OPSC did not publish a key for these booklets; the key here is GSA's. The 2019 booklets had NO negative
marking (the current OPSC pattern is +2 / -0.5) — we keep the 2019 scheme for the real papers.
Usage:  python3 tools/opsc_pyq.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "pyq")
Q_RE = re.compile(r"^(\d+)\.\s+(.*)$")
OPT_RE = re.compile(r"^\(([A-D])\)\s+(.*)$")


def parse(path, marks):
    questions, sections, cur = [], [], None
    q = None
    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n").strip()
        if not line:
            continue
        if line.startswith("## "):
            if cur: cur["to"] = len(questions)
            cur = {"name": line[3:].strip(), "from": len(questions), "to": None}; sections.append(cur); continue
        m = Q_RE.match(line)
        if m and q is None:
            q = {"text": m.group(2).strip(), "type": "mcq", "solution": "", "options": [], "answer": None, "marks": marks, "negative": 0}
            continue
        m = OPT_RE.match(line)
        if m and q is not None:
            q["options"].append(m.group(2).strip()); continue
        if line.startswith("=") and q is not None:
            q["answer"] = "ABCD".index(line[1].upper())
            assert len(q["options"]) == 4, f"{path}: bad options for '{q['text'][:40]}'"
            questions.append(q); q = None; continue
        if q is not None:  # continuation of question text
            q["text"] += " " + line
    if cur: cur["to"] = len(questions)
    if not sections: sections = [{"name": "Paper", "from": 0, "to": len(questions)}]
    return questions, sections


PAPERS = [
    dict(src="opsc_pyq_p1.txt", id="opsc-geologist-2019-paper-1", exam="OPSC Geologist", year="2019 · Paper I",
         title="OPSC Geologist 2019 — Paper I (General Studies & Awareness)", durationMinutes=120, marks=2,
         description="Official OPSC Geologist 2019 Paper I booklet (T.B.C. GGM-1/2019): 100 questions, 200 marks, 2 hours. "
                     "Answer key prepared by Geo Scholars Academy (OPSC did not publish one). No negative marking in the 2019 paper; "
                     "the current OPSC pattern is +2 / −0.5."),
    dict(src="opsc_pyq_p2.txt", id="opsc-geologist-2019-paper-2", exam="OPSC Geologist", year="2019 · Paper II (Geology)",
         title="OPSC Geologist 2019 — Paper II (Geology)", durationMinutes=180, marks=2,
         description="Official OPSC Geologist 2019 Paper II booklet (T.B.C. GGM-2/2019): 150 questions, 300 marks, 3 hours, "
                     "covering geomorphology, structural geology, geodynamics, stratigraphy, palaeontology, igneous petrology, sedimentology, "
                     "rock mechanics and remote sensing/GIS. Three questions with defective options in the original paper are omitted. "
                     "Answer key prepared by Geo Scholars Academy. No negative marking in the 2019 paper; current pattern is +2 / −0.5."),
    dict(src="opsc_pyq_mo.txt", id="opsc-mining-officer-2019-paper-2", exam="OPSC Geologist", year="2019 · Paper II (Applied Geology, Mining Officer)",
         title="OPSC Mining Officer 2019 — Paper II (Applied Geology)", durationMinutes=180, marks=2,
         description="Official OPSC 2019 Paper II booklet for Mining Officer (Applied Geology), T.B.C. GGM-4/2019 — same recruitment cycle and "
                     "syllabus family as the Geologist paper: 150 questions, 300 marks, 3 hours. Answer key prepared by Geo Scholars Academy. "
                     "No negative marking in the 2019 paper; current pattern is +2 / −0.5."),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    idx_path = os.path.join(ROOT, "data", "pyq-index.js")
    src = open(idx_path, encoding="utf-8").read()
    catalog = json.loads(src[src.index("[") : src.rindex("]") + 1])
    catalog = [c for c in catalog if not c["id"].startswith("opsc-")]
    for i, p in enumerate(PAPERS):
        questions, sections = parse(os.path.join(ROOT, "tools", p["src"]), p["marks"])
        test = {"id": p["id"], "exam": p["exam"], "year": p["year"], "title": p["title"], "category": "Previous year paper",
                "description": p["description"], "durationMinutes": p["durationMinutes"], "sections": sections, "questions": questions}
        with open(os.path.join(OUT, p["id"] + ".json"), "w", encoding="utf-8") as fh:
            json.dump(test, fh, ensure_ascii=False)
        catalog.append({"id": p["id"], "exam": p["exam"], "year": p["year"], "title": p["title"], "durationMinutes": p["durationMinutes"],
                        "category": "Previous year paper", "sort": f"2019-01-{len(PAPERS)-i}", "questions": len(questions),
                        "maxMarks": round(sum(q["marks"] for q in questions), 2), "file": f"data/pyq/{p['id']}.json",
                        "sections": [s["name"] for s in sections]})
        print(f"  {p['id']}: {len(questions)} questions, {len(sections)} sections")
    catalog.sort(key=lambda c: (c["exam"], c["sort"]))
    with open(idx_path, "w", encoding="utf-8") as fh:
        fh.write("// Generated by tools/convert_pyq.py + tools/opsc_pyq.py — previous-year papers available as online mock tests.\n")
        fh.write("window.GSA_PYQ = " + json.dumps(catalog, ensure_ascii=False, indent=1) + ";\n")
    print(f"catalogue: {len(catalog)} papers → data/pyq-index.js")


if __name__ == "__main__":
    main()
