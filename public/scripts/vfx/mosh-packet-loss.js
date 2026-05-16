(function (global) {
  "use strict";

  var Mosh = global.EdiffMosh;
  if (!Mosh) return;

  Mosh.registerMode("net", function (ctx, img, w, h, state, vars) {
    var tile = 16;
    var cols = Math.ceil(w / tile);
    var rows = Math.ceil(h / tile);
    var lossRate = 0.04 + vars.tear * 0.12 + (vars.intensity || 0) * 0.06;

    if (!state.prev || state.prev.width !== w || state.prev.height !== h) {
      var prev = document.createElement("canvas");
      prev.width = w;
      prev.height = h;
      var pctx = prev.getContext("2d");
      if (pctx) pctx.drawImage(img, 0, 0, w, h);
      state.prev = prev;
    }

    ctx.drawImage(img, 0, 0, w, h);

    for (var ty = 0; ty < rows; ty += 1) {
      for (var tx = 0; tx < cols; tx += 1) {
        var sx = tx * tile;
        var sy = ty * tile;
        var sw = Math.min(tile, w - sx);
        var sh = Math.min(tile, h - sy);
        var hash = (tx * 73856093) ^ (ty * 19349663) ^ (state.tick * 83492791);
        var r = ((hash >>> 0) % 1000) / 1000;
        if (r < lossRate) {
          if (state.prev && Math.random() < 0.55) {
            ctx.drawImage(state.prev, sx, sy, sw, sh, sx, sy, sw, sh);
          } else {
            ctx.fillStyle = "rgba(4,2,8,0.85)";
            ctx.fillRect(sx, sy, sw, sh);
          }
        }
      }
    }

    if (state.tick % 4 === 0 && state.prev) {
      var pctx = state.prev.getContext("2d");
      if (pctx) pctx.drawImage(img, 0, 0, w, h);
    }
    state.nextFrame = state.prev;
  });
})(typeof window !== "undefined" ? window : this);
