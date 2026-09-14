/* Quiz player: intro → running → result/review */
document.addEventListener("gsa:ready", async ({ detail: { user } }) => {
  const { esc, qs, fmtDT } = GSA.ui, store = GSA.store, app = document.getElementById("app");
  const KEYS = "ABCDEFGH";
  const testId = qs("id"), reviewId = qs("review");
  const test = await store.getTest(testId);
  if (!test) { app.innerHTML = `<div class="alert err" style="margin:2rem 0">Test not found. <a href="tests.html">Back to tests</a></div>`; return; }
  document.title = `${test.title} — Geo Scholars Academy`;
  const Q = test.questions, N = Q.length, maxMarks = Q.reduce((n, q) => n + (q.marks || 1), 0);
  const sections = (test.sections && test.sections.length) ? test.sections : [{ name: "All questions", from: 0, to: N }];
  const secOf = (i) => sections.findIndex(s => i >= s.from && i < s.to);
  const progressKey = `gsa_progress_${testId}_${user ? user.uid : "guest"}`;

  let S = { answers: Array(N).fill(null), marked: [], cur: 0, startedAt: 0, endsAt: 0 };
  let timerHandle = null;

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
        <div><b>${N}</b><span>Questions</span></div><div><b>${test.durationMinutes}</b><span>Minutes</span></div><div><b>${maxMarks}</b><span>Max marks</span></div><div><b>+${Q[0].marks || 1} / −${Q[0].negative || 0}</b><span>Marking</span></div>
      </div>
      ${sections.length > 1 ? `<div class="card" style="margin-bottom:1.5rem"><h3>Sections</h3><table><tr><th>Section</th><th>Questions</th></tr>${sections.map(s => `<tr><td>${esc(s.name)}</td><td>${s.from + 1}–${s.to}</td></tr>`).join("")}</table></div>` : ""}
      <div class="card" style="margin-bottom:1.5rem"><h3>Instructions</h3><ol class="instructions small">
        <li>The timer starts when you click <strong>Start test</strong>. The test auto-submits when time runs out.</li>
        <li>Each correct answer earns the marks shown; each wrong answer deducts the negative marks. Unattempted questions score zero.</li>
        <li>Use the question palette to jump between questions. You can mark questions for review and clear a response.</li>
        <li>Your progress is saved in this browser — if the page reloads, you can resume.</li>
        <li>After submitting you will see your score, section-wise analysis and worked solutions for every question.</li>
      </ol></div>
      ${!user ? `<div class="alert info">You are not signed in — your score will <strong>not</strong> be saved to a dashboard. <a href="login.html?next=${encodeURIComponent("test.html?id=" + testId)}">Sign in</a> or continue as a guest.</div>` : ""}
      <div style="display:flex;gap:.7rem;flex-wrap:wrap">
        ${saved ? `<button class="btn primary" id="resume">Resume attempt (${Math.max(0, Math.round((saved.endsAt - Date.now()) / 60000))} min left)</button><button class="btn ghost" id="start">Start fresh</button>` : `<button class="btn primary" id="start">Start test</button>`}
        <a class="btn ghost" href="tests.html">Back</a>
      </div>
    </div>`;
    document.getElementById("start").onclick = () => { localStorage.removeItem(progressKey); start(); };
    const r = document.getElementById("resume"); if (r) r.onclick = () => { S = saved; start(true); };
  }

  /* ---------- RUNNING ---------- */
  function start(resume) {
    if (!resume) { S.startedAt = Date.now(); S.endsAt = S.startedAt + test.durationMinutes * 60000; }
    app.innerHTML = `
    <div class="quiz">
      <main>
        <div class="quiz-top"><strong>${esc(test.title)}</strong><span class="muted small" id="prog"></span><div class="timer" id="timer"></div></div>
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
    document.getElementById("prog").textContent = `${S.answers.filter(a => a !== null).length} of ${N} answered`;
    document.querySelectorAll("#sec-tabs button").forEach(b => b.classList.toggle("active", +b.dataset.i === secOf(i)));
    document.getElementById("q").innerHTML = `
      <div class="q-num"><span>Question ${i + 1} of ${N}</span>${sections.length > 1 ? `<span>${esc(sections[secOf(i)].name)}</span>` : ""}<span>+${q.marks || 1} / −${q.negative || 0}</span></div>
      <div class="q-text">${esc(q.text)}</div>
      ${q.options.map((o, k) => `<label class="opt ${sel === k ? "selected" : ""}"><input type="radio" name="opt" value="${k}" ${sel === k ? "checked" : ""}><span class="key">${KEYS[k]}.</span><span>${esc(o)}</span></label>`).join("")}
      <div class="q-actions">
        <button class="btn ghost sm" id="prev" ${i === 0 ? "disabled" : ""}>← Previous</button>
        <button class="btn ghost sm" id="clear">Clear response</button>
        <button class="btn ghost sm" id="mark">${S.marked.includes(i) ? "Unmark review" : "Mark for review"}</button>
        <button class="btn sm right" id="next">${i === N - 1 ? "Save" : "Save & Next →"}</button>
      </div>`;
    document.querySelectorAll("#q input[name=opt]").forEach(r => r.onchange = () => { S.answers[i] = +r.value; renderQ(); renderPal(); persist(); });
    document.getElementById("prev").onclick = () => go(i - 1);
    document.getElementById("next").onclick = () => go(i === N - 1 ? i : i + 1);
    document.getElementById("clear").onclick = () => { S.answers[i] = null; renderQ(); renderPal(); persist(); };
    document.getElementById("mark").onclick = () => { S.marked = S.marked.includes(i) ? S.marked.filter(x => x !== i) : [...S.marked, i]; renderQ(); renderPal(); persist(); };
  }
  function renderPal() {
    document.getElementById("pal").innerHTML = Q.map((_, i) => `<button class="${S.answers[i] !== null ? "answered" : ""} ${S.marked.includes(i) ? "marked" : ""} ${i === S.cur ? "current" : ""}" data-i="${i}">${i + 1}</button>`).join("");
    document.querySelectorAll("#pal button").forEach(b => b.onclick = () => go(+b.dataset.i));
  }
  function confirmSubmit() {
    const un = S.answers.filter(a => a === null).length;
    if (confirm(`Submit the test now?\n\nAnswered: ${N - un}\nUnanswered: ${un}${S.marked.length ? `\nMarked for review: ${S.marked.length}` : ""}`)) finish(false);
  }

  /* ---------- SCORING ---------- */
  function score(answers) {
    let sc = 0, c = 0, w = 0, u = 0;
    const perSec = sections.map(s => ({ name: s.name, total: s.to - s.from, correct: 0, wrong: 0, score: 0, max: 0 }));
    Q.forEach((q, i) => {
      const ps = perSec[secOf(i)]; ps.max += q.marks || 1;
      if (answers[i] === null || answers[i] === undefined) { u++; return; }
      if (answers[i] === q.answer) { c++; sc += q.marks || 1; ps.correct++; ps.score += q.marks || 1; }
      else { w++; sc -= q.negative || 0; ps.wrong++; ps.score -= q.negative || 0; }
    });
    return { score: sc, correct: c, wrong: w, unattempted: u, perSec };
  }
  async function finish(auto) {
    clearInterval(timerHandle); window.onbeforeunload = null; localStorage.removeItem(progressKey);
    const r = score(S.answers);
    const attempt = { id: store.newId(), uid: user ? user.uid : null, userName: user ? user.name : "Guest", testId, testTitle: test.title, at: Date.now(), timeTakenSec: Math.round((Math.min(Date.now(), S.endsAt) - S.startedAt) / 1000), answers: S.answers, ...r, maxMarks, total: N, autoSubmitted: !!auto };
    if (user) { try { await store.saveAttempt(attempt); } catch (e) { console.error(e); } }
    result(attempt);
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
        <div class="big">${a.score} <span style="font-size:1.3rem;color:var(--muted)">/ ${a.maxMarks}</span></div>
        <div class="bar" style="max-width:360px;margin:1rem auto"><i style="width:${pct}%"></i></div>
        <div class="score-grid">
          <div><b style="color:var(--moss)">${a.correct}</b><span>Correct</span></div><div><b style="color:var(--red)">${a.wrong}</b><span>Wrong</span></div><div><b>${a.unattempted}</b><span>Unattempted</span></div><div><b>${acc}%</b><span>Accuracy</span></div><div><b>${mm}m ${ss}s</b><span>Time taken</span></div>
        </div>
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
        <div class="q-num"><span>Question ${cur + 1} of ${N}</span>${sections.length > 1 ? `<span>${esc(sections[secOf(cur)].name)}</span>` : ""}<span class="badge ${sel === null ? "grey" : sel === q.answer ? "moss" : "red"}">${sel === null ? "Skipped" : sel === q.answer ? "Correct +" + (q.marks || 1) : "Wrong −" + (q.negative || 0)}</span></div>
        <div class="q-text">${esc(q.text)}</div>
        ${q.options.map((o, k) => `<div class="opt ${k === q.answer ? "correct" : (sel === k ? "wrong" : "")}"><span class="key">${KEYS[k]}.</span><span>${esc(o)}${k === q.answer ? " ✓" : sel === k ? " ✗ (your answer)" : ""}</span></div>`).join("")}
        ${q.solution ? `<div class="solution"><strong>Solution:</strong> ${esc(q.solution)}</div>` : ""}
        <div class="q-actions"><button class="btn ghost sm" id="rprev" ${cur === 0 ? "disabled" : ""}>← Previous</button><button class="btn sm right" id="rnext" ${cur === N - 1 ? "disabled" : ""}>Next →</button></div>`;
      document.getElementById("rprev").onclick = () => { cur--; rq(); rpal(); };
      document.getElementById("rnext").onclick = () => { cur++; rq(); rpal(); };
    }
    function rpal() {
      document.getElementById("rpal").innerHTML = Q.map((q, i) => `<button class="${a.answers[i] === null ? "" : a.answers[i] === q.answer ? "correct" : "wrong"} ${i === cur ? "current" : ""}" data-i="${i}">${i + 1}</button>`).join("");
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
