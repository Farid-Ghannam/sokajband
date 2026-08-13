/* ---- keep the theme song playing on Credits / Concert pages --------
   These pages don't have the play/pause button UI, but if a song was
   already playing on the homepage we pick up right where it left off.
   If nothing was playing yet, we do nothing — never autoplay here.
------------------------------------------------------------------- */
(() => {
  'use strict';

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

  const p = audio.play();
  if (p && p.catch) p.catch(() => {});

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
})();
