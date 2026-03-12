/**
 * Site interactivity — nav, filters, scroll effects
 */
(function () {
  'use strict';

  // ── Header scroll effect ─────────────────
  const header = document.getElementById('siteHeader');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Mobile nav toggle ────────────────────
  const toggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });

    // Close on nav link click
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  // ── Writeup filter tabs ──────────────────
  const tabs = document.querySelectorAll('.tab');
  const cards = document.querySelectorAll('.writeup-card');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filter = tab.dataset.filter;
      let visible = 0;

      cards.forEach((card, i) => {
        const show = filter === 'all' || card.dataset.difficulty === filter;
        card.classList.toggle('hidden', !show);

        if (show) {
          // Re-trigger entrance animation
          card.style.animationDelay = `${visible * 0.06}s`;
          card.style.animationName = 'none';
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              card.style.animationName = '';
            });
          });
          visible++;
        }
      });
    });
  });

  // ── Scroll reveal ────────────────────────
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          revealObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach(el => revealObs.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('visible'));
  }

  // ── Smooth scroll for anchor links ───────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = 80; // nav height + buffer
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ── Code block language labels ───────────
  document.querySelectorAll('pre code').forEach(block => {
    const pre = block.parentElement;
    const classes = block.className;
    const langMatch = classes.match(/language-(\w+)/);
    if (langMatch) {
      const label = document.createElement('span');
      label.className = 'code-lang-label';
      label.textContent = langMatch[1];
      pre.appendChild(label);
    }
  });

  // ── Copy button for code blocks ──────────
  document.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      if (code) {
        navigator.clipboard.writeText(code.textContent).then(() => {
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => {
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
          }, 1800);
        });
      }
    });

    pre.style.position = 'relative';
    pre.appendChild(btn);
  });

}());
