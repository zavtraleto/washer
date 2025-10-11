precision mediump float;

uniform float uTime;
uniform float uFactor;
uniform float uFactor2;
uniform vec2 uMouse;

in vec2 vUv;
in vec3 vNormal;
in vec3 vViewDirection;
out vec4 fragColor;

// 0: integer hash
// 1: float hash (aliasing based)
#define METHOD 1

// 0: cubic
// 1: quintic
#define INTERPOLANT 1

#if METHOD==0
vec2 hash(in ivec2 p)  // this hash is not production ready, please
{                        // replace this by something better

    // 2D -> 1D
  ivec2 n = p.x * ivec2(3, 37) + p.y * ivec2(311, 113);

    // 1D hash by Hugo Elias
  n = (n << 13) ^ n;
  n = n * (n * n * 15731 + 789221) + 1376312589;
  return -1.0 + 2.0 * vec2(n & ivec2(0x0fffffff)) / float(0x0fffffff);
}
#else
vec2 hash(in vec2 x)   // this hash is not production ready, please
{                        // replace this by something better
  const vec2 k = vec2(0.3183099, 0.3678794);
  x = x * k + k.yx;
  return -1.0 + 2.0 * fract(16.0 * k * fract(x.x * x.y * (x.x + x.y)));
}
#endif

float rand(float n) {
  return fract(sin(n) * 43758.5453123);
}
vec2 rand3(float n) {
  return vec2(rand(n), rand(n + 0.333));
}

float noise(float p) {
  float fl = floor(p);
  float fc = fract(p);
  return mix(rand(fl), rand(fl + 1.0), smoothstep(0.0, 1.0, fc)) * 2.0 - 1.0;
}

vec3 noised(in vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);

  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);

  vec2 ga = hash(i + vec2(0.0, 0.0));
  vec2 gb = hash(i + vec2(1.0, 0.0));
  vec2 gc = hash(i + vec2(0.0, 1.0));
  vec2 gd = hash(i + vec2(1.0, 1.0));

  float va = dot(ga, f - vec2(0.0, 0.0));
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));

  return vec3(va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * (va - vb - vc + vd),   // value
  ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd) +  // derivatives
    du * (u.yx * (va - vb - vc + vd) + vec2(vb, vc) - va));
}

float sdCircle(vec2 p, vec2 r) {
  return length(p) - r.y;
}

float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

// Iridescent reflection based on viewing angle
vec3 getIridescent() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewDirection);

  // Fresnel - how edge-on we're viewing the surface
  // float fresnel = 1.0 - abs(dot(normal, viewDir));
  float fresnel = 1.0 - abs(dot(sin(0.9 + normal * 8.), sin(viewDir * 3.)));
  float fresnel2 = 1.0 - abs(dot(sin(0.7 + normal * 9.), sin(viewDir * 2.)));
  // fresnel = sin()

  // Create color shift based on viewing angle
  vec3 color1 = vec3(0.0, 0.67, 1.0);  // Blue
  vec3 color2 = vec3(1.0, 0.36, 1.0);  // Pink
  vec3 color3 = vec3(0.43, 1.0, 0.43);  // Green

  // Blend between colors based on fresnel
  vec3 iridescent = mix(color1, color2, fresnel);
  iridescent = mix(iridescent, color3, fresnel2);
  // iridescent = mix(iridescent, color3, pow(fresnel, 2.0));

  return iridescent;
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  vec2 m = uMouse;

  vec3 iridescent = getIridescent();

  // vec3 col = vec3(0.0,0.0,0.0);
  vec3 col = iridescent;

  // vec3 n = noised(vec2(p.x+uTime*0.1 + sin(uTime*0.5+p.y*0.5),p.y-uTime*0.2)*0.5);
  vec3 n = noised(vec2(p.x, p.y) * 1.5);
  vec3 n2 = noised(vec2(p.x, p.y) * 60.);
  vec3 n3 = noised(vec2(p.x, p.y) * 40.);
  vec2 mouseFactor = vec2(length(p - m) * .9, 1.5);
  // n2 += 0.5;
  float signFactor = n2.r;
  signFactor += uFactor2+n.r;
  signFactor = opSmoothUnion(signFactor, mouseFactor.x,mouseFactor.y);
  // vec3 n3 = noised(vec2(p.x,p.y)*12.);
  // signFactor += length(n3.r);
  // vec3 n4 = noised(vec2(p.x,p.y)*100.);
  // signFactor += length(n4.r);
  // signFactor += length(p-m)*2.9;

  // signFactor = mix(signFactor, 1.0, length(p-m)*1.9);

  // signFactor -= length(n4.b);

  // signFactor = sign(signFactor);
    // signFactor = step(distance(signFactor,.1),.1);
    signFactor = sign(signFactor);

    // signFactor = smoothstep(0.01,0.5,sign(signFactor));

float shadowFactor = 0.5+n3.r;

  shadowFactor += uFactor2+0.2+n2.r;
  shadowFactor += n.r;
    // shadowFactor = opSmoothUnion(shadowFactor, n2.r, 0.1);

  shadowFactor = opSmoothUnion(shadowFactor, mouseFactor.x,mouseFactor.y);
  shadowFactor = sign(shadowFactor);
      // shadowFactor = smoothstep(0.1,0.1,sign(shadowFactor));

  float lightFactor = 0.5+n3.r;
  lightFactor += uFactor+n.r;
  lightFactor = opSmoothUnion(lightFactor, mouseFactor.x,mouseFactor.y);
  lightFactor = sign(lightFactor);


  // col = mix(col, vec3(0.0,1.0,0.0), sign(n2.r + uFactor) );
  // col = mix(col, vec3(0.0,1.0,0.0), sign(n2.r+ uFactor + length(n.r)+uFactor2)); //fine
  // col = mix(col, vec3(0.0,1.0,0.0), sign(n2.r+ uFactor + length(clamp(n.r,0.01,0.2))+uFactor2));
    col = mix(col, vec3(0.8,0.3, 0.0), lightFactor*0.5+0.5);
    col = mix(col, vec3(.15, .1, 0.1), shadowFactor*0.5+0.5);

  col = mix(col, vec3(.4, .2, 0.1), signFactor * 0.5 + 0.5);

    // col = mix(col, vec3(1.0,0.5,0.5), opSmoothUnion(n.r+n2.g, length(p-m)*1.9, 2.1)*0.5+0.5);

// col = mix(col, iridescent, ); 
  // col -= .1 + 0.5 * cos(10. * n.r - uTime * 10.);

  // col = col - signFactor * (p.x * vec3(1.0,1.0,0.0));
  // col = mix(col, vec3(0.5,0.0,0.0), sign(n2.b+0.3));
  // col = vec3(signFactor);
  // col = vec3(length(p-m)*2.9);
  fragColor = vec4(col, 1.0);
}
