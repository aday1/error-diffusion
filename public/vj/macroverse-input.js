(function (global) {
  "use strict";

  var DEFAULT_BASE = "https://macroverse.aday.net.au";
  var VERTEX_SOURCE = [
    "precision highp float;",
    "attribute vec2 a_pos;",
    "varying vec2 v_uv;",
    "void main() {",
    "  v_uv = a_pos * 0.5 + 0.5;",
    "  gl_Position = vec4(a_pos, 0.0, 1.0);",
    "}"
  ].join("\n");
  var QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

  var MIX_SOURCE = [
    "precision highp float;",
    "uniform sampler2D texA;",
    "uniform sampler2D texB;",
    "uniform float crossfader;",
    "uniform int mixMode;",
    "uniform float outputFlipV;",
    "uniform float outputFlipH;",
    "uniform int outputRotation;",
    "varying vec2 v_uv;",
    "float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }",
    "vec3 overlayRgb(vec3 base, vec3 blend) {",
    "  return mix(2.0 * base * blend, vec3(1.0) - 2.0 * (vec3(1.0) - base) * (vec3(1.0) - blend), step(vec3(0.5), base));",
    "}",
    "void main() {",
    "  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);",
    "  if (outputFlipV > 0.5) uv.y = 1.0 - uv.y;",
    "  if (outputFlipH > 0.5) uv.x = 1.0 - uv.x;",
    "  if (outputRotation == 1) uv = vec2(1.0 - uv.y, uv.x);",
    "  else if (outputRotation == 2) uv = vec2(1.0 - uv.x, 1.0 - uv.y);",
    "  else if (outputRotation == 3) uv = vec2(uv.y, 1.0 - uv.x);",
    "  vec4 a = texture2D(texA, uv);",
    "  vec4 b = texture2D(texB, uv);",
    "  float t = clamp(crossfader, 0.0, 1.0);",
    "  if (mixMode == 1) gl_FragColor = a * (1.0 - b.a * t) + b * b.a * t;",
    "  else if (mixMode == 2) gl_FragColor = clamp(a + b * t, 0.0, 1.0);",
    "  else if (mixMode == 3) gl_FragColor = mix(a, a * b, t);",
    "  else if (mixMode == 4) gl_FragColor = mix(a, b, dot(b.rgb, vec3(0.299, 0.587, 0.114)) * t);",
    "  else if (mixMode == 5) gl_FragColor = mix(a, vec4(1.0) - (vec4(1.0) - a) * (vec4(1.0) - b), t);",
    "  else if (mixMode == 6) gl_FragColor = mix(a, vec4(abs(a.rgb - b.rgb), mix(a.a, b.a, t)), t);",
    "  else if (mixMode == 7) gl_FragColor = mix(a, vec4(overlayRgb(a.rgb, b.rgb), mix(a.a, b.a, t)), t);",
    "  else if (mixMode == 8) gl_FragColor = t < 0.5 ? a : b;",
    "  else if (mixMode == 9) gl_FragColor = mix(a, b, smoothstep(t - 0.02, t + 0.02, uv.x));",
    "  else if (mixMode == 10) gl_FragColor = mix(a, b, smoothstep(t - 0.02, t + 0.02, uv.y));",
    "  else if (mixMode == 11) gl_FragColor = mix(a, b, step(t, hash21(floor(uv * vec2(640.0, 360.0)))));",
    "  else if (mixMode == 12) {",
    "    vec2 buv = (uv - 0.5) / max(mix(1.0, 0.35, t), 0.001) + 0.5;",
    "    gl_FragColor = mix(a, texture2D(texB, clamp(buv, 0.0, 1.0)), t);",
    "  }",
    "  else if (mixMode == 13) gl_FragColor = mix(a, min(a, b), t);",
    "  else if (mixMode == 14) gl_FragColor = mix(a, max(a, b), t);",
    "  else if (mixMode == 15) gl_FragColor = mix(a, a + b - 2.0 * a * b, t);",
    "  else gl_FragColor = mix(a, b, t);",
    "}"
  ].join("\n");

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var message = gl.getShaderInfoLog(shader) || "shader compile failed";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function link(gl, vertexSource, fragmentSource) {
    var program = gl.createProgram();
    var vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    var fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var message = gl.getProgramInfoLog(program) || "shader link failed";
      gl.deleteProgram(program);
      throw new Error(message);
    }
    return program;
  }

  function createBuffer(gl) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    return buffer;
  }

  function createTexture(gl) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  function bindQuad(gl, program, buffer) {
    var location = gl.getAttribLocation(program, "a_pos");
    if (location < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
  }

  function setUniform1f(gl, program, name, value) {
    var location = gl.getUniformLocation(program, name);
    if (location !== null) gl.uniform1f(location, value);
  }

  function setUniform1i(gl, program, name, value) {
    var location = gl.getUniformLocation(program, name);
    if (location !== null) gl.uniform1i(location, value);
  }

  function setUniform2f(gl, program, name, x, y) {
    var location = gl.getUniformLocation(program, name);
    if (location !== null) gl.uniform2f(location, x, y);
  }

  function setDeckUniforms(gl, program, width, height, time, overrides, meta, mouseX, mouseY) {
    setUniform1f(gl, program, "TIME", time);
    setUniform2f(gl, program, "RENDERSIZE", width, height);
    setUniform1f(gl, program, "uTimeScale", 1);
    setUniform2f(gl, program, "uMouse", mouseX, mouseY);
    setUniform1f(gl, program, "iFrame", Math.floor(time * 60));
    setUniform1f(gl, program, "time", time);
    setUniform2f(gl, program, "resolution", width, height);
    setUniform2f(gl, program, "mouse", mouseX, mouseY);
    setUniform1f(gl, program, "iGlobalTime", time);
    setUniform1f(gl, program, "iTime", time);
    setUniform2f(gl, program, "iResolution", width, height);
    setUniform1f(gl, program, "FRAMEINDEX", Math.floor(time * 60));
    setUniform1f(gl, program, "timeScale", 1);
    setUniform1f(gl, program, "mouseX", mouseX);
    setUniform1f(gl, program, "mouseY", mouseY);
    (meta || []).forEach(function (parameter) {
      if (!overrides || overrides[parameter.name] === undefined) return;
      if (parameter.type === "bool") {
        setUniform1i(gl, program, parameter.name, overrides[parameter.name] ? 1 : 0);
      } else {
        setUniform1f(gl, program, parameter.name, Number(overrides[parameter.name]) || 0);
      }
    });
  }

  function createRenderer(outputCanvas, onStatus) {
    var deckA = document.createElement("canvas");
    var deckB = document.createElement("canvas");
    deckA.width = deckB.width = 640;
    deckA.height = deckB.height = 360;
    var options = {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      powerPreference: "default"
    };
    var glA = deckA.getContext("webgl", options);
    var glB = deckB.getContext("webgl", options);
    var glMix = outputCanvas.getContext("webgl", options);
    if (!glA || !glB || !glMix) throw new Error("Macroverse input needs three available WebGL contexts");
    [glA, glB, glMix].forEach(function (gl) {
      gl.getExtension("OES_standard_derivatives");
    });

    var bufferA = createBuffer(glA);
    var bufferB = createBuffer(glB);
    var bufferMix = createBuffer(glMix);
    var textureA = createTexture(glMix);
    var textureB = createTexture(glMix);
    var mixProgram = link(glMix, VERTEX_SOURCE, MIX_SOURCE);
    var programA = null;
    var programB = null;
    var metaA = [];
    var metaB = [];
    var paramsA = {};
    var paramsB = {};
    var crossfader = 0;
    var mixMode = 0;
    var flipV = false;
    var flipH = false;
    var rotation = 0;
    var mouseAX = 0.5;
    var mouseAY = 0.5;
    var mouseBX = 0.5;
    var mouseBY = 0.5;
    var started = performance.now();
    var hasSignal = false;

    function renderDeck(gl, target, program, buffer, values, meta, mouseX, mouseY) {
      gl.viewport(0, 0, target.width, target.height);
      gl.clearColor(0.025, 0.03, 0.04, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!program) return;
      gl.useProgram(program);
      setDeckUniforms(gl, program, target.width, target.height, (performance.now() - started) / 1000, values, meta, mouseX, mouseY);
      bindQuad(gl, program, buffer);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function render() {
      renderDeck(glA, deckA, programA, bufferA, paramsA, metaA, mouseAX, mouseAY);
      renderDeck(glB, deckB, programB, bufferB, paramsB, metaB, mouseBX, mouseBY);
      glMix.bindTexture(glMix.TEXTURE_2D, textureA);
      glMix.texImage2D(glMix.TEXTURE_2D, 0, glMix.RGBA, glMix.RGBA, glMix.UNSIGNED_BYTE, deckA);
      glMix.bindTexture(glMix.TEXTURE_2D, textureB);
      glMix.texImage2D(glMix.TEXTURE_2D, 0, glMix.RGBA, glMix.RGBA, glMix.UNSIGNED_BYTE, deckB);
      glMix.viewport(0, 0, outputCanvas.width, outputCanvas.height);
      glMix.clearColor(0.015, 0.018, 0.025, 1);
      glMix.clear(glMix.COLOR_BUFFER_BIT);
      glMix.useProgram(mixProgram);
      glMix.activeTexture(glMix.TEXTURE0);
      glMix.bindTexture(glMix.TEXTURE_2D, textureA);
      glMix.activeTexture(glMix.TEXTURE1);
      glMix.bindTexture(glMix.TEXTURE_2D, textureB);
      setUniform1i(glMix, mixProgram, "texA", 0);
      setUniform1i(glMix, mixProgram, "texB", 1);
      setUniform1f(glMix, mixProgram, "crossfader", crossfader);
      setUniform1i(glMix, mixProgram, "mixMode", mixMode);
      setUniform1f(glMix, mixProgram, "outputFlipV", flipV ? 1 : 0);
      setUniform1f(glMix, mixProgram, "outputFlipH", flipH ? 1 : 0);
      setUniform1i(glMix, mixProgram, "outputRotation", rotation === 90 ? 1 : rotation === 180 ? 2 : rotation === 270 ? 3 : 0);
      bindQuad(glMix, mixProgram, bufferMix);
      glMix.drawArrays(glMix.TRIANGLE_STRIP, 0, 4);
    }

    function replaceDeck(deck, source, meta) {
      var gl = deck === "B" ? glB : glA;
      var oldProgram = deck === "B" ? programB : programA;
      if (oldProgram) gl.deleteProgram(oldProgram);
      try {
        var nextProgram = link(gl, VERTEX_SOURCE, source);
        if (deck === "B") {
          programB = nextProgram;
          metaB = meta || [];
        } else {
          programA = nextProgram;
          metaA = meta || [];
        }
        if (!hasSignal) onStatus("signal", "Macroverse signal live");
        hasSignal = true;
      } catch (error) {
        if (deck === "B") programB = null;
        else programA = null;
        onStatus("error", "Macroverse shader failed: " + (error.message || "compile error"));
      }
    }

    return {
      render: render,
      apply: function (message) {
        if (!message || !message.type) return;
        if (message.type === "shader") {
          replaceDeck(message.deck === "B" ? "B" : "A", message.preparedSource || "", message.meta || []);
        } else if (message.type === "frame") {
          crossfader = Number(message.crossfader) || 0;
          mixMode = Number(message.mixModeInt) || 0;
          flipV = !!message.flipV;
          flipH = !!message.flipH;
          rotation = Number(message.rotation) || 0;
          mouseAX = message.mouseAX == null ? Number(message.mouseX) || 0.5 : Number(message.mouseAX);
          mouseAY = message.mouseAY == null ? Number(message.mouseY) || 0.5 : Number(message.mouseAY);
          mouseBX = message.mouseBX == null ? Number(message.mouseX) || 0.5 : Number(message.mouseBX);
          mouseBY = message.mouseBY == null ? Number(message.mouseY) || 0.5 : Number(message.mouseBY);
          paramsA = message.paramsA || {};
          paramsB = message.paramsB || {};
        } else if (message.type === "clear") {
          var deck = message.deck === "B" ? "B" : "A";
          var gl = deck === "B" ? glB : glA;
          var program = deck === "B" ? programB : programA;
          if (program) gl.deleteProgram(program);
          if (deck === "B") {
            programB = null;
            metaB = [];
          } else {
            programA = null;
            metaA = [];
          }
        }
      }
    };
  }

  function createSource(options) {
    options = options || {};
    var baseUrl = String(options.baseUrl || DEFAULT_BASE).replace(/\/+$/, "");
    var sessionId = String(options.sessionId || "default").trim().slice(0, 64) || "default";
    var statusHandler = typeof options.onStatus === "function" ? options.onStatus : function () {};
    var canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    var renderer = createRenderer(canvas, statusHandler);
    var eventSource = null;
    var animationFrame = 0;
    var reconnectTimer = 0;
    var closed = false;
    var reconnects = 0;

    function frame() {
      if (closed) return;
      renderer.render();
      animationFrame = requestAnimationFrame(frame);
    }

    function connectStream(viewerToken) {
      if (closed) return;
      var streamUrl = baseUrl + "/api/vj-output/stream?viewToken=" + encodeURIComponent(viewerToken);
      eventSource = new EventSource(streamUrl);
      eventSource.onopen = function () {
        reconnects = 0;
        statusHandler("connected", "Macroverse connected; waiting for session signal");
      };
      eventSource.onmessage = function (event) {
        try {
          renderer.apply(JSON.parse(event.data));
        } catch (error) {}
      };
      eventSource.onerror = function () {
        if (eventSource) eventSource.close();
        eventSource = null;
        if (closed) return;
        reconnects += 1;
        var delay = Math.min(1000 * reconnects, 5000);
        statusHandler("reconnecting", "Macroverse reconnecting");
        reconnectTimer = window.setTimeout(function () {
          connectStream(viewerToken);
        }, delay);
      };
    }

    statusHandler("connecting", "Requesting Macroverse viewer link");
    var ready = fetch(baseUrl + "/api/vj/view-token", {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId, expiresIn: 86400 })
    }).then(function (response) {
      if (!response.ok) throw new Error("Macroverse viewer link returned " + response.status);
      return response.json();
    }).then(function (payload) {
      if (!payload.viewerToken) throw new Error("Macroverse viewer link was empty");
      connectStream(payload.viewerToken);
      return payload;
    }).catch(function (error) {
      statusHandler("error", error.message || "Macroverse connection failed");
      throw error;
    });

    animationFrame = requestAnimationFrame(frame);
    return {
      canvas: canvas,
      sessionId: sessionId,
      ready: ready,
      close: function () {
        closed = true;
        cancelAnimationFrame(animationFrame);
        clearTimeout(reconnectTimer);
        if (eventSource) eventSource.close();
        eventSource = null;
      }
    };
  }

  global.MacroverseInput = {
    createSource: createSource
  };
})(typeof window !== "undefined" ? window : this);
