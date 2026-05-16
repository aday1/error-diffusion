(function (global) {
  "use strict";

  var painters = {};
  var stacks = [];

  function registerMode(name, paintFn) {
    painters[name] = paintFn;
  }

  function readCssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!v) return fallback;
    var n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function createMoshStack(img, opts) {
    if (!img || !img.parentNode) return null;
    opts = opts || {};
    if (img.dataset.moshStack === "1") {
      return stacks.find(function (s) { return s.img === img; }) || null;
    }

    var wrap = document.createElement("div");
    wrap.className = "mosh-wrap";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);

    var layer = document.createElement("canvas");
    layer.className = "mosh-layer";
    wrap.appendChild(layer);
    var ctx = layer.getContext("2d", { alpha: true });
    if (!ctx) return null;

    var stack = {
      img: img,
      wrap: wrap,
      layer: layer,
      ctx: ctx,
      modes: opts.modes || ["strip", "macroblock"],
      mode: opts.mode || "strip",
      intensity: opts.intensity != null ? opts.intensity : 1,
      tick: 0,
      raf: 0,
      destroyed: false,
      prevFrame: null,
      blockCache: null,
      onResize: null
    };

    function size() {
      var w = img.clientWidth || img.naturalWidth || 320;
      var h = img.clientHeight || img.naturalHeight || 240;
      if (layer.width !== w || layer.height !== h) {
        layer.width = w;
        layer.height = h;
        stack.prevFrame = null;
        stack.blockCache = null;
      }
    }

    function vars() {
      return {
        tear: readCssVar("--tear", 0.18),
        rgbShift: readCssVar("--rgb-shift", 2),
        hue: readCssVar("--hue", 0),
        intensity: stack.intensity
      };
    }

    function frame() {
      if (stack.destroyed) return;
      if (document.hidden) {
        stack.raf = requestAnimationFrame(frame);
        return;
      }
      size();
      var w = layer.width;
      var h = layer.height;
      if (w < 2 || h < 2 || !img.complete || !img.naturalWidth) {
        stack.raf = requestAnimationFrame(frame);
        return;
      }
      if (stack.wrap.style.opacity === "0") {
        stack.raf = requestAnimationFrame(frame);
        return;
      }
      stack.tick += 1;
      ctx.clearRect(0, 0, w, h);
      var state = { tick: stack.tick, prev: stack.prevFrame, blockCache: stack.blockCache };
      var v = vars();
      var paint = painters[stack.mode];
      if (paint) {
        paint(ctx, img, w, h, state, v);
        stack.prevFrame = state.nextFrame || stack.prevFrame;
        stack.blockCache = state.blockCache || stack.blockCache;
      }
      stack.raf = requestAnimationFrame(frame);
    }

    function destroy() {
      stack.destroyed = true;
      if (stack.raf) cancelAnimationFrame(stack.raf);
      if (stack.onResize) window.removeEventListener("resize", stack.onResize);
      img.dataset.moshStack = "";
      if (wrap.parentNode) {
        wrap.parentNode.insertBefore(img, wrap);
        wrap.remove();
      }
      stacks = stacks.filter(function (s) { return s !== stack; });
    }

    stack.setMode = function (mode) { stack.mode = mode || "strip"; };
    stack.setIntensity = function (n) { stack.intensity = Math.max(0, Math.min(1.5, n)); };
    stack.destroy = destroy;
    stack.size = size;

    stack.onResize = size;
    img.dataset.moshStack = "1";
    stacks.push(stack);
    window.addEventListener("resize", stack.onResize);
    stack.raf = requestAnimationFrame(frame);
    return stack;
  }

  function destroyAll() {
    stacks.slice().forEach(function (s) { s.destroy(); });
  }

  function setActiveForPlane(activeImg) {
    stacks.forEach(function (s) {
      if (s.img === activeImg) {
        s.wrap.style.visibility = "";
        if (s.destroyed) return;
      } else {
        s.wrap.style.visibility = "hidden";
      }
    });
  }

  global.EdiffMosh = {
    registerMode: registerMode,
    createMoshStack: createMoshStack,
    destroyAll: destroyAll,
    setActiveForPlane: setActiveForPlane,
    getStacks: function () { return stacks.slice(); }
  };
})(typeof window !== "undefined" ? window : this);
