import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { lights } from 'three/tsl';
import { createGlowMaterial } from '../js/vendor/glow-material.js';
import { createGlassMaterial } from '../js/vendor/glass-object.entry.js';

// TextureNode uses this browser type for an instanceof check in the GLSL path.
globalThis.ImageBitmap ??= class ImageBitmap {};

// Run Three's real shader generators without needing a GPU. This catches node
// API/type mistakes that an ordinary JavaScript bundler cannot detect. It does
// not replace visual verification on an actual GPU device.
function buildShader(material, forceWebGL) {
  const renderer = new THREE.WebGPURenderer({ canvas: { width:800, height:600, style:{} }, forceWebGL });
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.hasFeature = () => false;
  if (forceWebGL) renderer.backend.extensions = { has: () => false };
  const geometry = new THREE.PlaneGeometry();
  const builder = renderer.backend.createNodeBuilder(new THREE.Mesh(geometry, material), renderer);
  builder.camera = new THREE.PerspectiveCamera();
  builder.scene = new THREE.Scene();
  builder.lightsNode = lights([new THREE.DirectionalLight()]);
  builder.clippingContext = { globalClippingCount:0, localClippingEnabled:false, unionPlanes:[], intersectionPlanes:[] };
  builder.build();
  assert.ok(builder.vertexShader.length > 100);
  assert.match(builder.fragmentShader, forceWebGL ? /void main/ : /@fragment/);
  assert.doesNotMatch(builder.fragmentShader, /undefined|NaN/);
  geometry.dispose(); material.dispose();
  return builder.fragmentShader;
}

for (const forceWebGL of [false, true]) {
  test(`glow generates ${forceWebGL ? 'GLSL fallback' : 'WGSL WebGPU'} shaders`, () => {
    const glow = createGlowMaterial({
      u_resolution: [800, 600], u_time: 0, u_scale: 1,
      u_quad: [[100,100], [500,100], [500,500], [100,500]],
      u_center: [300,300], u_radius: 24, u_hue: 0.66, u_fill: 0.22,
    });
    glow.setUniform('u_quad', [120,100,520,100,520,500,120,500]);
    glow.setUniform('u_center', [320,300]);
    glow.setUniform('u_time', 1);
    const shader = buildShader(glow.material, forceWebGL);
    // Raw glow colours must reach the transmission buffer without sRGB decoding.
    assert.doesNotMatch(shader, /sRGBTransfer|acesFilmicToneMapping/);
  });

  test(`glass retains transmission and its own output conversion in ${forceWebGL ? 'GLSL' : 'WGSL'}`, () => {
    const glass = createGlassMaterial();
    glass.ior = 1.28;
    glass.thickness = 22.5;
    glass.roughness = 0.46;
    glass.attenuationColor.set('#1d2340');
    glass.attenuationDistance = 0.25;
    const shader = buildShader(glass, forceWebGL);
    assert.match(shader, /getVolumeTransmissionRay/);
    assert.match(shader, /volumeAttenuation/);
    assert.match(shader, /acesFilmicToneMapping/);
    assert.match(shader, /sRGBTransferOETF/);
  });
}
