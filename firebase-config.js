// Firebase project config for the Sokaj fan site.
// The apiKey here is safe to expose client-side — Firebase access control
// is enforced by Firestore security rules (see firestore.rules), not by
// hiding this key.
const firebaseConfig = {
  apiKey: "AIzaSyACdAhrubwP31jAZp51UqYWBL3S37C9xi8",
  authDomain: "sokaj-messages.firebaseapp.com",
  projectId: "sokaj-messages",
  storageBucket: "sokaj-messages.firebasestorage.app",
  messagingSenderId: "319504646442",
  appId: "1:319504646442:web:813e30f78a2e8e8defde53",
  measurementId: "G-P5QEJXSBDQ"
};

// App Check — reCAPTCHA v3 site key from Firebase console → App Check → your web app.
// Paste your real key below. This key is safe to expose client-side (same as apiKey).
const RECAPTCHA_V3_SITE_KEY = "6Ld9yHotAAAAALBjk8pzPP0B2I8SjMM2iQm3wEL7";
