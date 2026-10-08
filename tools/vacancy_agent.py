#!/usr/bin/env python3
"""
GSA Vacancy Agent — researches current geology / geoscience recruitments in India
with Claude + web search and refreshes data/vacancies.js for the website.

Setup (once):
    pip install anthropic
    set ANTHROPIC_API_KEY=sk-ant-...        (Windows)   |   export ANTHROPIC_API_KEY=...  (Mac/Linux)

Run (from the site folder):
    python tools/vacancy_agent.py                 # research + merge + write data/vacancies.js
    python tools/vacancy_agent.py --dry-run       # show what it found, don't write
    python tools/vacancy_agent.py --keep-days 45  # keep closed items for 45 days (default 30)

What it does:
  1. Asks Claude (with the web_search tool) to find every open or upcoming recruitment for
     geologists, geophysicists, hydrogeologists, geoscientists and Earth-science JRF/NET in India,
     checking official sources (UPSC, ONGC, GSI, CGWB, NMDC, Coal India, Oil India, NTA, state PSCs,
     MECL, HCL, UCIL, AMD, NHPC, SAIL, universities).
  2. Gets a strict JSON list back, validates it, and merges with the existing board:
     - same id  → update fields (but keep any manual `summary` edits marked with `locked: true`)
     - new item → add
     - closed for more than --keep-days → drop
  3. Writes data/vacancies.js. Upload that file (or the whole site) to publish.
"""
import argparse, json, os, re, sys, datetime as dt

MODEL = os.environ.get("GSA_AGENT_MODEL", "claude-sonnet-4-5")
PRIVATE_RE = re.compile(r"\b(pvt|private|ltd\.?|llp|inc\.?|consult|wsp|fugro|slb|schlumberger|exxon|chevron|shell|baker hughes|halliburton|vedanta|ultratech|adani|reliance|jacobs|afry|sofomation|geocareergo)\b", re.I)
GOVT_RE = re.compile(r"upsc|psc|ssc|ongc|gsi|geological survey|cgwb|ground water|nmdc|coal india|\bcil\b|mecl|oil india|\boil\b|hindustan copper|\bhcl\b|ucil|uranium|\bamd\b|atomic|nhpc|sail|nalco|neyveli|nlc|singareni|sccl|mineral|mining|mines|directorate|department|ministry|government|govt|state|university|iit|nit|iiser|iisc|csir|nta|ngri|wihg|niot|nio|incois|imd|bhu|isro|drdo|barc|nuclear|water resources|irrigation|municipal|corporation|board|authority|commission|institute|college|nhai|wapcos|railway|rites|ircon|nbcc|gail|iocl|bpcl|hpcl|engineers india|eil|pdil|cmpdi|nmdc|kiocl|moil|hzl|gmdc|ompc|omc|jsmdc|mmtc|tnmagnesite|hutti|birsa", re.I)
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data", "vacancies.js")

SCHEMA_HINT = """Return ONLY a JSON array (no prose, no markdown fence). Each element:
{
 "id": "kebab-case-stable-id e.g. upsc-cgs-2027, ongc-e1-2026, gsi-...",
 "title": "Recruitment title (year included)",
 "organisation": "e.g. UPSC (for GSI & CGWB) | ONGC | NMDC | Coal India | OPSC | NTA / CSIR",
 "posts": integer or null,
 "postNames": "post-wise breakdown if known",
 "qualification": "eligibility for geology-type posts",
 "ageLimit": "as in the notification",
 "fee": "application fee",
 "startDate": "YYYY-MM-DD or empty",
 "lastDate": "YYYY-MM-DD or empty",
 "upcoming": true only if notification is expected but not yet released,
 "examDate": "exam dates / schedule text",
 "location": "All India | state name",
 "tags": ["UPSC","PSU","GATE-based","State PSC","CSIR NET","JRF", ...],
 "applyUrl": "official application / notification URL",
 "sourceUrl": "official page you verified it on",
 "summary": "2 sentences for aspirants: what it is, why it matters, any catch (e.g. via GATE score)"
}
Rules: include only GOVERNMENT / PSU / public-university recruitments relevant to geology graduates/postgraduates (geologist,
asst. geologist, geophysicist, hydrogeologist, scientist-B geology, geoscientist, JRF/project fellow in geology or Earth
sciences at IITs/NITs/IISERs/CSIR labs, mining-geology, GATE-based PSU hiring). Do NOT include private companies or
consultancies. Include items that are open now, closing within 60 days, or officially expected in the next 90 days.
Prefer official URLs over job-portal URLs. Dates must be verified from an official or reliable source (official site,
employment news, Sarkari Result / FreeJobAlert / Adda247 are acceptable for cross-checking); if unknown leave empty rather
than guessing. Return at most 40 items; the most relevant and current first."""


def load_existing():
    if not os.path.exists(DATA):
        return {"updatedAt": "", "items": []}
    src = open(DATA, encoding="utf-8").read()
    m = re.search(r"=\s*(\{.*\})\s*;\s*$", src, re.S)
    return json.loads(m.group(1)) if m else {"updatedAt": "", "items": []}


def research():
    try:
        import anthropic
    except ImportError:
        sys.exit("pip install anthropic   (then set ANTHROPIC_API_KEY)")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ANTHROPIC_API_KEY not set — skipping AI web research (FreeJobAlert feed still runs)."); return []
    client = anthropic.Anthropic()
    today = dt.date.today().isoformat()
    prompt = f"""Today is {today}. You are the vacancy researcher for Geo Scholars Academy, a geology coaching institute in India.
Search the whole web thoroughly — at least 15 distinct searches, e.g.: "geologist recruitment {today[:4]}", "assistant geologist
vacancy", "hydrogeologist recruitment", "geophysicist recruitment PSU", "UPSC Combined Geo-Scientist", "GSI recruitment",
"CGWB scientist B", "ONGC geologist GATE", "NMDC geologist", "Coal India geologist GATE", "Oil India geologist", "MECL recruitment",
"Hindustan Copper geologist", "UCIL / AMD geologist", "NHPC / SJVN / THDC geologist", "Singareni geologist", "state PSC geologist /
assistant geologist" for Odisha, Jharkhand, Chhattisgarh, Madhya Pradesh, Rajasthan, Karnataka, Andhra Pradesh, Telangana, Gujarat,
Maharashtra, West Bengal, Tamil Nadu, Kerala, Uttarakhand, Himachal, Assam, Meghalaya; "Directorate of Mines and Geology recruitment",
"CSIR NET Earth Sciences notification", "JRF geology IIT/NIT/IISER/NGRI/WIHG project vacancy", "Scientist geology ISRO/DRDO/BARC",
"geologist vacancy employment news this week", plus Sarkari Result / FreeJobAlert / Adda247 geology pages to cross-check.
Open the official notification where possible to verify last dates and eligibility.
{SCHEMA_HINT}"""
    for attempt in range(3):
        try:
            resp = client.messages.create(
                model=MODEL, max_tokens=8000,
                tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 30}],
                messages=[{"role": "user", "content": prompt}],
            ); break
        except Exception as e:
            print("API error:", e); 
            if attempt == 2: return []
    if False: resp = client.messages.create(
        model=MODEL, max_tokens=8000,
        tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 20}],
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
    m = re.search(r"\[.*\]", text, re.S)
    if not m:
        sys.exit("Agent returned no JSON:\n" + text[:2000])
    items = json.loads(m.group(0))
    ok = []
    for it in items:
        if not it.get("id") or not it.get("title") or not it.get("organisation"):
            continue
        for k in ("startDate", "lastDate"):
            v = it.get(k) or ""
            it[k] = v if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v) else ""
        it["tags"] = [t for t in (it.get("tags") or []) if isinstance(t, str)]
        it["posts"] = it["posts"] if isinstance(it.get("posts"), int) else None
        it["upcoming"] = bool(it.get("upcoming")) and not it["lastDate"]
        it["source"] = "agent"
        hay = f"{it.get('organisation', '')} {it.get('title', '')}"
        if PRIVATE_RE.search(hay) and not GOVT_RE.search(hay):
            continue   # private-sector — the site lists government/PSU only
        it["id"] = re.sub(r"[^a-z0-9]+", "-", str(it["id"]).lower()).strip("-")[:70] or re.sub(r"[^a-z0-9]+", "-", hay.lower())[:70]
        ok.append(it)
    return ok


def merge(existing, found, keep_days):
    today = dt.date.today()
    by_id = {x["id"]: x for x in existing["items"]}
    norm = lambda s: re.sub(r"[^a-z0-9]", "", (s or "").lower())
    for it in found:
        old = by_id.get(it["id"])
        if not old:   # same recruitment already present under another id (e.g. from FreeJobAlert)?
            for x in by_id.values():
                if x is it: continue
                if it.get("lastDate") and x.get("lastDate") == it["lastDate"] and norm(x.get("organisation"))[:6] == norm(it.get("organisation"))[:6]:
                    old = x; it["id"] = x["id"]; break
        if old:
            if old.get("locked"):
                it["summary"] = old.get("summary", it.get("summary"))
                it["locked"] = True
            old.update({k: v for k, v in it.items() if v not in ("", None, [])})
        else:
            by_id[it["id"]] = it
    kept = []
    for x in by_id.values():
        if x.get("lastDate"):
            age = (today - dt.date.fromisoformat(x["lastDate"])).days
            if age > keep_days:
                continue
        kept.append(x)
    order = lambda x: (0 if x.get("upcoming") else 1, x.get("lastDate") or "9999")
    kept.sort(key=order)
    return {"updatedAt": today.isoformat(), "items": kept}


def write(board):
    with open(DATA, "w", encoding="utf-8") as fh:
        fh.write("// Geology vacancy board. Updated by tools/vacancy_agent.py (AI research agent) — or edit by hand / add from Admin → Vacancies.\n")
        fh.write("// status is derived on the page from lastDate: open / closing soon (≤7 days) / closed. Set \"upcoming\": true for expected notifications.\n")
        fh.write("window.GSA_VACANCIES = ")
        json.dump(board, fh, ensure_ascii=False, indent=2)
        fh.write(";\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--keep-days", type=int, default=30)
    a = ap.parse_args()
    existing = load_existing()
    print(f"Existing board: {len(existing['items'])} items (updated {existing.get('updatedAt') or 'never'})")
    found = research()
    print(f"Agent found {len(found)} items:")
    for it in found:
        print(f"  - [{it.get('lastDate') or ('expected' if it.get('upcoming') else '?')}] {it['organisation']}: {it['title']}")
    board = merge(existing, found, a.keep_days)
    if a.dry_run:
        print(json.dumps(board, indent=2, ensure_ascii=False)); return
    write(board)
    print(f"Wrote {DATA} with {len(board['items'])} items. Upload it to publish.")


if __name__ == "__main__":
    main()
