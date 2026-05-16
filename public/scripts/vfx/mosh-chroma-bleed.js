(function (global) {
  "use strict";

  var Mosh = global.EdiffMosh;
  if (!Mosh) return;

  Mosh.registerMode("chroma", function (ctx, img, w, h, state, vars) {
    if (state.tick % 2 !== 0) return;
    var shift = (vars.rgbShift || 2) * (0.6 + vars.tear);
    var offR = shift * 1.4;
    var offG = -shift * 0.5;
    var offB = shift * 1.1;
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.22 + vars.tear * 0.2;
    ctx.drawImage(img, offR, 0, w, h, 0, 0, w, h);
    ctx.globalAlpha = 0.18;
    ctx.drawImage(img, offG, 0, w, h, 0, 0, w, h);
    ctx.globalAlpha = 0.2;
    ctx.drawImage(img, offB, 0, w, h, 0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  });

  Mosh.registerMode("drift", function (ctx, img, w, h, state, vars) {
    var tear = vars.tear || 0.18;
    var bands = 6 + Math.floor(tear * 10);
    for (var i = 0; i < bands; i += 1) {
      var sy = ((i / bands) * h + state.tick * (1 + i * 0.3)) % h;
      var sh = 4 + tear * 12;
      var dx = Math.sin(state.tick * 0.04 + i) * vars.rgbShift * 2;
      ctx.globalAlpha = 0.08 + tear * 0.15;
      ctx.drawImage(img, 0, sy, w, sh, dx, sy, w, sh);
    }
    ctx.globalAlpha = 1;
  });
})(typeof window !== "undefined" ? window : this);
