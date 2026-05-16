(function (global) {
  "use strict";

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function bindHeadingHover(el) {
    if (!el || !global.EdiffGlyphs) return;
    var plain =
      el.getAttribute("data-plain") ||
      el.getAttribute("aria-label") ||
      "";
    if (!plain) return;
    el.addEventListener("pointerenter", function () {
      if (reducedMotion()) return;
      global.EdiffGlyphs.animateScramble(el, {
        plain: plain,
        duration: 520,
        ticks: Math.max(8, plain.length + 6)
      });
    });
  }

  function initHeadings(root) {
    root = root || document;
    var nodes = root.querySelectorAll(".ediff-heading[data-plain]");
    nodes.forEach(bindHeadingHover);
  }

  global.EdiffTextScramble = {
    initHeadings: initHeadings,
    bindHeadingHover: bindHeadingHover
  };
})(typeof window !== "undefined" ? window : this);
