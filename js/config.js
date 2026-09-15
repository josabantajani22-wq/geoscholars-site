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

  // ---- Where enquiries are delivered -------------------------
  // Email: uses formsubmit.co (free). FIRST enquiry triggers an activation email to this address —
  // open it and click "Activate" once; after that every enquiry arrives instantly.
  enquiryEmail: "geoscholarsacademy@gmail.com",
  // Optional Telegram notification (message to your phone). Create a bot with @BotFather, add it to a
  // PRIVATE group/channel, put the bot token and that chat id here. Note: the token is visible in the
  // page source, so use a dedicated bot that is only in that private chat.
  telegramNotify: { botToken: "", chatId: "" },

  // Optional: your own hero photo (e.g. "assets/hero.jpg", a wide landscape ~1920px). Leave empty to use the
  // built-in sunrise-mountains scene.
  heroImage: "",

  // Optional: Google Analytics 4 measurement id (G-XXXXXXXXXX) for full visitor analytics.
  googleAnalyticsId: "",
  // Optional: Google Search Console "HTML tag" verification code (content="..." value).
  googleSiteVerification: "",

  // Emails that get the Admin panel. In local mode any password works
  // for these (demo). In Firebase mode they must sign up normally.
  adminEmails: ["manager@geoscholarsacademy.org", "geoscholarsacademy@gmail.com"],
  // Admin password (stored as a SHA-256 hash, not the password itself). To change it: open
  // https://emn178.github.io/online-tools/sha256.html, type the new password, paste the hash here.
  adminPasswordHash: "1d898bb885f9bf0aa2fb17f67f8873f91bad06968f6313ac437167486f74f83f",

  // Site-wide visitor counter (works without Firebase): a free public counter keyed by this name.
  visitCounterKey: "geoscholarsacademy-org",

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
