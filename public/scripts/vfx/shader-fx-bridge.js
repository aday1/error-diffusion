(function (global) {
  "use strict";

  function patchFragment(shaderSource) {
    if (shaderSource.indexOf("uniform float FX1") >= 0) return shaderSource;
    var injectUniforms =
      "uniform float FX1;\n" +
      "uniform float FX2;\n" +
      "uniform float FX3;\n" +
      "uniform float FX4;\n";
    var withUniforms = shaderSource.replace(
      "uniform int uTheme;",
      "uniform int uTheme;\n" + injectUniforms
    );
    var warp =
      "  u.xy += (m - 0.5) * (0.35 + FX2 * 0.45);\n" +
      "  float mosaicX = fMosaicScal.x * (1.0 + FX3 * 2.5);\n" +
      "  float mosaicY = fMosaicScal.y * (1.0 + FX3 * 1.8);\n" +
      "  u.x = floor(u.x * vScreenSize.x / mosaicX) / (vScreenSize.x / mosaicX);\n" +
      "  u.y = floor(u.y * vScreenSize.y / mosaicY) / (vScreenSize.y / mosaicY);\n";
    return withUniforms
      .replace(
        "  u.xy += (m - 0.5) * 0.35;\n" +
          "  u.x = floor(u.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);\n" +
          "  u.y = floor(u.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);\n",
        warp
      )
      .replace(
        "  field = field * 0.68 + mouseGlow * 0.36;",
        "  field = field * (0.68 + FX1 * 0.22) + mouseGlow * (0.36 + FX4 * 0.28);"
      )
      .replace(
        "  float dither = bayer4(gl_FragCoord.xy);",
        "  float dither = bayer4(gl_FragCoord.xy + vec2(FX4 * 8.0, FX2 * 6.0));"
      );
  }

  function applyUniforms(uniforms, state) {
    if (!uniforms || !state) return;
    var tear = state.tear != null ? state.tear : 0.18;
    var audio = state.audio != null ? state.audio : 0;
    if (uniforms.FX1) uniforms.FX1.value = Math.min(1, tear * 1.4 + audio * 0.35);
    if (uniforms.FX2) uniforms.FX2.value = Math.min(1, state.pointerY * 0.5 + audio * 0.4);
    if (uniforms.FX3) uniforms.FX3.value = Math.min(1, tear * 0.9 + (1 - state.pointerX) * 0.3);
    if (uniforms.FX4) uniforms.FX4.value = Math.min(1, audio * 0.7 + state.pointerX * 0.25);
  }

  function extendWebglUniforms(webglUniforms) {
    if (!webglUniforms) return webglUniforms;
    webglUniforms.FX1 = { type: "f", value: 0.2 };
    webglUniforms.FX2 = { type: "f", value: 0.2 };
    webglUniforms.FX3 = { type: "f", value: 0.15 };
    webglUniforms.FX4 = { type: "f", value: 0.1 };
    return webglUniforms;
  }

  global.EdiffShaderFx = {
    patchFragment: patchFragment,
    applyUniforms: applyUniforms,
    extendWebglUniforms: extendWebglUniforms
  };
})(typeof window !== "undefined" ? window : this);
