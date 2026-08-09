# Security Notes

Manual steps and context that can't be fixed by editing code. Read this
before assuming a finding is "done" just because a file changed.

## 1. Rate-limiting / abuse mitigation on the public message form

**What's in the code now:**
- Firebase App Check (reCAPTCHA v3) is active in both `message.js` and
  `admin.js` via `firebase.appCheck().activate(...)`. This is the real
  defense against scripted abuse — it proves writes are coming from a
  real browser on the real site.
- `message.js` now also has a **client-side 30-second resubmit cooldown**
  (localStorage-based, disables the submit button with a countdown).
  This is explicitly **not a security control** — it's a UX speed bump
  against accidental double-submits. Anyone can bypass it by clearing
  localStorage, opening a private window, or writing to Firestore
  directly with the client SDK. Don't treat it as rate-limiting in any
  threat model.

**What real rate-limiting requires (neither is implemented — pick one if
you want actual server-side limits):**
1. **A Cloud Function proxy in front of Firestore writes** — the public
   form would call an HTTPS Cloud Function instead of writing to
   Firestore directly; the function enforces per-IP or per-token limits
   (e.g. via Firestore-backed counters or a small in-memory/Redis store)
   before writing. This is the only way to get a real, server-enforced
   limit for a client that has direct Firestore write access today.
2. **App Check enforcement + monitoring**, which you already have wired
   in code — but wiring in code is not the same as it being enforced.

**Action required from you (cannot be done from this repo):**
- [ ] Log into the Firebase console → **App Check** → confirm Cloud
      Firestore shows **Enforced**, not just "Monitoring" or unconfigured.
      If it's not set to Enforced, an attacker who skips App Check
      entirely (calls the Firestore REST API directly) bypasses your
      only real defense — the client-side cooldown will not stop them.
  - Console → build → Firestore Database → your project → App Check tab,
    or App Check → APIs → Cloud Firestore.
- [ ] Optionally set up App Check metrics/alerts so a spike in rejected
      requests (or a spike in *accepted* requests) notifies you.

If you decide you need real rate-limiting later, the Cloud Function
proxy is the way to go — happy to build that as an `optional/` add-on
if/when you want it (kept out of the default deploy per your constraint).

## 2. Admin account hardening (manual — Google/Firebase console only)

None of this can be done from code or by an AI assistant with repo
access. Checklist for you to run through directly:

- [ ] **PRIORITY — confirm Firebase Authentication's built-in
      brute-force/abuse protection is enabled** — console →
      Authentication → Settings → look for the abuse/brute-force
      protection toggle (naming varies by console version; may be
      bundled under a broader "App Check enforcement for
      Authentication" setting). This is the only real defense against
      someone scripting rapid password guesses against
      `sokajwiki@gmail.com` — the client-side lockout added to
      `admin.js` (below) is bypassable and not a substitute for this.
      Treat this as the single highest-priority item in this whole
      document — until it's confirmed on, the admin login has no
      real protection against brute-force at all.
- [ ] Enable 2-Step Verification (2FA/MFA) on the Google account
      `sokajwiki@gmail.com` — myaccount.google.com → Security →
      2-Step Verification.
- [ ] Check whether Firebase Authentication supports MFA for this
      project's sign-in method and enable it if so — console →
      Authentication → Settings → Multi-factor authentication. (Email/
      password sign-in in Firebase Auth has more limited native MFA
      support than some other providers — confirm current availability
      for your project's plan in the console, since this changes over
      time.)
- [ ] Rotate the admin password to something long and unique (password
      manager–generated, not reused anywhere else) — console →
      Authentication → Users → the `sokajwiki@gmail.com` user → reset,
      or via "forgot password" on the admin login page.

**What's in the code now:** `admin.js` has a client-side login lockout —
after 3 failed attempts it starts blocking further tries with
exponential backoff (5s, 10s, 20s... capped at 5 minutes), tracked in
localStorage. Same caveat as the message-form cooldown: this is **not a
security control**. It's bypassed by clearing localStorage, a private
window, or scripting `signInWithEmailAndPassword` directly instead of
clicking the button. Its only purpose is to slow down casual/manual
attempts and cut down on failed-login noise — it does nothing against a
real scripted attacker. The platform-level check above is what actually
matters.

## 3. Verifying deployed Firestore rules match the repo

**Finding:** no deploy script, GitHub Action, or `firebase.json` existed
anywhere in this repo before this change — meaning there was no
automated or documented way to confirm the `firestore.rules` file here
is actually what's live in the Firebase console. Rules could drift
silently (e.g. someone edits rules directly in the console during
debugging and forgets to sync back).

**What was added:** a minimal scaffold so the Firebase CLI knows what to
deploy and where:
- `firebase.json` — scopes deploys to just the Firestore rules file
  (`firestore.rules`). Doesn't touch hosting, functions, or anything
  else — deploying with this config can't accidentally push something
  unrelated.
- `.firebaserc` — points the CLI at the `sokaj-messages` project by
  default, so you don't have to pass `--project` every time.

**Action required from you (not run automatically — no Firebase CLI
credentials were provided to this session, and this should stay a
deliberate manual step, not something automated into CI without your
sign-off):**
- [ ] Install the Firebase CLI if you don't have it: `npm install -g
      firebase-tools`.
- [ ] `firebase login` (one-time, opens a browser to auth as
      `sokajwiki@gmail.com`).
- [ ] From the repo root, run: `firebase deploy --only firestore:rules`
- [ ] Confirm the CLI reports success, then spot-check in the console
      (Firestore Database → Rules tab) that the rules shown there match
      `firestore.rules` in this repo.
- [ ] Repeat this any time you edit `firestore.rules` locally — editing
      the file alone does nothing to production until this is run.

Consider later wiring this into a GitHub Action on push to `main` (using
a Firebase CI token or Workload Identity) once the site has an actual
GitHub repo — deliberately not doing that now since no CI/CD exists yet
and it's a bigger change than "fix these findings."
