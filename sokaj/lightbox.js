(() => {
  'use strict';

  const grid = document.getElementById('photoGrid');
  if (!grid) return;

  const images = Array.from(grid.querySelectorAll('img'));
  let currentIndex = -1;

  // build lightbox DOM
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Close">✕</button>
    <button class="lightbox-prev" aria-label="Previous">‹</button>
    <img class="lightbox-img" src="" alt="">
    <button class="lightbox-next" aria-label="Next">›</button>
    <div class="lightbox-count"></div>
  `;
  document.body.appendChild(overlay);

  const imgEl = overlay.querySelector('.lightbox-img');
  const countEl = overlay.querySelector('.lightbox-count');
  const closeBtn = overlay.querySelector('.lightbox-close');
  const prevBtn = overlay.querySelector('.lightbox-prev');
  const nextBtn = overlay.querySelector('.lightbox-next');

  function show(index) {
    currentIndex = (index + images.length) % images.length;
    imgEl.src = images[currentIndex].src;
    countEl.textContent = `${currentIndex + 1} / ${images.length}`;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  images.forEach((img, i) => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => show(i));

    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('is-loaded');
    } else {
      img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
      img.addEventListener('error', () => img.classList.add('is-loaded'), { once: true });
    }
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => show(currentIndex - 1));
  nextBtn.addEventListener('click', () => show(currentIndex + 1));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(currentIndex - 1);
    if (e.key === 'ArrowRight') show(currentIndex + 1);
  });
})();
