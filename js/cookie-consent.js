/* =============================================
   Sky Camp — Cookie Consent Logic
   ============================================= */
(function () {
  'use strict';

  const KEY = 'skycamp_cookie_consent';

  function getConsent() { return localStorage.getItem(KEY); }
  function setConsent(val) { localStorage.setItem(KEY, val); }

  function createBanner() {
    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Сповіщення про файли cookie');
    banner.innerHTML = `
      <p>
        🍪 Ми використовуємо файли cookie для покращення роботи сайту та аналітики.
        Детальніше в <a href="/terms.html#privacy">Політиці конфіденційності</a>.
      </p>
      <div class="cookie-actions">
        <button class="cookie-btn cookie-btn-reject" id="cookie-reject">Відхилити</button>
        <button class="cookie-btn cookie-btn-accept" id="cookie-accept">Прийняти</button>
      </div>
    `;
    document.body.appendChild(banner);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => banner.classList.add('visible'));
    });

    document.getElementById('cookie-accept').addEventListener('click', () => {
      setConsent('accepted');
      hideBanner(banner);
      // Enable analytics here if needed
    });

    document.getElementById('cookie-reject').addEventListener('click', () => {
      setConsent('rejected');
      hideBanner(banner);
    });
  }

  function hideBanner(banner) {
    banner.classList.remove('visible');
    banner.addEventListener('transitionend', () => banner.remove(), { once: true });
  }

  // Show only if no decision made yet
  if (!getConsent()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createBanner);
    } else {
      // Small delay so it doesn't flash immediately
      setTimeout(createBanner, 800);
    }
  }
})();
