/* The lens: fifteen photos on a Fibonacci sphere, a title on its centre point,
   and a lightbox that grows out of the card you pick.

   Camera: world = translateZ(camZ) rotateY(yaw) rotateX(pitch). No translateX/Y,
   so the sphere never leaves the centre of the stage. Scroll through the pinned
   act turns the sphere and dollies forward a little; drag turns it by hand and
   leaves momentum behind. The title is counter-rotated every frame so it stays
   square to the camera and on the optical centre. Decorative failures never block
   the page: the markup reads as a plain grid of photos without this file. */
(function () {
  'use strict';

  var DEG_PER_PX = 0.13;        // drag sensitivity
  var FRICTION = 0.94;          // momentum decay per frame
  var MAX_SPIN = 4;             // degrees per frame a flick can leave behind
  var PITCH_LIMIT = 32;         // degrees either side of level
  var REST_TILT = -4;           // resting pitch, degrees
  var SCROLL_YAW = 140;         // degrees the sphere turns across the pinned scroll
  var TITLE_DEPTH = 1.06;       // title sits just in front of the nearest card, so it always reads
  var CLICK_SLOP_FINE = 6, CLICK_SLOP_TOUCH = 14;
  var FLIP_MS = 640;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /** @returns {{x:number,y:number,z:number,lat:number,lon:number}[]} unit vectors */
  function fibonacci(n) {
    var ga = Math.PI * (3 - Math.sqrt(5)), out = [];
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), t = i * ga;
      var x = Math.cos(t) * r, z = Math.sin(t) * r;
      out.push({ x: x, y: y, z: z, lat: Math.asin(y) * 180 / Math.PI, lon: Math.atan2(x, z) * 180 / Math.PI });
    }
    return out;
  }

  function metrics() {
    var w = window.innerWidth, h = window.innerHeight;
    var small = w <= 380, mid = w <= 640;
    var hr = small ? 0.38 : mid ? 0.42 : 0.46, wr = small ? 0.48 : mid ? 0.52 : 0.58;
    var floor = small ? 108 : mid ? 120 : 155;
    var R = Math.max(floor, Math.min(480, h * hr, w * wr));
    return {
      R: R,
      cw: Math.round(Math.max(72, R * (small ? 0.36 : mid ? 0.37 : 0.34))),
      persp: small ? 620 : mid ? 760 : w <= 900 ? 920 : 1150
    };
  }

  function init() {
    var act = document.querySelector('[data-lens]');
    if (!act) return;
    var stage = act.querySelector('[data-lens-stage]');
    var world = act.querySelector('[data-lens-world]');
    var head = act.querySelector('[data-lens-head]');
    var ring = act.querySelector('.lens__ring');
    var cards = Array.prototype.slice.call(act.querySelectorAll('.lens__card'));
    if (!stage || !world || !head || cards.length < 2) { console.error('lens: markup is incomplete'); return; }

    var pts = fibonacci(cards.length);
    var m = metrics();
    var state = { yaw: 0, pitch: 0, velX: 0, velY: 0, camZ: 0, lit: -1, dragging: false };
    var last = cards.map(function () { return { o: -1, d: -1 }; });

    function layout() {
      m = metrics();
      act.style.setProperty('--persp', m.persp + 'px');
      act.style.setProperty('--cw', m.cw + 'px');
      cards.forEach(function (c, i) {
        var p = pts[i];
        c.style.transform = 'translate3d(' + (p.x * m.R).toFixed(1) + 'px,' + (-p.y * m.R).toFixed(1) + 'px,' +
          (p.z * m.R).toFixed(1) + 'px) rotateY(' + p.lon.toFixed(2) + 'deg) rotateX(' + p.lat.toFixed(2) + 'deg)';
      });
    }

    function progress() {
      var r = act.getBoundingClientRect();
      return clamp(-r.top / Math.max(r.height - window.innerHeight, 1), 0, 1);
    }

    /* One frame of the camera. Safe to call from scroll and from rAF. */
    function frame() {
      var p = progress();
      if (!state.dragging && state.lit < 0) {
        state.yaw += state.velX; state.pitch += state.velY;
        state.velX *= FRICTION; state.velY *= FRICTION;
        if (Math.abs(state.velX) < 0.002) state.velX = 0;
        if (Math.abs(state.velY) < 0.002) state.velY = 0;
      }
      state.pitch = clamp(state.pitch, -PITCH_LIMIT - REST_TILT, PITCH_LIMIT - REST_TILT);
      var sx = REST_TILT + state.pitch;
      var sy = (reduce ? 0 : SCROLL_YAW * p) + state.yaw;
      var target = reduce ? 0 : p * m.R * 0.18;
      state.camZ += (target - state.camZ) * (reduce ? 1 : 0.12);

      world.style.transform = 'translateZ(' + state.camZ.toFixed(2) + 'px) rotateY(' + sy.toFixed(3) + 'deg) rotateX(' + sx.toFixed(3) + 'deg)';
      // Rightmost first: push the title toward the camera, then undo the world's turn.
      head.style.transform = 'rotateX(' + (-sx).toFixed(3) + 'deg) rotateY(' + (-sy).toFixed(3) + 'deg) translateZ(' + (m.R * TITLE_DEPTH).toFixed(1) + 'px)';
      head.style.opacity = String(Math.max(0, 1 - p * 0.55).toFixed(3));

      var rot = new DOMMatrix().rotateSelf(0, sy, 0).rotateSelf(sx, 0, 0);
      var near = m.persp * 0.66;
      var shade = 1 - Math.min(1, p * 0.6);
      cards.forEach(function (c, i) {
        var v = rot.transformPoint(new DOMPoint(pts[i].x, -pts[i].y, pts[i].z));
        var zf = v.z;
        var base = 0.14 + 0.86 * Math.pow((zf + 1) / 2, 0.85);
        var dim = shade * (1 - base);
        var abs = zf * m.R + state.camZ;
        var fade = abs > near ? Math.max(0, 1 - (abs - near) / 190) : 1;
        if (state.lit >= 0) { dim = Math.min(1, dim + 0.78); if (i === state.lit) fade = 0; }
        var d = Math.round(dim * 100) / 100, o = Math.round(fade * 100) / 100;
        if (d !== last[i].d) { c.style.setProperty('--d', String(d)); last[i].d = d; }
        if (o !== last[i].o) { c.style.opacity = String(o); last[i].o = o; }
      });
    }

    /* ---- run the loop only while the act is near the screen or still coasting */
    var near = false, running = false;
    function loop() {
      frame();
      if (near || state.velX || state.velY || state.dragging) requestAnimationFrame(loop);
      else running = false;
    }
    function wake() { if (!running) { running = true; requestAnimationFrame(loop); } }

    function onScroll() {
      var r = act.getBoundingClientRect(), vh = window.innerHeight;
      near = r.bottom > -vh * 0.25 && r.top < vh * 1.25;
      if (r.top < vh * 0.55 && r.bottom > vh * 0.3) act.classList.add('is-seen');
      if (r.top < vh * 1.6) loadAll();
      if (near) { frame(); wake(); }
    }

    var loaded = false;
    function loadAll() {
      if (loaded) return;
      loaded = true;
      cards.forEach(function (c) { var img = c.querySelector('img'); if (img) img.loading = 'eager'; });
    }

    /* ---- drag ------------------------------------------------------------ */
    var down = null;
    stage.addEventListener('pointerdown', function (e) {
      if (state.lit >= 0 || e.button > 0) return;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY,
               card: e.target.closest('.lens__card'), touch: e.pointerType === 'touch', moved: false };
      state.velX = state.velY = 0;
      if (!down.touch) { state.dragging = true; stage.setPointerCapture(e.pointerId); wake(); }
    });
    stage.addEventListener('pointermove', function (e) {
      moveRing(e);
      if (!down || e.pointerId !== down.id) return;
      var tx = e.clientX - down.x, ty = e.clientY - down.y;
      if (down.touch && !state.dragging) {
        if (Math.hypot(tx, ty) < 10) return;
        if (Math.abs(ty) > Math.abs(tx) * 1.15) { down = null; return; }   // a scroll, not a turn
        state.dragging = true; stage.setPointerCapture(e.pointerId); wake();
      }
      var dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      down.lx = e.clientX; down.ly = e.clientY;
      var slop = down.touch ? CLICK_SLOP_TOUCH : CLICK_SLOP_FINE;
      if (Math.hypot(tx, ty) > slop) down.moved = true;
      state.yaw += dx * DEG_PER_PX;
      if (!down.touch) state.pitch -= dy * DEG_PER_PX;
      state.velX = reduce ? 0 : clamp(dx * DEG_PER_PX, -MAX_SPIN, MAX_SPIN);
      state.velY = reduce || down.touch ? 0 : clamp(-dy * DEG_PER_PX, -MAX_SPIN, MAX_SPIN);
      frame();
    });
    function release(e) {
      if (!down || e.pointerId !== down.id) return;
      var tapped = !down.moved && e.type === 'pointerup' ? down.card : null;
      state.dragging = false;
      down = null;
      if (tapped) open(tapped);
      wake();
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    // Keyboard: Enter/Space on a focused card. Pointer clicks are handled on pointerup.
    cards.forEach(function (c) {
      c.addEventListener('click', function (e) { if (e.detail === 0) open(c); });
    });

    /* ---- pointer ring ------------------------------------------------------ */
    function moveRing(e) {
      if (!ring || e.pointerType !== 'mouse') return;
      var r = stage.getBoundingClientRect();
      ring.style.transform = 'translate3d(' + (e.clientX - r.left) + 'px,' + (e.clientY - r.top) + 'px,0)';
      var over = !!e.target.closest('.lens__card');
      ring.classList.toggle('is-card', over);
      ring.firstElementChild.textContent = over && !state.dragging ? 'Open' : 'Drag';
      ring.classList.add('is-on');
    }
    stage.addEventListener('pointerleave', function () { if (ring) ring.classList.remove('is-on'); });

    /* ---- lightbox ------------------------------------------------------------ */
    var lb = document.querySelector('[data-lightbox]');
    var plate = lb && lb.querySelector('[data-lb-plate]');
    var lbImg = lb && lb.querySelector('[data-lb-img]');
    var lbTitle = lb && lb.querySelector('[data-lb-title]');
    var lbPlace = lb && lb.querySelector('[data-lb-place]');
    var closeBtn = lb && lb.querySelector('.lightbox__close');
    var token = 0, source = null, closeTimer = 0;

    function flipFrom(rect) {
      var to = plate.getBoundingClientRect();
      var s = Math.max(0.04, rect.width / Math.max(to.width, 1));
      plate.style.transition = 'none';
      plate.style.transform = 'translate(' + (rect.left - to.left) + 'px,' + (rect.top - to.top) + 'px) scale(' + s + ')';
      plate.style.opacity = '0';
      void plate.offsetWidth;   // commit the start position
      plate.style.transition = ''; plate.style.transform = ''; plate.style.opacity = '';
    }

    function open(card) {
      if (!lb || !plate) return;
      clearTimeout(closeTimer);
      var img = card.querySelector('img');
      var mine = ++token;
      source = card;
      state.lit = cards.indexOf(card);
      var ar = parseFloat(img.getAttribute('width')) / parseFloat(img.getAttribute('height'));
      plate.style.setProperty('--ar', (isFinite(ar) && ar > 0 ? ar : 0.75).toFixed(4));
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt;
      lbTitle.textContent = card.getAttribute('data-title') || '';
      lbPlace.textContent = card.getAttribute('data-place') || '';
      var full = new Image();
      full.onload = function () { if (mine === token) lbImg.src = full.src; };
      full.onerror = function () { console.error('lens: full photo failed to load', full.src); };
      full.src = card.getAttribute('data-full') || lbImg.src;

      lb.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      act.classList.add('is-lit');
      flipFrom(card.getBoundingClientRect());
      lb.classList.add('is-open');
      closeBtn.focus({ preventScroll: true });
      frame();
    }

    function close() {
      if (!lb || lb.hidden || state.lit < 0) return;
      var from = source;
      state.lit = -1;
      token++;
      act.classList.remove('is-lit');
      frame();                                  // the card lights back up first
      var to = plate.getBoundingClientRect(), r = from.getBoundingClientRect();
      plate.style.transform = 'translate(' + (r.left - to.left) + 'px,' + (r.top - to.top) + 'px) scale(' + Math.max(0.04, r.width / Math.max(to.width, 1)) + ')';
      plate.style.opacity = '0';
      lb.classList.remove('is-open');
      document.documentElement.style.overflow = '';
      closeTimer = setTimeout(function () {
        lb.hidden = true;
        plate.style.transition = 'none'; plate.style.transform = ''; plate.style.opacity = '';
        void plate.offsetWidth; plate.style.transition = '';
      }, FLIP_MS);
      from.focus({ preventScroll: true });
      wake();
    }

    if (lb) {
      lb.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
      document.addEventListener('keydown', function (e) {
        if (lb.hidden) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'Tab') { e.preventDefault(); closeBtn.focus(); }   // the close button is the only stop
      });
    }

    /* ---- sizing: ignore the small jitters of URL bars and scrollbars ---------- */
    var lastW = window.innerWidth, lastH = window.innerHeight;
    function onResize(force) {
      var w = window.innerWidth, h = window.innerHeight;
      if (force !== true && Math.abs(w - lastW) < 20 && Math.abs(h - lastH) < 20) return;
      lastW = w; lastH = h;
      layout(); frame();
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', function () { setTimeout(function () { onResize(true); }, 220); });
    window.addEventListener('scroll', onScroll, { passive: true });

    layout();
    frame();
    onScroll();
  }

  try { init(); } catch (err) { console.error('lens.js:', err); }
})();
