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
- `backgroundFragment` / `backgroundUniforms` build a ShaderMaterial on the backdrop plane
- `antialias: false`, half-resolution transmission pass, pixel ratio capped at 1.5

Rebuild after editing:

```
npm install
npm run build:vendor
```
