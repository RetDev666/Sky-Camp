/* =============================================
   Sky Camp — Main JavaScript
   All global behaviour: nav, accordion, animations
   ============================================= */
(function () {
  "use strict";

  /* ─── Mobile Menu ─────────────────────────────── */
  const navToggle = document.getElementById("nav-toggle");
  const mobileMenu = document.getElementById("mobile-menu");

  if (navToggle && mobileMenu) {
    const iconOpen = navToggle.querySelector(".icon-open");
    const iconClose = navToggle.querySelector(".icon-close");

    function openMenu() {
      mobileMenu.classList.add("open");
      navToggle.setAttribute("aria-expanded", "true");
      if (iconOpen) iconOpen.style.display = "none";
      if (iconClose) iconClose.style.display = "inline";
      document.body.style.overflow = "hidden";
    }

    function closeMenu() {
      mobileMenu.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      if (iconOpen) iconOpen.style.display = "inline";
      if (iconClose) iconClose.style.display = "none";
      document.body.style.overflow = "";
    }

    navToggle.addEventListener("click", () =>
      mobileMenu.classList.contains("open") ? closeMenu() : openMenu(),
    );

    // Close on backdrop or ESC
    mobileMenu.addEventListener("click", (e) => {
      if (e.target === mobileMenu) closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
    mobileMenu
      .querySelectorAll(".mobile-nav-link")
      .forEach((l) => l.addEventListener("click", closeMenu));
  }

  /* ─── Active nav link ──────────────────────────── */
  (function () {
    const page = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-link, .mobile-nav-link, .footer-link").forEach((link) => {
      const href = link.getAttribute("href")?.split("#")[0];
      link.classList.toggle("active", href === page || (page === "" && href === "index.html"));
    });
  })();

  /* ─── Navbar: elevate on scroll ───────────────── */
  const navbar = document.querySelector(".navbar");
  if (navbar) {
    const onScroll = () => {
      navbar.classList.toggle("navbar--elevated", window.scrollY > 10);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ─── Accordion ────────────────────────────────── */
  document.querySelectorAll(".accordion-item").forEach((item) => {
    const header = item.querySelector(".accordion-header");
    const body = item.querySelector(".accordion-body");
    const icon = item.querySelector(".accordion-icon");
    if (!header || !body) return;

    header.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");

      // Close all siblings
      item
        .closest(".faq-list, .accordion-list, [data-accordion-group]")
        ?.querySelectorAll(".accordion-item.open")
        .forEach((other) => {
          if (other === item) return;
          other.classList.remove("open");
          other.querySelector(".accordion-body").style.maxHeight = null;
          const ic = other.querySelector(".accordion-icon");
          if (ic) ic.style.transform = "";
        });

      item.classList.toggle("open", !isOpen);
      body.style.maxHeight = isOpen ? null : body.scrollHeight + "px";
      if (icon) icon.style.transform = isOpen ? "" : "rotate(180deg)";
    });
  });

  /* ─── Scroll-reveal animations ─────────────────── */
  if (
    "IntersectionObserver" in window &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const delay = parseFloat(el.dataset.animateDelay || 0);
          setTimeout(() => el.classList.add("is-visible"), delay);
          observer.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    // Auto-stagger sibling elements in the same parent
    document.querySelectorAll("[data-animate]").forEach((el, i, all) => {
      const siblings = Array.from(
        el.parentElement?.querySelectorAll(":scope > [data-animate]") ?? [],
      );
      const idx = siblings.indexOf(el);
      if (idx > 0 && !el.dataset.animateDelay) {
        el.dataset.animateDelay = idx * 80; // 80ms between siblings
      }
      observer.observe(el);
    });
  } else {
    // Reduced motion or no observer: show everything immediately
    document.querySelectorAll("[data-animate]").forEach((el) => el.classList.add("is-visible"));
  }

  /* ─── Page transition: fade-in on load ─────────── */
  document.documentElement.classList.add("page-loaded");

  /* ─── Smooth anchor scroll ─────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const target = document.querySelector(anchor.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* ─── Back-to-top on logo click (booking page) ─── */
  document.querySelectorAll(".navbar-brand").forEach((brand) => {
    // Only intercept on booking page
    if (!document.getElementById("booking-stepper")) return;
    // Do nothing special — normal link behaviour
  });
})();
