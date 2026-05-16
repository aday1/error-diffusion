(function (global) {
  "use strict";

  var Mosh = global.EdiffMosh;
  if (!Mosh) return;

  function ensureCache(state, w, h, block) {
    if (!state.blockCache || state.blockCache.w !== w || state.blockCache.h !== h) {
      var cols = Math.ceil(w / block);
      var rows = Math.ceil(h / block);
      state.blockCache = {
        w: w,
        h: h,
        block: block,
        cols: cols,
        rows: rows,
        tiles: new Array(cols * rows)
      };
    }
    return state.blockCache;
  }

  Mosh.registerMode("macroblock", function (ctx, img, w, h, state, vars) {
    ctx.drawImage(img, 0, 0, w, h);
    var block = 16;
    var cache = ensureCache(state, w, h, block);
    var cols = cache.cols;
    var rows = cache.rows;
    var slip = (vars.tear - 0.5) * block * 4;
    var intensity = vars.intensity || 1;

    for (var ty = 0; ty < rows; ty += 1) {
      for (var tx = 0; tx < cols; tx += 1) {
        var idx = ty * cols + tx;
        var sx = tx * block;
        var sy = ty * block;
        var sw = Math.min(block, w - sx);
        var sh = Math.min(block, h - sy);
        var mode = (state.tick + idx) % 7;
        var dy = 0;
        if (mode === 0) {
          dy = Math.round(slip + (Math.random() - 0.5) * block * intensity);
        } else if (mode === 1 && cache.tiles[idx]) {
          ctx.drawImage(cache.tiles[idx], sx, sy);
          continue;
        } else if (mode === 2 && Math.random() < 0.08 * intensity) {
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillRect(sx, sy, sw, sh);
          continue;
        }
        ctx.drawImage(img, sx, sy, sw, sh, sx, sy + dy, sw, sh);
        if (state.tick % 5 === 0) {
          var off = document.createElement("canvas");
          off.width = sw;
          off.height = sh;
          var octx = off.getContext("2d");
          if (octx) {
            octx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            cache.tiles[idx] = off;
          }
        }
      }
    }
    state.blockCache = cache;
  });

  Mosh.registerMode("rgb", function (ctx, img, w, h, state, vars) {
    var block = 8;
    var cache = ensureCache(state, w, h, block);
    var shift = vars.rgbShift || 2;
    for (var ty = 0; ty < cache.rows; ty += 1) {
      for (var tx = 0; tx < cache.cols; tx += 1) {
        var sx = tx * block;
        var sy = ty * block;
        var sw = Math.min(block, w - sx);
        var sh = Math.min(block, h - sy);
        if ((tx + ty + state.tick) % 5 === 0) {
          ctx.drawImage(img, sx, sy, sw, sh, sx + shift, sy, sw, sh);
        } else if ((tx + ty) % 3 === 0) {
          ctx.drawImage(img, sx, sy, sw, sh, sx, sy + shift * 0.6, sw, sh);
        }
      }
    }
    state.blockCache = cache;
  });
})(typeof window !== "undefined" ? window : this);
