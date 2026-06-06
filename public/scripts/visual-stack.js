(function (global) {
  "use strict";

  var THEMES = ["archive", "rgb", "copper", "paper"];
  var THEME_INDEX = { archive: 0, rgb: 1, copper: 2, paper: 3 };
  var THEME_COLORS = {
    archive: "#0a0a0a",
    rgb: "#000000",
    copper: "#12081a",
    paper: "#12100c"
  };
  var THEME_LABELS = {
    archive: "MONO",
    rgb: "RGB",
    copper: "COPPER",
    paper: "PAPER"
  };
  var STORAGE_KEY = "ediff_theme";
  var BOOT_KEY = "ediff_boot_seen";

  var VERTEX_SHADER = [
    "void main() {",
    "  gl_Position = vec4(position, 1.0);",
    "}"
  ].join("\n");

  var FRAGMENT_SHADER = [
    "#ifdef GL_ES",
    "precision mediump float;",
    "#endif",
    "uniform float time;",
    "uniform vec2 resolution;",
    "uniform vec2 mouse;",
    "uniform int uTheme;",
    "float bayer4(vec2 p) {",
    "  float x = mod(floor(p.x), 4.0);",
    "  float y = mod(floor(p.y), 4.0);",
    "  float v = 0.0;",
    "  if (y < 0.5) {",
    "    if (x < 0.5) v = 0.0; else if (x < 1.5) v = 8.0; else if (x < 2.5) v = 2.0; else v = 10.0;",
    "  } else if (y < 1.5) {",
    "    if (x < 0.5) v = 12.0; else if (x < 1.5) v = 4.0; else if (x < 2.5) v = 14.0; else v = 6.0;",
    "  } else if (y < 2.5) {",
    "    if (x < 0.5) v = 3.0; else if (x < 1.5) v = 11.0; else if (x < 2.5) v = 1.0; else v = 9.0;",
    "  } else {",
    "    if (x < 0.5) v = 15.0; else if (x < 1.5) v = 7.0; else if (x < 2.5) v = 13.0; else v = 5.0;",
    "  }",
    "  return v / 16.0;",
    "}",
    "vec3 hardMono(float t, int theme) {",
    "  float bands = step(0.22, t) + step(0.44, t) + step(0.66, t);",
    "  float g = bands / 3.0;",
    "  if (theme == 2) return vec3(g, g * 0.78, g * 0.48);",
    "  if (theme == 3) return vec3(g * 0.72, g * 0.76, g * 0.8);",
    "  return vec3(g);",
    "}",
    "void main(void) {",
    "  vec2 fMosaicScal = vec2(1.4, 2.0);",
    "  vec2 vScreenSize = vec2(resolution.x, resolution.y);",
    "  vec2 uv = gl_FragCoord.xy / resolution.xy;",
    "  vec2 m = mouse / resolution.xy;",
    "  vec2 toMouse = uv - m;",
    "  float mouseGlow = exp(-dot(toMouse, toMouse) * 14.0);",
    "  vec3 u = normalize(vec3(2.0 * gl_FragCoord.xy - resolution.xy, resolution.xy.x)) * 0.9;",
    "  u.xy += (m - 0.5) * 0.35;",
    "  u.x = floor(u.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);",
    "  u.y = floor(u.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);",
    "  u.z = floor(u.z * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);",
    "  float field = 0.0;",
    "  vec4 o = vec4(0.0);",
    "  for (float i = 0.0; i < 2.0; i++) {",
    "    u.y += abs(cos(u.y * i * 2.1) * 0.1);",
    "    u.z += abs(cos(u.x * u.y - time * 0.01));",
    "    u += abs(cos(u * i * 0.1) * 0.1);",
    "    field = max(field, abs(cos(3.0 * dot(u, u))));",
    "    o = max(o, abs(cos(3.0 * dot(u, u) + vec4(0.0))));",
    "  }",
    "  if (uTheme == 1) {",
    "    gl_FragColor = vec4(o.rgb, 1.0);",
    "    return;",
    "  }",
    "  field = field * 0.68 + mouseGlow * 0.36;",
    "  float dither = bayer4(gl_FragCoord.xy);",
    "  float level = field + (dither - 0.5) * 0.34;",
    "  level = clamp(level, 0.0, 1.0);",
    "  vec3 col = hardMono(level, uTheme);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  if (global.EdiffShaderFx && global.EdiffShaderFx.patchFragment) {
    FRAGMENT_SHADER = global.EdiffShaderFx.patchFragment(FRAGMENT_SHADER);
  }

  var MOSH_TARGET_MODE = {
    grain: "grain",
    drift: "drift",
    hue: "chroma",
    rgb: "rgb",
    cell: "jpeg",
    gate: "strip",
    net: "net",
    rec: "macroblock",
    release: "strip",
    limit: "jpeg"
  };

  var root = document.documentElement;
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  var smallViewport = window.innerWidth < 700;
  var performanceMode = reducedMotion || coarsePointer || smallViewport;
  var skipWebGL = performanceMode;

  var state = {
    theme: "archive",
    pointerX: 0.5,
    pointerY: 0.5,
    hue: 0,
    tear: 0.18,
    pulse: 0.22,
    audio: 0,
    lastFrame: 0,
    moshMode: "strip",
    moshIntensity: 1
  };

  var mediaMosh = {
    stacks: [],
    activeImg: null
  };

  var webgl = {
    renderer: null,
    uniforms: null,
    targetMouse: { x: 0, y: 0 },
    raf: 0,
    paused: false
  };

  function readStoredTheme() {
    try {
      var t = localStorage.getItem(STORAGE_KEY);
      if (t && THEME_INDEX[t] !== undefined) return t;
      if (t === "cga") return "archive";
    } catch (e) { /* ignore */ }
    return "archive";
  }

  function setMetaThemeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.archive);
  }

  function applyTheme(theme, skipStore) {
    if (THEME_INDEX[theme] === undefined) theme = "archive";
    state.theme = theme;
    root.setAttribute("data-theme", theme);
    setMetaThemeColor(theme);
    if (!skipStore) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore */ }
    }
    if (webgl.uniforms && webgl.uniforms.uTheme) {
      webgl.uniforms.uTheme.value = THEME_INDEX[theme];
    }
    if (global.EdiffGlitchHeading) {
      global.EdiffGlitchHeading.intensifyRgb(theme);
      global.EdiffGlitchHeading.pulse(reducedMotion);
    } else {
      themeGlitchPulse();
    }
  }

  function themeGlitchPulse() {
    if (reducedMotion || typeof anime === "undefined") return;
    anime({
      targets: ".ediff-heading",
      translateX: [{ value: anime.random(-5, 5) }, { value: 0 }],
      duration: 380,
      easing: "easeOutQuad"
    });
  }

  function cycleTheme(dir) {
    var idx = THEMES.indexOf(state.theme);
    if (idx < 0) idx = 0;
    idx = (idx + (dir || 1) + THEMES.length) % THEMES.length;
    applyTheme(THEMES[idx]);
  }

  function initThemeUi() {
    document.addEventListener("keydown", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "t" || e.key === "T") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          cycleTheme(1);
        }
      }
    });
    applyTheme(readStoredTheme(), true);
  }

  function initBoot() {
    var overlay = document.getElementById("bootOverlay");
    var enter = document.getElementById("bootEnter");
    if (!overlay || reducedMotion) return;
    try {
      if (sessionStorage.getItem(BOOT_KEY) === "1") return;
    } catch (e) { /* ignore */ }
    overlay.hidden = false;
    function dismiss() {
      overlay.hidden = true;
      try { sessionStorage.setItem(BOOT_KEY, "1"); } catch (e) { /* ignore */ }
    }
    if (enter) enter.addEventListener("click", dismiss);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) dismiss();
    });
  }

  function initWebGL() {
    if (skipWebGL || typeof THREE === "undefined") return;
    var host = document.getElementById("glHost");
    if (!host) return;

    var camera = new THREE.Camera();
    var scene = new THREE.Scene();
    var renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    var dpr = Math.min(window.devicePixelRatio || 1, performanceMode ? 1 : 1.5);
    renderer.setPixelRatio(dpr);

    webgl.uniforms = {
      time: { type: "f", value: 3.0 },
      resolution: { type: "v2", value: new THREE.Vector2() },
      mouse: { type: "v2", value: new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5) },
      uTheme: { type: "i", value: THEME_INDEX[state.theme] }
    };
    if (global.EdiffShaderFx && global.EdiffShaderFx.extendWebglUniforms) {
      global.EdiffShaderFx.extendWebglUniforms(webgl.uniforms);
    }

    webgl.targetMouse.x = window.innerWidth * 0.5;
    webgl.targetMouse.y = window.innerHeight * 0.5;

    var geometry = new THREE.PlaneBufferGeometry(4, 2);
    var material = new THREE.ShaderMaterial({
      uniforms: webgl.uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER
    });
    scene.add(new THREE.Mesh(geometry, material));
    host.appendChild(renderer.domElement);
    webgl.renderer = renderer;

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      webgl.uniforms.resolution.value.x = renderer.domElement.width;
      webgl.uniforms.resolution.value.y = renderer.domElement.height;
    }

    function render() {
      webgl.raf = requestAnimationFrame(render);
      if (webgl.paused || document.hidden) return;
      if (!reducedMotion) webgl.uniforms.time.value += 0.01;
      webgl.uniforms.mouse.value.x += (webgl.targetMouse.x - webgl.uniforms.mouse.value.x) * 0.12;
      webgl.uniforms.mouse.value.y += (webgl.targetMouse.y - webgl.uniforms.mouse.value.y) * 0.12;
      if (global.EdiffShaderFx && global.EdiffShaderFx.applyUniforms) {
        global.EdiffShaderFx.applyUniforms(webgl.uniforms, state);
      }
      renderer.render(scene, camera);
    }

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", function () {
      webgl.paused = document.hidden;
    });
    resize();
    if (reducedMotion) {
      webgl.uniforms.time.value += 0.5;
      renderer.render(scene, camera);
    } else {
      render();
    }
  }

  function updatePointer(event) {
    if (event.clientX == null || event.clientY == null) return;
    state.pointerX = Math.max(0, Math.min(1, event.clientX / Math.max(1, window.innerWidth)));
    state.pointerY = Math.max(0, Math.min(1, event.clientY / Math.max(1, window.innerHeight)));
    webgl.targetMouse.x = event.clientX;
    webgl.targetMouse.y = window.innerHeight - event.clientY;
  }

  function initCanvas2d() {
    var canvas = document.getElementById("diffusionCanvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d", { alpha: true });
    var dprLimit = performanceMode ? 1 : 1.35;
    var diffusionPalette = ["#000000", "#222222", "#666666", "#bbbbbb", "#ffffff"];
    var bayer4 = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ];
    var trailGrid = null;
    var trailCols = 0;
    var trailRows = 0;

    function paletteLevel(value, px, py) {
      var dither = (bayer4[py & 3][px & 3] + 0.5) / 16;
      var v = value + (dither - 0.5) * 0.22;
      var idx = Math.max(0, Math.min(diffusionPalette.length - 1, Math.floor(v * diffusionPalette.length)));
      return diffusionPalette[idx];
    }

    function resizeCanvas() {
      var dpr = Math.min(window.devicePixelRatio || 1, dprLimit);
      var width = Math.max(1, Math.floor(window.innerWidth * dpr));
      var height = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    }

    function drawDiffusion(now) {
      if (!ctx) return;
      var frameGap = performanceMode ? 90 : 48;
      if (now - state.lastFrame < frameGap) {
        requestAnimationFrame(drawDiffusion);
        return;
      }
      state.lastFrame = now;
      resizeCanvas();
      var width = canvas.width;
      var height = canvas.height;
      var t = now * 0.001;
      var cell = performanceMode ? 18 : 11;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
      var gradient = ctx.createRadialGradient(
        width * state.pointerX, height * state.pointerY, 0,
        width * state.pointerX, height * state.pointerY, Math.max(width, height) * 0.62
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, " + (0.2 + state.audio * 0.18).toFixed(3) + ")");
      gradient.addColorStop(0.35, "rgba(170, 170, 170, " + (0.12 + state.audio * 0.1).toFixed(3) + ")");
      gradient.addColorStop(0.7, "rgba(68, 68, 68, 0.08)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      var cols = Math.ceil(width / cell);
      var rows = Math.ceil(height / cell);
      if (!trailGrid || trailCols !== cols || trailRows !== rows) {
        trailCols = cols;
        trailRows = rows;
        trailGrid = new Float32Array(cols * rows);
      }
      for (var ti = 0; ti < trailGrid.length; ti += 1) {
        trailGrid[ti] *= 0.92;
      }
      for (var y = 0; y < rows; y += 1) {
        for (var x = 0; x < cols; x += 1) {
          var wave = Math.sin(x * 0.47 + t * 1.8) + Math.cos(y * 0.36 - t * 1.35);
          var dist = Math.hypot((x / cols) - state.pointerX, (y / rows) - state.pointerY);
          var mouseBoost = Math.max(0, 0.42 - dist * 0.55);
          var field = wave * 0.18 + 0.42 + mouseBoost + state.audio * 0.22 + Math.sin(t + y * 0.2) * 0.08;
          var threshold = 0.22 + state.audio * 0.18 + Math.sin(t + y * 0.2) * 0.09;
          var tIdx = y * cols + x;
          if (mouseBoost > 0.12) trailGrid[tIdx] = Math.min(1, trailGrid[tIdx] + mouseBoost * 0.35);
          field += trailGrid[tIdx] * 0.28;
          if (x > 0) field += trailGrid[tIdx - 1] * 0.08;
          if (y > 0) field += trailGrid[tIdx - cols] * 0.08;
          if (field > threshold) {
            var level = Math.max(0, Math.min(1, field - threshold + 0.35 - dist * 0.12));
            var alpha = Math.max(0.12, Math.min(0.92, 0.28 - dist * 0.14 + state.audio * 0.24 + level * 0.35));
            ctx.fillStyle = paletteLevel(level, x, y);
            ctx.globalAlpha = alpha;
            ctx.fillRect(x * cell + Math.sin(t + y) * 3, y * cell, Math.max(2, cell - 2), Math.max(2, cell - 2));
            ctx.globalAlpha = 1;
          }
        }
      }

      ctx.globalCompositeOperation = "screen";
      for (var i = 0; i < 6; i += 1) {
        var bandY = (Math.sin(t * (0.6 + i * 0.05) + i) * 0.5 + 0.5) * height;
        var drift = (state.tear - 0.5) * width * 0.04;
        ctx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.06)" : "rgba(102, 102, 102, 0.08)";
        ctx.fillRect(drift - width * 0.03, bandY, width * 1.08, Math.max(1, 2 + i % 3));
      }
      ctx.globalCompositeOperation = "source-over";
      requestAnimationFrame(drawDiffusion);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    requestAnimationFrame(drawDiffusion);
  }

  function initFxBus() {
    var fxEntries = [
      { key: "/3/fader1", label: "FX FUN 1", target: "grain" },
      { key: "/3/fader2", label: "FX FUN 2", target: "drift" },
      { key: "/3/fader5", label: "COLOR CHANGE R", target: "hue" },
      { key: "/3/fader8", label: "SHIFT X1", target: "rgb" },
      { key: "/3/fader12", label: "SCALE", target: "cell" },
      { key: "/3/toggle7", label: "BYPASS CURTIS MAXPATCH", target: "gate" },
      { key: "jit.net.recv", label: "matrix receiver", target: "net" },
      { key: "record~ curtis 2", label: "buffer capture", target: "rec" },
      { key: "release_time 120", label: "limiter release", target: "release" },
      { key: "threshold 0.125", label: "gain clamp", target: "limit" }
    ];

    var fxGrid = document.getElementById("fxGrid");
    var terminalLog = document.getElementById("terminalLog");
    var signalMeter = document.getElementById("signalMeter");
    var audio = document.getElementById("audioBus");
    var armAudio = document.getElementById("armAudio");
    var audioContext = null;
    var analyser = null;
    var frequencyData = null;

    function cssNumber(name, value, unit) {
      root.style.setProperty(name, String(value) + (unit || ""));
    }

    function renderFxGrid() {
      if (!fxGrid) return;
      fxEntries.forEach(function (entry) {
        var cellEl = document.createElement("div");
        cellEl.className = "fx-cell";
        cellEl.innerHTML =
          '<div class="max-ports-top"><span class="max-port"></span><span class="max-port"></span></div>' +
          '<div class="max-body">' +
          '<span class="fx-key"></span>' +
          '<span class="fx-label"></span>' +
          '<span class="fx-value"></span>' +
          '</div>' +
          '<div class="max-ports-bot"><span class="max-port out"></span><span class="max-port out"></span></div>';
        var body = cellEl.querySelector(".max-body");
        body.querySelector(".fx-key").textContent = entry.key;
        body.querySelector(".fx-label").textContent = entry.label;
        body.querySelector(".fx-value").textContent = "0.000";
        fxGrid.appendChild(cellEl);
      });
    }

    function updateFx(now) {
      var t = now * 0.001;
      state.pulse = Math.max(0.08, Math.min(0.46, 0.18 + state.audio * 0.3 + Math.sin(t * 0.5) * 0.025));
      var targetTear = Math.max(0.08, Math.min(0.38, state.pointerX * 0.22 + state.audio * 0.16 + 0.08));
      state.tear += (targetTear - state.tear) * 0.08;
      state.hue = (state.pointerY * 90 + state.audio * 70 + t * 2.5) % 360;
      var rgb = 2 + state.tear * 5 + state.audio * 4;
      var cell = 6 + Math.round((1 - state.pointerY) * 14 + state.audio * 8);
      cssNumber("--hue", state.hue.toFixed(2), "deg");
      cssNumber("--tear", state.tear.toFixed(3), "");
      cssNumber("--pulse", state.pulse.toFixed(3), "");
      cssNumber("--rgb-shift", rgb.toFixed(2), "px");
      cssNumber("--diffusion-cell", cell, "px");
      if (global.EdiffVhs && global.EdiffVhs.sync) {
        global.EdiffVhs.sync(state);
      }
      if (fxGrid) {
        var activeEntry = fxEntries[Math.abs(Math.floor((t * 1.2 + state.pointerX * 10 + state.audio * 10))) % fxEntries.length];
        var nextMode = MOSH_TARGET_MODE[activeEntry.target] || "strip";
        if (nextMode !== state.moshMode) {
          state.moshMode = nextMode;
          mediaMosh.stacks.forEach(function (s) {
            if (s.setMode) s.setMode(nextMode);
          });
        }
        state.moshIntensity = Math.max(0.35, Math.min(1.4, 0.5 + state.audio * 0.5 + state.tear));
        mediaMosh.stacks.forEach(function (s) {
          if (s.setIntensity) s.setIntensity(state.moshIntensity);
        });
      }
      if (signalMeter) {
        signalMeter.textContent =
          THEME_LABELS[state.theme] + " :: rgb " + String(Math.round(rgb)).padStart(2, "0") +
          " / drift " + Math.round(state.tear * 99);
      }

      if (fxGrid) {
        var activeIndex = Math.abs(Math.floor((t * 1.2 + state.pointerX * 10 + state.audio * 10))) % fxEntries.length;
        Array.from(fxGrid.children).forEach(function (cellNode, idx) {
          var entry = fxEntries[idx];
          var phase = (Math.sin(t * (0.6 + idx * 0.11) + idx + state.pointerX * 4) + 1) * 0.5;
          var value = Math.max(0, Math.min(1, phase * 0.66 + state.audio * 0.34));
          cellNode.classList.toggle("active", idx === activeIndex || value > 0.78);
          cellNode.querySelector(".max-body .fx-value").textContent = value.toFixed(3) + " :: " + entry.target;
        });
        if (terminalLog) {
          var activeEntry = fxEntries[activeIndex];
          terminalLog.innerHTML =
            "<strong>ediff-router:</strong> " + activeEntry.key + " -> " + activeEntry.label +
            " :: theme " + state.theme + " :: hue " + Math.round(state.hue) +
            " :: cell " + cell + " :: audio " + state.audio.toFixed(3);
        }
      }
      requestAnimationFrame(updateFx);
    }

    function readAudioLevel() {
      if (!analyser || !frequencyData) {
        state.audio *= 0.94;
        requestAnimationFrame(readAudioLevel);
        return;
      }
      analyser.getByteFrequencyData(frequencyData);
      var sum = 0;
      for (var i = 0; i < frequencyData.length; i += 1) sum += frequencyData[i];
      state.audio = Math.min(1, (sum / frequencyData.length) / 190);
      requestAnimationFrame(readAudioLevel);
    }

    function armAudioBus() {
      if (!audio || !armAudio) return;
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      Promise.resolve().then(function () {
        if (!audioContext) {
          audioContext = new AudioCtx();
          var source = audioContext.createMediaElementSource(audio);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 128;
          frequencyData = new Uint8Array(analyser.frequencyBinCount);
          source.connect(analyser);
          analyser.connect(audioContext.destination);
        }
        if (audioContext.state === "suspended") return audioContext.resume();
      }).then(function () {
        armAudio.setAttribute("aria-pressed", "true");
        armAudio.textContent = "bus armed";
        if (audio.paused) return audio.play();
      }).catch(function () {
        armAudio.textContent = "bus blocked";
      });
    }

    renderFxGrid();
    if (armAudio) armAudio.addEventListener("click", armAudioBus);
    requestAnimationFrame(updateFx);
    requestAnimationFrame(readAudioLevel);
  }

  function initHeadings() {
    if (global.EdiffType && global.EdiffType.scanHeadings) {
      global.EdiffType.scanHeadings(document);
    }
    var nodes = document.querySelectorAll(
      ".section-head h2, .media-card h3, .archive-card h3, .hero-title"
    );
    nodes.forEach(function (el) {
      if (!el.classList.contains("anime-wait")) {
        el.classList.add("anime-wait");
      }
    });
  }

  function initMediaMosh() {
    if (performanceMode || !global.EdiffMosh) return;
    var stackEl = document.getElementById("mediaStack");
    if (!stackEl) return;
    var imgs = stackEl.querySelectorAll(".media-plane img");
    function attach(img) {
      if (!img || img.dataset.moshStack === "1") return;
      var created = global.EdiffMosh.createMoshStack(img, {
        mode: state.moshMode,
        intensity: state.moshIntensity
      });
      if (created) mediaMosh.stacks.push(created);
    }
    imgs.forEach(function (img) {
      if (img.complete && img.naturalWidth) attach(img);
      else img.addEventListener("load", function () { attach(img); }, { once: true });
    });
    var activePlane = stackEl.querySelector(".media-plane.active img");
    if (activePlane) setActiveMoshPlane(activePlane);
  }

  function setActiveMoshPlane(img) {
    mediaMosh.activeImg = img;
    if (global.EdiffMosh && global.EdiffMosh.setActiveForPlane) {
      global.EdiffMosh.setActiveForPlane(img);
    }
    mediaMosh.stacks.forEach(function (s) {
      if (!s.wrap) return;
      s.wrap.style.opacity = s.img === img ? "1" : "0";
      s.wrap.style.pointerEvents = "none";
    });
  }

  function syncMediaCaption(plane) {
    var caption = document.getElementById("screenCaption");
    if (!caption || !plane) return;
    var text = plane.getAttribute("data-caption");
    if (!text) {
      var img = plane.querySelector("img");
      text = img ? img.getAttribute("alt") : "";
    }
    if (text) caption.textContent = text;
  }

  function initMediaCarousel() {
    var stack = document.getElementById("mediaStack");
    if (!stack) return;
    var planes = stack.querySelectorAll(".media-plane");
    if (planes.length < 2) {
      var soloPlane = stack.querySelector(".media-plane.active, .media-plane");
      var solo = soloPlane ? soloPlane.querySelector("img") : null;
      if (solo) setActiveMoshPlane(solo);
      syncMediaCaption(soloPlane);
      return;
    }
    var firstPlane = stack.querySelector(".media-plane.active") || planes[0];
    syncMediaCaption(firstPlane);
    if (reducedMotion) {
      var firstImg = firstPlane ? firstPlane.querySelector("img") : stack.querySelector(".media-plane img");
      if (firstImg) setActiveMoshPlane(firstImg);
      return;
    }
    var idx = 0;
    setInterval(function () {
      planes[idx].classList.remove("active");
      idx = (idx + 1) % planes.length;
      planes[idx].classList.add("active");
      var img = planes[idx].querySelector("img");
      if (img) setActiveMoshPlane(img);
      syncMediaCaption(planes[idx]);
      if (global.EdiffVhs && global.EdiffVhs.burst) global.EdiffVhs.burst();
      root.style.setProperty("--tear", String(Math.min(0.42, state.tear + 0.06)));
      var activePlane = planes[idx];
      if (activePlane) activePlane.style.filter = "url(#filter-discrete)";
      setTimeout(function () {
        if (activePlane) activePlane.style.filter = "";
      }, 380);
    }, 8200);
  }

  function initAnime() {
    if (reducedMotion || typeof anime === "undefined") return;
    var headings = document.querySelectorAll(".ediff-heading.anime-wait");
    anime({
      targets: headings,
      opacity: [0, 1],
      translateY: [10, 0],
      delay: anime.stagger(70, { start: 120 }),
      duration: 820,
      easing: "easeOutExpo",
      complete: function () {
        headings.forEach(function (el) { el.classList.remove("anime-wait"); });
      }
    });
    anime({
      targets: ".hero .panel, #fx-bank .patch-matrix",
      translateX: function () { return anime.random(-1, 1); },
      translateY: function () { return anime.random(-1, 1); },
      direction: "alternate",
      loop: true,
      duration: 4200,
      easing: "easeInOutSine"
    });
  }

  function boot() {
    initHeadings();
    if (global.EdiffTextScramble && global.EdiffTextScramble.initHeadings) {
      global.EdiffTextScramble.initHeadings(document);
    }
    if (global.EdiffSplitChrome && global.EdiffSplitChrome.boot) {
      global.EdiffSplitChrome.boot();
    }
    initThemeUi();
    initBoot();
    initWebGL();
    initCanvas2d();
    initFxBus();
    initMediaMosh();
    initMediaCarousel();
    initAnime();
    window.addEventListener("pointermove", updatePointer, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.EdiffVisual = {
    THEMES: THEMES,
    getTheme: function () { return state.theme; },
    setTheme: applyTheme,
    cycleTheme: cycleTheme,
    state: state,
    mosh: mediaMosh,
    setMoshIntensity: function (n) {
      state.moshIntensity = n;
      mediaMosh.stacks.forEach(function (s) {
        if (s.setIntensity) s.setIntensity(n);
      });
    },
    setMoshMode: function (mode) {
      state.moshMode = mode;
      mediaMosh.stacks.forEach(function (s) {
        if (s.setMode) s.setMode(mode);
      });
    },
    setActiveMoshPlane: setActiveMoshPlane,
    type: global.EdiffType || null
  };
})(typeof window !== "undefined" ? window : this);
