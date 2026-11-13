/* Page-specific behaviour. The engine (scrollcraft.js) is untouched; this file
   drives what the kit does not have: the loader, the margin folio and the
   phone menu. The hero background lives in hero-bg.js. */
(function () {
  'use strict';

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

  /* ------------------------------------------------------------- folio -- */
  function initFolio() {
    var folio = document.querySelector('.folio');
    if (!folio || !('IntersectionObserver' in window)) return;
    var links = {};
    Array.prototype.forEach.call(folio.querySelectorAll('[data-folio]'), function (a) {
      links[a.getAttribute('data-folio')] = a;
    });
    var chapters = document.querySelectorAll('[data-chapter]');
    var visible = new Map();

    function render() {
      var best = null;
      visible.forEach(function (ratio, el) { if (!best || ratio > visible.get(best)) best = el; });
      Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
      if (best) {
        var key = best.getAttribute('data-chapter');
        if (links[key]) links[key].setAttribute('aria-current', 'true');
      }
      folio.classList.toggle('is-dark', !!best && best.classList.contains('ground-dark'));
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.set(e.target, e.intersectionRatio);
        else visible.delete(e.target);
      });
      render();
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.01, 0.5, 1] });
    Array.prototype.forEach.call(chapters, function (c) { io.observe(c); });
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ------------------------------------------------------- photo fade-in -- */
  function initPhotos() {
    Array.prototype.forEach.call(document.querySelectorAll('.photo img'), function (img) {
      var done = function () { img.classList.add('is-loaded'); };
      if (img.complete) { done(); return; }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', function () {
        done();   // never leave an invisible frame behind
        console.error('photo failed to load:', img.currentSrc || img.src);
      }, { once: true });
    });
  }

  /* ---------------------------------------------- folio reading progress -- */
  function initFolioProgress() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.folio [data-folio]'));
    var pairs = links.map(function (a) {
      return { a: a, el: document.querySelector('[data-chapter="' + a.getAttribute('data-folio') + '"]') };
    }).filter(function (p) { return p.el; });
    if (!pairs.length) return;
    var queued = false;
    function update() {
      queued = false;
      var vh = window.innerHeight;
      pairs.forEach(function (p) {
        var r = p.el.getBoundingClientRect();
        var prog = clamp((vh * 0.5 - r.top) / Math.max(r.height, 1), 0, 1);
        p.a.style.setProperty('--cp', prog.toFixed(3));
      });
    }
    function queue() { if (!queued) { queued = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    update();
  }


  /* -------------------------------------------------------------- loader --
     One pulsing dot, then the cover fades and the hero copy rises in sequence.
     The hero background is drawn in code (hero-bg.js), so nothing has to load. */
  function initLoader() {
    document.documentElement.classList.add('is-loaded');
  }

  /* ---------------------------------------------------------- phone menu -- */
  function initMenu() {
    var btn = document.querySelector('[data-menu-toggle]');
    var menu = document.querySelector('[data-menu]');
    if (!btn || !menu) return;
    var root = document.documentElement;
    var links = Array.prototype.slice.call(menu.querySelectorAll('a'));

    function set(open, returnFocus) {
      root.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!open));
      links.forEach(function (a) { a.tabIndex = open ? 0 : -1; });
      if (open) setTimeout(function () { if (links[0]) links[0].focus(); }, 60);
      else if (returnFocus) btn.focus();
    }
    set(false, false);
    btn.addEventListener('click', function () { set(!root.classList.contains('menu-open'), true); });
    links.forEach(function (a) { a.addEventListener('click', function () { set(false, false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) set(false, true);
    });
    window.matchMedia('(min-width: 1100px)').addEventListener('change', function (m) { if (m.matches) set(false, false); });
  }

  function initYear() {
    var el = document.querySelector('[data-year]');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  try {
    initLoader();
    initFolio();
    initMenu();
    initFolioProgress();
    initPhotos();
    initYear();
  } catch (err) {
    // Never block the page: everything above is enhancement over readable markup.
    console.error('site.js:', err);
  }
})();
