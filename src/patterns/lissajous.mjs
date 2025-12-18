import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export function create({group, params}){
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(params.count * 3);
  const colors = new Float32Array(params.count * 3);
  const aArr = new Float32Array(params.count);
  const bArr = new Float32Array(params.count);
  const phase = new Float32Array(params.count);
  // ampX/ampY are scalars used as global amplitudes in the main update loop
  const ampX = Math.min(1200, params.spread * 1.2);
  const ampY = Math.min(800, params.spread * 0.8);
  const colorA = new THREE.Color(params.colorA);
  const colorB = new THREE.Color(params.colorB);
  for(let i=0;i<params.count;i++){
    const i3 = i*3;
    positions[i3+0] = (Math.random()-0.5) * params.spread;
    positions[i3+1] = (Math.random()-0.5) * params.spread * 0.6;
    positions[i3+2] = (Math.random()-0.5) * params.spread * 0.2;
    const t = i / Math.max(1, params.count - 1);
    const c = colorA.clone().lerp(colorB, t);
    colors[i3+0] = c.r; colors[i3+1] = c.g; colors[i3+2] = c.b;
    aArr[i] = 1 + Math.floor(Math.random()*6);
    bArr[i] = 1 + Math.floor(Math.random()*6);
    phase[i] = Math.random() * Math.PI * 2;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: params.size, vertexColors:true, depthWrite:false, transparent:true, opacity:0.95 }));
  points.userData.type = 'Lissajous';
  points.userData.a = aArr; points.userData.b = bArr; points.userData.phase = phase; points.userData.ampX = ampX; points.userData.ampY = ampY;
  group.add(points);
}
