function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  
  function snap(v, step) {
    return Math.round(v / step) * step;
  }
  
  function pickThemeColors() {
    var theme = document.documentElement.getAttribute("data-theme") || "light";
    var fx = document.documentElement.getAttribute("data-fx") || "clean";
    if (fx === "crt") return [
      "rgba(0,255,65,0.65)",
      "rgba(0,255,136,0.5)",
      "rgba(0,204,51,0.45)",
    ];
    if (theme === "dark") return [
      "rgba(122,162,255,0.55)",
      "rgba(94,234,212,0.48)",
      "rgba(180,100,255,0.42)",
      "rgba(251,191,36,0.38)",
      "rgba(200,210,240,0.32)",
    ];
    return [
      "rgba(31,87,255,0.52)",
      "rgba(11,16,32,0.38)",
      "rgba(220,70,70,0.42)",
      "rgba(13,148,136,0.45)",
    ];
  }
  
  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }
  
  export function createFireworks(config) {
    config = config || {};
    var target = typeof config.target === "string"
      ? document.querySelector(config.target) : (config.target || document.body);
    if (!target) return {
      start: function() {}, stop: function() {},
      destroy: function() {}, setEnabled: function() {},
      updateConfig: function() {}
    };
  
    var state = {
      enabled: config.enabled !== undefined ? config.enabled : true,
      density: config.density !== undefined ? config.density : 0.26,
      speed: config.speed || 0.85,
      global: target === document.body || target === document.documentElement,
      colors: null,
      px: config.px || 3,
    };
    state.colors = pickThemeColors();
  
    var canvas = document.createElement("canvas");
    canvas.className = "fireworks-layer " + (state.global ? "is-global" : "is-local");
    canvas.style.pointerEvents = "none";
    var ctx = canvas.getContext("2d");
    var w = 1, h = 1, dpr = 1;
    var raf = 0, running = false, last = performance.now(), spawnAcc = 0;
    var rockets = [];
    var sparks = [];
    var ro = null;
  
    function hostSetup() {
      if (state.global) document.body.appendChild(canvas);
      else {
        target.style.position = target.style.position || "relative";
        target.appendChild(canvas);
      }
      resize();
      if (!state.global && "ResizeObserver" in window) {
        ro = new ResizeObserver(resize);
        ro.observe(target);
      } else window.addEventListener("resize", resize);
    }
  
    function resize() {
      var rect = state.global
        ? { width: window.innerWidth, height: window.innerHeight }
        : target.getBoundingClientRect();
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  
    function px(x, y, color, size) {
      var s = size || state.px;
      var sx = snap(x - s * 0.5, s);
      var sy = snap(y - s * 0.5, s);
      ctx.fillStyle = color;
      ctx.fillRect(sx, sy, s, s);
    }
  
    function pxLine(x0, y0, x1, y1, color, size) {
      var s = size || state.px;
      ctx.strokeStyle = color;
      ctx.lineWidth = s;
      ctx.lineCap = "square";
      ctx.beginPath();
      ctx.moveTo(snap(x0, s), snap(y0, s));
      ctx.lineTo(snap(x1, s), snap(y1, s));
      ctx.stroke();
    }
  
    function spawnRocket() {
      var x = 60 + Math.random() * Math.max(80, w - 120);
      rockets.push({
        x: x, y: h + 10,
        vx: (Math.random() - 0.5) * 1.2 * state.speed,
        vy: -(2.6 + Math.random() * 1.4) * state.speed,
        trail: [],
        color: pick(state.colors),
        explodeAt: h * (0.15 + Math.random() * 0.30),
        style: Math.random() < 0.4 ? "ring" : Math.random() < 0.6 ? "willow" : "sphere",
      });
    }
  
    function explode(r) {
      var style = r.style;
      var count, vBase, drag, life;
  
      if (style === "sphere") {
        count = 30 + ((Math.random() * 20) | 0);
        vBase = 1.5; drag = 0.984; life = 50;
      } else if (style === "ring") {
        count = 24 + ((Math.random() * 12) | 0);
        vBase = 1.8; drag = 0.987; life = 45;
      } else {
        count = 35 + ((Math.random() * 18) | 0);
        vBase = 0.9; drag = 0.995; life = 75;
      }
  
      var col = r.color;
      var alt = pick(state.colors);
  
      for (var i = 0; i < count; i++) {
        var a, v;
        if (style === "ring") {
          a = (Math.PI * 2 * i) / count;
          v = (vBase + (Math.random() - 0.5) * 0.2) * state.speed;
        } else {
          a = Math.random() * Math.PI * 2;
          v = (vBase * (0.25 + Math.random() * 0.75)) * state.speed;
        }
        sparks.push({
          x: r.x, y: r.y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          age: 0,
          maxAge: life + Math.random() * 20,
          color: (i % 5 === 0) ? alt : col,
          drag: drag,
          trail: [],
          sub: Math.random() < 0.15,
        });
      }
    }
  
    function subBurst(s) {
      var count = 4 + ((Math.random() * 4) | 0);
      var col = pick(state.colors);
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var v = (0.3 + Math.random() * 0.5) * state.speed;
        sparks.push({
          x: s.x, y: s.y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          age: 0, maxAge: 16 + Math.random() * 14,
          color: col, drag: 0.980, trail: [], sub: false,
        });
      }
    }
  
    function tick(now) {
      if (!running) return;
      var dt = Math.min(32, now - last);
      last = now;
  
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.10)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
  
      spawnAcc += dt * state.density;
      if (spawnAcc > 580) {
        spawnAcc = 0;
        if (Math.random() < 0.62) spawnRocket();
        if (Math.random() < 0.12) spawnRocket();
      }
  
      var step = dt * 0.055;
      var grav = 0.0018 * dt;
      var p = state.px;
      var i, j;
  
      for (i = rockets.length - 1; i >= 0; i--) {
        var r = rockets[i];
        r.x += r.vx * step;
        r.y += r.vy * step;
        r.vy += grav * 0.55;
  
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 10) r.trail.shift();
  
        for (j = 0; j < r.trail.length - 1; j++) {
          var tl = (j + 1) / r.trail.length;
          var tp = r.trail[j];
          var tn = r.trail[j + 1];
          pxLine(tp.x, tp.y, tn.x, tn.y, r.color, Math.max(1, p * tl * 0.8));
        }
  
        px(r.x, r.y, r.color, p + 1);
  
        if (Math.random() < 0.25) {
          var sx = r.x + (Math.random() - 0.5) * 4;
          var sy = r.y + Math.random() * 3;
          px(sx, sy, r.color, Math.max(1, p - 1));
        }
  
        if (r.y <= r.explodeAt || r.vy >= 0) {
          explode(r);
          rockets.splice(i, 1);
        }
      }
  
      for (i = sparks.length - 1; i >= 0; i--) {
        var s = sparks[i];
        s.age += step;
        s.x += s.vx * step;
        s.y += s.vy * step;
        s.vx *= s.drag;
        s.vy = s.vy * s.drag + grav;
        var life = 1 - s.age / s.maxAge;
        if (life <= 0) { sparks.splice(i, 1); continue; }
  
        if (s.sub && life < 0.35 && life > 0.30) {
          s.sub = false;
          subBurst(s);
        }
  
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > 4) s.trail.shift();
  
        for (j = 0; j < s.trail.length - 1; j++) {
          var tl2 = (j + 1) / s.trail.length;
          var t0 = s.trail[j];
          var t1 = s.trail[j + 1];
          pxLine(t0.x, t0.y, t1.x, t1.y, s.color, Math.max(1, p * life * tl2 * 0.7));
        }
  
        var sz = life > 0.5 ? p : Math.max(1, p - 1);
  
        if (life < 0.4 && Math.random() < 0.3) {
          if (Math.random() < 0.5) {
            px(s.x, s.y, s.color, sz);
          }
        } else {
          px(s.x, s.y, s.color, sz);
        }
  
        if (life < 0.25 && Math.random() < 0.15) {
          px(
            s.x + (Math.random() - 0.5) * 6,
            s.y + (Math.random() - 0.5) * 6,
            s.color, 1
          );
        }
      }
  
      raf = requestAnimationFrame(tick);
    }
  
    function start() {
      if (running || !state.enabled) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ctx.clearRect(0, 0, w, h);
    }
  
    function destroy() {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      if (ro) ro.disconnect();
      canvas.remove();
    }
  
    function updateConfig(next) {
      next = next || {};
      Object.assign(state, next);
      if (next.palette == null) state.colors = pickThemeColors();
    }
  
    function setEnabled(v) {
      state.enabled = !!v;
      if (state.enabled) start(); else stop();
    }
  
    function onVisibility() {
      if (document.hidden) stop();
      else if (state.enabled) start();
    }
  
    hostSetup();
    document.addEventListener("visibilitychange", onVisibility);
    if (state.enabled) start();
    return {
      start: start, stop: stop, destroy: destroy,
      setEnabled: setEnabled, updateConfig: updateConfig, canvas: canvas
    };
  }