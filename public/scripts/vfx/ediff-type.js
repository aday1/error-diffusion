(function (global) {
  "use strict";

  var FRAKTUR_CAP_BASE = 0x1d56c;
  var FRAKTUR_LOW_BASE = 0x1d586;
  var FRAKTUR_CAP_START = 0x1d56c;
  var FRAKTUR_CAP_END = 0x1d586;
  var FRAKTUR_LOW_START = 0x1d586;
  var FRAKTUR_LOW_END = 0x1d5a0;

  function isFrakturCode(code) {
    return (code >= FRAKTUR_CAP_START && code < FRAKTUR_CAP_END) ||
      (code >= FRAKTUR_LOW_START && code < FRAKTUR_LOW_END);
  }

  function toMathematicalBoldFraktur(str) {
    if (!str) return "";
    var out = "";
    for (var i = 0; i < str.length; i += 1) {
      var ch = str.charAt(i);
      var code = ch.charCodeAt(0);
      if (isFrakturCode(code)) {
        out += ch;
        continue;
      }
      if (code >= 0x41 && code <= 0x5a) {
        out += String.fromCharCode(FRAKTUR_CAP_BASE + (code - 0x41));
      } else if (code >= 0x61 && code <= 0x7a) {
        out += String.fromCharCode(FRAKTUR_LOW_BASE + (code - 0x61));
      } else {
        out += ch;
      }
    }
    return out;
  }

  function plainLabel(el) {
    var stored = el.getAttribute("data-plain");
    if (stored) return stored;
    var raw = (el.textContent || "").trim();
    el.setAttribute("data-plain", raw);
    return raw;
  }

  function applyEdiffHeading(el, opts) {
    if (!el) return;
    opts = opts || {};
    var source = opts.text != null ? String(opts.text) : plainLabel(el);
    var fraktur = toMathematicalBoldFraktur(source);
    el.textContent = fraktur;
    el.setAttribute("data-text", fraktur);
    if (opts.ariaLabel !== false && source !== fraktur) {
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
      ".shell h1, .shell h2, .shell h3, .boot-card strong, .crt-head .ediff-heading, .ediff-heading"
    );
    nodes.forEach(function (el) {
      if (el.closest && el.closest("#deployMetaDock")) return;
      applyEdiffHeading(el, { ariaLabel: el.tagName === "H1" || el.classList.contains("hero-title") });
    });
    return nodes.length;
  }

  global.EdiffType = {
    toMathematicalBoldFraktur: toMathematicalBoldFraktur,
    applyEdiffHeading: applyEdiffHeading,
    scanHeadings: scanHeadings
  };
})(typeof window !== "undefined" ? window : this);
