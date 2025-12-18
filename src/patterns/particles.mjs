import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export function create({group, params, camera}){
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
