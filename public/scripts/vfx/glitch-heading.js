(function (global) {
  "use strict";

  function pulse(reducedMotion) {
    if (reducedMotion || typeof anime === "undefined") return;
    anime({
      targets: ".ediff-heading",
      translateX: [{ value: anime.random(-6, 6) }, { value: 0 }],
      duration: 420,
      easing: "easeOutQuad"
    });
  }

  function intensifyRgb(theme) {
    var root = document.documentElement;
    if (theme === "rgb") {
      root.style.setProperty("--heading-glitch-opacity", "0.22");
    } else {
      root.style.setProperty("--heading-glitch-opacity", "0.14");
    }
  }

  global.EdiffGlitchHeading = {
    pulse: pulse,
    intensifyRgb: intensifyRgb
  };
})(typeof window !== "undefined" ? window : this);
