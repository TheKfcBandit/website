import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

const BACKDROP_DISTANCE = 30;

const DEFAULTS = {
  backgroundFragment: "",
  backgroundUniforms: null,
  antialias: true,
  pixelRatio: 2,
  transmissionScale: 0.5,
  ior: 1.75,
  thickness: 4,
  roughness: 0.25,
  dispersion: 1.5,
  clearcoat: 0.5,
  tint: "",
  tintDensity: 2,
  depth: 0.1,
  bevel: 1,
  highlight: "#066aff",
  environmentIntensity: 1,
  background: "",
  focal: 900,
  cameraDistance: 4,
  floatIntensity: 1,
  rotationIntensity: 1,
  floatSpeed: 2,
  onFrame: null,
  onLoad: null,
  onError: null,
};

const ROOM_BLOCKS = [
  { position: [-10.906, -1, 1.846], rotation: [0, -0.195, 0], scale: [2.328, 7.905, 4.651] },
  { position: [-5.607, -0.754, -0.758], rotation: [0, 0.994, 0], scale: [1.97, 1.534, 3.955] },
  { position: [6.167, -0.16, 7.803], rotation: [0, 0.561, 0], scale: [3.927, 6.285, 3.687] },
  { position: [-2.017, 0.018, 6.124], rotation: [0, 0.333, 0], scale: [2.002, 4.566, 2.064] },
  { position: [2.291, -0.756, -2.621], rotation: [0, -0.286, 0], scale: [1.546, 1.552, 1.496] },
  { position: [-2.193, -0.369, -5.547], rotation: [0, 0.516, 0], scale: [3.875, 3.487, 2.986] },
];

const ROOM_FORMERS = [
  { kind: "ring", intensity: 15, position: [2, 3, -2], scale: [10, 10, 10], lookAtCenter: true },
  { kind: "box", intensity: 80, position: [-14, 10, 8], scale: [0.1, 2.5, 2.5] },
  { kind: "box", intensity: 80, position: [-14, 14, -4], scale: [0.1, 2.5, 2.5], withLight: true },
  { kind: "box", intensity: 23, position: [14, 12, 0], scale: [0.1, 5, 5], withLight: true },
  { kind: "box", intensity: 16, position: [0, 9, 14], scale: [5, 5, 0.1], withLight: true },
  { kind: "box", intensity: 80, position: [7, 8, -14], scale: [2.5, 2.5, 0.1], withLight: true },
  { kind: "box", intensity: 80, position: [-7, 16, -14], scale: [2.5, 2.5, 0.1], withLight: true },
  { kind: "box", intensity: 1, position: [0, 20, 0], scale: [0.1, 0.1, 0.1], withLight: true },
  { kind: "box", intensity: 20, position: [0, 15, 0], scale: [10, 1, 10], withLight: true },
];

function flattenCapNormals(geometry) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  for (const group of geometry.groups) {
    if (group.materialIndex !== 0) continue;
    for (let i = group.start; i < group.start + group.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      cb.subVectors(c, b);
      ab.subVectors(a, b);
      cb.cross(ab).normalize();
      for (let j = 0; j < 3; j++) normal.setXYZ(i + j, cb.x, cb.y, cb.z);
    }
  }
  normal.needsUpdate = true;
}

function disposeObject(root, keep) {
  root.traverse(node => {
    if (node.geometry) node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material || material === keep) continue;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

function roundLoopCorners(points, radius) {
  const n = points.length;
  if (n < 3) return points;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const inDir = curr.clone().sub(prev);
    const outDir = next.clone().sub(curr);
    const lenIn = inDir.length();
    const lenOut = outDir.length();
    if (lenIn < 1e-9 || lenOut < 1e-9) continue;
    inDir.divideScalar(lenIn);
    outDir.divideScalar(lenOut);
    const angle = Math.acos(Math.min(Math.max(inDir.dot(outDir), -1), 1));
    if (angle < 0.1) {
      out.push(curr.clone());
      continue;
    }
    const trim = Math.min(radius, lenIn * 0.5, lenOut * 0.5);
    const p0 = curr.clone().addScaledVector(inDir, -trim);
    const p1 = curr.clone().addScaledVector(outDir, trim);
    const steps = Math.max(2, Math.ceil(angle / 0.3));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      out.push(new THREE.Vector2(a * p0.x + b * curr.x + c * p1.x, a * p0.y + b * curr.y + c * p1.y));
    }
  }
  return out.length >= 3 ? out : points;
}

function dedupeClosingPoint(points) {
  if (points.length > 1 && points[0].distanceToSquared(points[points.length - 1]) < 1e-12) {
    return points.slice(0, -1);
  }
  return points;
}

function roundShapeCorners(shapes, radius) {
  if (radius < 1e-6) return shapes;
  return shapes.map(shape => {
    const extracted = shape.extractPoints(24);
    const rounded = new THREE.Shape(roundLoopCorners(dedupeClosingPoint(extracted.shape), radius));
    for (const hole of extracted.holes) {
      rounded.holes.push(new THREE.Path(roundLoopCorners(dedupeClosingPoint(hole), radius)));
    }
    return rounded;
  });
}

function shapesFromSvg(text) {
  const parsed = new SVGLoader().parse(text);
  const shapes = [];
  for (const path of parsed.paths) {
    if (path.userData?.style?.fill === "none") continue;
    shapes.push(...SVGLoader.createShapes(path));
  }
  if (shapes.length === 0) {
    for (const path of parsed.paths) shapes.push(...SVGLoader.createShapes(path));
  }
  if (shapes.length === 0) throw new Error("No fillable shapes in the SVG");
  return shapes;
}

export function createGlassScene(elements, options = {}) {
  const { canvas } = elements;
  const config = { ...DEFAULTS, ...options };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: config.antialias, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.transmissionResolutionScale = config.transmissionScale;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 0, config.cameraDistance);
  scene.add(camera);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const backgroundColor = new THREE.Color();
  const nodes = new Map();
  const scratch = new THREE.Matrix4();

  let roomScene = null;
  let ringMaterial = null;
  let envTarget = null;
  let envDirty = true;
  let pxPerUnit = config.focal / config.cameraDistance;
  let principalX = 0;
  let principalY = 0;
  let disposed = false;
  let inView = true;
  let loopRunning = false;
  let lastTime = 0;
  let elapsed = Math.random() * 100;
  let clock = 0;

  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = motionQuery.matches;
  const onMotionChange = () => {
    reducedMotion = motionQuery.matches;
    if (reducedMotion) {
      for (const node of nodes.values()) {
        node.float.rotation.set(0, 0, 0);
        node.float.position.set(0, 0, 0);
      }
    }
  };
  motionQuery.addEventListener("change", onMotionChange);

  const backdropUniforms = {};
  for (const [name, value] of Object.entries(config.backgroundUniforms ?? {})) {
    if (typeof value === "number") backdropUniforms[name] = { value };
    else if (Array.isArray(value[0])) backdropUniforms[name] = { value: value.map(v => new THREE.Vector2(v[0], v[1])) };
    else if (value.length === 2) backdropUniforms[name] = { value: new THREE.Vector2(...value) };
    else backdropUniforms[name] = { value: new THREE.Vector3(...value) };
  }

  const backdropMaterial = config.backgroundFragment
    ? new THREE.ShaderMaterial({
        uniforms: backdropUniforms,
        vertexShader: "varying vec2 vUv;\nvoid main() {\n  vUv = uv;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}",
        fragmentShader: `varying vec2 vUv;\n${config.backgroundFragment}\nvoid main() {\n  gl_FragColor = vec4(glowAt(vec2(vUv.x, 1.0 - vUv.y) * u_resolution), 1.0);\n}`,
        toneMapped: false,
      })
    : new THREE.MeshBasicMaterial({ toneMapped: false });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backdropMaterial);
  backdrop.renderOrder = -1;
  backdrop.visible = !!config.backgroundFragment;
  camera.add(backdrop);

  function setBackgroundUniform(name, value) {
    const uniform = backdropUniforms[name];
    if (!uniform) return;
    const held = uniform.value;
    if (Array.isArray(held)) {
      for (let i = 0; i < held.length; i++) held[i].set(value[i * 2], value[i * 2 + 1]);
    } else if (held?.isVector2) {
      held.set(value[0], value[1]);
    } else if (held?.isVector3) {
      held.set(value[0], value[1], value[2]);
    } else {
      uniform.value = value;
    }
  }

  function layoutBackdrop() {
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    const unit = BACKDROP_DISTANCE / config.focal;
    backdrop.scale.set(width * unit, height * unit, 1);
    backdrop.position.set(-principalX * unit, principalY * unit, -BACKDROP_DISTANCE);
  }

  function applyProjection() {
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    camera.aspect = width / height;
    camera.fov = 2 * Math.atan(height / (2 * config.focal)) * (180 / Math.PI);
    camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[8] = (-2 * principalX) / width;
    camera.projectionMatrix.elements[9] = (2 * principalY) / height;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    layoutBackdrop();
  }

  function buildRoom() {
    roomScene = new THREE.Scene();
    const room = new THREE.Group();
    room.position.set(0, -0.5, 0);
    roomScene.add(room);

    for (const [x, z] of [[-15, 15], [15, 15], [15, -15], [-15, -15]]) {
      const spot = new THREE.SpotLight(0xffffff, 2, 0, 0.2, 1, 0);
      spot.position.set(x, 20, z);
      room.add(spot, spot.target);
    }
    const center = new THREE.PointLight(0xffffff, 100, 28, 2);
    center.position.set(0.5, 14, 0.5);
    room.add(center);

    const box = new THREE.BoxGeometry();
    const shell = new THREE.Mesh(box, new THREE.MeshStandardMaterial({ color: "gray", side: THREE.BackSide }));
    shell.position.set(0, 13.2, 0);
    shell.scale.set(31.5, 28.5, 31.5);
    room.add(shell);

    const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (const def of ROOM_BLOCKS) {
      const mesh = new THREE.Mesh(box, white);
      mesh.position.set(...def.position);
      mesh.rotation.set(...def.rotation);
      mesh.scale.set(...def.scale);
      room.add(mesh);
    }

    const plane = new THREE.PlaneGeometry();
    const ring = new THREE.RingGeometry(0.45, 0.5, 48);
    for (const def of ROOM_FORMERS) {
      const material = new THREE.MeshBasicMaterial();
      material.color.setScalar(def.intensity);
      const mesh = new THREE.Mesh(def.kind === "ring" ? ring : plane, material);
      mesh.position.set(...def.position);
      mesh.scale.set(...def.scale);
      if (def.kind === "ring") {
        ringMaterial = material;
        material.side = THREE.DoubleSide;
      }
      if (def.lookAtCenter || def.withLight) mesh.lookAt(0, 0, 0);
      room.add(mesh);
    }
  }

  function refreshEnvironment() {
    if (!roomScene) buildRoom();
    if (ringMaterial) ringMaterial.color.set(config.highlight).multiplyScalar(15);
    envTarget?.dispose();
    envTarget = pmrem.fromScene(roomScene, 0.6, 0.1, 1000);
    scene.environment = envTarget.texture;
  }

  function applyMaterial(node) {
    const material = node.material;
    const spec = node.spec;
    material.ior = Math.min(Math.max(spec.ior ?? config.ior, 1), 2.333);
    material.roughness = Math.min(Math.max(spec.roughness ?? config.roughness, 0), 1);
    material.dispersion = Math.max(spec.dispersion ?? config.dispersion, 0);
    material.clearcoat = Math.min(Math.max(spec.clearcoat ?? config.clearcoat, 0), 1);
    material.thickness = Math.max(spec.thickness ?? config.thickness, 0) * pxPerUnit;
    const tint = spec.tint ?? config.tint;
    if (tint) {
      material.attenuationColor.set(tint);
      material.attenuationDistance = 1.5 / Math.max(spec.tintDensity ?? config.tintDensity, 0.01);
    } else {
      material.attenuationColor.set(0xffffff);
      material.attenuationDistance = Infinity;
    }
  }

  function applyFit(node) {
    node.fit.scale.setScalar(1 / pxPerUnit);
    const [x = 0, y = 0] = node.spec.offset ?? [];
    node.anchor.position.set(x / pxPerUnit, -y / pxPerUnit, (node.spec.z ?? 0) / pxPerUnit);
  }

  function buildModel(node) {
    if (!node.shapes) return;
    const spec = node.spec;
    const depth = Math.min(Math.max(spec.depth ?? config.depth, 0.02), 1);
    const bevel = Math.min(Math.max(spec.bevel ?? config.bevel, 0), 1);
    if (node.model && depth === node.builtDepth && bevel === node.builtBevel) return;
    node.builtDepth = depth;
    node.builtBevel = bevel;

    const box = new THREE.Box2();
    for (const shape of node.shapes) {
      for (const point of shape.getPoints(4)) box.expandByPoint(point);
    }
    const size2d = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, 1e-4);
    const depthUnits = depth * size2d;
    const bevelAmount = bevel * depthUnits * 0.5;

    const shapes = roundShapeCorners(node.shapes, bevelAmount * 1.25);
    let geometry = new THREE.ExtrudeGeometry(shapes, {
      depth: Math.max(depthUnits - bevelAmount * 2, depthUnits * 0.1),
      bevelEnabled: bevelAmount > 1e-4,
      bevelThickness: bevelAmount,
      bevelSize: bevelAmount * 0.9,
      bevelOffset: 0,
      bevelSegments: 12,
      curveSegments: 24,
    });
    geometry = toCreasedNormals(geometry, Math.PI / 7);
    flattenCapNormals(geometry);
    geometry.rotateX(Math.PI);

    if (node.model) {
      node.fit.remove(node.model);
      disposeObject(node.model, node.material);
    }
    node.model = new THREE.Mesh(geometry, node.material);
    const bounds = new THREE.Box3().setFromObject(node.model);
    node.model.position.sub(bounds.getCenter(new THREE.Vector3()));
    node.fit.add(node.model);
  }

  async function loadNode(node) {
    const src = node.spec.src;
    if (!src || src === node.src) return;
    node.src = src;
    const token = ++node.token;
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const shapes = shapesFromSvg(await response.text());
      if (disposed || token !== node.token) return;
      node.shapes = shapes;
      node.builtDepth = -1;
      node.builtBevel = -1;
      buildModel(node);
      applyFit(node);
      config.onLoad?.(node.id);
    } catch (error) {
      if (disposed || token !== node.token) return;
      config.onError?.(error);
    }
  }

  function add(id, spec) {
    const anchor = new THREE.Group();
    const tilt = new THREE.Group();
    const float = new THREE.Group();
    const fit = new THREE.Group();
    anchor.add(tilt);
    tilt.add(float);
    float.add(fit);
    scene.add(anchor);
    const node = {
      id, anchor, tilt, float, fit, spec,
      material: new THREE.MeshPhysicalMaterial({
        color: 0xffffff, metalness: 0, transmission: 1, clearcoatRoughness: 0.06, specularIntensity: 1,
      }),
      model: null, shapes: null, src: null, token: 0, builtDepth: -1, builtBevel: -1,
    };
    nodes.set(id, node);
    applyMaterial(node);
    applyFit(node);
    loadNode(node);
    return node;
  }

  function update(id, spec) {
    const node = nodes.get(id);
    if (!node) return;
    Object.assign(node.spec, spec);
    applyMaterial(node);
    applyFit(node);
    if (node.shapes) {
      buildModel(node);
      applyFit(node);
    }
    loadNode(node);
  }

  function applyOptions() {
    if (config.background) {
      backgroundColor.set(config.background);
      scene.background = backgroundColor;
      renderer.setClearColor(backgroundColor, 1);
    } else {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
    }
    scene.environmentIntensity = config.environmentIntensity;
    for (const node of nodes.values()) applyMaterial(node);
  }

  function resize() {
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, config.pixelRatio));
    renderer.setSize(width, height, false);
    setBackgroundUniform("u_resolution", [width, height]);
    applyProjection();
    pxPerUnit = config.focal / config.cameraDistance;
    for (const node of nodes.values()) {
      applyFit(node);
      applyMaterial(node);
    }
  }

  function tick(time) {
    if (!inView) {
      lastTime = 0;
      stopLoop();
      return;
    }
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.1) : 0;
    lastTime = time;
    clock += delta;
    setBackgroundUniform("u_time", clock);

    if (!reducedMotion) {
      elapsed += delta * config.floatSpeed;
      for (const node of nodes.values()) {
        node.float.rotation.x = (Math.cos(elapsed / 4) / 8) * config.rotationIntensity;
        node.float.rotation.y = (Math.sin(elapsed / 4) / 8) * config.rotationIntensity;
        node.float.rotation.z = (Math.sin(elapsed / 4) / 20) * config.rotationIntensity;
        node.float.position.y = (Math.sin(elapsed / 1.5) / 10) * config.floatIntensity;
      }
    }

    if (envDirty) {
      envDirty = false;
      refreshEnvironment();
    }
    scene.updateMatrixWorld();
    config.onFrame?.();
    renderer.render(scene, camera);
  }

  function startLoop() {
    if (loopRunning || !inView || disposed) return;
    loopRunning = true;
    renderer.setAnimationLoop(tick);
  }

  function stopLoop() {
    if (!loopRunning) return;
    loopRunning = false;
    renderer.setAnimationLoop(null);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const viewObserver = typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver(entries => {
        inView = entries[entries.length - 1]?.isIntersecting ?? true;
        if (inView) startLoop();
        else stopLoop();
      })
    : null;
  viewObserver?.observe(canvas);

  resize();
  applyOptions();
  startLoop();

  return {
    add,
    update,
    setBackgroundUniform,
    setTilt(id, rx, ry) {
      const node = nodes.get(id);
      if (node) node.tilt.rotation.set(rx, ry, 0);
    },
    nodeMatrix(id) {
      const node = nodes.get(id);
      if (!node) return null;
      return scratch.multiplyMatrices(node.tilt.matrix, node.float.matrix).elements;
    },
    focus(x, y) {
      if (x === principalX && y === principalY) return;
      principalX = x;
      principalY = y;
      applyProjection();
    },
    setOptions(next) {
      const previousHighlight = config.highlight;
      Object.assign(config, next);
      if (config.highlight !== previousHighlight) envDirty = true;
      applyOptions();
      startLoop();
    },
    resize,
    destroy() {
      disposed = true;
      stopLoop();
      observer.disconnect();
      viewObserver?.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      for (const node of nodes.values()) {
        if (node.model) disposeObject(node.model);
        node.material.dispose();
      }
      nodes.clear();
      backdrop.geometry.dispose();
      backdropMaterial.dispose();
      if (roomScene) disposeObject(roomScene);
      envTarget?.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
    get pxPerUnit() {
      return pxPerUnit;
    },
    camera,
    scene,
    renderer,
  };
}
