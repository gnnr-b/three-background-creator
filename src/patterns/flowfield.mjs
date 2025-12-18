import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export function create({group, params}){
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(params.count * 3);
  const colors = new Float32Array(params.count * 3);
  const seeds = new Float32Array(params.count);
  const colorA = new THREE.Color(params.colorA);
  const colorB = new THREE.Color(params.colorB);
  for(let i=0;i<params.count;i++){
    const i3 = i*3;
    positions[i3+0] = (Math.random()-0.5) * params.spread;
    positions[i3+1] = (Math.random()-0.5) * params.spread * 0.6;
    positions[i3+2] = (Math.random()-0.5) * params.spread * 0.2;
    const t = Math.random();
    const c = colorA.clone().lerp(colorB, t);
    colors[i3+0] = c.r; colors[i3+1] = c.g; colors[i3+2] = c.b;
    seeds[i] = Math.random() * Math.PI * 2;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ size: params.size, vertexColors:true, depthWrite:false, transparent:true, opacity:0.95 }));
  points.userData.type = 'Flow Field';
  points.userData.seeds = seeds;
  group.add(points);
}
