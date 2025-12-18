import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export function create({group, params}){
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
