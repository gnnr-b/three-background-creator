import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export function create({group, params}){
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
