(function (global) {
  "use strict";

  var FRAKTUR_CAP_BASE = 0x1d56c;
  var FRAKTUR_LOW_BASE = 0x1d586;
  var FRAKTUR_CAP_START = 0x1d56c;
  var FRAKTUR_CAP_END = 0x1d586;
  var FRAKTUR_LOW_START = 0x1d586;
  var FRAKTUR_LOW_END = 0x1d5a0;

  function codePoints(str) {
    return Array.from(str || "");
  }

  function isFrakturCode(code) {
    return (code >= FRAKTUR_CAP_START && code < FRAKTUR_CAP_END) ||
      (code >= FRAKTUR_LOW_START && code < FRAKTUR_LOW_END);
  }

  function frakturToPlain(str) {
    var out = "";
    codePoints(str).forEach(function (cp) {
      var code = cp.codePointAt(0);
      if (code >= FRAKTUR_CAP_START && code < FRAKTUR_CAP_END) {
        out += String.fromCharCode(0x41 + (code - FRAKTUR_CAP_START));
      } else if (code >= FRAKTUR_LOW_START && code < FRAKTUR_LOW_END) {
        out += String.fromCharCode(0x61 + (code - FRAKTUR_LOW_START));
      } else {
        out += cp;
      }
    });
    return out;
  }

  function toMathematicalBoldFraktur(str) {
    if (!str) return "";
    var out = "";
    codePoints(str).forEach(function (cp) {
      var code = cp.codePointAt(0);
      if (isFrakturCode(code)) {
        out += cp;
        return;
      }
      if (code >= 0x41 && code <= 0x5a) {
        out += String.fromCodePoint(FRAKTUR_CAP_BASE + (code - 0x41));
      } else if (code >= 0x61 && code <= 0x7a) {
        out += String.fromCodePoint(FRAKTUR_LOW_BASE + (code - 0x61));
      } else {
        out += cp;
      }
    });
    return out;
  }

  function plainLabel(el) {
    var stored = el.getAttribute("data-plain");
    if (stored) return stored;
    var aria = el.getAttribute("aria-label");
    if (aria) {
      el.setAttribute("data-plain", aria);
      return aria;
    }
    var raw = (el.textContent || "").trim();
    var plain = frakturToPlain(raw);
    el.setAttribute("data-plain", plain);
    return plain;
  }

  function applyEdiffHeading(el, opts) {
    if (!el) return;
    opts = opts || {};
    var source = opts.text != null ? String(opts.text) : plainLabel(el);
    var fraktur = toMathematicalBoldFraktur(source);
    el.textContent = fraktur;
    el.setAttribute("data-text", fraktur);
    el.setAttribute("data-plain", source);
    if (opts.ariaLabel !== false) {
      el.setAttribute("aria-label", source);
    }
    if (!el.classList.contains("ediff-heading")) {
      el.classList.add("ediff-heading");
    }
    if (!el.classList.contains("glitch")) {
      el.classList.add("glitch");
    }
  }

  function scanHeadings(root) {
    root = root || document;
    var scope = root.querySelector ? root : document;
    var nodes = scope.querySelectorAll(
      ".shell h1, .shell h2, .shell h3, .crt-head .ediff-heading, .ediff-heading"
    );
    nodes.forEach(function (el) {
      if (el.closest && el.closest("#deployMetaDock")) return;
      applyEdiffHeading(el, { ariaLabel: el.tagName === "H1" || el.classList.contains("hero-title") });
    });
    return nodes.length;
  }

  global.EdiffType = {
    codePoints: codePoints,
    frakturToPlain: frakturToPlain,
    toMathematicalBoldFraktur: toMathematicalBoldFraktur,
    applyEdiffHeading: applyEdiffHeading,
    scanHeadings: scanHeadings
  };
})(typeof window !== "undefined" ? window : this);
