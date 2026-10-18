(function () {
  "use strict";

  var canvas = document.getElementById("outputCanvas");
  var stageShell = document.getElementById("stageShell");
  var sourceGrid = document.getElementById("sourceGrid");
  var sourceTemplate = document.getElementById("sourceTemplate");
  var fileInput = document.getElementById("fileInput");
  var cameraSelect = document.getElementById("cameraSelect");
  var inputNotice = document.getElementById("inputNotice");
  var engineStatus = document.getElementById("engineStatus");
  var stageError = document.getElementById("stageError");
  var busReadout = document.getElementById("busReadout");
  var frameReadout = document.getElementById("frameReadout");
  var presetReadout = document.getElementById("presetReadout");
  var recordReadout = document.getElementById("recordReadout");
  var recordButton = document.getElementById("recordButton");
  var freezeButton = document.getElementById("freezeButton");
  var memorySummary = document.getElementById("memorySummary");
  var resolutionSelect = document.getElementById("resolutionSelect");
  var blendSelect = document.getElementById("blendSelect");
  var helpDialog = document.getElementById("helpDialog");
  var macroverseDialog = document.getElementById("macroverseDialog");
  var macroverseForm = document.getElementById("macroverseForm");
  var macroverseSession = document.getElementById("macroverseSession");
  var macroverseStatus = document.getElementById("macroverseStatus");

  var SLOT_COUNT = 4;
  var STORAGE_KEY = "ediff-vj-state-v1";
  var slots = [];
  var busA = 0;
  var busB = 1;
  var pendingSlot = null;
  var dragDepth = 0;
  var recorder = null;
  var recordChunks = [];
  var recordingStarted = 0;
  var recordClock = 0;
  var activePreset = "residue";

  var params = {
    feedback: 0.84,
    motion: 0.58,
    smear: 0.46,
    blocks: 0.54,
    dropout: 0.12,
    mix: 0.5,
    chroma: 0.34,
    melt: 0.22,
    noise: 0.08,
    contrast: 1.12
  };

  var presets = {
    residue: {
      feedback: 0.84, motion: 0.58, smear: 0.46, blocks: 0.54, dropout: 0.12,
      mix: 0.5, chroma: 0.34, melt: 0.22, noise: 0.08, contrast: 1.12, blend: 0
    },
    macro: {
      feedback: 0.91, motion: 0.76, smear: 0.38, blocks: 0.88, dropout: 0.34,
      mix: 0.42, chroma: 0.2, melt: 0.3, noise: 0.05, contrast: 1.2, blend: 3
    },
    melt: {
      feedback: 0.94, motion: 0.84, smear: 0.82, blocks: 0.42, dropout: 0.08,
      mix: 0.58, chroma: 0.26, melt: 0.92, noise: 0.04, contrast: 1.1, blend: 0
    },
    split: {
      feedback: 0.8, motion: 0.64, smear: 0.32, blocks: 0.3, dropout: 0.04,
      mix: 0.5, chroma: 0.96, melt: 0.16, noise: 0.1, contrast: 1.28, blend: 1
    },
    packet: {
      feedback: 0.96, motion: 0.72, smear: 0.58, blocks: 0.72, dropout: 0.78,
      mix: 0.52, chroma: 0.44, melt: 0.5, noise: 0.16, contrast: 1.32, blend: 2
    },
    clean: {
      feedback: 0, motion: 0, smear: 0, blocks: 0, dropout: 0,
      mix: 0.5, chroma: 0, melt: 0, noise: 0, contrast: 1, blend: 0
    }
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function shortName(name, max) {
    var clean = String(name || "source").replace(/\.[^.]+$/, "");
    if (clean.length <= max) return clean;
    return clean.slice(0, Math.max(1, max - 1)) + "...";
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "live";
    var mins = Math.floor(seconds / 60);
    var secs = Math.floor(seconds % 60);
    return mins + ":" + String(secs).padStart(2, "0");
  }

  function setStatus(text, state) {
    engineStatus.textContent = text;
    engineStatus.dataset.state = state || "idle";
  }

  function showError(message) {
    stageError.hidden = false;
    stageError.textContent = message;
    setStatus("engine: unavailable", "error");
  }

  function showInputNotice(message, state) {
    if (!inputNotice) return;
    inputNotice.hidden = !message;
    inputNotice.textContent = message || "";
    inputNotice.dataset.state = state || "info";
  }

  function hideError() {
    stageError.hidden = true;
    stageError.textContent = "";
  }

  function routeName(index) {
    var slot = slots[index];
    return slot && slot.source ? shortName(slot.name, 18).toUpperCase() : "INTERNAL";
  }

  function updateBusUi() {
    slots.forEach(function (slot, index) {
      var isA = index === busA;
      var isB = index === busB;
      slot.card.dataset.busA = String(isA);
      slot.card.dataset.busB = String(isB);
      slot.routeA.setAttribute("aria-pressed", String(isA));
      slot.routeB.setAttribute("aria-pressed", String(isB));
    });
    busReadout.textContent = "A: " + routeName(busA) + " / B: " + routeName(busB);
  }

  function paintEmptyPreview(slot) {
    var ctx = slot.previewContext;
    var w = slot.preview.width;
    var h = slot.preview.height;
    ctx.fillStyle = "#080b08";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(202,255,0,.12)";
    ctx.lineWidth = 1;
    for (var x = 0; x < w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (var y = 0; y < h; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(202,255,0,.55)";
    ctx.font = "12px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("NO INPUT", w / 2, h / 2 + 4);
  }

  function createSlots() {
    for (var index = 0; index < SLOT_COUNT; index += 1) {
      var fragment = sourceTemplate.content.cloneNode(true);
      var card = fragment.querySelector(".source-card");
      var preview = fragment.querySelector("canvas");
      var slot = {
        index: index,
        card: card,
        preview: preview,
        previewContext: preview.getContext("2d"),
        routeA: fragment.querySelector(".route-a"),
        routeB: fragment.querySelector(".route-b"),
        clearButton: fragment.querySelector(".slot-clear"),
        nameElement: fragment.querySelector(".source-name"),
        metaElement: fragment.querySelector(".source-meta"),
        typeElement: fragment.querySelector(".source-type"),
        source: null,
        stream: null,
        objectUrl: "",
        cleanup: null,
        kind: "empty",
        name: "open input",
        ready: false
      };

      card.dataset.slot = String(index);
      fragment.querySelector(".slot-number").textContent = "0" + (index + 1);
      slot.routeA.addEventListener("click", function (slotIndex) {
        return function () {
          busA = slotIndex;
          updateBusUi();
        };
      }(index));
      slot.routeB.addEventListener("click", function (slotIndex) {
        return function () {
          busB = slotIndex;
          updateBusUi();
        };
      }(index));
      slot.clearButton.addEventListener("click", function (slotIndex) {
        return function () {
          clearSlot(slotIndex);
        };
      }(index));
      preview.parentElement.addEventListener("click", function (slotIndex) {
        return function () {
          pendingSlot = slotIndex;
          fileInput.click();
        };
      }(index));
      preview.parentElement.title = "Click to load a file into this slot";
      sourceGrid.appendChild(fragment);
      slots.push(slot);
      paintEmptyPreview(slot);
    }
    updateBusUi();
  }

  function stopSource(slot) {
    if (slot.cleanup) {
      try {
        slot.cleanup();
      } catch (error) {}
    }
    if (slot.source && slot.source.tagName === "VIDEO") {
      try {
        slot.source.pause();
        slot.source.removeAttribute("src");
        slot.source.load();
      } catch (error) {}
    }
    if (slot.stream) {
      slot.stream.getTracks().forEach(function (track) {
        track.stop();
      });
    }
    if (slot.objectUrl) {
      URL.revokeObjectURL(slot.objectUrl);
    }
    slot.source = null;
    slot.stream = null;
    slot.objectUrl = "";
    slot.cleanup = null;
    slot.kind = "empty";
    slot.name = "open input";
    slot.ready = false;
  }

  function clearSlot(index) {
    var slot = slots[index];
    if (!slot) return;
    stopSource(slot);
    slot.nameElement.textContent = "open input";
    slot.metaElement.textContent = "drop media here";
    slot.typeElement.textContent = "empty";
    paintEmptyPreview(slot);
    updateBusUi();
  }

  function setSlotSource(index, source, options) {
    var slot = slots[index];
    stopSource(slot);
    slot.source = source;
    slot.kind = options.kind;
    slot.name = options.name;
    slot.stream = options.stream || null;
    slot.objectUrl = options.objectUrl || "";
    slot.cleanup = options.cleanup || null;
    slot.ready = true;
    slot.nameElement.textContent = shortName(options.name, 30);
    slot.metaElement.textContent = options.meta || options.kind;
    slot.typeElement.textContent = options.kind;
    updateBusUi();
  }

  function slotForLoad(offset) {
    if (pendingSlot !== null && offset === 0) return pendingSlot;
    for (var i = 0; i < SLOT_COUNT; i += 1) {
      var candidate = (i + offset) % SLOT_COUNT;
      if (!slots[candidate].source) return candidate;
    }
    return (busA + offset) % SLOT_COUNT;
  }

  function loadFileIntoSlot(file, index) {
    if (!file || !slots[index]) return;
    var type = file.type || "";
    var objectUrl = URL.createObjectURL(file);

    if (type.indexOf("video/") === 0) {
      var video = document.createElement("video");
      video.src = objectUrl;
      video.loop = true;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "auto";
      video.addEventListener("loadedmetadata", function () {
        setSlotSource(index, video, {
          kind: "video",
          name: file.name,
          objectUrl: objectUrl,
          meta: video.videoWidth + "x" + video.videoHeight + " / " + formatDuration(video.duration)
        });
        video.play().catch(function () {
          slots[index].metaElement.textContent = "click stage to start";
        });
      }, { once: true });
      video.addEventListener("error", function () {
        URL.revokeObjectURL(objectUrl);
        slots[index].metaElement.textContent = "codec not supported";
      }, { once: true });
      return;
    }

    if (type.indexOf("image/") === 0) {
      var image = new Image();
      image.decoding = "async";
      image.addEventListener("load", function () {
        setSlotSource(index, image, {
          kind: "image",
          name: file.name,
          objectUrl: objectUrl,
          meta: image.naturalWidth + "x" + image.naturalHeight + " / still"
        });
      }, { once: true });
      image.addEventListener("error", function () {
        URL.revokeObjectURL(objectUrl);
        slots[index].metaElement.textContent = "image not supported";
      }, { once: true });
      image.src = objectUrl;
      return;
    }

    URL.revokeObjectURL(objectUrl);
  }

  function loadFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (file) {
      return /^video\//.test(file.type) || /^image\//.test(file.type);
    });
    files.slice(0, SLOT_COUNT).forEach(function (file, offset) {
      loadFileIntoSlot(file, slotForLoad(offset));
    });
    pendingSlot = null;
    fileInput.value = "";
  }

  function firstOpenSlot() {
    for (var i = 0; i < slots.length; i += 1) {
      if (!slots[i].source) return i;
    }
    return busA;
  }

  function cameraErrorMessage(error) {
    var name = error && error.name ? error.name : "CameraError";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "Camera permission was blocked. Allow camera access for errordiffusion.net in the browser site controls, then try again.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "No camera was found. Connect one, or choose another device from the camera menu.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "The camera is busy or could not start. Close other camera apps and try again.";
    }
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      return "That camera could not supply the requested mode. Choose default camera and try again.";
    }
    return "Camera failed: " + name + (error && error.message ? " / " + error.message : "");
  }

  function refreshCameraDevices() {
    if (!cameraSelect || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve([]);
    }
    var selected = cameraSelect.value;
    return navigator.mediaDevices.enumerateDevices().then(function (devices) {
      var cameras = devices.filter(function (device) { return device.kind === "videoinput"; });
      cameraSelect.innerHTML = "";
      var defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = cameras.length ? "default camera" : "no camera detected";
      cameraSelect.appendChild(defaultOption);
      cameras.forEach(function (device, index) {
        var option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || "camera " + (index + 1);
        cameraSelect.appendChild(option);
      });
      if (selected && cameras.some(function (device) { return device.deviceId === selected; })) {
        cameraSelect.value = selected;
      }
      return cameras;
    }).catch(function () {
      return [];
    });
  }

  function addCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showInputNotice("Camera input is unavailable. It requires a current browser over HTTPS.", "error");
      return;
    }
    if (!window.isSecureContext) {
      showInputNotice("Camera access is blocked because this page is not in a secure browser context.", "error");
      return;
    }
    var index = firstOpenSlot();
    var deviceId = cameraSelect ? cameraSelect.value : "";
    var selectedLabel = cameraSelect && cameraSelect.selectedOptions.length
      ? cameraSelect.selectedOptions[0].textContent
      : "camera " + (index + 1);
    var videoConstraints = deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
    setStatus("engine: requesting camera", "idle");
    showInputNotice("Waiting for browser camera permission...", "info");
    navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false
    }).then(function (stream) {
      var video = document.createElement("video");
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.addEventListener("loadedmetadata", function () {
        if (!slots[index] || slots[index].stream !== stream) return;
        slots[index].metaElement.textContent = video.videoWidth + "x" + video.videoHeight + " / live";
        setStatus("engine: live", "live");
        showInputNotice(selectedLabel + " is live in slot " + (index + 1) + ".", "ok");
      }, { once: true });
      video.srcObject = stream;
      setSlotSource(index, video, {
        kind: "camera",
        name: selectedLabel || "camera " + (index + 1),
        stream: stream,
        meta: "starting camera..."
      });
      var track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener("ended", function () {
          if (slots[index] && slots[index].stream === stream) {
            clearSlot(index);
            showInputNotice("Camera stopped.", "info");
          }
        }, { once: true });
      }
      video.play().catch(function () {
        slots[index].metaElement.textContent = "click output to start";
      });
      refreshCameraDevices();
    }).catch(function (error) {
      setStatus("engine: camera denied", "error");
      showInputNotice(cameraErrorMessage(error), "error");
    });
  }

  function addScreen() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      showError("Screen capture is unavailable in this browser.");
      return;
    }
    var index = firstOpenSlot();
    setStatus("engine: requesting screen", "idle");
    showInputNotice("Choose a screen, window, or browser tab to use as a source.", "info");
    navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30, max: 60 } },
      audio: false
    }).then(function (stream) {
      var video = document.createElement("video");
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.addEventListener("loadedmetadata", function () {
        if (!slots[index] || slots[index].stream !== stream) return;
        slots[index].metaElement.textContent = video.videoWidth + "x" + video.videoHeight + " / live";
        setStatus("engine: live", "live");
        showInputNotice("Screen capture is live in slot " + (index + 1) + ".", "ok");
      }, { once: true });
      video.srcObject = stream;
      setSlotSource(index, video, {
        kind: "screen",
        name: "screen " + (index + 1),
        stream: stream,
        meta: "starting screen..."
      });
      video.play().catch(function () {
        slots[index].metaElement.textContent = "click output to start";
      });
      var track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener("ended", function () {
          if (slots[index] && slots[index].stream === stream) clearSlot(index);
        }, { once: true });
      }
    }).catch(function (error) {
      setStatus("engine: screen cancelled", "idle");
      showInputNotice("Screen capture did not start: " + (error && error.name ? error.name : "cancelled"), "error");
    });
  }

  function openMacroverseDialog() {
    try {
      var saved = localStorage.getItem("ediff-macroverse-session");
      if (saved) macroverseSession.value = saved;
    } catch (error) {}
    macroverseStatus.textContent = "Uses Macroverse's viewer-only live output. Open its VJ deck and load a shader into A or B.";
    if (macroverseDialog.showModal) macroverseDialog.showModal();
    else macroverseDialog.setAttribute("open", "");
  }

  function addMacroverse(sessionId) {
    if (!window.MacroverseInput || typeof window.MacroverseInput.createSource !== "function") {
      showInputNotice("Macroverse input module did not load. Reload the page and try again.", "error");
      return;
    }
    var session = String(sessionId || "default").trim().slice(0, 64) || "default";
    var index = firstOpenSlot();
    var handle;
    function updateMacroverseStatus(state, message) {
      macroverseStatus.textContent = message;
      if (slots[index] && slots[index].source === (handle && handle.canvas)) {
        slots[index].metaElement.textContent = state === "signal" ? "640x360 / live session" : message;
      }
      if (state === "error") {
        showInputNotice(message, "error");
      } else if (state === "signal") {
        showInputNotice("Macroverse session " + session + " is live in slot " + (index + 1) + ".", "ok");
      }
    }
    try {
      handle = window.MacroverseInput.createSource({
        sessionId: session,
        onStatus: updateMacroverseStatus
      });
    } catch (error) {
      showInputNotice("Macroverse input failed: " + (error.message || "WebGL unavailable"), "error");
      return;
    }
    setSlotSource(index, handle.canvas, {
      kind: "macroverse",
      name: "macroverse " + session,
      meta: "connecting to live session...",
      cleanup: handle.close
    });
    busA = index;
    updateBusUi();
    setStatus("engine: macroverse link", "live");
    showInputNotice("Connecting Macroverse session " + session + "...", "info");
    try {
      localStorage.setItem("ediff-macroverse-session", session);
    } catch (error) {}
    handle.ready.then(function () {
      if (macroverseDialog.open) macroverseDialog.close();
    }).catch(function () {
      if (slots[index] && slots[index].source === handle.canvas) clearSlot(index);
    });
  }

  function compileShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var message = gl.getShaderInfoLog(shader) || "Shader compile failed";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    var program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var message = gl.getProgramInfoLog(program) || "Shader link failed";
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  function createTexture(gl) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return texture;
  }

  function VjEngine(targetCanvas) {
    this.canvas = targetCanvas;
    this.gl = targetCanvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance"
    });
    if (!this.gl) throw new Error("WebGL is unavailable. Enable hardware acceleration or use a current desktop browser.");

    this.frozen = false;
    this.frame = 0;
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTime = performance.now();
    this.started = performance.now();
    this.previewTick = 0;
    this.readIndex = 0;
    this.animationFrame = 0;

    var vertexSource = [
      "attribute vec2 a_position;",
      "varying vec2 v_uv;",
      "void main() {",
      "  v_uv = a_position * 0.5 + 0.5;",
      "  gl_Position = vec4(a_position, 0.0, 1.0);",
      "}"
    ].join("\n");

    var effectSource = [
      "precision highp float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_sourceA;",
      "uniform sampler2D u_sourceB;",
      "uniform sampler2D u_history;",
      "uniform vec2 u_resolution;",
      "uniform float u_time;",
      "uniform float u_frame;",
      "uniform float u_hasA;",
      "uniform float u_hasB;",
      "uniform float u_feedback;",
      "uniform float u_motion;",
      "uniform float u_smear;",
      "uniform float u_blocks;",
      "uniform float u_dropout;",
      "uniform float u_mix;",
      "uniform float u_chroma;",
      "uniform float u_melt;",
      "uniform float u_noise;",
      "uniform float u_contrast;",
      "uniform float u_blend;",
      "float hash(vec2 p) {",
      "  p = fract(p * vec2(123.34, 456.21));",
      "  p += dot(p, p + 45.32);",
      "  return fract(p.x * p.y);",
      "}",
      "float luminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }",
      "vec3 internalSignal(vec2 uv, float phase) {",
      "  vec2 grid = abs(fract(uv * vec2(18.0, 10.0)) - 0.5);",
      "  float lines = 1.0 - smoothstep(0.465, 0.495, max(grid.x, grid.y));",
      "  float sweep = smoothstep(0.02, 0.0, abs(uv.y - fract(u_time * 0.045 + phase)));",
      "  float ring = smoothstep(0.018, 0.0, abs(length(uv - 0.5) - (0.16 + 0.06 * sin(u_time * 0.7 + phase))));",
      "  float bars = step(0.68, hash(floor(uv * vec2(10.0, 6.0)) + floor(u_time * 0.8 + phase)));",
      "  float pulse = 0.5 + 0.5 * sin(u_time * 0.43 + phase + uv.x * 8.0);",
      "  vec3 base = vec3(0.018, 0.028, 0.016) + vec3(0.09, 0.025, 0.055) * pulse;",
      "  base += lines * vec3(0.08, 0.16, 0.05);",
      "  base += sweep * vec3(0.7, 1.0, 0.08);",
      "  base += ring * vec3(1.0, 0.12, 0.36);",
      "  base += bars * 0.24 * vec3(0.2, 0.95, 0.86);",
      "  return base;",
      "}",
      "vec3 readSource(sampler2D tex, vec2 uv, float available, float phase) {",
      "  vec3 live = texture2D(tex, clamp(uv, 0.0, 1.0)).rgb;",
      "  return mix(internalSignal(uv, phase), live, available);",
      "}",
      "vec3 combineSources(vec3 a, vec3 b) {",
      "  vec3 cross = mix(a, b, u_mix);",
      "  vec3 difference = abs(a - b);",
      "  vec3 lighten = max(a, b * (0.35 + 0.65 * u_mix));",
      "  vec3 hardCut = mix(a, b, step(0.5, u_mix));",
      "  vec3 multiplyMode = mix(a, a * b * 1.65, u_mix);",
      "  vec3 result = cross;",
      "  result = mix(result, difference, step(0.5, u_blend) * (1.0 - step(1.5, u_blend)));",
      "  result = mix(result, lighten, step(1.5, u_blend) * (1.0 - step(2.5, u_blend)));",
      "  result = mix(result, hardCut, step(2.5, u_blend) * (1.0 - step(3.5, u_blend)));",
      "  result = mix(result, multiplyMode, step(3.5, u_blend));",
      "  return result;",
      "}",
      "void main() {",
      "  vec2 uv = v_uv;",
      "  float blockPx = mix(2.0, 92.0, u_blocks * u_blocks);",
      "  vec2 blockCount = max(vec2(1.0), u_resolution / blockPx);",
      "  vec2 blockId = floor(uv * blockCount);",
      "  vec2 blockUv = (blockId + 0.5) / blockCount;",
      "  float blockRand = hash(blockId + floor(u_frame * 0.11));",
      "  float columnRand = hash(vec2(floor(uv.x * mix(90.0, 12.0, u_melt)), floor(u_frame * 0.035)));",
      "  vec3 a = readSource(u_sourceA, uv, u_hasA, 0.0);",
      "  vec3 b = readSource(u_sourceB, uv, u_hasB, 9.7);",
      "  vec3 fresh = combineSources(a, b);",
      "  float historyLuma = luminance(texture2D(u_history, uv).rgb);",
      "  float freshLuma = luminance(fresh);",
      "  float movement = smoothstep(0.018, 0.34, abs(freshLuma - historyLuma));",
      "  vec2 flow = vec2((blockRand - 0.5) * u_motion * 0.06, 0.0);",
      "  flow.y -= columnRand * columnRand * u_melt * (0.012 + movement * 0.085);",
      "  flow.x += sin((blockUv.y + u_time * 0.025) * 25.0) * u_smear * 0.008;",
      "  vec2 historyUv = clamp(mix(uv, blockUv, u_blocks * 0.72) + flow, 0.001, 0.999);",
      "  vec3 history = texture2D(u_history, historyUv).rgb;",
      "  vec2 smearStep = vec2((blockRand - 0.5) * 0.018, -0.006 - u_melt * 0.014) * u_smear;",
      "  history += texture2D(u_history, clamp(historyUv + smearStep, 0.001, 0.999)).rgb * u_smear * 0.28;",
      "  history /= 1.0 + u_smear * 0.28;",
      "  float split = (0.0005 + u_chroma * 0.012) * (0.35 + movement);",
      "  vec2 splitVector = vec2(split, split * (blockRand - 0.5));",
      "  vec3 splitFresh;",
      "  splitFresh.r = combineSources(readSource(u_sourceA, uv + splitVector, u_hasA, 0.0), readSource(u_sourceB, uv + splitVector, u_hasB, 9.7)).r;",
      "  splitFresh.g = fresh.g;",
      "  splitFresh.b = combineSources(readSource(u_sourceA, uv - splitVector, u_hasA, 0.0), readSource(u_sourceB, uv - splitVector, u_hasB, 9.7)).b;",
      "  fresh = mix(fresh, splitFresh, u_chroma);",
      "  float stillness = 1.0 - movement;",
      "  float retention = clamp(u_feedback + stillness * u_motion * 0.1, 0.0, 0.992);",
      "  float packet = step(blockRand, u_dropout);",
      "  retention = max(retention, packet * (0.88 + u_feedback * 0.1));",
      "  vec3 color = mix(fresh, history, retention);",
      "  color = (color - 0.5) * u_contrast + 0.5;",
      "  float grain = hash(gl_FragCoord.xy + vec2(u_frame * 13.7, u_frame * 3.1)) - 0.5;",
      "  color += grain * u_noise * 0.18;",
      "  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);",
      "}"
    ].join("\n");

    var displaySource = [
      "precision mediump float;",
      "varying vec2 v_uv;",
      "uniform sampler2D u_image;",
      "void main() { gl_FragColor = texture2D(u_image, v_uv); }"
    ].join("\n");

    var gl = this.gl;
    this.effectProgram = createProgram(gl, vertexSource, effectSource);
    this.displayProgram = createProgram(gl, vertexSource, displaySource);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    this.sourceTextures = [createTexture(gl), createTexture(gl)];
    this.historyTextures = [createTexture(gl), createTexture(gl)];
    this.framebuffers = [gl.createFramebuffer(), gl.createFramebuffer()];
    this.uniforms = {};
    [
      "u_sourceA", "u_sourceB", "u_history", "u_resolution", "u_time", "u_frame",
      "u_hasA", "u_hasB", "u_feedback", "u_motion", "u_smear", "u_blocks",
      "u_dropout", "u_mix", "u_chroma", "u_melt", "u_noise", "u_contrast", "u_blend"
    ].forEach(function (name) {
      this.uniforms[name] = gl.getUniformLocation(this.effectProgram, name);
    }, this);
    this.displayUniform = gl.getUniformLocation(this.displayProgram, "u_image");

    this.resize(targetCanvas.width, targetCanvas.height);
    this.bindContextEvents();
  }

  VjEngine.prototype.bindContextEvents = function () {
    var self = this;
    this.canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      cancelAnimationFrame(self.animationFrame);
      showError("The GPU context was lost. Reload the page to restart the VJ engine.");
    });
  };

  VjEngine.prototype.bindQuad = function (program) {
    var gl = this.gl;
    var position = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  };

  VjEngine.prototype.resize = function (width, height) {
    var gl = this.gl;
    this.canvas.width = width;
    this.canvas.height = height;
    for (var i = 0; i < 2; i += 1) {
      gl.bindTexture(gl.TEXTURE_2D, this.historyTextures[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.historyTextures[i], 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.clear();
    frameReadout.textContent = width + "x" + height + " / " + this.fps + " fps";
  };

  VjEngine.prototype.clear = function () {
    var gl = this.gl;
    for (var i = 0; i < 2; i += 1) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0.004, 0.008, 0.004, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.readIndex = 0;
    recordReadout.textContent = "memory cleared";
  };

  VjEngine.prototype.drawableFor = function (slot) {
    if (!slot || !slot.source) return null;
    if (slot.source.tagName === "VIDEO") {
      return slot.source.readyState >= 2 && slot.source.videoWidth > 0 ? slot.source : null;
    }
    if (slot.source.tagName === "IMG") {
      return slot.source.complete && slot.source.naturalWidth > 0 ? slot.source : null;
    }
    return slot.source;
  };

  VjEngine.prototype.uploadSource = function (texture, source) {
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (!source) return false;
    try {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      return true;
    } catch (error) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      return false;
    }
  };

  VjEngine.prototype.updatePreviews = function () {
    slots.forEach(function (slot) {
      var source = this.drawableFor(slot);
      if (!source) return;
      try {
        var sw = source.videoWidth || source.naturalWidth || source.width;
        var sh = source.videoHeight || source.naturalHeight || source.height;
        var scale = Math.max(slot.preview.width / sw, slot.preview.height / sh);
        var dw = sw * scale;
        var dh = sh * scale;
        slot.previewContext.fillStyle = "#000";
        slot.previewContext.fillRect(0, 0, slot.preview.width, slot.preview.height);
        slot.previewContext.drawImage(source, (slot.preview.width - dw) / 2, (slot.preview.height - dh) / 2, dw, dh);
      } catch (error) {}
    }, this);
  };

  VjEngine.prototype.displayTexture = function (texture) {
    var gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.displayProgram);
    this.bindQuad(this.displayProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.displayUniform, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  VjEngine.prototype.render = function (now) {
    var gl = this.gl;
    var sourceA = this.drawableFor(slots[busA]);
    var sourceB = this.drawableFor(slots[busB]);
    var hasA = this.uploadSource(this.sourceTextures[0], sourceA);
    var hasB = this.uploadSource(this.sourceTextures[1], sourceB);

    if (!this.frozen) {
      var writeIndex = 1 - this.readIndex;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[writeIndex]);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.effectProgram);
      this.bindQuad(this.effectProgram);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTextures[0]);
      gl.uniform1i(this.uniforms.u_sourceA, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTextures[1]);
      gl.uniform1i(this.uniforms.u_sourceB, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.historyTextures[this.readIndex]);
      gl.uniform1i(this.uniforms.u_history, 2);

      gl.uniform2f(this.uniforms.u_resolution, this.canvas.width, this.canvas.height);
      gl.uniform1f(this.uniforms.u_time, (now - this.started) / 1000);
      gl.uniform1f(this.uniforms.u_frame, this.frame);
      gl.uniform1f(this.uniforms.u_hasA, hasA ? 1 : 0);
      gl.uniform1f(this.uniforms.u_hasB, hasB ? 1 : 0);
      gl.uniform1f(this.uniforms.u_feedback, params.feedback);
      gl.uniform1f(this.uniforms.u_motion, params.motion);
      gl.uniform1f(this.uniforms.u_smear, params.smear);
      gl.uniform1f(this.uniforms.u_blocks, params.blocks);
      gl.uniform1f(this.uniforms.u_dropout, params.dropout);
      gl.uniform1f(this.uniforms.u_mix, params.mix);
      gl.uniform1f(this.uniforms.u_chroma, params.chroma);
      gl.uniform1f(this.uniforms.u_melt, params.melt);
      gl.uniform1f(this.uniforms.u_noise, params.noise);
      gl.uniform1f(this.uniforms.u_contrast, params.contrast);
      gl.uniform1f(this.uniforms.u_blend, Number(blendSelect.value));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.readIndex = writeIndex;
      this.frame += 1;
    }

    this.displayTexture(this.historyTextures[this.readIndex]);
    this.previewTick += 1;
    if (this.previewTick % 6 === 0) this.updatePreviews();

    this.fpsFrames += 1;
    if (now - this.fpsTime >= 600) {
      this.fps = Math.round(this.fpsFrames * 1000 / (now - this.fpsTime));
      this.fpsFrames = 0;
      this.fpsTime = now;
      frameReadout.textContent = this.canvas.width + "x" + this.canvas.height + " / " + this.fps + " fps";
    }
  };

  VjEngine.prototype.start = function () {
    var self = this;
    function loop(now) {
      self.render(now);
      self.animationFrame = requestAnimationFrame(loop);
    }
    self.animationFrame = requestAnimationFrame(loop);
  };

  function displayValue(name, value) {
    if (name === "mix") {
      var a = Math.round((1 - value) * 100);
      return "A " + a + " / B " + (100 - a);
    }
    if (name === "contrast") return Number(value).toFixed(2);
    return Number(value).toFixed(2);
  }

  function syncControls() {
    document.querySelectorAll("[data-param]").forEach(function (input) {
      var name = input.dataset.param;
      if (Object.prototype.hasOwnProperty.call(params, name)) input.value = String(params[name]);
    });
    document.querySelectorAll("[data-output]").forEach(function (output) {
      var name = output.dataset.output;
      if (Object.prototype.hasOwnProperty.call(params, name)) output.textContent = displayValue(name, params[name]);
    });
    memorySummary.textContent = Math.round(params.feedback * 100) + "%";
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        params: params,
        blend: Number(blendSelect.value),
        resolution: resolutionSelect.value
      }));
    } catch (error) {}
  }

  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || !saved.params) return false;
      Object.keys(params).forEach(function (name) {
        if (Number.isFinite(saved.params[name])) params[name] = saved.params[name];
      });
      if (saved.blend >= 0 && saved.blend <= 4) blendSelect.value = String(saved.blend);
      if (/^\d+x\d+$/.test(saved.resolution || "")) resolutionSelect.value = saved.resolution;
      activePreset = "";
      return true;
    } catch (error) {
      return false;
    }
  }

  function markPreset(name) {
    activePreset = name || "";
    document.querySelectorAll("[data-preset]").forEach(function (button) {
      button.classList.toggle("active", button.dataset.preset === activePreset);
    });
    presetReadout.textContent = activePreset ? activePreset.toUpperCase() : "CUSTOM";
  }

  function applyPreset(name, engine) {
    var preset = presets[name];
    if (!preset) return;
    Object.keys(params).forEach(function (key) {
      params[key] = preset[key];
    });
    blendSelect.value = String(preset.blend);
    syncControls();
    markPreset(name);
    saveState();
    if (name === "clean") engine.clear();
  }

  function mutate() {
    params.feedback = 0.72 + Math.random() * 0.25;
    params.motion = 0.28 + Math.random() * 0.72;
    params.smear = 0.15 + Math.random() * 0.8;
    params.blocks = 0.15 + Math.random() * 0.82;
    params.dropout = Math.random() * 0.68;
    params.chroma = 0.08 + Math.random() * 0.82;
    params.melt = 0.08 + Math.random() * 0.85;
    params.noise = Math.random() * 0.2;
    params.contrast = 0.95 + Math.random() * 0.48;
    blendSelect.value = String(Math.floor(Math.random() * 5));
    syncControls();
    markPreset("");
    saveState();
  }

  function setFrozen(engine, frozen) {
    engine.frozen = frozen;
    freezeButton.setAttribute("aria-pressed", String(frozen));
    freezeButton.textContent = frozen ? "release" : "freeze";
    recordReadout.textContent = frozen ? "frame held" : "feedback live";
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (stageShell.requestFullscreen) {
      stageShell.requestFullscreen();
    }
  }

  function recordingMimeType() {
    var options = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm"
    ];
    for (var i = 0; i < options.length; i += 1) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(options[i])) return options[i];
    }
    return "";
  }

  function updateRecordingClock() {
    if (!recorder || recorder.state !== "recording") return;
    var elapsed = Math.floor((Date.now() - recordingStarted) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    recordReadout.textContent = "rec " + String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function startRecording() {
    if (!canvas.captureStream || !window.MediaRecorder) {
      recordReadout.textContent = "recording unsupported";
      return;
    }
    var stream = canvas.captureStream(30);
    var mimeType = recordingMimeType();
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType: mimeType, videoBitsPerSecond: 9000000 } : undefined);
    } catch (error) {
      recordReadout.textContent = "recorder failed";
      return;
    }
    recordChunks = [];
    recorder.addEventListener("dataavailable", function (event) {
      if (event.data && event.data.size) recordChunks.push(event.data);
    });
    recorder.addEventListener("stop", function () {
      clearInterval(recordClock);
      var blob = new Blob(recordChunks, { type: recorder.mimeType || "video/webm" });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement("a");
      var stamp = new Date().toISOString().replace(/[:.]/g, "-");
      anchor.href = url;
      anchor.download = "frame-residue-" + stamp + ".webm";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
      stream.getTracks().forEach(function (track) { track.stop(); });
      recordButton.dataset.recording = "false";
      recordButton.textContent = "record";
      recordReadout.textContent = "saved WebM";
      recorder = null;
      recordChunks = [];
    }, { once: true });
    recorder.start(1000);
    recordingStarted = Date.now();
    recordClock = setInterval(updateRecordingClock, 250);
    recordButton.dataset.recording = "true";
    recordButton.textContent = "stop rec";
    updateRecordingClock();
  }

  function toggleRecording() {
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    } else {
      startRecording();
    }
  }

  function bindUi(engine) {
    document.getElementById("addFilesButton").addEventListener("click", function () {
      pendingSlot = null;
      fileInput.click();
    });
    document.getElementById("addCameraButton").addEventListener("click", addCamera);
    document.getElementById("addMacroverseButton").addEventListener("click", openMacroverseDialog);
    document.getElementById("addScreenButton").addEventListener("click", addScreen);
    document.getElementById("clearButton").addEventListener("click", function () {
      engine.clear();
    });
    document.getElementById("randomButton").addEventListener("click", mutate);
    document.getElementById("panicButton").addEventListener("click", function () {
      setFrozen(engine, false);
      applyPreset("clean", engine);
    });
    freezeButton.addEventListener("click", function () {
      setFrozen(engine, !engine.frozen);
    });
    document.getElementById("fullscreenButton").addEventListener("click", toggleFullscreen);
    recordButton.addEventListener("click", toggleRecording);
    fileInput.addEventListener("change", function () {
      loadFiles(fileInput.files);
    });

    document.querySelectorAll("[data-param]").forEach(function (input) {
      input.addEventListener("input", function () {
        var name = input.dataset.param;
        params[name] = Number(input.value);
        var output = document.querySelector('[data-output="' + name + '"]');
        if (output) output.textContent = displayValue(name, params[name]);
        memorySummary.textContent = Math.round(params.feedback * 100) + "%";
        markPreset("");
        saveState();
      });
    });
    document.querySelectorAll("[data-preset]").forEach(function (button) {
      button.addEventListener("click", function () {
        applyPreset(button.dataset.preset, engine);
      });
    });
    blendSelect.addEventListener("change", function () {
      markPreset("");
      saveState();
    });
    resolutionSelect.addEventListener("change", function () {
      var parts = resolutionSelect.value.split("x").map(Number);
      engine.resize(parts[0], parts[1]);
      saveState();
    });

    document.getElementById("helpButton").addEventListener("click", function () {
      if (helpDialog.showModal) helpDialog.showModal();
      else helpDialog.setAttribute("open", "");
    });
    document.getElementById("closeHelpButton").addEventListener("click", function () {
      helpDialog.close();
    });
    helpDialog.addEventListener("click", function (event) {
      if (event.target === helpDialog) helpDialog.close();
    });
    document.getElementById("closeMacroverseButton").addEventListener("click", function () {
      macroverseDialog.close();
    });
    macroverseDialog.addEventListener("click", function (event) {
      if (event.target === macroverseDialog) macroverseDialog.close();
    });
    macroverseForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addMacroverse(macroverseSession.value);
    });

    refreshCameraDevices();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshCameraDevices);
    }

    window.addEventListener("dragenter", function (event) {
      event.preventDefault();
      dragDepth += 1;
      document.body.classList.add("dragging");
    });
    window.addEventListener("dragover", function (event) {
      event.preventDefault();
    });
    window.addEventListener("dragleave", function (event) {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) document.body.classList.remove("dragging");
    });
    window.addEventListener("drop", function (event) {
      event.preventDefault();
      dragDepth = 0;
      document.body.classList.remove("dragging");
      if (event.dataTransfer && event.dataTransfer.files) loadFiles(event.dataTransfer.files);
    });

    document.addEventListener("keydown", function (event) {
      var target = event.target;
      if (target && /INPUT|SELECT|TEXTAREA/.test(target.tagName)) return;
      if (event.key >= "1" && event.key <= "4") {
        busA = Number(event.key) - 1;
        updateBusUi();
        return;
      }
      var bKeys = { q: 0, w: 1, e: 2, r: 3 };
      var lower = event.key.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(bKeys, lower) && !(lower === "r" && event.shiftKey)) {
        busB = bKeys[lower];
        updateBusUi();
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setFrozen(engine, !engine.frozen);
      } else if (lower === "c") {
        engine.clear();
      } else if (lower === "m") {
        mutate();
      } else if (lower === "f") {
        toggleFullscreen();
      } else if (lower === "r" && event.shiftKey) {
        toggleRecording();
      }
    });

    stageShell.addEventListener("click", function () {
      slots.forEach(function (slot) {
        if (slot.source && slot.source.tagName === "VIDEO" && slot.source.paused) {
          slot.source.play().catch(function () {});
        }
      });
    });
  }

  function boot() {
    createSlots();
    var restored = loadState();
    if (!restored && window.matchMedia && window.matchMedia("(max-width: 820px)").matches) {
      resolutionSelect.value = "854x480";
    }
    syncControls();
    markPreset(activePreset);
    hideError();
    try {
      var engine = new VjEngine(canvas);
      var size = resolutionSelect.value.split("x").map(Number);
      engine.resize(size[0], size[1]);
      bindUi(engine);
      engine.start();
      setStatus("engine: live", "live");
      recordReadout.textContent = "output clear";
      var linkedSession = new URLSearchParams(window.location.search).get("macroverseSession");
      if (linkedSession && linkedSession.trim()) {
        macroverseSession.value = linkedSession.trim().slice(0, 64);
        addMacroverse(macroverseSession.value);
      }
    } catch (error) {
      showError(error && error.message ? error.message : "The VJ engine could not start.");
    }
  }

  window.addEventListener("pagehide", function () {
    slots.forEach(stopSource);
    if (recorder && recorder.state === "recording") recorder.stop();
  });

  boot();
})();
