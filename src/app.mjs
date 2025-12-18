import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.18/dist/lil-gui.esm.min.js';

/* ES Module entry for Three-Gen editor (imports module builds of three + lil-gui) */
(function(){
  const container = document.getElementById('canvas-container');

  let scene, camera, renderer, clock, animId;
  let group;

  const params = {
    pattern: 'Vortex',
    colorA: '#00aaff',
    colorB: '#ff44aa',
    count: 1200,
    size: 3,
    speed: 1.0,
    spread: 600,
    background: '#0b0b0b',
    motion: 'swirl',
    colorSpeed: 0.6,
    gradient: true,
    gradientAngle: 135,
    // new visual controls
    centers: 3,
    circularSpeed: 1.0,
    swirlIntensity: 1.0,
    radialWobble: 0.6,
    // shader primitives (only distorting plane uses these)
    shaderDistortion: 1.6,
    shaderSpeed: 1.0
    ,
    // wireframe terrain params
    terrainSegmentsX: 200,
    terrainSegmentsY: 100,
    terrainScale: 1.8,
    terrainHeight: 120,
    terrainSpeed: 0.9,
    terrainWireframe: true
    ,
    
    // layered parallax planes (removed)
    
    // raymarching shader params
    raymarchSteps: 80,
    raymarchMaxDistance: 2000,
    raymarchEpsilon: 0.001,
    raymarchLightX: 200,
    raymarchLightY: 300,
    raymarchLightZ: 400
    ,
    // sphere modulation / noise params
    raySphereModAmp: 40.0,
    raySphereModFreq: 1.6,
    rayNoiseScale: 0.8,
    rayNoiseSpeed: 0.6,
    rayNoiseIntensity: 1.2
  };

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 5000);
    camera.position.z = 800;

    // Make renderer alpha:true so CSS gradient background can show through the canvas
    renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(container.clientWidth, container.clientHeight);
    // If gradient is enabled we'll keep renderer transparent so CSS gradient is visible
    if(params.gradient) renderer.setClearColor(0x000000, 0);
    else renderer.setClearColor(new THREE.Color(params.background));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // initialize clock before doing any time-based updates
    clock = new THREE.Clock();
    if(params.gradient) updateBackgroundGradient();
    group = new THREE.Group();
    scene.add(group);

    buildPattern();
    setupGUI();

    window.addEventListener('resize', onResize);
    animate();
  }

  function onResize(){
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }

  function clearGroup(){
    while(group.children.length) {
      const c = group.children[0];
      if(c.geometry) c.geometry.dispose();
      if(c.material) {
        if(c.material.map) c.material.map.dispose();
        c.material.dispose();
      }
      group.remove(c);
    }
  }

  function buildPattern(){
    clearGroup();
    const p = params.pattern;
    if(p === 'Vortex') createVortex();
    else if(p === 'Flow Field') createFlowField();
    else if(p === 'Lissajous') createLissajous();
    else if(p === 'Fireflies') createFireflies();
    else if(p === 'Waves') createWaves();
    else if(p === 'Distorting Plane') createDistortingPlane();
    else if(p === 'Wireframe Terrain') createWireframeTerrain();
    else if(p === 'Raymarching') createRaymarching();
    else createVortex();
  }

  function createParticles(){
    // Create particles positioned to fill the camera frustum (so they cover the full background)
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.count * 3);
    const colors = new Float32Array(params.count * 3);
    const baseColors = new Float32Array(params.count * 3);
    const colorA = new THREE.Color(params.colorA);
    const colorB = new THREE.Color(params.colorB);

    // arrays for circular/orbit motion per particle
    const centerX = new Float32Array(params.count);
    const centerY = new Float32Array(params.count);
    const radius = new Float32Array(params.count);
    const angle = new Float32Array(params.count);
    const angVel = new Float32Array(params.count);

    // derive frustum size at z=0 so particles fill view
    const frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
    const frustumWidth = frustumHeight * camera.aspect;

    // generate a few swirl centers inside the frustum
    const centers = [];
    for(let c=0;c<params.centers;c++){
      centers.push({ x: (Math.random()-0.5) * frustumWidth * 0.8, y: (Math.random()-0.5) * frustumHeight * 0.8 });
    }

    for(let i=0;i<params.count;i++){
      const i3 = i*3;
      // fill the full frustum rectangle
      const x = (Math.random()-0.5) * frustumWidth * 1.0;
      const y = (Math.random()-0.5) * frustumHeight * 1.0;
      const z = (Math.random()-0.5) * Math.min(400, params.spread * 0.6);
      positions[i3+0] = x;
      positions[i3+1] = y;
      positions[i3+2] = z;

      const t = Math.random();
      const c = colorA.clone().lerp(colorB, t);
      colors[i3+0] = c.r; colors[i3+1] = c.g; colors[i3+2] = c.b;
      baseColors[i3+0] = c.r; baseColors[i3+1] = c.g; baseColors[i3+2] = c.b;

      // assign an orbit center for this particle
      const ci = Math.floor(Math.random() * centers.length);
      const cx = centers[ci].x + (Math.random()-0.5) * frustumWidth * 0.06;
      const cy = centers[ci].y + (Math.random()-0.5) * frustumHeight * 0.06;
      centerX[i] = cx; centerY[i] = cy;

      // radius from center (so particles orbit around their assigned center)
      const r0 = Math.hypot(x - cx, y - cy);
      radius[i] = r0 * (0.4 + Math.random() * 1.6);
      angle[i] = Math.atan2(y - cy, x - cx);
      angVel[i] = (0.2 + Math.random() * 1.6) * (0.3 + Math.random() * 1.4);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('baseColor', new THREE.BufferAttribute(baseColors, 3));

    const material = new THREE.PointsMaterial({ size: params.size, vertexColors: true, depthWrite:false, transparent:true, opacity:0.95 });
    const points = new THREE.Points(geometry, material);
    points.userData.type = 'Particles';
    points.userData.centerX = centerX;
    points.userData.centerY = centerY;
    points.userData.radius = radius;
    points.userData.angle = angle;
    points.userData.angVel = angVel;
    group.add(points);
  }

  

  function createWaves(){
    const width = Math.min(1400, params.spread*2);
    const height = Math.min(600, params.spread);
    const segX = 200; const segY = 40;
    const geometry = new THREE.PlaneGeometry(width, height, segX, segY);
    const colorA = new THREE.Color(params.colorA);
    const colorB = new THREE.Color(params.colorB);

    const pos = geometry.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for(let i=0;i<pos.count;i++){
      const t = i / pos.count;
      const c = colorA.clone().lerp(colorB, t);
      cols[i*3+0] = c.r; cols[i*3+1] = c.g; cols[i*3+2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3));

    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, wireframe:false });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.rotation.x = -0.5;
    mesh.userData.type = 'Waves';
    mesh.userData.basePos = geometry.attributes.position.array.slice();
    group.add(mesh);
  }

  // --- New animations ---
  function createVortex(){
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.count * 3);
    const colors = new Float32Array(params.count * 3);
    const baseColors = new Float32Array(params.count * 3);

    // per-particle orbit data
    const cx = new Float32Array(params.count);
    const cy = new Float32Array(params.count);
    const radius = new Float32Array(params.count);
    const angle = new Float32Array(params.count);
    const angVel = new Float32Array(params.count);
    const spiral = new Float32Array(params.count);

    // frustum at z=0
    const frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
    const frustumWidth = frustumHeight * camera.aspect;

    // generate swirl centers
    const centers = [];
    for(let i=0;i<params.centers;i++) centers.push({ x: (Math.random()-0.5)*frustumWidth*0.8, y: (Math.random()-0.5)*frustumHeight*0.8 });

    for(let i=0;i<params.count;i++){
      const i3 = i*3;
      const x = (Math.random()-0.5) * frustumWidth;
      const y = (Math.random()-0.5) * frustumHeight;
      positions[i3+0] = x; positions[i3+1] = y; positions[i3+2] = (Math.random()-0.5)*200;

      const t = Math.random();
      const col = new THREE.Color(params.colorA).lerp(new THREE.Color(params.colorB), t);
      colors[i3+0]=col.r; colors[i3+1]=col.g; colors[i3+2]=col.b;
      baseColors[i3+0]=col.r; baseColors[i3+1]=col.g; baseColors[i3+2]=col.b;

      const ci = Math.floor(Math.random()*centers.length);
      cx[i] = centers[ci].x + (Math.random()-0.5)*frustumWidth*0.06;
      cy[i] = centers[ci].y + (Math.random()-0.5)*frustumHeight*0.06;
      const r0 = Math.hypot(x-cx[i], y-cy[i]);
      radius[i] = Math.max(10, r0 * (0.4 + Math.random()*1.6));
      angle[i] = Math.atan2(y-cy[i], x-cx[i]);
      angVel[i] = (0.3 + Math.random()*1.2) * (Math.random()<0.5? -1: 1);
      spiral[i] = (Math.random()-0.5) * 0.6;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors,3));
    geometry.setAttribute('baseColor', new THREE.BufferAttribute(baseColors,3));

    const mat = new THREE.PointsMaterial({ size: params.size, vertexColors:true, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthTest:false });
    const pts = new THREE.Points(geometry, mat);
    pts.userData.type = 'Vortex';
    pts.userData.cx = cx; pts.userData.cy = cy; pts.userData.radius = radius; pts.userData.angle = angle; pts.userData.angVel = angVel; pts.userData.spiral = spiral;
    group.add(pts);
  }

  function createFlowField(){
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.count * 3);
    const colors = new Float32Array(params.count * 3);

    const frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
    const frustumWidth = frustumHeight * camera.aspect;

    const seeds = new Float32Array(params.count);
    for(let i=0;i<params.count;i++){
      const i3 = i*3;
      positions[i3+0] = (Math.random()-0.5) * frustumWidth * 1.1;
      positions[i3+1] = (Math.random()-0.5) * frustumHeight * 1.1;
      positions[i3+2] = (Math.random()-0.5) * 300;
      const t = Math.random();
      const c = new THREE.Color(params.colorA).lerp(new THREE.Color(params.colorB), t);
      colors[i3+0]=c.r; colors[i3+1]=c.g; colors[i3+2]=c.b;
      seeds[i] = Math.random()*1000;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors,3));

    const mat = new THREE.PointsMaterial({ size: params.size*0.9, vertexColors:true, transparent:true, opacity:0.9, depthTest:false });
    const pts = new THREE.Points(geometry, mat);
    pts.userData.type = 'Flow Field';
    pts.userData.seeds = seeds;
    group.add(pts);
  }

  function createLissajous(){
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.count * 3);
    const colors = new Float32Array(params.count * 3);
    const aArr = new Float32Array(params.count);
    const bArr = new Float32Array(params.count);
    const phase = new Float32Array(params.count);

    const ampX = Math.min(1200, params.spread*1.2);
    const ampY = Math.min(800, params.spread*0.8);

    for(let i=0;i<params.count;i++){
      const i3 = i*3;
      positions[i3+0] = 0; positions[i3+1]=0; positions[i3+2]=(Math.random()-0.5)*200;
      const t = Math.random();
      const c = new THREE.Color(params.colorA).lerp(new THREE.Color(params.colorB), t);
      colors[i3+0]=c.r; colors[i3+1]=c.g; colors[i3+2]=c.b;
      aArr[i] = 1 + Math.floor(Math.random()*6);
      bArr[i] = 1 + Math.floor(Math.random()*6);
      phase[i] = Math.random()*Math.PI*2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors,3));
    const mat = new THREE.PointsMaterial({ size: params.size, vertexColors:true, transparent:true, opacity:0.95, depthTest:false });
    const pts = new THREE.Points(geometry, mat);
    pts.userData.type = 'Lissajous';
    pts.userData.a = aArr; pts.userData.b = bArr; pts.userData.phase = phase; pts.userData.ampX = ampX; pts.userData.ampY = ampY;
    group.add(pts);
  }

  function createFireflies(){
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.count * 3);
    const colors = new Float32Array(params.count * 3);
    const intensity = new Float32Array(params.count);

    const frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
    const frustumWidth = frustumHeight * camera.aspect;

    for(let i=0;i<params.count;i++){
      const i3 = i*3;
      positions[i3+0] = (Math.random()-0.5) * frustumWidth;
      positions[i3+1] = (Math.random()-0.5) * frustumHeight;
      positions[i3+2] = (Math.random()-0.5) * 200;
      const col = new THREE.Color(params.colorA).lerp(new THREE.Color(params.colorB), Math.random());
      colors[i3+0]=col.r; colors[i3+1]=col.g; colors[i3+2]=col.b;
      intensity[i] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors,3));

    const mat = new THREE.PointsMaterial({ size: params.size*1.8, vertexColors:true, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthTest:false });
    const pts = new THREE.Points(geometry, mat);
    pts.userData.type = 'Fireflies';
    pts.userData.intensity = intensity;
    group.add(pts);
  }

  // --- Shader-based geometric primitives ---
  // Simple layered-sine displacement shader (fast, visually rich)
  const primitiveVertex = `
    uniform float time;
    uniform float distortion;
    uniform float speed;
    uniform float intensity;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main(){
      vNormal = normal;
      vPosition = position;
      float t = time * speed;
      // layered sine turbulence
      float d = sin((position.x + t) * 0.8) * 0.5;
      d += sin((position.y - t*0.9) * 1.3) * 0.35;
      d += sin((position.z*0.5 + t*1.2) * 0.6) * 0.25;
      d *= distortion * intensity;
      vec3 displaced = position + normal * d;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `;

  const primitiveFragment = `
    uniform vec3 colorA;
    uniform vec3 colorB;
    uniform float time;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main(){
      float n = dot(normalize(vNormal), vec3(0.0,0.0,1.0)) * 0.5 + 0.5;
      float pulse = 0.5 + 0.5 * sin(time * 3.0 + length(vPosition) * 0.02);
      vec3 c = mix(colorA, colorB, n * pulse);
      gl_FragColor = vec4(c, 1.0);
    }
  `;


  function createDistortingPlane(){
    // Full-screen plane with vertex displacement in view-space
    const geom = new THREE.PlaneGeometry(2,2, 64,64);
    const planeVert = `
      uniform float time; uniform float distortion; uniform float speed; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; float t=time*speed; float d = sin((uv.x+ t)*10.0) * 0.1 + cos((uv.y - t)*12.0)*0.08; p.z += d * distortion * 200.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }
    `;
    const planeFrag = `
      uniform vec3 colorA; uniform vec3 colorB; uniform float time; varying vec2 vUv; void main(){ float m = 0.5 + 0.5 * sin(time*1.5 + vUv.x*10.0); vec3 c = mix(colorA, colorB, m); gl_FragColor = vec4(c,1.0); }
    `;
    const mat = new THREE.ShaderMaterial({ vertexShader: planeVert, fragmentShader: planeFrag, uniforms: { time:{value:0}, distortion:{value:params.shaderDistortion}, speed:{value:params.shaderSpeed}, colorA:{value:new THREE.Color(params.colorA)}, colorB:{value:new THREE.Color(params.colorB)} }, side:THREE.DoubleSide });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.scale.set(1000,1000,1);
    mesh.userData.type = 'Distorting Plane';
    mesh.position.set(0,0,-300);
    group.add(mesh);
  }

  // Gradient Noise Plane removed

  function createRaymarching(){
    // Fullscreen raymarching quad (screen-space SDF raymarch)
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

      // hash / noise / fbm (iq style)
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

      // SDFs
      float sdSphere(vec3 p, float r){ return length(p) - r; }

      // map returns distance and an ID (1.0 = sphere)
      vec2 map(vec3 p){
        // sphere center in front of camera (only sphere, no plane)
        vec3 sc = vec3(0.0, 0.0, 500.0);
        float t = time * noiseSpeed;
        float n = fbm((p.xy + vec2(t)) * noiseScale) * noiseIntensity;
        float mod = sin(time * sphereModFreq + n * 6.2831) * sphereModAmp;
        float baseR = 120.0;
        float r = baseR + mod;
        float dSphere = sdSphere(p - sc, r);
        return vec2(dSphere, 1.0);
      }

      // approximate normal by central differences
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
          // subtle fresnel for edge glow
          float fres = pow(1.0 - max(dot(normalize(-rd), n), 0.0), 3.0);
          vec3 base = mix(colorA, colorB, 0.5 + 0.5 * sin(length(pos.xy) * 0.005 + time * 0.8));
          col = base * (0.15 + 0.85 * diff) + spec * vec3(1.0) + fres * mix(vec3(1.0), base, 0.5) * 0.3;
          gl_FragColor = vec4(col, 1.0);
          } else {
          // sky: when gradient enabled we'll make sky transparent so CSS gradient shows through;
          // when gradient is disabled, use the bgColor uniform controlled by the background controller
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
        noiseIntensity: { value: params.rayNoiseIntensity }
      ,
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

  // Layered Parallax removed

  function createWireframeTerrain(){
    // Subdivided plane geometry used as a wireframe terrain
    const width = Math.min(1600, params.spread * 2);
    const height = Math.min(900, params.spread * 1.2);
    const segX = Math.max(2, Math.floor(params.terrainSegmentsX));
    const segY = Math.max(2, Math.floor(params.terrainSegmentsY));
    const geom = new THREE.PlaneGeometry(width, height, segX, segY);

    // make position attribute dynamic for per-frame updates
    if(geom.attributes && geom.attributes.position && typeof geom.attributes.position.setUsage === 'function'){
      try{ geom.attributes.position.setUsage(THREE.DynamicDrawUsage); }catch(e){}
    }

    // store base positions for CPU-side displacement
    const basePos = new Float32Array(geom.attributes.position.array.slice());
    geom.setAttribute('basePos', new THREE.BufferAttribute(basePos.slice(), 3));

    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(params.colorA), wireframe: !!params.terrainWireframe, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geom, mat);
    // tilt the plane so the camera sees the wireframe as terrain
    mesh.rotation.x = -0.6;
    mesh.position.set(0, -80, 0);
    mesh.userData.type = 'Wireframe Terrain';
    mesh.userData.basePos = basePos;
    mesh.userData.segX = segX; mesh.userData.segY = segY;
    group.add(mesh);
  }

  function updatePattern(delta){
    const time = clock.getElapsedTime();
    // compute frustum size for wrapping
    const frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
    const frustumWidth = frustumHeight * camera.aspect;

    group.children.forEach(child => {
      const type = child.userData.type;
      if(type === 'Vortex'){
        const geo = child.geometry;
        const pos = geo.attributes.position;
        const cols = geo.attributes.color;
        const cx = child.userData.cx, cy = child.userData.cy, radius = child.userData.radius, angleArr = child.userData.angle, angVel = child.userData.angVel, spiral = child.userData.spiral;
        const globalSwirl = params.swirlIntensity * 0.08 * Math.sin(time * 0.07);
        for(let i=0;i<pos.count;i++){
          const i3 = i*3;
          angleArr[i] += angVel[i] * params.circularSpeed * delta * 0.8;
          radius[i] += spiral[i] * delta * 6.0;
          const a = angleArr[i] + globalSwirl;
          pos.array[i3+0] = cx[i] + Math.cos(a) * radius[i];
          pos.array[i3+1] = cy[i] + Math.sin(a) * radius[i] * 0.9;
          pos.array[i3+2] = Math.sin(a*0.6 + time*0.5) * 40;
          // color breathing
          const baseR = geo.attributes.baseColor.array[i3+0], baseG = geo.attributes.baseColor.array[i3+1], baseB = geo.attributes.baseColor.array[i3+2];
          const c = new THREE.Color(baseR, baseG, baseB);
          c.offsetHSL(Math.sin(time*0.6 + i*0.02) * 0.12, 0, Math.cos(time*0.4 + i*0.01) * 0.04);
          cols.array[i3+0]=c.r; cols.array[i3+1]=c.g; cols.array[i3+2]=c.b;
        }
        pos.needsUpdate = true; if(cols) cols.needsUpdate = true;
      } else if(type === 'Flow Field'){
        const geo = child.geometry;
        const pos = geo.attributes.position;
        const cols = geo.attributes.color;
        const seeds = child.userData.seeds;
        for(let i=0;i<pos.count;i++){
          const i3 = i*3;
          let x = pos.array[i3+0], y = pos.array[i3+1];
          // pseudo-noise flow using sin/cos blends
          const s = seeds[i];
          const ang = Math.sin((x*0.003 + time*0.6) + s) * Math.PI + Math.cos((y*0.002 - time*0.4) * 0.7 + s) * Math.PI*0.5;
          const vx = Math.cos(ang), vy = Math.sin(ang);
          x += vx * 40 * params.circularSpeed * delta;
          y += vy * 40 * params.circularSpeed * delta;
          // wrap around edges to keep coverage
          if(x > frustumWidth*0.7) x = -frustumWidth*0.7; if(x < -frustumWidth*0.7) x = frustumWidth*0.7;
          if(y > frustumHeight*0.7) y = -frustumHeight*0.7; if(y < -frustumHeight*0.7) y = frustumHeight*0.7;
          pos.array[i3+0] = x; pos.array[i3+1] = y;
          pos.array[i3+2] = Math.sin((x+y)*0.002 + time*0.8) * 60;
          // color shift
          const col = new THREE.Color(params.colorA).lerp(new THREE.Color(params.colorB), (Math.sin(time*0.2 + s) + 1)*0.5);
          cols.array[i3+0] = col.r; cols.array[i3+1] = col.g; cols.array[i3+2] = col.b;
        }
        pos.needsUpdate = true; if(cols) cols.needsUpdate = true;
      } else if(type === 'Lissajous'){
        const geo = child.geometry;
        const pos = geo.attributes.position;
        const cols = geo.attributes.color;
        const aArr = child.userData.a, bArr = child.userData.b, phase = child.userData.phase;
        const ampX = child.userData.ampX, ampY = child.userData.ampY;
        for(let i=0;i<pos.count;i++){
          const i3 = i*3;
          const a = aArr[i], b = bArr[i], ph = phase[i];
          pos.array[i3+0] = Math.sin(a * time * 0.6 + ph) * ampX * 0.5;
          pos.array[i3+1] = Math.sin(b * time * 0.55 + ph*0.8) * ampY * 0.5;
          pos.array[i3+2] = Math.cos((a+b)*time*0.15 + ph) * 80;
          // subtle color shift
          const tcol = (Math.sin(time*0.3 + i*0.02) + 1) * 0.5;
          const col = new THREE.Color(params.colorA).lerp(new THREE.Color(params.colorB), tcol);
          cols.array[i3+0] = col.r; cols.array[i3+1] = col.g; cols.array[i3+2] = col.b;
        }
        pos.needsUpdate = true; if(cols) cols.needsUpdate = true;
      } else if(type === 'Fireflies'){
        const geo = child.geometry;
        const pos = geo.attributes.position;
        const cols = geo.attributes.color;
        const intensity = child.userData.intensity;
        for(let i=0;i<pos.count;i++){
          const i3 = i*3;
          // small jitter motion
          pos.array[i3+0] += Math.sin(time*0.7 + i) * 0.2 * params.circularSpeed * delta;
          pos.array[i3+1] += Math.cos(time*0.6 + i*0.7) * 0.18 * params.circularSpeed * delta;
          pos.array[i3+2] = Math.sin(time*0.9 + i*0.3) * 60;
          // twinkle via color brightness
          const t = (Math.sin(time*3.0 + i*0.5) * 0.5 + 0.5) * intensity[i];
          const base = new THREE.Color(params.colorA).lerp(new THREE.Color(params.colorB), Math.random());
          cols.array[i3+0] = base.r * (0.6 + t*0.8);
          cols.array[i3+1] = base.g * (0.6 + t*0.8);
          cols.array[i3+2] = base.b * (0.6 + t*0.8);
        }
        pos.needsUpdate = true; if(cols) cols.needsUpdate = true;
      } else if(type === 'Waves'){
        const geo = child.geometry;
        const pos = geo.attributes.position;
        const basePos = child.userData.basePos;
        for(let i=0;i<pos.count;i++){
          const ix = i*3;
          const bx = basePos[ix+0];
          pos.array[ix+2] = Math.sin((bx + time*40) * 0.008) * 18 + Math.cos((i + time*30) * 0.02) * 6;
        }
        pos.needsUpdate = true;
      } else if(type === 'Wireframe Terrain'){
        const geo = child.geometry;
        const pos = geo.attributes.position;
        const base = child.userData.basePos;
        const scale = params.terrainScale;
        const h = params.terrainHeight;
        const spd = params.terrainSpeed;
        // simplified single-wave displacement for stability and performance
        const factor = 0.005 * scale;
        for(let i=0;i<pos.count;i++){
          const ix = i*3;
          const bx = base[ix+0];
          const by = base[ix+1];
          const f = (bx + by) * factor + time * spd * 0.6;
          pos.array[ix+2] = Math.sin(f) * h;
        }
        pos.needsUpdate = true;
        // update wireframe toggle dynamically
        if(child.material) child.material.wireframe = !!params.terrainWireframe;
      }
      // Update shader uniforms if present on this child
      if(child.material && child.material.uniforms){
        const u = child.material.uniforms;
        if(u.time) u.time.value = time;
        if(u.distortion && 'shaderDistortion' in params) u.distortion.value = params.shaderDistortion;
        if(u.speed && 'shaderSpeed' in params) u.speed.value = params.shaderSpeed;
        if(u.colorA) u.colorA.value = new THREE.Color(params.colorA);
        if(u.colorB) u.colorB.value = new THREE.Color(params.colorB);
        // gradient noise uniforms (removed - gradient-noise plane deleted)
        // raymarch uniforms
        if(u.resolution && typeof u.resolution.value !== 'undefined') u.resolution.value.set(container.clientWidth, container.clientHeight);
        if(u.steps) u.steps.value = params.raymarchSteps;
        if(u.maxDistance) u.maxDistance.value = params.raymarchMaxDistance;
        if(u.epsilon) u.epsilon.value = params.raymarchEpsilon;
        if(u.lightPos && typeof u.lightPos.value !== 'undefined') u.lightPos.value.set(params.raymarchLightX, params.raymarchLightY, params.raymarchLightZ);
        if(u.sphereModAmp) u.sphereModAmp.value = params.raySphereModAmp;
        if(u.sphereModFreq) u.sphereModFreq.value = params.raySphereModFreq;
        if(u.noiseScale) u.noiseScale.value = params.rayNoiseScale;
        if(u.noiseSpeed) u.noiseSpeed.value = params.rayNoiseSpeed;
        if(u.noiseIntensity) u.noiseIntensity.value = params.rayNoiseIntensity;
        if(u.useGradient) u.useGradient.value = params.gradient ? 1.0 : 0.0;
        if(u.bgColor) u.bgColor.value = new THREE.Color(params.background);
      }
    });

    if(params.gradient) updateBackgroundGradient();
  }

  function updateBackgroundGradient(){
    const t = clock.getElapsedTime();
    const angle = (params.gradientAngle + Math.sin(t*0.05)*8).toFixed(2);
    container.style.background = `linear-gradient(${angle}deg, ${params.colorA}, ${params.colorB})`;
  }

  function rebuildColors(){
    const ca = new THREE.Color(params.colorA), cb = new THREE.Color(params.colorB);
    group.children.forEach(child => {
      if(child.geometry && child.geometry.attributes && child.geometry.attributes.color){
        const cols = child.geometry.attributes.color;
        for(let i=0;i<cols.count;i++){
          const t = i / Math.max(1, cols.count - 1);
          const c = ca.clone().lerp(cb, t);
          const i3 = i*3;
          cols.array[i3+0] = c.r; cols.array[i3+1] = c.g; cols.array[i3+2] = c.b;
        }
        cols.needsUpdate = true;
      }
      if(child.material && child.material.uniforms){
        if(child.material.uniforms.colorA) child.material.uniforms.colorA.value = new THREE.Color(params.colorA);
        if(child.material.uniforms.colorB) child.material.uniforms.colorB.value = new THREE.Color(params.colorB);
      }
      // if material is a basic material (mesh), update its color
      if(child.material && child.material.color){
        try{ child.material.color.set(params.colorA); }catch(e){}
      }
    });
    if(params.gradient) updateBackgroundGradient(); else { container.style.background = params.background; }
  }

  function rebuildSizes(){
    group.children.forEach(child => {
      if(child.material && typeof child.material.size !== 'undefined'){
        child.material.size = params.size;
      }
    });
  }

  function animate(){
    animId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    updatePattern(delta);
    renderer.render(scene, camera);
  }

  function setupGUI(){
    const gui = new GUI({ container: document.getElementById('controls'), width:300 });

    // keep references to controllers so we can show/hide by pattern
    const controllers = {};
    controllers.pattern = gui.add(params, 'pattern', ['Vortex','Flow Field','Lissajous','Fireflies','Waves','Distorting Plane','Wireframe Terrain','Raymarching']).onChange(()=>{ buildPattern(); updateGUIForPattern(); });
    controllers.colorA = gui.addColor(params, 'colorA').onChange(()=> rebuildColors());
    controllers.colorB = gui.addColor(params, 'colorB').onChange(()=> rebuildColors());
    controllers.motion = gui.add(params, 'motion', ['swirl','float','burst']).name('Motion');
    controllers.colorSpeed = gui.add(params, 'colorSpeed', 0.0, 3.0, 0.01).name('Color Speed');
    controllers.centers = gui.add(params, 'centers', 1, 8, 1).name('Swirl Centers').onChange(()=> buildPattern());
    controllers.circularSpeed = gui.add(params, 'circularSpeed', 0.0, 4.0, 0.01).name('Circular Speed');
    controllers.swirlIntensity = gui.add(params, 'swirlIntensity', 0.0, 3.0, 0.01).name('Swirl Intensity');
    controllers.radialWobble = gui.add(params, 'radialWobble', 0.0, 2.0, 0.01).name('Radial Wobble');
    controllers.count = gui.add(params, 'count', 100, 4000, 1).onChange(()=> buildPattern());
    controllers.size = gui.add(params, 'size', 0.5, 20, 0.1).onChange(()=> { rebuildSizes(); });
    controllers.speed = gui.add(params, 'speed', 0.1, 3, 0.05);
    controllers.spread = gui.add(params, 'spread', 100, 2000, 1).onChange(()=> buildPattern());
    controllers.background = gui.addColor(params, 'background').onChange(v => {
      if(!params.gradient){ renderer.setClearColor(new THREE.Color(v), 1); container.style.background = v; }
      else updateBackgroundGradient();
    });
    controllers.gradient = gui.add(params, 'gradient').name('Gradient BG').onChange(v => {
      if(!v){ container.style.background = params.background; renderer.setClearColor(new THREE.Color(params.background), 1); }
      else { renderer.setClearColor(0x000000, 0); updateBackgroundGradient(); }
    });
    controllers.gradientAngle = gui.add(params, 'gradientAngle', 0, 360, 1).name('Gradient Angle').onChange(()=> updateBackgroundGradient());

    // Wireframe Terrain controls
    controllers.terrainSegmentsX = gui.add(params, 'terrainSegmentsX', 8, 600, 1).name('Terrain Seg X').onChange(()=> buildPattern());
    controllers.terrainSegmentsY = gui.add(params, 'terrainSegmentsY', 4, 400, 1).name('Terrain Seg Y').onChange(()=> buildPattern());
    controllers.terrainScale = gui.add(params, 'terrainScale', 0.2, 6.0, 0.05).name('Terrain Scale');
    controllers.terrainHeight = gui.add(params, 'terrainHeight', 0, 600, 1).name('Terrain Height');
    controllers.terrainSpeed = gui.add(params, 'terrainSpeed', 0.0, 4.0, 0.01).name('Terrain Speed');
    controllers.terrainWireframe = gui.add(params, 'terrainWireframe').name('Wireframe');

    // Layered Parallax controls (removed)

    // Raymarching controls
    controllers.raymarchSteps = gui.add(params, 'raymarchSteps', 8, 256, 1).name('Raymarch Steps');
    controllers.raymarchMaxDistance = gui.add(params, 'raymarchMaxDistance', 100, 5000, 1).name('Raymarch MaxDist');
    controllers.raymarchEpsilon = gui.add(params, 'raymarchEpsilon', 0.0001, 0.01, 0.0001).name('Raymarch Eps');
    controllers.raymarchLightX = gui.add(params, 'raymarchLightX', -2000, 2000, 1).name('Light X');
    controllers.raymarchLightY = gui.add(params, 'raymarchLightY', -2000, 2000, 1).name('Light Y');
    controllers.raymarchLightZ = gui.add(params, 'raymarchLightZ', -2000, 2000, 1).name('Light Z');
    controllers.raySphereModAmp = gui.add(params, 'raySphereModAmp', 0.0, 300.0, 1.0).name('Sphere Mod Amp');
    controllers.raySphereModFreq = gui.add(params, 'raySphereModFreq', 0.0, 8.0, 0.01).name('Sphere Mod Freq');
    controllers.rayNoiseScale = gui.add(params, 'rayNoiseScale', 0.05, 4.0, 0.01).name('Ray Noise Scale');
    controllers.rayNoiseSpeed = gui.add(params, 'rayNoiseSpeed', 0.0, 4.0, 0.01).name('Ray Noise Speed');
    controllers.rayNoiseIntensity = gui.add(params, 'rayNoiseIntensity', 0.0, 4.0, 0.01).name('Ray Noise Int');

    // expose controllers store on gui for later access
    gui._controllers = controllers;

    // helper: show/hide controllers based on selected pattern
    function updateGUIForPattern(){
      const c = gui._controllers;
      const p = params.pattern;
      // helper to hide all optional controllers first
      const optional = ['centers','circularSpeed','swirlIntensity','radialWobble','count','size','speed','spread','terrainSegmentsX','terrainSegmentsY','terrainScale','terrainHeight','terrainSpeed','terrainWireframe','raymarchSteps','raymarchMaxDistance','raymarchEpsilon','raymarchLightX','raymarchLightY','raymarchLightZ','raySphereModAmp','raySphereModFreq','rayNoiseScale','rayNoiseSpeed','rayNoiseIntensity'];
      optional.forEach(k => { if(c[k] && c[k].hide) c[k].hide(); });

      // show common controls
      if(c.colorA && c.colorA.show) c.colorA.show();
      if(c.colorB && c.colorB.show) c.colorB.show();
      if(c.gradient && c.gradient.show) c.gradient.show();
      if(c.gradientAngle && c.gradientAngle.show) c.gradientAngle.show();

      // Particle-like patterns
      if(['Vortex','Flow Field','Lissajous','Fireflies'].includes(p)){
        ['centers','circularSpeed','swirlIntensity','radialWobble','count','size','speed','spread','motion','colorSpeed'].forEach(k=>{ if(c[k] && c[k].show) c[k].show(); });
      }

      // Waves / Distorting Plane
      if(p === 'Waves'){
        if(c.size && c.size.show) c.size.show();
      }
      if(p === 'Distorting Plane'){
        if(c.size && c.size.show) c.size.show();
      }

      // Wireframe Terrain
      if(p === 'Wireframe Terrain'){
        ['terrainSegmentsX','terrainSegmentsY','terrainScale','terrainHeight','terrainSpeed','terrainWireframe'].forEach(k=>{ if(c[k] && c[k].show) c[k].show(); });
      }

      // Layered Parallax (removed)

      // Raymarching
      if(p === 'Raymarching'){
        ['raymarchSteps','raymarchMaxDistance','raymarchEpsilon','raymarchLightX','raymarchLightY','raymarchLightZ','raySphereModAmp','raySphereModFreq','rayNoiseScale','rayNoiseSpeed','rayNoiseIntensity'].forEach(k=>{ if(c[k] && c[k].show) c[k].show(); });
      }
      // apply background visibility/sync after changing controllers
      if(params.gradient) {
        renderer.setClearColor(0x000000, 0);
        updateBackgroundGradient();
      } else {
        renderer.setClearColor(new THREE.Color(params.background), 1);
        container.style.background = params.background;
      }
    }

      // call once to set initial visibility
    updateGUIForPattern();
    // ensure renderer / container background matches current params
    if(params.gradient) {
      renderer.setClearColor(0x000000, 0);
      updateBackgroundGradient();
    } else {
      renderer.setClearColor(new THREE.Color(params.background), 1);
      container.style.background = params.background;
    }

    document.getElementById('download-html').addEventListener('click', () => {
      const html = generateStandaloneHTML();
      const blob = new Blob([html], { type:'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'three-gen-export.html';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function generateStandaloneHTML(){
    try{
      if(typeof window.generateStandaloneHTML === 'function') return window.generateStandaloneHTML(params);
    }catch(e){}
    const exportParams = JSON.parse(JSON.stringify(params));
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Three-Gen Export</title>
  <style>html,body{height:100%;margin:0;background:${exportParams.background};}canvas{display:block;width:100%;height:100%;}</style>
</head>
<body>
  <div id="c"></div>
  <script src="https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js"></script>
  <script>
    (function(){
      const params = ${JSON.stringify(exportParams)};
      const container = document.getElementById('c');
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 1, 5000);
      camera.position.z = 800;
      const renderer = new THREE.WebGLRenderer({antialias:true});
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(new THREE.Color(params.background));
      container.appendChild(renderer.domElement);
      const group = new THREE.Group(); scene.add(group);
      function mk(){
        group.clear && group.clear();
        if(params.pattern==='Particles'){
          const geo = new THREE.BufferGeometry();
          const positions = new Float32Array(params.count*3);
          const colors = new Float32Array(params.count*3);
          const a = new THREE.Color(params.colorA), b = new THREE.Color(params.colorB);
          for(let i=0;i<params.count;i++){const i3=i*3; positions[i3]= (Math.random()-0.5)*params.spread; positions[i3+1]=(Math.random()-0.5)*params.spread*0.6; positions[i3+2]=(Math.random()-0.5)*params.spread*0.2; const t=Math.random(); const c=a.clone().lerp(b,t); colors[i3]=c.r; colors[i3+1]=c.g; colors[i3+2]=c.b;}
          geo.setAttribute('position', new THREE.BufferAttribute(positions,3)); geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
          const mat = new THREE.PointsMaterial({size:params.size, vertexColors:true, transparent:true});
          const pts = new THREE.Points(geo, mat); pts.userData='p'; group.add(pts);
        }
        
        if(params.pattern==='Waves'){
          const width = Math.min(1400, params.spread*2); const height = Math.min(600, params.spread); const segX=200; const segY=40;
          const geo = new THREE.PlaneGeometry(width, height, segX, segY);
          const a = new THREE.Color(params.colorA), b = new THREE.Color(params.colorB);
          const pos = geo.attributes.position; const cols = new Float32Array(pos.count*3);
          for(let i=0;i<pos.count;i++){ const t=i/pos.count; const c=a.clone().lerp(b,t); cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b; }
          geo.setAttribute('color', new THREE.BufferAttribute(cols,3));
          const mat = new THREE.MeshBasicMaterial({vertexColors:true, side:THREE.DoubleSide});
          const mesh = new THREE.Mesh(geo, mat); mesh.rotation.x=-0.5; group.add(mesh);
        }
      }
      mk();
      const clock = new THREE.Clock();
      function animate(){ requestAnimationFrame(animate); const dt = clock.getDelta(); group.children.forEach(c=>{ if(c.type==='Points'){ c.rotation.y += 0.02*params.speed*dt; c.position.y = Math.sin(clock.getElapsedTime()*0.4*params.speed)*20;} if(c.type==='Mesh'){ const pos=c.geometry.attributes.position; for(let i=0;i<pos.count;i++){ const ix=i*3; pos.array[ix+2]=Math.sin((i + clock.getElapsedTime()*50*params.speed)*0.02)*12; } pos.needsUpdate=true; } }); renderer.render(scene,camera);} animate();
      window.addEventListener('resize', ()=>{ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
    })();
  </script>
</body>
</html>`;
  }

  init();

})();
