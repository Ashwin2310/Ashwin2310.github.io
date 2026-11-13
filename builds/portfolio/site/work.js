/* Chapter II, Work: industry filters and tiles that open in place.
   One tile open at a time. Without JS, work.css shows every case and hides the
   buttons and filters, so nothing is ever locked away. */
(function () {
  'use strict';

  var HIDE_MS = 320;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init() {
    var root = document.querySelector('[data-work]');
    if (!root) return;
    var tiles = Array.prototype.slice.call(root.querySelectorAll('.tile'));
    var chips = Array.prototype.slice.call(root.querySelectorAll('[data-filter]'));
    if (!tiles.length) { console.error('work: no tiles found'); return; }

    function setOpen(tile, open) {
      var btn = tile.querySelector('.tile__more');
      var cas = tile.querySelector('.tile__case');
      if (!btn || !cas) return;
      btn.setAttribute('aria-expanded', String(open));
      btn.firstElementChild.textContent = open ? 'Close the case' : 'Read the case';
      cas.hidden = !open;
      tile.classList.toggle('is-open', open);
    }

    tiles.forEach(function (tile) {
      var btn = tile.querySelector('.tile__more');
      if (!btn) return;
      btn.addEventListener('click', function () {
        var opening = btn.getAttribute('aria-expanded') !== 'true';
        tiles.forEach(function (t) { if (t !== tile) setOpen(t, false); });
        setOpen(tile, opening);
        if (opening) {
          var r = tile.getBoundingClientRect();
          if (r.top < 64 || r.bottom > window.innerHeight) {
            tile.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
          }
        }
      });
    });

    var grid = root.querySelector('.tiles');

    function applyFilter(cat) {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === cat)); });
      // work.css widens the tiles to half the row each when only one or two are showing.
      var shown = tiles.filter(function (t) { return cat === 'all' || t.getAttribute('data-cat') === cat; }).length;
      if (grid) grid.setAttribute('data-shown', String(shown));
      tiles.forEach(function (t) {
        var show = cat === 'all' || t.getAttribute('data-cat') === cat;
        if (show) {
          t.hidden = false;
          void t.offsetWidth;            // let it render hidden-state first, then fade in
          t.classList.remove('is-hiding');
        } else if (!t.hidden) {
          setOpen(t, false);
          t.classList.add('is-hiding');
          setTimeout(function () { if (t.classList.contains('is-hiding')) t.hidden = true; }, reduce ? 0 : HIDE_MS);
        }
      });
    }

    chips.forEach(function (c) {
      c.addEventListener('click', function () { applyFilter(c.getAttribute('data-filter')); });
    });
    // Links elsewhere on the page can jump here with a filter already applied.
    Array.prototype.forEach.call(document.querySelectorAll('a[data-show]'), function (a) {
      a.addEventListener('click', function () { applyFilter(a.getAttribute('data-show')); });
    });
  }

  try { init(); } catch (err) { console.error('work.js:', err); }
})();
