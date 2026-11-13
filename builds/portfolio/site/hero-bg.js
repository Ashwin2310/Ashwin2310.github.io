/* Hero background: slow sheets of green glass, drawn in one fragment shader.
   No video and no network request. It runs only while the hero is on screen and
   the tab is visible, and draws a single still frame under reduced motion.
   If WebGL is missing, the CSS gradient behind the canvas (hero-bg.css) stays. */
(function () {
  'use strict';

  var RENDER_SCALE = 0.75;   // the glass is soft, so it is drawn below screen resolution
  var MAX_DPR = 1.5;
  var SPEED = 0.05;          // shader time units per second
  var STILL_TIME = 7.3;      // the frame shown under reduced motion
  var POINTER_EASE = 0.04;

  var VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';

  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform vec2 uPtr;',
    '',
    'const vec3 GROUND = vec3(0.059, 0.122, 0.094);',   /* --dark-canvas #0F1F18 */
    'const vec3 DEEP   = vec3(0.063, 0.290, 0.204);',
    'const vec3 FOREST = vec3(0.118, 0.420, 0.306);',   /* --sc-accent #1E6B4E */
    'const vec3 MINT   = vec3(0.561, 0.839, 0.690);',   /* --dark-accent #8FD6B0 */
    'const vec3 CREAM  = vec3(0.929, 0.922, 0.890);',   /* --cream #EDEBE3 */
    '',
    '/* A smooth height field: two rounds of sine warping, then two crossed waves. */',
    'float field(vec2 p, float t) {',
    '  p += 0.42 * vec2(sin(p.y * 1.15 + t * 0.70), cos(p.x * 0.95 - t * 0.50));',
    '  p += 0.26 * vec2(sin(p.y * 2.10 - t * 0.40 + 1.7), cos(p.x * 1.85 + t * 0.60 + 0.4));',
    '  return 0.5 + 0.25 * (sin(p.x * 1.10 + p.y * 0.75 + t * 0.30)',
    '                     + sin(p.y * 1.35 - p.x * 0.65 - t * 0.22 + 2.1));',
    '}',
    '',
    '/* One sheet of glass: a bright rim on its leading edge that falls away into',
    '   a dark body. aa is the rim softness, in units of the sawtooth. */',
    'vec3 sheet(float h, float bands, float aa) {',
    '  float s = fract(h * bands);',
    '  float lead = 1.0 - smoothstep(1.0 - aa, 1.0, s);',
    '  float rim  = pow(s, 7.0) * lead;',
    '  float glow = pow(s, 3.0) * lead;',
    '  vec3 c = mix(DEEP, FOREST, glow) * glow * 0.95;',
    '  c += mix(MINT, CREAM, rim) * rim * 0.9;',
    '  return c;',
    '}',
    '',
    'void main() {',
    '  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);',
    '  float px = 1.5 / min(uRes.x, uRes.y);',
    '  vec2 p = uv * 1.7 + vec2(0.6, 0.2) + uPtr * 0.06;',
    '  float t = uTime;',
    '',
    '  float h = field(p, t);',
    '  float e = 0.01;',
    '  float g = length(vec2(field(p + vec2(e, 0.0), t) - h, field(p + vec2(0.0, e), t) - h)) / e;',
    '',
    '  float bandsA = 2.6;',
    '  vec3 col = sheet(h, bandsA, clamp(g * bandsA * px * 1.25 * 2.0, 0.004, 0.5));',
    '',
    '  /* A second, larger and dimmer layer drifting the other way, for depth. */',
    '  vec2 p2 = uv * 0.8 + vec2(3.1, -1.7) - uPtr * 0.03;',
    '  float h2 = field(p2, -t * 0.8 + 4.0);',
    '  col += sheet(h2, 1.8, 0.05) * 0.5;',
    '',
    '  /* Let wide areas fall back to the ground so the page stays quiet. */',
    '  float open = smoothstep(0.25, 0.8, field(uv * 0.55 + 7.0, t * 0.6));',
    '  col *= mix(0.35, 1.0, open);',
    '',
    '  col = GROUND * 0.4 + col;',
    '  col = col / (1.0 + col * 0.35);',            /* soft shoulder on the highlights */
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('shader compile failed: ' + log);
    }
    return shader;
  }

  function link(gl) {
    var program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('shader link failed: ' + gl.getProgramInfoLog(program));
    }
    return program;
  }

  function setup(canvas) {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    var program = link(gl);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return {
      gl: gl,
      uRes: gl.getUniformLocation(program, 'uRes'),
      uTime: gl.getUniformLocation(program, 'uTime'),
      uPtr: gl.getUniformLocation(program, 'uPtr')
    };
  }

  function init() {
    var canvas = document.querySelector('[data-hero-bg]');
    var hero = document.querySelector('[data-hero]');
    if (!canvas || !hero) return;

    var ctx = setup(canvas);
    if (!ctx) { console.warn('hero-bg: WebGL unavailable, showing the still gradient'); return; }

    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var onScreen = true, raf = 0, last = 0, time = STILL_TIME;
    var target = { x: 0, y: 0 }, pointer = { x: 0, y: 0 };

    function resize() {
      var scale = Math.min(window.devicePixelRatio || 1, MAX_DPR) * RENDER_SCALE;
      var w = Math.max(1, Math.round(canvas.clientWidth * scale));
      var h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w; canvas.height = h;
      ctx.gl.viewport(0, 0, w, h);
    }

    function draw() {
      resize();
      ctx.gl.uniform2f(ctx.uRes, canvas.width, canvas.height);
      ctx.gl.uniform1f(ctx.uTime, time);
      ctx.gl.uniform2f(ctx.uPtr, pointer.x, pointer.y);
      ctx.gl.drawArrays(ctx.gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      raf = 0;
      var dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      time += dt * SPEED;
      pointer = {
        x: pointer.x + (target.x - pointer.x) * POINTER_EASE,
        y: pointer.y + (target.y - pointer.y) * POINTER_EASE
      };
      draw();
      play();
    }

    function play() {
      if (raf || still || !onScreen || document.hidden) return;
      raf = requestAnimationFrame(frame);
    }
    function pause() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; last = 0;
    }

    draw();
    canvas.classList.add('is-live');

    window.addEventListener('resize', function () { if (!raf) draw(); });
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); pause(); canvas.classList.remove('is-live');
      console.warn('hero-bg: WebGL context lost, showing the still gradient');
    });
    if (still) return;

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen) play(); else pause();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else play(); });
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        target = { x: (e.clientX - r.left) / r.width - 0.5, y: 0.5 - (e.clientY - r.top) / r.height };
      });
      hero.addEventListener('pointerleave', function () { target = { x: 0, y: 0 }; });
    }
    play();
  }

  try { init(); } catch (err) {
    // Enhancement only: on any failure the CSS gradient remains as the background.
    console.error('hero-bg.js:', err);
  }
})();
