# Geo Scholars Academy — website

Static HTML/JS site with a free online test series, student accounts & progress dashboard,
enquiry form and an admin panel. No build step — upload the `site/` folder to any host.

## Run it locally
Just open `index.html` in a browser. Everything works in **local demo mode**
(data is stored in that browser's localStorage).

Admin login: `manager@geoscholarsacademy.org` (or `geoscholarsacademy@gmail.com`) with the admin password. The password is
stored only as a SHA-256 hash in `js/config.js → adminPasswordHash`; to change it, hash the new password at
https://emn178.github.io/online-tools/sha256.html and paste the hash. In Firebase mode sign up once with the admin email
and the same password.

## Student profiles
Students complete a profile from their dashboard (name, phone, age, gender, city/state, qualification, college, graduation
year, target exams, planned attempt year, GSA courses purchased, study hours, goal, photo). A completeness meter nudges them;
the edit form opens automatically for new accounts. Admin → Students & results shows every field, searches across them, and
the CSV export includes them. Field list: `js/store.js → PROFILE_KEYS`; exam and qualification options: `store.EXAMS`,
`store.QUALIFICATIONS`; course choices come from `data/site.js → courses`.

## Visitor counter
Admin → Overview shows **Total visitors to geoscholarsacademy.org** — a site-wide number that works on GitHub Pages without
Firebase (free public counter keyed by `js/config.js → visitCounterKey`; one count per visitor session). The 30-day
breakdown, student and enquiry lists become site-wide only with Firebase.

## Daily automatic job updates
Needs the two files in `.github/workflows/` to exist in the GitHub repo (`pages.yml`, `vacancies.yml`). If GitHub's
uploader skipped the hidden `.github` folder, create them by hand: repo → Add file → Create new file → type the path
`.github/workflows/vacancies.yml` → paste the file's contents → Commit. Then Actions tab → "I understand… enable" → the
"Update geology vacancies" workflow runs every morning (07:00 IST) and can be run now with "Run workflow".

## What's new (v2)
- Real batches from Classplus on the Courses page, with app/web enrol links (`js/config.js` → `classplus`).
- **Free Classes** page (`classes.html`) — videos from `data/site.js → videos`. The two sample classes point to
  `../Class videos/*.mp4` (the folder next to `site/`). For hosting, upload them as *Unlisted* on YouTube and put the
  video id in `youtube:` instead — 270 MB of mp4 is too heavy for most static hosts.
- **Success stories** auto-slider on the home page — `data/site.js → successStories` (samples marked `sample:true`;
  replace them) or Admin → Success stories.
- **Exam Links** page (`exams.html`) — official CSIR NET / UPSC / GATE / JAM / CUET / recruiter portals.
- **Vacancies** board (`vacancies.html`) fed by `data/vacancies.js` (FreeJobAlert fetcher, AI agent) + Admin → Vacancies. Status/countdown derived from dates.
- Telegram floating button (bottom-right); WhatsApp removed.
- **AI vacancy agent** — `tools/vacancy_agent.py` (see below).
- Style: Playfair Display + Inter, contour-line hero, animated counters, news ticker, reveal-on-scroll, card hover.

## AI vacancy agent
```
pip install anthropic
set ANTHROPIC_API_KEY=sk-ant-...       # get one at console.anthropic.com
python tools/vacancy_agent.py --dry-run   # preview
python tools/vacancy_agent.py             # writes data/vacancies.js
```
It searches official portals (UPSC, ONGC, GSI, CGWB, NMDC, Coal India, NTA, state PSCs…) with Claude + web search,
merges results into the board, drops items closed > 30 days, and keeps any summary you mark `"locked": true`.
Run weekly (Windows Task Scheduler / cron) and re-upload `data/vacancies.js`.

## Folder map
```
index.html       Home           courses.html   Courses        about.html   About
tests.html       Test list      test.html      Quiz player    dashboard.html  Student dashboard
login.html       Sign in/up     contact.html   Enquiry form   admin.html   Admin panel
css/style.css    Styles         assets/logo.jpg
js/config.js     ← contact details, admin emails, Firebase keys
js/store.js      data layer (local ↔ Firebase)      js/app.js  header/footer
js/quiz.js       quiz engine                        js/admin.js admin panel
data/site.js     ← courses, FAQs, faculty, default notices (edit freely)
data/tests.js    generated question banks (run tools/convert_docx.py)
tools/convert_docx.py   docx question bank → data/tests.js
```

## Add a new test permanently
Put the `.docx` (GSA table format: Question / Type / Option ×4 / Solution / Marks) in a folder and run:
```
pip install python-docx
python tools/convert_docx.py "../Free test Series/*.docx" -o data/tests.js
```
Or, from the Admin panel → Tests, upload the `.docx` directly (stored in Firebase when live).

## Go live with real student accounts (Firebase, free tier)
1. https://console.firebase.google.com → Add project.
2. Authentication → Sign-in method → enable **Email/Password**.
3. Firestore Database → Create database (production mode).
4. Project settings → Your apps → Web app → copy `firebaseConfig` into `js/config.js`.
5. Firestore → Rules → paste the rules below → Publish.
6. Sign up on the site with an email listed in `adminEmails` → the Admin link appears.

### Firestore security rules
Replace the email list with your `adminEmails`.
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isAdmin() { return signedIn() && request.auth.token.email in ['admin@geoscholars.in']; }

    match /users/{uid}     { allow read: if signedIn() && (request.auth.uid == uid || isAdmin());
                             allow write: if signedIn() && request.auth.uid == uid; }
    match /tests/{id}      { allow read: if true;  allow write: if isAdmin(); }
    match /notices/{id}    { allow read: if true;  allow write: if isAdmin(); }
    match /enquiries/{id}  { allow create: if true; allow read, update, delete: if isAdmin(); }
    match /stories/{id}    { allow read: if true;  allow write: if isAdmin(); }
    match /vacancies/{id}  { allow read: if true;  allow write: if isAdmin(); }
    match /videos/{id}     { allow read: if true;  allow write: if isAdmin(); }
    match /stats/{day}     { allow read: if isAdmin(); allow create, update: if true; }
    match /attempts/{id}   { allow create: if signedIn() && request.resource.data.uid == request.auth.uid;
                             allow read: if signedIn() && (resource.data.uid == request.auth.uid || isAdmin());
                             allow update, delete: if isAdmin(); }
  }
}
```
Firestore composite index: if the console shows an "index required" link when opening the
Admin → Enquiries or Students tabs, click it once to create the index.

## Go online (GitHub Pages + your domain) — recommended
Free, and it also runs the FreeJobAlert vacancy refresh every morning.
1. Create a GitHub account (github.com) and a new **public** repository, e.g. `geoscholars-site`.
2. Upload the contents of this `site/` folder to it (GitHub → "Add file → Upload files", drag the whole folder contents,
   including the hidden `.github` folder — or use GitHub Desktop).
3. `CNAME` already contains `geoscholarsacademy.org` — leave it as is.
4. Repo → Settings → Pages → Source: **GitHub Actions**. The "Deploy site" workflow publishes on every push.
5. Repo → Settings → Pages → Custom domain: `geoscholarsacademy.org`, save, tick **Enforce HTTPS** once it verifies.
6. At your domain registrar (GoDaddy / Hostinger / BigRock / Namecheap …) add DNS records:
   - `A`     @    185.199.108.153
   - `A`     @    185.199.109.153
   - `A`     @    185.199.110.153
   - `A`     @    185.199.111.153
   - `CNAME` www  <your-github-username>.github.io
   DNS takes 10 min – 24 h to spread. Then the site is live at https://geoscholarsacademy.org.
7. Repo → Actions → enable workflows. "Update geology vacancies" runs daily at 07:00 IST and commits `data/vacancies.js`.

## Enquiries → your email and phone
- **Email** (on by default): the contact form posts to formsubmit.co → `geoscholarsacademy@gmail.com` (set in `js/config.js → enquiryEmail`).
  **One-time step:** the very first enquiry makes FormSubmit send an "Activate" email to that address — open it and click
  Activate. From then on every enquiry arrives instantly (Gmail app on your phone = phone notification).
- **Telegram push to your phone** (optional, 3 minutes): in Telegram open @BotFather → `/newbot` → copy the token.
  Create a private group, add the bot, send one message in it, then open
  `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and copy the `"chat":{"id":-100…}` number.
  Put both into `js/config.js → telegramNotify`. Every enquiry then pings that group.
- Every enquiry is also stored for Admin → Enquiries (site-wide once Firebase is on) with an "Emailed" yes/no flag.

## LinkedIn industry jobs
`tools/fetch_linkedin.py` reads LinkedIn's public (logged-out) job search for geologist / geology / hydrogeologist /
mining geologist / geophysicist / exploration geologist in India, keeps geology-relevant titles, and merges them into the
board tagged "LinkedIn" (shown under the *Industry (LinkedIn)* filter, expiring 30 days after posting). It is NOT part of the daily workflow (removed on request — the site shows a single "Search on LinkedIn" link instead); run it by hand only if you want LinkedIn jobs merged in. A "Search geologist jobs on LinkedIn"
button on the vacancies page always works regardless.

## Look & feel
Hero uses a built-in sunrise-mountains scene (`assets/hero-scene.svg`); to use your own photo, put a wide JPG in `assets/`
and set `js/config.js → heroImage: "assets/hero.jpg"`. Pages carry a faint contour texture (`assets/bg-contours.svg`).
Success stories: spotlight card (auto-rotates every 5 s) + honour wall; click a name to spotlight, click the poster to enlarge. Hero keeps the light contour-line background.

## Get found on Google ("geology vacancy", "geologist jobs" …)
Built in: keyword titles/descriptions on every page, canonical URLs, `sitemap.xml`, `robots.txt`, Organization + FAQ +
JobPosting structured data, and a static copy of the vacancy list inside `vacancies.html` (regenerated daily by the workflow).
Two things only you can do:
1. **Google Search Console** — search.google.com/search-console → Add property → `geoscholarsacademy.org` (Domain type; verify via
   the DNS TXT record Squarespace lets you add) or URL-prefix type (copy the `<meta name="google-site-verification">` tag into
   `index.html` where the comment says). Then Sitemaps → submit `https://geoscholarsacademy.org/sitemap.xml`.
2. **Post links** — share vacancies.html in your Telegram/Instagram/YouTube descriptions; backlinks + daily fresh content are
   what move the ranking. Expect first impressions in 1–2 weeks, meaningful ranking in 2–3 months.
Optional: put a GA4 measurement id in `js/config.js → googleAnalyticsId` for full Google Analytics.

## Visitors, students and enquiries in the admin panel
Admin → Overview shows visitors/page views (30-day chart), enquiries, students and attempts. Admin → Students & results →
click any name for the full report (score trend, per-test best, section-wise strengths/weaknesses, every attempt).
**These counts are site-wide only in Firebase mode** — in local demo mode each browser counts itself.

## FreeJobAlert vacancy fetcher
`tools/fetch_freejobalert.py` reads the FreeJobAlert latest-notifications page table (Post Date · Board · Post · Qualification · Advt · Last Date),
keeps geology/geoscience rows (keyword list at the top of the script), opens each article for posts/age/fee/official link,
and merges into `data/vacancies.js`. Run by hand with `pip install requests beautifulsoup4 lxml` then
`python tools/fetch_freejobalert.py`; or let the GitHub workflow do it daily.

## Other hosts
Any static host works: Firebase Hosting (`firebase deploy`), Netlify / Vercel / Cloudflare Pages
(drag-and-drop the `site` folder), GitHub Pages, or cPanel `public_html`.
Point your domain at it and you're done.
