(() => {
  'use strict';

  const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp']);
  const AUDIO_EXT = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus']);
  const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv', '.m4v']);

  function extOf(name) {
    const i = name.lastIndexOf('.');
    return i < 0 ? '' : name.slice(i).toLowerCase();
  }

  function kindOf(name) {
    const ext = extOf(name);
    if (IMAGE_EXT.has(ext)) return 'image';
    if (AUDIO_EXT.has(ext)) return 'audio';
    if (VIDEO_EXT.has(ext)) return 'video';
    return 'file';
  }

  function runeClass(kind, index) {
    const map = { image: 4, audio: 3, video: 5, file: 1 };
    const base = map[kind] || 1;
    return `r${((base + index) % 6) + 1}`;
  }

  function paintStatic(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let previous = 0;
    const w = canvas.width;
    const h = canvas.height;
    const data = ctx.createImageData(w, h);
    function draw(now) {
      if (!reduce && now - previous > 40) {
        const buf = data.data;
        for (let i = 0; i < buf.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          buf[i] = v;
          buf[i + 1] = v;
          buf[i + 2] = v;
          buf[i + 3] = 255;
        }
        // Sparse green/pink sparks.
        for (let n = 0; n < 40; n++) {
          const x = (Math.random() * w) | 0;
          const y = (Math.random() * h) | 0;
          const o = (y * w + x) * 4;
          if (n % 2) {
            buf[o] = 255; buf[o + 1] = 70; buf[o + 2] = 90;
          } else {
            buf[o] = 80; buf[o + 1] = 255; buf[o + 2] = 120;
          }
        }
        ctx.putImageData(data, 0, 0);
        previous = now;
      }
      frame = requestAnimationFrame(draw);
    }
    if (reduce) {
      ctx.fillStyle = '#1a1f18';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    frame = requestAnimationFrame(draw);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else frame = requestAnimationFrame(draw);
    });
  }

  function tileHtml(item, index) {
    const kind = item.kind || kindOf(item.name);
    const href = item.channel || `./channel/${item.slug}.html`;
    const media = item.media || `./media/${item.path}`;
    let preview = '<div class="pub-tile-screen" aria-hidden="true"></div>';
    if (kind === 'image') {
      preview = `<div class="pub-tile-screen"><img src="${media}" alt="" loading="lazy"></div>`;
    } else if (kind === 'video') {
      preview = `<div class="pub-tile-screen"><video src="${media}" muted playsinline preload="metadata"></video></div>`;
    } else if (kind === 'audio') {
      preview = `<div class="pub-tile-screen" style="display:grid;place-items:center;color:#8bff94;letter-spacing:.2em;font-size:11px">AUDIO</div>`;
    }
    return `<a class="pub-tile" href="${href}">
      ${preview}
      <div class="pub-tile-meta"><span>${kind}</span><span class="pub-rune ${runeClass(kind, index)}" aria-hidden="true"></span></div>
      <div class="pub-tile-title">${item.title || item.name}</div>
    </a>`;
  }

  async function mountIndex(opts) {
    const grid = opts.grid;
    const empty = opts.empty;
    paintStatic(opts.staticCanvas);
    let items = [];
    try {
      const res = await fetch(opts.manifestUrl, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        items = Array.isArray(data.items) ? data.items : [];
      }
    } catch (_) { /* empty grid */ }
    const playable = items.filter((item) => (item.kind || kindOf(item.name)) !== 'file' || item.channel);
    if (!playable.length) {
      if (grid) grid.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    if (grid) {
      grid.hidden = false;
      grid.innerHTML = playable.map(tileHtml).join('');
    }
  }

  function attachWave(audio, canvas) {
    if (!audio || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let analyser = null;
    let data = null;
    let raf = 0;
    function connect() {
      if (analyser) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC || typeof audio.captureStream !== 'function') return;
        const ac = new AC();
        const stream = audio.captureStream();
        const src = ac.createMediaStreamSource(stream);
        analyser = ac.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        data = new Uint8Array(analyser.frequencyBinCount);
        if (ac.state === 'suspended') ac.resume();
      } catch (_) { /* keep visual fallback */ }
    }
    function draw() {
      const w = canvas.width = canvas.clientWidth || 640;
      const h = canvas.height = canvas.clientHeight || 88;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(5,12,7,0.35)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#8bff94';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        for (let i = 0; i < data.length; i++) {
          const x = (i / (data.length - 1)) * w;
          const y = (data[i] / 255) * h;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      } else {
        const t = performance.now() / 1000;
        for (let i = 0; i < w; i++) {
          const y = h * 0.5 + Math.sin(i * 0.04 + t * 3) * 10 * (audio.paused ? 0.2 : 1);
          if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
        }
      }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    }
    audio.addEventListener('play', connect);
    draw();
    return () => cancelAnimationFrame(raf);
  }

  function mountChannel(opts) {
    paintStatic(opts.staticCanvas);
    const audio = opts.root.querySelector('audio');
    const wave = opts.root.querySelector('.pub-wave');
    if (audio && wave) attachWave(audio, wave);
  }

  window.EdiffPub = { mountIndex, mountChannel, kindOf, paintStatic };
})();
