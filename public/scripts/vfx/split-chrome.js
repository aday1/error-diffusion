(function (global) {
  "use strict";

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function initSplitting() {
    if (typeof Splitting === "undefined" || reducedMotion()) return;

    Splitting({
      target: "#terminalLog strong, .boot-card strong",
      by: "chars"
    });

    document.querySelectorAll("#terminalLog strong .char, .boot-card strong .char").forEach(function (ch, i) {
      ch.style.setProperty("--char-index", String(i));
    });
  }

  function initGrain() {
    if (typeof grained === "undefined" || reducedMotion()) return;
    var shell = document.querySelector(".shell");
    if (!shell || shell.dataset.grain === "1") return;
    shell.dataset.grain = "1";
    grained("#ediffGrain", {
      animate: true,
      patternWidth: 220,
      patternHeight: 220,
      grainOpacity: 0.06,
      grainDensity: 1,
      grainWidth: 1,
      grainHeight: 1
    });
  }

  global.EdiffSplitChrome = {
    initSplitting: initSplitting,
    initGrain: initGrain,
    boot: function () {
      initSplitting();
      initGrain();
    }
  };
})(typeof window !== "undefined" ? window : this);
