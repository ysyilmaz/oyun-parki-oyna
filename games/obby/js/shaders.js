import * as THREE from 'three';

const NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1.0,0.0)), u.x), mix(hash12(i+vec2(0.0,1.0)), hash12(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm2(vec2 p){ float v = 0.0; float a = 0.5; for(int i=0;i<5;i++){ v += a*vnoise(p); p = p*2.03 + vec2(1.7,9.2); a *= 0.5; } return v; }
float fbm3(vec2 p){ float v = 0.0; float a = 0.5; for(int i=0;i<3;i++){ v += a*vnoise(p); p = p*2.03 + vec2(1.7,9.2); a *= 0.5; } return v * 1.14; }
`;

const WORLD_VERT = `
#include <common>
#include <fog_pars_vertex>
varying vec3 vW;
varying vec3 vN;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

export function skyMaterial(def) {
  const s = def.sky;
  return new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(s.top) },
      horizonColor: { value: new THREE.Color(s.horizon) },
      bottomColor: { value: new THREE.Color(s.bottom) },
      sunColor: { value: new THREE.Color(s.sun) },
      sunDir: { value: new THREE.Vector3(...s.sunDir).normalize() },
      stars: { value: s.stars },
      sunSize: { value: s.sunSize },
      sunK: { value: s.sunK ?? 1 },
      curve: { value: s.curve ?? 0.55 },
      time: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }
    `,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor; uniform vec3 sunColor; uniform vec3 sunDir;
      uniform float stars; uniform float sunSize; uniform float time; uniform float sunK; uniform float curve;
      varying vec3 vDir;
      ${NOISE}
      float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col;
        if (h > 0.0) col = mix(horizonColor, topColor, pow(smoothstep(0.0, 1.0, h), curve));
        else col = mix(horizonColor, bottomColor, pow(smoothstep(0.0, 0.6, -h), 0.7));
        float s = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(s, 1400.0 / sunSize) * 14.0 + pow(s, 180.0 / sunSize) * 1.2 + pow(s, 10.0) * 0.28 + pow(s, 2.5) * 0.1) * sunK;
        if (stars > 0.0) {
          vec2 sph = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
          float neb = fbm2(sph * vec2(1.6, 2.4) + vec2(3.0, 1.0));
          float neb2 = fbm2(sph * vec2(2.6, 3.4) + vec2(9.0, 4.0));
          float band = exp(-pow((d.y - 0.25 + 0.3 * sin(sph.x * 1.3)) * 3.0, 2.0));
          col += vec3(0.55, 0.12, 0.6) * pow(neb, 2.5) * band * 1.4 + vec3(0.1, 0.35, 0.7) * pow(neb2, 3.0) * band * 1.2;
          vec3 p = d * 220.0;
          vec3 cell = floor(p);
          float r = hash13(cell);
          if (r > 0.93) {
            vec3 sp = cell + vec3(hash13(cell + 1.3), hash13(cell + 2.7), hash13(cell + 5.1));
            float dist = length(p - sp);
            float tw = 0.65 + 0.35 * sin(time * (1.5 + r * 4.0) + r * 60.0);
            float b = smoothstep(0.45, 0.0, dist) * (r - 0.93) * 30.0 * tw;
            col += mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.75), hash13(cell + 7.0)) * b * smoothstep(-0.3, 0.1, d.y);
          }
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

export function waterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        deep: { value: new THREE.Color(0x0550a0) },
        shallow: { value: new THREE.Color(0x14b0dc) },
        sunDir: { value: new THREE.Vector3(0.45, 0.62, 0.35).normalize() },
      },
    ]),
    vertexShader: WORLD_VERT,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 sunDir;
      varying vec3 vW;
      ${NOISE}
      void main(){
        vec2 p = vW.xz * 0.035;
        float n = fbm2(p + vec2(time * 0.02, time * 0.013));
        float n2 = fbm3(p * 3.1 - vec2(time * 0.05, -time * 0.03));
        vec3 col = mix(deep, shallow, smoothstep(0.35, 0.75, n));
        float ripple = abs(sin((n2 * 9.0 + time * 0.6)));
        col += vec3(0.8, 0.95, 1.0) * smoothstep(0.93, 1.0, ripple) * 0.35;
        float sp = vnoise(vW.xz * 0.9 + vec2(time * 0.8, time * 0.5)) * 0.55 + vnoise(vW.xz * 2.1 - vec2(time * 0.6, 0.0)) * 0.45;
        col += vec3(1.0) * pow(max(sp - 0.6, 0.0) * 3.2, 5.0) * 2.5;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    fog: true,
  });
}

export function lavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { time: { value: 0 } },
    ]),
    vertexShader: WORLD_VERT,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float time;
      varying vec3 vW;
      varying vec3 vN;
      ${NOISE}
      void main(){
        vec2 uv = abs(vN.y) > 0.5 ? vW.xz : vec2(vW.x + vW.z, vW.y * 2.0);
        vec2 p = uv * 0.18;
        vec2 q = vec2(fbm3(p + vec2(0.0, time * 0.05)), fbm3(p + vec2(5.2, 1.3) - time * 0.04));
        float n = fbm2(p * 1.6 + q * 2.2 + vec2(time * 0.03, 0.0));
        float crust = smoothstep(0.30, 0.50, n);
        vec3 hot = vec3(2.0, 0.7, 0.1);
        vec3 warm = vec3(1.6, 0.28, 0.03);
        vec3 dark = vec3(0.16, 0.03, 0.02);
        vec3 col = mix(hot, warm, smoothstep(0.2, 0.45, n));
        col = mix(col, dark, crust);
        float ft = time * 1.6;
        float fk = floor(ft);
        float fa = vnoise(uv * 0.35 + fk * 7.13);
        float fb = vnoise(uv * 0.35 + (fk + 1.0) * 7.13);
        float flick = 0.8 + 0.4 * mix(fa, fb, smoothstep(0.0, 1.0, ft - fk));
        col *= mix(1.0, flick, 1.0 - crust * 0.6);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    fog: true,
  });
}

export function gridMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { time: { value: 0 } },
    ]),
    vertexShader: WORLD_VERT,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float time;
      varying vec3 vW;
      ${NOISE}
      void main(){
        vec2 p = vW.xz * 0.012;
        float n = fbm2(p + vec2(time * 0.012, time * 0.007));
        float n2 = fbm3(p * 2.7 - vec2(time * 0.02, 0.0));
        vec3 cloud = mix(vec3(0.07, 0.05, 0.22), vec3(0.24, 0.1, 0.36), n2);
        vec3 col = mix(vec3(0.012, 0.008, 0.04), cloud, smoothstep(0.35, 0.8, n));
        col += vec3(0.08, 0.16, 0.3) * pow(max(n2 - 0.55, 0.0) * 2.2, 2.0);
        vec2 c = vW.xz / 24.0;
        vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        float fade = 1.0 - smoothstep(60.0, 120.0, length(vW.xz - cameraPosition.xz));
        vec3 neon = mix(vec3(0.2, 0.9, 1.6), vec3(1.6, 0.3, 1.4), 0.5 + 0.5 * sin(vW.x * 0.01 + vW.z * 0.006 + time * 0.3));
        col += neon * line * 0.45 * fade;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    fog: true,
  });
}

export function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, time: { value: 0 }, strength: { value: 0 }, hero: { value: new THREE.Vector4(0, -1e4, 0, 0) } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform vec3 color; uniform float time; uniform float strength; uniform vec4 hero; varying vec2 vUv; varying vec3 vW;
      void main(){
        float a = pow(1.0 - vUv.y, 1.6) * strength;
        a *= 1.0 - hero.w * (1.0 - smoothstep(0.4, 2.6, abs(vW.y - hero.y - 0.9)));
        float stripes = 0.75 + 0.25 * sin(vUv.y * 30.0 - time * 6.0);
        gl_FragColor = vec4(color * 1.6 * stripes, a * 0.55);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
}

export function portalMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, time: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 color; uniform float time; varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float a = atan(p.y, p.x);
        float sw = fbm3(vec2(a * 1.6 + r * 4.0 - time * 1.2, r * 3.0 - time * 0.6));
        float core = smoothstep(1.0, 0.0, r);
        float v = core * (0.35 + sw * 0.9) + smoothstep(0.75, 0.98, r) * smoothstep(1.0, 0.95, r) * 0.8;
        gl_FragColor = vec4(mix(color, vec3(1.0), core * 0.35) * (0.6 + v), v * 0.85);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
}

export function canopyMaterial(cols) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        top: { value: new THREE.Color(cols.top) },
        shade: { value: new THREE.Color(cols.shade) },
        glow: { value: new THREE.Color(cols.glow) },
      },
    ]),
    vertexShader: WORLD_VERT,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform float time; uniform vec3 top; uniform vec3 shade; uniform vec3 glow;
      varying vec3 vW;
      ${NOISE}
      void main(){
        vec2 p = vW.xz * 0.03;
        vec2 ip = floor(p);
        vec2 fp = fract(p);
        float d1 = 8.0;
        vec2 rel = vec2(0.0);
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 o = vec2(float(x), float(y));
          vec2 h = vec2(hash12(ip + o), hash12(ip + o + 17.3));
          vec2 r = o + h * 0.8 + 0.1 - fp;
          float d = dot(r, r);
          if (d < d1) { d1 = d; rel = r; }
        }
        float dome = 1.0 - smoothstep(0.0, 0.62, sqrt(d1));
        float n = fbm3(vW.xz * 0.12);
        vec3 col = mix(shade, top, clamp(dome * 0.95 + (n - 0.5) * 0.25, 0.0, 1.0));
        col += vec3(0.2, 0.45, 0.4) * 0.12 * pow(dome, 3.0) * smoothstep(-0.2, 0.4, -rel.x + rel.y);
        vec2 g = vW.xz * 0.11;
        float cell = hash12(floor(g));
        float sp = smoothstep(0.22, 0.02, length(fract(g) - 0.5 - (vec2(hash12(floor(g) + 3.1), hash12(floor(g) + 7.7)) - 0.5) * 0.2)) * step(0.92, cell);
        col += glow * sp * (0.75 + 0.25 * sin(time * 0.8 + cell * 40.0)) * 3.0;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    fog: true,
  });
}

export function nearFade(m, key, r = 3.5) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, renderer) => {
    if (prev) prev(sh, renderer);
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n { vec3 ipos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; transformed *= smoothstep(' + (r * 0.45).toFixed(2) + ', ' + r.toFixed(1) + ', distance(ipos, cameraPosition)); }\n#endif');
  };
  m.customProgramCacheKey = () => key + 'NF';
  return m;
}
