import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export function create({group, params, container}){
  const geom = new THREE.PlaneGeometry(2,2);
  const frag = `
    precision highp float;
    uniform float time;
    uniform vec2 resolution;
    uniform float steps;
    uniform float maxDistance;
    uniform float epsilon;
    uniform vec3 lightPos;
    uniform vec3 colorA;
    uniform vec3 colorB;
    uniform vec3 bgColor;
    uniform float useGradient;
    uniform float sphereModAmp;
    uniform float sphereModFreq;
    uniform float noiseScale;
    uniform float noiseSpeed;
    uniform float noiseIntensity;
    varying vec2 vUv;

    vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      float a = dot(hash2(i + vec2(0.0,0.0)), f - vec2(0.0,0.0));
      float b = dot(hash2(i + vec2(1.0,0.0)), f - vec2(1.0,0.0));
      float c = dot(hash2(i + vec2(0.0,1.0)), f - vec2(0.0,1.0));
      float d = dot(hash2(i + vec2(1.0,1.0)), f - vec2(1.0,1.0));
      return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
    }
    float fbm(vec2 p){ float v = 0.0; float a = 0.5; for(int i=0;i<5;i++){ v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }

    float sdSphere(vec3 p, float r){ return length(p) - r; }

    vec2 map(vec3 p){
      vec3 sc = vec3(0.0, 0.0, 500.0);
      float t = time * noiseSpeed;
      float n = fbm((p.xy + vec2(t)) * noiseScale) * noiseIntensity;
      float mod = sin(time * sphereModFreq + n * 6.2831) * sphereModAmp;
      float baseR = 120.0;
      float r = baseR + mod;
      float dSphere = sdSphere(p - sc, r);
      return vec2(dSphere, 1.0);
    }

    vec3 calcNormal(vec3 p){
      float h = max(epsilon, 0.0005);
      vec3 dx = vec3(h, 0.0, 0.0);
      vec3 dy = vec3(0.0, h, 0.0);
      vec3 dz = vec3(0.0, 0.0, h);
      float nx = map(p + dx).x - map(p - dx).x;
      float ny = map(p + dy).x - map(p - dy).x;
      float nz = map(p + dz).x - map(p - dz).x;
      return normalize(vec3(nx, ny, nz));
    }

    void main(){
      vec2 uv = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
      vec3 ro = vec3(0.0, 0.0, -200.0);
      vec3 rd = normalize(vec3(uv, 1.0));

      float tRay = 0.0;
      float hitId = -1.0;
      for(int i=0;i<512;i++){
        if(float(i) >= steps) break;
        vec3 p = ro + rd * tRay;
        vec2 m = map(p);
        float d = m.x;
        hitId = m.y;
        if(d < epsilon) break;
        tRay += d;
        if(tRay > maxDistance) break;
      }

      vec3 col = vec3(0.0);
      if(tRay < maxDistance){
        vec3 pos = ro + rd * tRay;
        vec3 n = calcNormal(pos);
        vec3 L = normalize(lightPos - pos);
        float diff = max(dot(n, L), 0.0);
        float spec = pow(max(dot(reflect(-L, n), normalize(-rd)), 0.0), 32.0);
        float fres = pow(1.0 - max(dot(normalize(-rd), n), 0.0), 3.0);
        vec3 base = mix(colorA, colorB, 0.5 + 0.5 * sin(length(pos.xy) * 0.005 + time * 0.8));
        col = base * (0.15 + 0.85 * diff) + spec * vec3(1.0) + fres * mix(vec3(1.0), base, 0.5) * 0.3;
        gl_FragColor = vec4(col, 1.0);
      } else {
        if(useGradient > 0.5){
          col = mix(colorA, colorB, 0.5 + 0.5 * rd.y);
          gl_FragColor = vec4(col, 0.0);
        } else {
          col = bgColor;
          gl_FragColor = vec4(col, 1.0);
        }
      }
    }
  `;
  const vert = `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `;
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
      steps: { value: params.raymarchSteps },
      maxDistance: { value: params.raymarchMaxDistance },
      epsilon: { value: params.raymarchEpsilon },
      lightPos: { value: new THREE.Vector3(params.raymarchLightX, params.raymarchLightY, params.raymarchLightZ) },
      colorA: { value: new THREE.Color(params.colorA) },
      colorB: { value: new THREE.Color(params.colorB) },
      bgColor: { value: new THREE.Color(params.background) },
      sphereModAmp: { value: params.raySphereModAmp },
      sphereModFreq: { value: params.raySphereModFreq },
      noiseScale: { value: params.rayNoiseScale },
      noiseSpeed: { value: params.rayNoiseSpeed },
      noiseIntensity: { value: params.rayNoiseIntensity },
      useGradient: { value: params.gradient ? 1.0 : 0.0 }
    },
    transparent: true,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.scale.set(1000,1000,1);
  mesh.userData.type = 'Raymarching';
  mesh.position.set(0,0,-300);
  group.add(mesh);
}
