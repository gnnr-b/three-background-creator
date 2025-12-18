import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export function create({group, params}){
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(params.count * 3);
  const colors = new Float32Array(params.count * 3);
  const baseColors = new Float32Array(params.count * 3);
  const cx = new Float32Array(params.count);
  const cy = new Float32Array(params.count);
  const radius = new Float32Array(params.count);
  const angle = new Float32Array(params.count);
  const angVel = new Float32Array(params.count);
  const spiral = new Float32Array(params.count);
  const colorA = new THREE.Color(params.colorA);
  const colorB = new THREE.Color(params.colorB);

  // frustum at z=0 approximate — use spread and some defaults
  const frustumWidth = Math.max(800, params.spread);
  const frustumHeight = Math.max(400, params.spread * 0.6);

  // generate a few swirl centers
  const centers = [];
  for(let i=0;i<params.centers;i++) centers.push({ x:(Math.random()-0.5)*frustumWidth*0.8, y:(Math.random()-0.5)*frustumHeight*0.8 });

  for(let i=0;i<params.count;i++){
    const i3 = i*3;
    const x = (Math.random()-0.5) * frustumWidth;
    const y = (Math.random()-0.5) * frustumHeight;
    positions[i3+0] = x; positions[i3+1] = y; positions[i3+2] = (Math.random()-0.5) * 200;

    const t = Math.random();
    const col = colorA.clone().lerp(colorB, t);
    colors[i3+0] = col.r; colors[i3+1] = col.g; colors[i3+2] = col.b;
    baseColors[i3+0] = col.r; baseColors[i3+1] = col.g; baseColors[i3+2] = col.b;

    const ci = Math.floor(Math.random()*centers.length);
    cx[i] = centers[ci].x + (Math.random()-0.5) * frustumWidth * 0.06;
    cy[i] = centers[ci].y + (Math.random()-0.5) * frustumHeight * 0.06;
    const r0 = Math.hypot(x - cx[i], y - cy[i]);
    radius[i] = Math.max(10, r0 * (0.4 + Math.random()*1.6));
    angle[i] = Math.atan2(y - cy[i], x - cx[i]);
    angVel[i] = (0.3 + Math.random()*1.2) * (Math.random()<0.5? -1: 1);
    spiral[i] = (Math.random()-0.5) * 0.6;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('baseColor', new THREE.BufferAttribute(baseColors, 3));

  const mat = new THREE.PointsMaterial({ size: params.size, vertexColors:true, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthTest:false });
  const pts = new THREE.Points(geometry, mat);
  pts.userData.type = 'Vortex';
  pts.userData.cx = cx; pts.userData.cy = cy; pts.userData.radius = radius; pts.userData.angle = angle; pts.userData.angVel = angVel; pts.userData.spiral = spiral;
  group.add(pts);
}
