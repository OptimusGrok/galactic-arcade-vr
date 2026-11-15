// Galactic Arcade VR - WebXR for Meta Quest Browser (and any WebXR headset).
// ENTER VR on the arcade floor -> the headset is the camera at real-world scale (1 unit = 1 m; cabinets are life size).
//   LEFT STICK   smooth walk where you look (same wall / cabinet collision as the flat game)
//   RIGHT STICK  left/right = 30 degree snap turn
//   TRIGGER      point at a cabinet = play it; point at the floor = teleport there
//   in a game    the cabinet's game shows on a big screen in front of you. A/X = insert tickets / start, then the
//                game's buttons (sticks = arrows, A/X = fire / primary, B/Y = secondary or CONTINUE, trigger = fire or tap
//                the screen where you point), HOLD GRIP = leave the machine.
// The player rig is an offset XR reference space (renderer.xr.setReferenceSpace), so camera.position and the controller
// objects stay in world coordinates for the rest of the arcade code.
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const NAMES = { strike: 'STRIKE', ghost: 'GHOST 256', monkey: 'MONKEY CROSSING', berserker: 'BERSERKER', orc: 'ORC ATTACK', cyber: 'CYBERCITY', blaster: 'BLASTER', pip: 'SUPER PIP QUEST', bb: 'BURROW BUSTER', rockfall: 'ROCKFALL RUSH', skytower: 'SKY TOWER', nova: 'NOVA TETHER', claw: 'CLAW MACHINE', roadster: 'MARS ROADSTER', ds: 'DEAD SIGNAL' };
const SNAP = Math.PI / 6, SPEED = 2.2, RAY_MAX = 12, GRIP_EXIT_S = 0.6;
const KEYNAME = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Space: ' ', Enter: 'Enter', KeyZ: 'z', KeyX: 'x', KeyP: 'p', KeyJ: 'j', KeyF: 'f', KeyE: 'e', ShiftLeft: 'Shift' };
const KEYCODE = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Space: 32, Enter: 13, KeyZ: 90, KeyX: 88, KeyP: 80, KeyJ: 74, KeyF: 70, KeyE: 69, ShiftLeft: 16 };
// what each cabinet's buttons send into its game iframe (a = A/X, b = B/Y; trig: 'a' = same as A, 'ptr' = tap the screen where the ray points)
const MAPS = {
  strike: { a: ['KeyZ'], b: ['KeyX'], trig: 'a', help: 'STICK FLY · A/X/TRIGGER FIRE · B/Y BOMB' },
  ghost: { a: ['Space'], b: [], trig: 'a', help: 'STICK STEER · A START' },
  claw: { a: ['Enter', 'Space'], b: [], trig: 'ptr', help: 'STICK MOVE · A DROP · TRIGGER TAPS' },
  orc: { a: [], b: [], trig: 'ptr', help: 'POINT + TRIGGER TO TAP THE SCREEN' },
  skytower: { a: ['Space', 'KeyJ'], b: ['KeyF'], trig: 'a', help: 'STICK MOVE · A JUMP · B FIRE' },
  roadster: { a: ['Space'], b: [], trig: 'a', help: 'STICK STEER / GAS · A ACTION' },
  nova: { a: ['Space', 'KeyZ'], b: ['ShiftLeft'], trig: 'a', help: 'STICK MOVE · A ACTION · B ALT' },
  ds: { a: ['Space', 'KeyE'], b: [], trig: 'a', help: 'STICK MOVE · A ACTION' },
  default: { a: ['Space', 'KeyZ'], b: ['KeyX'], trig: 'ptr', help: 'STICK MOVE · A/X ACTION · B/Y ALT · TRIGGER TAPS' },
};

export function setupVR(A) {
  const { renderer, scene, camera, monkey, st, play } = A;
  const S = window.__gaVR = {
    presenting: false, supported: false, starts: 0, ends: 0, frames: 0, snaps: 0, teleports: 0, launches: 0, exits: 0, keysSent: 0, ptrSent: 0, texUploads: 0, pumps: 0,
    rig: { x: 0, y: 0, z: 0, yaw: 0 }, head: null, hover: null, held: {}, maps: MAPS, lastKey: null, msg: '', msgT: 0,
  };
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _ray = new THREE.Ray(), _hit = new THREE.Vector3();
  let baseRef = null, session = null, saved = null;

  // ---------- ENTER VR button (flat page; only when the browser has an immersive-vr device) ----------
  const css = document.createElement('style');
  css.textContent = '#vrBtn{position:fixed;left:50%;top:calc(env(safe-area-inset-top) + 10px);transform:translateX(-50%);z-index:60;display:none;padding:10px 20px;border-radius:12px;border:2px solid #3ff3ff;background:#0a0618ee;color:#fff;font:900 16px/1 "Arial Black",Arial,sans-serif;letter-spacing:.08em;box-shadow:0 0 16px #3ff3ff88,inset 0 0 10px #ff3fd244;cursor:pointer}'
    + '#vrBtn.on{display:block}body.ingame #vrBtn{display:none!important}#vrBtn small{display:block;font:700 9px/1.3 "Courier New",monospace;color:#ffe14a;letter-spacing:.06em;margin-top:3px}'
    + 'body.vr>:not(canvas):not(iframe):not(script):not(style){visibility:hidden!important}';   // VR: the DOM HUD is not visible in the headset; the in-world ticket display replaces it
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'vrBtn'; btn.type = 'button'; btn.innerHTML = 'ENTER VR<small>META QUEST · WEBXR</small>'; document.body.appendChild(btn);
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) btn.addEventListener(ev, e => e.stopPropagation());
  btn.addEventListener('click', e => { e.stopPropagation(); enter(); });
  function checkSupport() { const xr = navigator.xr; if (!xr || !xr.isSessionSupported) { S.supported = false; return; }
    xr.isSessionSupported('immersive-vr').then(ok => { S.supported = !!ok; }).catch(() => { S.supported = false; }); }
  checkSupport(); if (navigator.xr && navigator.xr.addEventListener) navigator.xr.addEventListener('devicechange', checkSupport);
  setInterval(() => { const startUp = document.getElementById('start') && window.__start && window.__start.shown && !window.__start.dismissed;
    btn.classList.toggle('on', S.supported && !S.presenting && !startUp && play.mode === 'walk'); }, 300);
  async function enter() {
    if (S.presenting || !navigator.xr) return;
    try { const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'layers'] });
      try { renderer.xr.setFoveation(1); } catch (e) {}
      await renderer.xr.setSession(s);
    } catch (e) { console.warn('ENTER VR failed', e); S.lastError = String(e); }
  }
  S.enter = enter; S.exit = () => { try { session && session.end(); } catch (e) {} };

  // ---------- controllers: ray + simple built-in model (Quest models load from the WebXR input-profile CDN when online) ----------
  const ctrls = [], grips = [];
  const rayGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const factory = window.__gavrNoModels ? null : new XRControllerModelFactory();
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i); c.name = 'vrController' + i;
    const ray = new THREE.Line(rayGeo, new THREE.LineBasicMaterial({ color: 0x3ff3ff, transparent: true, opacity: 0.85, fog: false, toneMapped: false }));
    ray.name = 'vrRay'; ray.scale.z = 3; ray.frustumCulled = false; c.add(ray); c.userData.ray = ray;
    c.addEventListener('connected', e => { c.userData.src = e.data; c.userData.hand = e.data && e.data.handedness; });
    c.addEventListener('disconnected', () => { c.userData.src = null; c.userData.hand = null; });
    scene.add(c); ctrls.push(c);
    const g = renderer.xr.getControllerGrip(i); g.name = 'vrGrip' + i;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.11, 12).rotateX(Math.PI / 2 - 0.5), new THREE.MeshBasicMaterial({ color: 0x1a1030, fog: false }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 20), new THREE.MeshBasicMaterial({ color: 0xff3fd2, fog: false, toneMapped: false })); ring.position.set(0, 0.012, -0.03); ring.rotation.x = 0.6;
    body.add(ring); body.name = 'vrFallbackModel'; g.add(body); g.userData.fallback = body;
    if (factory) try { const m = factory.createControllerModel(g); g.add(m); g.userData.model = m; } catch (e) {}
    scene.add(g); grips.push(g);
  }
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false, depthTest: false })); dot.renderOrder = 1002; dot.visible = false; scene.add(dot);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x3ff3ff, fog: false, toneMapped: false, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const tpRing = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2), ringMat); tpRing.visible = false; tpRing.name = 'vrTeleportRing'; scene.add(tpRing);

  // ---------- text panels (canvas textures) ----------
  function panel(w, h, cw, ch) { const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, toneMapped: false, depthTest: false, depthWrite: false }));
    m.renderOrder = 1001; m.userData = { cv, g: cv.getContext('2d'), tex, txt: '' }; return m; }
  function drawPanel(m, lines, opts = {}) { const key = lines.join('|'); if (m.userData.txt === key) return; m.userData.txt = key;
    const { cv, g, tex } = m.userData, W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(10,6,24,0.86)'; g.strokeStyle = opts.border || '#3ff3ff'; g.lineWidth = Math.max(3, H * 0.03); g.beginPath(); g.roundRect ? g.roundRect(4, 4, W - 8, H - 8, H * 0.12) : g.rect(4, 4, W - 8, H - 8); g.fill(); g.stroke();
    const n = lines.length, lh = (H - 16) / n; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((t, i) => { g.fillStyle = i === 0 ? (opts.c0 || '#ffe14a') : '#e8f6ff'; g.font = '900 ' + Math.round(lh * (i === 0 ? 0.62 : 0.5)) + 'px "Arial Black", Arial, sans-serif'; g.fillText(t, W / 2, 8 + lh * (i + 0.5), W - 24); });
    tex.needsUpdate = true; }
  const hud = panel(0.2, 0.09, 512, 230); hud.name = 'vrHud'; hud.visible = false; scene.add(hud);   // follows the left controller: the in-world ticket display

  // ---------- the game screen (shown while a cabinet game runs) ----------
  const scr = new THREE.Group(); scr.name = 'vrGameScreen'; scr.visible = false; scene.add(scr);
  const comp = document.createElement('canvas'); comp.width = 512; comp.height = 512; const cg = comp.getContext('2d');
  const scrTex = new THREE.CanvasTexture(comp); scrTex.colorSpace = THREE.SRGBColorSpace; scrTex.generateMipmaps = false; scrTex.minFilter = THREE.LinearFilter;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x05020c, fog: false, depthTest: false, depthWrite: false })); back.renderOrder = 998; scr.add(back);
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xff3fd2, fog: false, toneMapped: false, depthTest: false, depthWrite: false })); edge.renderOrder = 997; edge.position.z = -0.002; scr.add(edge);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: scrTex, fog: false, toneMapped: false, depthTest: false, depthWrite: false })); face.renderOrder = 999; face.name = 'vrGameFace'; scr.add(face);
  const bar = panel(1.2, 0.16, 1024, 136); bar.name = 'vrStatus'; scr.add(bar);
  const G = { layoutT: 0, cvs: [], rect: null, aspect: 1, placed: false, w: 1, h: 1, ptrDown: false };
  S.screen = scr; S.comp = comp;
  function placeScreen() {
    const h = S.head || { x: monkey.position.x, y: 1.6, z: monkey.position.z, yaw: st.yaw }, d = 1.55;
    scr.position.set(h.x - Math.sin(h.yaw) * d, Math.max(1.0, h.y - 0.08), h.z - Math.cos(h.yaw) * d); scr.rotation.set(0, h.yaw, 0); G.placed = true; }
  function sizeScreen(aspect) { const maxW = 1.9, maxH = 1.25; let hh = maxH, ww = hh * aspect; if (ww > maxW) { ww = maxW; hh = ww / aspect; }
    G.w = ww; G.h = hh; face.scale.set(ww, hh, 1); back.scale.set(ww + 0.04, hh + 0.04, 1); edge.scale.set(ww + 0.07, hh + 0.07, 1); bar.position.set(0, -hh / 2 - 0.12, 0); }
  sizeScreen(9 / 16);
  function gameWin() { try { return play.frame && play.frame.contentWindow; } catch (e) { return null; } }
  function layout(w) {   // the visible canvases of the game page, and the box around them (CSS px in the iframe)
    const d = w.document, list = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, big = null, ba = 0;
    for (const c of d.querySelectorAll('canvas')) { if (!c.width || !c.height) continue; const r = c.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
      const cs = w.getComputedStyle(c); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      if (r.right <= 0 || r.bottom <= 0 || r.left >= w.innerWidth || r.top >= w.innerHeight) continue;
      list.push({ c, r }); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); if (r.width * r.height > ba) { ba = r.width * r.height; big = { c, r }; } }
    if (!list.length) { G.cvs = []; G.rect = null; return; }
    // only canvases that sit over the biggest one (HUD layers); skip small decorations elsewhere on the page
    const br = big.r, keep = list.filter(o => o === big || (o.r.left >= br.left - 2 && o.r.top >= br.top - 2 && o.r.right <= br.right + 2 && o.r.bottom <= br.bottom + 2));
    G.cvs = keep; G.rect = { left: br.left, top: br.top, width: br.width, height: br.height };
    const k = Math.min(1024 / Math.max(br.width, br.height), Math.max(big.c.width / br.width, 512 / Math.max(br.width, br.height)));
    const cw = Math.max(16, Math.round(br.width * k)), ch = Math.max(16, Math.round(br.height * k));
    if (comp.width !== cw || comp.height !== ch) { comp.width = cw; comp.height = ch; scrTex.dispose(); }
    const asp = br.width / br.height; if (Math.abs(asp - G.aspect) > 0.01) { G.aspect = asp; sizeScreen(asp); }
  }
  function drawGame(w) {
    if (!G.rect) return; const R = G.rect, sx = comp.width / R.width, sy = comp.height / R.height;
    cg.imageSmoothingEnabled = false; cg.fillStyle = '#000'; cg.fillRect(0, 0, comp.width, comp.height);
    for (const { c } of G.cvs) { const r = c.getBoundingClientRect(); try { cg.drawImage(c, (r.left - R.left) * sx, (r.top - R.top) * sy, r.width * sx, r.height * sy); } catch (e) {} }
    scrTex.needsUpdate = true; S.texUploads++; }
  S.debugPixel = (u, v) => { const p = cg.getImageData(Math.min(comp.width - 1, u * comp.width | 0), Math.min(comp.height - 1, v * comp.height | 0), 1, 1).data; return [p[0], p[1], p[2]]; };
  S.compHash = () => { const d = cg.getImageData(0, 0, comp.width, comp.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; };

  // ---------- events into the game iframe ----------
  function sendKey(w, type, code) {
    try { const d = w.document, ev = new w.KeyboardEvent(type, { key: KEYNAME[code] || code, code, bubbles: true, cancelable: true, composed: true });
      Object.defineProperty(ev, 'keyCode', { get: () => KEYCODE[code] || 0 }); Object.defineProperty(ev, 'which', { get: () => KEYCODE[code] || 0 });
      const t = d.activeElement && d.activeElement !== d.body && d.activeElement.tagName !== 'IFRAME' ? d.activeElement : (d.body || d.documentElement); t.dispatchEvent(ev);
      S.keysSent++; S.lastKey = type + ':' + code; } catch (e) {} }
  function hold(code, on, w) { const was = !!S.held[code]; if (was === !!on) return; if (on) S.held[code] = 1; else delete S.held[code]; if (w) sendKey(w, on ? 'keydown' : 'keyup', code); }
  function releaseAll() { const w = gameWin(); for (const c of Object.keys(S.held)) hold(c, false, w); if (G.ptrDown && w) sendPtr(w, 'pointerup', G.pu, G.pv); G.ptrDown = false; }
  function sendPtr(w, type, u, v) {
    if (!G.rect) return; try { const d = w.document, R = G.rect, x = R.left + u * R.width, y = R.top + (1 - v) * R.height, t = d.elementFromPoint(x, y) || G.cvs[0].c, down = type !== 'pointerup';
      const base = { clientX: x, clientY: y, screenX: x, screenY: y, bubbles: true, cancelable: true, composed: true, button: 0, buttons: down ? 1 : 0, view: w };
      t.dispatchEvent(new w.PointerEvent(type, Object.assign({ pointerId: 41, pointerType: 'touch', isPrimary: true, width: 8, height: 8, pressure: down ? 0.5 : 0 }, base)));
      const mt = { pointerdown: 'mousedown', pointermove: 'mousemove', pointerup: 'mouseup' }[type]; t.dispatchEvent(new w.MouseEvent(mt, base));
      try { const tt = { pointerdown: 'touchstart', pointermove: 'touchmove', pointerup: 'touchend' }[type], touch = new w.Touch({ identifier: 41, target: t, clientX: x, clientY: y });
        t.dispatchEvent(new w.TouchEvent(tt, { bubbles: true, cancelable: true, composed: true, touches: down ? [touch] : [], targetTouches: down ? [touch] : [], changedTouches: [touch] })); } catch (e) {}
      if (type === 'pointerup') t.dispatchEvent(new w.MouseEvent('click', base));
      S.ptrSent++; G.pu = u; G.pv = v; } catch (e) {} }

  // ---------- input ----------
  const IN = { left: null, right: null };
  function readPad(src, prev) {
    const gp = src.gamepad, b = i => !!(gp && gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.75)), ax = gp ? gp.axes : [];
    const sx = ax.length >= 4 ? ax[2] : (ax[0] || 0), sy = ax.length >= 4 ? ax[3] : (ax[1] || 0);
    const cur = { trig: b(0), grip: b(1), a: b(4), b: b(5), stick: b(3), x: Math.abs(sx) > 0.08 ? sx : 0, y: Math.abs(sy) > 0.08 ? sy : 0, src };
    for (const k of ['trig', 'grip', 'a', 'b']) cur[k + 'Down'] = cur[k] && !(prev && prev[k]);
    return cur; }
  function poll() { const L = IN.left, R = IN.right; IN.left = IN.right = null;
    const ss = session && session.inputSources; if (!ss) return;
    for (const src of ss) { if (!src.gamepad || (src.handedness !== 'left' && src.handedness !== 'right')) continue; IN[src.handedness] = readPad(src, src.handedness === 'left' ? L : R); } }
  function ctrlFor(hand) { for (const c of ctrls) if (c.userData.hand === hand) return c; return null; }
  function pulse(src, k = 0.5, ms = 30) { try { const h = src && src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators[0]; if (h && h.pulse) h.pulse(k, ms); } catch (e) {} }
  function rayOf(c) { c.updateMatrixWorld(true); _o.setFromMatrixPosition(c.matrixWorld); c.getWorldQuaternion(_q); _d.set(0, 0, -1).applyQuaternion(_q).normalize(); _ray.set(_o, _d); return _ray; }

  // ---------- rig: the player's place in the arcade = an offset reference space ----------
  function applyRig() { if (!baseRef || typeof XRRigidTransform === 'undefined') return; const r = S.rig;
    const t = new XRRigidTransform({ x: r.x, y: r.y, z: r.z, w: 1 }, { x: 0, y: Math.sin(r.yaw / 2), z: 0, w: Math.cos(r.yaw / 2) });
    try { renderer.xr.setReferenceSpace(baseRef.getOffsetReferenceSpace(t.inverse)); } catch (e) { S.lastError = String(e); } }
  function moveRig(dx, dz, dy = 0) { if (!dx && !dz && !dy) return; S.rig.x += dx; S.rig.z += dz; S.rig.y += dy; if (S.head) { S.head.x += dx; S.head.z += dz; S.head.y += dy; } S.rigDirty = true; }
  function turnRig(a) { const r = S.rig, h = S.head || { x: r.x, z: r.z }, c = Math.cos(a), s = Math.sin(a), ox = r.x - h.x, oz = r.z - h.z;
    r.x = h.x + ox * c + oz * s; r.z = h.z - ox * s + oz * c; r.yaw += a; if (S.head) S.head.yaw += a; S.rigDirty = true; }
  S.applyRig = applyRig; S.turn = a => { turnRig(a); applyRig(); };

  // ---------- cabinets you can point at ----------
  const boxes = new Map();
  function boxOf(c) { let b = boxes.get(c); if (!b) { b = new THREE.Box3().setFromObject(c); boxes.set(c, b); } return b; }
  function machineOf(c) { return Object.values(play.machines || {}).find(m => m.cab === c) || null; }
  function pickCab(ray) { let best = null, bd = RAY_MAX; for (const c of A.playables) { if (!c || !machineOf(c)) continue; const p = ray.intersectBox(boxOf(c), _hit); if (!p) continue; const d = p.distanceTo(ray.origin); if (d < bd) { bd = d; best = { cab: c, d, p: p.clone() }; } } return best; }
  function startCab(cab, p) {
    const m = machineOf(cab); if (!m || play.mode !== 'walk') return false;
    if (m.key === 'roadster' && cab.userData.seats) { const seat = p && p.x < cab.position.x ? 'L' : 'R'; cab.userData.seat = seat; cab.userData.screen = cab.userData.screens[seat === 'L' ? 0 : 1]; }
    releaseAll(); G.placed = false; play.start(m); if (play.mode === 'walk') return false; S.launches++; S.lastLaunch = m.key; return true; }
  S.startCab = startCab; S.machineOf = machineOf; S.pickCab = pickCab;
  function tryTeleport(p) { const q = new THREE.Vector3(p.x, monkey.position.y, p.z); A.collide(q); if (Math.hypot(q.x - p.x, q.z - p.z) > 0.35) return false;
    const h = S.head || { x: monkey.position.x, z: monkey.position.z }; moveRig(q.x - h.x, q.z - h.z); monkey.position.x = q.x; monkey.position.z = q.z; st.vel.set(0, 0, 0); S.teleports++; return true; }
  S.teleport = tryTeleport;

  // ---------- session ----------
  renderer.xr.addEventListener('sessionstart', () => {
    session = renderer.xr.getSession(); renderer.xr.setReferenceSpace(null); baseRef = renderer.xr.getReferenceSpace();
    S.presenting = true; S.starts++; st.vr = true; st.vrMove = null; S.head = null; S.posed = false; IN.left = IN.right = null;
    saved = { fov: camera.fov, aspect: camera.aspect, near: camera.near, far: camera.far, zoom: camera.zoom };
    for (const k in A.keys) A.keys[k] = false; st.joy.on = false; st.joy.x = st.joy.y = 0;
    S.rig = { x: monkey.position.x, y: monkey.position.y, z: monkey.position.z, yaw: st.yaw }; applyRig();
    try { renderer.xr.setFoveation(1); } catch (e) {}
    document.body.classList.add('vr'); hud.visible = true;
    renderer.setAnimationLoop((t, f) => A.frame(t, f));
  });
  renderer.xr.addEventListener('sessionend', () => {
    renderer.setAnimationLoop(null); releaseAll();
    S.presenting = false; S.ends++; st.vr = false; st.vrMove = null; session = null;
    if (S.head) st.yaw = S.head.yaw; st.camInit = false; monkey.visible = true;
    renderer.xr.setReferenceSpace(null); baseRef = null;
    if (saved) { Object.assign(camera, saved); camera.updateProjectionMatrix(); }
    document.body.classList.remove('vr'); hud.visible = scr.visible = dot.visible = tpRing.visible = false;
    for (const f of document.querySelectorAll('iframe')) try { f.contentWindow.__gaVRPump && f.contentWindow.__gaVRPump(); } catch (e) {}   // hand frames back to the normal rAF
    A.resumeFlat();
  });

  function pump() { const gf = play.frame; for (const f of document.querySelectorAll('iframe')) { if (f !== gf && (S.frames & 1)) continue;
    try { const w = f.contentWindow; if (w && w.__gaVRPump) S.pumps += w.__gaVRPump(); } catch (e) {} } }

  // ---------- per frame: before the arcade step (input -> movement) ----------
  function pre(dt, xf) {
    S.frames++; poll(); if (S.rigDirty) { applyRig(); S.rigDirty = false; }
    const ref = renderer.xr.getReferenceSpace(), vp = xf && ref ? xf.getViewerPose(ref) : null;
    if (vp) { const p = vp.transform.position, o = vp.transform.orientation; _e.setFromQuaternion(_q.set(o.x, o.y, o.z, o.w), 'YXZ'); S.head = { x: p.x, y: p.y, z: p.z, yaw: _e.y, pitch: _e.x }; S.posed = true; }
    const walk = play.mode === 'walk' && !(A.tp && A.tp.locked) && !(A.shop && A.shop.open);
    S.walkStart = null; st.vrMove = null;
    if (!walk || !S.head) return;
    // roomscale: your real steps move the player too, through the same collision (a wall or cabinet pushes the world back)
    const h = S.head, q = _v.set(h.x, monkey.position.y, h.z); A.collide(q); moveRig(q.x - h.x, q.z - h.z); monkey.position.x = q.x; monkey.position.z = q.z;
    const L = IN.left, R = IN.right;
    if (R) { if (Math.abs(R.x) > 0.7 && S.snapArmed !== false) { turnRig(R.x > 0 ? -SNAP : SNAP); S.snapArmed = false; S.snaps++; pulse(R.src, 0.25, 20); } else if (Math.abs(R.x) < 0.3) S.snapArmed = true; }
    st.yaw = S.head.yaw; st.vrMove = L ? { x: L.x, y: L.y, speed: SPEED } : null;
    S.walkStart = { x: monkey.position.x, z: monkey.position.z };
  }

  // ---------- per frame: after the arcade step (follow the player, rays, the game screen, HUD) ----------
  function post(dt) {
    if (S.walkStart) { moveRig(monkey.position.x - S.walkStart.x, monkey.position.z - S.walkStart.z, monkey.position.y - S.rig.y); }
    monkey.visible = false;
    const mode = play.mode, inGame = mode === 'game', L = IN.left, R = IN.right;
    dot.visible = false; tpRing.visible = false; S.hover = null;
    // rays
    let aimScreen = null;
    for (const c of ctrls) { const ray = c.userData.ray; if (!c.userData.src) { ray.visible = false; continue; } ray.visible = true; ray.scale.z = 3; ray.material.color.setHex(0x3ff3ff); }
    const order = [['right', R], ['left', L]];
    if (mode === 'walk') {
      for (const [hand, P] of order) { const c = ctrlFor(hand); if (!c || !P) continue; const ray = rayOf(c), hit = pickCab(ray);
        if (hit) { c.userData.ray.scale.z = hit.d; c.userData.ray.material.color.setHex(0xffe14a); if (!S.hover) S.hover = { cab: hit.cab, m: machineOf(hit.cab), hand }; dot.position.copy(hit.p); dot.visible = true;
          if (P.trigDown) { pulse(P.src, 0.6, 40); startCab(hit.cab, hit.p); } continue; }
        const gy = monkey.position.y; if (ray.direction.y < -0.05) { const t = (gy - ray.origin.y) / ray.direction.y; if (t > 0 && t < RAY_MAX) { const p = ray.at(t, _hit); c.userData.ray.scale.z = t;
          const q = new THREE.Vector3(p.x, gy, p.z); A.collide(q); const ok = Math.hypot(q.x - p.x, q.z - p.z) <= 0.35;
          if (hand === 'right' || !tpRing.visible) { tpRing.position.set(p.x, gy + 0.02, p.z); tpRing.visible = true; ringMat.color.setHex(ok ? 0x3ff3ff : 0xff3040); }
          c.userData.ray.material.color.setHex(ok ? 0x3ff3ff : 0xff3040);
          if (P.trigDown && ok) { tryTeleport(p); pulse(P.src, 0.3, 25); } } }
      }
    }
    // the game screen
    if (inGame && !G.placed) placeScreen();
    scr.visible = inGame;
    const w = inGame ? gameWin() : null;
    if (inGame) {
      pump();
      if (w) { try { if (!G.rect || S.frames - G.layoutT > 30) { G.layoutT = S.frames; layout(w); } drawGame(w); } catch (e) {} }
      scr.updateMatrixWorld(true);
      for (const [hand, P] of order) { const c = ctrlFor(hand); if (!c || !P) continue; const ray = rayOf(c);
        const n = _v.set(0, 0, 1).applyQuaternion(scr.getWorldQuaternion(_q)), denom = n.dot(ray.direction); if (Math.abs(denom) < 1e-4) continue;
        const t = _hit.copy(scr.position).sub(ray.origin).dot(n) / denom; if (t <= 0 || t > RAY_MAX) continue;
        const p = ray.at(t, new THREE.Vector3()), lp = scr.worldToLocal(p.clone()), u = lp.x / G.w + 0.5, v = lp.y / G.h + 0.5;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        c.userData.ray.scale.z = t; c.userData.ray.material.color.setHex(0xff3fd2); if (!aimScreen) { aimScreen = { hand, u, v }; dot.position.copy(p); dot.visible = true; } }
      gameInput(w, aimScreen, dt);
    } else { if (Object.keys(S.held).length || G.ptrDown) releaseAll(); G.placed = false; G.rect = null; S.gripT = 0; }
    // HUD on the left controller (or under your view when there is none)
    const T = play.tickets ? play.tickets.total : 0, lc = ctrlFor('left') || ctrlFor('right');
    if (lc && lc.userData.src) { lc.updateMatrixWorld(true); hud.position.set(0, 0.07, 0.02).applyMatrix4(lc.matrixWorld); hud.quaternion.copy(lc.getWorldQuaternion(_q)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, 0, 0))); }
    else if (S.head) { const h = S.head; hud.position.set(h.x - Math.sin(h.yaw) * 0.7, h.y - 0.45, h.z - Math.cos(h.yaw) * 0.7); hud.rotation.set(-0.5, h.yaw, 0, 'YXZ'); }
    if (play.lastToast && play.lastToast !== S._toast) { S._toast = play.lastToast; S.msg = play.lastToast; S.msgT = 2.5; }
    S.msgT = Math.max(0, S.msgT - dt);
    const hv = S.hover && S.hover.m, cost = hv ? (hv.cost || 1) : 0;
    drawPanel(hud, [T + (T === 1 ? ' TICKET' : ' TICKETS'), S.msgT > 0 ? S.msg : hv ? 'TRIGGER: PLAY ' + (NAMES[hv.key] || hv.key.toUpperCase()) + ' · ' + cost + (cost === 1 ? ' TICKET' : ' TICKETS') : inGame ? 'HOLD GRIP TO LEAVE' : 'TRIGGER: TELEPORT / PLAY']);
    if (inGame) { const m = play.cur, sub = play.sub, map = MAPS[m && m.key] || MAPS.default, c = m ? (m.cost || 1) : 0;
      const top = sub === 'demo' ? (m.credits > 0 ? 'A: START  ·  CREDIT ' + m.credits : (T >= c ? 'A: INSERT ' + c + ' TICKET' + (c > 1 ? 'S' : '') : 'NEED ' + c + ' TICKETS · YOU HAVE ' + T)) : contCan(w) ? 'B/Y: CONTINUE · ' + play.continueCost + ' TICKETS' : map.help;
      drawPanel(bar, [S.msgT > 0 ? S.msg : top, T + ' TICKETS  ·  HOLD GRIP TO LEAVE'], { c0: '#ffffff', border: '#ff3fd2' }); }
  }
  function contCan(w) { try { const C = w && w.__gaContinue, m = play.cur; return !!(play.sub === 'play' && m && m.cont && C && C.can && C.can()); } catch (e) { return false; } }

  function gameInput(w, aim, dt) {
    const L = IN.left, R = IN.right, m = play.cur, map = MAPS[m && m.key] || MAPS.default;
    // HOLD GRIP (either hand) = leave the machine
    const grip = (L && L.grip) || (R && R.grip); S.gripT = grip ? (S.gripT || 0) + dt : 0;
    if (S.gripT >= GRIP_EXIT_S) { S.gripT = 0; releaseAll(); pulse((L && L.grip ? L : R).src, 0.8, 60); play.exit('vr'); S.exits++; return; }
    if (!w || play.mode !== 'game') return;
    const any = k => !!((L && L[k]) || (R && R[k]));
    if (play.sub === 'demo') {   // attract screen: A / X / trigger = insert the ticket price, then start
      if (any('aDown') || any('trigDown')) { const before = m.credits; if (m.credits < 1) play.insertTicket(); else play.tryPlay(); if (m.credits !== before || play.sub === 'play') pulse(((R && (R.aDown || R.trigDown)) ? R : L).src, 0.5, 40); }
      if (Object.keys(S.held).length) releaseAll(); return; }
    if (play.sub !== 'play') return;
    // sticks -> arrow keys (whichever stick is pushed further)
    const sx = [L, R].reduce((a, P) => P && Math.hypot(P.x, P.y) > Math.hypot(a.x, a.y) ? P : a, { x: 0, y: 0 });
    const th = (code, v) => S.held[code] ? v > 0.3 : v > 0.55;
    hold('ArrowLeft', th('ArrowLeft', -sx.x), w); hold('ArrowRight', th('ArrowRight', sx.x), w); hold('ArrowUp', th('ArrowUp', -sx.y), w); hold('ArrowDown', th('ArrowDown', sx.y), w);
    // B / Y: CONTINUE when the game offers it, otherwise the game's secondary button
    const canC = contCan(w);
    if (canC && any('bDown')) play.tryContinue();
    for (const k of map.b) hold(k, !canC && any('b'), w);
    // trigger: tap the screen where you point (pointer games) or the primary button
    let trigAsA = map.trig === 'a';
    if (map.trig === 'ptr') { const tr = (R && R.trig) || (L && L.trig);
      if (aim && tr) { if (!G.ptrDown) { sendPtr(w, 'pointerdown', aim.u, aim.v); G.ptrDown = true; } else sendPtr(w, 'pointermove', aim.u, aim.v); }
      else if (G.ptrDown) { sendPtr(w, 'pointerup', aim ? aim.u : G.pu, aim ? aim.v : G.pv); G.ptrDown = false; }
      if (!aim) trigAsA = true; }
    const prim = any('a') || (trigAsA && any('trig'));
    for (const k of map.a) hold(k, prim, w);
  }
  S.sendKey = (code, type) => { const w = gameWin(); if (w) sendKey(w, type, code); };
  S.state = () => ({ presenting: S.presenting, rig: { ...S.rig }, head: S.head && { ...S.head }, mode: play.mode, sub: play.sub, cur: play.cur && play.cur.key, screen: scr.visible, held: Object.keys(S.held), keysSent: S.keysSent, ptrSent: S.ptrSent, texUploads: S.texUploads, launches: S.launches, exits: S.exits, teleports: S.teleports, snaps: S.snaps, pumps: S.pumps, hover: S.hover && S.hover.m && S.hover.m.key, monkey: [monkey.position.x, monkey.position.y, monkey.position.z], comp: [comp.width, comp.height], err: S.lastError || null });
  return { pre, post, S };
}
