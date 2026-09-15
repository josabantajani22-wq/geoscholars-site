/* Shared shell: header, footer, helpers. Loaded on every page after store.js */
(function () {
  const CFG = window.GSA_CONFIG, store = window.GSA.store;
  const page = location.pathname.split("/").pop() || "index.html";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const fmtDT = (ts) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const qs = (k) => new URLSearchParams(location.search).get(k);

  function header(user) {
    const links = [["index.html", "Home"], ["courses.html", "Courses"], ["tests.html", "Tests"], ["classes.html", "Classes"], ["vacancies.html", "Vacancies"], ["exams.html", "Exam Links"], ["about.html", "About"], ["contact.html", "Contact"]];
    if (user) links.push(["dashboard.html", "Dashboard"]);
    if (user && user.isAdmin) links.push(["admin.html", "Admin"]);
    return `
    <header class="site-header"><div class="wrap">
      <a class="brand" href="index.html"><img src="assets/logo.png" alt="${esc(CFG.shortName)} logo"><span>${esc(CFG.siteName)}<small>${esc(CFG.tagline)}</small></span></a>
      <button class="nav-toggle" aria-label="Menu" onclick="document.querySelector('.nav').classList.toggle('open')">☰</button>
      <nav class="nav">
        ${links.map(([h, t]) => `<a href="${h}" class="${page === h ? "active" : ""}">${t}</a>`).join("")}
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
        <div><h4>Explore</h4><p><a href="courses.html">Courses</a><br><a href="tests.html">Free Test Series</a><br><a href="classes.html">Free Classes</a><br><a href="vacancies.html">Geology Vacancies</a><br><a href="exams.html">Official Exam Links</a><br><a href="contact.html">Enquire / Admission</a><br><a href="login.html">Student login</a></p></div>
        <div><h4>Contact</h4><p>${contact || "Contact details coming soon."}</p></div>
      </div>
      <div class="copy">© ${new Date().getFullYear()} ${esc(c.siteName)}. All rights reserved. <span class="muted">· ${store.mode === "local" ? "Demo mode: data is stored in this browser only" : ""}</span></div>
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
    targets.forEach((el, i) => { if (!el.classList.contains("reveal")) { el.classList.add("reveal"); el.style.transitionDelay = (i % 6) * 60 + "ms"; } });
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
  function stickyCta() {
    if (["admin.html", "test.html", "login.html", "dashboard.html", "contact.html"].includes(page)) return;
    const bar = document.createElement("div"); bar.className = "sticky-cta";
    bar.innerHTML = `<span><strong>Admissions open 2026-27</strong> · IIT JAM · GATE GG · CSIR NET · GSI</span><span class="cta-btns"><a class="btn primary sm" href="contact.html">Enquire now</a>${CFG.telegram ? `<a class="btn ghost sm" href="${esc(CFG.telegram)}" target="_blank" rel="noopener">Telegram</a>` : ""}</span>`;
    document.body.appendChild(bar);
    window.addEventListener("scroll", () => bar.classList.toggle("show", scrollY > 600), { passive: true });
  }
  Promise.all([store.ready, domReady]).then(([user]) => { mount(user); telegramFab(); analytics(); stickyCta(); store.onAuth(u => mount(u)); document.dispatchEvent(new CustomEvent("gsa:ready", { detail: { user } })); setTimeout(motion, 50); setTimeout(motion, 600); });
})();
