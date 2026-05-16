(function (global) {
  "use strict";

  function syncDebris(state) {
    if (!state) return;
    var root = document.documentElement;
    root.style.setProperty("--tear", String(state.tear != null ? state.tear : 0.18));
    root.style.setProperty("--pulse", String(state.pulse != null ? state.pulse : 0.22));
    root.style.setProperty("--hue", String((state.hue != null ? state.hue : 0)) + "deg");
    var rgb = 2 + (state.tear || 0.18) * 5 + (state.audio || 0) * 4;
    root.style.setProperty("--rgb-shift", String(rgb.toFixed(2)) + "px");
  }

  function burstScreen() {
    var burst = document.querySelector(".screen-burst");
    if (!burst) return;
    burst.style.animation = "none";
    burst.offsetHeight;
    burst.style.opacity = "1";
    burst.style.animation = "screen-burst-flash 420ms ease-out forwards";
  }

  global.EdiffVhs = {
    sync: syncDebris,
    burst: burstScreen
  };
})(typeof window !== "undefined" ? window : this);
