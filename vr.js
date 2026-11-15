// Galactic Arcade VR - WebXR for Meta Quest Browser (and any WebXR headset).
// ENTER VR on the arcade floor -> the headset is the camera at real-world scale (1 unit = 1 m; cabinets are life size).
//   LEFT STICK   smooth walk where you look (same wall / cabinet collision as the flat game)
//   RIGHT STICK  left/right = smooth turn; the further you push, the faster (deadzone 0.15, x^2 curve, max 90 deg/s) (t350u)
//   TRIGGER      point at a cabinet = play it; point at the floor = teleport there; point at a sign / menu button = press it
//   Y / B        MENU: BEAM TO SHOP / ARCADE (teleporter), BUY TICKETS (ticket exchange), PRIZE SHOP, NEON BRICKS
//   signs        BUY TICKETS over the kiosk, BEAM TO SHOP / ARCADE over each teleporter pad, PRIZE SHOP over the shop counter,
//                NEON BRICKS by the window game (point at the window + trigger = play; sticks move, A/X/trigger rotate, B/Y drop, hold grip = leave)
//   in a game    the cabinet's game shows on a big screen in front of you. A/X = insert tickets / start, then the
//                game's buttons (sticks = arrows, A/X = fire / primary, B/Y = secondary or CONTINUE, trigger = fire or tap
//                the screen where you point), HOLD GRIP = leave the machine.
// The player rig is an offset XR reference space (renderer.xr.setReferenceSpace), so camera.position and the controller
// objects stay in world coordinates for the rest of the arcade code.
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const NAMES = { strike: 'STRIKE', ghost: 'GHOST 256', monkey: 'MONKEY CROSSING', berserker: 'BERSERKER', orc: 'ORC ATTACK', cyber: 'CYBERCITY', blaster: 'BLASTER', pip: 'SUPER PIP QUEST', bb: 'BURROW BUSTER', rockfall: 'ROCKFALL RUSH', skytower: 'SKY TOWER', nova: 'NOVA TETHER', claw: 'CLAW MACHINE', roadster: 'MARS ROADSTER', ds: 'DEAD SIGNAL' };
const SIGN_MAX = 30, TURN_DZ = 0.15, TURN_MAX = Math.PI / 2, SPEED = 2.2, RAY_MAX = 12, GRIP_EXIT_S = 0.6;
const KEYNAME = { KeyL: 'l', KeyB: 'b', KeyO: 'o', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', Space: ' ', Enter: 'Enter', KeyZ: 'z', KeyX: 'x', KeyP: 'p', KeyJ: 'j', KeyF: 'f', KeyE: 'e', ShiftLeft: 'Shift' };
const KEYCODE = { KeyL: 76, KeyB: 66, KeyO: 79, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Space: 32, Enter: 13, KeyZ: 90, KeyX: 88, KeyP: 80, KeyJ: 74, KeyF: 70, KeyE: 69, ShiftLeft: 16 };
// what each cabinet's buttons send into its game iframe (a = A/X, b = B/Y; trig: 'a' = same as A, 'ptr' = tap the screen where the ray points)
const MAPS = {
  strike: { a: ['KeyZ'], b: ['KeyX'], trig: 'a', help: 'STICK FLY · A/X/TRIGGER FIRE · B/Y BOMB' },
  // t353u: Berserker's power-ups are HTML buttons on the right that appear when ready (THOR at 100 energy, BERSERK and ODIN after their timers).
  // VR: A/B/trigger only on the RIGHT controller (attack / dash); each power-up gets its own free button, shown on a button beside the screen on the right.
  berserker: { a: ['KeyJ'], b: ['Space'], trig: 'a', handAB: 'right', help: 'STICK MOVE · A/TRIGGER ATTACK · B DASH',
    pw: [{ id: 'thor', name: 'THOR', code: 'KeyL', btn: 'X', el: 'thor' }, { id: 'rage', name: 'BERSERK', code: 'KeyB', btn: 'Y', el: 'bRg' }, { id: 'odin', name: 'ODIN', code: 'KeyO', btn: 'R-GRIP TAP', el: 'bOd' }] },
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
    presenting: false, supported: false, pwFired: {}, pwShown: {}, mirrorKicks: 0, wardPicks: 0, wardBuys: 0, starts: 0, ends: 0, frames: 0, snaps: 0, turnRate: 0, turnSum: 0, turnTime: 0, turnMaxStep: 0, beams: 0, ticketBuys: 0, collected: 0, shopBuys: 0, nbStarts: 0, nbRot: 0, nbDrops: 0, nbExits: 0, panels: {}, teleports: 0, launches: 0, exits: 0, keysSent: 0, ptrSent: 0, texUploads: 0, pumps: 0,
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
  const pwM = {};   // power-up buttons (right of the screen), one per power-up of the current game
  function pwMesh(p, i) { let m = pwM[p.id]; if (!m) { m = pwM[p.id] = panel(0.5, 0.17, 512, 174); m.name = 'vrPower_' + p.id; m.renderOrder = 1001; scr.add(m); drawPanel(m, [p.name, 'PRESS ' + p.btn], { c0: '#ffe14a', border: '#ffe14a' }); }
    m.position.set(G.w / 2 + 0.33, G.h / 2 - 0.1 - i * 0.21, 0.002); return m; }
  S.screen = scr; S.comp = comp;
  function placeScreen() {
    const h = S.head || { x: monkey.position.x, y: 1.6, z: monkey.position.z, yaw: st.yaw }, d = 1.55;
    scr.position.set(h.x - Math.sin(h.yaw) * d, Math.max(1.0, h.y - 0.08), h.z - Math.cos(h.yaw) * d); scr.rotation.set(0, h.yaw, 0); G.placed = true; }
  function sizeScreen(aspect) { const maxW = 1.7, maxH = 1.25; let hh = maxH, ww = hh * aspect; if (ww > maxW) { ww = maxW; hh = ww / aspect; }
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

  // ---------- t350u: VR panels (ticket exchange, prize shop, menu) pressed with the ray + trigger ----------
  // The flat game uses HTML overlays for these (VR can't click them), so VR draws its own panel and calls the SAME functions:
  // kiosk.buy(i) / collect the dispensed tickets (play.addTickets), shop.buy(id), tp.go() (teleporter).
  const UI = { open: null, page: 0, msg: '', msgT: 0, btns: [], hover: null, key: '' };
  const uiM = panel(1.0, 0.75, 1024, 768); uiM.name = 'vrMenu'; uiM.renderOrder = 1003; uiM.visible = false; scene.add(uiM);
  const kiosk = () => window.__kiosk || null, nbApi = () => A.nb || null;
  function uiOpen(kind) { const h = S.head || { x: monkey.position.x, y: 1.6, z: monkey.position.z, yaw: st.yaw }, d = 0.9;
    UI.open = kind; UI.page = 0; UI.msg = ''; UI.msgT = 0; UI.key = '';
    uiM.position.set(h.x - Math.sin(h.yaw) * d, Math.max(0.9, h.y - 0.12), h.z - Math.cos(h.yaw) * d); uiM.rotation.set(0, h.yaw, 0); uiM.visible = true; uiM.updateMatrixWorld(true);
    S.panels[kind] = (S.panels[kind] || 0) + 1; }
  function uiClose() { UI.open = null; uiM.visible = false; UI.btns = []; }
  function say(m) { UI.msg = m; UI.msgT = 3; }
  function beam() { const tp = A.tp; if (!tp || tp.state !== 'idle' || play.mode !== 'walk') return false; uiClose(); tp.go(); S.beams++; return true; }
  function collect() { const K = kiosk(); if (!K || !K.pending || K.dispK < 1) return false; const n = K.pending;
    K.setState({ bal: K.C.bal, at: K.C.at, pending: 0 }); play.addTickets(n); K.pocketed = (K.pocketed || 0) + n; S.collected += n; say('+' + n + ' TICKETS COLLECTED'); return true; }
  function nbStart() { const n = nbApi(); if (!n || n.playing || play.mode !== 'walk' || (A.tp && A.tp.locked)) return false; uiClose(); n.start(); if (n.playing) { S.nbStarts++; try { n.setZoomAmt(0); } catch (e) {} } return n.playing; }
  S.ui = { open: k => uiOpen(k), close: uiClose, nb: () => nbApi(), tp: () => A.tp, shop: () => A.shop, get kind() { return UI.open; }, get btns() { return UI.btns.map(b => ({ id: b.id, label: b.label, on: b.on })); }, beam, collect, nbStart,
    // world point of a button (tests aim the ray at it)
    btnWorld(id) { const b = UI.btns.find(q => q.id === id); if (!b) return null; uiM.updateMatrixWorld(true); const p = new THREE.Vector3(((b.x + b.w / 2) / 1024 - 0.5) * 1.0, (0.5 - (b.y + b.h / 2) / 768) * 0.75, 0); return uiM.localToWorld(p).toArray(); } };
  function uiSpec() {
    const B = [], add = (id, label, x, y, w, h, on, act) => B.push({ id, label, x, y, w, h, on: on !== false, act });
    let title = '', sub = '';
    add('close', 'X', 900, 22, 100, 90, true, uiClose);
    if (UI.open === 'tickets') { const K = kiosk(); title = 'TICKET EXCHANGE';
      if (!K) sub = 'NOT READY'; else { const bal = K.C.bal, left = Math.max(0, Math.ceil((K.C.at + 36e5 - Date.now()) / 6e4));
        sub = 'CASH $' + bal + (bal < 5 ? '  ·  +$' + (5 - bal) + ' IN ' + left + ' MIN' : '');
        (K.offers || []).forEach(([d, t], i) => add('offer' + i, '$' + d + '  =  ' + t + ' TICKETS', 112, 190 + i * 118, 800, 100, bal >= d, () => { if (K.buy(i)) { S.ticketBuys++; say('+' + t + ' TICKETS · DISPENSING...'); } else say('NOT ENOUGH CASH'); }));
        if (K.pending) add('collect', K.dispK >= 1 ? 'COLLECT ' + K.pending + ' TICKETS' : 'DISPENSING ' + K.pending + ' TICKETS...', 112, 548, 800, 100, K.dispK >= 1, collect); } }
    else if (UI.open === 'shop') { const sh = A.shop; title = 'GROK PRIZE SHOP';
      if (!sh) sub = 'THE SHOP IS LOADING'; else { const b = sh.balance(), per = 4, items = sh.ITEMS || [], pages = Math.max(1, Math.ceil(items.length / per)); UI.page = Math.min(UI.page, pages - 1);
        sub = 'YOU HAVE ' + b + ' TICKETS  ·  PAGE ' + (UI.page + 1) + '/' + pages;
        items.slice(UI.page * per, UI.page * per + per).forEach((it, i) => add('item_' + it.id, it.name.toUpperCase() + '  ·  ' + it.price, 40, 190 + i * 112, 944, 96, b >= it.price, () => { if (sh.buy(it.id)) { S.shopBuys++; say('GOT IT: ' + it.name.toUpperCase()); } else say('NEED ' + it.price + ' TICKETS · YOU HAVE ' + sh.balance()); }));
        add('prev', '<', 40, 640, 150, 96, UI.page > 0, () => { UI.page--; }); add('next', '>', 834, 640, 150, 96, UI.page < pages - 1, () => { UI.page++; }); } }
    else if (UI.open === 'ward') { const gp = window.__gaPlayer; title = 'ACCESSORIES';
      if (!gp || !gp.allOpts) sub = 'NOT READY'; else {
        const cats = ['hat', 'glasses', 'back', 'hand', 'hoodie', 'suit', 'fur', 'shoes'].filter(k => gp.allOpts[k] && gp.allOpts[k].length); if (!cats.includes(UI.cat)) UI.cat = cats[0];
        const k = UI.cat, L = gp.allOpts[k], per = 6, pages = Math.max(1, Math.ceil(L.length / per)), bal = gp.balance(); UI.page = Math.min(UI.page, pages - 1);
        sub = 'YOU HAVE ' + bal + ' TICKETS  ·  ' + k.toUpperCase() + ' ' + (UI.page + 1) + '/' + pages;
        cats.forEach((c, i) => add('cat_' + c, c === k ? '> ' + c.toUpperCase() + ' <' : c.toUpperCase(), 40 + (i % 4) * 240, 165 + Math.floor(i / 4) * 70, 224, 60, true, () => { UI.cat = c; UI.page = 0; }));
        const nm = v => String(v).replace(/^suit(?=.)/, 'suit ').toUpperCase();
        L.slice(UI.page * per, UI.page * per + per).forEach(([v], i) => { const own = gp.has(k, v), on = gp.p[k] === v, pr = gp.priceOf(k, v);
          add('w_' + k + '_' + v, nm(v) + (on ? '  ·  ON' : own ? '' : '  ·  ' + pr + ' TICKETS'), 40 + (i % 2) * 484, 345 + Math.floor(i / 2) * 95, 460, 85, own || bal >= pr, () => {
            if (own) { gp.pick(k, v); S.wardPicks++; say(v === 'none' ? 'REMOVED' : 'WEARING ' + nm(v)); }
            else { gp.tryOn(k, v); if (gp.buy()) { S.wardBuys++; S.wardPicks++; say('BOUGHT · WEARING ' + nm(v)); } else { if (gp.wardrobe) gp.wardrobe.try = null; say('NEED ' + pr + ' TICKETS'); } } }); });
        if (L.some(a => a[0] === 'none')) add('remove', 'REMOVE ' + k.toUpperCase(), 230, 640, 564, 96, gp.p[k] !== 'none', () => { gp.pick(k, 'none'); S.wardPicks++; say('REMOVED'); });
        add('prev', '<', 40, 640, 170, 96, UI.page > 0, () => { UI.page--; }); add('next', '>', 814, 640, 170, 96, UI.page < pages - 1, () => { UI.page++; }); } }
    else if (UI.open === 'menu') { const tp = A.tp, inShop = tp && tp.where === 2; title = 'MENU';
      add('beam', inShop ? 'BEAM TO ARCADE' : 'BEAM TO SHOP', 112, 160, 800, 100, !!tp && tp.state === 'idle', beam);
      if (!inShop) { add('tickets', 'BUY TICKETS', 112, 275, 800, 100, !!kiosk(), () => uiOpen('tickets')); add('nb', 'PLAY NEON BRICKS', 112, 390, 800, 100, !!nbApi(), nbStart); }
      else add('shop', 'PRIZE SHOP', 112, 275, 800, 100, !!A.shop, () => uiOpen('shop'));
      add('ward', 'ACCESSORIES', 112, inShop ? 390 : 505, 800, 100, !!window.__gaPlayer, () => uiOpen('ward'));
      add('close2', 'CLOSE', 112, 620, 800, 100, true, uiClose); }
    return { title, sub, B }; }
  function uiDraw() { const sp = uiSpec(); UI.btns = sp.B; const msg = UI.msgT > 0 ? UI.msg : '';
    const key = sp.title + '|' + sp.sub + '|' + msg + '|' + UI.hover + '|' + sp.B.map(b => b.id + b.label + b.on).join(','); if (key === UI.key) return; UI.key = key;
    const { cv, g, tex } = uiM.userData; g.clearRect(0, 0, 1024, 768);
    g.fillStyle = 'rgba(10,6,24,0.92)'; g.strokeStyle = '#3ff3ff'; g.lineWidth = 8; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 1016, 760, 40) : g.rect(4, 4, 1016, 760); g.fill(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe14a'; g.font = '900 64px "Arial Black", Arial, sans-serif'; g.fillText(sp.title, 470, 70, 820);
    g.fillStyle = '#9ff8ff'; g.font = '900 34px "Arial Black", Arial, sans-serif'; g.fillText(sp.sub, 512, 140, 960);
    for (const b of sp.B) { const hv = UI.hover === b.id && b.on; g.fillStyle = !b.on ? 'rgba(60,60,80,0.6)' : hv ? '#ff3fd2' : 'rgba(0,229,255,0.22)'; g.strokeStyle = b.on ? (hv ? '#ffffff' : '#3ff3ff') : '#555a70'; g.lineWidth = 6;
      g.beginPath(); g.roundRect ? g.roundRect(b.x, b.y, b.w, b.h, 24) : g.rect(b.x, b.y, b.w, b.h); g.fill(); g.stroke();
      g.fillStyle = b.on ? '#ffffff' : '#9097a8'; g.font = '900 ' + Math.round(Math.min(48, b.h * 0.42)) + 'px "Arial Black", Arial, sans-serif'; g.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2, b.w - 24); }
    if (msg) { g.fillStyle = '#ffe14a'; g.font = '900 38px "Arial Black", Arial, sans-serif'; g.fillText(msg, 512, UI.open === 'ward' ? 318 : UI.open === 'shop' ? 688 : 715, UI.open === 'ward' ? 940 : 640); }
    tex.needsUpdate = true; }
  function uiHit(ray) { if (!UI.open) return null; uiM.updateMatrixWorld(true);
    const n = _v.set(0, 0, 1).applyQuaternion(uiM.getWorldQuaternion(_q)), den = n.dot(ray.direction); if (Math.abs(den) < 1e-4) return null;
    const t = _hit.copy(uiM.position).sub(ray.origin).dot(n) / den; if (t <= 0 || t > RAY_MAX) return null;
    const p = ray.at(t, new THREE.Vector3()), lp = uiM.worldToLocal(p.clone()), x = (lp.x / 1.0 + 0.5) * 1024, y = (0.5 - lp.y / 0.75) * 768;
    if (x < 0 || x > 1024 || y < 0 || y > 768) return null;
    return { t, p, btn: UI.btns.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null }; }

  // exact ray hit on a flat panel (PlaneGeometry w x h, any scale / parent): distance or null
  const _rn = new THREE.Vector3(), _rp = new THREE.Vector3(), _rq = new THREE.Quaternion(), _rs = new THREE.Vector3();
  function rectHit(ray, m, max = SIGN_MAX) { if (!m.visible) return null; for (let o = m.parent; o; o = o.parent) if (!o.visible) return null;
    m.updateMatrixWorld(true); m.matrixWorld.decompose(_rp, _rq, _rs); _rn.set(0, 0, 1).applyQuaternion(_rq); const den = _rn.dot(ray.direction); if (Math.abs(den) < 1e-5) return null;
    const t = _hit.copy(_rp).sub(ray.origin).dot(_rn) / den; if (t <= 0 || t > max) return null;
    const lp = m.worldToLocal(ray.at(t, new THREE.Vector3())), gp = m.geometry.parameters || { width: 1, height: 1 };
    return Math.abs(lp.x) <= gp.width / 2 && Math.abs(lp.y) <= gp.height / 2 ? t : null; }
  S.rectHit = rectHit;
  // ---------- in-world signs (VR only): point + trigger ----------
  function makeSign(text, color) { const m = panel(0.95, 0.24, 512, 128); m.renderOrder = 1000; m.material.depthTest = true; drawPanel(m, [text], { c0: color || '#ffe14a', border: color || '#3ff3ff' }); m.visible = false; scene.add(m); return m; }
  const signs = [];
  function addSign(id, text, color, where, act, show) { const m = makeSign(text, color); m.name = 'vrSign_' + id; signs.push({ id, m, where, act, show }); return m; }
  const padTop = w => { const tp = A.tp; if (!tp) return null; const P = w === 1 ? tp.PAD1 : tp.PAD2; return [P.x, 2.05, P.z]; };
  addSign('tickets', 'BUY TICKETS', '#ffe14a', () => { const K = kiosk(); if (!K || !K.K) return null; const p = K.K.getWorldPosition(new THREE.Vector3()); return [p.x, 1.95, p.z]; }, () => uiOpen('tickets'), () => !!kiosk() && (!A.tp || A.tp.where === 1));
  addSign('beamShop', 'BEAM TO SHOP', '#3ff3ff', () => padTop(1), beam, () => A.tp && A.tp.where === 1 && A.tp.state === 'idle');
  addSign('beamArcade', 'BEAM TO ARCADE', '#3ff3ff', () => padTop(2), beam, () => A.tp && A.tp.where === 2 && A.tp.state === 'idle');
  addSign('shop', 'PRIZE SHOP', '#ff3fd2', () => { const g = A.shop && A.shop.grok; if (!g) return null; const p = g.getWorldPosition(new THREE.Vector3()); return [p.x, p.y + 2.3, p.z]; }, () => uiOpen('shop'), () => A.tp && A.tp.where === 2 && !!A.shop);
  const mirrorMesh = () => { const w = A.shop && A.shop.wardrobe; return (w && w.mirror && w.mirror.mesh) || null; };
  addSign('ward', 'ACCESSORIES', '#ff4fd8', () => { const m = mirrorMesh(); if (!m) return null; const p = m.getWorldPosition(new THREE.Vector3()); return [p.x, p.y + 1.35, p.z]; }, () => uiOpen('ward'), () => A.tp && A.tp.where === 2 && !!mirrorMesh() && !!window.__gaPlayer);
  addSign('nb', 'NEON BRICKS · PLAY', '#ff3fd2', () => { const n = nbApi(); if (!n || !n.grp) return null; const p = n.grp.getWorldPosition(new THREE.Vector3()); return [p.x - 1.1, 1.75, (n.grp.parent ? n.grp.parent.getWorldPosition(new THREE.Vector3()).z : 0)]; }, nbStart, () => { const n = nbApi(); return !!n && !n.playing && (!A.tp || A.tp.where === 1); });
  S.signs = () => signs.filter(g => g.m.visible).map(g => ({ id: g.id, at: g.m.position.toArray() }));
  const _sph = new THREE.Sphere(); let kioskBox = null;
  function nbBox() { const n = nbApi(); if (!n || !n.grp) return null; const p = n.grp.getWorldPosition(new THREE.Vector3()), z = n.grp.parent ? n.grp.parent.getWorldPosition(new THREE.Vector3()).z : 0;
    return new THREE.Box3(new THREE.Vector3(p.x - 0.55, 0.4, z - 1.95), new THREE.Vector3(p.x + 0.4, 7.8, z + 1.95)); }
  // the nearest thing the ray points at: a sign, the kiosk, the Neon Bricks window
  function pickTarget(ray) { let best = null; const take = (d, p, act, id, max = RAY_MAX) => { if (d < max && (!best || d < best.d)) best = { d, p: p.clone(), act, id }; };
    for (const g of signs) { if (!g.m.visible) continue; const t = rectHit(ray, g.m); if (t != null) take(t, ray.at(t, new THREE.Vector3()), g.act, g.id, SIGN_MAX); }
    const K = kiosk(); if (K && K.K && (!A.tp || A.tp.where === 1)) { if (!kioskBox) kioskBox = new THREE.Box3().setFromObject(K.K); const p = ray.intersectBox(kioskBox, _hit); if (p) take(p.distanceTo(ray.origin), p, () => uiOpen('tickets'), 'kiosk'); }
    const gk = A.shop && A.shop.grok; if (gk && A.tp && A.tp.where === 2) { gk.getWorldPosition(_sph.center); _sph.center.y += 1.0; _sph.radius = 0.9; const p = ray.intersectSphere(_sph, _hit); if (p) take(p.distanceTo(ray.origin), p, () => uiOpen('shop'), 'shop', SIGN_MAX); }   // the clerk himself
    const n = nbApi(); if (n && !n.playing && (!A.tp || A.tp.where === 1)) { const b = nbBox(); const p = b && ray.intersectBox(b, _hit); if (p) take(p.distanceTo(ray.origin), p, nbStart, 'nbWindow'); }
    return best; }
  function signsUpdate() { const h = S.head; for (const g of signs) { const show = S.presenting && g.show(); const w = show ? g.where() : null; g.m.visible = !!w;
    if (w) { g.m.position.set(w[0], w[1], w[2]); if (h) { g.m.rotation.set(0, Math.atan2(h.x - w[0], h.z - w[2]), 0); g.m.scale.setScalar(Math.min(3, Math.max(1, Math.hypot(h.x - w[0], h.z - w[2]) / 6))); } } } }   // far signs grow so they stay readable / easy to point at

  // ---------- never pitch black (t349u) ----------
  // A soft sky/ground fill light while in VR, so the room is always visible even if a tier drops lights or the room's own lights are culled.
  const fill = new THREE.HemisphereLight(0xc8d8ff, 0x403050, 0.9); fill.name = 'vrFill'; fill.visible = false; scene.add(fill); S.fill = fill;
  // Render-target probe: in VR every room draw must go into three's XR framebuffer, never the page canvas (that is what made the Quest black).
  S.rt = { xr: 0, bad: 0, last: '' };
  function rtCheck(rt) { if (rt && rt.isXRRenderTarget) S.rt.xr++; else { S.rt.bad++; S.rt.last = rt ? 'other' : 'null'; } }

  // ---------- session ----------
  renderer.xr.addEventListener('sessionstart', () => {
    session = renderer.xr.getSession(); renderer.xr.setReferenceSpace(null); baseRef = renderer.xr.getReferenceSpace();
    S.presenting = true; S.starts++; st.vr = true; st.vrMove = null; S.head = null; S.posed = false; IN.left = IN.right = null;
    saved = { fov: camera.fov, aspect: camera.aspect, near: camera.near, far: camera.far, zoom: camera.zoom };
    for (const k in A.keys) A.keys[k] = false; st.joy.on = false; st.joy.x = st.joy.y = 0;
    S.rig = { x: monkey.position.x, y: monkey.position.y, z: monkey.position.z, yaw: st.yaw }; applyRig();
    try { renderer.xr.setFoveation(1); } catch (e) {}
    document.body.classList.add('vr'); hud.visible = true; fill.visible = true; uiClose(); kioskBox = null;
    try { const n = nbApi(); if (n && n.playing) n.setZoomAmt(0); } catch (e) {}   // VR: Neon Bricks never zooms
    renderer.setAnimationLoop((t, f) => A.frame(t, f));
  });
  renderer.xr.addEventListener('sessionend', () => {
    renderer.setAnimationLoop(null); releaseAll();
    S.presenting = false; S.ends++; st.vr = false; st.vrMove = null; session = null;
    if (S.head) st.yaw = S.head.yaw; st.camInit = false; monkey.visible = true;
    renderer.xr.setReferenceSpace(null); baseRef = null;
    if (saved) { Object.assign(camera, saved); camera.updateProjectionMatrix(); }
    document.body.classList.remove('vr'); uiClose(); for (const g of signs) g.m.visible = false; fill.visible = false; hud.visible = scr.visible = dot.visible = tpRing.visible = false;
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
    S.turnRate = 0;
    S.walkStart = null; st.vrMove = null;
    if (!walk || !S.head) return;
    // roomscale: your real steps move the player too, through the same collision (a wall or cabinet pushes the world back)
    const h = S.head, q = _v.set(h.x, monkey.position.y, h.z); A.collide(q); moveRig(q.x - h.x, q.z - h.z); monkey.position.x = q.x; monkey.position.z = q.z;
    const L = IN.left, R = IN.right;
    const nbOn = !!(A.nb && A.nb.playing);
    // t350u smooth turn: rate = 90 deg/s * ((|x| - 0.15) / 0.85)^2, nothing inside the deadzone, no snapping. Off while Neon Bricks takes the sticks.
    if (R && !nbOn) { const ax = Math.abs(R.x);
      if (ax > TURN_DZ) { const k = Math.min(1, (ax - TURN_DZ) / (1 - TURN_DZ)), rate = -Math.sign(R.x) * TURN_MAX * k * k, a = rate * dt;
        turnRig(a); S.turnRate = rate; S.turnSum += Math.abs(a); S.turnTime += dt; S.turnMaxStep = Math.max(S.turnMaxStep, Math.abs(a)); } }
    st.yaw = S.head.yaw;
    if (nbOn) { const P = [L, R].reduce((b, q) => q && Math.hypot(q.x, q.y) > Math.hypot(b.x, b.y) ? q : b, { x: 0, y: 0 }); st.vrMove = { x: P.x, y: P.y, speed: SPEED }; }   // either stick moves the blocks
    else st.vrMove = L ? { x: L.x, y: L.y, speed: SPEED } : null;
    S.walkStart = { x: monkey.position.x, z: monkey.position.z };
  }

  // ---------- per frame: after the arcade step (follow the player, rays, the game screen, HUD) ----------
  function post(dt) {
    if (S.walkStart) { moveRig(monkey.position.x - S.walkStart.x, monkey.position.z - S.walkStart.z, monkey.position.y - S.rig.y); }
    // t350u: the teleporter moves the player (walk onto the pad, then the cut to the other pad): the headset goes with them
    if (A.tp && A.tp.locked && S.head) { const dx = monkey.position.x - S.head.x, dz = monkey.position.z - S.head.z; if (dx * dx + dz * dz > 1e-6) { moveRig(dx, dz); S.tpFollow = (S.tpFollow || 0) + 1; } if (UI.open) uiClose(); }
    monkey.visible = false;
    if (S.head) monkey.rotation.y = S.head.yaw + Math.PI;   // the avatar (seen in the mirror / by other players) faces where you look
    // t353u mirror: the shop's Reflector only renders for the main camera, but in VR three hands it the per-eye XR cameras, so it never
    // rendered (black). Kick it here, before the frame's render, with the main camera (three keeps it at the head pose). The Reflector
    // itself turns XR off for its own pass and restores the render target, so this is XR-safe (same lesson as the black-room fix).
    { const mr = mirrorMesh(); if (mr && mr.onBeforeRender && S.head) { camera.updateMatrixWorld(true); const n0 = A.shop.wardrobe.mirror.renders; try { mr.onBeforeRender(renderer, scene, camera); } catch (e) { S.lastError = 'mirror ' + e; } if (A.shop.wardrobe.mirror.renders > n0) S.mirrorKicks++; } }
    signsUpdate(); UI.msgT = Math.max(0, UI.msgT - dt);
    if (UI.open && S.head && Math.hypot(S.head.x - uiM.position.x, S.head.z - uiM.position.z) > 4) uiClose();   // walked away
    const nbOn = !!(nbApi() && nbApi().playing);
    const mode = play.mode, inGame = mode === 'game', L = IN.left, R = IN.right;
    dot.visible = false; tpRing.visible = false; S.hover = null;
    // rays
    let aimScreen = null;
    for (const c of ctrls) { const ray = c.userData.ray; if (!c.userData.src) { ray.visible = false; continue; } ray.visible = true; ray.scale.z = 3; ray.material.color.setHex(0x3ff3ff); }
    const order = [['right', R], ['left', L]];
    const anyP = k => !!((L && L[k]) || (R && R[k]));
    if (mode === 'walk' && nbOn) {   // NEON BRICKS: sticks move (step() -> nb.joy), A/X/trigger rotate, B/Y hard drop, hold grip = leave
      const n = nbApi(); if (UI.open) uiClose();
      if (anyP('aDown') || anyP('trigDown')) { n.rotate(); S.nbRot++; }
      if (anyP('bDown')) { n.hardDrop(); S.nbDrops++; }
      const grip = (L && L.grip) || (R && R.grip); S.nbGripT = grip ? (S.nbGripT || 0) + dt : 0;   // own timer (S.gripT is reset outside cabinet games)
      if (S.nbGripT >= GRIP_EXIT_S) { S.nbGripT = 0; n.stop('exit'); S.nbExits++; pulse((L && L.grip ? L : R).src, 0.8, 60); }
      if (n.zoomAmt) n.setZoomAmt(0);
    } else if (mode === 'walk') {
      if (anyP('bDown') && !(A.tp && A.tp.locked)) { if (UI.open) uiClose(); else uiOpen('menu'); }   // Y / B = menu
      UI.hover = null;
      for (const [hand, P] of order) { const c = ctrlFor(hand); if (!c || !P) continue; const ray = rayOf(c);
        if (UI.open) { const u = uiHit(ray);
          if (u) { c.userData.ray.scale.z = u.t; c.userData.ray.material.color.setHex(0x7dff9a); dot.position.copy(u.p); dot.visible = true; if (u.btn && !UI.hover) UI.hover = u.btn.id;
            if (P.trigDown && u.btn && u.btn.on) { pulse(P.src, 0.5, 30); S.lastPress = u.btn.id; u.btn.act(); UI.key = ''; } continue; } }
        const tg = pickTarget(ray), hit = pickCab(ray);
        if (tg && (!hit || tg.d <= hit.d)) { c.userData.ray.scale.z = tg.d; c.userData.ray.material.color.setHex(0x7dff9a); dot.position.copy(tg.p); dot.visible = true; if (!S.hover) S.hover = { target: tg.id, hand };
          if (P.trigDown) { pulse(P.src, 0.5, 30); S.lastPress = tg.id; tg.act(); } continue; }
        if (UI.open) continue;   // no floor teleports while a panel is open
        if (hit) { c.userData.ray.scale.z = hit.d; c.userData.ray.material.color.setHex(0xffe14a); if (!S.hover) S.hover = { cab: hit.cab, m: machineOf(hit.cab), hand }; dot.position.copy(hit.p); dot.visible = true;
          if (P.trigDown) { pulse(P.src, 0.6, 40); startCab(hit.cab, hit.p); } continue; }
        const gy = monkey.position.y; if (ray.direction.y < -0.05) { const t = (gy - ray.origin.y) / ray.direction.y; if (t > 0 && t < RAY_MAX) { const p = ray.at(t, _hit); c.userData.ray.scale.z = t;
          const q = new THREE.Vector3(p.x, gy, p.z); A.collide(q); const ok = Math.hypot(q.x - p.x, q.z - p.z) <= 0.35;
          if (hand === 'right' || !tpRing.visible) { tpRing.position.set(p.x, gy + 0.02, p.z); tpRing.visible = true; ringMat.color.setHex(ok ? 0x3ff3ff : 0xff3040); }
          c.userData.ray.material.color.setHex(ok ? 0x3ff3ff : 0xff3040);
          if (P.trigDown && ok) { tryTeleport(p); pulse(P.src, 0.3, 25); } } }
      }
    }
    if (UI.open) uiDraw();
    // the game screen
    if (inGame && !G.placed) placeScreen();
    scr.visible = inGame;
    const w = inGame ? gameWin() : null;
    if (inGame) {
      pump();
      if (w) { try { if (!G.rect || S.frames - G.layoutT > 30) { G.layoutT = S.frames; layout(w); } drawGame(w); } catch (e) {} }
      // power-up buttons beside the screen (only the ready ones)
      const map0 = MAPS[play.cur && play.cur.key] || MAPS.default; for (const id in pwM) pwM[id].visible = false;
      if (map0.pw && w) map0.pw.forEach((p, i) => { const r = pwReady(w, p), m = pwMesh(p, i); m.visible = r; if (r && !S.pwShown[p.id]) { S.pwShown[p.id] = 1; const P = R || L; if (P) pulse(P.src, 0.4, 40); } if (!r) S.pwShown[p.id] = 0; });
      scr.updateMatrixWorld(true); S.trigOnPw = false;
      for (const [hand, P] of order) { const c = ctrlFor(hand); if (!c || !P) continue; const ray = rayOf(c);
        if (map0.pw) { let hitPw = null; for (const p of map0.pw) { const m = pwM[p.id]; if (!m || !m.visible) continue; const t = rectHit(ray, m); if (t != null && (!hitPw || t < hitPw.t)) hitPw = { p, t }; }
          if (hitPw) { c.userData.ray.scale.z = hitPw.t; c.userData.ray.material.color.setHex(0xffe14a); dot.position.copy(ray.at(hitPw.t, _hit)); dot.visible = true; if (P.trig) S.trigOnPw = true; if (P.trigDown) { pwFire(w, hitPw.p); pulse(P.src, 0.6, 50); } continue; } }
        const n = _v.set(0, 0, 1).applyQuaternion(scr.getWorldQuaternion(_q)), denom = n.dot(ray.direction); if (Math.abs(denom) < 1e-4) continue;
        const t = _hit.copy(scr.position).sub(ray.origin).dot(n) / denom; if (t <= 0 || t > RAY_MAX) continue;
        const p = ray.at(t, new THREE.Vector3()), lp = scr.worldToLocal(p.clone()), u = lp.x / G.w + 0.5, v = lp.y / G.h + 0.5;
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        c.userData.ray.scale.z = t; c.userData.ray.material.color.setHex(0xff3fd2); if (!aimScreen) { aimScreen = { hand, u, v }; dot.position.copy(p); dot.visible = true; } }
      gameInput(w, aimScreen, dt);
    } else { if (Object.keys(S.held).length || G.ptrDown) releaseAll(); G.placed = false; G.rect = null; S.gripT = 0; }
    // t353u: a ray never passes through a VR button / panel / sign / screen: cut it at the nearest one it crosses
    const surf = [uiM, ...signs.map(g => g.m), back, bar, ...Object.values(pwM)];
    for (const c of ctrls) { if (!c.userData.src) continue; const ray = rayOf(c); let t = c.userData.ray.scale.z;
      for (const m of surf) { const h = rectHit(ray, m, t); if (h != null && h < t) t = h; } c.userData.ray.scale.z = t; c.userData.rayLen = t; }
    // HUD on the left controller (or under your view when there is none)
    const T = play.tickets ? play.tickets.total : 0, lc = ctrlFor('left') || ctrlFor('right');
    if (lc && lc.userData.src) { lc.updateMatrixWorld(true); hud.position.set(0, 0.07, 0.02).applyMatrix4(lc.matrixWorld); hud.quaternion.copy(lc.getWorldQuaternion(_q)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, 0, 0))); }
    else if (S.head) { const h = S.head; hud.position.set(h.x - Math.sin(h.yaw) * 0.7, h.y - 0.45, h.z - Math.cos(h.yaw) * 0.7); hud.rotation.set(-0.5, h.yaw, 0, 'YXZ'); }
    if (play.lastToast && play.lastToast !== S._toast) { S._toast = play.lastToast; S.msg = play.lastToast; S.msgT = 2.5; }
    S.msgT = Math.max(0, S.msgT - dt);
    const hv = S.hover && S.hover.m, cost = hv ? (hv.cost || 1) : 0, TG = { ward: 'TRIGGER: ACCESSORIES', tickets: 'TRIGGER: BUY TICKETS', kiosk: 'TRIGGER: BUY TICKETS', beamShop: 'TRIGGER: BEAM TO SHOP', beamArcade: 'TRIGGER: BEAM TO ARCADE', shop: 'TRIGGER: PRIZE SHOP', nb: 'TRIGGER: PLAY NEON BRICKS', nbWindow: 'TRIGGER: PLAY NEON BRICKS' };
    const line2 = S.msgT > 0 ? S.msg : nbOn ? 'STICK MOVE · A ROTATE · B DROP · HOLD GRIP LEAVE' : hv ? 'TRIGGER: PLAY ' + (NAMES[hv.key] || hv.key.toUpperCase()) + ' · ' + cost + (cost === 1 ? ' TICKET' : ' TICKETS') : S.hover && S.hover.target ? TG[S.hover.target] : inGame ? 'HOLD GRIP TO LEAVE' : 'TRIGGER: TELEPORT / PLAY · Y: MENU';
    drawPanel(hud, [T + (T === 1 ? ' TICKET' : ' TICKETS'), line2]);
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
    const any = k => !!((L && L[k]) || (R && R[k])), anyAB = map.handAB === 'right' ? (k => !!(R && R[k])) : any;
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
    for (const k of map.b) hold(k, !canC && anyAB('b'), w);
    if (map.pw) pwInput(w, map, L, R, dt);
    // trigger: tap the screen where you point (pointer games) or the primary button
    let trigAsA = map.trig === 'a';
    if (map.trig === 'ptr') { const tr = (R && R.trig) || (L && L.trig);
      if (aim && tr) { if (!G.ptrDown) { sendPtr(w, 'pointerdown', aim.u, aim.v); G.ptrDown = true; } else sendPtr(w, 'pointermove', aim.u, aim.v); }
      else if (G.ptrDown) { sendPtr(w, 'pointerup', aim ? aim.u : G.pu, aim ? aim.v : G.pv); G.ptrDown = false; }
      if (!aim) trigAsA = true; }
    const prim = anyAB('a') || (trigAsA && !S.trigOnPw && any('trig'));
    for (const k of map.a) hold(k, prim, w);
  }
  // ---- power-ups: ready = the game's own button is showing; fire = tap its key for a few frames ----
  const pwRel = {};
  function pwReady(w, p) { try { const e = w.document.getElementById(p.el); return !!(e && e.style.display === 'flex'); } catch (e) { return false; } }
  function pwFire(w, p) { if (!w || !pwReady(w, p)) return false; hold(p.code, true, w); pwRel[p.code] = 0.15; S.pwFired[p.id] = (S.pwFired[p.id] || 0) + 1; S.lastPw = p.id; return true; }
  function pwInput(w, map, L, R, dt) {
    for (const c in pwRel) { pwRel[c] -= dt; if (pwRel[c] <= 0) { delete pwRel[c]; hold(c, false, w); } }
    // right grip: a short tap (< 0.35 s) = ODIN; holding it 0.6 s still leaves the machine
    const rg = !!(R && R.grip); if (rg) S.rgT = (S.rgT || 0) + dt; let rgTap = false; if (!rg && S.rgWas) rgTap = (S.rgT || 0) < 0.35; if (!rg) S.rgT = 0; S.rgWas = rg;
    for (const p of map.pw) { const go = (p.btn === 'X' && L && L.aDown) || (p.btn === 'Y' && L && L.bDown) || (p.btn === 'R-GRIP TAP' && rgTap); if (go) { if (pwFire(w, p)) pulse((p.btn === 'R-GRIP TAP' ? R : L).src, 0.6, 50); } } }
  S.pw = { fire: id => { const m = MAPS[play.cur && play.cur.key] || {}, p = (m.pw || []).find(q => q.id === id); return p ? pwFire(gameWin(), p) : false; }, ready: () => { const m = MAPS[play.cur && play.cur.key] || {}, w = gameWin(); return (m.pw || []).filter(p => w && pwReady(w, p)).map(p => p.id); },
    world: id => { const m = pwM[id]; if (!m || !m.visible) return null; m.updateMatrixWorld(true); return m.getWorldPosition(new THREE.Vector3()).toArray(); } };
  S.sendKey = (code, type) => { const w = gameWin(); if (w) sendKey(w, type, code); };
  S.state = () => ({ presenting: S.presenting, rig: { ...S.rig }, head: S.head && { ...S.head }, mode: play.mode, sub: play.sub, cur: play.cur && play.cur.key, screen: scr.visible, held: Object.keys(S.held), keysSent: S.keysSent, ptrSent: S.ptrSent, texUploads: S.texUploads, launches: S.launches, exits: S.exits, teleports: S.teleports, snaps: S.snaps, turnRate: S.turnRate, turnSum: S.turnSum, turnTime: S.turnTime, turnMaxStep: S.turnMaxStep, panel: UI.open, beams: S.beams, tpWhere: A.tp && A.tp.where, tpState: A.tp && A.tp.state, nb: !!(A.nb && A.nb.playing), pumps: S.pumps, hover: S.hover && S.hover.m && S.hover.m.key, monkey: [monkey.position.x, monkey.position.y, monkey.position.z], comp: [comp.width, comp.height], err: S.lastError || null });
  return { pre, post, S, rtCheck };
}
