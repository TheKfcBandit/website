import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { createGlowMaterial } from '../js/vendor/glow-material.js';

// Run Three's real shader generators without needing a GPU. This catches node
// API/type mistakes that an ordinary JavaScript bundler cannot detect. It does
// not replace visual verification on an actual GPU device.
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
    const renderer = new THREE.WebGPURenderer({ canvas: { width:800, height:600, style:{} }, forceWebGL });
    if (forceWebGL) renderer.backend.extensions = { has: () => false };
    const geometry = new THREE.PlaneGeometry();
    const builder = renderer.backend.createNodeBuilder(new THREE.Mesh(geometry, glow.material), renderer);
    builder.camera = new THREE.PerspectiveCamera();
    builder.scene = new THREE.Scene();
    builder.clippingContext = { globalClippingCount:0, localClippingEnabled:false, unionPlanes:[], intersectionPlanes:[] };
    builder.build();
    assert.ok(builder.vertexShader.length > 100);
    assert.ok(builder.fragmentShader.length > 100);
    assert.match(builder.fragmentShader, forceWebGL ? /void main/ : /@fragment/);
    assert.doesNotMatch(builder.fragmentShader, /undefined|NaN/);
    geometry.dispose(); glow.material.dispose();
  });
}
