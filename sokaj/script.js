(() => {
  'use strict';

  /* ---- song data ---------------------------------------------------
     Drop the actual no-vocal / instrumental audio files into
     assets/audio/ using these exact filenames and everything wires
     up automatically. Until then, the site still works — it just
     silently skips playback if a file 404s.
  --------------------------------------------------------------------*/
  const SONGS = {
    '6l3brasi':       { title: '6L3 Brasi',        cover: 'assets/covers/6l3-brasi.jpg',      audio: 'assets/audio/6l3-brasi-instrumental.mp3' },
    '7asiseni':       { title: '7asis Eni',         cover: 'assets/covers/7asis-eni.jpg',      audio: 'assets/audio/7asis-eni-instrumental.mp3' },
    'meenhad':        { title: 'Meen Had',          cover: 'assets/covers/meen-had.jpg',       audio: 'assets/audio/meen-had-instrumental.mp3' },
    'alalamalahmar':  { title: 'El 3alam El A7mar', cover: 'assets/covers/alalam-alahmar.jpg', audio: 'assets/audio/alalam-alahmar-instrumental.mp3' },
  };
  const DEFAULT_SONG = '6l3brasi';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---- nav scroll state ---------------------------------------- */
  const siteNav = $('#siteNav');
  const heroLogo = $('#heroLogo');
  const hero = $('.hero');

  function onScroll() {
    const scrolled = window.scrollY > 40;
    siteNav.classList.toggle('scrolled', scrolled);

    // shrink + fade the hero logo as it scrolls past, so it visually
    // hands off to the small nav logo that fades in via CSS
    // (guarded: sub-pages like concert galleries / credits have no hero)
    if (hero && heroLogo) {
      const heroH = hero.offsetHeight || 1;
      const progress = Math.min(Math.max(window.scrollY / (heroH * 0.6), 0), 1);
      heroLogo.style.transform = `scale(${1 - progress * 0.35}) translateY(${progress * -30}px)`;
      heroLogo.style.opacity = `${1 - progress}`;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- hamburger / slide menu ------------------------------------ */
  const hamburger = $('#hamburger');
  const navMenu = $('#navMenu');
  const menuScrim = $('#menuScrim');
  const menuClose = $('#menuClose');

  function setMenu(open) {
    hamburger.setAttribute('aria-expanded', String(open));
    navMenu.classList.toggle('open', open);
    menuScrim.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  hamburger.addEventListener('click', () => setMenu(!navMenu.classList.contains('open')));
  menuScrim.addEventListener('click', () => setMenu(false));
  menuClose.addEventListener('click', () => setMenu(false));
  $$('.menu-link').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---- back to top ------------------------------------------------ */
  $('#backTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---- theme song system ------------------------------------------
     Two stacked blurred-cover layers crossfade so switching songs
     never shows a flash of bare background.
  --------------------------------------------------------------------*/
  const bgLayers = [$('#bgA'), $('#bgB')];
  let activeLayer = 0;
  const audioEl = $('#themeAudio');
  const playPauseBtn = $('#playPauseBtn');
  const themeToggle = $('#themeToggle');
  const themeToggleCurrent = $('#themeToggleCurrent');
  const themeMenu = $('#themeMenu');

  let currentSong = null;
  let userHasInteracted = false; // real playback only ever starts from a gesture
  let pendingResumeTime = 0; // resume position not yet guaranteed to be applied
  let playToken = 0; // bumped on every selectSong() call; lets stale async callbacks detect they've been superseded

  // iOS Safari (and all iOS browsers — they're WebKit under the hood)
  // requires a real user gesture on *this* page load before unmuted
  // audio.play() is allowed. Used to decide whether to show the
  // tap-to-resume pill after a blocked boot autoplay attempt.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+

  // Thin localStorage wrapper: never throws, and — unlike a bare
  // try/catch that silently eats failures — warns once per key so a
  // browsing context where storage is blocked/unavailable (private
  // mode, file:// testing, disabled cookies, etc.) is debuggable
  // instead of just quietly falling back to DEFAULT_SONG on every
  // navigation with no trace of why.
  const safeStorage = (() => {
    const warned = new Set();
    function warn(key, e) {
      if (warned.has(key)) return;
      warned.add(key);
      console.warn(`[sokaj] localStorage unavailable for "${key}" — theme song / playback position will not persist across pages in this browsing context.`, e);
    }
    return {
      get(key) {
        try { return localStorage.getItem(key); } catch (e) { warn(key, e); return null; }
      },
      set(key, value) {
        try { localStorage.setItem(key, value); return true; } catch (e) { warn(key, e); return false; }
      },
    };
  })();

  function setBackground(coverUrl) {
    const next = bgLayers[1 - activeLayer];
    const prev = bgLayers[activeLayer];
    next.style.backgroundImage = `url('${coverUrl}')`;
    // force a reflow before toggling classes — on some mobile browsers
    // (older Android WebViews especially) a background-image change and
    // a class-driven opacity transition landing in the same frame can
    // get coalesced/dropped, leaving the layer stuck on its old paint.
    void next.offsetHeight;
    next.classList.add('is-active');
    prev.classList.remove('is-active');
    activeLayer = 1 - activeLayer;
  }

  function setPlayingUI(key) {
    $$('.track').forEach(t => t.classList.toggle('is-playing', t.dataset.song === key));
    themeToggleCurrent.textContent = SONGS[key].title;
    $$('#themeMenu li').forEach(li => li.setAttribute('aria-selected', String(li.dataset.song === key)));
  }

  function syncPlayPauseUI() {
    const isPlaying = !audioEl.paused;
    playPauseBtn.setAttribute('aria-pressed', String(isPlaying));
    playPauseBtn.setAttribute('aria-label', isPlaying ? 'Pause theme song' : 'Play theme song');
  }

  // persist playback state so it can carry over to other pages
  // (about-me.html, concert galleries) and across reloads.
  function persistAudioState() {
    safeStorage.set('sokajAudioSrc', audioEl.currentSrc || audioEl.src);
    safeStorage.set('sokajAudioTime', String(audioEl.currentTime || 0));
    safeStorage.set('sokajAudioPlaying', String(!audioEl.paused && userHasInteracted));
  }

  // Only persist on the interval/play/pause events while this tab is
  // actually in the foreground. A backgrounded tab's periodic ticks
  // used to be able to clobber a different (foreground) tab's fresher
  // localStorage writes with its own stale state. pagehide/visibility
  // "hidden" still always write immediately, below, so a real exit or
  // backgrounding event is never missed — this only silences the
  // redundant while-hidden polling that caused cross-tab stomping.
  function persistIfForeground() {
    if (!document.hidden) persistAudioState();
  }

  function applyPendingResumeTime(audio) {
    if (pendingResumeTime <= 0) return;
    if (audio.readyState >= 1 /* HAVE_METADATA: duration/seekable range known */) {
      try { audio.currentTime = pendingResumeTime; } catch (e) {}
      pendingResumeTime = 0;
    }
    // else: metadata isn't loaded yet (preload="none" + not yet played).
    // Leave pendingResumeTime set — the loadedmetadata listener
    // registered in selectSong() below will finish the job once the
    // browser actually knows the media's duration. This is the only
    // place pendingResumeTime gets cleared, so the play/pause button's
    // early call and the loadedmetadata-driven call can never race each
    // other into losing the resume position.
  }

  function selectSong(key, { attemptPlay = true, resumeTime = 0 } = {}) {
    if (!SONGS[key]) return;
    currentSong = key;

    // Persist the song choice FIRST, before any DOM/rendering work
    // below. Song identity should never be lost just because a later
    // rendering step throws or a storage write silently no-ops — and
    // this ordering means a failure downstream can't prevent the one
    // write that actually matters for cross-page continuity.
    safeStorage.set('sokajThemeSong', key);

    setBackground(SONGS[key].cover);
    setPlayingUI(key);

    // Bump the token so any still-in-flight play()/then()/catch() from
    // a previous selectSong() call knows it's been superseded and
    // should no longer touch shared state like audioEl.muted.
    const myToken = ++playToken;

    audioEl.src = SONGS[key].audio;
    pendingResumeTime = resumeTime;

    // Always listen for metadata (not just when resumeTime > 0) so a
    // resume position applied late by applyPendingResumeTime (e.g. from
    // the play/pause button, before metadata was ready) still gets
    // finished off here. Self-removing and token-guarded so a listener
    // left over from a superseded song selection can't act on the
    // wrong audio resource.
    audioEl.addEventListener('loadedmetadata', function onMeta() {
      audioEl.removeEventListener('loadedmetadata', onMeta);
      if (myToken !== playToken) return; // a newer song was selected since
      applyPendingResumeTime(audioEl);
    });

    function beginPlayback() {
      // Browsers block autoplay-with-sound on every fresh page load,
      // even if the user already unmuted audio on a previous page —
      // that "unlock" doesn't carry over across navigations. Starting
      // muted is always allowed, so we do that, then unmute the
      // instant playback actually begins.
      //
      // Deliberately gated on userHasInteracted alone, NOT on the
      // audioEl's current .muted value — reading current .muted here
      // was the source of a real bug: if a second selectSong() call
      // fired while a first one's play() was still pending, the second
      // call would see .muted left `true` by the first call and
      // conclude (wrongly) that it shouldn't unmute after success,
      // leaving audio stuck muted indefinitely.
      const wantsAudible = userHasInteracted;
      if (wantsAudible) audioEl.muted = true;

      const p = audioEl.play();
      if (p && p.then) {
        p.then(() => {
          if (myToken !== playToken) return; // superseded by a newer selectSong() call
          if (wantsAudible) audioEl.muted = false;
          // iOS sometimes resolves play() but silently keeps it muted/
          // paused without a fresh gesture — verify shortly after.
          if (isIOS) {
            setTimeout(() => {
              if (myToken !== playToken) return;
              if (audioEl.paused || audioEl.muted) showResumePill();
            }, 300);
          }
        }).catch(() => {
          // A rejection here can mean a real autoplay block, OR simply
          // that this call's src got aborted by a newer selectSong()
          // call (AbortError) — not a genuine failure. Only react if
          // this call is still the current one.
          if (myToken !== playToken) return;
          if (isIOS) showResumePill();
        });
      }
    }

    if (attemptPlay) {
      if (resumeTime > 0) {
        // Don't call play() until the resume seek has actually landed.
        // Firing play() immediately and applying the seek later (from
        // the loadedmetadata listener above) is a race: on a file that
        // takes a little longer to reach playable state, the browser
        // can start rendering audible samples from 0:00 before the
        // seek lands, so playback briefly starts from the beginning
        // (or the wrong point) before jumping — even though the label
        // already shows the correct song. Waiting for 'seeked' (which
        // only fires once currentTime has actually been applied)
        // closes that window regardless of file size or buffering
        // speed.
        const onSeeked = function() {
          audioEl.removeEventListener('seeked', onSeeked);
          if (myToken !== playToken) return; // superseded since
          beginPlayback();
        };
        audioEl.addEventListener('seeked', onSeeked);

        // The <audio> elements are preload="none", so nothing is
        // actually fetched — and loadedmetadata never fires — until
        // something explicitly demands the resource. That used to be
        // play(), called immediately, as a side effect. Now that
        // play() is deliberately deferred until the seek lands, we
        // have to kick off the fetch ourselves, or the whole chain
        // (loadedmetadata -> seek -> 'seeked' -> beginPlayback) simply
        // never starts and playback stays silently paused forever.
        audioEl.load();
      } else {
        beginPlayback();
      }
    }
    persistAudioState();
    syncPlayPauseUI();
  }

  function showResumePill() {
    if (document.getElementById('audioResumePill')) return;
    const pill = document.createElement('button');
    pill.id = 'audioResumePill';
    pill.type = 'button';
    pill.textContent = '🔊 Resume music';
    pill.setAttribute('aria-label', 'Resume theme song');
    Object.assign(pill.style, {
      position: 'fixed',
      bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '9999',
      padding: '10px 18px',
      borderRadius: '999px',
      border: '1px solid rgba(242,237,226,.3)',
      background: 'rgba(10,10,10,.75)',
      color: '#f2ede2',
      fontFamily: "'Archivo', sans-serif",
      fontSize: '.85rem',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      cursor: 'pointer'
    });
    // route through the exact same code path as the play/pause button,
    // so the two controls are never out of sync with each other
    pill.addEventListener('click', () => {
      pill.remove();
      playPauseBtn.click();
    }, { once: true });
    document.body.appendChild(pill);
  }

  audioEl.addEventListener('play', () => { persistIfForeground(); syncPlayPauseUI(); });
  audioEl.addEventListener('pause', () => { persistIfForeground(); syncPlayPauseUI(); });
  audioEl.addEventListener('error', () => {
    // 404s/decoding failures already fail silently for the user by
    // design (play() rejects, 'pause' event fires, UI self-corrects via
    // syncPlayPauseUI) — this is just so it's not a silent mystery in
    // devtools if a file is ever missing.
    console.warn('[sokaj] theme song failed to load:', currentSong && SONGS[currentSong] && SONGS[currentSong].audio);
  });
  setInterval(persistIfForeground, 2000);

  // Always write final state on a real unload/navigation, regardless of
  // visibility (this is the tab's one chance to record true state).
  window.addEventListener('pagehide', persistAudioState);

  // Supplement to pagehide: catches abrupt backgrounding (app-switch,
  // OS reclaiming a background tab/process) where pagehide may never
  // fire at all, especially in iOS Safari / in-app browsers. Writing on
  // "hidden" also means a backgrounded tab stops relying on the 2s
  // interval (now visibility-gated) to keep its last state fresh.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persistAudioState();
  });

  // bfcache restore: the script does NOT re-run when a page is restored
  // from the back/forward cache (it's frozen JS state, not a fresh
  // execution), so without this the page would keep showing/playing
  // whatever song was current when the user navigated away, ignoring
  // any song change made on other pages since. Re-running the boot
  // logic reconciles it against whatever is currently in localStorage.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) bootFromStorage();
  });

  // dropdown open/close
  function setThemeMenu(open) {
    themeToggle.setAttribute('aria-expanded', String(open));
    themeMenu.classList.toggle('open', open);
  }
  themeToggle.addEventListener('click', () => setThemeMenu(!themeMenu.classList.contains('open')));
  document.addEventListener('click', e => {
    if (!e.target.closest('.theme-picker')) setThemeMenu(false);
  });
  $$('#themeMenu li').forEach(li => {
    li.addEventListener('click', () => {
      markInteracted();
      selectSong(li.dataset.song);
      setThemeMenu(false);
    });
  });

  // track-list "play as theme song" buttons
  $$('.play-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      markInteracted();
      selectSong(btn.dataset.song);
    });
  });

  function markInteracted() {
    if (userHasInteracted) return;
    userHasInteracted = true;
  }

  // play/pause button — lightning bolt: whole + lit while playing,
  // broken in half while paused
  playPauseBtn.addEventListener('click', () => {
    markInteracted();
    if (audioEl.paused) {
      // If metadata isn't loaded yet, this safely no-ops without losing
      // pendingResumeTime — the loadedmetadata listener registered in
      // selectSong() will finish applying it once the browser knows the
      // media's duration (see applyPendingResumeTime for why).
      applyPendingResumeTime(audioEl);
      audioEl.muted = false;
      const p = audioEl.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      audioEl.pause();
    }
  });

  /* ---- boot: never autoplay on a fresh visit ----------------------
     Only resume automatically if the user had already started
     playback earlier (this session or a previous visit/page).
     Pulled into a function so it can also re-run on bfcache restore
     (see the 'pageshow' listener above).
  --------------------------------------------------------------------*/
  function bootFromStorage() {
    let bootSong = DEFAULT_SONG;
    let resumeTime = 0;
    let wasPlaying = false;

    const savedSong = safeStorage.get('sokajThemeSong');
    if (savedSong && SONGS[savedSong]) bootSong = savedSong;
    resumeTime = parseFloat(safeStorage.get('sokajAudioTime') || '0') || 0;
    wasPlaying = safeStorage.get('sokajAudioPlaying') === 'true';

    if (wasPlaying) userHasInteracted = true;

    selectSong(bootSong, {
      attemptPlay: wasPlaying,
      resumeTime: resumeTime, // preserve position whether it was playing or paused
    });
  }

  bootFromStorage();

})();

/* ---- site-wide language toggle -------------------------------- */
(() => {
  const btn = document.getElementById('aboutLangToggle');
  const en = document.getElementById('aboutTextEn');
  const ar = document.getElementById('aboutTextAr');
  const messageSub = document.getElementById('messageSub');
  if (!btn || !en || !ar) return;

  function applyLang(lang) {
    const isAr = lang === 'ar';
    en.hidden = isAr;
    ar.hidden = !isAr;
    btn.dataset.lang = isAr ? 'ar' : 'en';
    btn.textContent = isAr ? 'English' : 'عربي';

    if (messageSub) {
      messageSub.textContent = isAr ? messageSub.dataset.ar : messageSub.dataset.en;
      messageSub.lang = isAr ? 'ar' : 'en';
    }

    try { localStorage.setItem('sokajLang', isAr ? 'ar' : 'en'); } catch (e) {}
  }

  btn.addEventListener('click', () => {
    applyLang(btn.dataset.lang === 'en' ? 'ar' : 'en');
  });

  let savedLang = 'en';
  try {
    const saved = localStorage.getItem('sokajLang');
    if (saved === 'ar' || saved === 'en') savedLang = saved;
  } catch (e) {}
  applyLang(savedLang);
})();

/* ---- no-flash image fade-in for lazy-loaded photos ---------------- */
(() => {
  const markLoaded = (img) => img.classList.add('is-loaded');

  const imgs = document.querySelectorAll(
    '.track-art img, .member-photo img, .concert-card-bg'
  );

  imgs.forEach((img) => {
    if (img.complete && img.naturalWidth > 0) {
      markLoaded(img);
    } else {
      img.addEventListener('load', () => markLoaded(img), { once: true });
      img.addEventListener('error', () => markLoaded(img), { once: true });
    }
  });
})();
