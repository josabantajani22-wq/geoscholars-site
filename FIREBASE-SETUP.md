# Geo Scholars Academy — move to Google Firebase (hosting + student data)

Everything below is free on Firebase's Spark plan at your size. Total time ≈ 40 minutes. Do the steps in order.
You will need: your Google account (geoscholarsacademy@gmail.com), the GitHub repo, and Squarespace DNS.

---------------------------------------------------------------------------------------------------
## PART A — Create the Firebase project (10 min)
1. Open https://console.firebase.google.com and sign in with geoscholarsacademy@gmail.com.
2. Click **Create a project** → name: `Geo Scholars Academy` → the project id shown underneath should be
   `geo-scholars-academy-ac558` (if Google appends numbers, e.g. `geo-scholars-academy-ac558-1a2b`, note it — you'll need it in step C4).
   Google Analytics: you can leave it ON. → Create project.
3. Left menu → **Build → Authentication** → Get started → **Sign-in method** tab → **Email/Password** → Enable → Save.
4. Left menu → **Build → Firestore Database** → Create database → location `asia-south1 (Mumbai)` →
   **Start in production mode** → Create.
5. Firestore → **Rules** tab → delete everything → paste the entire contents of the file `firestore.rules` from the site folder →
   **Publish**.
6. Project overview (top-left gear) → **Project settings** → scroll to *Your apps* → click the **</>** (Web) icon →
   App nickname `GSA website` → tick **Also set up Firebase Hosting** → Register app.
   It shows a block like:
   ```
   const firebaseConfig = {
     apiKey: "AIza…",
     authDomain: "geo-scholars-academy-ac558.firebaseapp.com",
     projectId: "geo-scholars-academy-ac558",
     storageBucket: "geo-scholars-academy-ac558.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };
   ```
   Copy those six values into `js/config.js` → the `firebase: { … }` block at the bottom (keep the quotes). Click *Continue to console*.
7. Authentication → **Settings** tab → **Authorized domains** → Add domain → `geoscholarsacademy.org` (and `www.geoscholarsacademy.org`).

Result: the site now uses real accounts. Anyone who signs up is stored in Google's database, not in their own browser.

---------------------------------------------------------------------------------------------------
## PART B — Put the updated files on GitHub (5 min)
1. Upload the new site zip contents to the repo (replace all). It includes `firebase.json`, `.firebaserc`, `firestore.rules`,
   and `.github/workflows/firebase-deploy.yml`.
   If the `.github` folder doesn't upload, create the file by hand: Add file → Create new file →
   name `.github/workflows/firebase-deploy.yml` → paste the file's text → Commit.
2. If your project id from A2 is NOT exactly `geo-scholars-academy-ac558`, edit two files in the repo and replace it:
   `.firebaserc` and `.github/workflows/firebase-deploy.yml` (the `projectId:` line).

---------------------------------------------------------------------------------------------------
## PART C — Let GitHub deploy to Firebase automatically (10 min)
This is what makes every upload AND the daily vacancy update go live on Google.
1. Firebase console → gear → **Project settings** → **Service accounts** tab → **Generate new private key** → Generate key.
   A `.json` file downloads. (Treat it like a password — don't share it or upload it to the repo.)
2. Open that .json in Notepad → Select all → Copy.
3. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** →
   Name: `FIREBASE_SERVICE_ACCOUNT` → Secret: paste the JSON → Add secret.
4. Repo → **Actions** tab → **Deploy to Firebase Hosting** → **Run workflow**. Green tick after ~1 minute means the site is
   live at `https://geo-scholars-academy-ac558.web.app` (open it to check).
5. Repo → **Settings → Pages** → Source: **None** (turn GitHub Pages off so there aren't two copies). Delete the `CNAME`
   file from the repo (it was for GitHub Pages).

---------------------------------------------------------------------------------------------------
## PART D — Your domain (10 min + waiting)
1. Firebase console → **Build → Hosting** → **Add custom domain** → `geoscholarsacademy.org` → Continue.
   It shows records to add — usually one **TXT** record (for verification) and two **A** records (Firebase IPs).
2. Squarespace → Domains → geoscholarsacademy.org → DNS Settings → Custom records:
   - **Delete** the four A records `@ → 185.199.108/109/110/111.153` (GitHub).
   - **Delete** the CNAME `www → josabantajani22-wq.github.io`.
   - **Add** the TXT and A records Firebase showed (Host `@`).
   - Keep every Google Workspace record (MX, SPF TXT, DKIM) — those are your email.
3. Back in Firebase click **Verify**. Then Add custom domain again for `www.geoscholarsacademy.org` → choose
   *Redirect to geoscholarsacademy.org* → add the records it shows (usually a CNAME or A records for `www`).
4. Status goes *Needs setup → Pending → Connected*. HTTPS certificate is automatic; allow up to 24 h (usually < 1 h).

---------------------------------------------------------------------------------------------------
## PART E — First admin sign-in (2 min)
1. Open the site → Sign in → **Create account** → email `manager@geoscholarsacademy.org`, password = the admin password →
   Sign up. (Firebase needs the account created once; the site only allows this with the admin password.)
2. The **Admin** link appears. Admin → Overview shows site-wide visitors, enquiries, students. Every student who signs up
   from now on appears in Students & results with their profile.
3. If Admin → Enquiries or Students shows a message with a link "create index", click the link once and wait a minute.

---------------------------------------------------------------------------------------------------
## What stays the same
- The daily geology-vacancy sync (GitHub Actions, 07:00 IST) keeps running; its commit triggers the Firebase deploy.
- Enquiry emails via FormSubmit + optional Telegram — unchanged. Enquiries are now also stored in Firestore for the admin.
- Google Search Console: after the domain moves, re-verify if asked (same HTML file works — it's in the site folder).

## If something goes wrong
- "Permission denied" in the site → rules not published (A5) or admin email not in the rules list.
- Deploy workflow red → the secret name must be exactly FIREBASE_SERVICE_ACCOUNT and the project id must match.
- Site loads but sign-in says "auth/unauthorized-domain" → add the domain in A7.
Send me a screenshot of any error and I'll tell you the fix.
