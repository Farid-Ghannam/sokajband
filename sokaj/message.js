(() => {
  'use strict';

  firebase.initializeApp(firebaseConfig);

  // App Check — proves this write is coming from the real site, not a script
  // hitting Firestore directly. Runs invisibly, no user interaction needed.
  // For local testing on localhost, Firebase auto-enables debug token support —
  // check the browser console for a debug token to register in the Firebase
  // console (App Check → manage debug tokens) the first time you test locally.
  if (RECAPTCHA_V3_SITE_KEY && !RECAPTCHA_V3_SITE_KEY.startsWith('PASTE_')) {
    firebase.appCheck().activate(RECAPTCHA_V3_SITE_KEY, true);
  }

  const db = firebase.firestore();

  const form = document.getElementById('messageForm');
  const nameInput = document.getElementById('msgName');
  const textInput = document.getElementById('msgText');
  const honeypot = document.getElementById('msgWebsite');
  const submitBtn = document.getElementById('msgSubmit');
  const statusEl = document.getElementById('msgStatus');

  // --- Client-side resubmit cooldown -----------------------------------
  // NOT a security control — this is a UX-level speed bump only. It runs
  // entirely in the visitor's browser, reads/writes localStorage, and is
  // trivially bypassed by clearing storage, using a private window, or
  // calling Firestore directly. Its only purpose is to stop a normal
  // visitor from accidentally double-submitting or button-mashing; it
  // does nothing against a real abuser. Actual abuse mitigation is
  // Firebase App Check (above) plus the Firestore rules — see
  // SECURITY-NOTES.md for what real server-side rate-limiting requires.
  const COOLDOWN_MS = 30_000; // 30s between submissions
  const COOLDOWN_KEY = 'sokaj_msg_last_submit';

  function msSinceLastSubmit() {
    const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
    return Date.now() - last;
  }

  function remainingCooldownSeconds() {
    return Math.max(0, Math.ceil((COOLDOWN_MS - msSinceLastSubmit()) / 1000));
  }

  function applyCooldownUI() {
    const remaining = remainingCooldownSeconds();
    if (remaining <= 0) {
      submitBtn.disabled = false;
      return;
    }
    submitBtn.disabled = true;
    submitBtn.dataset.cooldownLabel = submitBtn.dataset.cooldownLabel || submitBtn.textContent;
    submitBtn.textContent = `Wait ${remaining}s…`;
    setTimeout(() => {
      if (remainingCooldownSeconds() <= 0) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.cooldownLabel;
      } else {
        applyCooldownUI();
      }
    }, 1000);
  }

  // Restore cooldown state on page load (e.g. visitor refreshed right
  // after sending).
  applyCooldownUI();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (msSinceLastSubmit() < COOLDOWN_MS) {
      // Shouldn't normally get here since the button is disabled, but
      // guard directly against the check being bypassed some other way
      // (e.g. programmatic form.submit()).
      applyCooldownUI();
      return;
    }

    // Honeypot: real visitors never fill this hidden field. If it's filled,
    // silently pretend it worked so the bot doesn't learn to skip this field.
    if (honeypot.value.trim() !== '') {
      form.reset();
      statusEl.textContent = 'Sent — thanks!';
      statusEl.className = 'msg-status msg-status-ok';
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      applyCooldownUI();
      return;
    }

    const name = nameInput.value.trim();
    const message = textInput.value.trim();
    if (!name || !message) return;

    submitBtn.disabled = true;
    statusEl.textContent = 'Sending…';
    statusEl.className = 'msg-status';

    try {
      await db.collection('messages').add({
        name,
        message,
        read: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
      form.reset();
      statusEl.textContent = 'Sent — thanks!';
      statusEl.className = 'msg-status msg-status-ok';
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Something went wrong — try again.';
      statusEl.className = 'msg-status msg-status-err';
    } finally {
      applyCooldownUI();
    }
  });
})();
