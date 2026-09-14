#!/usr/bin/env python3
"""Write a static (no-JavaScript) copy of the vacancy board + JobPosting structured data into vacancies.html,
between the <!-- SSR:START --> and <!-- SSR:END --> markers, so search engines index every vacancy.
Run after fetch_freejobalert.py:   python tools/render_static.py
"""
import json, os, re, html, datetime as dt
HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, "..")
DATA = os.path.join(SITE, "data", "vacancies.js"); PAGE = os.path.join(SITE, "vacancies.html")
BASE = "https://geoscholarsacademy.org/"

src = open(DATA, encoding="utf-8").read()
board = json.loads(re.search(r"=\s*(\{.*\})\s*;\s*$", src, re.S).group(1))
today = dt.date.today()
items = []
for v in board["items"]:
    if v.get("hidden"): continue
    last = v.get("lastDate") or ""
    try: closed = bool(last) and dt.date.fromisoformat(last) < today
    except ValueError: closed = False
    if closed: continue
    items.append(v)

e = html.escape
rows = []
for v in items:
    rows.append(f'<li><a href="vacancies.html#{e(v["id"])}"><strong>{e(v["title"])}</strong></a> — {e(v.get("organisation",""))}'
                + (f' · {v["posts"]} posts' if v.get("posts") else "")
                + (f' · last date {e(v["lastDate"])}' if v.get("lastDate") else (" · notification expected" if v.get("upcoming") else ""))
                + (f'<br><span>{e(v.get("qualification",""))}</span>' if v.get("qualification") else "")
                + (f' <a href="{e(v["applyUrl"])}" rel="nofollow noopener">Official link</a>' if v.get("applyUrl") else "") + "</li>")
static = ('<div id="ssr"><h2>Current geology vacancies (' + today.strftime("%d %B %Y") + ')</h2><ol class="ssr-list">' + "".join(rows) + "</ol></div>") if rows else ""

postings = []
for v in items:
    if v.get("upcoming") or not v.get("lastDate"): continue
    postings.append({"@context": "https://schema.org", "@type": "JobPosting", "title": v["title"],
        "description": (v.get("summary") or v["title"]) + (" Posts: " + v["postNames"] if v.get("postNames") else "") + (" Eligibility: " + v["qualification"] if v.get("qualification") else ""),
        "datePosted": v.get("startDate") or board.get("updatedAt") or today.isoformat(), "validThrough": v["lastDate"] + "T23:59:59",
        "employmentType": "FULL_TIME", "hiringOrganization": {"@type": "Organization", "name": v.get("organisation", "")},
        "jobLocation": {"@type": "Place", "address": {"@type": "PostalAddress", "addressCountry": "IN", "addressRegion": v.get("location") or "India"}},
        "url": BASE + "vacancies.html#" + v["id"], "directApply": False})
ld = ('<script type="application/ld+json">' + json.dumps(postings, ensure_ascii=False) + "</script>") if postings else ""

page = open(PAGE, encoding="utf-8").read()
new = re.sub(r"(<!-- SSR:START[^>]*-->).*?(<!-- SSR:END -->)", lambda m: m.group(1) + "\n" + static + ld + "\n    " + m.group(2), page, flags=re.S)
open(PAGE, "w", encoding="utf-8").write(new)
print(f"rendered {len(rows)} vacancies, {len(postings)} JobPosting entries into vacancies.html")
