import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MESH_EDGES, getMeshLinks, getPacketMeshHop } from './network.js';

// The terrain is schematic, deliberately independent of a real forest or GPS fix.
const POSITIONS = { n1: [-16, -9], n2: [0, -15], n3: [15, -6], n4: [-20, 8], n5: [12, 15], n6: [23, 5], n7: [-8, 18], gateway: [0, 2], pi: [8, 7], dashboard: [17, 14] };
const COLORS = { wifi: 0x63d6e8, lora: 0xf1ba64, data: 0xd3ffc9, offline: 0x697470, alert: 0xff744f };
const groundHeight = (x, z) => 0.5 + Math.sin(x * .09) * 1.1 + Math.cos(z * .12) * .72 + Math.sin(x * .2 + z * .08) * .35;

export function createForest(container, { onSelect = () => {} } = {}) {
  const layers = { links: true, labels: true, coverage: false };
  let state = { phase: 'prototype', nodes: [], running: true, gatewayOnline: true, elapsed: 0 };
  let disposed = false;
  let raf = 0;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    container.innerHTML = '<div style="height:100%;min-height:360px;display:grid;place-content:center;text-align:center;padding:30px;color:#a2b6aa"><strong style="color:#e0eee6;font-size:20px">3D view unavailable</strong><p>This device could not start WebGL.<br>The scenario controls and monitoring panels still work.</p></div>';
    return { update() {}, resetView() {}, topView() {}, setLayer() {}, dispose() {} };
  }
  const style = document.createElement('style');
  style.textContent = `.vandoot-forest-canvas{display:block;width:100%;height:100%;touch-action:none}.forest-labels{position:absolute;inset:0;pointer-events:none;overflow:hidden}.forest-label{position:absolute;left:0;top:0;transform:translate(-50%,-100%);pointer-events:auto;border:1px solid rgba(144,184,166,.35);border-radius:5px;padding:5px 8px;color:#e1efe7;background:rgba(13,29,25,.88);backdrop-filter:blur(8px);font-family:inherit;font-size:10px;font-weight:500;line-height:1.4;white-space:nowrap;box-shadow:0 3px 14px #0004;cursor:pointer;display:flex;align-items:center;gap:6px}.forest-label:focus-visible{outline:2px solid #d4f2a8;outline-offset:3px}.forest-label.selected{border-color:#d5f7ac;background:#263d2d;color:#e1ffc4}.forest-label.static{pointer-events:none;border-color:#71847b55;font-size:9px}.forest-label i{width:5px;height:5px;border-radius:100%;background:#acdf9b;box-shadow:0 0 8px #acdf9b55}.forest-label.offline{opacity:.7;color:#b2bab5}.forest-label.offline i{background:#87918b;box-shadow:none}.forest-label.lora i{background:#f1ba64}.forest-label.alert{border-color:#ed8c5277}.forest-label.alert i{background:#ff9b65}.forest-label:not(.selected) em{display:none}.forest-label em{font-size:9px;color:#9eb3a5;font-style:normal;margin-left:3px}`;
  container.appendChild(style);
  const canvas = renderer.domElement;
  canvas.className = 'vandoot-forest-canvas';
  canvas.setAttribute('aria-label', 'Interactive 3D forest. Drag to orbit, scroll to zoom, or use the node buttons to select a monitoring station.');
  canvas.setAttribute('role', 'img');
  container.appendChild(canvas);
  container.querySelector('.forest-loading')?.remove();
  const labelsEl = document.createElement('div');
  labelsEl.className = 'forest-labels';
  container.appendChild(labelsEl);
  const leaderSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leaderSvg.setAttribute('width', '100%');
  leaderSvg.setAttribute('height', '100%');
  leaderSvg.style.cssText = 'position:absolute;inset:0;overflow:visible;pointer-events:none';
  labelsEl.appendChild(leaderSvg);
  const leaders = new Map();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111e1a');
  scene.fog = new THREE.Fog('#111e1a', 105, 180);
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 340);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .065;
  controls.minDistance = 25;
  controls.maxDistance = 195;
  controls.maxPolarAngle = Math.PI * .47;
  controls.minPolarAngle = .08;
  controls.enablePan = true;
  controls.maxTargetRadius = 22;
  controls.target.set(0, 0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;

  scene.add(new THREE.HemisphereLight(0xc3d8c7, 0x253c23, 1.75));
  const sun = new THREE.DirectionalLight(0xffebbf, 2.65);
  sun.position.set(-30, 55, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 140 });
  sun.shadow.normalBias = .12;
  sun.shadow.bias = -.00015;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6fa9bc, .8);
  fill.position.set(20, 16, -30);
  scene.add(fill);

  const materials = {
    terrain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x748075, roughness: .98 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x65553d, roughness: 1 }),
    casing: new THREE.MeshStandardMaterial({ color: 0xd0d7c9, roughness: .7, metalness: .18 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x263b36, roughness: .75, metalness: .25 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x889b91, roughness: .4, metalness: .7 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x1e455e, roughness: .3, metalness: .6 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x268d59, roughness: .7 }),
    black: new THREE.MeshStandardMaterial({ color: 0x111d20, roughness: .3 }),
  };
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function box(parent, sx, sy, sz, material, x, y, z) { return mesh(new THREE.BoxGeometry(sx, sy, sz), material, parent, x, y, z); }
  function rod(parent, a, b, radius, material) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
    const item = mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 6), material, parent);
    item.position.copy(from.add(to).multiplyScalar(.5));
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return item;
  }
  function random(seed) { return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; }; }
  const rnd = random(302115);

  // An irregular, raised terrain tile with vertex-coloured undergrowth and a geological edge.
  const terrain = new THREE.PlaneGeometry(68, 55, 85, 68);
  terrain.rotateX(-Math.PI / 2);
  const vertices = terrain.attributes.position;
  const terrainColors = [];
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = vertices.getZ(i);
    vertices.setY(i, groundHeight(x, z));
    const color = new THREE.Color().setHSL(.245 + rnd() * .045, .21 + rnd() * .11, .21 + rnd() * .055);
    terrainColors.push(color.r, color.g, color.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
  terrain.computeVertexNormals();
  mesh(terrain, materials.terrain, scene);
  const edgeVertices = [];
  const corners = [[-34, -27.5], [34, -27.5], [34, 27.5], [-34, 27.5], [-34, -27.5]];
  for (let side = 0; side < 4; side++) {
    for (let j = 0; j < 64; j++) {
      const a = corners[side], b = corners[side + 1];
      const x1 = a[0] + (b[0] - a[0]) * j / 64, z1 = a[1] + (b[1] - a[1]) * j / 64;
      const x2 = a[0] + (b[0] - a[0]) * (j + 1) / 64, z2 = a[1] + (b[1] - a[1]) * (j + 1) / 64;
      edgeVertices.push(x1, groundHeight(x1, z1), z1, x2, groundHeight(x2, z2), z2, x1, -2.8, z1,
        x2, groundHeight(x2, z2), z2, x2, -2.8, z2, x1, -2.8, z1);
    }
  }
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
  edgeGeometry.computeVertexNormals();
  mesh(edgeGeometry, new THREE.MeshStandardMaterial({ color: 0x303b2d, roughness: 1, side: THREE.DoubleSide }), scene);
  const floor = mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshStandardMaterial({ color: 0x111e1a, roughness: 1 }), scene, 0, -3.05, 0);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;

  function ribbon(points, width, material, lift = .035) {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const pts = curve.getPoints(150), coords = [], indices = [];
    pts.forEach((p, i) => {
      const tangent = curve.getTangent(i / (pts.length - 1));
      const nx = -tangent.z * width / 2, nz = tangent.x * width / 2;
      coords.push(p.x + nx, groundHeight(p.x + nx, p.z + nz) + lift, p.z + nz,
        p.x - nx, groundHeight(p.x - nx, p.z - nz) + lift, p.z - nz);
      if (i < pts.length - 1) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const item = mesh(geo, material, scene);
    item.castShadow = false;
    return curve;
  }
  const creekPoints = [[-30, -27], [-27, -19], [-29, -8], [-26, 2], [-28, 12], [-25, 27]];
  ribbon(creekPoints, 3.2, new THREE.MeshStandardMaterial({ color: 0x66796c, roughness: 1, side: THREE.DoubleSide }));
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x477b79, roughness: .28, metalness: .3, side: THREE.DoubleSide });
  ribbon(creekPoints, 2.05, waterMat, .07);
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x8e8960, roughness: 1, side: THREE.DoubleSide });
  ribbon([[-7, 27], [-5, 15], [0, 2], [8, 7], [17, 14], [26, 27]], 1.2, pathMat);
  ribbon([[-16, -9], [-10, -5], [0, 2], [7, -2], [15, -6]], .6, pathMat);
  ribbon([[0, -15], [-2, -7], [0, 2]], .6, pathMat);

  // Instancing lets hundreds of detailed trees remain smooth on presentation laptops.
  const treeCount = 250;
  const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .23, 1, 6), materials.trunk, treeCount);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), crownMat, treeCount * 5);
  const pineCrowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 9), crownMat, treeCount * 3);
  [trunkMesh, crowns, pineCrowns].forEach(m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
  const matrix = new THREE.Object3D();
  let leafIndex = 0, pineIndex = 0;
  for (let i = 0; i < treeCount; i++) {
    let x, z, tries = 0;
    do {
      x = -32 + rnd() * 64;
      z = -25 + rnd() * 50;
      tries++;
    } while (tries < 100 && (Object.values(POSITIONS).some(p => Math.hypot(x - p[0], z - p[1]) < 6) || Math.abs(x + 27) < 3 || (z > 0 && Math.abs(x + 3 - z * .18) < 1.7)));
    const tall = 3.5 + rnd() * 3.8, y = groundHeight(x, z), pine = rnd() < .23;
    matrix.position.set(x, y + tall / 2, z);
    matrix.scale.set(1 + rnd(), tall, 1 + rnd());
    matrix.rotation.set(0, rnd() * 6.28, .03 * (rnd() - .5));
    matrix.updateMatrix();
    trunkMesh.setMatrixAt(i, matrix.matrix);
    if (pine) {
      for (let t = 0; t < 3; t++) {
        matrix.position.set(x, y + tall * (.46 + t * .22), z);
        matrix.scale.set(tall * (.28 - t * .055), tall * .62, tall * (.28 - t * .055));
        matrix.rotation.set(0, rnd() * 6.28, 0);
        matrix.updateMatrix();
        pineCrowns.setMatrixAt(pineIndex, matrix.matrix);
        pineCrowns.setColorAt(pineIndex++, new THREE.Color().setHSL(.29 + rnd() * .045, .42 + rnd() * .15, .14 + rnd() * .075));
      }
    } else {
      const spread = tall * (.23 + rnd() * .045);
      for (let l = 0; l < 5; l++) {
        const angle = l * Math.PI / 2;
        matrix.position.set(x + (l === 4 ? 0 : Math.cos(angle) * spread * .58), y + tall * (l === 4 ? .95 : .75 + rnd() * .1), z + (l === 4 ? 0 : Math.sin(angle) * spread * .58));
        matrix.scale.set(spread * (l === 4 ? .9 : 1), spread * (1.0 + rnd() * .3), spread);
        matrix.rotation.set(rnd(), rnd() * 6.28, rnd());
        matrix.updateMatrix();
        crowns.setMatrixAt(leafIndex, matrix.matrix);
        crowns.setColorAt(leafIndex++, new THREE.Color().setHSL(.26 + rnd() * .065, .45 + rnd() * .17, .16 + rnd() * .09));
      }
    }
  }
  crowns.count = leafIndex;
  pineCrowns.count = pineIndex;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), materials.rock, 78);
  for (let i = 0; i < 78; i++) {
    const x = -32 + rnd() * 64, z = -25 + rnd() * 50, s = .2 + rnd() * .5;
    matrix.position.set(x, groundHeight(x, z) + s * .25, z);
    matrix.scale.set(s * 1.7, s * .65, s);
    matrix.rotation.set(rnd(), rnd() * 6.28, rnd());
    matrix.updateMatrix();
    rocks.setMatrixAt(i, matrix.matrix);
  }
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  scene.add(rocks);

  const stations = new Map(), labels = new Map(), pickables = [];
  const coverageGroup = new THREE.Group();
  scene.add(coverageGroup);
  function makeLabel(id, text, isStatic = false) {
    const label = document.createElement(isStatic ? 'span' : 'button');
    label.className = 'forest-label' + (isStatic ? ' static' : '');
    label.dataset.nodeId = id;
    if (!isStatic) {
      label.type = 'button';
      label.setAttribute('aria-label', `Inspect ${text}`);
      label.addEventListener('click', () => onSelect(id));
    }
    label.innerHTML = `<i></i><span>${text}</span>${isStatic ? '' : '<em>ESP32</em>'}`;
    labelsEl.appendChild(label);
    labels.set(id, label);
    const leader = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    leader.setAttribute('stroke', '#a5c2af');
    leader.setAttribute('stroke-opacity', '.5');
    leader.setAttribute('stroke-width', '1');
    leaderSvg.appendChild(leader);
    leaders.set(id, leader);
  }
  function ring(radius, color, opacity = .7) {
    const item = new THREE.Mesh(new THREE.RingGeometry(radius, radius + .1, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    item.rotation.x = -Math.PI / 2;
    item.renderOrder = 17;
    return item;
  }
  Object.entries(POSITIONS).filter(([id]) => id.startsWith('n')).forEach(([id, [x, z]], index) => {
    const group = new THREE.Group();
    group.position.set(x, groundHeight(x, z), z);
    scene.add(group);
    const pad = mesh(new THREE.CylinderGeometry(1.35, 1.5, .13, 16), new THREE.MeshStandardMaterial({ color: 0x858875, roughness: 1 }), group, 0, .04, 0);
    pad.userData.nodeId = id;
    rod(group, [0, .1, 0], [0, 4.5, 0], .09, materials.steel);
    box(group, .95, 1.25, .5, materials.casing, 0, 3.2, .25);
    box(group, .65, .85, .035, materials.pcb, 0, 3.2, .52);
    box(group, .25, .32, .04, materials.steel, 0, 3.33, .56);
    box(group, .18, .26, .06, materials.black, -.12, 2.98, .56);
    for (let p = 0; p < 5; p++) {
      box(group, .04, .07, .035, materials.steel, -.31, 3.46 - p * .14, .57);
      box(group, .04, .07, .035, materials.steel, .31, 3.46 - p * .14, .57);
    }
    // DHT-style vented weather shield, MQ-style sampling head and PIR dome.
    for (let p = 0; p < 4; p++) box(group, .54, .07, .44, materials.casing, -.65, 3.5 + p * .12, .1);
    mesh(new THREE.CylinderGeometry(.17, .17, .24, 12), materials.steel, group, .65, 3.55, .1);
    const pir = mesh(new THREE.SphereGeometry(.18, 12, 8), materials.casing, group, .4, 3.25, .55);
    pir.scale.z = .6;
    rod(group, [.3, 3.9, .1], [.3, 4.8, .1], .025, materials.black);
    const cameraBody = box(group, .4, .3, .36, materials.dark, 0, 4.25, .3);
    const lens = mesh(new THREE.CylinderGeometry(.1, .1, .06, 12), materials.black, group, 0, 4.25, .52);
    lens.rotation.x = Math.PI / 2;
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xb8ed99 });
    const led = mesh(new THREE.SphereGeometry(.07, 8, 6), ledMat, group, .27, 3.75, .52);
    const beacon = mesh(new THREE.SphereGeometry(.15, 10, 8), new THREE.MeshBasicMaterial({ color: COLORS.wifi, depthTest: false, depthWrite: false }), group, 0, 5.2, 0);
    beacon.renderOrder = 25;
    const solar = new THREE.Group();
    solar.position.set(0, 4.55, -.25);
    solar.rotation.x = -.42;
    group.add(solar);
    box(solar, 2.05, .1, 1.45, materials.steel, 0, 0, 0);
    box(solar, 1.93, .035, 1.33, materials.panel, 0, .07, 0);
    for (let c = -2; c <= 2; c++) box(solar, .014, .012, 1.3, materials.steel, c * .34, .1, 0);
    for (let r = -1; r <= 1; r++) box(solar, 1.9, .012, .014, materials.steel, 0, .1, r * .35);
    const battery = box(group, .72, .65, .55, materials.dark, 0, .55, 0);
    const circle = ring(1.75, COLORS.wifi);
    circle.position.y = .2;
    group.add(circle);
    const coverage = ring(6.8, COLORS.wifi, .15);
    coverage.position.set(x, groundHeight(x, z) + .3, z);
    coverageGroup.add(coverage);
    const hitTarget = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 5, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hitTarget.position.y = 2.5;
    hitTarget.userData.nodeId = id;
    group.add(hitTarget);
    pickables.push(hitTarget);
    stations.set(id, { group, solar, battery, circle, led, beacon, coverage, cameraBody, labelHeight: 6.15 });
    makeLabel(id, `N0${index + 1}`);
  });

  const gateway = new THREE.Group();
  gateway.position.set(0, groundHeight(0, 2), 2);
  scene.add(gateway);
  mesh(new THREE.CylinderGeometry(1.8, 1.9, .2, 20), materials.rock, gateway, 0, .05, 0);
  for (let a = 0; a < 3; a++) {
    const angle = a * Math.PI * 2 / 3;
    const x = Math.cos(angle) * .6, z = Math.sin(angle) * .6;
    rod(gateway, [x, .2, z], [x * .4, 8, z * .4], .055, materials.steel);
    for (let y = 0; y < 7; y += 1.5) rod(gateway, [x * (1 - y / 12), y + .4, z * (1 - y / 12)], [Math.cos(angle + 2.09) * .4, y + 1.7, Math.sin(angle + 2.09) * .4], .025, materials.steel);
  }
  box(gateway, 1.25, 1.6, .75, materials.casing, 0, 1.1, .5);
  box(gateway, .85, .9, .03, materials.pcb, 0, 1.2, .9);
  rod(gateway, [0, 7.5, 0], [0, 10, 0], .055, materials.dark);
  for (let y = 7.5; y < 9; y += .45) rod(gateway, [-.9, y, 0], [.9, y, 0], .035, materials.steel);
  const gatewayBeacon = mesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshBasicMaterial({ color: COLORS.data }), gateway, 0, 10.1, 0);
  const gatewayRing = ring(2.15, COLORS.data, .7);
  gatewayRing.position.y = .2;
  gateway.add(gatewayRing);
  makeLabel('gateway', 'ESP32 GATEWAY', true);

  const piStation = new THREE.Group();
  piStation.position.set(8, groundHeight(8, 7), 7);
  scene.add(piStation);
  box(piStation, 4.5, .18, 3.3, materials.rock, 0, .1, 0);
  box(piStation, 3.4, 2.2, 2.3, materials.casing, 0, 1.3, 0);
  box(piStation, 3.7, .22, 2.7, materials.dark, 0, 2.52, 0);
  box(piStation, 1.2, 1.65, .04, materials.dark, -.75, 1.05, 1.18);
  box(piStation, 1.1, .75, .045, new THREE.MeshStandardMaterial({ color: 0x234e48, emissive: 0x214337, emissiveIntensity: .4, roughness: .3 }), .8, 1.65, 1.18);
  // Visible Raspberry Pi board mounted inside the protected processing cabinet.
  box(piStation, .7, .5, .05, materials.pcb, .8, 1.65, 1.23);
  box(piStation, .24, .24, .03, materials.black, .8, 1.65, 1.27);
  for (let a = 0; a < 3; a++) box(piStation, .15, .12, .06, materials.steel, .52 + a * .2, 1.43, 1.28);
  rod(piStation, [1.1, 2.6, -.7], [1.1, 4, -.7], .035, materials.steel);
  makeLabel('pi', 'RASPBERRY PI · FLASK', true);

  const dashboard = new THREE.Group();
  dashboard.position.set(17, groundHeight(17, 14), 14);
  scene.add(dashboard);
  rod(dashboard, [0, 0, 0], [0, 2.6, 0], .12, materials.steel);
  box(dashboard, 2.7, 1.75, .2, materials.dark, 0, 2.8, 0);
  box(dashboard, 2.45, 1.48, .025, new THREE.MeshBasicMaterial({ color: 0x284c3e }), 0, 2.8, .12);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xb8d8a4 });
  for (let a = 0; a < 6; a++) box(dashboard, .18, .2 + (a % 3) * .14, .025, screenMat, -.95 + a * .35, 2.55 + (a % 3) * .07, .15);
  box(dashboard, 1.4, .09, .025, screenMat, -.45, 3.23, .15);
  makeLabel('dashboard', 'DASHBOARD', true);

  const linkGroup = new THREE.Group();
  scene.add(linkGroup);
  const links = new Map();
  function pointFor(id) {
    if (id === 'mesh-root') id = 'gateway';
    const p = POSITIONS[id] || POSITIONS.gateway;
    const height = id === 'gateway' ? 8.4 : id === 'pi' ? 3.2 : id === 'dashboard' ? 3.7 : 4.9;
    return new THREE.Vector3(p[0], groundHeight(...p) + height, p[1]);
  }
  function buildLink(key, fromId, toId, color, lora = false) {
    const a = pointFor(fromId), b = pointFor(toId);
    const mid = a.clone().lerp(b, .5);
    mid.y += lora ? 7.5 : 3;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    let geo;
    if (lora) {
      const segments = Array.from({length:24},(_,i)=>{
        const section=new THREE.CatmullRomCurve3(Array.from({length:4},(_,j)=>curve.getPoint((i+j/3*.56)/24)));
        return new THREE.TubeGeometry(section,3,.13,5,false);
      });
      geo=mergeGeometries(segments);
      segments.forEach(segment=>segment.dispose());
    } else geo=new THREE.TubeGeometry(curve,50,.12,6,false);
    const material = new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false,depthTest:false,toneMapped:false});
    const line = new THREE.Mesh(geo, material);
    line.renderOrder = 20;
    linkGroup.add(line);
    links.set(key, { line, curve, fromId, toId });
  }
  MESH_EDGES.forEach(edge=>buildLink(edge.id,edge.from,edge.to,COLORS.wifi));
  Object.keys(POSITIONS).filter(id => id.startsWith('n')).forEach(id => {
    buildLink(`${id}-lora`, id, 'mesh-root', COLORS.lora, true);
  });
  buildLink('gateway-pi', 'gateway', 'pi', COLORS.data);
  buildLink('pi-dashboard', 'pi', 'dashboard', COLORS.data);
  const packetDot = mesh(new THREE.SphereGeometry(.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf0ffe3, depthTest: false, depthWrite: false }), linkGroup);
  const packetHalo = mesh(new THREE.SphereGeometry(.46, 12, 8), new THREE.MeshBasicMaterial({ color: 0xbdeea4, transparent: true, opacity: .24, depthWrite: false, depthTest: false }), linkGroup);
  packetDot.renderOrder = 30;
  packetHalo.renderOrder = 29;
  const servicePulse = ring(2.7, COLORS.wifi, .6);
  servicePulse.position.set(8, groundHeight(8, 7) + .25, 7);
  linkGroup.add(servicePulse);
  const hazardRing = ring(3.8, COLORS.alert, .5);
  hazardRing.position.set(0, groundHeight(0, -15) + .12, -15);
  scene.add(hazardRing);
  const smokeGroup = new THREE.Group();
  scene.add(smokeGroup);
  const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0xc8a67d, transparent: true, opacity: .08, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const p = mesh(new THREE.SphereGeometry(.75, 10, 8), smokeMaterial, smokeGroup);
    p.userData.offset = i / 7;
    p.castShadow = false;
  }

  const actors = new THREE.Group();
  actors.position.set(3.4, groundHeight(3.4, -13), -13);
  scene.add(actors);
  const animal = new THREE.Group(), human = new THREE.Group(), vehicle = new THREE.Group(), unknown = new THREE.Group();
  actors.add(animal, human, vehicle, unknown);
  const unresolved = mesh(new THREE.IcosahedronGeometry(.85, 1), new THREE.MeshStandardMaterial({ color: 0x6d7c68, roughness: 1 }), unknown, 0, .9, 0);
  unresolved.scale.set(.7, 1, .7);
  box(unknown, 1.45, 2, 1.45, new THREE.MeshBasicMaterial({ color: COLORS.lora, wireframe: true, transparent: true, opacity: .5 }), 0, 1, 0);
  const deerMat = new THREE.MeshStandardMaterial({ color: 0x9a7750, roughness: 1 });
  const body = mesh(new THREE.SphereGeometry(1, 12, 8), deerMat, animal, 0, 1.2, 0);
  body.scale.set(.95, .45, .4);
  rod(animal, [.6, 1.3, 0], [.9, 2.1, 0], .19, deerMat);
  const head = mesh(new THREE.SphereGeometry(.3, 10, 8), deerMat, animal, 1.05, 2.13, 0);
  head.scale.x = 1.4;
  for (const x of [-.6, .55]) for (const z of [-.25, .25]) rod(animal, [x, 1.3, z], [x - .1, .1, z], .075, deerMat);
  for (const z of [-.15, .15]) {
    rod(animal, [.85, 2.35, z], [.6, 2.9, z * 2], .035, materials.trunk);
    rod(animal, [.7, 2.65, z * 1.5], [1, 2.9, z * 1.8], .025, materials.trunk);
  }
  const cloth = new THREE.MeshStandardMaterial({ color: 0xd7a267, roughness: 1 });
  mesh(new THREE.SphereGeometry(.23, 10, 8), cloth, human, 0, 2.15, 0);
  box(human, .55, .75, .3, materials.dark, 0, 1.55, 0);
  rod(human, [-.16, 1.3, 0], [-.25, .1, .15], .1, materials.dark);
  rod(human, [.16, 1.3, 0], [.25, .1, -.15], .1, materials.dark);
  rod(human, [-.3, 1.9, 0], [-.45, 1.15, .1], .08, cloth);
  rod(human, [.3, 1.9, 0], [.45, 1.15, -.1], .08, cloth);
  const carMat = new THREE.MeshStandardMaterial({ color: 0xc9b993, roughness: .6 });
  box(vehicle, 3.4, .75, 1.6, carMat, 0, .8, 0);
  box(vehicle, 1.6, .8, 1.45, carMat, -.25, 1.55, 0);
  box(vehicle, 1.3, .48, .02, materials.panel, -.25, 1.62, .74);
  for (const x of [-1.05, 1.05]) for (const z of [-.82, .82]) {
    const wheel = mesh(new THREE.CylinderGeometry(.39, .39, .24, 12), materials.black, vehicle, x, .45, z);
    wheel.rotation.x = Math.PI / 2;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown = null;
  function down(event) { pointerDown = [event.clientX, event.clientY]; }
  function up(event) {
    if (!pointerDown || Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height * 2 - 1));
    raycaster.setFromCamera(pointer, camera);
    const targets = pickables.filter(p => p.parent.visible);
    const hit = raycaster.intersectObjects(targets)[0];
    if (hit) onSelect(hit.object.userData.nodeId);
    pointerDown = null;
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  let width = 1, height = 1;
  function resize() {
    if (disposed) return;
    const oldAspect = camera.aspect;
    width = Math.max(container.clientWidth, 1);
    height = Math.max(container.clientHeight, 360);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (width > 10 && Math.abs(oldAspect - camera.aspect) > .15) resetView();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  function resetView() {
    const fit = Math.max(1, 1.2 / camera.aspect);
    camera.position.set(57 * fit, 53 * fit, 70 * fit);
    controls.target.set(0, 0, 1);
    controls.update();
  }
  function topView() { camera.position.set(0, 110 * Math.max(1, 1.1 / camera.aspect), .5); controls.target.set(0, 0, 0); controls.update(); }
  function setLayer(name, visible) { if (name in layers) layers[name] = Boolean(visible); }
  const projected = new THREE.Vector3();
  let lastUpdateAt = performance.now();
  const labelPositions = { gateway: new THREE.Vector3(0, gateway.position.y + 11, 2), pi: new THREE.Vector3(8, piStation.position.y + 4.5, 7), dashboard: new THREE.Vector3(17, dashboard.position.y + 4.2, 14) };
  function update(nextState) {
    state = nextState || state;
    lastUpdateAt = performance.now();
    const activeIds = new Set((state.nodes || []).map(n => n.id));
    stations.forEach((station, id) => {
      const node = state.nodes?.find(n => n.id === id);
      station.group.visible = activeIds.has(id);
      station.coverage.visible = activeIds.has(id);
      station.solar.visible = state.phase === 'proposed';
      station.battery.visible = state.phase === 'proposed';
      station.cameraBody.visible = state.phase === 'proposed';
      const selected = state.selectedNode === id || state.selectedNode?.id === id;
      const offline = node?.online === false;
      const alert = !offline && (node?.temp > 38 || node?.motion || (Number.isFinite(node?.battery) && node.battery < 20));
      const color = offline ? COLORS.offline : alert ? COLORS.alert : node?.link === 'lora' ? COLORS.lora : selected ? 0xd4f7a7 : COLORS.wifi;
      station.circle.material.color.setHex(color);
      station.led.material.color.setHex(color);
      station.beacon.material.color.setHex(color);
      station.circle.material.opacity = selected ? .95 : .5;
      station.circle.scale.setScalar(selected ? 1.2 : 1);
      const label = labels.get(id);
      label.className = `forest-label${selected ? ' selected' : ''}${offline ? ' offline' : ''}${node?.link === 'lora' ? ' lora' : ''}${alert ? ' alert' : ''}`;
      label.style.display = activeIds.has(id) && layers.labels ? '' : 'none';
    });
    const meshLinks=new Map(getMeshLinks(state).map(link=>[link.id,link]));
    links.forEach((link, key) => {
      const node = state.nodes?.find(n => n.id === link.fromId);
      const lora = key.endsWith('-lora');
      let visible = true;
      if (key.startsWith('mesh-')) {
        const edge=meshLinks.get(key);
        visible=Boolean(edge);
        link.line.material.opacity=edge?.status==='active'?.85:edge?.status==='standby'?.25:.12;
        link.line.material.color.setHex(edge?.status==='offline'?COLORS.offline:COLORS.wifi);
      } else if (lora) {
        visible=activeIds.has(link.fromId)&&node?.link==='lora';
        link.line.material.opacity=state.gatewayOnline===false||node?.online===false?.15:.85;
        link.line.material.color.setHex(COLORS.lora);
      } else link.line.material.opacity = state.gatewayOnline === false ? .15 : .6;
      link.line.visible = visible;
    });
    gatewayBeacon.material.color.setHex(state.gatewayOnline === false ? COLORS.offline : COLORS.data);
    labels.get('gateway').classList.toggle('offline', state.gatewayOnline === false);
    const risk = Number(state.risk?.score) || 0;
    hazardRing.visible = state.phase === 'proposed' && risk >= 35;
    smokeGroup.visible = state.phase === 'proposed' && risk >= 55;
    actors.visible = Boolean(state.camera) && state.phase === 'proposed';
    animal.visible = state.camera?.kind === 'animal';
    human.visible = state.camera?.kind === 'human';
    vehicle.visible = state.camera?.kind === 'vehicle';
    unknown.visible = state.camera?.kind === 'unknown';
  }
  function draw(timeMs) {
    if (disposed) return;
    raf = requestAnimationFrame(draw);
    controls.update();
    const viewDistance = camera.position.distanceTo(controls.target);
    scene.fog.near = viewDistance + 15;
    scene.fog.far = viewDistance + 100;
    linkGroup.visible = layers.links;
    coverageGroup.visible = layers.coverage;
    labelsEl.style.display = layers.labels ? '' : 'none';
    stations.forEach((station, id) => {
      const label = labels.get(id);
      projected.copy(station.group.position);
      projected.y += station.labelHeight;
      projected.project(camera);
      label.style.left = `${(projected.x * .5 + .5) * width}px`;
      label.style.top = `${(-projected.y * .5 + .5) * height}px`;
      label.style.visibility = projected.z > 1 || projected.z < -1 ? 'hidden' : 'visible';
    });
    Object.entries(labelPositions).forEach(([id, pos]) => {
      projected.copy(pos).project(camera);
      const label = labels.get(id);
      label.style.left = `${(projected.x * .5 + .5) * width}px`;
      label.style.top = `${(-projected.y * .5 + .5) * height}px`;
      label.style.visibility = projected.z > 1 || projected.z < -1 ? 'hidden' : 'visible';
    });
    // Separate nearby labels without losing their connection to physical stations.
    const placed = [];
    const candidates = [...labels.entries()].map(([id, label]) => ({ id, label, x: parseFloat(label.style.left), y: parseFloat(label.style.top) })).sort((a,b)=>a.y-b.y);
    for (const {id,label,x,y} of candidates) {
      const leader = leaders.get(id);
      const visible = layers.labels && label.style.display !== 'none' && label.style.visibility !== 'hidden';
      leader.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const w = label.offsetWidth, h = label.offsetHeight;
      const left = Math.max(8, Math.min(width-w-8, x-w/2));
      let bottom = Math.max(83, Math.min(height-32,y));
      for (let attempt=0;attempt<12;attempt++) {
        const collision = placed.find(p=>left<p.right+5&&left+w>p.left-5&&bottom>p.top-4&&bottom-h<p.bottom+4);
        if (!collision) break;
        bottom=collision.bottom+h+5;
      }
      label.style.left=`${left+w/2}px`;
      label.style.top=`${bottom}px`;
      placed.push({left,right:left+w,top:bottom-h,bottom});
      leader.setAttribute('x1',String(x));leader.setAttribute('y1',String(y));
      leader.setAttribute('x2',String(left+w/2));leader.setAttribute('y2',String(bottom-h/2));
      leader.style.opacity=Math.abs(bottom-y)>8||Math.abs(left+w/2-x)>8?'.7':'0';
    }
    const packet = state.packet;
    let activeLink = null;
    let packetProgress = THREE.MathUtils.clamp(Number(packet?.progress) || 0, 0, 1);
    if (packet && state.gatewayOnline !== false) {
      const hop=getPacketMeshHop(packet);
      const node=state.nodes?.find(n=>n.id===packet.nodeId);
      const routeAvailable=state.routeMode!=='offline'&&packet.path.filter(id=>id.startsWith('n')).every(id=>state.nodes?.some(n=>n.id===id&&n.online&&n.link!=='offline'));
      if(hop&&routeAvailable){
        if(node?.link==='lora')activeLink=links.get(`${packet.nodeId}-lora`);
        else activeLink=[...links.values()].find(link=>(link.fromId===hop.from&&link.toId===hop.to)||(link.fromId===hop.to&&link.toId===hop.from));
        if(activeLink)packetProgress=activeLink.fromId===hop.from?hop.progress:1-hop.progress;
      }
      // mDNS is discovery; sensor JSON only traverses this edge during HTTP POST.
      if (packet.stage === 4) activeLink = links.get('gateway-pi');
      if (packet.stage === 7) activeLink = links.get('pi-dashboard');
    }
    packetDot.visible = packetHalo.visible = Boolean(activeLink);
    if (activeLink) {
      // The engine's packet is a live object: progress advances on every engine tick,
      // even though the larger panel refresh runs at 4 Hz. Never predict a delivery.
      activeLink.curve.getPoint(packetProgress, packetDot.position);
      packetHalo.position.copy(packetDot.position);
    }
    servicePulse.visible = Boolean(packet && state.gatewayOnline !== false && [3, 5, 6].includes(packet.stage));
    if (servicePulse.visible) {
      servicePulse.material.color.setHex(packet.stage === 3 ? COLORS.wifi : COLORS.data);
      servicePulse.scale.setScalar(1 + packetProgress * .55);
      servicePulse.material.opacity = .65 * (1 - packetProgress * .7);
    }
    // Interpolate decorative motion between snapshots, bounded to one UI interval.
    // Transport and completion use the engine's actual packet state above.
    const visualDelta = state.running ? Math.min(Math.max((performance.now() - lastUpdateAt) / 1000, 0), .25) * (state.speed || 1) : 0;
    const simTime = (Number(state.elapsed) || 0) + visualDelta;
    hazardRing.scale.setScalar(1 + Math.sin(simTime * 2.2) * .08);
    smokeGroup.children.forEach(p => {
      const t = (simTime * .12 + p.userData.offset) % 1;
      p.position.set(Math.sin(t * 7 + p.userData.offset * 5) * 1.2, groundHeight(0, -15) + 2 + t * 5, -15 + Math.cos(t * 4) * .8);
      p.scale.setScalar(.5 + t * 1.6);
    });
    actors.position.x = 3.4 + Math.sin(simTime * .4) * .5;
    renderer.render(scene, camera);
  }
  resize();
  resetView();
  update(state);
  draw(0);
  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    controls.dispose();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerup', up);
    const geos = new Set(), mats = new Set();
    scene.traverse(obj => { if (obj.geometry) geos.add(obj.geometry); if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => mats.add(m)); });
    geos.forEach(g => g.dispose());
    mats.forEach(m => m.dispose());
    renderer.dispose();
    canvas.remove();
    labelsEl.remove();
    style.remove();
  }
  return { update, resetView, topView, setLayer, dispose };
}
