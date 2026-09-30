/* Admin panel: tests (docx/JSON upload), notices, enquiries, students & results */
document.addEventListener("gsa:ready", async ({ detail: { user } }) => {
  const { esc, fmtDT, requireAuth, toast } = GSA.ui, store = GSA.store, panel = document.getElementById("panel");
  if (!requireAuth(user, "Sign in with an admin account.")) return;
  if (!user.isAdmin) { panel.innerHTML = `<div class="alert err">This account is not an admin. Admin emails are listed in <code>js/config.js</code>.</div>`; return; }
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const dl = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; a.click(); };

  /* ---------- DOCX PARSER (same format as tools/convert_docx.py) ---------- */
  async function parseDocx(file) {
    if (!window.JSZip) throw new Error("Docx parser library (js/jszip.min.js) did not load. Use JSON upload instead, or convert with tools/convert_docx.py.");
    const zip = await JSZip.loadAsync(file);
    const xml = await zip.file("word/document.xml").async("string");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const text = (el) => Array.from(el.getElementsByTagNameNS(W, "t")).map(t => t.textContent).join("").trim();
    const body = doc.getElementsByTagNameNS(W, "body")[0];
    const sections = [], questions = [];
    let title = "";
    for (const el of body.children) {
      if (el.localName === "p") {
        const t = text(el); if (!t) continue;
        const m = t.match(/SECTION\s+([A-Z])\s*[—-]\s*(.+?)\s*\[Questions\s+(\d+)\s*[–-]\s*(\d+)\]/);
        if (m) sections.push({ name: `Section ${m[1]}: ${m[2].replace(/\w\S*/g, w => w[0] + w.slice(1).toLowerCase())}`, from: +m[3] - 1, to: +m[4] });
        else if (!title && !t.startsWith("SECTION")) title = t;
      } else if (el.localName === "tbl") {
        const q = { options: [], answer: null, solution: "", marks: 4, negative: 1 };
        for (const tr of el.getElementsByTagNameNS(W, "tr")) {
          const cells = Array.from(tr.getElementsByTagNameNS(W, "tc")).map(text);
          const key = (cells[0] || "").toLowerCase();
          if (key === "question") q.text = (cells[1] || "").replace(/^\d+\.\s*/, "");
          else if (key === "option") { q.options.push(cells[1] || ""); if ((cells[2] || "").toLowerCase() === "correct") q.answer = q.options.length - 1; }
          else if (key === "solution") q.solution = (cells[1] || "").replace(/^Correct Answer:\s*[A-D]\)\s*[^.]*\.\s*/, "");
          else if (key === "marks") { q.marks = parseFloat(cells[1]) || 4; q.negative = parseFloat(cells[2]) || 0; }
        }
        if (q.text && q.options.length) questions.push(q);
      }
    }
    return { title: title || file.name.replace(/\.docx$/i, "").replace(/_/g, " "), sections, questions };
  }

  /* ---------- PAGES ---------- */
  const pages = {
    async overview() {
      const [tests, enq, users, attempts, notices, stats, globalVisits] = await Promise.all([store.listTests(), store.listEnquiries(), store.listUsers(), store.listAllAttempts(), store.listNotices(), store.visitStats(30), store.globalCounter()]);
      const views = stats.reduce((n, d) => n + (d.views || 0), 0), visitors = stats.reduce((n, d) => n + (d.visitors || 0), 0);
      const today = new Date().toISOString().slice(0, 10), td = stats.find(d => d.day === today) || { views: 0, visitors: 0 };
      const max = Math.max(1, ...stats.map(d => d.views || 0));
      const pageTotals = {}; stats.forEach(d => Object.entries(d.pages || {}).forEach(([p, n]) => pageTotals[p] = (pageTotals[p] || 0) + n));
      const topPages = Object.entries(pageTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const week = Date.now() - 7 * 86400000;
      panel.innerHTML = `<h1>Admin overview</h1>
        <div class="kpis"><div class="stat" style="grid-column: span 2; background: var(--ink); color: #fff"><b style="color:#ffd58a; font-size:2.2rem">${globalVisits === null ? "—" : globalVisits.toLocaleString("en-IN")}</b><span style="color:#c9d1d8">Total visitors to geoscholarsacademy.org (all devices, since launch)${globalVisits === null ? " · counter unreachable right now" : ""}</span></div></div>
        ${store.mode === "local" ? `<div class="alert info small">The big number above is site-wide. The 30-day breakdown below, student list and enquiry list are from <em>this browser only</em> until Firebase is switched on (Help tab).</div>` : ""}
        <h3>Website traffic — last 30 days</h3>
        <div class="kpis">
          <div class="stat"><b>${visitors}</b><span>Visitors (sessions)</span></div><div class="stat"><b>${views}</b><span>Page views</span></div><div class="stat"><b>${td.visitors || 0} / ${td.views || 0}</b><span>Today: visitors / views</span></div><div class="stat"><b>${enq.length}</b><span>Enquiries total</span></div><div class="stat"><b>${enq.filter(e => e.at > week).length}</b><span>Enquiries this week</span></div>
        </div>
        <div class="card" style="margin-bottom:1.5rem"><div class="bars">${stats.length ? stats.map(d => `<i style="height:${Math.round(100 * (d.views || 0) / max)}%" data-t="${d.day}: ${d.views || 0} views"></i>`).join("") : "<span class='muted small'>No visits recorded yet.</span>"}</div><p class="small muted" style="margin:.5rem 0 0">Daily page views (hover a bar). ${topPages.length ? "Most viewed: " + topPages.map(([p, n]) => `${esc(p.replace(".html", "").replace(/_html$/, ""))} (${n})`).join(" · ") : ""}</p></div>
        <div class="card" style="margin-bottom:1.5rem" id="geo-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap"><h4 style="margin:0">Where visitors come from (last 7 days)</h4><a href="#" class="small" id="go-visitors">Full visitor log with IP addresses →</a></div><div id="geo-summary" class="small muted" style="margin-top:.5rem">Loading…</div></div>
        <h3>Students & tests</h3>
        <div class="kpis">
          <div class="stat"><b>${users.length}</b><span>Registered students</span></div><div class="stat"><b>${users.filter(u => u.createdAt > week).length}</b><span>New this week</span></div><div class="stat"><b>${attempts.length}</b><span>Test attempts</span></div><div class="stat"><b>${tests.length}</b><span>Live tests</span></div><div class="stat"><b>${notices.length}</b><span>Notices</span></div>
        </div>
        <h3>Recent attempts</h3>${attempts.length ? `<div class="table-wrap"><table><tr><th>When</th><th>Student</th><th>Test</th><th>Score</th></tr>${attempts.slice(0, 10).map(a => `<tr><td>${fmtDT(a.at)}</td><td><a href="#" data-stu="${esc(a.uid || "")}">${esc(a.userName)}</a></td><td>${esc(a.testTitle)}</td><td>${a.score} / ${a.maxMarks}</td></tr>`).join("")}</table></div>` : "<p class='muted'>No attempts yet.</p>"}
        <h3 style="margin-top:1.5rem">Latest enquiries</h3>${enq.length ? `<div class="table-wrap"><table><tr><th>When</th><th>Name</th><th>Phone</th><th>Course</th></tr>${enq.slice(0, 5).map(e => `<tr><td>${fmtDT(e.at)}</td><td>${esc(e.name)}</td><td>${esc(e.phone)}</td><td>${esc(e.course)}</td></tr>`).join("")}</table></div>` : "<p class='muted'>No enquiries yet.</p>"}`;
      panel.querySelectorAll("[data-stu]").forEach(x => x.onclick = (e) => { e.preventDefault(); document.querySelector('.admin-nav button[data-p=students]').click(); setTimeout(() => pages.studentDetail(x.dataset.stu), 300); });
      document.getElementById("go-visitors").onclick = (e) => { e.preventDefault(); document.querySelector('.admin-nav button[data-p=visitors]').click(); };
      (async () => { try { const v = (await store.listVisits(400)).filter(x => x.at > week); const m = {}; v.forEach(x => { const k = [x.city, x.region].filter(Boolean).join(", ") || "Unknown"; m[k] = (m[k] || 0) + 1; }); const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8); const el = document.getElementById("geo-summary"); if (el) el.innerHTML = v.length ? `<b>${v.length}</b> sessions · <b>${new Set(v.map(x => x.ip)).size}</b> unique IPs · ${Math.round(100 * v.filter(x => x.device === "Mobile").length / v.length)}% mobile<br>` + top.map(([k, n]) => `<span class="chip" style="cursor:default">${esc(k)} <b>${n}</b></span>`).join(" ") : "No visits recorded yet."; } catch (e) { const el = document.getElementById("geo-summary"); if (el) el.textContent = "Visitor log unavailable."; } })();
    },

    async tests() {
      const custom = await store.listCustomTests();
      const builtin = (window.GSA_BUILTIN_TESTS || []);
      const hidden = new Set(custom.filter(t => t.hidden).map(t => t.id));
      panel.innerHTML = `<h1>Tests</h1>
        <div class="card" style="margin-bottom:1.5rem"><h3>Add a test</h3>
          <p class="small muted">Upload a question-bank <strong>.docx</strong> in the GSA table format (Question / Type / Option ×4 / Solution / Marks), or a <strong>.json</strong> exported from this panel.</p>
          <div class="drop" id="drop">Drop a .docx / .json here or click to choose<input type="file" id="file" accept=".docx,.json" class="hidden"></div>
          <div id="parsed" class="hidden" style="margin-top:1rem">
            <div class="alert ok" id="parsed-msg"></div>
            <div class="form-row"><div class="field"><label>Title</label><input id="t-title"></div><div class="field"><label>Category</label><input id="t-cat" value="Geology" list="cats"><datalist id="cats"><option>Geology</option><option>ONGC</option><option>GATE GG</option><option>UPSC CGS</option><option>State PSC</option></datalist></div></div>
            <div class="form-row"><div class="field"><label>Difficulty</label><select id="t-diff"><option>Easy</option><option>Medium</option><option selected>Hard</option><option>Mixed</option></select></div><div class="field"><label>Duration (minutes)</label><input id="t-dur" type="number" min="5"></div></div>
            <div class="field"><label>Description (optional)</label><input id="t-desc" placeholder="Shown on the test card"></div>
            <div style="display:flex;gap:.6rem"><button class="btn primary" id="t-save">Publish test</button><button class="btn ghost" id="t-cancel">Cancel</button></div>
          </div>
          <div id="t-msg" class="alert hidden"></div>
        </div>
        <h3>Tests added from this panel</h3>
        ${custom.filter(t => !t.hidden).length ? `<div class="table-wrap"><table><tr><th>Title</th><th>Qs</th><th>Duration</th><th>Category</th><th></th></tr>${custom.filter(t => !t.hidden).map(t => `<tr><td>${esc(t.title)}</td><td>${t.questions.length}</td><td>${t.durationMinutes} min</td><td>${esc(t.category || "")}</td><td style="white-space:nowrap"><a href="test.html?id=${encodeURIComponent(t.id)}" target="_blank">Preview</a> · <a href="#" data-exp="${esc(t.id)}">Export JSON</a> · <a href="#" data-del="${esc(t.id)}" style="color:var(--red)">Delete</a></td></tr>`).join("")}</table></div>` : "<p class='muted small'>None yet.</p>"}
        <h3 style="margin-top:2rem">Built-in tests (from data/tests.js)</h3>
        <div class="table-wrap"><table><tr><th>Title</th><th>Qs</th><th>Duration</th><th>Status</th><th></th></tr>${builtin.map(t => `<tr><td>${esc(t.title)}</td><td>${t.questions.length}</td><td>${t.durationMinutes} min</td><td>${hidden.has(t.id) ? '<span class="badge grey">Hidden</span>' : '<span class="badge moss">Live</span>'}</td><td><a href="#" data-toggle="${esc(t.id)}">${hidden.has(t.id) ? "Show" : "Hide"}</a></td></tr>`).join("")}</table></div>
        <p class="small muted" style="margin-top:.8rem">To add tests permanently for all visitors without a database, run <code>python tools/convert_docx.py "Free test Series/*.docx" -o data/tests.js</code> and re-upload the site.</p>`;

      let parsed = null;
      const drop = document.getElementById("drop"), fileIn = document.getElementById("file"), msg = document.getElementById("t-msg");
      drop.onclick = () => fileIn.click();
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
      drop.ondragleave = () => drop.classList.remove("over");
      drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); handle(e.dataTransfer.files[0]); };
      fileIn.onchange = () => handle(fileIn.files[0]);
      async function handle(file) {
        if (!file) return; msg.classList.add("hidden");
        try {
          parsed = file.name.toLowerCase().endsWith(".json") ? JSON.parse(await file.text()) : await parseDocx(file);
          if (!parsed.questions?.length) throw new Error("No questions found in this file.");
          const bad = parsed.questions.filter(q => q.answer === null || q.answer === undefined).length;
          document.getElementById("parsed-msg").textContent = `Parsed ${parsed.questions.length} questions${parsed.sections?.length ? `, ${parsed.sections.length} sections` : ""}${bad ? ` — WARNING: ${bad} question(s) have no correct option marked` : ""}.`;
          document.getElementById("t-title").value = parsed.title || ""; document.getElementById("t-dur").value = parsed.durationMinutes || Math.max(30, parsed.questions.length * 2);
          if (parsed.category) document.getElementById("t-cat").value = parsed.category; if (parsed.difficulty) document.getElementById("t-diff").value = parsed.difficulty; document.getElementById("t-desc").value = parsed.description || "";
          document.getElementById("parsed").classList.remove("hidden");
        } catch (e) { toast(msg, "err", "Could not read file: " + e.message); }
      }
      document.getElementById("t-cancel").onclick = () => { parsed = null; document.getElementById("parsed").classList.add("hidden"); };
      document.getElementById("t-save").onclick = async () => {
        const title = document.getElementById("t-title").value.trim(); if (!title) return toast(msg, "err", "Title is required.");
        const t = { ...parsed, id: parsed.id && !builtin.some(b => b.id === parsed.id) ? parsed.id : slug(title) + "-" + Date.now().toString(36), title, category: document.getElementById("t-cat").value.trim(), difficulty: document.getElementById("t-diff").value, durationMinutes: +document.getElementById("t-dur").value || 60, description: document.getElementById("t-desc").value.trim(), createdAt: Date.now(), createdBy: user.email };
        delete t.builtin; delete t.hidden;
        try { await store.saveTest(t); pages.tests(); } catch (e) { toast(msg, "err", e.message); }
      };
      panel.querySelectorAll("[data-del]").forEach(a => a.onclick = async (e) => { e.preventDefault(); if (confirm("Delete this test? Student attempts remain in their history.")) { await store.deleteTest(a.dataset.del); pages.tests(); } });
      panel.querySelectorAll("[data-exp]").forEach(a => a.onclick = async (e) => { e.preventDefault(); const t = custom.find(x => x.id === a.dataset.exp); dl(t.id + ".json", JSON.stringify(t, null, 1)); });
      panel.querySelectorAll("[data-toggle]").forEach(a => a.onclick = async (e) => { e.preventDefault(); const id = a.dataset.toggle; if (hidden.has(id)) await store.deleteTest(id); else await store.saveTest({ id, hidden: true }); pages.tests(); });
    },

    async notices() {
      const notices = await store.listNotices();
      panel.innerHTML = `<h1>Notices</h1>
        <div class="card" style="margin-bottom:1.5rem"><h3>Post a notice</h3>
          <div class="form-row"><div class="field"><label>Title</label><input id="n-title"></div><div class="field"><label>Date</label><input id="n-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div></div>
          <div class="field"><label>Text</label><textarea id="n-text" style="min-height:80px"></textarea></div>
          <div id="n-msg" class="alert hidden"></div><button class="btn primary" id="n-save">Publish notice</button></div>
        ${notices.length ? notices.map(n => `<div class="notice" style="display:flex;gap:1rem;align-items:flex-start"><div style="flex:1"><time>${esc(n.date)}</time><h4 style="margin:.2rem 0">${esc(n.title)}</h4><p class="small" style="margin:0">${esc(n.text)}</p></div><a href="#" data-del="${esc(n.id)}" style="color:var(--red)" class="small">Delete</a></div>`).join("") : "<p class='muted small'>No notices posted from the panel. Default notices live in data/site.js.</p>"}`;
      document.getElementById("n-save").onclick = async () => {
        const title = document.getElementById("n-title").value.trim(), text = document.getElementById("n-text").value.trim();
        if (!title) return toast(document.getElementById("n-msg"), "err", "Title is required.");
        await store.saveNotice({ id: store.newId(), title, text, date: document.getElementById("n-date").value, at: Date.now() }); pages.notices();
      };
      panel.querySelectorAll("[data-del]").forEach(a => a.onclick = async (e) => { e.preventDefault(); await store.deleteNotice(a.dataset.del); pages.notices(); });
    },

    async enquiries() {
      const enq = await store.listEnquiries();
      const STATUS = ["New", "Contacted", "Follow-up", "Joined", "Not interested"];
      const col = { "New": "", "Contacted": "grey", "Follow-up": "", "Joined": "moss", "Not interested": "red" };
      const counts = STATUS.map(st => [st, enq.filter(e => (e.status || "New") === st).length]);
      panel.innerHTML = `<h1>Enquiries <span class="badge">${enq.length}</span></h1>
        <div class="kpis">${counts.map(([st, n]) => `<div class="stat"><b>${n}</b><span>${st}</span></div>`).join("")}</div>
        <div class="toolbar"><input id="e-q" placeholder="Search name / phone / course…"><select id="e-f"><option value="">All statuses</option>${STATUS.map(x => `<option>${x}</option>`).join("")}</select><button class="btn ghost sm" id="csv">Download CSV</button></div>
        <p class="small muted">Admissions pipeline: set a status and a note after every call. "Joined" students should also be added to their profile's course list.</p>
        ${enq.length ? `<div class="table-wrap"><table id="e-table"><tr><th>When</th><th>Name</th><th>Contact</th><th>Course</th><th>Qualification</th><th>Message</th><th>Status</th><th>Notes</th></tr>${enq.map(e => `<tr data-row="${esc((e.name + " " + e.phone + " " + (e.email || "") + " " + (e.course || "")).toLowerCase())}" data-st="${esc(e.status || "New")}"><td style="white-space:nowrap" class="small">${fmtDT(e.at)}${e.delivered === false ? "<br><span class='badge red'>not emailed</span>" : ""}</td><td><b>${esc(e.name)}</b></td><td class="small">${e.phone ? `<a href="tel:${esc(e.phone)}">${esc(e.phone)}</a>` : ""}${e.phone ? ` · <a href="https://wa.me/${esc(String(e.phone).replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}<br><span class="muted">${esc(e.email || "")}</span></td><td class="small">${esc(e.course || "")}</td><td class="small">${esc(e.qualification || "")}</td><td class="small" style="max-width:260px">${esc(e.message || "")}</td><td><select data-st-for="${esc(e.id)}">${STATUS.map(x => `<option ${(e.status || "New") === x ? "selected" : ""}>${x}</option>`).join("")}</select></td><td><input data-note-for="${esc(e.id)}" value="${esc(e.notes || "")}" placeholder="e.g. called 2 Oct, wants fee details" style="min-width:200px"></td></tr>`).join("")}</table></div>` : "<p class='muted'>No enquiries yet.</p>"}`;
      const filt = () => { const q = document.getElementById("e-q").value.toLowerCase(), f = document.getElementById("e-f").value; panel.querySelectorAll("#e-table tr[data-row]").forEach(r => r.style.display = (r.dataset.row.includes(q) && (!f || r.dataset.st === f)) ? "" : "none"); };
      document.getElementById("e-q").oninput = filt; document.getElementById("e-f").onchange = filt;
      panel.querySelectorAll("[data-st-for]").forEach(sel => sel.onchange = async () => { await store.updateEnquiry(sel.dataset.stFor, { status: sel.value, statusAt: Date.now() }); sel.closest("tr").dataset.st = sel.value; });
      panel.querySelectorAll("[data-note-for]").forEach(inp => inp.onchange = async () => { await store.updateEnquiry(inp.dataset.noteFor, { notes: inp.value.trim() }); inp.style.borderColor = "var(--moss)"; setTimeout(() => inp.style.borderColor = "", 800); });
      const c = document.getElementById("csv"); if (c) c.onclick = () => {
        const rows = [["When", "Name", "Phone", "Email", "Course", "Qualification", "Message", "Status", "Notes"], ...enq.map(e => [fmtDT(e.at), e.name, e.phone, e.email, e.course, e.qualification, e.message, e.status || "New", e.notes || ""])];
        const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "gsa-enquiries.csv"; a.click();
      };
    },

    async students() {
      const [users, attempts, tests] = await Promise.all([store.listUsers(), store.listAllAttempts(), store.listTests()]);
      const byUser = {}; attempts.forEach(a => { (byUser[a.uid] = byUser[a.uid] || []).push(a); });
      panel.innerHTML = `<h1>Students &amp; results</h1><div id="stu-detail"></div>
        <div class="toolbar"><input id="stu-q" placeholder="Search name / email / phone…"><select id="lb-test"><option value="">Leaderboard: choose a test</option>${tests.map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join("")}</select><button class="btn ghost sm" id="stu-csv">Download CSV</button><button class="btn ghost sm" id="stu-copy-mail">Copy all emails</button><button class="btn ghost sm" id="stu-copy-ph">Copy all phones</button><button class="btn ghost sm" id="stu-wa">WhatsApp broadcast</button></div>
        <div id="wa-box" class="card hidden" style="margin-bottom:1rem"><h3>WhatsApp broadcast</h3><p class="small muted">Type the message once; click each name to open WhatsApp with it pre-filled (WhatsApp Web must be logged in). Only students with a phone number are listed.</p><div class="field"><textarea id="wa-msg" style="min-height:70px" placeholder="Hi {name}, tomorrow's GATE class is at 7 PM. Join link is on your dashboard."></textarea></div><div id="wa-list" class="chips"></div></div>
        <div id="lb"></div>
        <h3>Registered students <span class="badge">${users.length}</span></h3><p class="small muted">Click a name for the full performance report.</p>
        <div class="table-wrap"><table id="stu-table"><tr><th>Name</th><th>Contact</th><th>Age / City</th><th>Qualification</th><th>Target exams</th><th>GSA courses</th><th>Profile</th><th>Joined</th><th>Attempts</th><th>Best %</th><th>Avg acc.</th><th>Last active</th></tr>${users.map(u => { const cn = (id) => ((window.GSA_SITE || {}).courses || []).find(c => c.id === id)?.name || id; const pc = store.profileCompleteness(u); const l = byUser[u.uid] || []; const best = l.length ? Math.max(...l.map(a => Math.round(100 * a.score / a.maxMarks))) + "%" : "—"; const acc = l.length ? Math.round(100 * l.reduce((n, a) => n + (a.correct + a.wrong ? a.correct / (a.correct + a.wrong) : 0), 0) / l.length) + "%" : "—"; const last = l.length ? fmtDT(Math.max(...l.map(a => a.at))) : "—"; return `<tr data-row="${esc((u.name + " " + u.email + " " + (u.phone || "") + " " + (u.city || "") + " " + (u.college || "") + " " + (u.targetExams || []).join(" ") + " " + (u.courses || []).map(cn).join(" ")).toLowerCase())}"><td><a href="#" data-stu="${esc(u.uid)}"><b>${esc(u.name)}</b></a>${u.isAdmin ? ' <span class="badge">admin</span>' : ""}</td><td class="small">${esc(u.email)}<br>${esc(u.phone || "")}</td><td class="small">${esc(u.age || "—")}${u.city ? " · " + esc(u.city) : ""}</td><td class="small">${esc(u.qualification || "—")}${u.college ? "<br><span class='muted'>" + esc(u.college) + "</span>" : ""}</td><td class="small">${(u.targetExams || []).map(x => `<span class="badge moss">${esc(x)}</span>`).join(" ") || "—"}</td><td class="small">${(u.courses || []).map(x => esc(cn(x))).join("<br>") || "<span class='muted'>none</span>"}</td><td><span class="badge ${pc >= 80 ? "moss" : pc >= 40 ? "" : "red"}">${pc}%</span></td><td class="small">${u.createdAt ? fmtDT(u.createdAt) : ""}</td><td>${l.length}</td><td>${best}</td><td>${acc}</td><td>${last}</td></tr>`; }).join("")}</table></div>`;
      document.getElementById("stu-q").oninput = (e) => { const q = e.target.value.toLowerCase(); panel.querySelectorAll("#stu-table tr[data-row]").forEach(r => r.style.display = r.dataset.row.includes(q) ? "" : "none"); };
      const copy = (txt, btn) => { navigator.clipboard.writeText(txt).then(() => { const o = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => btn.textContent = o, 1500); }); };
      document.getElementById("stu-copy-mail").onclick = (e) => copy(users.filter(u => !u.isAdmin && u.email).map(u => u.email).join(", "), e.target);
      document.getElementById("stu-copy-ph").onclick = (e) => copy(users.filter(u => !u.isAdmin && u.phone).map(u => u.phone).join(", "), e.target);
      document.getElementById("stu-wa").onclick = () => { const box = document.getElementById("wa-box"); box.classList.toggle("hidden"); const render = () => { const msg = document.getElementById("wa-msg").value; document.getElementById("wa-list").innerHTML = users.filter(u => !u.isAdmin && u.phone).map(u => `<a class="chip" href="https://wa.me/${String(u.phone).replace(/\D/g, "")}?text=${encodeURIComponent(msg.replace(/\{name\}/g, u.name || ""))}" target="_blank" rel="noopener">${esc(u.name)}</a>`).join("") || "<span class='small muted'>No phone numbers on file.</span>"; }; document.getElementById("wa-msg").oninput = render; render(); };
      document.getElementById("stu-csv").onclick = () => {
        const cn = (id) => ((window.GSA_SITE || {}).courses || []).find(c => c.id === id)?.name || id;
        const rows = [["Name", "Email", "Phone", "Age", "Gender", "City", "State", "Qualification", "College", "Grad year", "Target exams", "Attempt year", "GSA courses", "Study hrs/day", "Goal", "Profile %", "Joined", "Attempts", "Best %", "Avg accuracy %"], ...users.map(u => { const l = byUser[u.uid] || []; return [u.name, u.email, u.phone || "", u.age || "", u.gender || "", u.city || "", u.state || "", u.qualification || "", u.college || "", u.gradYear || "", (u.targetExams || []).join("; "), u.attemptYear || "", (u.courses || []).map(cn).join("; "), u.hours || "", u.goal || "", store.profileCompleteness(u), u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : "", l.length, l.length ? Math.max(...l.map(a => Math.round(100 * a.score / a.maxMarks))) : "", l.length ? Math.round(100 * l.reduce((n, a) => n + (a.correct + a.wrong ? a.correct / (a.correct + a.wrong) : 0), 0) / l.length) : ""]; })];
        const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "gsa-students.csv"; a.click();
      };
      const lb = () => {
        const id = document.getElementById("lb-test").value, best = {};
        if (!id) { document.getElementById("lb").innerHTML = ""; return; }
        attempts.filter(a => a.testId === id && a.uid).forEach(a => { if (!best[a.uid] || a.score > best[a.uid].score) best[a.uid] = a; });
        const rows = Object.values(best).sort((x, y) => y.score - x.score || x.timeTakenSec - y.timeTakenSec);
        document.getElementById("lb").innerHTML = rows.length ? `<div class="table-wrap" style="margin-bottom:1.5rem"><table><tr><th>#</th><th>Student</th><th>Score</th><th>Accuracy</th><th>Time</th><th>When</th></tr>${rows.map((a, i) => `<tr><td>${i + 1}</td><td><a href="#" data-stu="${esc(a.uid)}">${esc(a.userName)}</a></td><td><strong>${a.score}</strong> / ${a.maxMarks}</td><td>${a.correct + a.wrong ? Math.round(100 * a.correct / (a.correct + a.wrong)) : 0}%</td><td>${Math.floor(a.timeTakenSec / 60)}m</td><td>${fmtDT(a.at)}</td></tr>`).join("")}</table></div>` : "<p class='muted small'>No saved attempts for this test yet.</p>";
        bind();
      };
      const bind = () => panel.querySelectorAll("[data-stu]").forEach(x => x.onclick = (e) => { e.preventDefault(); pages.studentDetail(x.dataset.stu); });
      document.getElementById("lb-test").onchange = lb; bind();
    },

    async studentDetail(uid) {
      const [users, all] = await Promise.all([store.listUsers(), store.listAllAttempts()]);
      const u = users.find(x => x.uid === uid); const box = document.getElementById("stu-detail"); if (!u || !box) return;
      const list = all.filter(a => a.uid === uid).sort((x, y) => x.at - y.at);
      const acc = (a) => a.correct + a.wrong ? Math.round(100 * a.correct / (a.correct + a.wrong)) : 0;
      const pct = (a) => Math.max(0, Math.round(100 * a.score / a.maxMarks));
      const secs = {}; list.forEach(a => (a.perSec || []).forEach(s => { const k = s.name; secs[k] = secs[k] || { correct: 0, wrong: 0, total: 0, score: 0, max: 0 }; secs[k].correct += s.correct; secs[k].wrong += s.wrong; secs[k].total += s.total; secs[k].score += s.score; secs[k].max += s.max; }));
      const secRows = Object.entries(secs).filter(([k]) => k !== "All questions").map(([k, s]) => ({ k, pct: s.max ? Math.max(0, Math.round(100 * s.score / s.max)) : 0, att: s.correct + s.wrong, total: s.total })).sort((a, b) => a.pct - b.pct);
      const byTest = {}; list.forEach(a => { (byTest[a.testTitle] = byTest[a.testTitle] || []).push(a); });
      const maxS = Math.max(1, ...list.map(pct));
      box.innerHTML = `<div class="stu-detail">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start"><div><div class="eyebrow">Student report</div><h2 style="margin:0">${esc(u.name)}</h2><p class="small muted" style="margin:.2rem 0 0">${esc(u.email)}${u.phone ? " · " + esc(u.phone) : ""} · joined ${u.createdAt ? fmtDT(u.createdAt) : "—"}</p></div><button class="btn ghost sm" id="stu-close">Close</button></div>
        <div class="profile-grid" style="margin-top:1rem">
          <div class="card"><h3>Profile <span class="badge">${store.profileCompleteness(u)}%</span></h3><dl class="dl"><dt>Age</dt><dd>${esc(u.age || "—")}</dd><dt>Gender</dt><dd>${esc(u.gender || "—")}</dd><dt>City</dt><dd>${esc([u.city, u.state].filter(Boolean).join(", ") || "—")}</dd></dl></div>
          <div class="card"><h3>Education</h3><dl class="dl"><dt>Qualification</dt><dd>${esc(u.qualification || "—")}</dd><dt>College</dt><dd>${esc(u.college || "—")}</dd><dt>Grad year</dt><dd>${esc(u.gradYear || "—")}</dd></dl></div>
          <div class="card"><h3>Exam plan</h3><dl class="dl"><dt>Targets</dt><dd>${(u.targetExams || []).map(x => `<span class="badge moss">${esc(x)}</span>`).join(" ") || "—"}</dd><dt>Attempt year</dt><dd>${esc(u.attemptYear || "—")}</dd><dt>Hours/day</dt><dd>${esc(u.hours || "—")}</dd><dt>Goal</dt><dd>${esc(u.goal || "—")}</dd></dl></div>
          <div class="card"><h3>GSA courses</h3>${(u.courses || []).length ? `<ul class="clean">${u.courses.map(id => `<li>${esc(((window.GSA_SITE || {}).courses || []).find(c => c.id === id)?.name || id)}</li>`).join("")}</ul>` : "<p class='small muted'>None added by the student.</p>"}<div id="stu-att" class="small muted" style="margin-top:.6rem">Loading attendance…</div></div>
        </div>
        ${list.length ? `<div class="kpis" style="margin-top:1rem">
          <div class="stat"><b>${list.length}</b><span>Attempts</span></div><div class="stat"><b>${Math.max(...list.map(pct))}%</b><span>Best score</span></div><div class="stat"><b>${Math.round(list.reduce((n, a) => n + pct(a), 0) / list.length)}%</b><span>Average score</span></div><div class="stat"><b>${Math.round(list.reduce((n, a) => n + acc(a), 0) / list.length)}%</b><span>Average accuracy</span></div><div class="stat"><b>${list.reduce((n, a) => n + a.unattempted, 0)}</b><span>Questions skipped</span></div>
        </div>
        <div class="split" style="gap:1.5rem">
          <div><h4>Score trend</h4><div class="bars">${list.map(a => `<i style="height:${Math.round(100 * pct(a) / maxS)}%;background:${pct(a) >= 60 ? "var(--moss)" : pct(a) >= 35 ? "var(--ochre)" : "var(--red)"}" data-t="${fmtDT(a.at)} · ${esc(a.testTitle)} · ${pct(a)}%"></i>`).join("")}</div><p class="small muted">Each bar = one attempt, oldest → newest (hover for details).</p>
            <h4 style="margin-top:1rem">Per test</h4>${Object.entries(byTest).map(([t, l]) => `<div class="sec-bar"><span>${esc(t)}</span><div class="bar"><i style="width:${Math.max(...l.map(pct))}%"></i></div><b>${Math.max(...l.map(pct))}%</b></div>`).join("")}</div>
          <div><h4>Section-wise strength ${secRows.length ? "" : "<span class='small muted'>(sectioned tests only)</span>"}</h4>${secRows.length ? secRows.map(s => `<div class="sec-bar"><span>${esc(s.k.replace(/^Section\s+/, ""))}</span><div class="bar"><i style="width:${s.pct}%;background:${s.pct >= 60 ? "var(--moss)" : s.pct >= 35 ? "var(--ochre)" : "var(--red)"}"></i></div><b>${s.pct}%</b></div>`).join("") + `<p class="small muted" style="margin-top:.6rem"><strong>Needs work:</strong> ${secRows.slice(0, 2).map(s => esc(s.k.replace(/^Section\s+/, ""))).join(", ")} · <strong>Strongest:</strong> ${esc(secRows[secRows.length - 1].k.replace(/^Section\s+/, ""))}</p>` : "<p class='small muted'>Attempt the ONGC CBT mock to see section-wise analysis.</p>"}</div>
        </div>
        <h4 style="margin-top:1rem">All attempts</h4><div class="table-wrap"><table><tr><th>Date</th><th>Test</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Accuracy</th><th>Time</th><th></th></tr>${list.slice().reverse().map(a => `<tr><td>${fmtDT(a.at)}</td><td>${esc(a.testTitle)}</td><td><b>${a.score}</b> / ${a.maxMarks} (${pct(a)}%)</td><td>${a.correct}</td><td>${a.wrong}</td><td>${a.unattempted}</td><td>${acc(a)}%</td><td>${Math.floor(a.timeTakenSec / 60)}m</td><td><a href="test.html?id=${encodeURIComponent(a.testId)}&review=${a.id}" target="_blank">Review</a></td></tr>`).join("")}</table></div>` : "<p class='muted' style='margin-top:1rem'>This student has not attempted any test yet.</p>"}
      </div>`;
      document.getElementById("stu-close").onclick = () => box.innerHTML = "";
      box.scrollIntoView({ behavior: "smooth", block: "start" });
      (async () => { try { const [att, cls] = await Promise.all([store.listAttendance(uid), store.listLiveClasses()]); const el = document.getElementById("stu-att"); if (!el) return; const byC = {}; att.forEach(a => { byC[a.classId] = (byC[a.classId] || 0) + 1; }); el.innerHTML = `<b>Live-class attendance:</b> ${att.length ? Object.entries(byC).map(([id, n]) => `${esc((cls.find(c => c.id === id) || {}).title || "class")} × ${n}`).join(" · ") : "no joins recorded"}`; } catch (e) {} })();
    },

    async videos() {
      const custom = await store.listVideos();
      const builtin = ((window.GSA_SITE || {}).videos || []);
      const hidden = new Set(custom.filter(x => x.hidden).map(x => x.id));
      const ytId = (s) => { const m = String(s || "").match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(s) ? s : ""); };
      panel.innerHTML = `<h1>Free classes (videos)</h1>
        <div class="alert info small">Upload each class to your YouTube channel (Visibility: <b>Unlisted</b> if you don't want it public on YouTube), then paste the video link here. Videos stream from YouTube — no file size limits on the site.</div>
        <div class="card" style="margin-bottom:1.5rem"><h3>Add / update a class video</h3>
          <div class="form-row"><div class="field"><label>Title</label><input id="v-title" placeholder="Optical Mineralogy — GSA class"></div><div class="field"><label>Topic</label><input id="v-topic" placeholder="Mineralogy"></div></div>
          <div class="field"><label>YouTube link or video ID</label><input id="v-yt" placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX"></div>
          <div class="field"><label>Description</label><input id="v-desc"></div>
          <div class="field"><label>Replace a built-in entry? (optional)</label><select id="v-replace"><option value="">No — add as new</option>${builtin.map(b => `<option value="${esc(b.id)}">${esc(b.title)}</option>`).join("")}</select></div>
          <div id="v-msg" class="alert hidden"></div><button class="btn primary" id="v-save">Publish video</button></div>
        <h3>Published from this panel</h3>${custom.filter(x => !x.hidden).length ? custom.filter(x => !x.hidden).map(x => `<div class="notice" style="display:flex;gap:1rem;align-items:center">${x.youtube ? `<img src="https://i.ytimg.com/vi/${esc(x.youtube)}/mqdefault.jpg" style="width:96px;border-radius:6px" alt="">` : ""}<div style="flex:1"><b>${esc(x.title)}</b> <span class="badge grey">${esc(x.topic || "")}</span><br><span class="small muted">${x.youtube ? "youtu.be/" + esc(x.youtube) : esc(x.file || "")}</span></div><a href="#" data-del="${esc(x.id)}" class="small" style="color:var(--red)">Delete</a></div>`).join("") : "<p class='muted small'>None yet.</p>"}
        <h3 style="margin-top:2rem">Built-in (data/site.js)</h3>${builtin.map(b => `<div class="notice" style="display:flex;gap:1rem;${hidden.has(b.id) ? "opacity:.5" : ""}"><div style="flex:1"><b>${esc(b.title)}</b><br><span class="small muted">${b.youtube ? "youtu.be/" + esc(b.youtube) : "local file: " + esc(b.file || "") + " (not available on the live site — add a YouTube link above)"}</span></div><a href="#" data-toggle="${esc(b.id)}" class="small">${hidden.has(b.id) ? "Show" : "Hide"}</a></div>`).join("")}`;
      document.getElementById("v-save").onclick = async () => {
        const title = document.getElementById("v-title").value.trim(), yt = ytId(document.getElementById("v-yt").value.trim()), rep = document.getElementById("v-replace").value;
        if (!title || !yt) return toast(document.getElementById("v-msg"), "err", "Title and a valid YouTube link/ID are required.");
        const base = rep ? builtin.find(b => b.id === rep) : {};
        await store.saveVideo({ ...base, id: rep || store.newId(), title, youtube: yt, file: "", topic: document.getElementById("v-topic").value.trim() || base.topic || "Geology", description: document.getElementById("v-desc").value.trim() || base.description || "", at: Date.now() }); pages.videos();
      };
      document.getElementById("v-replace").onchange = (e) => { const b = builtin.find(x => x.id === e.target.value); if (b) { document.getElementById("v-title").value = b.title; document.getElementById("v-topic").value = b.topic || ""; document.getElementById("v-desc").value = b.description || ""; } };
      panel.querySelectorAll("[data-del]").forEach(x => x.onclick = async (e) => { e.preventDefault(); await store.deleteVideo(x.dataset.del); pages.videos(); });
      panel.querySelectorAll("[data-toggle]").forEach(x => x.onclick = async (e) => { e.preventDefault(); const id = x.dataset.toggle; if (hidden.has(id)) await store.deleteVideo(id); else await store.saveVideo({ id, hidden: true }); pages.videos(); });
    },

    async stories() {
      const custom = await store.listStories();
      const builtin = ((window.GSA_SITE || {}).successStories || []);
      const hidden = new Set(custom.filter(x => x.hidden).map(x => x.id));
      const editing = { photo: "" };
      panel.innerHTML = `<h1>Success stories</h1>
        <div class="alert info small">These appear in the home-page spotlight and honour wall. Use a poster or a clear photo (portrait works best); it is resized automatically.</div>
        <div class="card" style="margin-bottom:1.5rem"><h3 id="st-form-title">Add a success story</h3>
          <div class="form-row"><div class="field"><label>Student name *</label><input id="st-name"></div><div class="field"><label>Achievement * (e.g. AIR 12 · GATE GG 2027)</label><input id="st-ach"></div></div>
          <div class="form-row"><div class="field"><label>Batch / background</label><input id="st-batch" placeholder="Advanced Batch (GSI, NET, GATE)"></div><div class="field"><label>Photo / poster</label><input type="file" id="st-photo" accept="image/*"></div></div>
          <div class="field"><label>Student's words (shown in quotes) or a caption</label><textarea id="st-text" style="min-height:70px"></textarea></div>
          <div id="st-preview" class="hidden" style="margin-bottom:.8rem"><img style="max-height:160px;border-radius:10px" alt=""></div>
          <div id="st-msg" class="alert hidden"></div><button class="btn primary" id="st-save">Publish story</button> <button class="btn ghost hidden" id="st-cancel">Cancel edit</button></div>
        <h3>Published from this panel <span class="badge">${custom.filter(x => !x.hidden).length}</span></h3>
        <div class="grid" style="margin-bottom:2rem">${custom.filter(x => !x.hidden).map(x => `<div class="card" style="display:flex;gap:.8rem;align-items:flex-start">${x.photo ? `<img src="${esc(x.photo)}" style="width:72px;height:90px;object-fit:cover;border-radius:8px" alt="">` : ""}<div style="flex:1"><b>${esc(x.name)}</b><br><span class="small" style="color:var(--ochre-dark)">${esc(x.achievement || "")}</span><br><span class="small muted">${esc(x.batch || "")}</span><br><a href="#" data-edit="${esc(x.id)}" class="small">Edit</a> · <a href="#" data-del="${esc(x.id)}" class="small" style="color:var(--red)">Delete</a></div></div>`).join("") || "<p class='muted small'>None yet.</p>"}</div>
        <h3>Built-in stories (from data/site.js)</h3><p class="small muted">Hide any you no longer want on the site; edit a built-in story to publish a corrected copy.</p>
        <div class="grid">${builtin.map(b => `<div class="card" style="display:flex;gap:.8rem;align-items:flex-start;${hidden.has(b.id) ? "opacity:.45" : ""}">${b.photo ? `<img src="${esc(b.photo)}" style="width:72px;height:90px;object-fit:cover;border-radius:8px" alt="">` : ""}<div style="flex:1"><b>${esc(b.name)}</b><br><span class="small" style="color:var(--ochre-dark)">${esc(b.achievement || "")}</span><br><a href="#" data-edit-b="${esc(b.id)}" class="small">Edit</a> · <a href="#" data-toggle="${esc(b.id)}" class="small">${hidden.has(b.id) ? "Show again" : "Hide"}</a></div></div>`).join("")}</div>`;
      const f = (id) => document.getElementById(id);
      const fill = (x) => { f("st-name").value = x.name || ""; f("st-ach").value = x.achievement || ""; f("st-batch").value = x.batch || ""; f("st-text").value = x.quote || x.text || ""; editing.id = x.id; editing.photo = x.photo || ""; editing.builtin = !!x.builtin; if (x.photo) { f("st-preview").classList.remove("hidden"); f("st-preview").querySelector("img").src = x.photo; } f("st-form-title").textContent = "Edit: " + (x.name || ""); f("st-cancel").classList.remove("hidden"); f("st-save").textContent = "Save changes"; window.scrollTo({ top: 0, behavior: "smooth" }); };
      f("st-photo").onchange = (e) => { const file = e.target.files[0]; if (!file) return; const img = new Image(); img.onload = () => { const max = 900, sc = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); editing.photo = c.toDataURL("image/jpeg", .82); f("st-preview").classList.remove("hidden"); f("st-preview").querySelector("img").src = editing.photo; }; img.src = URL.createObjectURL(file); };
      f("st-save").onclick = async () => {
        const name = f("st-name").value.trim(), achievement = f("st-ach").value.trim();
        if (!name || !achievement) return toast(f("st-msg"), "err", "Name and achievement are required.");
        if (editing.photo && editing.photo.length > 900000) return toast(f("st-msg"), "err", "Photo is too large even after resizing — please use a smaller image.");
        const txt = f("st-text").value.trim();
        await store.saveStory({ id: editing.id || store.newId(), name, achievement, batch: f("st-batch").value.trim(), quote: txt, text: "", photo: editing.photo || "", fit: "contain", at: Date.now() });
        pages.stories();
      };
      f("st-cancel").onclick = () => pages.stories();
      panel.querySelectorAll("[data-edit]").forEach(a => a.onclick = (e) => { e.preventDefault(); fill(custom.find(x => x.id === a.dataset.edit)); });
      panel.querySelectorAll("[data-edit-b]").forEach(a => a.onclick = (e) => { e.preventDefault(); fill({ ...builtin.find(x => x.id === a.dataset.editB), builtin: true }); });
      panel.querySelectorAll("[data-del]").forEach(a => a.onclick = async (e) => { e.preventDefault(); if (!confirm("Delete this story?")) return; await store.deleteStory(a.dataset.del); pages.stories(); });
      panel.querySelectorAll("[data-toggle]").forEach(a => a.onclick = async (e) => { e.preventDefault(); const id = a.dataset.toggle; if (hidden.has(id)) await store.deleteStory(id); else await store.saveStory({ id, hidden: true }); pages.stories(); });
    },

    async vacancies() {
      const custom = await store.listCustomVacancies();
      const all = await store.listAllVacancies();
      const days = (v) => v.lastDate ? Math.ceil((new Date(v.lastDate + "T23:59:59") - Date.now()) / 86400000) : null;
      const statusOf = (v) => v.upcoming ? ["Upcoming", "grey"] : days(v) === null ? ["Open", "moss"] : days(v) < 0 ? ["Closed", "red"] : days(v) <= 7 ? ["Closing soon", ""] : ["Open", "moss"];
      const repo = "josabantajani22-wq/geoscholars-site", updated = (window.GSA_VACANCIES || {}).updatedAt || "—";
      const token = localStorage.getItem("gsa_gh_token") || "";
      panel.innerHTML = `<h1>Vacancies</h1>
        <div class="card" style="margin-bottom:1.5rem;background:var(--ink);color:#fff">
          <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center">
            <div><b>Automatic feed (FreeJobAlert → site)</b><br><span class="small" style="color:#aab4be">Runs every day at 07:00 IST · last data update: <b style="color:#fff">${esc(updated)}</b> · <span id="run-status">checking last run…</span></span></div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn primary sm" id="refresh-now">⟳ Refresh now</button><a class="btn ghost sm" style="color:#fff;border-color:rgba(255,255,255,.4)" href="https://github.com/${repo}/actions/workflows/vacancies.yml" target="_blank" rel="noopener">Open run log</a></div>
          </div>
          <div id="gh-token-box" class="${token ? "hidden" : ""}" style="margin-top:.8rem;padding-top:.8rem;border-top:1px solid rgba(255,255,255,.15)"><p class="small" style="margin:0 0 .4rem;color:#aab4be">One-time setup for the Refresh button: GitHub → your profile photo → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate → Repository access: only <code>geoscholars-site</code> → Permissions → Actions: <b>Read and write</b> → Generate → paste here. It is stored only in this browser.</p><div style="display:flex;gap:.5rem"><input id="gh-token" placeholder="github_pat_…" style="flex:1"><button class="btn ghost sm" id="gh-token-save" style="color:#fff;border-color:rgba(255,255,255,.4)">Save token</button></div></div>
          <div id="refresh-msg" class="alert hidden" style="margin-top:.8rem"></div>
        </div>
        <div class="card" style="margin-bottom:1.5rem"><h3 id="vc-form-title">Add a vacancy by hand</h3>
          <div class="form-row"><div class="field"><label>Title *</label><input id="vc-title" placeholder="GSI — Geologist (Ordinary Grade)"></div><div class="field"><label>Organisation *</label><input id="vc-org" placeholder="GSI"></div></div>
          <div class="form-row"><div class="field"><label>Posts (number)</label><input id="vc-posts" type="number" min="0"></div><div class="field"><label>Qualification</label><input id="vc-qual" placeholder="M.Sc. Geology / Applied Geology"></div></div>
          <div class="form-row"><div class="field"><label>Application start</label><input id="vc-start" type="date"></div><div class="field"><label>Last date *</label><input id="vc-last" type="date"></div></div>
          <div class="form-row"><div class="field"><label>Apply / notification link</label><input id="vc-url" placeholder="https://…"></div><div class="field"><label>Tags (comma separated)</label><input id="vc-tags" placeholder="GSI, Central Govt"></div></div>
          <div class="field"><label>Summary (age, fee, exam pattern…)</label><textarea id="vc-summary" style="min-height:70px"></textarea></div>
          <label class="check" style="margin-bottom:.8rem"><input type="checkbox" id="vc-upcoming"> Upcoming (notification expected — no last date yet)</label>
          <div id="vc-msg" class="alert hidden"></div><button class="btn primary" id="vc-save">Publish vacancy</button> <button class="btn ghost hidden" id="vc-cancel">Cancel edit</button></div>
        <h3>All vacancies on the site <span class="badge">${all.length}</span></h3>
        <div class="table-wrap"><table><tr><th>Status</th><th>Title</th><th>Organisation</th><th>Posts</th><th>Last date</th><th>Source</th><th></th></tr>${all.sort((a, b) => (a.lastDate || "9999").localeCompare(b.lastDate || "9999")).map(v => { const [st, cl] = statusOf(v); return `<tr><td><span class="badge ${cl}">${st}</span></td><td><b>${esc(v.title)}</b></td><td class="small">${esc(v.organisation || "")}</td><td class="small">${v.posts ?? ""}</td><td class="small">${v.lastDate ? new Date(v.lastDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : (v.upcoming ? "expected" : "")}</td><td class="small">${v.builtin ? (v.source === "freejobalert" ? "FreeJobAlert bot" : "built-in") : "admin"}</td><td class="small" style="white-space:nowrap"><a href="#" data-edit="${esc(v.id)}">Edit</a> · <a href="#" data-hide="${esc(v.id)}" style="color:var(--red)">${v.builtin ? "Hide" : "Delete"}</a></td></tr>`; }).join("")}</table></div>`;
      const f = (id) => document.getElementById(id); let editingId = "";
      // --- refresh via GitHub Actions (workflow_dispatch) ---
      const ghHeaders = (t) => ({ "Accept": "application/vnd.github+json", "Authorization": "Bearer " + t, "X-GitHub-Api-Version": "2022-11-28" });
      const lastRun = async () => { try { const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/vacancies.yml/runs?per_page=1`); const j = await r.json(); const run = (j.workflow_runs || [])[0]; if (!run) { f("run-status").textContent = "no run yet"; return; } f("run-status").innerHTML = `last run ${fmtDT(new Date(run.created_at).getTime())} — <b style="color:${run.conclusion === "success" ? "#7ed69a" : run.status === "in_progress" || run.status === "queued" ? "#e0a54c" : "#ff8a80"}">${run.status === "completed" ? run.conclusion : run.status}</b>`; } catch (e) { f("run-status").textContent = "run status unavailable"; } };
      lastRun();
      f("gh-token-save").onclick = () => { const t = f("gh-token").value.trim(); if (!t) return; localStorage.setItem("gsa_gh_token", t); f("gh-token-box").classList.add("hidden"); toast(f("refresh-msg"), "ok", "Token saved in this browser. Click Refresh now."); };
      f("refresh-now").onclick = async () => {
        const t = localStorage.getItem("gsa_gh_token"); if (!t) { f("gh-token-box").classList.remove("hidden"); return toast(f("refresh-msg"), "info", "Paste a GitHub token once (instructions above) to enable the Refresh button."); }
        f("refresh-now").disabled = true; toast(f("refresh-msg"), "info", "Asking GitHub to run the vacancy fetcher…");
        try {
          const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/vacancies.yml/dispatches`, { method: "POST", headers: ghHeaders(t), body: JSON.stringify({ ref: "main" }) });
          if (r.status === 204) toast(f("refresh-msg"), "ok", "Started. It takes about 2 minutes to fetch FreeJobAlert and publish; reload this page afterwards to see the new list.");
          else if (r.status === 401 || r.status === 403) { localStorage.removeItem("gsa_gh_token"); f("gh-token-box").classList.remove("hidden"); toast(f("refresh-msg"), "err", "GitHub rejected the token (expired or missing Actions: write permission). Paste a new one."); }
          else toast(f("refresh-msg"), "err", "GitHub replied " + r.status + ". Check the workflow file exists in the repo.");
        } catch (e) { toast(f("refresh-msg"), "err", "Could not reach GitHub: " + e.message); }
        f("refresh-now").disabled = false; setTimeout(lastRun, 4000);
      };
      // --- manual vacancies ---
      const fill = (v) => { editingId = v.id; f("vc-form-title").textContent = "Edit: " + v.title; f("vc-title").value = v.title || ""; f("vc-org").value = v.organisation || ""; f("vc-posts").value = v.posts || ""; f("vc-qual").value = v.qualification || ""; f("vc-start").value = v.startDate || ""; f("vc-last").value = v.lastDate || ""; f("vc-url").value = v.applyUrl || ""; f("vc-tags").value = (v.tags || []).join(", "); f("vc-summary").value = v.summary || ""; f("vc-upcoming").checked = !!v.upcoming; f("vc-cancel").classList.remove("hidden"); f("vc-save").textContent = "Save changes"; window.scrollTo({ top: 0, behavior: "smooth" }); };
      f("vc-save").onclick = async () => {
        const title = f("vc-title").value.trim(), organisation = f("vc-org").value.trim(), lastDate = f("vc-last").value, upcoming = f("vc-upcoming").checked;
        if (!title || !organisation || (!lastDate && !upcoming)) return toast(f("vc-msg"), "err", "Title, organisation and a last date (or Upcoming) are required.");
        const base = all.find(v => v.id === editingId) || {};
        await store.saveVacancy({ ...base, builtin: undefined, id: editingId || store.newId(), title, organisation, posts: +f("vc-posts").value || null, qualification: f("vc-qual").value.trim(), startDate: f("vc-start").value, lastDate, upcoming, examDate: upcoming ? (base.examDate || "Notification expected") : "", applyUrl: f("vc-url").value.trim(), sourceUrl: base.sourceUrl || f("vc-url").value.trim(), tags: f("vc-tags").value.split(",").map(x => x.trim()).filter(Boolean), summary: f("vc-summary").value.trim(), location: base.location || "India", source: base.source === "freejobalert" ? "freejobalert" : "admin", locked: true, updatedAt: Date.now() });
        pages.vacancies();
      };
      f("vc-cancel").onclick = () => pages.vacancies();
      panel.querySelectorAll("[data-edit]").forEach(a => a.onclick = (e) => { e.preventDefault(); fill(all.find(v => v.id === a.dataset.edit)); });
      panel.querySelectorAll("[data-hide]").forEach(a => a.onclick = async (e) => { e.preventDefault(); const v = all.find(x => x.id === a.dataset.hide); if (!confirm((v.builtin ? "Hide" : "Delete") + " this vacancy?")) return; if (v.builtin) await store.saveVacancy({ id: v.id, hidden: true }); else await store.deleteVacancy(v.id); pages.vacancies(); });
    },

    async articles() {
      const custom = await store.listArticles();
      const builtin = (window.GSA_ARTICLES || []);
      const hidden = new Set(custom.filter(x => x.hidden).map(x => x.id));
      let editingId = "";
      panel.innerHTML = `<h1>Articles &amp; study notes</h1>
        <div class="alert info small">Articles are what Google ranks. One post a week on what students search ("ONGC geologist eligibility 2027", "GATE GG syllabus weightage") is the single biggest thing you can do for search traffic. Formatting: <code>## Heading</code>, <code>- bullet</code>, <code>**bold**</code>, blank line between paragraphs.</div>
        <div class="card" style="margin-bottom:1.5rem"><h3 id="ar-form-title">Write an article</h3>
          <div class="form-row"><div class="field"><label>Title *</label><input id="ar-title"></div><div class="field"><label>Tags (comma separated)</label><input id="ar-tags" placeholder="GATE GG, Strategy"></div></div>
          <div class="field"><label>Short summary (shown in lists and Google)</label><input id="ar-excerpt" maxlength="200"></div>
          <div class="field"><label>Body *</label><textarea id="ar-body" style="min-height:260px;font-family:var(--sans)"></textarea></div>
          <label class="check" style="margin-bottom:.8rem"><input type="checkbox" id="ar-pub" checked> Published (untick to keep as draft)</label>
          <div id="ar-msg" class="alert hidden"></div><button class="btn primary" id="ar-save">Publish article</button> <button class="btn ghost hidden" id="ar-cancel">Cancel edit</button></div>
        <h3>Your articles <span class="badge">${custom.filter(x => !x.hidden).length}</span></h3>
        ${custom.filter(x => !x.hidden).map(a => `<div class="notice" style="display:flex;gap:1rem;align-items:flex-start"><div style="flex:1"><b>${esc(a.title)}</b> ${a.published === false ? '<span class="badge grey">draft</span>' : ""}<br><span class="small muted">${fmtDT(a.at || 0)} · ${(a.tags || []).map(esc).join(", ")}</span></div><a href="article.html?id=${encodeURIComponent(a.slug || a.id)}" target="_blank" class="small">View</a> · <a href="#" data-edit="${esc(a.id)}" class="small">Edit</a> · <a href="#" data-del="${esc(a.id)}" class="small" style="color:var(--red)">Delete</a></div>`).join("") || "<p class='muted small'>None yet.</p>"}
        <h3 style="margin-top:2rem">Built-in articles</h3>
        ${builtin.map(a => `<div class="notice" style="display:flex;gap:1rem;${hidden.has(a.id) ? "opacity:.45" : ""}"><div style="flex:1"><b>${esc(a.title)}</b><br><span class="small muted">${(a.tags || []).map(esc).join(", ")}</span></div><a href="article.html?id=${encodeURIComponent(a.slug || a.id)}" target="_blank" class="small">View</a> · <a href="#" data-edit-b="${esc(a.id)}" class="small">Edit</a> · <a href="#" data-toggle="${esc(a.id)}" class="small">${hidden.has(a.id) ? "Show again" : "Hide"}</a></div>`).join("")}`;
      const f = (id) => document.getElementById(id);
      const fill = (a) => { editingId = a.id; f("ar-form-title").textContent = "Edit: " + a.title; f("ar-title").value = a.title; f("ar-tags").value = (a.tags || []).join(", "); f("ar-excerpt").value = a.excerpt || ""; f("ar-body").value = a.body || ""; f("ar-pub").checked = a.published !== false; f("ar-cancel").classList.remove("hidden"); f("ar-save").textContent = "Save changes"; window.scrollTo({ top: 0, behavior: "smooth" }); };
      f("ar-save").onclick = async () => {
        const title = f("ar-title").value.trim(), body = f("ar-body").value.trim();
        if (!title || !body) return toast(f("ar-msg"), "err", "Title and body are required.");
        const id = editingId || slug(title).slice(0, 60) || store.newId();
        const base = custom.find(x => x.id === id) || builtin.find(x => x.id === id) || {};
        await store.saveArticle({ id, slug: base.slug || slug(title).slice(0, 60), title, tags: f("ar-tags").value.split(",").map(x => x.trim()).filter(Boolean), excerpt: f("ar-excerpt").value.trim() || body.replace(/[#*-]/g, "").slice(0, 160), body, published: f("ar-pub").checked, author: base.author || "Geo Scholars Academy", at: base.at || Date.now(), updatedAt: Date.now() });
        pages.articles();
      };
      f("ar-cancel").onclick = () => pages.articles();
      panel.querySelectorAll("[data-edit]").forEach(a => a.onclick = (e) => { e.preventDefault(); fill(custom.find(x => x.id === a.dataset.edit)); });
      panel.querySelectorAll("[data-edit-b]").forEach(a => a.onclick = (e) => { e.preventDefault(); fill(builtin.find(x => x.id === a.dataset.editB)); });
      panel.querySelectorAll("[data-del]").forEach(a => a.onclick = async (e) => { e.preventDefault(); if (!confirm("Delete this article?")) return; await store.deleteArticle(a.dataset.del); pages.articles(); });
      panel.querySelectorAll("[data-toggle]").forEach(a => a.onclick = async (e) => { e.preventDefault(); const id = a.dataset.toggle; if (hidden.has(id)) await store.deleteArticle(id); else await store.saveArticle({ id, hidden: true }); pages.articles(); });
    },

    async calendar() {
      const all = await store.listAllExamDates(), custom = await store.listExamDates();
      panel.innerHTML = `<h1>Exam calendar</h1>
        <div class="alert info small">Shown as countdowns on the home page and on the Exam Links page. Add the date as soon as a notification confirms it; tick "tentative" while it is only expected.</div>
        <div class="card" style="margin-bottom:1.5rem"><h3>Add / update an exam date</h3>
          <div class="form-row"><div class="field"><label>Exam *</label><input id="ex-name" placeholder="GATE 2027 (GG)"></div><div class="field"><label>Date *</label><input id="ex-date" type="date"></div></div>
          <div class="form-row"><div class="field"><label>Note</label><input id="ex-note" placeholder="Application closes 5 Oct"></div><div class="field"><label>Official link</label><input id="ex-url" placeholder="https://…"></div></div>
          <label class="check" style="margin-bottom:.8rem"><input type="checkbox" id="ex-tent"> Tentative</label>
          <div id="ex-msg" class="alert hidden"></div><button class="btn primary" id="ex-save">Save</button></div>
        <div class="table-wrap"><table><tr><th>Date</th><th>Exam</th><th>Note</th><th>Source</th><th></th></tr>${all.map(x => `<tr><td style="white-space:nowrap">${new Date(x.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ${x.tentative ? '<span class="badge grey">tentative</span>' : ""}</td><td><b>${esc(x.exam)}</b></td><td class="small">${esc(x.note || "")}</td><td class="small">${x.builtin ? "built-in" : "admin"}</td><td class="small" style="white-space:nowrap"><a href="#" data-edit="${esc(x.id)}">Edit</a> · <a href="#" data-hide="${esc(x.id)}" style="color:var(--red)">${x.builtin ? "Hide" : "Delete"}</a></td></tr>`).join("")}</table></div>`;
      const f = (id) => document.getElementById(id); let editingId = "";
      f("ex-save").onclick = async () => {
        const exam = f("ex-name").value.trim(), date = f("ex-date").value; if (!exam || !date) return toast(f("ex-msg"), "err", "Exam and date are required.");
        await store.saveExamDate({ id: editingId || slug(exam).slice(0, 50) + "-" + date, exam, date, note: f("ex-note").value.trim(), url: f("ex-url").value.trim(), tentative: f("ex-tent").checked }); pages.calendar();
      };
      panel.querySelectorAll("[data-edit]").forEach(a => a.onclick = (e) => { e.preventDefault(); const x = all.find(y => y.id === a.dataset.edit); editingId = x.id; f("ex-name").value = x.exam; f("ex-date").value = x.date; f("ex-note").value = x.note || ""; f("ex-url").value = x.url || ""; f("ex-tent").checked = !!x.tentative; window.scrollTo({ top: 0, behavior: "smooth" }); });
      panel.querySelectorAll("[data-hide]").forEach(a => a.onclick = async (e) => { e.preventDefault(); const x = all.find(y => y.id === a.dataset.hide); if (x.builtin) await store.saveExamDate({ id: x.id, hidden: true }); else await store.deleteExamDate(x.id); pages.calendar(); });
    },

    async liveclasses() {
      const classes = await store.listLiveClasses(), courses = ((window.GSA_SITE || {}).courses || []);
      const users = await store.listUsers(); const att = await store.listAttendance().catch(() => []);
      const attFor = (id) => { const l = att.filter(a => a.classId === id); return { total: l.length, students: new Set(l.map(a => a.uid)).size, last: l.length ? Math.max(...l.map(a => a.at)) : 0 }; };
      const DAYS = [["MO", "Mon"], ["TU", "Tue"], ["WE", "Wed"], ["TH", "Thu"], ["FR", "Fri"], ["SA", "Sat"], ["SU", "Sun"]];
      const cid = (window.GSA_CONFIG.googleOAuthClientId || "").trim();
      const fmtT = (t) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
      panel.innerHTML = `<h1>Live classes</h1>
        <div class="card" style="margin-bottom:1.5rem;background:var(--ink);color:#fff"><div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:center"><div><b>Google Calendar + Meet</b><br><span class="small" style="color:#aab4be">${cid ? `Connected to Google as <b style="color:#fff" id="gcal-who">not signed in yet</b> — each schedule below can be created in the academy's Google Calendar with a Google Meet link, and students get the link on their dashboard.` : "Not configured. Add <code>googleOAuthClientId</code> in js/config.js (README → Live classes) to create Calendar events + Meet links in one click. Until then, paste your Meet/Zoom link by hand below."}</span></div>${cid ? `<button class="btn primary sm" id="gcal-connect">Connect Google Calendar</button>` : ""}</div><div id="lc-msg" class="alert hidden" style="margin-top:.8rem"></div></div>
        <div class="card" style="margin-bottom:1.5rem"><h3 id="lc-form-title">Schedule a class</h3>
          <div class="form-row"><div class="field"><label>Class title *</label><input id="lc-title" placeholder="GATE GG — Structural Geology (daily class)"></div><div class="field"><label>Batch / course</label><select id="lc-course"><option value="">All students</option>${courses.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></div></div>
          <div class="form-row"><div class="field"><label>Time (IST) *</label><input id="lc-time" type="time" value="19:00"></div><div class="field"><label>Duration (minutes)</label><input id="lc-dur" type="number" value="60" min="15" step="15"></div></div>
          <div class="form-row"><div class="field"><label>From date *</label><input id="lc-from" type="date" value="${new Date().toISOString().slice(0, 10)}"></div><div class="field"><label>To date</label><input id="lc-to" type="date"></div></div>
          <div class="field"><label>Days</label><div class="checks">${DAYS.map(([v, l]) => `<label class="check"><input type="checkbox" name="lc-day" value="${v}" ${v !== "SU" ? "checked" : ""}> ${l}</label>`).join("")}</div></div>
          <div class="field"><label>Meeting link (leave empty to let Google create a Meet link)</label><input id="lc-link" placeholder="https://meet.google.com/xxx-xxxx-xxx or Zoom link"></div>
          <div class="field"><label>Note for students</label><input id="lc-note" placeholder="Bring the Set-2 mock solutions"></div>
          ${cid ? `<label class="check" style="margin-bottom:.8rem"><input type="checkbox" id="lc-invite"> Also email a calendar invitation to registered students (${users.filter(u => !u.isAdmin).length})</label>` : ""}
          <div id="lc-form-msg" class="alert hidden"></div>
          <button class="btn primary" id="lc-save">${cid ? "Create in Google Calendar + publish" : "Publish schedule"}</button> <button class="btn ghost hidden" id="lc-cancel">Cancel edit</button></div>
        <h3>Scheduled classes <span class="badge">${classes.length}</span></h3>
        ${classes.length ? `<div class="table-wrap"><table><tr><th>Class</th><th>Batch</th><th>When</th><th>Next</th><th>Attendance</th><th>Link</th><th></th></tr>${classes.map(c => { const n = store.nextClassAt(c), at = attFor(c.id); return `<tr><td><b>${esc(c.title)}</b>${c.note ? `<br><span class="small muted">${esc(c.note)}</span>` : ""}</td><td class="small">${esc((courses.find(x => x.id === c.courseId) || {}).name || "All students")}</td><td class="small">${fmtT(c.time)} · ${(c.days || []).join(", ")}<br><span class="muted">${esc(c.from || "")}${c.to ? " → " + esc(c.to) : " onwards"}</span></td><td class="small">${n ? fmtDT(n.getTime()) : "<span class='muted'>ended</span>"}</td><td class="small">${at.total ? `<b>${at.students}</b> students · ${at.total} joins<br><span class="muted">last ${fmtDT(at.last)}</span>` : "<span class='muted'>—</span>"}</td><td class="small">${c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener">Join ↗</a>${c.calendarEventId ? ' <span class="badge grey">Calendar</span>' : ""}` : "<span class='muted'>no link</span>"}</td><td class="small" style="white-space:nowrap"><a href="#" data-edit="${esc(c.id)}">Edit</a> · <a href="#" data-del="${esc(c.id)}" style="color:var(--red)">Delete</a></td></tr>`; }).join("")}</table></div>` : "<p class='muted small'>No classes scheduled yet.</p>"}`;
      const f = (id) => document.getElementById(id); let editingId = "", gToken = sessionStorage.getItem("gsa_gcal_token") || "";
      const setWho = async () => { if (!gToken) return; try { const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + gToken } }); const j = await r.json(); if (j.email) f("gcal-who").textContent = j.email; else { gToken = ""; sessionStorage.removeItem("gsa_gcal_token"); } } catch (e) {} };
      // --- Google sign-in (token) ---
      const loadGis = () => new Promise((res, rej) => { if (window.google && google.accounts) return res(); const sc = document.createElement("script"); sc.src = "https://accounts.google.com/gsi/client"; sc.onload = res; sc.onerror = () => rej(new Error("Could not load Google sign-in.")); document.head.appendChild(sc); });
      const connect = () => new Promise(async (res, rej) => { try { await loadGis(); const tc = google.accounts.oauth2.initTokenClient({ client_id: cid, scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email", callback: (t) => { if (t.error) return rej(new Error(t.error)); gToken = t.access_token; sessionStorage.setItem("gsa_gcal_token", gToken); setWho(); res(gToken); } }); tc.requestAccessToken({ prompt: gToken ? "" : "select_account" }); } catch (e) { rej(e); } });
      if (cid) { f("gcal-connect").onclick = async () => { try { await connect(); toast(f("lc-msg"), "ok", "Google Calendar connected for this session."); } catch (e) { toast(f("lc-msg"), "err", "Google sign-in failed: " + e.message + ". Check the OAuth client's authorised origins include " + location.origin + "."); } }; setWho(); }
      const gcal = async (method, path, body) => { const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events" + path, { method, headers: { Authorization: "Bearer " + gToken, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); if (r.status === 401) { gToken = ""; sessionStorage.removeItem("gsa_gcal_token"); throw new Error("Google session expired — click Connect Google Calendar again."); } if (!r.ok && r.status !== 204) { const j = await r.json().catch(() => ({})); throw new Error((j.error && j.error.message) || ("Google Calendar error " + r.status)); } return r.status === 204 ? null : r.json(); };
      const eventBody = (c, invite) => { const [h, m] = c.time.split(":").map(Number); const start = `${c.from}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`; const endD = new Date(`${c.from}T00:00:00`); endD.setHours(h, m + (c.duration || 60)); const end = `${c.from}T${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}:00`;
        const rr = "RRULE:FREQ=WEEKLY" + (c.days.length ? ";BYDAY=" + c.days.join(",") : "") + (c.to ? ";UNTIL=" + c.to.replace(/-/g, "") + "T235959Z" : "");
        const body = { summary: c.title + " — Geo Scholars Academy", description: (c.note ? c.note + "\n\n" : "") + "Live online class by Geo Scholars Academy. Join link is also on your student dashboard: " + (window.GSA_CONFIG.siteUrl || location.origin) + "/dashboard.html", start: { dateTime: start, timeZone: "Asia/Kolkata" }, end: { dateTime: end, timeZone: "Asia/Kolkata" }, recurrence: [rr], reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }, { method: "email", minutes: 60 }] } };
        if (!c.link) body.conferenceData = { createRequest: { requestId: c.id + "-" + Date.now(), conferenceSolutionKey: { type: "hangoutsMeet" } } }; else body.location = c.link;
        if (invite) body.attendees = users.filter(u => !u.isAdmin && u.email && (!c.courseId || (u.courses || []).includes(c.courseId))).slice(0, 200).map(u => ({ email: u.email }));
        return body; };
      const fill = (c) => { editingId = c.id; f("lc-form-title").textContent = "Edit: " + c.title; f("lc-title").value = c.title; f("lc-course").value = c.courseId || ""; f("lc-time").value = c.time; f("lc-dur").value = c.duration || 60; f("lc-from").value = c.from || ""; f("lc-to").value = c.to || ""; panel.querySelectorAll("[name=lc-day]").forEach(x => x.checked = (c.days || []).includes(x.value)); f("lc-link").value = c.link || ""; f("lc-note").value = c.note || ""; f("lc-cancel").classList.remove("hidden"); f("lc-save").textContent = "Save changes"; window.scrollTo({ top: 0, behavior: "smooth" }); };
      f("lc-save").onclick = async () => {
        const title = f("lc-title").value.trim(), time = f("lc-time").value, from = f("lc-from").value; if (!title || !time || !from) return toast(f("lc-form-msg"), "err", "Title, time and from-date are required.");
        const prev = classes.find(x => x.id === editingId) || {};
        const c = { ...prev, id: editingId || store.newId(), title, courseId: f("lc-course").value, time, duration: +f("lc-dur").value || 60, from, to: f("lc-to").value, days: [...panel.querySelectorAll("[name=lc-day]:checked")].map(x => x.value), link: f("lc-link").value.trim(), note: f("lc-note").value.trim(), updatedAt: Date.now() };
        const invite = cid && f("lc-invite").checked;
        if (cid) {
          try {
            if (!gToken) await connect();
            f("lc-save").disabled = true; toast(f("lc-form-msg"), "info", "Creating the event in Google Calendar…");
            const q = "?conferenceDataVersion=1" + (invite ? "&sendUpdates=all" : "");
            const ev = c.calendarEventId ? await gcal("PATCH", "/" + c.calendarEventId + q, eventBody(c, invite)) : await gcal("POST", q, eventBody(c, invite));
            c.calendarEventId = ev.id; c.calendarLink = ev.htmlLink || ""; if (!c.link) c.link = ev.hangoutLink || (ev.conferenceData && ev.conferenceData.entryPoints && (ev.conferenceData.entryPoints.find(e => e.entryPointType === "video") || {}).uri) || "";
          } catch (e) { f("lc-save").disabled = false; return toast(f("lc-form-msg"), "err", e.message + (c.link ? "" : " — you can still paste a Meet link by hand and publish.")); }
        }
        if (!c.link) return toast(f("lc-form-msg"), "err", "No meeting link. Paste a Meet/Zoom link, or connect Google Calendar to create one.");
        await store.saveLiveClass(c); pages.liveclasses();
      };
      f("lc-cancel").onclick = () => pages.liveclasses();
      panel.querySelectorAll("[data-edit]").forEach(a => a.onclick = (e) => { e.preventDefault(); fill(classes.find(x => x.id === a.dataset.edit)); });
      panel.querySelectorAll("[data-del]").forEach(a => a.onclick = async (e) => { e.preventDefault(); const c = classes.find(x => x.id === a.dataset.del); if (!confirm("Delete this class schedule" + (c.calendarEventId ? " and its Google Calendar event" : "") + "?")) return; if (c.calendarEventId && cid) { try { if (!gToken) await connect(); await gcal("DELETE", "/" + c.calendarEventId + "?sendUpdates=all"); } catch (err) { if (!confirm("Could not delete the Calendar event (" + err.message + "). Remove it from the site anyway?")) return; } } await store.deleteLiveClass(c.id); pages.liveclasses(); });
    },

    async visitors() {
      const visits = await store.listVisits(400);
      const count = (key) => { const m = {}; visits.forEach(v => { const k = (v[key] || "Unknown").trim() || "Unknown"; m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
      const top = (key, n = 8) => count(key).slice(0, n);
      const bar = (rows) => { const max = Math.max(1, ...rows.map(r => r[1])); return rows.map(([k, n]) => `<div class="sec-bar"><span>${esc(k)}</span><div class="bar"><i style="width:${Math.round(100 * n / max)}%"></i></div><b>${n}</b></div>`).join("") || "<p class='small muted'>No data yet.</p>"; };
      const cityRows = count("city").filter(([k]) => k !== "Unknown").slice(0, 10);
      panel.innerHTML = `<h1>Visitors <span class="badge">${visits.length} sessions</span></h1>
        <p class="small muted">One row per visit session (first page opened). Location is city-level from the visitor's IP address; it is approximate (mobile networks often show the ISP's city). ${store.mode === "local" ? "<b>Local demo mode: only this browser is counted.</b>" : ""}</p>
        <div class="kpis"><div class="stat"><b>${visits.filter(v => Date.now() - v.at < 86400000).length}</b><span>Last 24 hours</span></div><div class="stat"><b>${visits.filter(v => Date.now() - v.at < 7 * 86400000).length}</b><span>Last 7 days</span></div><div class="stat"><b>${new Set(visits.map(v => v.ip).filter(Boolean)).size}</b><span>Unique IP addresses</span></div><div class="stat"><b>${count("region").filter(([k]) => k !== "Unknown").length}</b><span>States / regions</span></div><div class="stat"><b>${Math.round(100 * visits.filter(v => v.device === "Mobile").length / Math.max(1, visits.length))}%</b><span>On mobile</span></div></div>
        <div class="split" style="gap:1.5rem"><div><h4>Top cities</h4>${bar(cityRows)}<h4 style="margin-top:1rem">States / regions</h4>${bar(top("region"))}</div><div><h4>Countries</h4>${bar(top("country", 6))}<h4 style="margin-top:1rem">Device · browser</h4>${bar(top("device", 3))}${bar(top("browser", 5))}<h4 style="margin-top:1rem">Landing pages</h4>${bar(top("page", 6))}</div></div>
        <div class="toolbar" style="margin-top:1.5rem"><input id="vis-q" placeholder="Search IP / city / name…"><button class="btn ghost sm" id="vis-csv">Download CSV</button></div>
        <div class="table-wrap"><table id="vis-table"><tr><th>When</th><th>IP address</th><th>Location</th><th>ISP</th><th>Device</th><th>Page</th><th>Referrer</th><th>Student</th></tr>${visits.slice(0, 300).map(v => `<tr data-row="${esc(((v.ip || "") + " " + (v.city || "") + " " + (v.region || "") + " " + (v.name || "")).toLowerCase())}"><td class="small" style="white-space:nowrap">${fmtDT(v.at)}</td><td class="small"><code>${esc(v.ip || "—")}</code></td><td class="small">${esc([v.city, v.region, v.country].filter(Boolean).join(", ") || "—")}${v.lat ? ` <a href="https://www.google.com/maps?q=${v.lat},${v.lon}" target="_blank" rel="noopener" title="Map">🗺️</a>` : ""}</td><td class="small muted">${esc((v.isp || "").slice(0, 28))}</td><td class="small">${esc(v.device || "")} · ${esc(v.browser || "")} · ${esc(v.os || "")}</td><td class="small">${esc(v.page || "")}</td><td class="small muted">${esc((v.referrer || "").replace(/^https?:\/\//, "").slice(0, 30))}</td><td class="small">${v.uid ? `<a href="#" data-stu="${esc(v.uid)}">${esc(v.name || "student")}</a>` : "<span class='muted'>guest</span>"}</td></tr>`).join("")}</table></div>`;
      document.getElementById("vis-q").oninput = (e) => { const q = e.target.value.toLowerCase(); panel.querySelectorAll("#vis-table tr[data-row]").forEach(r => r.style.display = r.dataset.row.includes(q) ? "" : "none"); };
      document.getElementById("vis-csv").onclick = () => { const rows = [["When", "IP", "City", "Region", "Country", "ISP", "Device", "Browser", "OS", "Page", "Referrer", "Student"], ...visits.map(v => [fmtDT(v.at), v.ip, v.city, v.region, v.country, v.isp, v.device, v.browser, v.os, v.page, v.referrer, v.name || ""])]; const csv = rows.map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "gsa-visitors.csv"; a.click(); };
      panel.querySelectorAll("[data-stu]").forEach(x => x.onclick = (e) => { e.preventDefault(); document.querySelector('.admin-nav button[data-p=students]').click(); setTimeout(() => pages.studentDetail(x.dataset.stu), 300); });
    },

    async reviews() {
      const reviews = await store.listReviews();
      const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
      panel.innerHTML = `<h1>Student reviews <span class="badge">${reviews.length}</span></h1>
        <p class="small muted">Students submit reviews from their dashboard. Approve the ones you want on the home page; "Feature" pins it first.</p>
        <div class="kpis"><div class="stat"><b>${reviews.filter(r => r.approved).length}</b><span>Approved (shown)</span></div><div class="stat"><b>${reviews.filter(r => !r.approved).length}</b><span>Waiting</span></div><div class="stat"><b>${reviews.length ? (reviews.reduce((n, r) => n + (r.rating || 0), 0) / reviews.length).toFixed(1) : "—"}</b><span>Average rating</span></div></div>
        ${reviews.map(r => `<div class="notice" style="display:flex;gap:1rem;align-items:flex-start;${r.approved ? "" : "border-left-color:var(--red)"}"><div style="flex:1"><b>${esc(r.name)}</b> <span style="color:var(--ochre)">${stars(r.rating || 0)}</span> ${r.featured ? '<span class="badge">featured</span>' : ""} ${r.approved ? '<span class="badge moss">approved</span>' : '<span class="badge red">waiting</span>'}<br><span class="small muted">${esc(r.course || "")} · ${fmtDT(r.at)}</span><p style="margin:.3rem 0 0">${esc(r.text)}</p></div><div class="small" style="white-space:nowrap"><a href="#" data-approve="${esc(r.id)}">${r.approved ? "Unapprove" : "Approve"}</a> · <a href="#" data-feature="${esc(r.id)}">${r.featured ? "Unfeature" : "Feature"}</a> · <a href="#" data-del="${esc(r.id)}" style="color:var(--red)">Delete</a></div></div>`).join("") || "<p class='muted'>No reviews yet.</p>"}`;
      panel.querySelectorAll("[data-approve]").forEach(a => a.onclick = async (e) => { e.preventDefault(); const r = reviews.find(x => x.id === a.dataset.approve); await store.saveReview({ ...r, approved: !r.approved }); pages.reviews(); });
      panel.querySelectorAll("[data-feature]").forEach(a => a.onclick = async (e) => { e.preventDefault(); const r = reviews.find(x => x.id === a.dataset.feature); await store.saveReview({ ...r, featured: !r.featured, approved: true }); pages.reviews(); });
      panel.querySelectorAll("[data-del]").forEach(a => a.onclick = async (e) => { e.preventDefault(); if (!confirm("Delete this review?")) return; await store.deleteReview(a.dataset.del); pages.reviews(); });
    },

    async doubts() {
      const doubts = await store.listDoubts();
      const open = doubts.filter(d => !d.answer), done = doubts.filter(d => d.answer);
      const item = (d) => `<div class="card" style="margin-bottom:.8rem"><div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap"><div><b>${esc(d.name)}</b> <span class="small muted">· ${esc(d.topic || "General")} · ${fmtDT(d.at)}</span></div><a href="#" data-del="${esc(d.id)}" class="small" style="color:var(--red)">Delete</a></div><p style="margin:.4rem 0">${esc(d.question)}</p>${d.answer ? `<div class="alert ok small"><b>Answer:</b> ${esc(d.answer)} <span class="muted">· ${fmtDT(d.answeredAt || d.at)}</span></div>` : ""}<div class="field" style="margin:.4rem 0 0"><textarea data-ans="${esc(d.id)}" placeholder="${d.answer ? "Edit the answer…" : "Type the answer…"}" style="min-height:60px">${esc(d.answer || "")}</textarea></div><button class="btn primary sm" data-send="${esc(d.id)}">${d.answer ? "Update answer" : "Send answer"}</button></div>`;
      panel.innerHTML = `<h1>Doubt box <span class="badge ${open.length ? "red" : "moss"}">${open.length} open</span></h1>
        <p class="small muted">Students ask from their dashboard; your answer appears there instantly. Short, specific answers work best — link to an article for long explanations.</p>
        <h3>Waiting for an answer</h3>${open.map(item).join("") || "<p class='muted small'>All caught up.</p>"}
        <h3 style="margin-top:1.5rem">Answered</h3>${done.slice(0, 30).map(item).join("") || "<p class='muted small'>None yet.</p>"}`;
      panel.querySelectorAll("[data-send]").forEach(b => b.onclick = async () => { const d = doubts.find(x => x.id === b.dataset.send); const ans = panel.querySelector(`[data-ans="${d.id}"]`).value.trim(); if (!ans) return; await store.saveDoubt({ ...d, answer: ans, answeredAt: Date.now(), answeredBy: user.name || "GSA" }); pages.doubts(); });
      panel.querySelectorAll("[data-del]").forEach(a => a.onclick = async (e) => { e.preventDefault(); if (!confirm("Delete this doubt?")) return; await store.deleteDoubt(a.dataset.del); pages.doubts(); });
    },

    async resources() {
      const res = await store.listResources();
      const TYPES = ["Syllabus", "Previous year paper", "Notes", "Formula sheet", "Book list", "Cut-off", "Other"], EXAMS = store.EXAMS;
      let editingId = "";
      panel.innerHTML = `<h1>Downloads &amp; resources</h1>
        <p class="small muted">Links to PDFs (Google Drive "Anyone with the link", official sites, YouTube). Shown on the Resources page grouped by exam. Tick "Students only" for paid material — visitors then see a lock and a sign-in link.</p>
        <div class="card" style="margin-bottom:1.5rem"><h3 id="rs-form-title">Add a resource</h3>
          <div class="form-row"><div class="field"><label>Title *</label><input id="rs-title" placeholder="GATE GG 2026 question paper with key"></div><div class="field"><label>Link *</label><input id="rs-url" placeholder="https://drive.google.com/…"></div></div>
          <div class="form-row"><div class="field"><label>Exam</label><select id="rs-exam">${EXAMS.map(x => `<option>${esc(x)}</option>`).join("")}<option>General</option></select></div><div class="field"><label>Type</label><select id="rs-type">${TYPES.map(x => `<option>${esc(x)}</option>`).join("")}</select></div></div>
          <div class="field"><label>Description</label><input id="rs-desc"></div>
          <label class="check" style="margin-bottom:.8rem"><input type="checkbox" id="rs-locked"> Students only (must sign in)</label>
          <div id="rs-msg" class="alert hidden"></div><button class="btn primary" id="rs-save">Publish</button> <button class="btn ghost hidden" id="rs-cancel">Cancel</button></div>
        <div class="table-wrap"><table><tr><th>Exam</th><th>Type</th><th>Title</th><th>Access</th><th></th></tr>${res.sort((a, b) => (a.exam || "").localeCompare(b.exam || "")).map(r => `<tr><td class="small">${esc(r.exam)}</td><td class="small">${esc(r.type)}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>${r.description ? `<br><span class="small muted">${esc(r.description)}</span>` : ""}</td><td class="small">${r.locked ? "🔒 students" : "public"}</td><td class="small" style="white-space:nowrap"><a href="#" data-edit="${esc(r.id)}">Edit</a> · <a href="#" data-del="${esc(r.id)}" style="color:var(--red)">Delete</a></td></tr>`).join("") || "<tr><td colspan=5 class='muted small'>None yet.</td></tr>"}</table></div>`;
      const f = (id) => document.getElementById(id);
      f("rs-save").onclick = async () => { const title = f("rs-title").value.trim(), url = f("rs-url").value.trim(); if (!title || !/^https?:\/\//.test(url)) return toast(f("rs-msg"), "err", "Title and a full link (https://…) are required."); await store.saveResource({ id: editingId || store.newId(), title, url, exam: f("rs-exam").value, type: f("rs-type").value, description: f("rs-desc").value.trim(), locked: f("rs-locked").checked, at: Date.now() }); pages.resources(); };
      f("rs-cancel").onclick = () => pages.resources();
      panel.querySelectorAll("[data-edit]").forEach(a => a.onclick = (e) => { e.preventDefault(); const r = res.find(x => x.id === a.dataset.edit); editingId = r.id; f("rs-form-title").textContent = "Edit: " + r.title; f("rs-title").value = r.title; f("rs-url").value = r.url; f("rs-exam").value = r.exam; f("rs-type").value = r.type; f("rs-desc").value = r.description || ""; f("rs-locked").checked = !!r.locked; f("rs-cancel").classList.remove("hidden"); window.scrollTo({ top: 0, behavior: "smooth" }); });
      panel.querySelectorAll("[data-del]").forEach(a => a.onclick = async (e) => { e.preventDefault(); if (!confirm("Delete?")) return; await store.deleteResource(a.dataset.del); pages.resources(); });
    },

    async testtakers() {
      const fmtN = (x) => Math.round((x || 0) * 100) / 100;
      const leads = await store.listTestLeads(500), enq = await store.listEnquiries();
      const enqPhones = new Set(enq.map(e => String(e.phone || "").replace(/\D/g, "").slice(-10)).filter(Boolean));
      const norm = (p) => String(p || "").replace(/\D/g, "").slice(-10);
      const people = {}; leads.forEach(l => { const k = norm(l.phone) || l.email || l.name; (people[k] = people[k] || { ...l, tests: [] }).tests.push(l); });
      const rows = Object.values(people).sort((a, b) => b.at - a.at);
      panel.innerHTML = `<h1>Test takers <span class="badge">${rows.length} people · ${leads.length} attempts</span></h1>
        <p class="small muted">Everyone who took a mock test or previous-year paper, with the details they entered before starting. Guests are included (they are not in Students &amp; results). "Enquired" means the same phone number also exists in Enquiries.</p>
        <div class="kpis"><div class="stat"><b>${rows.length}</b><span>People</span></div><div class="stat"><b>${rows.filter(r => !r.uid).length}</b><span>Guests (not registered)</span></div><div class="stat"><b>${leads.filter(l => Date.now() - l.at < 7 * 86400000).length}</b><span>Attempts last 7 days</span></div><div class="stat"><b>${rows.filter(r => enqPhones.has(norm(r.phone))).length}</b><span>Also enquired</span></div><div class="stat"><b>${leads.length ? Math.round(leads.reduce((n, l) => n + (l.pct || 0), 0) / leads.length) : 0}%</b><span>Average score</span></div></div>
        <div class="toolbar"><input id="tt-q" placeholder="Search name / phone / test…"><button class="btn ghost sm" id="tt-csv">Download CSV</button></div>
        <div class="table-wrap"><table id="tt-table"><tr><th>Latest</th><th>Name</th><th>Phone</th><th>Qualification</th><th>Tests taken</th><th>Best</th><th>Status</th></tr>${rows.map(r => { const best = r.tests.reduce((b, t) => t.pct > (b.pct || -1) ? t : b, {}); return `<tr data-row="${esc((r.name + " " + (r.phone || "") + " " + r.tests.map(t => t.testTitle).join(" ")).toLowerCase())}"><td class="small" style="white-space:nowrap">${fmtDT(r.at)}</td><td><b>${esc(r.name || "—")}</b>${r.uid ? ` <a href="#" data-stu="${esc(r.uid)}" class="small">profile</a>` : ' <span class="badge grey">guest</span>'}</td><td class="small">${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a> · <a href="https://wa.me/${norm(r.phone) ? "91" + norm(r.phone) : ""}?text=${encodeURIComponent("Hi " + (r.name || "") + ", this is Geo Scholars Academy. You scored " + fmtN(best.score) + "/" + fmtN(best.max) + " in " + (best.testTitle || "our mock test") + ". Want a free counselling call?")}" target="_blank" rel="noopener">WhatsApp</a>` : "—"}</td><td class="small">${esc(r.qualification || "—")}</td><td class="small">${r.tests.map(t => `${esc(t.testTitle)} — <b>${fmtN(t.score)}</b>/${fmtN(t.max)} (${t.pct}%)${t.mode === "practice" ? " <span class='badge grey'>practice</span>" : ""}`).join("<br>")}</td><td><b>${best.pct ?? 0}%</b></td><td>${enqPhones.has(norm(r.phone)) ? '<span class="badge moss">Enquired</span>' : '<span class="badge">Not yet</span>'}</td></tr>`; }).join("") || "<tr><td colspan=7 class='muted small'>No test attempts yet.</td></tr>"}</table></div>`;
      document.getElementById("tt-q").oninput = (e) => { const q = e.target.value.toLowerCase(); panel.querySelectorAll("#tt-table tr[data-row]").forEach(r => r.style.display = r.dataset.row.includes(q) ? "" : "none"); };
      document.getElementById("tt-csv").onclick = () => { const rws = [["When", "Name", "Phone", "Email", "Qualification", "Test", "Score", "Max", "%", "Mode", "Registered"], ...leads.map(l => [fmtDT(l.at), l.name, l.phone, l.email, l.qualification, l.testTitle, l.score, l.max, l.pct, l.mode, l.uid ? "yes" : "guest"])]; const csv = rws.map(r => r.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "gsa-test-takers.csv"; a.click(); };
      panel.querySelectorAll("[data-stu]").forEach(x => x.onclick = (e) => { e.preventDefault(); document.querySelector('.admin-nav button[data-p=students]').click(); setTimeout(() => pages.studentDetail(x.dataset.stu), 300); });
    },

    async help() {
      panel.innerHTML = `<h1>Help</h1>
        <div class="card" style="margin-bottom:1.5rem"><h3>What each tab does</h3><ul class="small" style="margin:0;padding-left:1.1rem;line-height:1.7">
          <li><b>Overview</b> — visitors, enquiries, students, attempts.</li>
          <li><b>Visitors</b> — every visit with IP address, city/state, device, page; CSV export.</li>
          <li><b>Test takers</b> — name, phone and qualification of everyone who took a test (guests included), with scores and a WhatsApp follow-up link.</li>
          <li><b>Reviews</b> — approve student reviews for the home page. <b>Doubt box</b> — answer student questions. <b>Resources</b> — downloads/PYQ links.</li>
          <li><b>Tests</b> — upload a .docx question bank → live mock test.</li>
          <li><b>Notices</b> — announcements on the home page.</li>
          <li><b>Success stories</b> — toppers with photo/poster for the home-page spotlight.</li>
          <li><b>Vacancies</b> — the automatic FreeJobAlert feed (07:00 IST daily, <b>Refresh now</b> button) + vacancies you add by hand.</li>
          <li><b>Live classes</b> — schedule daily online classes; creates Google Calendar events with Meet links (needs <code>googleOAuthClientId</code>) or use your own link. Students get Join buttons on their dashboard.</li>
          <li><b>Videos</b> — free recorded classes from YouTube.</li>
          <li><b>Articles</b> — study notes / strategy posts (this is what brings Google traffic).</li>
          <li><b>Exam calendar</b> — countdowns on the home page.</li>
          <li><b>Enquiries</b> — admissions pipeline: status + notes per lead, WhatsApp link, CSV.</li>
          <li><b>Students &amp; results</b> — every registered student's profile and performance report.</li>
        </ul><p class="small muted" style="margin:.6rem 0 0">Full setup guides (Google Calendar, GitHub token, Firebase) are in <code>README.md</code> in the site folder.</p></div>
        <h3>Current mode: <span class="mode-pill">${store.mode === "local" ? "Local demo (this browser only)" : "Firebase (live)"}</span></h3>
        <p>In <strong>local mode</strong> every visitor's data (accounts, attempts, enquiries, uploaded tests) stays inside their own browser — good for previewing the site, not for real students.</p>
        <p>To go live, switch on <strong>Firebase</strong> (free tier is enough for a coaching institute):</p>
        <ol class="instructions small">
          <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener">console.firebase.google.com</a> → Add project.</li>
          <li>Build → <strong>Authentication</strong> → Sign-in method → enable <strong>Email/Password</strong>.</li>
          <li>Build → <strong>Firestore Database</strong> → Create database (production mode).</li>
          <li>Project settings → Your apps → <strong>Web app</strong> → copy the <code>firebaseConfig</code> values into <code>js/config.js</code>.</li>
          <li>Firestore → Rules → paste the rules from <code>README.md</code> (they restrict admin writes to the emails in <code>adminEmails</code>).</li>
          <li>Sign up on the site with your admin email — the Admin link appears automatically.</li>
        </ol>
        <h3>Adding tests</h3>
        <p class="small">Upload a <code>.docx</code> in the GSA question-table format on the Tests tab, or run <code>tools/convert_docx.py</code> to bake tests into <code>data/tests.js</code> permanently.</p>
        <h3>Vacancy agent (AI)</h3>
        <p class="small"><code>python tools/vacancy_agent.py</code> searches official portals for current geologist/geoscientist recruitments with Claude + web search, merges them into <code>data/vacancies.js</code>, and expires old ones. Needs <code>pip install anthropic</code> and an <code>ANTHROPIC_API_KEY</code>. Run it weekly (or schedule it) and re-upload <code>data/vacancies.js</code>.</p>
        <h3>Editing site text</h3>
        <p class="small">Courses, FAQs, faculty and default notices: <code>data/site.js</code>. Contact details, social links, admin emails: <code>js/config.js</code>. Colours and fonts: <code>css/style.css</code>.</p>`;
    }
  };

  document.querySelectorAll(".admin-nav button").forEach(b => b.onclick = () => { document.querySelectorAll(".admin-nav button").forEach(x => x.classList.toggle("active", x === b)); pages[b.dataset.p](); });
  pages.overview();
});
