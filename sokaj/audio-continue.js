/* ---- keep the theme song playing on Credits / Concert pages --------
   These pages don't have the play/pause button UI, but if a song was
   already playing on the homepage we pick up right where it left off.
   If nothing was playing yet, we do nothing — never autoplay here.
------------------------------------------------------------------- */
(() => {
  'use strict';

  // iOS Safari (and all iOS browsers, which are WebKit under the hood)
  // requires a real user gesture on *this* page load before unmuted
  // audio.play() is allowed — a previous page's "unlock" doesn't carry
  // over. Other platforms are far more lenient, so the tap-to-resume
  // pill is only needed (and only shown) here.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS 13+

  let wasPlaying = false;
  let src = null;
  let resumeTime = 0;

  try {
    wasPlaying = localStorage.getItem('sokajAudioPlaying') === 'true';
    src = localStorage.getItem('sokajAudioSrc');
    resumeTime = parseFloat(localStorage.getItem('sokajAudioTime') || '0') || 0;
  } catch (e) {}

  if (!wasPlaying || !src) return;

  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  // set the resume point as early as possible so playback doesn't start
  // from 0 for a beat while metadata is still loading
  if (resumeTime > 0) {
    try { audio.currentTime = resumeTime; } catch (e) {}
  }

  const applyResumeTime = () => {
    if (resumeTime > 0) audio.currentTime = resumeTime;
    audio.removeEventListener('loadedmetadata', applyResumeTime);
  };
  audio.addEventListener('loadedmetadata', applyResumeTime);
  audio.src = src;

  function persist() {
    try {
      localStorage.setItem('sokajAudioTime', String(audio.currentTime || 0));
      localStorage.setItem('sokajAudioPlaying', String(!audio.paused));
    } catch (e) {}
  }
  audio.addEventListener('play', persist);
  audio.addEventListener('pause', persist);
  // 1s cadence (was 2s) — tighter resume precision on quick navigation,
  // pagehide still covers the final gap on unload
  setInterval(persist, 1000);
  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', persist);

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
    pill.addEventListener('click', () => {
      const retry = audio.play();
      if (retry && retry.then) {
        retry.then(() => pill.remove()).catch(() => {});
      } else {
        pill.remove();
      }
    }, { once: true });
    document.body.appendChild(pill);
  }

  // Start muted — muted autoplay is allowed almost everywhere, so this
  // mirrors the trick script.js uses on the homepage. On non-iOS this
  // alone usually resumes playback seamlessly. On iOS, unmuting still
  // needs a gesture, so we fall through to the pill.
  audio.muted = true;
  const p = audio.play();
  if (p && p.then) {
    p.then(() => {
      audio.muted = false;
      // some iOS versions accept the play() call but re-mute/refuse to
      // actually unmute without a gesture — verify shortly after
      if (isIOS) {
        setTimeout(() => {
          if (audio.paused || audio.muted) showResumePill();
        }, 300);
      }
    }).catch(() => {
      if (isIOS) showResumePill();
    });
  }
})();
