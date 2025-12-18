import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.18/dist/lil-gui.esm.min.js';
import * as patternModules from './patterns/index.mjs';

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
    ,
    // waves controls
    waveSpeed: 1.0,
    waveHeight: 18.0
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

  // Three.js computing a bounding sphere with NaN values (which throws runtime errors).
  function validateGeometry(geometry, patternName){
    if(!geometry || !geometry.attributes) return true;
    const pos = geometry.attributes.position;
    if(!pos || !pos.array) return true;
    const arr = pos.array;
    for(let i=0;i<arr.length;i++){
      const v = arr[i];
      if(!isFinite(v)){
        console.error(`Geometry validation failed for pattern \"${patternName}\": position[${i}] =`, v);
        return false;
      }
    }
    return true;
  }

  // Attempt to sanitize a geometry's position attribute by replacing non-finite
  // values with a sensible fallback. If `basePos` is available we use that,
  // otherwise we set the component to 0. Returns number of fixes applied.
  function sanitizeGeometry(geometry, patternName, child){
    if(!geometry || !geometry.attributes) return 0;
    const pos = geometry.attributes.position;
    if(!pos || !pos.array) return 0;
    const arr = pos.array;
    const baseAttr = geometry.attributes.basePos || (child && child.userData && child.userData.basePos ? { array: child.userData.basePos } : null);
    let fixes = 0;
    for(let i=0;i<arr.length;i++){
      const v = arr[i];
      if(!isFinite(v)){
        fixes++;
        const fallback = baseAttr && baseAttr.array && baseAttr.array[i] !== undefined ? baseAttr.array[i] : 0.0;
        arr[i] = Number.isFinite(fallback) ? fallback : 0.0;
      }
    }
    if(fixes > 0){
      console.warn(`sanitizeGeometry: repaired ${fixes} invalid position components for pattern "${patternName}"`);
      try{ pos.needsUpdate = true; }catch(e){}
    }
    return fixes;
  }
  // and `buildPattern()` prefers the modular `patternModules.patternFactories`.
  const patternFactories = {};

  function buildPattern(){
    clearGroup();
    const p = params.pattern;
    // If modular pattern factories are available, prefer them (they receive runtime context).
    try{
      if(patternModules && patternModules.patternFactories && patternModules.patternFactories[p]){
        const beforeLen = group.children.length;
        patternModules.patternFactories[p]({ group, params, camera, container, THREE });
        // validate any newly-added children for NaN in their position arrays
        let afterLen = group.children.length;
        for(let ci = beforeLen; ci < afterLen; ci++){
          const child = group.children[ci];
          if(child && child.geometry){
            if(!validateGeometry(child.geometry, p)){
              console.error('Removed child with invalid geometry for pattern', p, 'childIndex', ci);
              try{ if(child.geometry) child.geometry.dispose(); }catch(e){}
              try{ if(child.material) child.material.dispose(); }catch(e){}
              group.remove(child);
              // adjust indices because we removed the child
              ci--; afterLen--;
            }
          }
        }
        return;
      }
    }catch(e){ /* ignore and fallback to inline factories */ }

    // if there's an inline factory (legacy), call it; otherwise modules should have handled creation
    if(patternFactories[p]){
      try{ patternFactories[p](); }catch(e){ console.warn('pattern factory failed', e); }
    }
  }
  
  // Inline factories removed — pattern modules supply implementations now.

  function updatePattern(delta){
    const time = clock.getElapsedTime();
    // small global swirl amount used by some particle patterns
    const globalSwirl = Math.sin(time * 0.08) * params.swirlIntensity;
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
          pos.needsUpdate = true;
          if(!validateGeometry(geo, type)){
            const fixes = sanitizeGeometry(geo, type, child);
            if(fixes === 0){ 
              console.error('Wireframe Terrain geometry invalid and not repairable; removing child.'); 
              try{ if(child.geometry) child.geometry.dispose(); }catch(e){} 
              try{ if(child.material) child.material.dispose(); }catch(e){} 
              group.remove(child); 
            }
          }
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
          // use params.waveSpeed and params.waveHeight for dynamic control
          const t = time * params.waveSpeed;
          const primary = Math.sin((bx + t * 40.0) * 0.008) * params.waveHeight;
          const secondary = Math.cos((i + t * 30.0) * 0.02) * (params.waveHeight * 0.33);
          pos.array[ix+2] = primary + secondary;
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
        // gradient-noise plane was deleted earlier; keep raymarch uniforms here
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
    controllers.colorSpeed = gui.add(params, 'colorSpeed', 0.0, 3.0, 0.01).name('Color Speed');
    controllers.centers = gui.add(params, 'centers', 1, 8, 1).name('Swirl Centers').onChange(()=> buildPattern());
    controllers.circularSpeed = gui.add(params, 'circularSpeed', 0.0, 4.0, 0.01).name('Circular Speed');
    controllers.swirlIntensity = gui.add(params, 'swirlIntensity', 0.0, 3.0, 0.01).name('Swirl Intensity');
    controllers.radialWobble = gui.add(params, 'radialWobble', 0.0, 2.0, 0.01).name('Radial Wobble');
    controllers.count = gui.add(params, 'count', 100, 4000, 1).onChange(()=> buildPattern());
    controllers.size = gui.add(params, 'size', 0.5, 20, 0.1).onChange(()=> { rebuildSizes(); });
    controllers.speed = gui.add(params, 'speed', 0.1, 3, 0.05);
    controllers.waveSpeed = gui.add(params, 'waveSpeed', 0.0, 6.0, 0.01).name('Wave Speed');
    controllers.waveHeight = gui.add(params, 'waveHeight', 0.0, 600.0, 0.5).name('Wave Height');
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

    // Layered Parallax controls removed earlier

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
      const optional = ['centers','circularSpeed','swirlIntensity','radialWobble','count','size','speed','spread','waveSpeed','waveHeight','terrainSegmentsX','terrainSegmentsY','terrainScale','terrainHeight','terrainSpeed','terrainWireframe','raymarchSteps','raymarchMaxDistance','raymarchEpsilon','raymarchLightX','raymarchLightY','raymarchLightZ','raySphereModAmp','raySphereModFreq','rayNoiseScale','rayNoiseSpeed','rayNoiseIntensity'];
      optional.forEach(k => { if(c[k] && c[k].hide) c[k].hide(); });

      // show common controls
      if(c.colorA && c.colorA.show) c.colorA.show();
      if(c.colorB && c.colorB.show) c.colorB.show();
      if(c.gradient && c.gradient.show) c.gradient.show();
      if(c.gradientAngle && c.gradientAngle.show) c.gradientAngle.show();

      // Particle-like patterns
      if(['Vortex','Flow Field','Lissajous','Fireflies'].includes(p)){
        ['centers','circularSpeed','swirlIntensity','radialWobble','count','size','speed','spread','colorSpeed'].forEach(k=>{ if(c[k] && c[k].show) c[k].show(); });
      }

      // Waves / Distorting Plane
      if(p === 'Waves'){
        if(c.size && c.size.show) c.size.show();
        if(c.waveSpeed && c.waveSpeed.show) c.waveSpeed.show();
        if(c.waveHeight && c.waveHeight.show) c.waveHeight.show();
      }
      if(p === 'Distorting Plane'){
        if(c.size && c.size.show) c.size.show();
      }

      // Wireframe Terrain
      if(p === 'Wireframe Terrain'){
        ['terrainSegmentsX','terrainSegmentsY','terrainScale','terrainHeight','terrainSpeed','terrainWireframe'].forEach(k=>{ if(c[k] && c[k].show) c[k].show(); });
      }

      // Layered Parallax removed (cleaned up)

      // Raymarching
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
