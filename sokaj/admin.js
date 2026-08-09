(() => {
  'use strict';

  firebase.initializeApp(firebaseConfig);

  // App Check — proves this request is coming from the real admin page,
  // not a script hitting Firestore directly. Required since App Check
  // enforcement is turned on for Cloud Firestore in the Firebase console —
  // without this, every request (including logged-in reads) gets rejected.
  if (RECAPTCHA_V3_SITE_KEY && !RECAPTCHA_V3_SITE_KEY.startsWith('PASTE_')) {
    firebase.appCheck().activate(RECAPTCHA_V3_SITE_KEY, true);
  }

  const auth = firebase.auth();
  const db = firebase.firestore();

  const loginBox = document.getElementById('loginBox');
  const appBox = document.getElementById('appBox');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');
  const signOutBtn = document.getElementById('signOut');
  const messagesList = document.getElementById('messagesList');
  const emptyEl = document.getElementById('empty');
  const countLabel = document.getElementById('countLabel');

  const PAGE_SIZE = 50;
  let unsubscribe = null;
  let lastDoc = null;      // cursor for "load more"
  let allLoaded = false;
  let loadMoreBtn = null;

  // --- Client-side login lockout ----------------------------------------
  // NOT a security control — this runs entirely in the visitor's browser
  // (localStorage-based) and is trivially bypassed by clearing storage,
  // a private window, or scripting Firebase Auth directly. Its only
  // purpose is to slow down casual/manual brute-force attempts and cut
  // down on failed-login noise. The real defense against credential
  // stuffing / brute force is Firebase Authentication's own built-in
  // abuse protection — confirm that's enabled in the console (see
  // SECURITY-NOTES.md, item 2). Do not treat this as sufficient on its
  // own.
  const LOCKOUT_KEY = 'sokaj_admin_login_state'; // { failCount, lockedUntil }
  const BASE_LOCKOUT_MS = 5_000;   // 5s after 1st fail-streak lockout trigger
  const MAX_LOCKOUT_MS = 5 * 60_000; // cap at 5 minutes
  const FAILS_BEFORE_LOCKOUT = 3;  // allow a few tries before any delay

  function getLockoutState() {
    try {
      return JSON.parse(localStorage.getItem(LOCKOUT_KEY)) || { failCount: 0, lockedUntil: 0 };
    } catch {
      return { failCount: 0, lockedUntil: 0 };
    }
  }

  function setLockoutState(state) {
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state));
  }

  function remainingLockoutSeconds() {
    const { lockedUntil } = getLockoutState();
    return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
  }

  function applyLockoutUI() {
    const remaining = remainingLockoutSeconds();
    if (remaining <= 0) {
      loginBtn.disabled = false;
      return;
    }
    loginBtn.disabled = true;
    loginError.textContent = `Too many attempts — wait ${remaining}s.`;
    setTimeout(() => {
      if (remainingLockoutSeconds() <= 0) {
        loginBtn.disabled = false;
        loginError.textContent = '';
      } else {
        applyLockoutUI();
      }
    }, 1000);
  }

  function recordFailedAttempt() {
    const state = getLockoutState();
    state.failCount = (state.failCount || 0) + 1;
    if (state.failCount >= FAILS_BEFORE_LOCKOUT) {
      // Exponential backoff per extra fail past the threshold, capped.
      const extra = state.failCount - FAILS_BEFORE_LOCKOUT;
      const delay = Math.min(BASE_LOCKOUT_MS * Math.pow(2, extra), MAX_LOCKOUT_MS);
      state.lockedUntil = Date.now() + delay;
    }
    setLockoutState(state);
  }

  function recordSuccessfulLogin() {
    setLockoutState({ failCount: 0, lockedUntil: 0 });
  }

  // Restore lockout UI on page load (e.g. visitor refreshed mid-lockout).
  applyLockoutUI();

  loginBtn.addEventListener('click', async () => {
    if (remainingLockoutSeconds() > 0) {
      applyLockoutUI();
      return;
    }
    loginError.textContent = '';
    try {
      await auth.signInWithEmailAndPassword(emailInput.value.trim(), passwordInput.value);
      recordSuccessfulLogin();
    } catch (err) {
      recordFailedAttempt();
      if (remainingLockoutSeconds() > 0) {
        applyLockoutUI();
      } else {
        loginError.textContent = 'Wrong email or password.';
      }
    }
  });

  passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') loginBtn.click(); });

  signOutBtn.addEventListener('click', () => auth.signOut());

  auth.onAuthStateChanged(user => {
    if (user) {
      loginBox.style.display = 'none';
      appBox.style.display = 'block';
      listenForMessages();
    } else {
      loginBox.style.display = 'flex';
      appBox.style.display = 'none';
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    }
  });

  function fmtTime(ts) {
    if (!ts) return 'just now';
    const d = ts.toDate();
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function renderCard(doc) {
    const data = doc.data();
    const card = document.createElement('div');
    card.className = 'msg-card' + (data.read ? '' : ' unread');
    card.innerHTML = `
      <div class="msg-card-head">
        <span class="msg-name">${escapeHtml(data.name || 'Anonymous')}</span>
        <span class="msg-time">${fmtTime(data.timestamp)}</span>
      </div>
      <div class="msg-body">${escapeHtml(data.message || '')}</div>
      <div class="msg-actions">
        ${data.read ? '' : '<button class="read-btn">Mark read</button>'}
        <button class="del-btn">Delete</button>
      </div>
    `;
    const readBtn = card.querySelector('.read-btn');
    if (readBtn) readBtn.addEventListener('click', () => doc.ref.update({ read: true }));
    card.querySelector('.del-btn').addEventListener('click', () => {
      if (confirm('Delete this message?')) doc.ref.delete();
    });
    return card;
  }

  function ensureLoadMoreBtn() {
    if (loadMoreBtn) return loadMoreBtn;
    loadMoreBtn = document.createElement('button');
    loadMoreBtn.id = 'loadMoreBtn';
    loadMoreBtn.textContent = 'Load more';
    loadMoreBtn.style.cssText = 'display:block;margin:16px auto 0;background:transparent;' +
      'border:1px solid rgba(242,237,226,.2);color:var(--ash);padding:10px 20px;font-size:.8rem;';
    loadMoreBtn.addEventListener('click', loadMore);
    return loadMoreBtn;
  }

  async function loadMore() {
    if (!lastDoc || allLoaded) return;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = 'Loading…';

    const snap = await db.collection('messages')
      .orderBy('timestamp', 'desc')
      .startAfter(lastDoc)
      .limit(PAGE_SIZE)
      .get();

    if (snap.empty) {
      allLoaded = true;
      loadMoreBtn.remove();
      return;
    }

    snap.forEach(doc => messagesList.appendChild(renderCard(doc)));
    lastDoc = snap.docs[snap.docs.length - 1];

    if (snap.size < PAGE_SIZE) {
      allLoaded = true;
      loadMoreBtn.remove();
    } else {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Load more';
      messagesList.after(loadMoreBtn);
    }
  }

  function listenForMessages() {
    // Live listener only on the most recent page — keeps new messages
    // appearing instantly without re-fetching the whole collection.
    unsubscribe = db.collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(PAGE_SIZE)
      .onSnapshot(snap => {
        messagesList.innerHTML = '';
        if (loadMoreBtn) { loadMoreBtn.remove(); loadMoreBtn = null; }
        allLoaded = false;

        if (snap.empty) {
          emptyEl.style.display = 'block';
          countLabel.textContent = '';
          return;
        }
        emptyEl.style.display = 'none';
        countLabel.textContent = `${snap.size}${snap.size === PAGE_SIZE ? '+' : ''} message${snap.size === 1 ? '' : 's'}`;

        snap.forEach(doc => messagesList.appendChild(renderCard(doc)));
        lastDoc = snap.docs[snap.docs.length - 1];

        if (snap.size === PAGE_SIZE) {
          messagesList.after(ensureLoadMoreBtn());
        }
      });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
