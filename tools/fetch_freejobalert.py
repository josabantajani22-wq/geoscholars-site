#!/usr/bin/env python3
"""
Pull geology / geoscience vacancies from FreeJobAlert.com into data/vacancies.js.

    pip install requests beautifulsoup4 lxml
    python tools/fetch_freejobalert.py            # fetch + merge + write
    python tools/fetch_freejobalert.py --dry-run  # just print what matched

How it works
  1. Downloads a few FreeJobAlert listing pages (latest notifications, M.Sc jobs, PSU, UPSC …).
  2. Each page has tables: Post Date | Recruitment Board | Post Name | Qualification | Advt No | Last Date | More Info.
  3. Keeps rows whose board / post / qualification match geology keywords (KEYWORDS below).
  4. Opens each matching article once to pull posts, age, fee, dates and the official apply link.
  5. Merges into data/vacancies.js: same id -> refreshed; new -> added; closed > --keep-days -> dropped.
     Items added by hand or by the AI agent (tools/vacancy_agent.py) are kept.
  Runs automatically every day via .github/workflows/vacancies.yml when the site is on GitHub.
"""
import argparse, datetime as dt, json, os, re, sys, time

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("pip install requests beautifulsoup4 lxml")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data", "vacancies.js")
BASE = "https://www.freejobalert.com"
PAGES = [
    "/latest-notifications/",
]
# A row is kept when the POST NAME or QUALIFICATION mentions geology (POST_KEYWORDS), or when the recruiting
# BOARD is a core geoscience employer (GEO_BOARDS) — for other PSUs (SAIL, Oil India, NHPC …) the post itself
# must be geology-related, otherwise nurses/advisors at SAIL would leak in.
POST_KEYWORDS = re.compile(
    r"geolog|geo-?scien|geophys|hydro-?geolog|earth science|petroleum|mining engineer|mines? (officer|inspector)|"
    r"mineral|drilling|\bgeo\b|seismic|exploration|reservoir|\bcsir.?net\b|scientist.{0,20}(geo|earth)", re.I)
GEO_BOARDS = re.compile(r"\bgsi\b|geological survey|\bcgwb\b|ground ?water|\bmecl\b|mineral exploration|atomic minerals|\bamd\b|\bgmdc\b|survey of india", re.I)
KEYWORDS = POST_KEYWORDS  # backwards-compat
UA = {"User-Agent": "Mozilla/5.0 (GSA vacancy bot; +https://geoscholarsacademy)"}


def get(url, tries=3):
    for i in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=30)
            if r.status_code == 200:
                return r.text
            if r.status_code == 404:
                return ""
        except requests.RequestException:
            pass
        time.sleep(2 * (i + 1))
    return ""


def parse_date(s):
    s = (s or "").strip()
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%d %b %Y", "%d %B %Y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    m = re.search(r"(\d{1,2})[-/. ](\d{1,2}|[A-Za-z]{3,9})[-/. ](\d{4})", s)
    if m:
        return parse_date(" ".join(m.groups())) if not m.group(2).isdigit() else parse_date("-".join(m.groups()))
    return ""


def parse_listing(html):
    """Yield dicts from every 7-ish column table row that has a details link."""
    soup = BeautifulSoup(html, "lxml")
    for tr in soup.select("table tr"):
        cells = tr.find_all(["td", "th"])
        if len(cells) < 5:
            continue
        text = [c.get_text(" ", strip=True) for c in cells]
        link = tr.find("a", href=re.compile(r"/articles/"))
        if not link:
            continue
        if not re.search(r"\d{2}[-/]\d{2}[-/]\d{4}", " ".join(text)):
            continue
        # column guess: date, board, post, qualification, advt, last date
        row = {"postDate": text[0], "board": text[1], "post": text[2], "qualification": text[3] if len(text) > 3 else "",
               "lastDate": next((t for t in reversed(text) if re.search(r"\d{2}[-/]\d{2}[-/]\d{4}", t)), ""),
               "url": link["href"] if link["href"].startswith("http") else BASE + link["href"]}
        yield row


def enrich(url):
    """Best-effort details from the article page."""
    html = get(url)
    if not html:
        return {}
    soup = BeautifulSoup(html, "lxml")
    txt = soup.get_text("\n", strip=True)
    out = {}
    m = re.search(r"Total\s+(?:Vacancy|Vacancies|Posts?)\s*[:\-–]?\s*(\d[\d,]*)", txt, re.I)
    if m:
        out["posts"] = int(m.group(1).replace(",", ""))
    m = re.search(r"Age Limit[^\n]*\n([^\n]{5,120})", txt, re.I)
    if m:
        out["ageLimit"] = m.group(1).strip()
    m = re.search(r"(?:Application|Exam)\s*Fee[^\n]*\n([^\n]{5,160})", txt, re.I)
    if m:
        out["fee"] = m.group(1).strip()
    m = re.search(r"(?:Starting|Start) Date[^\n]*?(\d{2}[-/]\d{2}[-/]\d{4})", txt, re.I)
    if m:
        out["startDate"] = parse_date(m.group(1))
    m = re.search(r"Qualification[^\n]*\n([^\n]{5,200})", txt, re.I)
    if m:
        out["qualification"] = m.group(1).strip()
    for a in soup.find_all("a", href=True):
        label = a.get_text(" ", strip=True).lower()
        if ("apply online" in label or "official website" in label or "notification" in label) and "freejobalert" not in a["href"]:
            out.setdefault("applyUrl", a["href"])
            if "official" in label:
                out["applyUrl"] = a["href"]
    return out


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:70]


def load_existing():
    if not os.path.exists(DATA):
        return {"updatedAt": "", "items": []}
    m = re.search(r"=\s*(\{.*\})\s*;\s*$", open(DATA, encoding="utf-8").read(), re.S)
    return json.loads(m.group(1)) if m else {"updatedAt": "", "items": []}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--keep-days", type=int, default=30)
    ap.add_argument("--max-enrich", type=int, default=25)
    a = ap.parse_args()

    seen, found = set(), []
    for p in PAGES:
        html = get(BASE + p)
        if not html:
            print("skip (no response):", p); continue
        n = 0
        for row in parse_listing(html):
            if row["url"] in seen:
                continue
            if not (POST_KEYWORDS.search(f"{row['post']} {row['qualification']}") or GEO_BOARDS.search(row["board"])):
                continue
            seen.add(row["url"]); found.append(row); n += 1
        print(f"{p}: {n} geology rows")

    print(f"{len(found)} matching rows; enriching up to {a.max_enrich} article pages …")
    items = []
    for i, r in enumerate(found):
        extra = enrich(r["url"]) if i < a.max_enrich else {}
        last = parse_date(r["lastDate"])
        art_id = re.search(r"-(\d+)/?$", r["url"])
        post_txt = re.sub(r"\s+", " ", r["post"]).strip()
        m_posts = re.search(r"[–\-]\s*(\d[\d,]*)\s*posts?\s*$", post_txt, re.I)
        if m_posts:
            post_txt = post_txt[:m_posts.start()].strip(" –-")
        n_posts = extra.get("posts") or (int(m_posts.group(1).replace(",", "")) if m_posts else None)
        items.append({
            "id": "fja-" + (art_id.group(1) if art_id else slug(r["board"] + "-" + r["post"])),
            "title": f"{r['board'].strip()} — {post_txt}",
            "organisation": r["board"].strip(),
            "posts": n_posts,
            "postNames": post_txt,
            "qualification": extra.get("qualification") or r["qualification"],
            "ageLimit": extra.get("ageLimit", ""),
            "fee": extra.get("fee", ""),
            "startDate": extra.get("startDate", "") or parse_date(r["postDate"]),
            "lastDate": last,
            "upcoming": False,
            "examDate": "",
            "location": "India",
            "tags": ["FreeJobAlert"] + (["UPSC"] if "upsc" in r["board"].lower() else []) + (["PSU"] if re.search(r"ongc|nmdc|coal|oil india|sail|nhpc|hcl|ucil|mecl", r["board"], re.I) else []),
            "applyUrl": extra.get("applyUrl") or r["url"],
            "sourceUrl": r["url"],
            "summary": f"Listed on FreeJobAlert on {r['postDate']}. Qualification: {r['qualification'] or 'see notification'}. Verify details on the official notification before applying.",
            "source": "freejobalert",
        })

    board = load_existing()
    by_id = {x["id"]: x for x in board["items"]}
    today = dt.date.today()
    for it in items:
        old = by_id.get(it["id"])
        if old:
            if old.get("locked"):
                it["summary"] = old.get("summary", it["summary"]); it["locked"] = True
            old.update({k: v for k, v in it.items() if v not in ("", None, [])})
        else:
            by_id[it["id"]] = it
    # Re-apply the geology filter to items this script added earlier (cleans up rows that an older, looser
    # keyword list let through). Hand-added / locked items are never touched.
    kept = []
    for x in by_id.values():
        if x.get("source") == "freejobalert" and not x.get("locked"):
            if not (POST_KEYWORDS.search(f"{x.get('postNames', '')} {x.get('title', '')} {x.get('qualification', '')}") or GEO_BOARDS.search(x.get("organisation", ""))):
                continue
        if x.get("lastDate"):
            try:
                if (today - dt.date.fromisoformat(x["lastDate"])).days > a.keep_days:
                    continue
            except ValueError:
                pass
        kept.append(x)
    kept.sort(key=lambda x: (0 if x.get("upcoming") else 1, x.get("lastDate") or "9999"))
    board = {"updatedAt": today.isoformat(), "items": kept}

    for it in items:
        print(f"  + [{it['lastDate'] or '?'}] {it['title']}")
    if a.dry_run:
        return
    with open(DATA, "w", encoding="utf-8") as fh:
        fh.write("// Geology vacancy board. Refreshed by tools/fetch_freejobalert.py (daily via GitHub Actions) and tools/vacancy_agent.py; edit by hand or add from Admin → Vacancies.\n")
        fh.write("// status is derived on the page from lastDate: open / closing soon (≤7 days) / closed. Set \"upcoming\": true for expected notifications.\n")
        fh.write("window.GSA_VACANCIES = ")
        json.dump(board, fh, ensure_ascii=False, indent=2)
        fh.write(";\n")
    print(f"wrote {DATA}: {len(kept)} items")


if __name__ == "__main__":
    main()
