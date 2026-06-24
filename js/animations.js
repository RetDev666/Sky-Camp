/* =============================================
   Sky Camp — Visual Animations Module
   Particles, counters, waves, typewriter
   ============================================= */
(function () {
  'use strict';

  /* ─── Helpers ───────────────────────────── */
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =============================================
     1. FLOATING PARTICLES in hero
     ============================================= */
  function initParticles() {
    const hero = document.querySelector('.hero-section');
    if (!hero || prefersReduced) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
      position:absolute;inset:0;width:100%;height:100%;
      pointer-events:none;z-index:0;opacity:.55;
    `;
    hero.style.position = 'relative';
    hero.prepend(canvas);

    const ctx = canvas.getContext('2d');
    let W, H, particles = [];

    function resize() {
      W = canvas.width  = hero.offsetWidth;
      H = canvas.height = hero.offsetHeight;
    }

    class Particle {
      constructor() { this.reset(true); }
      reset(init) {
        this.x    = Math.random() * W;
        this.y    = init ? Math.random() * H : H + 10;
        this.r    = Math.random() * 3 + 1;
        this.vy   = -(Math.random() * 0.4 + 0.15);
        this.vx   = (Math.random() - 0.5) * 0.3;
        this.alpha= 0;
        this.life = 0;
        this.maxLife = Math.random() * 200 + 120;
      }
      update() {
        this.life++;
        this.x += this.vx;
        this.y += this.vy;
        const t = this.life / this.maxLife;
        this.alpha = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
        if (this.life >= this.maxLife) this.reset(false);
      }
      draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha * 0.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${210 + Math.random() * 30}, 80%, 60%)`;
        ctx.fill();
        ctx.restore();
      }
    }

    function init() {
      particles = Array.from({ length: 55 }, () => new Particle());
    }

    function loop() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => { p.update(); p.draw(); });
      requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    init();
    loop();
  }

  /* =============================================
     2. ANIMATED COUNTERS (stats section)
     ============================================= */
  function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el  = entry.target;
        const end = parseInt(el.dataset.count, 10);
        const dur = 1800;
        const start = performance.now();
        const suffix = el.dataset.countSuffix || '';

        function tick(now) {
          const t  = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
          el.textContent = Math.round(ease * end) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    counters.forEach(el => observer.observe(el));
  }

  /* =============================================
     3. PING / PULSE badges on CTA buttons
     ============================================= */
  function initPingBadges() {
    document.querySelectorAll('.btn-primary, .btn-cta-white').forEach(btn => {
      if (btn.querySelector('.ping-dot')) return; // already added
      const ping = document.createElement('span');
      ping.className = 'ping-dot';
      ping.setAttribute('aria-hidden', 'true');
      btn.style.position = 'relative';
      btn.appendChild(ping);
    });
  }

  /* =============================================
     4. TYPEWRITER for hero title
     ============================================= */
  function initTypewriter() {
    const el = document.querySelector('[data-typewriter]');
    if (!el || prefersReduced) return;

    const words = (el.dataset.typewriter || '').split('|').map(w => w.trim()).filter(Boolean);
    if (words.length < 2) return;

    let wi = 0, ci = 0, deleting = false;
    el.textContent = '';

    function tick() {
      const word = words[wi];
      if (!deleting) {
        ci++;
        el.textContent = word.slice(0, ci);
        if (ci === word.length) { deleting = true; setTimeout(tick, 1800); return; }
        setTimeout(tick, 65);
      } else {
        ci--;
        el.textContent = word.slice(0, ci);
        if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; setTimeout(tick, 300); return; }
        setTimeout(tick, 35);
      }
    }
    setTimeout(tick, 800);
  }

  /* =============================================
     5. RIPPLE on button click
     ============================================= */
  function initRipple() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('.btn');
      if (!btn || prefersReduced) return;

      const ripple = document.createElement('span');
      const rect   = btn.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height);
      ripple.className = 'ripple-effect';
      ripple.style.cssText = `
        width:${size}px;height:${size}px;
        left:${e.clientX - rect.left - size/2}px;
        top:${e.clientY - rect.top  - size/2}px;
      `;
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  /* =============================================
     6. WAVE SVG injected below hero
     ============================================= */
  function initWave() {
    const hero = document.querySelector('.hero-section');
    if (!hero) return;

    const wave = document.createElement('div');
    wave.className = 'hero-wave';
    wave.innerHTML = `
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M0,40 C240,80 480,0 720,40 C960,80 1200,0 1440,40 L1440,80 L0,80 Z"
              fill="var(--surface-container-lowest)"/>
      </svg>`;
    hero.appendChild(wave);
  }

  /* =============================================
     7. SCROLL PROGRESS BAR
     ============================================= */
  function initScrollBar() {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Прогрес прокрутки сторінки');
    document.body.appendChild(bar);

    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY;
      const total    = document.body.scrollHeight - window.innerHeight;
      bar.style.width = (total > 0 ? (scrolled / total) * 100 : 0) + '%';
    }, { passive: true });
  }

  /* =============================================
     8. PARALLAX on hero image
     ============================================= */
  function initParallax() {
    const img = document.querySelector('.hero-image img');
    if (!img || prefersReduced) return;

    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      img.style.transform = `translateY(${y * 0.18}px)`;
    }, { passive: true });
  }

  /* ─── Boot ───────────────────────────────── */
  function boot() {
    initParticles();
    initCounters();
    initPingBadges();
    initTypewriter();
    initRipple();
    initWave();
    initScrollBar();
    initParallax();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
