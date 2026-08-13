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

  // iOS Safari (and all iOS browsers — they're WebKit under the hood)
  // requires a real user gesture on *this* page load before unmuted
  // audio.play() is allowed. Used to decide whether to show the
  // tap-to-resume pill after a blocked boot autoplay attempt.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+

  function setBackground(coverUrl) {
    const next = bgLayers[1 - activeLayer];
    const prev = bgLayers[activeLayer];
    next.style.backgroundImage = `url('${coverUrl}')`;
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
    try {
      localStorage.setItem('sokajAudioSrc', audioEl.currentSrc || audioEl.src);
      localStorage.setItem('sokajAudioTime', String(audioEl.currentTime || 0));
      localStorage.setItem('sokajAudioPlaying', String(!audioEl.paused && userHasInteracted));
    } catch (e) {}
  }

  function applyPendingResumeTime(audio) {
    if (pendingResumeTime > 0) {
      try { audio.currentTime = pendingResumeTime; } catch (e) {}
      pendingResumeTime = 0;
    }
  }

  function selectSong(key, { attemptPlay = true, resumeTime = 0 } = {}) {
    if (!SONGS[key]) return;
    currentSong = key;
    setBackground(SONGS[key].cover);
    setPlayingUI(key);

    try { localStorage.setItem('sokajThemeSong', key); } catch (e) {}

    audioEl.src = SONGS[key].audio;
    pendingResumeTime = resumeTime;

    if (resumeTime > 0) {
      const setTime = () => {
        // only seek if nothing has consumed/overridden it since (e.g.
        // the play/pause button already applied + cleared it)
        if (pendingResumeTime > 0) applyPendingResumeTime(audioEl);
        audioEl.removeEventListener('loadedmetadata', setTime);
      };
      audioEl.addEventListener('loadedmetadata', setTime);
    }

    if (attemptPlay) {
      // Browsers block autoplay-with-sound on every fresh page load,
      // even if the user already unmuted audio on a previous page —
      // that "unlock" doesn't carry over across navigations. Starting
      // muted is always allowed, so we do that, then unmute the
      // instant playback actually begins.
      const shouldUnmuteAfter = userHasInteracted && !audioEl.muted;
      if (shouldUnmuteAfter) audioEl.muted = true;

      const p = audioEl.play();
      if (p && p.then) {
        p.then(() => {
          if (shouldUnmuteAfter) audioEl.muted = false;
          // iOS sometimes resolves play() but silently keeps it muted/
          // paused without a fresh gesture — verify shortly after.
          if (isIOS) {
            setTimeout(() => {
              if (audioEl.paused || audioEl.muted) showResumePill();
            }, 300);
          }
        }).catch(() => {
          if (isIOS) showResumePill();
        });
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

  audioEl.addEventListener('play', () => { persistAudioState(); syncPlayPauseUI(); });
  audioEl.addEventListener('pause', () => { persistAudioState(); syncPlayPauseUI(); });
  setInterval(persistAudioState, 2000);
  window.addEventListener('pagehide', persistAudioState);

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
      // if a resume position never got applied (blocked autoplay meant
      // this is the first real play attempt), apply it now, once, right
      // before playing — never after, so it can't yank the position
      // after playback has already audibly started.
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
  --------------------------------------------------------------------*/
  let bootSong = DEFAULT_SONG;
  let resumeTime = 0;
  let wasPlaying = false;
  try {
    const savedSong = localStorage.getItem('sokajThemeSong');
    if (savedSong && SONGS[savedSong]) bootSong = savedSong;
    resumeTime = parseFloat(localStorage.getItem('sokajAudioTime') || '0') || 0;
    wasPlaying = localStorage.getItem('sokajAudioPlaying') === 'true';
  } catch (e) {}

  if (wasPlaying) userHasInteracted = true;

  selectSong(bootSong, {
    attemptPlay: wasPlaying,
    resumeTime: resumeTime, // preserve position whether it was playing or paused
  });

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
