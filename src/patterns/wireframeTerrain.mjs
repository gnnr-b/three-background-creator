import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export function create({group, params}){
  const segX = Math.max(8, Math.floor(params.terrainSegmentsX));
  const segY = Math.max(4, Math.floor(params.terrainSegmentsY));
  const width = Math.max(200, Math.min(2000, params.spread*2));
  const height = Math.max(100, Math.min(2000, params.spread));
  const geometry = new THREE.PlaneGeometry(width, height, segX, segY);
  const colorA = new THREE.Color(params.colorA);
  const colorB = new THREE.Color(params.colorB);

  const pos = geometry.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  for(let i=0;i<pos.count;i++){
    const t = i / Math.max(1, pos.count - 1);
    const c = colorA.clone().lerp(colorB, t);
    cols[i*3+0] = c.r; cols[i*3+1] = c.g; cols[i*3+2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors:true, wireframe:!!params.terrainWireframe, side:THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.userData.type = 'Wireframe Terrain';
  mesh.userData.basePos = geometry.attributes.position.array.slice();
  group.add(mesh);
}
