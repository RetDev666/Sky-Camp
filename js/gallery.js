/* =============================================
   Sky Camp — Gallery Lightbox Logic
   ============================================= */
(function () {
  'use strict';

  const lightbox    = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');

  if (!lightbox || !lightboxImg) return;

  function openLightbox(el) {
    const img = el.querySelector('img');
    if (!img) return;
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox(e) {
    if (!e || e.target !== lightboxImg) {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // Attach click handlers to all gallery items
  document.querySelectorAll('.gallery-item').forEach(function (item) {
    item.addEventListener('click', function () { openLightbox(item); });
  });

  lightbox.addEventListener('click', closeLightbox);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  // Expose globally for legacy inline onclick (if any remain)
  window.openLightbox  = openLightbox;
  window.closeLightbox = closeLightbox;
})();
