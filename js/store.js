/* ============================================================
   GSA Store — one API, two backends.
   - LOCAL mode  : localStorage in the visitor's browser (demo / offline)
   - FIREBASE    : Firebase Auth + Firestore (real accounts, shared data)
   Every method returns a Promise. Pages only ever talk to GSA.store.
   ============================================================ */
(function () {
  const CFG = window.GSA_CONFIG || {};
  const useFirebase = !!(CFG.firebase && CFG.firebase.apiKey);
  const isAdminEmail = (e) => !!e && (CFG.adminEmails || []).map(x => x.toLowerCase()).includes(e.toLowerCase());
  // Student profile fields (editable from the dashboard, visible to admin)
  const PROFILE_KEYS = ["name", "phone", "age", "gender", "city", "state", "qualification", "college", "gradYear", "targetExams", "courses", "attemptYear", "hours", "goal", "photo"];
  const pickProfile = (d) => { const o = {}; PROFILE_KEYS.forEach(k => { if (d && d[k] !== undefined) o[k] = d[k]; }); return o; };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  async function sha256(str) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return "weak" + h;
  }

  /* ---------------- LOCAL BACKEND ---------------- */
  const local = {
    mode: "local",
    _get(k, d) { try { return JSON.parse(localStorage.getItem("gsa_" + k)) ?? d; } catch { return d; } },
    _set(k, v) { localStorage.setItem("gsa_" + k, JSON.stringify(v)); },
    _listeners: [],
    user: null,

    async init() {
      const s = this._get("session", null);
      this.user = s ? this._get("users", []).find(u => u.uid === s) || null : null;
      if (this.user) this.user = this._public(this.user);
      return this.user;
    },
    _public(u) { return { ...pickProfile(u), uid: u.uid, email: u.email, name: u.name, phone: u.phone || "", targetExams: u.targetExams || [], courses: u.courses || [], isAdmin: isAdminEmail(u.email), createdAt: u.createdAt, updatedAt: u.updatedAt || 0 }; },
    async updateProfile(fields) {
      if (!this.user) throw new Error("Sign in first.");
      const users = this._get("users", []); const u = users.find(x => x.uid === this.user.uid); if (!u) throw new Error("Account not found.");
      Object.assign(u, pickProfile(fields), { updatedAt: Date.now() }); this._set("users", users);
      this.user = this._public(u); this._emit(); return this.user;
    },
    _emit() { this._listeners.forEach(f => f(this.user)); },
    onAuth(cb) { this._listeners.push(cb); cb(this.user); },

    async signUp(email, password, name, phone) {
      email = email.trim().toLowerCase();
      const users = this._get("users", []);
      if (users.some(u => u.email === email)) throw new Error("An account with this email already exists. Please sign in.");
      if (isAdminEmail(email) && CFG.adminPasswordHash && (await sha256(password)) !== CFG.adminPasswordHash) throw new Error("This email is reserved for the admin. Use the admin password to sign in.");
      const u = { uid: uid(), email, name: name.trim(), phone, hash: await sha256(password), createdAt: Date.now() };
      users.push(u); this._set("users", users); this._set("session", u.uid);
      this.user = this._public(u); this._emit(); return this.user;
    },
    async signIn(email, password) {
      email = email.trim().toLowerCase();
      const users = this._get("users", []);
      let u = users.find(x => x.email === email);
      const pwHash = await sha256(password);
      if (isAdminEmail(email)) {                 // admin: password fixed in config (hashed)
        if (CFG.adminPasswordHash && pwHash !== CFG.adminPasswordHash) throw new Error("Incorrect admin password.");
        if (!u) { u = { uid: uid(), email, name: "Admin", hash: pwHash, createdAt: Date.now() }; users.push(u); this._set("users", users); }
      } else {
        if (!u) throw new Error("No account found for this email.");
        if (u.hash !== pwHash) throw new Error("Incorrect password.");
      }
      this._set("session", u.uid); this.user = this._public(u); this._emit(); return this.user;
    },
    async signOut() { localStorage.removeItem("gsa_session"); this.user = null; this._emit(); },
    async resetPassword() { throw new Error("Password reset needs Firebase mode. In local mode, create a new account."); },

    async listCustomTests() { return this._get("tests", []); },
    async saveTest(t) { const a = this._get("tests", []).filter(x => x.id !== t.id); a.push(t); this._set("tests", a); },
    async deleteTest(id) { this._set("tests", this._get("tests", []).filter(x => x.id !== id)); },

    async saveAttempt(at) { const a = this._get("attempts", []); a.push(at); this._set("attempts", a); return at; },
    async listAttempts(userId) { return this._get("attempts", []).filter(a => a.uid === userId).sort((x, y) => y.at - x.at); },
    async getAttempt(id) { return this._get("attempts", []).find(a => a.id === id) || null; },
    async listAllAttempts() { return this._get("attempts", []).sort((x, y) => y.at - x.at); },

    async listNotices() { return this._get("notices", []).sort((a, b) => (b.date || "").localeCompare(a.date || "")); },
    async saveNotice(n) { const a = this._get("notices", []).filter(x => x.id !== n.id); a.push(n); this._set("notices", a); },
    async deleteNotice(id) { this._set("notices", this._get("notices", []).filter(x => x.id !== id)); },

    async saveEnquiry(e) { const a = this._get("enquiries", []); a.push(e); this._set("enquiries", a); },
    async listEnquiries() { return this._get("enquiries", []).sort((x, y) => y.at - x.at); },
    async listUsers() { return this._get("users", []).map(u => this._public(u)); },

    async listStories() { return this._get("stories", []); },
    async saveStory(x) { const a = this._get("stories", []).filter(y => y.id !== x.id); a.push(x); this._set("stories", a); },
    async deleteStory(id) { this._set("stories", this._get("stories", []).filter(x => x.id !== id)); },
    async listCustomVacancies() { return this._get("vacancies", []); },
    async saveVacancy(x) { const a = this._get("vacancies", []).filter(y => y.id !== x.id); a.push(x); this._set("vacancies", a); },
    async deleteVacancy(id) { this._set("vacancies", this._get("vacancies", []).filter(x => x.id !== id)); },

    async listVideos() { return this._get("videos", []); },
    async saveVideo(x) { const a = this._get("videos", []).filter(y => y.id !== x.id); a.push(x); this._set("videos", a); },
    async deleteVideo(id) { this._set("videos", this._get("videos", []).filter(x => x.id !== id)); },

    // Visits: local mode can only count this browser (demo). Real counts need Firebase.
    async recordVisit(page) {
      const day = new Date().toISOString().slice(0, 10), v = this._get("visits", {});
      v[day] = v[day] || { views: 0, pages: {} }; v[day].views++; v[day].pages[page] = (v[day].pages[page] || 0) + 1;
      if (!sessionStorage.getItem("gsa_visitor")) { sessionStorage.setItem("gsa_visitor", "1"); v[day].visitors = (v[day].visitors || 0) + 1; }
      this._set("visits", v);
    },
    async visitStats(days) { const v = this._get("visits", {}); return Object.entries(v).map(([day, x]) => ({ day, ...x })).sort((a, b) => a.day.localeCompare(b.day)).slice(-days); }
  };

  /* ---------------- FIREBASE BACKEND ---------------- */
  const fb = {
    mode: "firebase",
    user: null, _db: null, _auth: null, _listeners: [],
    _load(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); },
    async init() {
      const v = "10.12.2";
      await this._load(`https://www.gstatic.com/firebasejs/${v}/firebase-app-compat.js`);
      await Promise.all([
        this._load(`https://www.gstatic.com/firebasejs/${v}/firebase-auth-compat.js`),
        this._load(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore-compat.js`)
      ]);
      firebase.initializeApp(CFG.firebase);
      this._auth = firebase.auth(); this._db = firebase.firestore();
      return new Promise(res => {
        this._auth.onAuthStateChanged(async (u) => {
          this.user = u ? await this._profile(u) : null;
          this._listeners.forEach(f => f(this.user)); res(this.user);
        });
      });
    },
    async _profile(u) {
      const snap = await this._db.collection("users").doc(u.uid).get();
      const d = snap.exists ? snap.data() : {};
      return { ...pickProfile(d), uid: u.uid, email: u.email, name: d.name || u.displayName || "", phone: d.phone || "", targetExams: d.targetExams || [], courses: d.courses || [], isAdmin: isAdminEmail(u.email), createdAt: d.createdAt || 0, updatedAt: d.updatedAt || 0 };
    },
    async updateProfile(fields) {
      const u = this._auth.currentUser; if (!u) throw new Error("Sign in first.");
      const data = { ...pickProfile(fields), updatedAt: Date.now() };
      await this._db.collection("users").doc(u.uid).set(data, { merge: true });
      if (data.name) await u.updateProfile({ displayName: data.name });
      this.user = await this._profile(u); this._listeners.forEach(f => f(this.user)); return this.user;
    },
    onAuth(cb) { this._listeners.push(cb); cb(this.user); },
    async signUp(email, password, name, phone) {
      const cred = await this._auth.createUserWithEmailAndPassword(email.trim(), password);
      await cred.user.updateProfile({ displayName: name.trim() });
      await this._db.collection("users").doc(cred.user.uid).set({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone || "", createdAt: Date.now() });
      this.user = await this._profile(cred.user); return this.user;
    },
    async signIn(email, password) { const c = await this._auth.signInWithEmailAndPassword(email.trim(), password); this.user = await this._profile(c.user); return this.user; },
    async signOut() { await this._auth.signOut(); },
    async resetPassword(email) { await this._auth.sendPasswordResetEmail(email.trim()); },

    _docs(snap) { return snap.docs.map(d => ({ id: d.id, ...d.data() })); },
    async listCustomTests() { return this._docs(await this._db.collection("tests").get()); },
    async saveTest(t) { await this._db.collection("tests").doc(t.id).set(t); },
    async deleteTest(id) { await this._db.collection("tests").doc(id).delete(); },

    async saveAttempt(at) { await this._db.collection("attempts").doc(at.id).set(at); return at; },
    async listAttempts(userId) { return this._docs(await this._db.collection("attempts").where("uid", "==", userId).get()).sort((x, y) => y.at - x.at); },
    async getAttempt(id) { const s = await this._db.collection("attempts").doc(id).get(); return s.exists ? { id: s.id, ...s.data() } : null; },
    async listAllAttempts() { return this._docs(await this._db.collection("attempts").orderBy("at", "desc").limit(1000).get()); },

    async listNotices() { return this._docs(await this._db.collection("notices").get()).sort((a, b) => (b.date || "").localeCompare(a.date || "")); },
    async saveNotice(n) { await this._db.collection("notices").doc(n.id).set(n); },
    async deleteNotice(id) { await this._db.collection("notices").doc(id).delete(); },

    async saveEnquiry(e) { await this._db.collection("enquiries").doc(e.id).set(e); },
    async listEnquiries() { return this._docs(await this._db.collection("enquiries").orderBy("at", "desc").get()); },
    async listUsers() { return this._docs(await this._db.collection("users").get()).map(u => ({ uid: u.id, ...u, isAdmin: isAdminEmail(u.email) })); },

    async listStories() { return this._docs(await this._db.collection("stories").get()); },
    async saveStory(x) { await this._db.collection("stories").doc(x.id).set(x); },
    async deleteStory(id) { await this._db.collection("stories").doc(id).delete(); },
    async listCustomVacancies() { return this._docs(await this._db.collection("vacancies").get()); },
    async saveVacancy(x) { await this._db.collection("vacancies").doc(x.id).set(x); },
    async deleteVacancy(id) { await this._db.collection("vacancies").doc(id).delete(); },

    async listVideos() { return this._docs(await this._db.collection("videos").get()); },
    async saveVideo(x) { await this._db.collection("videos").doc(x.id).set(x); },
    async deleteVideo(id) { await this._db.collection("videos").doc(id).delete(); },

    async recordVisit(page) {
      const day = new Date().toISOString().slice(0, 10), inc = firebase.firestore.FieldValue.increment;
      const first = !sessionStorage.getItem("gsa_visitor"); if (first) sessionStorage.setItem("gsa_visitor", "1");
      const key = "p_" + page.replace(/[^a-z0-9]/gi, "_");
      await this._db.collection("stats").doc(day).set({ views: inc(1), visitors: inc(first ? 1 : 0), [key]: inc(1), day }, { merge: true });
    },
    async visitStats(days) {
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const snap = await this._db.collection("stats").where("day", ">=", since).orderBy("day").get();
      return snap.docs.map(d => { const x = d.data(); const pages = {}; Object.keys(x).filter(k => k.startsWith("p_")).forEach(k => pages[k.slice(2)] = x[k]); return { day: d.id, views: x.views || 0, visitors: x.visitors || 0, pages }; });
    }
  };

  const store = useFirebase ? fb : local;

  /* ---------------- SHARED HELPERS ---------------- */
  store.isAdminEmail = isAdminEmail;
  store.PROFILE_KEYS = PROFILE_KEYS;
  store.EXAMS = ["IIT JAM Geology", "CUET-PG Geology", "GATE Geology & Geophysics", "CSIR NET Earth Science", "UPSC Combined Geo-Scientist", "GSI / Geologist", "ONGC Geologist", "CGWB / State PSC", "Other"];
  store.QUALIFICATIONS = ["B.Sc. (pursuing)", "B.Sc. (completed)", "M.Sc. (pursuing)", "M.Sc. (completed)", "M.Tech / Ph.D.", "Other"];
  store.profileCompleteness = (u) => { const req = ["name", "phone", "age", "city", "qualification", "college", "targetExams", "attemptYear", "goal"]; const done = req.filter(k => Array.isArray(u[k]) ? u[k].length : (u[k] !== undefined && u[k] !== "" && u[k] !== null)).length; return Math.round(100 * done / req.length); };
  store.newId = uid;
  store.ready = store.init().catch(err => { console.error("Store init failed", err); return null; });

  // Built-in tests (data/tests.js) + custom tests added from the admin panel.
  store.listTests = async function () {
    const builtin = (window.GSA_BUILTIN_TESTS || []).map(t => ({ ...t, builtin: true }));
    const custom = await store.listCustomTests();
    const hiddenIds = new Set(custom.filter(t => t.hidden).map(t => t.id));
    return [...builtin.filter(t => !hiddenIds.has(t.id)), ...custom.filter(t => !t.hidden && !t.replacesBuiltin)];
  };
  store.getTest = async function (id) {
    const custom = await store.listCustomTests();
    const c = custom.find(t => t.id === id);
    if (c && c.hidden) return null;
    return c || (window.GSA_BUILTIN_TESTS || []).find(t => t.id === id) || null;
  };
  store.listAllNotices = async function () {
    const builtin = ((window.GSA_SITE || {}).notices || []).map(n => ({ ...n, builtin: true }));
    return [...await store.listNotices(), ...builtin].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  };

  // Success stories: built-in (data/site.js) + admin-added. Admin entries with hidden:true suppress a built-in id.
  store.listAllStories = async function () {
    const custom = await store.listStories();
    const hidden = new Set(custom.filter(x => x.hidden).map(x => x.id));
    const builtin = ((window.GSA_SITE || {}).successStories || []).filter(x => !hidden.has(x.id)).map(x => ({ ...x, builtin: true }));
    return [...custom.filter(x => !x.hidden), ...builtin];
  };
  // Vacancies: built-in (data/vacancies.js, maintained by the AI agent) + admin-added; admin copy of same id wins.
  store.listAllVacancies = async function () {
    const custom = await store.listCustomVacancies();
    const byId = new Map(((window.GSA_VACANCIES || {}).items || []).map(v => [v.id, { ...v, builtin: true }]));
    custom.forEach(v => { if (v.hidden) byId.delete(v.id); else byId.set(v.id, v); });
    return [...byId.values()];
  };

  store.listAllVideos = async function () {
    const custom = await store.listVideos();
    const hidden = new Set(custom.filter(x => x.hidden).map(x => x.id));
    const builtin = ((window.GSA_SITE || {}).videos || []).filter(x => !hidden.has(x.id)).map(x => ({ ...x, builtin: true }));
    const byId = new Map(builtin.map(v => [v.id, v])); custom.filter(x => !x.hidden).forEach(v => byId.set(v.id, v));
    return [...byId.values()];
  };

  // Site-wide visit counter that needs no backend: counterapi.dev (free, public). Counts every page view of every visitor.
  store.bumpGlobalCounter = async function () {
    if (!CFG.visitCounterKey || sessionStorage.getItem("gsa_counted")) return;
    sessionStorage.setItem("gsa_counted", "1");
    try { await fetch(`https://api.counterapi.dev/v1/${encodeURIComponent(CFG.visitCounterKey)}/visits/up`, { mode: "cors" }); } catch (e) {}
  };
  store.globalCounter = async function () {
    if (!CFG.visitCounterKey) return null;
    try { const r = await fetch(`https://api.counterapi.dev/v1/${encodeURIComponent(CFG.visitCounterKey)}/visits`); const j = await r.json(); return j.count ?? null; } catch (e) { return null; }
  };

  window.GSA = window.GSA || {};
  window.GSA.store = store;
})();
