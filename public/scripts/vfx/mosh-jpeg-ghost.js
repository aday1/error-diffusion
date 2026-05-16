(function (global) {
  "use strict";

  var Mosh = global.EdiffMosh;
  if (!Mosh) return;

  Mosh.registerMode("jpeg", function (ctx, img, w, h, state, vars) {
    var block = 8;
    var cols = Math.ceil(w / block);
    var rows = Math.ceil(h / block);
    var quant = 24 + Math.floor((1 - vars.tear) * 40);
    var wrongDcEvery = Math.max(4, Math.floor(14 - vars.intensity * 6));

    for (var ty = 0; ty < rows; ty += 1) {
      for (var tx = 0; tx < cols; tx += 1) {
        var sx = tx * block;
        var sy = ty * block;
        var sw = Math.min(block, w - sx);
        var sh = Math.min(block, h - sy);
        ctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
        if ((tx + ty + state.tick) % wrongDcEvery === 0) {
          ctx.fillStyle = "rgba(" +
            Math.floor(Math.random() * 40) + "," +
            Math.floor(80 + Math.random() * 120) + "," +
            Math.floor(160 + Math.random() * 80) + ",0.35)";
          ctx.fillRect(sx, sy, sw, sh);
        }
        var steps = Math.max(2, Math.floor(256 / quant));
        ctx.globalAlpha = 0.35;
        for (var py = 0; py < sh; py += block) {
          for (var px = 0; px < sw; px += block) {
            var avg = ((tx + ty) * 17 + state.tick) % steps;
            ctx.fillStyle = "rgba(0,0,0," + (0.04 + avg / steps * 0.12) + ")";
            ctx.fillRect(sx + px, sy + py, block, block);
          }
        }
        ctx.globalAlpha = 1;
      }
    }
  });
})(typeof window !== "undefined" ? window : this);
