// Editable site content: courses, exam tracks, success stories, exam resources, videos, FAQs, default notices.
window.GSA_SITE = {
  // ---- Live batches (as on Classplus) ----
  courses: [
    {
      id: "advanced-gsi-net-gate",
      name: "Advanced Batch 2026-27 (GSI, NET, GATE, PSUs)",
      badge: "Flagship",
      exam: "UPSC Combined Geo-Scientist (GSI/CGWB) · CSIR NET Earth Sciences · GATE GG · ONGC / NMDC / Coal India via GATE",
      summary: "The complete geology programme for all major post-M.Sc. recruitments and eligibility exams — concept lectures across every branch, numerical practice, PYQ analysis and full-length mocks on each exam's pattern.",
      highlights: ["All branches: mineralogy to petroleum & economic geology", "Exam-specific test series (CGS Prelims, NET, GATE)", "Weekly numericals and PYQ drills", "Live doubt sessions + recordings"],
      duration: "Session 2026-27", mode: "Online live + recorded", fee: "Contact for fee", students: 15
    },
    {
      id: "advanced-jam-cuet",
      name: "Advanced Batch 2026-27 (IIT JAM + CUET)",
      badge: "Popular",
      exam: "IIT JAM Geology · CUET-PG Geology — M.Sc. admissions to IITs, IISc and central universities",
      summary: "For B.Sc. students targeting a top M.Sc. seat: syllabus-mapped classes for JAM Geology and CUET-PG, objective/numerical drills and timed mocks.",
      highlights: ["Full JAM Geology syllabus coverage", "CUET-PG Geology pattern practice", "Sectional + full-length mocks", "Counselling on institute choices"],
      duration: "Session 2026-27", mode: "Online live + recorded", fee: "Contact for fee", students: 12
    },
    {
      id: "crystallography-mineralogy",
      name: "Crystallography & Mineralogy Premium Batch 26-27",
      badge: "Premium",
      exam: "Topic mastery module — the highest-weight topics across JAM, NET, GATE and CGS",
      summary: "A focused premium module on crystallography, optical & descriptive mineralogy — the topics that decide ranks — with 3-D crystal visualisation, optical properties drills and problem sets.",
      highlights: ["Symmetry, crystal systems & forms", "Optical mineralogy with microscope visuals", "Descriptive mineralogy of key groups", "Topic test series"],
      duration: "Short module", mode: "Online live + recorded", fee: "Contact for fee", students: 1
    },
    {
      id: "numerical-premium",
      name: "Numerical Premium Batch 2 26-27",
      badge: "Premium",
      exam: "Numerical problem-solving for GATE GG, NET, JAM and CGS",
      summary: "Geology numericals are where most marks are lost. This module works through every calculation type — structural, geochronology, hydrogeology, geophysics, sedimentation rates — with method and speed.",
      highlights: ["Topic-wise numerical sets with worked solutions", "Speed and unit-conversion drills", "PYQ numericals from GATE, NET & JAM", "Doubt clearing on every set"],
      duration: "Short module", mode: "Online live + recorded", fee: "Contact for fee", students: 1
    }
  ],

  // ---- Success stories (home-page slider, one at a time, photo first).
  // photo: put the student's picture in site/assets/students/ and set photo: "assets/students/<file>.jpg"
  // (portrait or square, ~800px is plenty), or upload it from Admin → Success stories.
  // fit: "contain" shows a whole poster; omit it for a plain portrait photo (fills the panel).
  successStories: [
    // Imported from the "Success Stories" folder. quote = student's own words (shown with quote marks); text = caption.
    { id: "samarjeet-net", name: "Samarjeet Sahoo", achievement: "AIR 2 · CSIR NET Earth Science (Dec 2025)", batch: "Classroom learner · IIT Bombay", text: "All India Rank 2 among thousands of aspirants nationwide — success grounded in concept-based mentorship at GSA.", photo: "assets/students/samarjeet-sahoo-net.jpg", fit: "contain" },
    { id: "ayushman-barik", name: "Ayushman Barik", achievement: "AIR 3 · IIT JAM Geology 2026", batch: "Advanced Batch (IIT JAM + CUET)", text: "Dedication, consistency, excellence — Rank 3 in IIT JAM Geology 2026.", photo: "assets/students/ayushman-barik.jpg", fit: "contain" },
    { id: "samarjeet-reliance", name: "Samarjeet Sahoo", achievement: "Placed at Reliance Industries Ltd (campus placement)", batch: "Classroom learner · IIT Bombay", quote: "I have got placed in Reliance Industries Limited through campus placement. Thank you Sir for your support and guidance for the interview and placement procedures.", photo: "assets/students/samarjeet-sahoo-reliance.jpg", fit: "contain" },
    { id: "shakti-rout", name: "Shakti Swarup Rout", achievement: "AIR 75 · IIT JAM 2026", batch: "Advanced Batch (IIT JAM + CUET)", text: "Your hard work has paid off — Rank 75 in IIT JAM 2026.", photo: "assets/students/shakti-swarup-rout.jpg", fit: "contain" },
    { id: "ratikanta-behera", name: "Ratikanta Behera", achievement: "Placed at GMDC (Gujarat Mineral Development Corporation)", batch: "Regular classroom student · IIT (ISM) Dhanbad", text: "Our first aspirant placed at GMDC — Hoorah, you did it!", photo: "assets/students/ratikanta-behera.jpg", fit: "contain" },
    { id: "soumya-pati", name: "Soumya Ranjan Pati", achievement: "AIR 127 · IIT JAM 2026", batch: "Advanced Batch (IIT JAM + CUET)", text: "Dedication, consistency, excellence — Rank 127 in IIT JAM 2026.", photo: "assets/students/soumya-ranjan-pati.jpg", fit: "contain" },
    { id: "amritha-pooja", name: "Amritha Pooja", achievement: "AIR 150 · GATE Geology & Geophysics 2026", batch: "Advanced Batch (GSI, NET, GATE, PSUs)", text: "Rank 150 in GATE GG 2026 — wishing you a bright future ahead.", photo: "assets/students/amritha-pooja.jpg", fit: "contain" },
    { id: "khitish-barik", name: "Khitish Kumar Barik", achievement: "Placed at Vedanta", batch: "Regular classroom student", text: "Our second placed aspirant from Geo Scholars Academy — your hard work, dedication and commitment inspire us all.", photo: "assets/students/khitish-barik.jpg", fit: "contain" },
    { id: "achievers-2026", name: "Our Achievers — 2026", achievement: "Star performers of the year", batch: "Geo Scholars Academy", text: "Samarjeet Sahoo (AIR 2 CSIR NET) · Ayushman Barik (AIR 3 IIT JAM) · Chetan Sekhar Behera (BARC) · Ratikanta Behera (GMDC) · Ankit Swarrop Jena (AIR 73 IIT JAM) · Shakti Swaroop (AIR 75 IIT JAM) · Soumya Ranjan Pati (AIR 127 IIT JAM) · Amritha Pooja (AIR 150 GATE GG).", photo: "assets/students/achievers-2026.jpg", fit: "contain" }
  ],

  // ---- Achievements strip (home page). Keep short; pulled from the success posters. ----
  achievements: [
    { big: "AIR 2", small: "CSIR NET Earth Science" }, { big: "AIR 3", small: "IIT JAM Geology 2026" }, { big: "AIR 73", small: "IIT JAM 2026" }, { big: "AIR 75", small: "IIT JAM 2026" },
    { big: "AIR 127", small: "IIT JAM 2026" }, { big: "AIR 150", small: "GATE GG 2026" }, { big: "BARC", small: "Placement" }, { big: "Reliance", small: "Campus placement" }, { big: "GMDC", small: "Placement" }, { big: "Vedanta", small: "Placement" }
  ],

  // ---- Why GSA (home page cards) ----
  whyGsa: [
    { icon: "target", title: "Exam-pattern everything", text: "Mocks mirror the real paper — sections, marking, timer. No surprises on exam day." },
    { icon: "book", title: "Concept-first teaching", text: "Geology rewards understanding. We teach the why before the shortcut, from mineralogy to petroleum geology." },
    { icon: "chart", title: "Feedback you can act on", text: "Section-wise analysis after every test tells you exactly what to fix next." },
    { icon: "people", title: "Mentors who reply", text: "Small batches, live doubt sessions and a Telegram community that never sleeps." }
  ],

  // ---- Official exam references ----
  examResources: [
    { exam: "CSIR-UGC NET (Earth, Atmospheric, Ocean & Planetary Sciences)", org: "National Testing Agency / CSIR-HRDG", links: [
      { label: "NTA CSIR NET portal (notifications, apply, admit card)", url: "https://csirnet.nta.ac.in" },
      { label: "CSIR-HRDG (syllabus, JRF/LS rules)", url: "https://csirhrdg.res.in" }
    ], note: "Held twice a year (June & December). Qualifies for JRF and Assistant Professor eligibility." },
    { exam: "UPSC Combined Geo-Scientist Examination", org: "Union Public Service Commission", links: [
      { label: "UPSC — notifications & syllabus", url: "https://upsc.gov.in" },
      { label: "UPSC Online application portal", url: "https://upsconline.nic.in" }
    ], note: "Recruits Geologist, Geophysicist, Chemist (GSI) and Scientist-B Hydrogeology (CGWB). Prelims (objective) + Mains (descriptive) + interview." },
    { exam: "GATE — Geology & Geophysics (GG)", org: "IITs / IISc (rotating organising institute)", links: [
      { label: "GATE 2027 — IIT Madras", url: "https://gate2027.iitm.ac.in" },
      { label: "GATE 2026 archive — IIT Guwahati", url: "https://gate2026.iitg.ac.in" }
    ], note: "Score used for M.Tech/Ph.D. admissions and PSU recruitment (ONGC, NMDC, Coal India, Oil India)." },
    { exam: "IIT JAM — Geology", org: "IITs (rotating)", links: [
      { label: "JAM official portal", url: "https://jam.iitb.ac.in" }
    ], note: "Entrance for M.Sc. Geology / Applied Geology at IITs and IISc." },
    { exam: "CUET-PG — Geology", org: "National Testing Agency", links: [
      { label: "NTA CUET-PG portal", url: "https://exams.nta.ac.in/CUET-PG" }
    ], note: "Entrance for M.Sc. at central and participating universities." },
    { exam: "Recruiters — official career pages", org: "PSUs & Government", links: [
      { label: "ONGC — recruitment notices", url: "https://www.ongcindia.com/web/eng/career/recruitment-notice" },
      { label: "Geological Survey of India", url: "https://www.gsi.gov.in" },
      { label: "Central Ground Water Board", url: "https://cgwb.gov.in" },
      { label: "NMDC careers", url: "https://www.nmdc.co.in" },
      { label: "Coal India careers", url: "https://www.coalindia.in" },
      { label: "Oil India careers", url: "https://www.oil-india.com" }
    ], note: "Always verify dates and eligibility on the official page before applying." }
  ],

  // ---- Free class videos. Either set youtube: "<video id>" (recommended — upload as Unlisted on your channel)
  // or file: "<path relative to the site folder>" for a local .mp4 kept next to the site.
  videos: [
    { id: "optical-mineralogy", title: "Optical Mineralogy — GSA class", topic: "Mineralogy", description: "Full-length class on optical mineralogy: refractive index, relief, birefringence, extinction and interference figures.", youtube: "", file: "../Class videos/GSA optical Mineralogy.mp4" },
    { id: "sedimentology", title: "Sedimentology — GSA class", topic: "Sedimentology", description: "Full-length class on sedimentology: textures, structures, depositional environments and facies.", youtube: "", file: "../Class videos/SEDIMENTOLOGY CLASS.mp4" }
  ],

  // Fill in your actual faculty. Leave empty to hide the section.
  faculty: [],

  faqs: [
    { q: "Are the mock tests really free?", a: "Yes. Every test listed under Free Test Series can be attempted without payment. Create a free account to save your scores and track progress." },
    { q: "Where do the paid batches run?", a: "On the Classplus app — install it from the Play Store or use the web link and org code shown on the Courses page. Enquire with us and we'll add you to the batch." },
    { q: "Is negative marking applied?", a: "Yes — most tests follow the +4 / −1 pattern used by ONGC and similar exams. The marking scheme is shown before you start each test." },
    { q: "Can I re-attempt a test?", a: "Yes, as many times as you like. Your dashboard keeps every attempt so you can see improvement over time." },
    { q: "How do classes run?", a: "Classes are online (live sessions plus recordings) on Classplus. Use the enquiry form or Telegram and we will share the current batch schedule." }
  ],

  // Default notices shown on the home page (admins can add more from the Admin panel).
  notices: [
    { id: "cgs2027", date: "2026-09-13", title: "UPSC Combined Geo-Scientist 2027 — apply by 22 Sept", text: "127 posts (GSI Geologist/Asst. Geologist/Geophysicist/Chemist + CGWB Scientist-B). Prelims 10 Jan 2027. See the Vacancies page for details and the official link." },
    { id: "welcome", date: "2026-09-13", title: "Free Test Series is live", text: "Three full-length mock tests — two Geology (Hard) sets and a complete ONGC Geologist CBT — are now open to everyone. Sign up to save your scores." }
  ]
};
