(function (global) {
  "use strict";

  var Mosh = global.EdiffMosh;
  if (!Mosh) return;

  Mosh.registerMode("strip", function (ctx, img, w, h, state, vars) {
    if (state.tick % 3 !== 0) return;
    var intensity = (vars.intensity || 1) * (0.5 + vars.tear * 1.2);
    var slices = Math.floor(5 + intensity * 9);
    for (var i = 0; i < slices; i += 1) {
      var sy = Math.random() * h;
      var sh = 3 + Math.random() * (14 + vars.tear * 22);
      var dx = (Math.random() - 0.5) * (10 + vars.rgbShift * 2.5);
      ctx.globalAlpha = 0.12 + Math.random() * 0.28 * intensity;
      ctx.drawImage(img, 0, sy, w, sh, dx, sy, w, sh);
    }
    ctx.globalAlpha = 0.14 + Math.random() * 0.2;
    ctx.fillStyle = "rgba(" + Math.floor(Math.random() * 80) + ",220,255,0.35)";
    ctx.fillRect(0, Math.random() * h, w, 1 + Math.random() * 3);
    ctx.globalAlpha = 1;
  });

  Mosh.registerMode("grain", function (ctx, img, w, h, state, vars) {
    var tear = vars.tear || 0.18;
    if (state.tick % 2 !== 0) return;
    for (var i = 0; i < 4 + Math.floor(tear * 8); i += 1) {
      var sy = Math.random() * h;
      var sh = 2 + Math.random() * 8;
      var dx = (Math.random() - 0.5) * 8;
      ctx.globalAlpha = 0.1 + tear * 0.25;
      ctx.drawImage(img, 0, sy, w, sh, dx, sy, w, sh);
    }
    ctx.globalAlpha = 1;
  });
})(typeof window !== "undefined" ? window : this);
