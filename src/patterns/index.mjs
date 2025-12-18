import * as particles from './particles.mjs';
import * as vortex from './vortex.mjs';
import * as flow from './flowfield.mjs';
import * as lissajous from './lissajous.mjs';
import * as fireflies from './fireflies.mjs';
import * as waves from './waves.mjs';
import * as distorting from './distortingPlane.mjs';
import * as terrain from './wireframeTerrain.mjs';
import * as raymarch from './raymarching.mjs';

export const patternFactories = {
  'Particles': particles.create,
  'Vortex': vortex.create,
  'Flow Field': flow.create,
  'Lissajous': lissajous.create,
  'Fireflies': fireflies.create,
  'Waves': waves.create,
  'Distorting Plane': distorting.create,
  'Wireframe Terrain': terrain.create,
  'Raymarching': raymarch.create
};
