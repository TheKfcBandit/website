# vendor

## glass-object

Canvas UI Glass Object, MIT + Commons Clause.

- upstream: https://canvasui.dev/docs/components/glass-object
- source: `curl -s https://canvasui.dev/r/glass-object-vanilla.json` → `files[0].content`

`glass-object.entry.js` is that source in JS, changed to:

- drop `OrbitControls`, `GLTFLoader`, `DRACOLoader` and the bitmap tracer — SVG only
- take sizes in CSS pixels (`fit.scale = 1 / pxPerUnit`) instead of `scale` in scene units
- fix the camera on +Z and derive `fov` from a fixed `focal`, so the projection matches
  `perspective(900px)`; `focus(x, y)` shears the frustum so the axis hits the card centre
- give each node `anchor > tilt > float > fit`, where the caller drives `tilt` and the
  upstream idle animation drives `float`; `nodeMatrix()` returns `tilt x float` so the
  overlay can be positioned without importing three
- `backgroundUniforms` feed the site's glow on the backdrop plane

V2 keeps that adapted Canvas UI geometry, materials, studio environment, and
motion, but uses Three.js `WebGPURenderer` instead of `WebGLRenderer`. The backdrop
in `glow-material.js` expresses the same glow in TSL, compiling to WGSL on WebGPU
and GLSL on the renderer's WebGL2 fallback. This is our renderer adaptation of
the existing Canvas UI fork, not an unmodified copy of Canvas UI's separate
`vgpu` WebGPU implementation. The renderer is initialized before use; loss or
failure returns to the interactive HTML card, and hidden tabs stop rendering.

No live-DOM capture is needed: HTML controls are projected over the actual
extruded mesh. Both layers use the same transform and camera perspective.

Upstream references:
- https://canvasui.dev/docs/rendering
- https://canvasui.dev/r/glass-object-vanilla-webgpu.json
- https://threejs.org/docs/pages/WebGPURenderer.html

Rebuild after editing:

```
npm ci
npm run build
```
