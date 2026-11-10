/* Page-specific behaviour. The engine (scrollcraft.js) is untouched; this file
   reads the --sc-p it publishes and drives two things the kit does not have:
   the margin folio and the time ruler (the signature move). */
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

  /* -------------------------------------------------------- time ruler -- */
  function formatValue(v, from, to, finalLabel) {
    if (Math.abs(v - to) < 0.0001 && finalLabel) return finalLabel;
    var span = Math.abs(from - to);
    return span >= 20 ? String(Math.round(v)) : v.toFixed(1);
  }

  function initRuler() {
    var fig = document.querySelector('[data-ruler]');
    if (!fig) return;
    var act = fig.closest('[data-sc-act]');
    var rows = Array.prototype.map.call(fig.querySelectorAll('.ruler__row'), function (row) {
      var from = parseFloat(row.getAttribute('data-from'));
      var to = parseFloat(row.getAttribute('data-to'));
      if (!isFinite(from) || !isFinite(to) || from <= 0) {
        console.error('time ruler: invalid data-from/data-to on', row);
        return null;
      }
      return {
        bar: row.querySelector('.ruler__bar'),
        num: row.querySelector('[data-num]'),
        from: from, to: to,
        finalLabel: row.getAttribute('data-final'),
        last: null
      };
    }).filter(Boolean);

    // Ruler compresses between p = 0.18 and 0.72, then holds so the after state reads.
    var START = 0.18, END = 0.72;
    var ease = function (t) { return 1 - Math.pow(1 - t, 3); };

    function frame() {
      var p = parseFloat(getComputedStyle(act).getPropertyValue('--sc-p')) || 0;
      var t = ease(clamp((p - START) / (END - START), 0, 1));
      rows.forEach(function (r) {
        var v = r.from + (r.to - r.from) * t;
        r.bar.style.setProperty('--scale', (v / r.from).toFixed(4));
        var label = formatValue(v, r.from, r.to, t >= 1 ? r.finalLabel : null);
        if (label !== r.last) { r.num.textContent = label; r.last = label; }
      });
      fig.style.setProperty('--coda', clamp((p - END) / 0.1, 0, 1).toFixed(3));
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------- pathfinding plate grid -- */
  function drawGrid() {
    var g = document.querySelector('.plate-grid');
    if (!g) return;
    var ns = 'http://www.w3.org/2000/svg';
    var frag = document.createDocumentFragment();
    for (var x = 0; x <= 240; x += 20) frag.appendChild(line(x, 0, x, 120));
    for (var y = 0; y <= 120; y += 20) frag.appendChild(line(0, y, 240, y));
    g.appendChild(frag);
    function line(x1, y1, x2, y2) {
      var l = document.createElementNS(ns, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      return l;
    }
  }


  /* ------------------------------------------------------ delivery board --
     ARIA tabs (vertical): click or arrow keys select a project; Home/End jump.
     Rows grow to their real stage once the board scrolls into view. */
  function initBoard() {
    var board = document.querySelector('[data-board]');
    if (!board) return;
    var tabs = Array.prototype.slice.call(board.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    if (panels.some(function (p) { return !p; })) {
      console.error('delivery board: a tab points at a missing panel');
      return;
    }
    var narrow = window.matchMedia('(max-width: 999px)');

    function select(i, focus, fromUser) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
        panels[k].classList.toggle('is-entering', on && fromUser);
      });
      if (focus) tabs[i].focus();
      if (fromUser && narrow.matches) {
        panels[i].scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    }

    tabs.forEach(function (t, i) {
      t.closest('.board__row').style.setProperty('--i', i);
      t.addEventListener('click', function () { select(i, false, true); });
      t.addEventListener('keydown', function (e) {
        var n = tabs.length, j = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % n;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + n) % n;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = n - 1;
        if (j === null) return;
        e.preventDefault();
        select(j, true, true);
      });
    });
    select(0, false, false);

    if (!('IntersectionObserver' in window)) { board.classList.add('is-grown'); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        board.classList.add('is-grown');
        io.disconnect();
      });
    }, { rootMargin: '0px 0px -20% 0px', threshold: 0.15 });
    io.observe(board);
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

  function initYear() {
    var el = document.querySelector('[data-year]');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  try {
    initFolio();
    initFolioProgress();
    initBoard();
    initPhotos();
    initRuler();
    drawGrid();
    initYear();
  } catch (err) {
    // Never block the page: everything above is enhancement over readable markup.
    console.error('site.js:', err);
  }
})();
