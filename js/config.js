// ============================================================
//  Geo Scholars Academy — site configuration
//  Edit this file to change contact details, admin logins, and
//  to switch on Firebase (real student accounts + shared data).
// ============================================================
window.GSA_CONFIG = {
  siteName: "Geo Scholars Academy",
  siteUrl: "https://geoscholarsacademy.org",
  shortName: "GSA",
  tagline: "Coaching for Geology Competitive Exams",
  city: "",                       // e.g. "Bhubaneswar, Odisha"
  address: "",                    // shown on the Contact page
  phone: "+91 84569 41639",
  whatsapp: "",                   // WhatsApp removed on request — leave empty
  email: "geoscholarsacademy@gmail.com",
  youtube: "https://youtube.com/@geoscholarsacademy",
  instagram: "https://www.instagram.com/geoscholarsacademy",
  telegram: "https://t.me/+EhBrPCtfIjRjYjc9",

  // WhatsApp groups removed on request. To bring them back, add entries here:
  // whatsappGroups: [{ label: "GSA Students Group 1", url: "https://chat.whatsapp.com/..." }],
  whatsappGroups: [],

  // Classplus (where paid batches run)
  classplus: {
    web: "https://classplusapp.com/diy",
    orgCode: "ahbgkq",
    android: "https://clpmarshal.page.link/tU6w"
  },

  // Optional: Google Analytics 4 measurement id (G-XXXXXXXXXX) for full visitor analytics.
  googleAnalyticsId: "",
  // Optional: Google Search Console "HTML tag" verification code (content="..." value).
  googleSiteVerification: "",

  // Emails that get the Admin panel. In local mode any password works
  // for these (demo). In Firebase mode they must sign up normally.
  adminEmails: ["admin@geoscholars.in", "geoscholarsacademy@gmail.com"],

  // ---- Firebase (optional) -----------------------------------
  // Leave apiKey empty to run in LOCAL MODE (everything is stored in
  // the visitor's own browser — fine for trying the site, not for real
  // students). To go live: create a free Firebase project, enable
  // Email/Password auth + Firestore, paste the web-app config here,
  // and apply the security rules in README.md.
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  }
};
