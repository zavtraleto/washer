// Fragment shader for realistic dirt rendering with coverage-based blending.
export const dirtFragmentShader = `
precision mediump float;

uniform sampler2D uMainSampler;      // Clean base texture (shield.png)
uniform sampler2D uDirtMap0;         // Mold coverage map (R channel: 0..1)
uniform sampler2D uDirtMap1;         // Grease coverage map (R channel: 0..1)
uniform sampler2D uDirtTexture0;     // Mold texture (tileable)
uniform sampler2D uDirtTexture1;     // Grease texture (tileable)
uniform vec2 uDirtMapSize;           // Size of dirt maps (256, 256)

varying vec2 outTexCoord;

// Simple hash for pseudo-random UV offsets (prevents tiling artifacts).
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = outTexCoord;
  
  // Sample clean base texture.
  vec4 cleanColor = texture2D(uMainSampler, uv);
  
  // Sample coverage maps (how much dirt at this pixel).
  float moldCoverage = texture2D(uDirtMap0, uv).r;
  float greaseCoverage = texture2D(uDirtMap1, uv).r;
  
  // Generate varied UV coordinates for dirt textures (tiled + pseudo-random offset).
  vec2 moldUV = uv * 4.0 + vec2(hash(uv), hash(uv + 0.5)) * 0.3;
  vec2 greaseUV = uv * 6.0 + vec2(hash(uv + 1.0), hash(uv + 1.5)) * 0.2;
  
  // Sample dirt textures (tileable, high-frequency detail).
  vec4 moldColor = texture2D(uDirtTexture0, moldUV);
  vec4 greaseColor = texture2D(uDirtTexture1, greaseUV);
  
  // Apply coverage as alpha with smooth fade (avoid hard edges at 0.05 threshold).
  moldColor.a *= smoothstep(0.05, 0.15, moldCoverage);
  greaseColor.a *= smoothstep(0.05, 0.15, greaseCoverage);
  
  // Blend layers: mold over clean, then grease over result.
  vec4 result = mix(cleanColor, moldColor, moldColor.a);
  result = mix(result, greaseColor, greaseColor.a);
  
  gl_FragColor = result;
}
`;
