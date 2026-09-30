/* Quiz player: intro → running → result/review */
document.addEventListener("gsa:ready", async ({ detail: { user } }) => {
  const { esc, qs, fmtDT } = GSA.ui, store = GSA.store, app = document.getElementById("app");
  const KEYS = "ABCDEFGH";
  const testId = qs("id"), reviewId = qs("review"); let practice = qs("mode") === "practice";
  const test = await store.getTest(testId);
  if (!test) { app.innerHTML = `<div class="alert err" style="margin:2rem 0">Test not found. <a href="tests.html">Back to tests</a></div>`; return; }
  document.title = `${test.title} — Geo Scholars Academy`;
  const Q = test.questions, N = Q.length, maxMarks = Q.reduce((n, q) => n + (q.marks || 1), 0);
  const sections = (test.sections && test.sections.length) ? test.sections : [{ name: "All questions", from: 0, to: N }];
  const secOf = (i) => sections.findIndex(s => i >= s.from && i < s.to);
  const progressKey = `gsa_progress_${testId}_${user ? user.uid : "guest"}`;

  let S = { answers: Array(N).fill(null), marked: [], cur: 0, startedAt: 0, endsAt: 0 };
  let timerHandle = null;
  const CFG = window.GSA_CONFIG || {};
  const qtype = (q) => q.type === "msq" ? "msq" : q.type === "nat" ? "nat" : "mcq";
  const isCorrect = (q, ans) => {
    if (ans === null || ans === undefined || ans === "") return false;
    const t = qtype(q);
    if (t === "mcq") return ans === q.answer;
    if (t === "msq") { const a = Array.isArray(ans) ? ans.slice().sort() : []; const k = (q.answer || []).slice().sort(); return a.length === k.length && a.every((x, i) => x === k[i]); }
    const v = parseFloat(String(ans).replace(/[^\d.eE+-]/g, "")); if (isNaN(v)) return false; const [lo, hi] = q.answer; return v >= lo - 1e-9 && v <= hi + 1e-9;
  };
  const answered = (a) => !(a === null || a === undefined || a === "" || (Array.isArray(a) && !a.length));
  const fmtN = (x) => Math.round(x * 100) / 100;
  const keyText = (q) => { const t = qtype(q); if (t === "mcq") return KEYS[q.answer]; if (t === "msq") return q.answer.map(i => KEYS[i]).join(", "); const [lo, hi] = q.answer; return lo === hi ? String(lo) : `${lo} to ${hi}`; };
  const typeLabel = { mcq: "MCQ · one correct option", msq: "MSQ · one or more correct options (full marks only if all correct, no negative)", nat: "NAT · type the numerical answer (no negative marking)" };

  /* ---------- PRE-TEST DETAILS (name · phone · qualification) ---------- */
  const leadKey = "gsa_test_lead";
  function savedLead() { try { return JSON.parse(localStorage.getItem(leadKey) || "null"); } catch { return null; } }
  function needDetails() { if (user && user.name && user.phone && user.qualification) return false; const l = savedLead(); return !(l && l.name && l.phone && l.qualification); }
  function detailsForm() {
    const l = savedLead() || {}; const QUALS = (store.QUALIFICATIONS || ["B.Sc. (pursuing)", "B.Sc. (completed)", "M.Sc. (pursuing)", "M.Sc. (completed)", "Other"]);
    return `<div class="card" style="margin-bottom:1.5rem" id="lead-card"><h3 style="margin-top:0">Your details (30 seconds)</h3><p class="small muted" style="margin:0 0 .8rem">We use these to send your scorecard and the right batch information. Fields marked * are required.</p>
      <form id="lead-f"><div class="form-row"><div class="field"><label>Full name *</label><input name="name" required value="${esc((user && user.name) || l.name || "")}"></div><div class="field"><label>Phone / WhatsApp *</label><input name="phone" type="tel" required value="${esc((user && user.phone) || l.phone || "")}" placeholder="+91 …"></div></div>
      <div class="field"><label>Highest qualification *</label><select name="qualification" required><option value="">Select…</option>${QUALS.map(q => `<option ${(user && user.qualification) === q || l.qualification === q ? "selected" : ""}>${esc(q)}</option>`).join("")}</select></div>
      <div id="lead-msg" class="alert hidden"></div></form></div>`;
  }
  async function captureDetails() {
    const f = document.getElementById("lead-f"); if (!f) return true;
    if (!f.reportValidity()) return false;
    const d = { name: f.name.value.trim(), phone: f.phone.value.trim(), qualification: f.qualification.value, at: Date.now() };
    try { localStorage.setItem(leadKey, JSON.stringify(d)); } catch {}
    if (user) { try { await store.updateProfile({ name: d.name, phone: d.phone, qualification: d.qualification }); } catch {} }
    const flag = "gsa_test_lead_sent"; if (!localStorage.getItem(flag)) {   // one enquiry per browser, not per test
      localStorage.setItem(flag, "1");
      const enq = { id: store.newId(), at: Date.now(), name: d.name, phone: d.phone, email: user ? user.email : "", course: test.exam || test.category || "", qualification: d.qualification, message: "Started mock test: " + test.title, status: "New", delivered: false };
      try { const r = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(CFG.enquiryEmail), { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ _subject: "Mock test lead: " + enq.name, Name: enq.name, Phone: enq.phone, Qualification: enq.qualification, Test: test.title }) }); enq.delivered = r.ok; } catch {}
      try { await store.saveEnquiry(enq); } catch {}
    }
    return true;
  }

  /* ---------- POST-RESULT ENROL POPUP ---------- */
  function enrolPopup(a) {
    if (document.getElementById("enrol-pop")) return;
    const l = savedLead() || {}; const pct = Math.max(0, Math.round(100 * a.score / a.maxMarks));
    const msg = pct >= 60 ? "Excellent score! With structured mentoring you can convert this into a top rank." : pct >= 35 ? "Good start. A focused batch with weekly mocks typically lifts scores by 20–30% in three months." : "Don't worry — this is exactly where structured coaching helps the most.";
    const d = document.createElement("div"); d.className = "lightbox"; d.id = "enrol-pop";
    d.innerHTML = `<div class="lead-card" style="width:min(520px,100%)"><button class="lb-close" id="enrol-x" aria-label="Close">×</button><div class="eyebrow">You scored ${fmtN(a.score)} / ${fmtN(a.maxMarks)} (${pct}%)</div><h3>${esc(msg)}</h3>
      <p class="small muted">Get a free counselling call about the right batch for <b>${esc(test.exam || test.category || "your exam")}</b> — fee, schedule and a study plan based on this score.</p>
      <form id="enrol-f"><div class="form-row"><div class="field"><input name="name" placeholder="Your name" required value="${esc((user && user.name) || l.name || "")}"></div><div class="field"><input name="phone" type="tel" placeholder="WhatsApp number" required value="${esc((user && user.phone) || l.phone || "")}"></div></div>
      <div class="field"><select name="course"><option value="">Which batch interests you?</option>${((window.GSA_SITE || {}).courses || []).map(c => `<option>${esc(c.name)}</option>`).join("")}<option>Not sure — please advise</option></select></div>
      <div id="enrol-msg" class="alert hidden"></div>
      <button class="btn primary" style="width:100%">Request a callback</button></form>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.8rem">${CFG.classplus && CFG.classplus.web ? `<a class="btn ghost sm" href="${esc(CFG.classplus.web)}" target="_blank" rel="noopener">Enrol on Classplus</a>` : ""}${CFG.telegram ? `<a class="btn ghost sm" href="${esc(CFG.telegram)}" target="_blank" rel="noopener">Join Telegram</a>` : ""}<a class="btn ghost sm" href="courses.html">See courses</a></div></div>`;
    document.body.appendChild(d);
    const close = () => d.remove(); document.getElementById("enrol-x").onclick = close; d.onclick = (e) => { if (e.target === d) close(); };
    document.getElementById("enrol-f").onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      const enq = { id: store.newId(), at: Date.now(), name: f.name.value.trim(), phone: f.phone.value.trim(), email: user ? user.email : "", course: f.course.value, qualification: l.qualification || (user && user.qualification) || "", message: `Wants enrolment after mock test "${test.title}" — scored ${fmtN(a.score)}/${fmtN(a.maxMarks)} (${pct}%)`, status: "New", delivered: false };
      try { const r = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(CFG.enquiryEmail), { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ _subject: "Enrolment request after mock test: " + enq.name, Name: enq.name, Phone: enq.phone, Batch: enq.course, Test: test.title, Score: `${fmtN(a.score)}/${fmtN(a.maxMarks)} (${pct}%)` }) }); enq.delivered = r.ok; } catch {}
      try { await store.saveEnquiry(enq); } catch {}
      d.querySelector(".lead-card").innerHTML = `<h3>Thank you, ${esc(enq.name)}!</h3><p>Our counsellor will call you on ${esc(enq.phone)} within one working day.</p><button class="btn ghost" id="enrol-done">Back to my result</button>`; document.getElementById("enrol-done").onclick = close;
    };
  }

  /* ---------- INTRO ---------- */
  function intro() {
    let saved = null; try { saved = JSON.parse(localStorage.getItem(progressKey)); } catch {}
    if (saved && saved.endsAt < Date.now()) { localStorage.removeItem(progressKey); saved = null; }
    app.innerHTML = `
    <div style="max-width:760px;margin:2rem auto 3rem">
      <div class="eyebrow">${esc(test.category || "Mock test")}${test.difficulty ? " · " + esc(test.difficulty) : ""}</div>
      <h1>${esc(test.title)}</h1>
      ${test.description ? `<p class="muted">${esc(test.description)}</p>` : ""}
      <div class="score-grid" style="margin:1.5rem 0">
        <div><b>${N}</b><span>Questions</span></div><div><b>${test.durationMinutes}</b><span>Minutes</span></div><div><b>${fmtN(maxMarks)}</b><span>Max marks</span></div><div><b>+${Q[0].marks || 1} / −${Q[0].negative || 0}</b><span>Marking (Q1)</span></div>
      </div>
      ${sections.length > 1 ? `<div class="card" style="margin-bottom:1.5rem"><h3>Sections</h3><table><tr><th>Section</th><th>Questions</th></tr>${sections.map(s => `<tr><td>${esc(s.name)}</td><td>${s.from + 1}–${s.to}</td></tr>`).join("")}</table></div>` : ""}
      <div class="card" style="margin-bottom:1.5rem"><h3>Instructions</h3><ol class="instructions small">
        <li>The timer starts when you click <strong>Start test</strong>. The test auto-submits when time runs out.</li>
        <li>Each correct answer earns the marks shown; each wrong answer deducts the negative marks. Unattempted questions score zero.</li>
        ${Q.some(q => qtype(q) !== "mcq") ? `<li>This paper has ${[...new Set(Q.map(qtype))].map(t => t.toUpperCase()).join(" / ")} questions. ${[...new Set(Q.map(qtype))].filter(t => t !== "mcq").map(t => typeLabel[t]).join(" ")}</li>` : ""}
        ${test.pyq ? "<li>Questions that depend on a figure, map or image in the original paper are omitted, so the total may be less than the official paper.</li>" : ""}
        <li>Use the question palette to jump between questions. You can mark questions for review and clear a response.</li>
        <li>Your progress is saved in this browser — if the page reloads, you can resume.</li>
        <li>After submitting you will see your score, section-wise analysis and worked solutions for every question.</li>
      </ol></div>
      <div id="lb-box"></div>
      ${needDetails() ? detailsForm() : ""}
      ${!user ? `<div class="alert info">You are not signed in — your score will <strong>not</strong> be saved to a dashboard. <a href="login.html?next=${encodeURIComponent("test.html?id=" + testId)}">Sign in</a> or continue as a guest.</div>` : ""}
      <div style="display:flex;gap:.7rem;flex-wrap:wrap">
        ${saved ? `<button class="btn primary" id="resume">Resume attempt (${Math.max(0, Math.round((saved.endsAt - Date.now()) / 60000))} min left)</button><button class="btn ghost" id="start">Start fresh</button>` : `<button class="btn primary" id="start">${practice ? "Start practice (no timer)" : "Start timed test"}</button>`}
        ${practice ? `<a class="btn ghost" href="test.html?id=${encodeURIComponent(testId)}">Switch to timed mode</a>` : `<a class="btn ghost" href="test.html?id=${encodeURIComponent(testId)}&mode=practice" title="No timer; check each answer as you go">Practice mode</a>`}
        <a class="btn ghost" href="tests.html">Back</a>
      </div>
    </div>`;
    document.getElementById("start").onclick = async () => { if (!(await captureDetails())) return; localStorage.removeItem(progressKey); start(); };
    store.listLeaderboard(testId, 10).then(rows => { const box = document.getElementById("lb-box"); if (!box || !rows.length) return; box.innerHTML = `<div class="card" style="margin-bottom:1.5rem"><h3 style="margin-top:0">🏆 Leaderboard — top ${rows.length}</h3><div class="table-wrap"><table><tr><th>#</th><th>Student</th><th>Score</th><th>Time</th></tr>${rows.map((r, i) => `<tr class="${user && r.uid === user.uid ? "me" : ""}"><td>${["🥇", "🥈", "🥉"][i] || i + 1}</td><td>${esc(r.name || "Student")}${user && r.uid === user.uid ? " (you)" : ""}</td><td><b>${fmtN(r.score)}</b> / ${fmtN(r.max)}</td><td class="small">${Math.floor((r.timeTakenSec || 0) / 60)}m</td></tr>`).join("")}</table></div><p class="small muted" style="margin:.5rem 0 0">Timed attempts by signed-in students. ${user ? "Beat your best to move up." : `<a href="login.html?next=${encodeURIComponent("test.html?id=" + testId)}">Sign in</a> to appear here.`}</p></div>`; }).catch(() => {});
    const r = document.getElementById("resume"); if (r) r.onclick = async () => { if (!(await captureDetails())) return; S = saved; start(true); };
  }

  /* ---------- RUNNING ---------- */
  function start(resume) {
    if (!resume) { S.startedAt = Date.now(); S.endsAt = S.startedAt + (practice ? 24 * 60 : test.durationMinutes) * 60000; S.practice = practice; }
    practice = !!S.practice;
    app.innerHTML = `
    <div class="quiz">
      <main>
        <div class="quiz-top"><strong>${esc(test.title)}${practice ? ' <span class="badge moss">Practice</span>' : ""}</strong><span class="muted small" id="prog"></span><div class="timer" id="timer" ${practice ? 'style="display:none"' : ""}></div></div>
        ${sections.length > 1 ? `<div class="sec-tabs" id="sec-tabs">${sections.map((s, i) => `<button data-i="${i}">${esc(s.name.replace(/^Section\s+/, "").split(":")[0])}</button>`).join("")}</div>` : ""}
        <div class="q-card" id="q"></div>
      </main>
      <aside><div class="palette">
        <h4>Question palette</h4>
        <div class="legend"><span><i style="background:var(--moss-soft);border-color:var(--moss)"></i>Answered</span><span><i style="background:#efe3ff;border-color:#7a4dc9"></i>Marked</span><span><i></i>Not answered</span></div>
        <div class="pal-grid" id="pal"></div>
        <button class="btn danger" style="width:100%" id="submit">Submit test</button>
      </div></aside>
    </div>`;
    document.getElementById("submit").onclick = () => confirmSubmit();
    document.querySelectorAll("#sec-tabs button").forEach(b => b.onclick = () => go(sections[+b.dataset.i].from));
    renderQ(); renderPal(); tick(); timerHandle = setInterval(tick, 1000);
    window.onbeforeunload = () => "Your test is in progress.";
  }
  const persist = () => { try { localStorage.setItem(progressKey, JSON.stringify(S)); } catch {} };
  function tick() {
    const left = Math.max(0, S.endsAt - Date.now()), t = document.getElementById("timer");
    if (!t) return;
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    t.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    t.classList.toggle("low", left < 5 * 60000);
    if (left <= 0) finish(true);
  }
  function go(i) { S.cur = Math.min(N - 1, Math.max(0, i)); renderQ(); renderPal(); persist(); }
  function renderQ() {
    const i = S.cur, q = Q[i], sel = S.answers[i];
    document.getElementById("prog").textContent = `${S.answers.filter(answered).length} of ${N} answered`;
    document.querySelectorAll("#sec-tabs button").forEach(b => b.classList.toggle("active", +b.dataset.i === secOf(i)));
    document.getElementById("q").innerHTML = `
      <div class="q-num"><span>Question ${i + 1} of ${N}</span>${sections.length > 1 ? `<span>${esc(sections[secOf(i)].name)}</span>` : ""}<span>${qtype(q) !== "mcq" ? `<span class="badge grey">${qtype(q).toUpperCase()}</span> ` : ""}+${q.marks || 1} / −${q.negative || 0}</span></div>
      <div class="q-text">${esc(q.text)}</div>
      ${qtype(q) === "nat" ? `<div class="field" style="max-width:320px"><label>Your numerical answer</label><input type="text" inputmode="decimal" id="nat-in" value="${esc(sel ?? "")}" placeholder="e.g. 12.5"></div>` :
        qtype(q) === "msq" ? `<p class="small muted" style="margin:0 0 .4rem">Select all correct options.</p>` + q.options.map((o, k) => `<label class="opt ${(sel || []).includes(k) ? "selected" : ""}"><input type="checkbox" name="opt" value="${k}" ${(sel || []).includes(k) ? "checked" : ""}><span class="key">${KEYS[k]}.</span><span>${esc(o)}</span></label>`).join("") :
        q.options.map((o, k) => `<label class="opt ${sel === k ? "selected" : ""}"><input type="radio" name="opt" value="${k}" ${sel === k ? "checked" : ""}><span class="key">${KEYS[k]}.</span><span>${esc(o)}</span></label>`).join("")}
      ${practice ? `<div id="chk-box">${S.checked && S.checked.includes(i) ? feedback(q, sel) : `<button class="btn sm" id="chk" ${answered(sel) ? "" : "disabled"}>Check answer</button>`}</div>` : ""}
      <div class="q-actions">
        <button class="btn ghost sm" id="prev" ${i === 0 ? "disabled" : ""}>← Previous</button>
        <button class="btn ghost sm" id="clear">Clear response</button>
        <button class="btn ghost sm" id="mark">${S.marked.includes(i) ? "Unmark review" : "Mark for review"}</button>
        <button class="btn sm right" id="next">${i === N - 1 ? "Save" : "Save & Next →"}</button>
      </div>`;
    if (qtype(q) === "msq") document.querySelectorAll("#q input[name=opt]").forEach(r => r.onchange = () => { const cur = new Set(Array.isArray(S.answers[i]) ? S.answers[i] : []); r.checked ? cur.add(+r.value) : cur.delete(+r.value); S.answers[i] = cur.size ? [...cur].sort() : null; renderQ(); renderPal(); persist(); });
    else if (qtype(q) === "nat") { const inp = document.getElementById("nat-in"); inp.oninput = () => { S.answers[i] = inp.value.trim() || null; renderPal(); persist(); }; }
    else document.querySelectorAll("#q input[name=opt]").forEach(r => r.onchange = () => { S.answers[i] = +r.value; renderQ(); renderPal(); persist(); });
    const chk = document.getElementById("chk"); if (chk) chk.onclick = () => { S.checked = [...(S.checked || []), i]; renderQ(); persist(); };
    document.getElementById("prev").onclick = () => go(i - 1);
    document.getElementById("next").onclick = () => go(i === N - 1 ? i : i + 1);
    document.getElementById("clear").onclick = () => { S.answers[i] = null; renderQ(); renderPal(); persist(); };
    document.getElementById("mark").onclick = () => { S.marked = S.marked.includes(i) ? S.marked.filter(x => x !== i) : [...S.marked, i]; renderQ(); renderPal(); persist(); };
  }
  function renderPal() {
    document.getElementById("pal").innerHTML = Q.map((_, i) => `<button class="${answered(S.answers[i]) ? "answered" : ""} ${S.marked.includes(i) ? "marked" : ""} ${i === S.cur ? "current" : ""}" data-i="${i}">${i + 1}</button>`).join("");
    document.querySelectorAll("#pal button").forEach(b => b.onclick = () => go(+b.dataset.i));
  }
  function confirmSubmit() {
    const un = S.answers.filter(a => !answered(a)).length;
    if (confirm(`Submit the test now?\n\nAnswered: ${N - un}\nUnanswered: ${un}${S.marked.length ? `\nMarked for review: ${S.marked.length}` : ""}`)) finish(false);
  }

  const feedback = (q, sel) => `<div class="alert ${isCorrect(q, sel) ? "ok" : "err"} small" style="margin:.6rem 0"><b>${isCorrect(q, sel) ? "✅ Correct" : "❌ Not correct"}</b> — answer: <b>${esc(keyText(q))}</b>${q.solution ? "<br>" + esc(q.solution) : ""}</div>`;

  /* ---------- SCORING ---------- */
  function score(answers) {
    let sc = 0, c = 0, w = 0, u = 0;
    const perSec = sections.map(s => ({ name: s.name, total: s.to - s.from, correct: 0, wrong: 0, score: 0, max: 0 }));
    Q.forEach((q, i) => {
      const ps = perSec[secOf(i)]; ps.max += q.marks || 1;
      if (!answered(answers[i])) { u++; return; }
      if (isCorrect(q, answers[i])) { c++; sc += q.marks || 1; ps.correct++; ps.score += q.marks || 1; }
      else { w++; sc -= q.negative || 0; ps.wrong++; ps.score -= q.negative || 0; }
    });
    perSec.forEach(p => { p.score = fmtN(p.score); p.max = fmtN(p.max); });
    return { score: fmtN(sc), correct: c, wrong: w, unattempted: u, perSec };
  }
  async function finish(auto) {
    clearInterval(timerHandle); window.onbeforeunload = null; localStorage.removeItem(progressKey);
    const r = score(S.answers);
    const lead = savedLead() || {};
    const attempt = { id: store.newId(), uid: user ? user.uid : null, userName: user ? user.name : (lead.name || "Guest"), guestPhone: user ? "" : (lead.phone || ""), qualification: (user && user.qualification) || lead.qualification || "", testId, exam: test.exam || "", testTitle: test.title, at: Date.now(), timeTakenSec: Math.round((Math.min(Date.now(), S.endsAt) - S.startedAt) / 1000), answers: S.answers, ...r, maxMarks, total: N, autoSubmitted: !!auto };
    attempt.mode = practice ? "practice" : "timed";
    if (user) { try { await store.saveAttempt(attempt); } catch (e) { console.error(e); } }
    if (user && !practice) { try { await store.saveLeaderboard({ testId, uid: user.uid, name: user.name || "Student", score: attempt.score, max: fmtN(maxMarks), timeTakenSec: attempt.timeTakenSec, at: attempt.at }); } catch (e) {} }
    try { await store.logTestLead({ id: store.newId(), at: attempt.at, uid: user ? user.uid : "", name: attempt.userName, phone: user ? (user.phone || "") : attempt.guestPhone, email: user ? user.email : "", qualification: attempt.qualification, testId, testTitle: test.title, exam: test.exam || test.category || "", score: attempt.score, max: fmtN(maxMarks), pct: Math.max(0, Math.round(100 * attempt.score / maxMarks)), mode: attempt.mode, timeTakenSec: attempt.timeTakenSec }); } catch (e) {}
    result(attempt);
    if (!practice) setTimeout(() => enrolPopup(attempt), 1800);
  }

  /* ---------- RESULT + REVIEW ---------- */
  function result(a) {
    const pct = Math.max(0, Math.round(100 * a.score / a.maxMarks)), acc = a.correct + a.wrong ? Math.round(100 * a.correct / (a.correct + a.wrong)) : 0;
    const mm = Math.floor(a.timeTakenSec / 60), ss = a.timeTakenSec % 60;
    let cur = 0;
    app.innerHTML = `
    <div style="max-width:900px;margin:2rem auto 3rem">
      <div class="score-hero">
        <div class="eyebrow">${esc(a.testTitle)}${a.autoSubmitted ? " · auto-submitted (time over)" : ""}</div>
        <div class="big">${fmtN(a.score)} <span style="font-size:1.3rem;color:var(--muted)">/ ${fmtN(a.maxMarks)}</span></div>
        <div class="bar" style="max-width:360px;margin:1rem auto"><i style="width:${pct}%"></i></div>
        <div class="score-grid">
          <div><b style="color:var(--moss)">${a.correct}</b><span>Correct</span></div><div><b style="color:var(--red)">${a.wrong}</b><span>Wrong</span></div><div><b>${a.unattempted}</b><span>Unattempted</span></div><div><b>${acc}%</b><span>Accuracy</span></div><div><b>${mm}m ${ss}s</b><span>Time taken</span></div>
        </div>
        ${GSA.ui.shareBar ? GSA.ui.shareBar(`I scored ${fmtN(a.score)}/${fmtN(a.maxMarks)} in "${a.testTitle}" on Geo Scholars Academy. Try it free:`, location.origin + "/test.html?id=" + encodeURIComponent(testId)).replace('class="share-bar"', 'class="share-bar" style="justify-content:center"') : ""}
        ${!a.uid ? `<p class="small muted" style="margin:1.2rem 0 0">Guest attempt — <a href="login.html">sign in</a> next time to save your scores.</p>` : `<p class="small muted" style="margin:1.2rem 0 0">Saved to <a href="dashboard.html">your dashboard</a> · ${fmtDT(a.at)}</p>`}
      </div>
      ${a.perSec.length > 1 ? `<div class="card" style="margin-top:1.5rem"><h3>Section-wise analysis</h3><div class="table-wrap"><table><tr><th>Section</th><th>Qs</th><th>Correct</th><th>Wrong</th><th>Score</th><th>%</th></tr>${a.perSec.map(s => `<tr><td>${esc(s.name)}</td><td>${s.total}</td><td>${s.correct}</td><td>${s.wrong}</td><td>${s.score} / ${s.max}</td><td>${Math.max(0, Math.round(100 * s.score / s.max))}%</td></tr>`).join("")}</table></div></div>` : ""}
      <h2 style="margin-top:2.5rem">Review answers &amp; solutions</h2>
      <div class="quiz" style="padding-top:0">
        <main><div class="q-card" id="rq"></div></main>
        <aside><div class="palette"><h4>Questions</h4><div class="legend"><span><i style="background:var(--moss-soft);border-color:var(--moss)"></i>Correct</span><span><i style="background:var(--red-soft);border-color:var(--red)"></i>Wrong</span><span><i></i>Skipped</span></div><div class="pal-grid" id="rpal"></div>
        <a class="btn ghost" style="width:100%" href="test.html?id=${encodeURIComponent(testId)}">Attempt again</a><a class="btn" style="width:100%;margin-top:.5rem" href="tests.html">All tests</a></div></aside>
      </div>
    </div>`;
    function rq() {
      const q = Q[cur], sel = a.answers[cur];
      document.getElementById("rq").innerHTML = `
        <div class="q-num"><span>Question ${cur + 1} of ${N}</span>${sections.length > 1 ? `<span>${esc(sections[secOf(cur)].name)}</span>` : ""}<span class="badge ${!answered(sel) ? "grey" : isCorrect(q, sel) ? "moss" : "red"}">${!answered(sel) ? "Skipped" : isCorrect(q, sel) ? "Correct +" + (q.marks || 1) : "Wrong −" + (q.negative || 0)}</span></div>
        <div class="q-text">${esc(q.text)}</div>
        ${qtype(q) === "nat" ? `<div class="opt ${answered(sel) ? (isCorrect(q, sel) ? "correct" : "wrong") : ""}"><span class="key">Your answer:</span><span>${answered(sel) ? esc(String(sel)) : "—"}</span></div><div class="opt correct"><span class="key">Accepted:</span><span>${esc(keyText(q))} ✓</span></div>` :
          q.options.map((o, k) => { const isKey = qtype(q) === "msq" ? (q.answer || []).includes(k) : k === q.answer; const picked = qtype(q) === "msq" ? (sel || []).includes(k) : sel === k; return `<div class="opt ${isKey ? "correct" : (picked ? "wrong" : "")}"><span class="key">${KEYS[k]}.</span><span>${esc(o)}${isKey ? " ✓" : picked ? " ✗ (your answer)" : ""}</span></div>`; }).join("")}
        ${qtype(q) === "msq" ? `<p class="small muted">Correct options: <b>${esc(keyText(q))}</b>${answered(sel) ? ` · you chose ${sel.map(i => KEYS[i]).join(", ")}` : ""}</p>` : ""}
        ${q.solution ? `<div class="solution"><strong>Solution:</strong> ${esc(q.solution)}</div>` : ""}
        <div class="q-actions"><button class="btn ghost sm" id="rprev" ${cur === 0 ? "disabled" : ""}>← Previous</button><button class="btn sm right" id="rnext" ${cur === N - 1 ? "disabled" : ""}>Next →</button></div>`;
      document.getElementById("rprev").onclick = () => { cur--; rq(); rpal(); };
      document.getElementById("rnext").onclick = () => { cur++; rq(); rpal(); };
    }
    function rpal() {
      document.getElementById("rpal").innerHTML = Q.map((q, i) => `<button class="${!answered(a.answers[i]) ? "" : isCorrect(q, a.answers[i]) ? "correct" : "wrong"} ${i === cur ? "current" : ""}" data-i="${i}">${i + 1}</button>`).join("");
      document.querySelectorAll("#rpal button").forEach(b => b.onclick = () => { cur = +b.dataset.i; rq(); rpal(); });
    }
    rq(); rpal(); window.scrollTo(0, 0);
  }

  if (reviewId) {
    const a = await store.getAttempt(reviewId);
    if (!a || (user && a.uid !== user.uid && !user.isAdmin)) { app.innerHTML = `<div class="alert err" style="margin:2rem 0">Attempt not found.</div>`; return; }
    result(a);
  } else intro();
});
