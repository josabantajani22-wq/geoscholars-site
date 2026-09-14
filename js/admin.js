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
      const [tests, enq, users, attempts, notices, stats] = await Promise.all([store.listTests(), store.listEnquiries(), store.listUsers(), store.listAllAttempts(), store.listNotices(), store.visitStats(30)]);
      const views = stats.reduce((n, d) => n + (d.views || 0), 0), visitors = stats.reduce((n, d) => n + (d.visitors || 0), 0);
      const today = new Date().toISOString().slice(0, 10), td = stats.find(d => d.day === today) || { views: 0, visitors: 0 };
      const max = Math.max(1, ...stats.map(d => d.views || 0));
      const pageTotals = {}; stats.forEach(d => Object.entries(d.pages || {}).forEach(([p, n]) => pageTotals[p] = (pageTotals[p] || 0) + n));
      const topPages = Object.entries(pageTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const week = Date.now() - 7 * 86400000;
      panel.innerHTML = `<h1>Admin overview</h1>
        ${store.mode === "local" ? `<div class="alert info"><strong>Local demo mode.</strong> Visitor numbers below count only <em>this</em> browser. Switch on Firebase (Help tab) to count every visitor, student and enquiry across the live site.</div>` : ""}
        <h3>Website traffic — last 30 days</h3>
        <div class="kpis">
          <div class="stat"><b>${visitors}</b><span>Visitors (sessions)</span></div><div class="stat"><b>${views}</b><span>Page views</span></div><div class="stat"><b>${td.visitors || 0} / ${td.views || 0}</b><span>Today: visitors / views</span></div><div class="stat"><b>${enq.length}</b><span>Enquiries total</span></div><div class="stat"><b>${enq.filter(e => e.at > week).length}</b><span>Enquiries this week</span></div>
        </div>
        <div class="card" style="margin-bottom:1.5rem"><div class="bars">${stats.length ? stats.map(d => `<i style="height:${Math.round(100 * (d.views || 0) / max)}%" data-t="${d.day}: ${d.views || 0} views"></i>`).join("") : "<span class='muted small'>No visits recorded yet.</span>"}</div><p class="small muted" style="margin:.5rem 0 0">Daily page views (hover a bar). ${topPages.length ? "Most viewed: " + topPages.map(([p, n]) => `${esc(p.replace(".html", "").replace(/_html$/, ""))} (${n})`).join(" · ") : ""}</p></div>
        <h3>Students & tests</h3>
        <div class="kpis">
          <div class="stat"><b>${users.length}</b><span>Registered students</span></div><div class="stat"><b>${users.filter(u => u.createdAt > week).length}</b><span>New this week</span></div><div class="stat"><b>${attempts.length}</b><span>Test attempts</span></div><div class="stat"><b>${tests.length}</b><span>Live tests</span></div><div class="stat"><b>${notices.length}</b><span>Notices</span></div>
        </div>
        <h3>Recent attempts</h3>${attempts.length ? `<div class="table-wrap"><table><tr><th>When</th><th>Student</th><th>Test</th><th>Score</th></tr>${attempts.slice(0, 10).map(a => `<tr><td>${fmtDT(a.at)}</td><td><a href="#" data-stu="${esc(a.uid || "")}">${esc(a.userName)}</a></td><td>${esc(a.testTitle)}</td><td>${a.score} / ${a.maxMarks}</td></tr>`).join("")}</table></div>` : "<p class='muted'>No attempts yet.</p>"}
        <h3 style="margin-top:1.5rem">Latest enquiries</h3>${enq.length ? `<div class="table-wrap"><table><tr><th>When</th><th>Name</th><th>Phone</th><th>Course</th></tr>${enq.slice(0, 5).map(e => `<tr><td>${fmtDT(e.at)}</td><td>${esc(e.name)}</td><td>${esc(e.phone)}</td><td>${esc(e.course)}</td></tr>`).join("")}</table></div>` : "<p class='muted'>No enquiries yet.</p>"}`;
      panel.querySelectorAll("[data-stu]").forEach(x => x.onclick = (e) => { e.preventDefault(); document.querySelector('.admin-nav button[data-p=students]').click(); setTimeout(() => pages.studentDetail(x.dataset.stu), 300); });
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
      panel.innerHTML = `<h1>Enquiries <span class="badge">${enq.length}</span></h1>
        ${enq.length ? `<div class="toolbar"><button class="btn ghost sm" id="csv">Download CSV</button></div><div class="table-wrap"><table><tr><th>When</th><th>Name</th><th>Contact</th><th>Course</th><th>Qualification</th><th>Message</th></tr>${enq.map(e => `<tr><td style="white-space:nowrap">${fmtDT(e.at)}</td><td>${esc(e.name)}</td><td>${esc(e.phone)}<br><span class="small muted">${esc(e.email || "")}</span></td><td>${esc(e.course)}</td><td>${esc(e.qualification || "")}</td><td class="small">${esc(e.message || "")}</td></tr>`).join("")}</table></div>` : "<p class='muted'>No enquiries yet.</p>"}`;
      const c = document.getElementById("csv"); if (c) c.onclick = () => {
        const rows = [["When", "Name", "Phone", "Email", "Course", "Qualification", "Message"], ...enq.map(e => [fmtDT(e.at), e.name, e.phone, e.email, e.course, e.qualification, e.message])];
        const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "gsa-enquiries.csv"; a.click();
      };
    },

    async students() {
      const [users, attempts, tests] = await Promise.all([store.listUsers(), store.listAllAttempts(), store.listTests()]);
      const byUser = {}; attempts.forEach(a => { (byUser[a.uid] = byUser[a.uid] || []).push(a); });
      panel.innerHTML = `<h1>Students &amp; results</h1><div id="stu-detail"></div>
        <div class="toolbar"><input id="stu-q" placeholder="Search name / email / phone…"><select id="lb-test"><option value="">Leaderboard: choose a test</option>${tests.map(t => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join("")}</select><button class="btn ghost sm" id="stu-csv">Download CSV</button></div>
        <div id="lb"></div>
        <h3>Registered students <span class="badge">${users.length}</span></h3><p class="small muted">Click a name for the full performance report.</p>
        <div class="table-wrap"><table id="stu-table"><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Attempts</th><th>Best %</th><th>Avg accuracy</th><th>Last active</th></tr>${users.map(u => { const l = byUser[u.uid] || []; const best = l.length ? Math.max(...l.map(a => Math.round(100 * a.score / a.maxMarks))) + "%" : "—"; const acc = l.length ? Math.round(100 * l.reduce((n, a) => n + (a.correct + a.wrong ? a.correct / (a.correct + a.wrong) : 0), 0) / l.length) + "%" : "—"; const last = l.length ? fmtDT(Math.max(...l.map(a => a.at))) : "—"; return `<tr data-row="${esc((u.name + " " + u.email + " " + (u.phone || "")).toLowerCase())}"><td><a href="#" data-stu="${esc(u.uid)}"><b>${esc(u.name)}</b></a>${u.isAdmin ? ' <span class="badge">admin</span>' : ""}</td><td>${esc(u.email)}</td><td>${esc(u.phone || "")}</td><td>${u.createdAt ? fmtDT(u.createdAt) : ""}</td><td>${l.length}</td><td>${best}</td><td>${acc}</td><td>${last}</td></tr>`; }).join("")}</table></div>`;
      document.getElementById("stu-q").oninput = (e) => { const q = e.target.value.toLowerCase(); panel.querySelectorAll("#stu-table tr[data-row]").forEach(r => r.style.display = r.dataset.row.includes(q) ? "" : "none"); };
      document.getElementById("stu-csv").onclick = () => {
        const rows = [["Name", "Email", "Phone", "Joined", "Attempts", "Best %", "Avg accuracy %"], ...users.map(u => { const l = byUser[u.uid] || []; return [u.name, u.email, u.phone || "", u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : "", l.length, l.length ? Math.max(...l.map(a => Math.round(100 * a.score / a.maxMarks))) : "", l.length ? Math.round(100 * l.reduce((n, a) => n + (a.correct + a.wrong ? a.correct / (a.correct + a.wrong) : 0), 0) / l.length) : ""]; })];
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

    async help() {
      panel.innerHTML = `<h1>Help</h1>
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
