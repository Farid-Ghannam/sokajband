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
    const heroH = hero.offsetHeight || 1;
    const progress = Math.min(Math.max(window.scrollY / (heroH * 0.6), 0), 1);
    heroLogo.style.transform = `scale(${1 - progress * 0.35}) translateY(${progress * -30}px)`;
    heroLogo.style.opacity = `${1 - progress}`;
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
  const muteBtn = $('#muteBtn');
  const themeToggle = $('#themeToggle');
  const themeToggleCurrent = $('#themeToggleCurrent');
  const themeMenu = $('#themeMenu');

  let currentSong = null;
  let userHasInteracted = false; // autoplay must start muted until a gesture

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

  function syncMuteUI() {
    muteBtn.setAttribute('aria-pressed', String(!audioEl.muted));
    muteBtn.setAttribute('aria-label', audioEl.muted ? 'Unmute theme song' : 'Mute theme song');
  }

  function selectSong(key, { attemptPlay = true } = {}) {
    if (!SONGS[key]) return;
    currentSong = key;
    setBackground(SONGS[key].cover);
    setPlayingUI(key);

    audioEl.src = SONGS[key].audio;
    audioEl.muted = !userHasInteracted;
    syncMuteUI();

    if (attemptPlay) {
      const p = audioEl.play();
      if (p && p.catch) {
        // Swallow errors: file missing (not uploaded yet) or autoplay
        // blocked — either way the UI stays correct and silent.
        p.catch(() => {});
      }
    }
  }

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

  // mute toggle — also doubles as the required "unmute on interaction" gesture
  function markInteracted() {
    if (userHasInteracted) return;
    userHasInteracted = true;
  }
  muteBtn.addEventListener('click', () => {
    markInteracted();
    audioEl.muted = !audioEl.muted;
    syncMuteUI();
    if (!audioEl.muted && audioEl.paused) {
      const p = audioEl.play();
      if (p && p.catch) p.catch(() => {});
    }
  });

  /* ---- boot: load default song muted (autoplay-safe) -------------- */
  selectSong(DEFAULT_SONG, { attemptPlay: true });
  muteBtn.setAttribute('aria-pressed', 'false');

})();
