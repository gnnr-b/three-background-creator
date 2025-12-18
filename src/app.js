/* Three-Gen: interactive generative backgrounds using Three.js
   Simple editor with GUI controls and HTML export
*/
(function(){
  const container = document.getElementById('canvas-container');

  let scene, camera, renderer, clock, animId;
  let group;

  const params = {
    pattern: 'Particles',
    colorA: '#00aaff',
    colorB: '#ff44aa',
    count: 1200,
    size: 3,
    speed: 1.0,
    spread: 600,
    background: '#0b0b0b',
    motion: 'swirl', // 'swirl' | 'float' | 'burst'
    colorSpeed: 0.6,
    gradient: true,
    gradientAngle: 135
  };

  function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 5000);
    camera.position.z = 800;

    renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(new THREE.Color(params.background));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    clock = new THREE.Clock();
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
    if(p === 'Particles') createParticles();
    else if(p === 'Waves') createWaves();
    else createParticles();
  }

  function createParticles(){
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.count * 3);
    const colors = new Float32Array(params.count * 3);
    const baseColors = new Float32Array(params.count * 3);
    const colorA = new THREE.Color(params.colorA);
    const colorB = new THREE.Color(params.colorB);

    // per-particle motion data stored on the points object
    const velocities = new Float32Array(params.count * 3);
    const offsets = new Float32Array(params.count);

    for(let i=0;i<params.count;i++){
      const i3 = i*3;
      positions[i3+0] = (Math.random()-0.5) * params.spread;
      positions[i3+1] = (Math.random()-0.5) * params.spread * 0.6;
      positions[i3+2] = (Math.random()-0.5) * params.spread * 0.2;

      const t = Math.random();
      const c = colorA.clone().lerp(colorB, t);
      colors[i3+0] = c.r; colors[i3+1] = c.g; colors[i3+2] = c.b;
      baseColors[i3+0] = c.r; baseColors[i3+1] = c.g; baseColors[i3+2] = c.b;

      velocities[i3+0] = (Math.random()-0.5) * 6.0;
      velocities[i3+1] = (Math.random()-0.5) * 2.5;
      velocities[i3+2] = (Math.random()-0.5) * 1.0;
      offsets[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('baseColor', new THREE.BufferAttribute(baseColors, 3));

    const material = new THREE.PointsMaterial({ size: params.size, vertexColors: true, depthWrite:false, transparent:true, opacity:0.95 });
    const points = new THREE.Points(geometry, material);
    points.userData.type = 'Particles';
    points.userData.velocities = velocities;
    points.userData.offsets = offsets;
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
    // store base positions for richer displacement later
    mesh.userData.basePos = geometry.attributes.position.array.slice();
    group.add(mesh);
  }

  function updatePattern(delta){
    group.children.forEach(child => {
      if(child.userData.type === 'Particles'){
        // per-particle velocity + global motion modes
        const geo = child.geometry;
        const pos = geo.attributes.position;
        const base = geo.attributes.baseColor;
        const cols = geo.attributes.color;
        const vels = child.userData.velocities;
        const offs = child.userData.offsets;
        const time = clock.getElapsedTime();
        for(let i=0;i<pos.count;i++){
          const i3 = i*3;
          // apply motion modes
          if(params.motion === 'swirl'){
            const angle = (time * 0.2 + offs[i]) * (0.5 + (vels[i3]*0.01));
            pos.array[i3+0] += Math.cos(angle) * 0.6 * params.speed * delta;
            pos.array[i3+1] += Math.sin(angle) * 0.35 * params.speed * delta;
          } else if(params.motion === 'float'){
            pos.array[i3+0] += Math.sin(time*0.5 + offs[i]) * 0.2 * params.speed * delta;
            pos.array[i3+1] += Math.cos(time*0.4 + offs[i]) * 0.15 * params.speed * delta;
          } else if(params.motion === 'burst'){
            pos.array[i3+0] += vels[i3+0] * 0.02 * params.speed * delta;
            pos.array[i3+1] += vels[i3+1] * 0.02 * params.speed * delta;
            pos.array[i3+2] += vels[i3+2] * 0.01 * params.speed * delta;
          }

          // slow return to center for stability
          pos.array[i3+0] *= 0.9999;
          pos.array[i3+1] *= 0.9999;

          // color cycling using baseColor + small H offset
          const baseR = base.array[i3+0], baseG = base.array[i3+1], baseB = base.array[i3+2];
          const c = new THREE.Color(baseR, baseG, baseB);
          c.offsetHSL(Math.sin(time * params.colorSpeed + offs[i]) * 0.08, 0, 0);
          cols.array[i3+0] = c.r; cols.array[i3+1] = c.g; cols.array[i3+2] = c.b;
        }
        pos.needsUpdate = true; if(geo.attributes.color) geo.attributes.color.needsUpdate = true;
        child.rotation.y += 0.01 * params.speed * delta;
        child.position.y = Math.sin(time * 0.4 * params.speed) * 20;
      }
      if(child.userData.type === 'Rings'){
        // rotate rings and slowly expand/contract
        const geo = child.geometry;
        const pos = geo.attributes.position;
        const speeds = child.userData.speeds;
        const time = clock.getElapsedTime();
        for(let i=0;i<pos.count;i++){
          const i3 = i*3;
          const s = speeds[i];
          const ang = Math.atan2(pos.array[i3+1], pos.array[i3+0]) + 0.001 * s * params.speed;
          const r = Math.hypot(pos.array[i3+0], pos.array[i3+1]);
          const nr = r + Math.sin(time*0.3*s)*0.4;
          pos.array[i3+0] = Math.cos(ang) * nr;
          pos.array[i3+1] = Math.sin(ang) * nr * 0.6;
        }
        pos.needsUpdate = true;
        child.rotation.z += 0.002 * params.speed * delta;
      }
      if(child.userData.type === 'Waves'){
        const geo = child.geometry;
        const pos = geo.attributes.position;
        const basePos = child.userData.basePos;
        const time = clock.getElapsedTime();
        for(let i=0;i<pos.count;i++){
          const ix = i*3;
          // use base position and add layered sine waves for richer motion
          const bx = basePos[ix+0], by = basePos[ix+1];
          pos.array[ix+2] = Math.sin((bx + time*40) * 0.008) * 18 + Math.cos((i + time*30) * 0.02) * 6;
        }
        pos.needsUpdate = true;
      }
    });

    // animated gradient background
    if(params.gradient) updateBackgroundGradient();
  }

  function updateBackgroundGradient(){
    const t = clock.getElapsedTime();
    const angle = (params.gradientAngle + Math.sin(t*0.05)*8).toFixed(2);
    container.style.background = `linear-gradient(${angle}deg, ${params.colorA}, ${params.colorB})`;
  }

  function animate(){
    animId = requestAnimationFrame(animate);
    const delta = clock.getDelta();
    updatePattern(delta);
    renderer.render(scene, camera);
  }

  function setupGUI(){
    const gui = new dat.GUI({ autoPlace:false, width:300 });
    document.getElementById('controls').innerHTML = '';
    document.getElementById('controls').appendChild(gui.domElement);

    gui.add(params, 'pattern', ['Particles','Waves']).onChange(()=>{ buildPattern(); });
    gui.addColor(params, 'colorA').onChange(()=> rebuildColors());
    gui.addColor(params, 'colorB').onChange(()=> rebuildColors());
    gui.add(params, 'motion', ['swirl','float','burst']).name('Motion');
    gui.add(params, 'colorSpeed', 0.0, 3.0, 0.01).name('Color Speed');
    gui.add(params, 'count', 100, 4000, 1).onChange(()=> buildPattern());
    gui.add(params, 'size', 0.5, 20, 0.1).onChange(()=> { rebuildSizes(); });
    gui.add(params, 'speed', 0.1, 3, 0.05);
    gui.add(params, 'spread', 100, 2000, 1).onChange(()=> buildPattern());
    gui.addColor(params, 'background').onChange(v => { renderer.setClearColor(new THREE.Color(v)); });
    gui.add(params, 'gradient').name('Gradient BG').onChange(v => { if(!v) container.style.background = params.background; else updateBackgroundGradient(); });
    gui.add(params, 'gradientAngle', 0, 360, 1).name('Gradient Angle').onChange(()=> updateBackgroundGradient());

    // Hook up download button
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

  function rebuildColors(){
    group.children.forEach(child => {
      if(child.geometry && child.geometry.attributes.color){
        const attr = child.geometry.attributes.color;
        const a = new THREE.Color(params.colorA), b = new THREE.Color(params.colorB);
        for(let i=0;i<attr.count;i++){
          const t = i/attr.count;
          const c = a.clone().lerp(b,t);
          attr.array[i*3+0] = c.r; attr.array[i*3+1] = c.g; attr.array[i*3+2] = c.b;
        }
        attr.needsUpdate = true;
      }
      if(child.material && child.material.color){
        child.material.color = new THREE.Color(params.colorA);
      }
    });
  }

  function rebuildSizes(){
    group.children.forEach(child => {
      if(child.material && child.material.size !== undefined) child.material.size = params.size;
    });
  }

  function generateStandaloneHTML(){
    const exportParams = JSON.parse(JSON.stringify(params));
    // Minimal HTML that loads three and recreates an animated canvas using exportParams
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
          for(let i=0;i<params.count;i++){
            const i3=i*3; positions[i3]= (Math.random()-0.5)*params.spread; positions[i3+1]=(Math.random()-0.5)*params.spread*0.6; positions[i3+2]=(Math.random()-0.5)*params.spread*0.2;
            const t=Math.random(); const c=a.clone().lerp(b,t);
            colors[i3]=c.r; colors[i3+1]=c.g; colors[i3+2]=c.b;
          }
          geo.setAttribute('position', new THREE.BufferAttribute(positions,3));
          geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
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

  // start app
  init();

})();
