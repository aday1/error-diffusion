(function (global) {
  "use strict";

  /* Readable glitch pool: Latin + symbols only (no CJK / Hangul). */
  var ALPHA =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var SYMBOLS = "/~@#*+=?[]{}<>|\\:;.,!$%^&-_";
  var BLOCK = "░▒▓█▄▀■□▪▫";
  var POOL = ALPHA + SYMBOLS + BLOCK;

  function toArray(str) {
    return Array.from(str || "");
  }

  function randomFrom(pool) {
    return pool.charAt(Math.floor(Math.random() * pool.length));
  }

  function scramblePartial(plain, revealedCount, pool) {
    pool = pool || POOL;
    var chars = toArray(plain);
    var out = "";
    for (var i = 0; i < chars.length; i += 1) {
      var ch = chars[i];
      if (ch === " " || ch === "\n" || ch === "\t") {
        out += ch;
      } else if (i < revealedCount) {
        out += ch;
      } else {
        out += randomFrom(pool);
      }
    }
    return out;
  }

  function animateScramble(el, opts) {
    if (!el) return;
    opts = opts || {};
    var plain = opts.plain != null ? String(opts.plain) : (el.getAttribute("data-plain") || el.textContent || "");
    var pool = opts.pool || POOL;
    var len = toArray(plain).length;
    var ticks = opts.ticks != null ? opts.ticks : Math.max(10, Math.min(28, len + 14));
    var duration = opts.duration != null ? opts.duration : 760;
    var reduced = opts.reducedMotion;

    if (reduced || typeof anime === "undefined") {
      el.textContent = plain;
      return;
    }

    var obj = { t: 0 };
    anime({
      targets: obj,
      t: ticks,
      duration: duration,
      easing: opts.easing || "easeOutQuad",
      update: function () {
        var show = Math.min(len, Math.floor((obj.t / ticks) * len));
        el.textContent = scramblePartial(plain, show, pool);
      },
      complete: function () {
        el.textContent = plain;
        if (opts.onComplete) opts.onComplete();
      }
    });
  }

  global.EdiffGlyphs = {
    POOL: POOL,
    ALPHA: ALPHA,
    toArray: toArray,
    scramblePartial: scramblePartial,
    animateScramble: animateScramble
  };
})(typeof window !== "undefined" ? window : this);
