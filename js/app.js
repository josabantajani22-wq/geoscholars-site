/* Shared shell: header, footer, helpers. Loaded on every page after store.js */
(function () {
  const CFG = window.GSA_CONFIG, store = window.GSA.store;
  const page = location.pathname.split("/").pop() || "index.html";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const fmtDT = (ts) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const qs = (k) => new URLSearchParams(location.search).get(k);

  function header(user) {
    const links = [["index.html", "Home"], ["courses.html", "Courses"], ["tests.html", "Tests"], ["classes.html", "Classes"], ["vacancies.html", "Vacancies"], ["articles.html", "Notes"], ["exams.html", "Exams"], ["about.html", "About"], ["contact.html", "Contact"]];
    if (user) links.push(["dashboard.html", "Dashboard"]);
    if (user && user.isAdmin) links.push(["admin.html", "Admin"]);
    return `
    <header class="site-header"><div class="wrap">
      <a class="brand" href="index.html"><img src="assets/logo.png" alt="${esc(CFG.shortName)} logo"><span>${esc(CFG.siteName)}<small>${esc(CFG.tagline)}</small></span></a>
      <button class="nav-toggle" aria-label="Menu" onclick="document.querySelector('.nav').classList.toggle('open')">☰</button>
      <nav class="nav">
        ${links.map(([h, t]) => `<a href="${h}" class="${page === h ? "active" : ""}">${t}</a>`).join("")}
        <button class="icon-btn" id="theme-toggle" title="Dark / light mode" aria-label="Toggle dark mode">🌙</button>
        <button class="icon-btn" id="bell" title="Notifications" aria-label="Notifications">🔔<span class="bell-count hidden" id="bell-count"></span></button>
        ${user ? `<a href="#" class="btn ghost sm" id="nav-signout">Sign out</a>` : `<a href="login.html" class="btn primary sm">Sign in</a>`}
      </nav>
    </div></header>`;
  }
  function footer() {
    const c = CFG;
    const contact = [c.phone && `📞 <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>`, c.email && `✉️ <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.address && `📍 ${esc(c.address)}`].filter(Boolean).join("<br>");
    const social = [c.youtube && `<a href="${esc(c.youtube)}" target="_blank" rel="noopener">YouTube</a>`, c.instagram && `<a href="${esc(c.instagram)}" target="_blank" rel="noopener">Instagram</a>`, c.telegram && `<a href="${esc(c.telegram)}" target="_blank" rel="noopener">Telegram</a>`].filter(Boolean).join(" · ");
    return `
    <footer class="site-footer"><div class="wrap">
      <div class="cols">
        <div><h4>${esc(c.siteName)}</h4><p>${esc(c.tagline)}. Focused coaching for ONGC Geologist, GATE Geology &amp; Geophysics, UPSC Combined Geo-Scientist and state geologist recruitments.</p>${social ? `<p>${social}</p>` : ""}</div>
        <div><h4>Explore</h4><p><a href="courses.html">Courses</a><br><a href="tests.html">Free Test Series</a><br><a href="classes.html">Free Classes</a><br><a href="vacancies.html">Geology Vacancies</a><br><a href="articles.html">Study notes &amp; articles</a><br><a href="resources.html">Downloads &amp; PYQs</a><br><a href="exams.html">Official Exam Links</a><br><a href="contact.html">Enquire / Admission</a><br><a href="login.html">Student login</a></p></div>
        <div><h4>Contact</h4><p>${contact || "Contact details coming soon."}</p></div>
      </div>
      <div class="copy"><span id="visitor-geo" class="small muted"></span><br>© ${new Date().getFullYear()} ${esc(c.siteName)}. All rights reserved. <span class="muted">· ${store.mode === "local" ? "Demo mode: data is stored in this browser only" : ""}</span></div>
    </div></footer>`;
  }

  function mount(user) {
    document.getElementById("site-header").innerHTML = header(user);
    document.getElementById("site-footer").innerHTML = footer();
    const so = document.getElementById("nav-signout");
    if (so) so.onclick = async (e) => { e.preventDefault(); await store.signOut(); location.href = "index.html"; };
  }

  // Telegram floating button (bottom-right)
  function telegramFab() {
    if (!CFG.telegram) return;
    const a = document.createElement("a");
    a.href = CFG.telegram; a.target = "_blank"; a.rel = "noopener"; a.title = "Join us on Telegram"; a.className = "fab-telegram";
    a.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M9.04 15.47 8.7 20.2c.48 0 .69-.21.94-.46l2.26-2.17 4.68 3.43c.86.47 1.47.22 1.7-.79l3.08-14.4c.28-1.24-.45-1.73-1.29-1.42L2.06 11.3c-1.22.47-1.2 1.15-.21 1.46l4.6 1.44 10.7-6.75c.5-.33.96-.15.58.18z"/></svg>';
    document.body.appendChild(a);
  }

  // Interactivity: reveal-on-scroll, header shadow, back-to-top, animated counters
  function motion() {
    const targets = document.querySelectorAll(".card, .stat, .section-head, .notice, .story, h1, .hero p.lead, .hero-actions");
    targets.forEach((el, i) => { if (!el.classList.contains("reveal")) { el.classList.add("reveal"); el.style.transitionDelay = (i % 4) * 40 + "ms"; } });
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .05, rootMargin: "0px 0px -5% 0px" });
      document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
      setTimeout(() => document.querySelectorAll(".reveal:not(.in)").forEach(el => el.classList.add("in")), 4000); // safety: never leave content hidden
    } else document.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));
    document.querySelectorAll("[data-count]").forEach(el => {
      const end = parseFloat(el.dataset.count), suffix = el.dataset.suffix || "", t0 = performance.now(), dur = 1400;
      const tick = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(end * e) + suffix; if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const hdr = document.querySelector(".site-header");
    let top = document.querySelector(".back-top");
    if (!top) { top = document.createElement("button"); top.className = "back-top"; top.title = "Back to top"; top.textContent = "↑"; top.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" }); document.body.appendChild(top); }
    const onScroll = () => { hdr && hdr.classList.toggle("scrolled", scrollY > 8); top.classList.toggle("show", scrollY > 500); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }
  // Pages that render content later call GSA.ui.motion() again to animate the new nodes.
  window.GSA.ui = { esc, fmtDate, fmtDT, qs, mount, motion,
    requireAuth(user, msg) { if (!user) { location.href = "login.html?next=" + encodeURIComponent(page + location.search) + (msg ? "&msg=" + encodeURIComponent(msg) : ""); return false; } return true; },
    toast(el, type, text) { el.className = "alert " + type; el.textContent = text; el.classList.remove("hidden"); }
  };

  // Fire gsa:ready only after the store is ready AND the page's own scripts have run.
  const domReady = new Promise(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r) : r());
  function analytics() {
    if (page !== "admin.html") { store.recordVisit(page).catch(() => {}); store.bumpGlobalCounter(); }
    if (CFG.googleAnalyticsId) {
      const g = document.createElement("script"); g.async = true; g.src = "https://www.googletagmanager.com/gtag/js?id=" + CFG.googleAnalyticsId; document.head.appendChild(g);
      window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); }; gtag("js", new Date()); gtag("config", CFG.googleAnalyticsId);
    }
  }
  // PWA: register the service worker and offer "Install app" once the browser allows it
  function pwa() {
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {});
    let deferred = null;
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; const b = document.createElement("button"); b.className = "install-app"; b.textContent = "📲 Install app"; b.onclick = async () => { b.remove(); deferred.prompt(); deferred = null; }; document.body.appendChild(b); });
  }
  function stickyCta() {
    if (["admin.html", "test.html", "login.html", "dashboard.html", "contact.html"].includes(page)) return;
    const bar = document.createElement("div"); bar.className = "sticky-cta";
    bar.innerHTML = `<span><strong>Admissions open 2026-27</strong> · IIT JAM · GATE GG · CSIR NET · GSI</span><span class="cta-btns"><a class="btn primary sm" href="contact.html">Enquire now</a>${CFG.telegram ? `<a class="btn ghost sm" href="${esc(CFG.telegram)}" target="_blank" rel="noopener">Telegram</a>` : ""}</span>`;
    document.body.appendChild(bar);
    window.addEventListener("scroll", () => bar.classList.toggle("show", scrollY > 600), { passive: true });
  }
  // ---- v9: visitor geo + visit log, notifications bell, dark mode, lead popup, share helper ----
  async function visitorGeo(user) {
    const g = await store.visitorGeo(); const d = store.deviceInfo(); const el = document.getElementById("visitor-geo");
    if (g && el) el.textContent = `📍 You're visiting from ${[g.city, g.region, g.country].filter(Boolean).join(", ")} · IP ${g.ip} · ${d.device} · ${d.browser}`;
    if (!sessionStorage.getItem("gsa_visit_logged") && page !== "admin.html") {
      sessionStorage.setItem("gsa_visit_logged", "1");
      store.logVisit({ id: store.newId(), at: Date.now(), page, ip: g ? g.ip : "", city: g ? g.city || "" : "", region: g ? g.region || "" : "", country: g ? g.country || "" : "", isp: g ? g.isp || "" : "", lat: g ? g.lat || null : null, lon: g ? g.lon || null : null, ...d, referrer: (document.referrer || "").slice(0, 120), uid: user ? user.uid : "", name: user ? user.name || "" : "", screen: `${screen.width}x${screen.height}` }).catch(() => {});
    }
  }
  async function bell() {
    const b = document.getElementById("bell"), cnt = document.getElementById("bell-count"); if (!b) return;
    let notices = []; try { notices = (await store.listAllNotices()).slice(0, 8); } catch (e) { return; }
    const seen = new Set(JSON.parse(localStorage.getItem("gsa_seen_notices") || "[]")); const unread = notices.filter(n => !seen.has(n.id)).length;
    if (unread) { cnt.textContent = unread; cnt.classList.remove("hidden"); }
    let panel = null;
    b.onclick = (e) => { e.preventDefault(); if (panel) { panel.remove(); panel = null; return; }
      panel = document.createElement("div"); panel.className = "bell-panel";
      panel.innerHTML = `<div class="bell-head"><b>Notifications</b><a href="index.html#announcements" class="small">All</a></div>` + (notices.length ? notices.map(n => `<div class="bell-item ${seen.has(n.id) ? "" : "new"}"><time>${esc(n.date || "")}</time><b>${esc(n.title)}</b><span class="small muted">${esc((n.text || "").slice(0, 110))}</span></div>`).join("") : "<p class='small muted' style='padding:.8rem'>No notifications.</p>");
      document.body.appendChild(panel); localStorage.setItem("gsa_seen_notices", JSON.stringify(notices.map(n => n.id))); cnt.classList.add("hidden");
      setTimeout(() => document.addEventListener("click", function h(ev) { if (panel && !panel.contains(ev.target) && ev.target !== b) { panel.remove(); panel = null; document.removeEventListener("click", h); } }), 0); };
  }
  function theme() {
    const apply = (t) => { document.documentElement.dataset.theme = t; const tb = document.getElementById("theme-toggle"); if (tb) tb.textContent = t === "dark" ? "☀️" : "🌙"; };
    let t = "light"; try { t = localStorage.getItem("gsa_theme") || "light"; } catch (e) {}
    apply(t);
    const tb = document.getElementById("theme-toggle"); if (tb) tb.onclick = () => { t = t === "dark" ? "light" : "dark"; try { localStorage.setItem("gsa_theme", t); } catch (e) {} apply(t); };
  }
  function leadPopup(user) {
    if (user || ["contact.html", "login.html", "admin.html", "test.html"].includes(page)) return;
    try { if (Date.now() - +(localStorage.getItem("gsa_lead_shown") || 0) < 3 * 86400000) return; } catch (e) { return; }
    const show = () => {
      if (document.getElementById("lead-pop")) return; localStorage.setItem("gsa_lead_shown", String(Date.now()));
      const d = document.createElement("div"); d.className = "lightbox"; d.id = "lead-pop";
      d.innerHTML = `<div class="lead-card"><button class="lb-close" id="lead-x" aria-label="Close">×</button><div class="eyebrow">Free for aspirants</div><h3>Get the free geology test series + daily vacancy alerts</h3><p class="small muted">Leave your number and we'll send the mock-test link and batch details on WhatsApp. No spam.</p><form id="lead-f"><div class="field"><input name="name" placeholder="Your name" required></div><div class="field"><input name="phone" placeholder="WhatsApp number" required type="tel"></div><div class="field"><select name="exam"><option value="">Target exam</option><option>IIT JAM</option><option>GATE GG</option><option>CSIR NET</option><option>UPSC Geo-Scientist / GSI</option><option>ONGC / PSU</option><option>Other</option></select></div><div id="lead-msg" class="alert hidden"></div><button class="btn primary" style="width:100%">Send me the link</button></form></div>`;
      document.body.appendChild(d);
      const close = () => d.remove(); document.getElementById("lead-x").onclick = close; d.onclick = (e) => { if (e.target === d) close(); };
      document.getElementById("lead-f").onsubmit = async (e) => {
        e.preventDefault(); const f = e.target; const enq = { id: store.newId(), at: Date.now(), name: f.name.value.trim(), phone: f.phone.value.trim(), email: "", course: f.exam.value, qualification: "", message: "Lead from home-page popup (" + page + ")", status: "New", delivered: false };
        try { const r = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(CFG.enquiryEmail), { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ _subject: "New lead (popup): " + enq.name, Name: enq.name, Phone: enq.phone, Exam: enq.course, Source: "Website popup · " + page }) }); enq.delivered = r.ok; } catch (err) {}
        try { await store.saveEnquiry(enq); } catch (err) {}
        d.querySelector(".lead-card").innerHTML = `<h3>Thank you, ${esc(enq.name)}!</h3><p>We'll message you on WhatsApp shortly. Meanwhile: <a href="tests.html">start a free mock test →</a>${CFG.telegram ? ` or <a href="${esc(CFG.telegram)}" target="_blank" rel="noopener">join our Telegram</a>` : ""}</p><button class="btn ghost" id="lead-done">Close</button>`; document.getElementById("lead-done").onclick = close;
      };
    };
    setTimeout(show, 30000);
    document.addEventListener("mouseout", (e) => { if (!e.relatedTarget && e.clientY < 10) show(); }, { once: true });
  }
  window.GSA.ui.shareBar = function (title, url) {
    const u = encodeURIComponent(url || location.href), t = encodeURIComponent(title || document.title);
    return `<div class="share-bar"><span class="small muted">Share:</span><a href="https://wa.me/?text=${t}%20${u}" target="_blank" rel="noopener" title="WhatsApp">WhatsApp</a><a href="https://t.me/share/url?url=${u}&text=${t}" target="_blank" rel="noopener" title="Telegram">Telegram</a><a href="https://twitter.com/intent/tweet?text=${t}&url=${u}" target="_blank" rel="noopener">X</a><a href="#" onclick="navigator.clipboard&&navigator.clipboard.writeText(decodeURIComponent('${u}'));this.textContent='Copied!';return false;">Copy link</a></div>`;
  };
  // Paint the header/footer immediately from the last known sign-in state; corrected once Firebase answers.
  let mounted = false;
  domReady.then(() => { if (mounted) return; let cu = null; try { cu = JSON.parse(localStorage.getItem("gsa_last_user") || "null"); } catch (e) {} if (document.getElementById("site-header")) { mount(cu); theme(); } });
  Promise.all([store.ready, domReady]).then(([user]) => { mounted = true; try { user ? localStorage.setItem("gsa_last_user", JSON.stringify({ uid: user.uid, name: user.name, email: user.email, isAdmin: user.isAdmin })) : localStorage.removeItem("gsa_last_user"); } catch (e) {} mount(user); telegramFab(); analytics(); stickyCta(); pwa(); theme(); bell(); visitorGeo(user); leadPopup(user); store.onAuth(u => { try { u ? localStorage.setItem("gsa_last_user", JSON.stringify({ uid: u.uid, name: u.name, email: u.email, isAdmin: u.isAdmin })) : localStorage.removeItem("gsa_last_user"); } catch (e) {} mount(u); theme(); bell(); }); document.dispatchEvent(new CustomEvent("gsa:ready", { detail: { user } })); setTimeout(motion, 50); setTimeout(motion, 600); });
})();
