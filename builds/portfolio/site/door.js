/* The door: maps the pinned act's scroll progress onto the light opening.
   Updated straight from scroll events (no animation frame), like the wins,
   so it never lags or stalls. Decorative only: failures never block the page. */
(function () {
  'use strict';

  var SEAM = 0.004;          // closed width, as a fraction of the viewport
  var CLOSED_HEIGHT = 0.5;   // closed height, as a fraction of the viewport
  var STILL_PROGRESS = 0.45; // the frame shown under reduced motion
  var DARK_UNTIL = 0.82;     // folio stays light-on-dark until the light has flooded in
  var POINTER_DRIFT = 18;    // px the mist leans away from the pointer

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  function frameFor(p) {
    var open = Math.pow(smooth(0.06, 0.88, p), 1.7);
    return {
      sx: SEAM + (1 - SEAM) * open,
      sy: CLOSED_HEIGHT + (1 - CLOSED_HEIGHT) * smooth(0.25, 0.9, p),
      glow: clamp(0.3 + 1.6 * p, 0, 1) * (1 - smooth(0.7, 0.92, p)),
      fog: 1 - smooth(0.55, 0.88, p),
      line: 1 - smooth(0.18, 0.42, p)
    };
  }

  function write(stage, f) {
    stage.style.setProperty('--sx', f.sx.toFixed(4));
    stage.style.setProperty('--sy', f.sy.toFixed(4));
    stage.style.setProperty('--glow', f.glow.toFixed(3));
    stage.style.setProperty('--fog', f.fog.toFixed(3));
    stage.style.setProperty('--line', f.line.toFixed(3));
  }

  function init() {
    var act = document.querySelector('[data-door]');
    var stage = act && act.querySelector('.door__stage');
    if (!act || !stage) return;
    var folio = document.querySelector('.folio');

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      write(stage, frameFor(STILL_PROGRESS));
      return;
    }

    function progress(r) {
      var travel = Math.max(r.height - window.innerHeight, 1);
      return clamp(-r.top / travel, 0, 1);
    }

    function update() {
      var r = act.getBoundingClientRect();
      var p = progress(r);
      write(stage, frameFor(p));
      // While the door holds the middle of the screen, the folio follows the light.
      var mid = window.innerHeight / 2;
      if (folio && r.top <= mid && r.bottom >= mid) folio.classList.toggle('is-dark', p < DARK_UNTIL);
    }

    function lean(e) {
      var x = (e.clientX / window.innerWidth - 0.5) * -2;
      var y = (e.clientY / window.innerHeight - 0.5) * -2;
      stage.style.setProperty('--mx', (x * POINTER_DRIFT).toFixed(1) + 'px');
      stage.style.setProperty('--my', (y * POINTER_DRIFT * 0.4).toFixed(1) + 'px');
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', lean, { passive: true });
    }
    update();
  }

  try { init(); } catch (err) { console.error('door.js:', err); }
})();
