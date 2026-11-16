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
import { Reflector } from 'three/addons/objects/Reflector.js';
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
  // t358u (Dave): A = DASH (always shown on the right), B = THOR, X = BERSERK, Y = ODIN; trigger = attack; hold grip = leave
  berserker: { a: ['Space'], b: [], trig: 'keys', trigKeys: ['KeyJ'], handAB: 'right', help: 'STICK MOVE · TRIGGER ATTACK · A DASH · B THOR · X BERSERK · Y ODIN',
    pw: [{ id: 'dash', name: 'DASH', code: 'Space', btn: 'A', el: 'bD', always: true }, { id: 'thor', name: 'THOR', code: 'KeyL', btn: 'B', el: 'thor' }, { id: 'rage', name: 'BERSERK', code: 'KeyB', btn: 'X', el: 'bRg' }, { id: 'odin', name: 'ODIN', code: 'KeyO', btn: 'Y', el: 'bOd' }] },
  ghost: { a: ['Space'], b: [], trig: 'a', help: 'STICK STEER · A START' },
  claw: { a: ['Enter', 'Space'], b: [], trig: 'ptr', help: 'STICK MOVE · A DROP · TRIGGER TAPS' },
  orc: { a: [], b: [], trig: 'ptr', help: 'POINT + TRIGGER TO TAP THE SCREEN' },
  // t354u (Dave): left stick moves, right stick pans the camera (the game's own lookDrag), X/A = jetpack (hold Space), Y/B/trigger = laser (hold F: charge, release = shot)
  skytower: { a: ['Space'], b: ['KeyF'], trig: 'b', moveStick: 'left', pan: '__skytower', help: 'L-STICK MOVE · R-STICK CAMERA · A/X FLY · B/Y LASER' },
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
  function drawPanel(m, lines, opts = {}) { const key = lines.join('|') + (opts.bar ? '|bar' + Math.round(opts.bar.v * 50) + opts.bar.low : ''); if (m.userData.txt === key) return; m.userData.txt = key;
    const { cv, g, tex } = m.userData, W = cv.width, H0 = cv.height, H = opts.bar ? Math.round(H0 * 0.72) : H0; g.clearRect(0, 0, W, H0);
    if (opts.bar) { const b = opts.bar, y = H + 2, bh = H0 - H - 8, x = 150, bw = W - x - 16;   // t358u: jetpack ENERGY bar under the text
      g.fillStyle = 'rgba(20,8,4,0.9)'; g.strokeStyle = '#ffb060'; g.lineWidth = 4; g.beginPath(); g.roundRect ? g.roundRect(4, y, W - 8, bh, bh * 0.3) : g.rect(4, y, W - 8, bh); g.fill(); g.stroke();
      g.fillStyle = '#ffe0b0'; g.font = '900 ' + Math.round(bh * 0.5) + 'px "Arial Black", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('ENERGY', 16, y + bh / 2, x - 24);
      const gr = g.createLinearGradient(x, 0, x + bw, 0); gr.addColorStop(0, '#ff3b1a'); gr.addColorStop(0.55, '#ffb020'); gr.addColorStop(1, '#ffe080');
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y + 8, bw, bh - 16); g.fillStyle = b.low ? '#ff3030' : gr; g.fillRect(x, y + 8, Math.max(0, Math.min(1, b.v)) * bw, bh - 16); }
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
  function pwMesh(p, i) { let m = pwM[p.id]; if (!m) { m = pwM[p.id] = panel(0.5, 0.17, 512, 174); m.name = 'vrPower_' + p.id; m.renderOrder = 1001; scr.add(m); drawPanel(m, [p.name, (p.always ? 'HOLD ' : 'PRESS ') + p.btn], p.always ? { c0: '#7dfcff', border: '#3ff3ff' } : { c0: '#ffe14a', border: '#ffe14a' }); }
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
    if (UI.open === 'chat' && kind !== 'chat') chatEnd();
    UI.open = kind; UI.page = 0; UI.msg = ''; UI.msgT = 0; UI.key = '';
    uiM.position.set(h.x - Math.sin(h.yaw) * d, Math.max(0.9, h.y - 0.12), h.z - Math.cos(h.yaw) * d); uiM.rotation.set(0, h.yaw, 0); uiM.visible = true; uiM.updateMatrixWorld(true);
    S.panels[kind] = (S.panels[kind] || 0) + 1; }
  function uiClose() { chatEnd(); UI.open = null; uiM.visible = false; UI.btns = []; }
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
    let title = '', sub = '', body = '';
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
    else if (UI.open === 'chat') { title = 'CHAT WITH GROK'; const C = chatApi();
      if (!C || !C.open) { sub = 'GROK HAS GONE'; } else {
        sub = UI.chatQ ? 'YOU: ' + UI.chatQ : 'PICK A QUESTION'; body = 'GROK: ' + (UI.chatA || '...');
        const per = 8, pages = Math.ceil(CHAT_QS.length / per); UI.page = Math.min(UI.page, pages - 1);
        CHAT_QS.slice(UI.page * per, UI.page * per + per).forEach((q, i) => add('q_' + (UI.page * per + i), q, 30 + (i % 2) * 488, 382 + Math.floor(i / 2) * 68, 476, 60, true, () => chatAsk(q))); 
        add('prev', '<', 30, 660, 170, 90, UI.page > 0, () => { UI.page--; }); add('next', '>', 824, 660, 170, 90, UI.page < pages - 1, () => { UI.page++; }); }
      add('close', 'CLOSE', 220, 660, 584, 90, true, uiClose); }
    else if (UI.open === 'pack') { title = 'MONKEY BACKPACK'; const sh = A.shop || window.__shop;
      if (!sh || !sh.hold) { sub = 'OPENING THE BACKPACK...'; try { window.__arcade && window.__arcade.loadShop && window.__arcade.loadShop(); } catch (e) {} } else {
        const items = packItems(sh), h = heldNow(), per = 6, pages = Math.max(1, Math.ceil(items.length / per)); UI.page = Math.min(UI.page, pages - 1);
        const nm = id => { const it = items.find(q => q.id === id); return it ? it.name : String(id).replace(/^claw:/, '').toUpperCase(); };
        sub = 'RIGHT: ' + (h.R ? nm(h.R) : '-') + '   ·   LEFT: ' + (h.L ? nm(h.L) : '-');
        if (!items.length) UI.msg = UI.msg || 'NO PRIZES YET · BUY AT THE GROK SHOP OR WIN THE CLAW';
        items.slice(UI.page * per, UI.page * per + per).forEach((it, i) => { const sl = h.R === it.id ? 'R' : h.L === it.id ? 'L' : '';
          add('p_' + it.id, it.name + (it.n > 1 ? ' x' + it.n : '') + (sl ? '  ·  ' + sl : ''), 40 + (i % 2) * 484, 180 + Math.floor(i / 2) * 95, 460, 85, true, () => packTap(sh, it)); });
        add('away_R', 'PUT R AWAY', 40, 475, 300, 85, !!h.R, () => { sh.unhold('R'); S.packUnequips = (S.packUnequips || 0) + 1; say('RIGHT HAND EMPTY'); });
        add('away_L', 'PUT L AWAY', 362, 475, 300, 85, !!h.L, () => { sh.unhold('L'); S.packUnequips = (S.packUnequips || 0) + 1; say('LEFT HAND EMPTY'); });
        add('away', 'PUT BOTH AWAY', 684, 475, 300, 85, !!(h.R || h.L), () => { sh.unhold(); S.packUnequips = (S.packUnequips || 0) + 1; say('HANDS EMPTY'); });
        add('prev', '<', 40, 650, 170, 90, UI.page > 0, () => { UI.page--; }); add('pward', 'ACCESSORIES', 230, 650, 564, 90, !!window.__gaPlayer, () => uiOpen('ward')); add('next', '>', 814, 650, 170, 90, UI.page < pages - 1, () => { UI.page++; }); } }
    else if (UI.open === 'menu') { const tp = A.tp, inShop = tp && tp.where === 2; title = 'MENU'; { const w = wallet(); sub = '$' + w.cash + ' CASH   ·   ' + w.tickets + ' TICKETS'; }
      add('beam', inShop ? 'BEAM TO ARCADE' : 'BEAM TO SHOP', 112, 150, 800, 88, !!tp && tp.state === 'idle', beam);
      add('pack', 'MONKEY BACKPACK', 112, 250, 800, 88, true, () => uiOpen('pack'));
      if (!inShop) { add('tickets', 'BUY TICKETS', 112, 350, 800, 88, !!kiosk(), () => uiOpen('tickets')); add('nb', 'PLAY NEON BRICKS', 112, 450, 800, 88, !!nbApi(), nbStart); }
      else add('shop', 'PRIZE SHOP', 112, 350, 800, 88, !!A.shop, () => uiOpen('shop'));
      add('ward', 'ACCESSORIES', 112, inShop ? 450 : 550, 800, 88, !!window.__gaPlayer, () => uiOpen('ward'));
      add('close2', 'CLOSE', 112, 655, 800, 88, true, uiClose); }
    return { title, sub, body, B }; }
  // ---- backpack: Grok Shop prizes + claw plushes, held through shop.js's two-hand API (hold(id, 'R'|'L') / unhold(slot)) ----
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  // t355u: the menu shows your money (kiosk cash) and tickets, live (the panel redraws when the text changes)
  function wallet() { const k = kiosk(); let cash = 0; try { if (k && k.refill) k.refill(); cash = k && k.C ? k.C.bal | 0 : 0; } catch (e) {} const t = play.tickets; return { cash, tickets: t ? t.total | 0 : 0 }; }
  S.wallet = () => wallet();
  S.uiSub = () => { try { return uiSpec().sub; } catch (e) { return null; } };
  function heldNow() { const v = J('neonarcade.held', null); if (typeof v === 'string') return { R: v, L: null }; return { R: (v && v.R) || null, L: (v && v.L) || null }; }
  const CLAWN = { bear: 'TEDDY BEAR', bunny: 'BUNNY', duck: 'DUCKY', frog: 'FROG', cat: 'KITTY', octopus: 'OCTOPUS', penguin: 'PENGUIN', alien: 'ALIEN', monkey: 'MONKEY', grok: 'GROK' };   // inventory.js CLAW names
  function packItems(sh) { const out = [], p = J('neonarcade.prizes', {}), byId = {}; for (const it of sh.ITEMS || []) byId[it.id] = it;
    for (const id in p) if ((p[id] | 0) > 0 && byId[id]) out.push({ id, name: byId[id].name.toUpperCase(), n: p[id] | 0, src: 'shop' });
    const cl = J('arcade_clawMachine.collection', {}); for (const k in cl) if ((cl[k] | 0) > 0) out.push({ id: 'claw:' + k, name: (CLAWN[k] || k.toUpperCase()) + ' PLUSH', n: cl[k] | 0, src: 'claw' });
    return out; }
  function packTap(sh, it) { const h = heldNow();
    if (h.R === it.id) { sh.unhold('R'); S.packUnequips = (S.packUnequips || 0) + 1; say('PUT AWAY: ' + it.name); return; }
    if (h.L === it.id) { sh.unhold('L'); S.packUnequips = (S.packUnequips || 0) + 1; say('PUT AWAY: ' + it.name); return; }
    const slot = !h.R ? 'R' : !h.L ? 'L' : 'R'; const r = sh.hold(it.id, slot) || heldNow();
    if (r.R === it.id || r.L === it.id) { S.packEquips = (S.packEquips || 0) + 1; say('HOLDING ' + it.name + (r.L === it.id ? ' · LEFT HAND' : r.L || slot === 'R' && h.L ? ' · RIGHT HAND' : '')); }
    else say("CAN'T HOLD " + it.name + ' YET'); }
  S.pack = { items: () => { const sh = A.shop || window.__shop; return sh ? packItems(sh) : []; }, held: heldNow };
  function drawPackIcon(g, x, y, s) {   // little brown monkey backpack
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = '#7a4a24'; g.beginPath(); g.roundRect ? g.roundRect(-30, -26, 60, 64, 14) : g.rect(-30, -26, 60, 64); g.fill();
    g.strokeStyle = '#4a2a10'; g.lineWidth = 5; g.beginPath(); g.arc(0, -26, 14, Math.PI, 0); g.stroke();
    g.fillStyle = '#9a6a3e'; g.beginPath(); g.arc(0, 8, 19, 0, 7); g.fill(); g.beginPath(); g.arc(-19, -2, 8, 0, 7); g.arc(19, -2, 8, 0, 7); g.fill();
    g.fillStyle = '#f0c99a'; g.beginPath(); g.ellipse(0, 13, 13, 10, 0, 0, 7); g.fill(); g.fillStyle = '#1a0d05'; g.beginPath(); g.arc(-6, 3, 3, 0, 7); g.arc(6, 3, 3, 0, 7); g.fill();
    g.restore(); }
  // ---------- t360u: CHAT WITH GROK in VR. Same chat as the flat game (grokchat.js: openChat(source) makes Grok face you, ask(text) answers from
  // its offline knowledge base and makes him talk). There is no keyboard in the headset, so the typed box becomes ray-clickable questions. ----------
  const CHAT_QS = ['WHAT GAMES ARE THERE?', 'HOW DO I GET TICKETS?', 'WHAT CAN I WIN IN THE SHOP?', 'WHAT ARE YOU DOING?', 'TELL ME A JOKE', 'WHO ARE YOU?', 'HOW DO I OPEN LEVEL 2?', 'HOW DOES THE WARDROBE WORK?',
    'HOW DOES THE BACKPACK WORK?', 'HOW DO I CHANGE CHARACTER?', 'HOW DO I PLAY BERSERKER?', 'HOW DO I PLAY SKY TOWER?', 'HOW DO I PLAY NEON BRICKS?', 'HOW DO I PLAY GOLF?', 'HOW DOES THE CLAW MACHINE WORK?', 'WHAT ARE VIKING TICKETS?',
    'HOW DO I GET CASH?', 'CAN I PLAY WITH FRIENDS?', 'WHAT TIME IS IT?', 'WHAT DO YOU LIKE TO EAT?', 'WHO IS DAVE?', 'THANKS GROK!', 'BYE GROK!'];
  const chatApi = () => window.__grokChat || null;
  function chatStart(src) { const C = chatApi(); if (!C || !C.hooks || !C.hooks[src]) return false; if (C.open && C.ctx && C.ctx.source !== src) C.close('vr');
    if (!C.open) C.openChat(src); if (!C.open) return false; try { C.input && C.input.blur(); } catch (e) {}
    UI.chatSrc = src; uiOpen('chat'); UI.chatQ = ''; const lg = C.log.filter(e => e.who === 'g'); UI.chatA = lg.length ? lg[lg.length - 1].text : ''; S.chatOpens = (S.chatOpens || 0) + 1; return true; }
  function chatEnd() { if (UI.open !== 'chat') return; const C = chatApi(); try { if (C && C.open) C.close('vr'); } catch (e) {} UI.chatSrc = null; }
  function chatAsk(q) { const C = chatApi(); if (!C || !C.open) return; UI.chatQ = q; UI.chatA = C.ask(q) || ''; S.chatAsks = (S.chatAsks || 0) + 1; UI.key = ''; }
  S.chat = { start: chatStart, ask: chatAsk, get q() { return UI.chatQ || ''; }, get a() { return UI.chatA || ''; }, qs: CHAT_QS };
  function wrapText(g, text, maxW) { const out = []; for (const para of String(text || '').split('\n')) { let line = ''; for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } out.push(line); } return out; }
  function uiDraw() { const sp = uiSpec(); UI.btns = sp.B; const msg = UI.msgT > 0 ? UI.msg : '';
    const key = sp.title + '|' + sp.sub + '|' + (sp.body || '') + '|' + msg + '|' + UI.hover + '|' + sp.B.map(b => b.id + b.label + b.on).join(','); if (key === UI.key) return; UI.key = key;
    const { cv, g, tex } = uiM.userData; g.clearRect(0, 0, 1024, 768);
    g.fillStyle = 'rgba(10,6,24,0.92)'; g.strokeStyle = '#3ff3ff'; g.lineWidth = 8; g.beginPath(); g.roundRect ? g.roundRect(4, 4, 1016, 760, 40) : g.rect(4, 4, 1016, 760); g.fill(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe14a'; g.font = '900 64px "Arial Black", Arial, sans-serif'; g.fillText(sp.title, UI.open === 'pack' ? 500 : 470, 70, UI.open === 'pack' ? 740 : 820);
    g.fillStyle = '#9ff8ff'; g.font = '900 34px "Arial Black", Arial, sans-serif'; g.fillText(sp.sub, 512, 140, 960);
    for (const b of sp.B) { const hv = UI.hover === b.id && b.on; g.fillStyle = !b.on ? 'rgba(60,60,80,0.6)' : hv ? '#ff3fd2' : 'rgba(0,229,255,0.22)'; g.strokeStyle = b.on ? (hv ? '#ffffff' : '#3ff3ff') : '#555a70'; g.lineWidth = 6;
      g.beginPath(); g.roundRect ? g.roundRect(b.x, b.y, b.w, b.h, 24) : g.rect(b.x, b.y, b.w, b.h); g.fill(); g.stroke();
      g.fillStyle = b.on ? '#ffffff' : '#9097a8'; g.font = '900 ' + Math.round(Math.min(48, b.h * 0.42)) + 'px "Arial Black", Arial, sans-serif'; g.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2, b.w - 24);
      if (b.id === 'pack') drawPackIcon(g, b.x + 60, b.y + b.h / 2, b.h / 80); }
    if (UI.open === 'pack') drawPackIcon(g, 70, 72, 0.95);
    if (sp.body) { g.save(); g.fillStyle = 'rgba(13,42,64,0.9)'; g.strokeStyle = '#00e5ff'; g.lineWidth = 3; g.beginPath(); g.roundRect ? g.roundRect(30, 168, 964, 196, 18) : g.rect(30, 168, 964, 196); g.fill(); g.stroke();
      let fs = 30, lines; for (; fs >= 20; fs -= 2) { g.font = '600 ' + fs + 'px Arial, sans-serif'; lines = wrapText(g, sp.body, 920); if (lines.length * fs * 1.22 <= 176) break; }
      g.textAlign = 'left'; g.fillStyle = '#e8f6ff'; lines.slice(0, 8).forEach((l, i) => g.fillText(l, 52, 190 + fs * 0.6 + i * fs * 1.22)); g.restore(); }
    if (msg) { g.fillStyle = '#ffe14a'; g.font = '900 38px "Arial Black", Arial, sans-serif'; g.fillText(msg, 512, UI.open === 'pack' ? 605 : UI.open === 'ward' ? 318 : UI.open === 'shop' ? 688 : 715, UI.open === 'ward' || UI.open === 'pack' ? 940 : 640); }
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
  S.rectHit = rectHit; S.rayLens = () => { const o = {}; for (const c of ctrls) if (c.userData.hand) o[c.userData.hand] = { len: c.userData.rayLen, o: c.userData.rayO }; return o; };
  // ---------- in-world signs (VR only): point + trigger ----------
  function makeSign(text, color) { const m = panel(0.95, 0.24, 512, 128); m.renderOrder = 1000; m.material.depthTest = true; drawPanel(m, [text], { c0: color || '#ffe14a', border: color || '#3ff3ff' }); m.visible = false; scene.add(m); return m; }
  const signs = [];
  function addSign(id, text, color, where, act, show) { const m = makeSign(text, color); m.name = 'vrSign_' + id; signs.push({ id, m, where, act, show }); return m; }
  const padTop = w => { const tp = A.tp; if (!tp) return null; const P = w === 1 ? tp.PAD1 : tp.PAD2; return [P.x, 2.05, P.z]; };
  addSign('tickets', 'BUY TICKETS', '#ffe14a', () => { const K = kiosk(); if (!K || !K.K) return null; const p = K.K.getWorldPosition(new THREE.Vector3()); return [p.x, 1.95, p.z]; }, () => uiOpen('tickets'), () => !!kiosk() && (!A.tp || A.tp.where === 1));
  addSign('beamShop', 'BEAM TO SHOP', '#3ff3ff', () => padTop(1), beam, () => A.tp && A.tp.where === 1 && A.tp.state === 'idle');
  addSign('beamArcade', 'BEAM TO ARCADE', '#3ff3ff', () => padTop(2), beam, () => A.tp && A.tp.where === 2 && A.tp.state === 'idle');
  addSign('shop', 'PRIZE SHOP', '#ff3fd2', () => { const g = A.shop && A.shop.grok; if (!g) return null; const p = g.getWorldPosition(new THREE.Vector3()); return [p.x, p.y + 2.3, p.z]; }, () => uiOpen('shop'), () => A.tp && A.tp.where === 2 && !!A.shop);
  // t356u/t358u: the shop mirror. shop.js's Reflector is 512x420 (blurred in a headset) and its own hook only draws within 12 m of the
  // camera, so in VR it stayed frozen after you beamed in until you walked halfway over. In VR a twin Reflector of vr.js's own takes
  // its place (same geometry and transform; shop.js is not edited). It is sharp: 1536 px on the long side (1024 on the low tier), glass aspect,
  // linear, no mipmaps. vr.js draws it once per frame with the head camera: every frame within MIRROR_NEAR m or while you are reflected in it,
  // every MIRROR_FAR_EVERY frames out to MIRROR_FAR m, and only while it is in view and facing you. On exit the shop's own mirror comes back.
  const MIRROR_NEAR = 8, MIRROR_FAR = 25, MIRROR_FAR_EVERY = 2, _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _mp = new THREE.Vector3(), _mn = new THREE.Vector3(), _mc = new THREE.Vector3();
  const MV = { twin: null, src: null, draw: null, renders: 0, skips: 0, far: 0 };
  function mirrorTwin() { const m = mirrorMesh(); if (!m || !m.parent) return null;
    if (MV.twin && MV.src === m) return MV.twin;
    const gp = m.geometry && m.geometry.parameters, gw = (gp && gp.width) || 1, gh = (gp && gp.height) || 1, L = A.TIER && A.TIER.name === 'low' ? 1024 : 1536;
    const w = gh >= gw ? Math.round(L * gw / gh) : L, h = gh >= gw ? L : Math.round(L * gh / gw);
    const col = (m.material && m.material.uniforms && m.material.uniforms.color) ? m.material.uniforms.color.value.getHex() : 0xa8c4d4;
    const t = new Reflector(m.geometry, { textureWidth: w, textureHeight: h, color: col, multisample: 0 });
    const tx = t.getRenderTarget().texture; tx.minFilter = THREE.LinearFilter; tx.magFilter = THREE.LinearFilter; tx.generateMipmaps = false;
    t.name = 'vrMirrorTwin'; t.position.copy(m.position); t.quaternion.copy(m.quaternion); t.scale.copy(m.scale); m.parent.add(t);
    MV.draw = t.onBeforeRender; t.onBeforeRender = () => {};   // never from the per-eye XR passes; post() draws it once per frame
    MV.twin = t; MV.src = m; return t; }
  function mirrorVR(on) { const m = mirrorMesh(), t = on ? mirrorTwin() : MV.twin; if (t) t.visible = !!on;
    if (m) { if (on && t) { if (m.userData.vrLayers == null) m.userData.vrLayers = m.layers.mask; m.layers.set(31); }   // shop.js keeps toggling .visible, so hide it from every camera by layer
      else if (m.userData.vrLayers != null) { m.layers.mask = m.userData.vrLayers; m.userData.vrLayers = null; } } }
  function mirrorFrame() { const t = mirrorTwin(); if (!t || !S.head) return; if (!t.visible || mirrorMesh().layers.mask !== (1 << 31)) mirrorVR(true);
    t.getWorldPosition(_mp); t.getWorldDirection(_mn); camera.updateMatrixWorld(true); camera.getWorldPosition(_mc);
    const d = _mp.distanceTo(_mc); if (d > MIRROR_FAR || (_mn.x * (_mc.x - _mp.x) + _mn.y * (_mc.y - _mp.y) + _mn.z * (_mc.z - _mp.z)) <= 0) { MV.skips++; return; }
    if (!t.geometry.boundingSphere) t.geometry.computeBoundingSphere();
    _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); if (!_fr.intersectsObject(t)) { MV.skips++; return; }
    const mk = monkey.position, toMk = _mn.x * (mk.x - _mp.x) + _mn.z * (mk.z - _mp.z), seen = toMk > 0 && Math.hypot(mk.x - _mp.x, mk.z - _mp.z) < 12;
    if (d > MIRROR_NEAR && !seen && (S.frames % MIRROR_FAR_EVERY)) { MV.skips++; return; }
    if (d > MIRROR_NEAR && !seen) MV.far++;
    const vis = monkey.visible; monkey.visible = true;   // you see yourself in it
    try { MV.draw.call(t, renderer, scene, camera); MV.renders++; S.mirrorKicks++; } catch (e) { S.lastError = 'mirror ' + e; }
    monkey.visible = vis; }
  // ---------- t360u: the avatar's arms + hands follow the real controllers (so the mirror shows you holding them) ----------
  // Cheap: per arm, the shoulder turns toward where the controller is relative to your real shoulder (scaled to the avatar), the elbow bends
  // when the hand is close to the body, the hand takes the grip's rotation, and a small controller model sits in each avatar hand.
  const _ha = { ws: new THREE.Vector3(), wp: new THREE.Vector3(), rs: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), pq: new THREE.Quaternion(), gq: new THREE.Quaternion(), dn: new THREE.Vector3(0, -1, 0), fix: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)) };
  const AH = { frames: 0, models: new Map() };
  function handModel(hand) { let m = AH.models.get(hand); if (m && m.parent === hand) return m;
    m = new THREE.Group(); m.name = 'vrAvatarCtrl';
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.09, 10).rotateX(Math.PI / 2 - 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.5, metalness: 0.3 }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.005, 6, 18), new THREE.MeshBasicMaterial({ color: 0xff3fd2, toneMapped: false })); ring.position.set(0, 0.01, -0.025); ring.rotation.x = 0.6;
    m.add(body, ring); const ws = new THREE.Vector3(); hand.getWorldScale(ws); m.scale.setScalar(1 / Math.max(0.05, ws.x)); m.position.set(0, -0.02 / Math.max(0.05, ws.y), 0); m.rotation.x = -Math.PI / 2; hand.add(m); AH.models.set(hand, m); return m; }
  function avatarHands() { const u = monkey.userData || {}, arms = u.arms; if (!arms || !S.head) return;
    const h = S.head, rx = Math.cos(h.yaw), rz = -Math.sin(h.yaw);   // your right, flat
    for (const arm of arms) { if (!arm || !arm.sh) continue; const hand = arm.sd > 0 ? 'right' : 'left', i = ctrls.findIndex(c => c.userData.hand === hand && c.userData.src), g = i >= 0 ? grips[i] : null;
      const mdl = arm.hand ? handModel(arm.hand) : null; if (mdl) mdl.visible = !!g;
      if (!g) continue;
      g.updateMatrixWorld(true); _ha.wp.setFromMatrixPosition(g.matrixWorld);
      _ha.rs.set(h.x + rx * arm.sd * 0.18, h.y - 0.27, h.z + rz * arm.sd * 0.18);   // your real shoulder
      _ha.v.copy(_ha.wp).sub(_ha.rs); const reach = Math.min(1, _ha.v.length() / 0.62); if (_ha.v.lengthSq() < 1e-6) continue; _ha.v.normalize();
      arm.sh.parent.updateMatrixWorld(true); arm.sh.parent.getWorldQuaternion(_ha.pq);
      _ha.q.setFromUnitVectors(_ha.dn, _ha.v); arm.sh.quaternion.copy(_ha.pq).invert().multiply(_ha.q);
      const bend = Math.max(0, 1 - reach) * 1.9; arm.sh.rotateX(-bend * 0.5); if (arm.el) arm.el.rotation.set(-bend, 0, 0);   // hand near you: elbow bends, the upper arm tips back
      if (arm.hand) { arm.hand.parent.updateMatrixWorld(true); arm.hand.parent.getWorldQuaternion(_ha.pq); g.getWorldQuaternion(_ha.gq); arm.hand.quaternion.copy(_ha.pq).invert().multiply(_ha.gq).multiply(_ha.fix); arm.hand.visible = true; } }
    AH.frames++; }
  function avatarHandsOff() { for (const m of AH.models.values()) m.visible = false; }
  S.avatarHands = () => { const u = monkey.userData || {}; monkey.updateMatrixWorld(true); return (u.arms || []).map(a => { const p = new THREE.Vector3(); (a.hand || a.el).getWorldPosition(p); const m = a.hand && AH.models.get(a.hand); return { sd: a.sd, hand: p.toArray(), model: !!(m && m.visible && m.parent === a.hand) }; }).concat([{ frames: AH.frames }]); };
  S.mirrorStats = () => ({ renders: MV.renders, skips: MV.skips, far: MV.far, twin: !!(MV.twin && MV.twin.visible), shopVisible: !!(mirrorMesh() && mirrorMesh().visible && mirrorMesh().layers.isEnabled(0)) });
  S.mirrorRT = () => { const m = MV.twin && MV.twin.visible ? MV.twin : mirrorMesh(); if (!m || !m.getRenderTarget) return null; const rt = m.getRenderTarget(); return { w: rt.width, h: rt.height, vr: m === MV.twin, filter: rt.texture.minFilter === THREE.LinearFilter ? 'linear' : rt.texture.minFilter, mips: rt.texture.generateMipmaps }; };
  const mirrorMesh = () => { const w = A.shop && A.shop.wardrobe; return (w && w.mirror && w.mirror.mesh) || null; };
  // t360u: CHAT WITH GROK over the shop clerk (above PRIZE SHOP) and over the visiting Grok in the arcade
  addSign('chatClerk', 'CHAT WITH GROK', '#7dfcff', () => { const g = A.shop && A.shop.grok; if (!g) return null; const p = g.getWorldPosition(new THREE.Vector3()), h = S.head, k = h ? Math.min(3, Math.max(1, Math.hypot(h.x - p.x, h.z - p.z) / 6)) : 1; return [p.x, p.y + 2.3 + 0.33 * k, p.z]; }, () => chatStart('clerk'), () => A.tp && A.tp.where === 2 && !!A.shop && !!(chatApi() && chatApi().hooks.clerk) && UI.open !== 'chat');
  addSign('chatVisitor', 'CHAT WITH GROK', '#7dfcff', () => { const v = window.__grokVisit, g = v && v.grok; if (!g) return null; const p = g.getWorldPosition(new THREE.Vector3()); return [p.x, p.y + 2.3, p.z]; }, () => chatStart('visitor'),
    () => { const v = window.__grokVisit, g = v && v.grok; if (!g || !g.visible || !v.state || v.state === 'idle' || v.state === 'done' || UI.open === 'chat' || !(chatApi() && chatApi().hooks.visitor)) return false; if (A.tp && A.tp.where !== 1) return false; const p = g.getWorldPosition(_v); return Math.hypot(p.x - monkey.position.x, p.z - monkey.position.z) < 10; });
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
    if (w) { const hv = S.hoverTarget === g.id || (g.id === 'tickets' && S.hoverTarget === 'kiosk') || (g.id === 'nb' && S.hoverTarget === 'nbWindow') || (g.id === 'shop' && S.hoverTarget === 'shop'); g.m.material.color.setHex(hv ? 0xffffff : 0xb8b8c8); g.m.userData.hl = hv;
      g.m.position.set(w[0], w[1], w[2]); if (h) { g.m.rotation.set(0, Math.atan2(h.x - w[0], h.z - w[2]), 0); g.m.scale.setScalar(Math.min(3, Math.max(1, Math.hypot(h.x - w[0], h.z - w[2]) / 6)) * (hv ? 1.12 : 1)); } } } }   // far signs grow so they stay readable / easy to point at

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
    mirrorVR(false); avatarHandsOff();
    A.resumeFlat();
  });

  function pump() { const gf = play.frame; for (const f of document.querySelectorAll('iframe')) { if (f !== gf && (S.frames & 1)) continue;
    try { const w = f.contentWindow; if (w && w.__gaVRPump) S.pumps += w.__gaVRPump(); } catch (e) {} } }

  // ---------- t355u: equipped gear in the arcade world (not in a cabinet): JETPACK -> hold A to fly, LASER PISTOL -> B shoots ----------
  // Uses the flat game's own code: main.js flyIntegrate() reads st.fly.hold (same as the FLY button), roomfire.js setHeld() (same as
  // the FIRE button: hold charges, release shoots). With the pistol on, B shoots and the menu moves to Y only.
  const jetOn = () => { try { return !!(window.__arcade && window.__arcade.jetpackOn && window.__arcade.jetpackOn()); } catch (e) { return false; } };
  const laserOn = () => { const rf = window.__roomFire; try { return !!(rf && rf.equipped && rf.equipped()); } catch (e) { return false; } };
  S.gear = () => ({ jet: jetOn(), laser: laserOn(), flying: !!S.vrFly, firing: !!S.vrFire, flyFrames: S.flyFrames || 0, laserPulls: S.laserPulls || 0 });
  function gear(ok, dt) { const R = IN.right, rf = window.__roomFire;
    const jet = jetOn(), fly = !!(ok && jet && R && R.a);
    if (jet || S.vrFly) { if (st.fly) st.fly.hold = fly; if (fly) S.flyFrames = (S.flyFrames || 0) + 1; S.vrFly = fly; }
    const las = laserOn(), fire = !!(ok && las && R && R.b && rf && rf.shown);
    if (las || S.vrFire || VL.beam || VL.glow) vrLaser(fire, dt, R); S.vrFire = fire; }
  // ---------- t359u: the laser pistol fires from the RIGHT CONTROLLER (full 3D aim: hand down = shoots down) ----------
  // roomfire.js aims from the avatar's body and takes no aim, so in VR vr.js runs the trigger cycle itself, with the same numbers as roomfire.js
  // (hold charges for CHARGE_T s, release = one bolt scaled by the charge, a full charge = a BEAM_T s beam). It uses roomfire's own pieces:
  // RF.fire() makes the real shot (bolt, zap, shot count, multiplayer zap), then the bolt is moved onto the controller's aim; playerCols() gives
  // the colours (blue monkey, red alien). The charge glow sits on the controller and grows while you hold B.
  const VL = { held: false, charge: 0, spent: false, beam: null, beamT: 0, glow: null, last: null, beams: 0, bolts: 0 };
  const _lo = new THREE.Vector3(), _ld = new THREE.Vector3(), _lq = new THREE.Quaternion();
  function laserAim() { const i = ctrls.findIndex(c => c.userData.hand === 'right' && c.userData.src); if (i < 0) return null;
    const c = ctrls[i], g = grips[i]; c.updateMatrixWorld(true); c.getWorldQuaternion(_lq); _ld.set(0, 0, -1).applyQuaternion(_lq).normalize();   // pointing direction = the controller's ray
    (g && g.visible !== false ? (g.updateMatrixWorld(true), _lo.setFromMatrixPosition(g.matrixWorld)) : _lo.setFromMatrixPosition(c.matrixWorld)).addScaledVector(_ld, 0.07);   // origin = just in front of the grip
    return { o: _lo, d: _ld }; }
  function laserCols() { const rf = window.__roomFire; try { return rf.playerCols(); } catch (e) { return { a: 0x2f8cff, b: 0x0a3cff, char: 'monkey' }; } }
  function laserGlow(k, aim, col) { if (k == null && !VL.glow) return; if (!VL.glow) { VL.glow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({ color: col.a, transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      VL.glow.name = 'vrLaserCharge'; VL.glow.renderOrder = 7; VL.glow.frustumCulled = false; const halo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: col.b, transparent: true, opacity: 0.3, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      halo.name = 'vrLaserHalo'; VL.glow.add(halo); scene.add(VL.glow); }
    const on = k != null && !!aim; VL.glow.visible = on; if (!on) return;
    VL.glow.position.copy(aim.o); VL.glow.scale.setScalar(0.5 + k * 2.2); VL.glow.material.color.setHex(col.a); VL.glow.children[0].material.color.setHex(col.b);
    VL.glow.material.opacity = 0.5 + k * 0.45; VL.glow.children[0].material.opacity = 0.18 + k * 0.4 + Math.sin(S.frames * 0.5) * 0.05 * k; }
  function laserBeam(aim, col) { const L = 28; if (!VL.beam) { const g = new THREE.Group(); g.name = 'vrLaserBeam';
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, L, 10, 1, true), new THREE.MeshBasicMaterial({ color: col.a, toneMapped: false, depthWrite: false, fog: false }));
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, L, 10, 1, true), new THREE.MeshBasicMaterial({ color: col.b, transparent: true, opacity: 0.45, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      for (const m of [core, glow]) { m.rotation.x = Math.PI / 2; m.position.z = L / 2; m.renderOrder = 6; m.frustumCulled = false; g.add(m); } scene.add(g); VL.beam = g; VL.beamT = 3; VL.beams++; S.vrBeams = VL.beams; }
    if (aim) { VL.beam.position.copy(aim.o); VL.beam.lookAt(aim.o.x + aim.d.x, aim.o.y + aim.d.y, aim.o.z + aim.d.z); VL.last = { o: aim.o.toArray(), d: aim.d.toArray(), beam: true }; } }
  function laserEndBeam() { if (!VL.beam) return; scene.remove(VL.beam); VL.beam.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); VL.beam = null; VL.beamT = 0; }
  function vrLaser(held, dt, R) { const rf = window.__roomFire, aim = laserAim(), col = laserCols(), CT = (rf && rf.CHARGE_T) || 4;
    if (VL.beam) { VL.beamT -= dt; laserBeam(aim, col); if (R && S.frames % 6 === 0) pulse(R.src, 0.5, 20); if (VL.beamT <= 0) laserEndBeam(); }
    if (held && !VL.held) { VL.charge = 0; VL.spent = !!VL.beam; S.laserPulls = (S.laserPulls || 0) + 1; if (R) pulse(R.src, 0.4, 30); }
    if (held && !VL.spent) { VL.charge += dt; const k = Math.min(1, VL.charge / CT); laserGlow(k, aim, col); if (R && S.frames % 8 === 0) pulse(R.src, 0.1 + k * 0.5, 15);
      if (VL.charge >= CT) { VL.spent = true; laserGlow(null); laserBeam(aim, col); } }
    else laserGlow(null);
    if (!held && VL.held && !VL.spent && aim && rf && rf.fire) {   // release: the real shot, then put the bolt on the controller's aim
      const k = Math.min(0.999, VL.charge / CT), L = rf.fire({ fromRelease: true, k });
      if (L && L.mesh) { L.mesh.position.copy(aim.o); L.mesh.lookAt(aim.o.x + aim.d.x, aim.o.y + aim.d.y, aim.o.z + aim.d.z); L.dir.copy(aim.d); L.o = aim.o.toArray();
        if (rf.last) { rf.last.o = aim.o.toArray(); rf.last.d = aim.d.toArray(); } VL.bolts++; VL.last = { o: aim.o.toArray(), d: aim.d.toArray(), k, char: col.char }; if (R) pulse(R.src, 0.7, 40); } }
    VL.held = held; }
  S.vrLaser = () => ({ held: VL.held, charge: VL.charge, bolts: VL.bolts, beams: VL.beams, beam: !!VL.beam, last: VL.last, glow: VL.glow && VL.glow.visible ? { color: VL.glow.material.color.getHex(), halo: VL.glow.children[0].material.color.getHex(), scale: VL.glow.scale.x, at: VL.glow.position.toArray() } : null,
    aim: (() => { const a = laserAim(); return a ? { o: a.o.toArray(), d: a.d.toArray() } : null; })() });
  // ---------- per frame: before the arcade step (input -> movement) ----------
  function pre(dt, xf) {
    S.frames++; poll(); if (S.rigDirty) { applyRig(); S.rigDirty = false; }
    const ref = renderer.xr.getReferenceSpace(), vp = xf && ref ? xf.getViewerPose(ref) : null;
    if (vp) { const p = vp.transform.position, o = vp.transform.orientation; _e.setFromQuaternion(_q.set(o.x, o.y, o.z, o.w), 'YXZ'); S.head = { x: p.x, y: p.y, z: p.z, yaw: _e.y, pitch: _e.x }; S.posed = true; }
    const walk = play.mode === 'walk' && !(A.tp && A.tp.locked) && !(A.shop && A.shop.open);
    S.turnRate = 0;
    S.walkStart = null; st.vrMove = null;
    gear(walk && !(A.nb && A.nb.playing), dt);
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
    avatarHands(); mirrorFrame();
    signsUpdate(); S.hoverTarget = null; UI.msgT = Math.max(0, UI.msgT - dt);
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
      if ((laserOn() ? !!(L && L.bDown) : anyP('bDown')) && !(A.tp && A.tp.locked)) { if (UI.open) uiClose(); else uiOpen('menu'); }   // Y / B = menu (Y only while the laser pistol is on: B shoots)
      UI.hover = null;
      for (const [hand, P] of order) { const c = ctrlFor(hand); if (!c || !P) continue; const ray = rayOf(c);
        if (UI.open) { const u = uiHit(ray);
          if (u) { c.userData.ray.scale.z = u.t; c.userData.ray.material.color.setHex(0x7dff9a); dot.position.copy(u.p); dot.visible = true; if (u.btn && !UI.hover) UI.hover = u.btn.id;
            if (P.trigDown && u.btn && u.btn.on) { pulse(P.src, 0.5, 30); S.lastPress = u.btn.id; u.btn.act(); UI.key = ''; } continue; } }
        const tg = pickTarget(ray), hit = pickCab(ray);
        if (tg && (!hit || tg.d <= hit.d)) { c.userData.ray.scale.z = tg.d; c.userData.ray.material.color.setHex(0x7dff9a); dot.position.copy(tg.p); dot.visible = true; if (!S.hover) S.hover = { target: tg.id, hand }; S.hoverTarget = tg.id;
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
      const map0 = MAPS[play.cur && play.cur.key] || MAPS.default; for (const id in pwM) { pwM[id].visible = false; pwM[id].scale.setScalar(1); }
      if (map0.pw && w) map0.pw.forEach((p, i) => { const r = pwReady(w, p), m = pwMesh(p, i); m.visible = r; if (r && !S.pwShown[p.id]) { S.pwShown[p.id] = 1; const P = R || L; if (P) pulse(P.src, 0.4, 40); } if (!r) S.pwShown[p.id] = 0; });
      scr.updateMatrixWorld(true); S.trigOnPw = false;
      for (const [hand, P] of order) { const c = ctrlFor(hand); if (!c || !P) continue; const ray = rayOf(c);
        if (map0.pw) { let hitPw = null; for (const p of map0.pw) { const m = pwM[p.id]; if (!m || !m.visible) continue; const t = rectHit(ray, m); if (t != null && (!hitPw || t < hitPw.t)) hitPw = { p, t }; }
          if (hitPw) { pwM[hitPw.p.id].scale.setScalar(1.12); c.userData.ray.scale.z = hitPw.t; c.userData.ray.material.color.setHex(0xffe14a); dot.position.copy(ray.at(hitPw.t, _hit)); dot.visible = true; if (P.trig) S.trigOnPw = true; if (P.trigDown) { pwFire(w, hitPw.p); pulse(P.src, 0.6, 50); } continue; } }
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
      for (const m of surf) { const h = rectHit(ray, m, t); if (h != null && h < t) t = h; } c.userData.ray.scale.z = t; c.userData.rayLen = t; c.userData.rayO = ray.origin.toArray(); }
    // HUD on the left controller (or under your view when there is none)
    const T = play.tickets ? play.tickets.total : 0, lc = ctrlFor('left') || ctrlFor('right');
    if (lc && lc.userData.src) { lc.updateMatrixWorld(true); hud.position.set(0, 0.07, 0.02).applyMatrix4(lc.matrixWorld); hud.quaternion.copy(lc.getWorldQuaternion(_q)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, 0, 0))); }
    else if (S.head) { const h = S.head; hud.position.set(h.x - Math.sin(h.yaw) * 0.7, h.y - 0.45, h.z - Math.cos(h.yaw) * 0.7); hud.rotation.set(-0.5, h.yaw, 0, 'YXZ'); }
    if (play.lastToast && play.lastToast !== S._toast) { S._toast = play.lastToast; S.msg = play.lastToast; S.msgT = 2.5; }
    S.msgT = Math.max(0, S.msgT - dt);
    const hv = S.hover && S.hover.m, cost = hv ? (hv.cost || 1) : 0, TG = { ward: 'TRIGGER: ACCESSORIES', tickets: 'TRIGGER: BUY TICKETS', kiosk: 'TRIGGER: BUY TICKETS', beamShop: 'TRIGGER: BEAM TO SHOP', beamArcade: 'TRIGGER: BEAM TO ARCADE', shop: 'TRIGGER: PRIZE SHOP', nb: 'TRIGGER: PLAY NEON BRICKS', nbWindow: 'TRIGGER: PLAY NEON BRICKS', chatClerk: 'TRIGGER: CHAT WITH GROK', chatVisitor: 'TRIGGER: CHAT WITH GROK' };
    const line2 = S.msgT > 0 ? S.msg : nbOn ? 'STICK MOVE · A ROTATE · B DROP · HOLD GRIP LEAVE' : hv ? 'TRIGGER: PLAY ' + (NAMES[hv.key] || hv.key.toUpperCase()) + ' · ' + cost + (cost === 1 ? ' TICKET' : ' TICKETS') : S.hover && S.hover.target ? TG[S.hover.target] : inGame ? 'HOLD GRIP TO LEAVE' : 'TRIGGER: TELEPORT / PLAY · Y: MENU';
    const fly = st.fly, jb = jetOn() && fly ? { v: fly.e, low: fly.e <= 0.18 } : null; S.hudBar = jb ? Math.round(fly.e * 100) : null;   // t358u: main.js's real jetpack energy (st.fly.e, 0..1)
    if (!!jb !== !!hud.userData.bar) { hud.userData.bar = !!jb; hud.scale.set(1, jb ? 1.3 : 1, 1); }
    drawPanel(hud, [T + (T === 1 ? ' TICKET' : ' TICKETS'), line2], jb ? { bar: jb } : {});
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
    const sx = map.moveStick === 'left' ? (L || { x: 0, y: 0 }) : [L, R].reduce((a, P) => P && Math.hypot(P.x, P.y) > Math.hypot(a.x, a.y) ? P : a, { x: 0, y: 0 });
    if (map.pan) camPan(w, map, R, dt);
    const th = (code, v) => S.held[code] ? v > 0.3 : v > 0.55;
    hold('ArrowLeft', th('ArrowLeft', -sx.x), w); hold('ArrowRight', th('ArrowRight', sx.x), w); hold('ArrowUp', th('ArrowUp', -sx.y), w); hold('ArrowDown', th('ArrowDown', sx.y), w);
    // B / Y: CONTINUE when the game offers it, otherwise the game's secondary button
    const canC = contCan(w);
    if (canC && any('bDown')) play.tryContinue();
    for (const k of map.b) hold(k, !canC && (anyAB('b') || (map.trig === 'b' && any('trig'))), w);
    if (map.pw) pwInput(w, map, L, R, dt);
    // trigger: tap the screen where you point (pointer games) or the primary button
    let trigAsA = map.trig === 'a';
    if (map.trig === 'ptr') { const tr = (R && R.trig) || (L && L.trig);
      if (aim && tr) { if (!G.ptrDown) { sendPtr(w, 'pointerdown', aim.u, aim.v); G.ptrDown = true; } else sendPtr(w, 'pointermove', aim.u, aim.v); }
      else if (G.ptrDown) { sendPtr(w, 'pointerup', aim ? aim.u : G.pu, aim ? aim.v : G.pv); G.ptrDown = false; }
      if (!aim) trigAsA = true; }
    const prim = anyAB('a') || (trigAsA && !S.trigOnPw && any('trig'));
    for (const k of map.a) hold(k, prim, w);
    if (map.trig === 'keys') for (const k of map.trigKeys) hold(k, !S.trigOnPw && any('trig'), w);   // t358u: the trigger has its own key (Berserker attack)
  }
  // ---- right stick = camera pan through the game's own drag-look (Sky Tower: lookDrag(dx, dy) in drag pixels, 0.0055 rad per px) ----
  function camPan(w, map, R, dt) { const api = w && w[map.pan]; if (!api || typeof api.lookDrag !== 'function' || !R) return;
    const f = v => { const a = Math.abs(v); return a < 0.15 ? 0 : Math.sign(v) * ((a - 0.15) / 0.85); }, px = 2.0 * dt / 0.0055;   // full push = 2 rad/s
    const dx = f(R.x) * px, dy = f(R.y) * px * 0.6; if (dx || dy) { try { api.lookDrag(dx, dy); S.pans = (S.pans || 0) + 1; } catch (e) {} } }
  // ---- power-ups: ready = the game's own button is showing; fire = tap its key for a few frames ----
  const pwRel = {};
  function pwReady(w, p) { if (p.always) return !!w; try { const e = w.document.getElementById(p.el); return !!(e && e.style.display === 'flex'); } catch (e) { return false; } }
  function pwFire(w, p) { if (!w || !pwReady(w, p)) return false; hold(p.code, true, w); pwRel[p.code] = 0.15; S.pwFired[p.id] = (S.pwFired[p.id] || 0) + 1; S.lastPw = p.id; return true; }
  function pwInput(w, map, L, R, dt) {
    for (const c in pwRel) { pwRel[c] -= dt; if (pwRel[c] <= 0) { delete pwRel[c]; hold(c, false, w); } }
    // t358u: B (right) / X / Y (left) fire their power-up when it is ready; A is DASH (held through map.a, like the game's own key)
    for (const p of map.pw) { const P = p.btn === 'B' ? R : L, go = (p.btn === 'B' && R && R.bDown) || (p.btn === 'X' && L && L.aDown) || (p.btn === 'Y' && L && L.bDown); if (go && pwFire(w, p)) pulse(P.src, 0.6, 50); } }
  S.pw = { fire: id => { const m = MAPS[play.cur && play.cur.key] || {}, p = (m.pw || []).find(q => q.id === id); return p ? pwFire(gameWin(), p) : false; }, ready: () => { const m = MAPS[play.cur && play.cur.key] || {}, w = gameWin(); return (m.pw || []).filter(p => w && pwReady(w, p)).map(p => p.id); },
    world: id => { const m = pwM[id]; if (!m || !m.visible) return null; m.updateMatrixWorld(true); return m.getWorldPosition(new THREE.Vector3()).toArray(); } };
  S.sendKey = (code, type) => { const w = gameWin(); if (w) sendKey(w, type, code); };
  S.state = () => ({ presenting: S.presenting, rig: { ...S.rig }, head: S.head && { ...S.head }, mode: play.mode, sub: play.sub, cur: play.cur && play.cur.key, screen: scr.visible, held: Object.keys(S.held), keysSent: S.keysSent, ptrSent: S.ptrSent, texUploads: S.texUploads, launches: S.launches, exits: S.exits, teleports: S.teleports, snaps: S.snaps, turnRate: S.turnRate, turnSum: S.turnSum, turnTime: S.turnTime, turnMaxStep: S.turnMaxStep, panel: UI.open, beams: S.beams, tpWhere: A.tp && A.tp.where, tpState: A.tp && A.tp.state, nb: !!(A.nb && A.nb.playing), pumps: S.pumps, hover: S.hover && S.hover.m && S.hover.m.key, monkey: [monkey.position.x, monkey.position.y, monkey.position.z], comp: [comp.width, comp.height], err: S.lastError || null });
  return { pre, post, S, rtCheck };
}
