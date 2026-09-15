#!/usr/bin/env python3
"""
Pull geology jobs from LinkedIn's public (logged-out) job search into data/vacancies.js.

    pip install requests beautifulsoup4 lxml
    python tools/fetch_linkedin.py            # fetch + merge + write
    python tools/fetch_linkedin.py --dry-run  # just print

Uses the public "jobs-guest" listing that LinkedIn serves to visitors who are not signed in
(the same HTML you see at linkedin.com/jobs/search without an account). No login, no API key.
LinkedIn changes this markup now and then and rate-limits aggressive callers, so this script:
  - makes only a handful of requests (one per search phrase), with pauses,
  - fails soft: if nothing parses, the existing board is left untouched,
  - stores each job with source "linkedin", tag "LinkedIn", and expires it 30 days after posting.
Items appear on the site under the "Industry jobs" filter. Runs daily via the GitHub workflow.
"""
import argparse, datetime as dt, json, os, re, sys, time, html

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("pip install requests beautifulsoup4 lxml")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data", "vacancies.js")
SEARCHES = ["geologist", "geology", "hydrogeologist", "mining geologist", "geophysicist", "exploration geologist"]
LOCATION = "India"
ENDPOINT = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-IN,en;q=0.9"}
KEEP = re.compile(r"geolog|geo-?scien|geophys|hydro-?geo|earth scien|mining|mineral|explor|petrol|drill|reservoir|seismic|gis|remote sensing", re.I)
DROP = re.compile(r"\bsales\b|telecall|intern(?!ational)|marketing executive", re.I)


def fetch(keyword, start=0):
    params = {"keywords": keyword, "location": LOCATION, "f_TPR": "r2592000", "start": start}  # last 30 days
    for i in range(3):
        try:
            r = requests.get(ENDPOINT, params=params, headers=UA, timeout=30)
            if r.status_code == 200:
                return r.text
            if r.status_code in (400, 404):
                return ""
        except requests.RequestException:
            pass
        time.sleep(3 * (i + 1))
    return ""


def parse(html_text):
    soup = BeautifulSoup(html_text, "lxml")
    out = []
    for li in soup.select("li"):
        a = li.select_one("a.base-card__full-link, a[href*='/jobs/view/']")
        t = li.select_one(".base-search-card__title, h3")
        if not a or not t:
            continue
        company = li.select_one(".base-search-card__subtitle, h4")
        loc = li.select_one(".job-search-card__location")
        date = li.select_one("time")
        href = a.get("href", "").split("?")[0]
        m = re.search(r"-(\d{6,})/?$", href) or re.search(r"/view/(\d{6,})", href)
        jid = m.group(1) if m else re.sub(r"\W+", "-", t.get_text(strip=True).lower())[:60]
        out.append({
            "jobId": jid, "title": t.get_text(strip=True), "company": company.get_text(strip=True) if company else "",
            "location": loc.get_text(strip=True) if loc else LOCATION,
            "posted": (date.get("datetime") if date and date.get("datetime") else ""), "url": href,
        })
    return out


def load_existing():
    if not os.path.exists(DATA):
        return {"updatedAt": "", "items": []}
    m = re.search(r"=\s*(\{.*\})\s*;\s*$", open(DATA, encoding="utf-8").read(), re.S)
    return json.loads(m.group(1)) if m else {"updatedAt": "", "items": []}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--keep-days", type=int, default=30)
    ap.add_argument("--max", type=int, default=40)
    a = ap.parse_args()
    today = dt.date.today()

    found, seen = [], set()
    for kw in SEARCHES:
        txt = fetch(kw)
        jobs = parse(txt) if txt else []
        n = 0
        for j in jobs:
            if j["jobId"] in seen or not KEEP.search(j["title"] + " " + j["company"]) or DROP.search(j["title"]):
                continue
            seen.add(j["jobId"]); found.append(j); n += 1
        print(f"{kw!r}: {len(jobs)} listed, {n} kept")
        time.sleep(2)
    found = found[: a.max]
    if not found:
        print("LinkedIn returned nothing parseable — leaving the board unchanged."); return

    items = []
    for j in found:
        posted = j["posted"] or today.isoformat()
        try:
            last = (dt.date.fromisoformat(posted[:10]) + dt.timedelta(days=a.keep_days)).isoformat()
        except ValueError:
            last = (today + dt.timedelta(days=a.keep_days)).isoformat()
        items.append({
            "id": "li-" + j["jobId"], "title": f"{j['title']} — {j['company']}" if j["company"] else j["title"],
            "organisation": j["company"] or "Company (LinkedIn)", "posts": None, "postNames": j["title"],
            "qualification": "See the LinkedIn posting", "ageLimit": "", "fee": "", "startDate": posted[:10], "lastDate": last,
            "upcoming": False, "examDate": "", "location": j["location"], "tags": ["LinkedIn", "Industry"],
            "applyUrl": j["url"], "sourceUrl": j["url"],
            "summary": f"Industry opening listed on LinkedIn ({j['location']}). Posted {posted[:10]}. Apply on LinkedIn; the closing date shown here is an estimate (30 days from posting).",
            "source": "linkedin",
        })

    board = load_existing()
    by_id = {x["id"]: x for x in board["items"]}
    for it in items:
        old = by_id.get(it["id"])
        if old:
            old.update({k: v for k, v in it.items() if v not in ("", None, [])})
        else:
            by_id[it["id"]] = it
    kept = []
    for x in by_id.values():
        if x.get("lastDate"):
            try:
                if (today - dt.date.fromisoformat(x["lastDate"])).days > a.keep_days:
                    continue
            except ValueError:
                pass
        kept.append(x)
    kept.sort(key=lambda x: (0 if x.get("upcoming") else 1, x.get("lastDate") or "9999"))
    for it in items:
        print(f"  + {it['title']} ({it['location']})")
    if a.dry_run:
        return
    with open(DATA, "w", encoding="utf-8") as fh:
        fh.write("// Geology vacancy board. Refreshed daily by tools/fetch_freejobalert.py + tools/fetch_linkedin.py (GitHub Actions); edit by hand or add from Admin → Vacancies.\n")
        fh.write("// status is derived on the page from lastDate: open / closing soon (≤7 days) / closed. Set \"upcoming\": true for expected notifications.\n")
        fh.write("window.GSA_VACANCIES = ")
        json.dump({"updatedAt": today.isoformat(), "items": kept}, fh, ensure_ascii=False, indent=2)
        fh.write(";\n")
    print(f"wrote {DATA}: {len(kept)} items ({len(items)} from LinkedIn)")


if __name__ == "__main__":
    main()
