// t365u: Meta Quest Browser, flat (on the screen, not in VR): left stick walks, right stick pans the camera (quest-pad.js, ported from
// the original v242, applied by vr.js); nothing from it during an XR session. Every load starts on cobblestone + medieval walls (saved
// prefs ignored, random-room shuffle off); floor + walls are free in the in-game OPTIONS and in the headset Y/B menu.
const { open } = require('./lib');
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
const QUA = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/37.0.0 SamsungBrowser/4.0 Chrome/130.0.0.0 VR Safari/537.36';
const FAKE = `Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ${JSON.stringify(QUA)} });
  window.__pads = []; Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => window.__pads });
  if (window === window.top) try { localStorage.setItem('neonarcade.floor', 'lava'); localStorage.setItem('neonarcade.walls', 'viking'); localStorage.setItem('neonarcade.tickets', '0'); } catch (e) {}`;
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const wheel = (page, n, dy, ctrl, dx = 0) => page.evaluate(async ([n, dy, ctrl, dx]) => { const cv = document.querySelector('canvas');
    for (let i = 0; i < n; i++) { cv.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, deltaX: dx, ctrlKey: !!ctrl, bubbles: true, cancelable: true, clientX: 200, clientY: 120 }));
      await new Promise(r => setTimeout(r, 16)); } }, [n, dy, ctrl, dx]);
  const QF = page => page.evaluate(() => window.__gaVR.questFlat());
  // ---------------- flat page, Quest UA, saved lava/viking + 0 tickets, random room NOT pre-disabled by the harness ----------------
  let o = await open({ w: 480, h: 270, randomRoom: true, init: { content: FAKE } });
  let { page, errors } = o;
  try {
    const r0 = await page.evaluate(() => ({ room: window.__gaVR.room(), lsF: localStorage.getItem('neonarcade.floor'), lsW: localStorage.getItem('neonarcade.walls'), rr: !!window.__noRandomRoom, q: !!(window.__gaQuestPad && window.__gaQuestPad.isQuest()), qm: !!window.__gaQuest, hook: !!(window.__gaQuestPad && window.__gaQuestPad.onFrame) }));
    chk(r0.room.floor === 'cobble' && r0.room.walls === 'medieval', 'saved lava/viking ignored: loads on cobblestone + medieval (' + r0.room.floor + '/' + r0.room.walls + ')');
    chk(r0.rr && !r0.room.random, 'the 30 s random floor/walls shuffle is off in the VR edition');
    chk(r0.q && r0.qm && r0.hook, 'Quest UA: quest-pad running and vr.js hooked into it');
    await page.evaluate(() => { const a = window.__arcade; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); });
    await page.waitForTimeout(300);
    const p0 = await page.evaluate(() => ({ x: window.__arcade.monkey.position.x, z: window.__arcade.monkey.position.z, yaw: window.__arcade.st.yaw, pitch: window.__arcade.st.pitch, zoom: window.__arcade.st.dist }));
    // left stick (plain wheel) walks
    await wheel(page, 25, 60, false);
    let q = await QF(page); const p1 = await page.evaluate(() => ({ x: window.__arcade.monkey.position.x, z: window.__arcade.monkey.position.z, yaw: window.__arcade.st.yaw, zoom: window.__arcade.st.dist, blocked: window.__arcade.st.wheelBlocked }));
    const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    chk(q.moves >= 2 && moved > 0.2, 'left stick (plain wheel) walks the player: moved ' + moved.toFixed(2) + ' m, ' + q.moves + ' stick frames');
    chk(Math.abs(p1.yaw - p0.yaw) < 1e-6 && Math.abs(p1.zoom - p0.zoom) < 1e-6, 'walking does not turn the camera or zoom (v1 Quest wheel block still stops zoom)');
    await page.waitForTimeout(400); q = await QF(page);
    chk(!q.joy.on, 'stick released: the walk stops (joy off)');
    // right stick (ctrl+wheel = Chromium zoom channel) pans the camera
    await wheel(page, 25, 0, true, 60);
    const p2 = await page.evaluate(() => ({ x: window.__arcade.monkey.position.x, z: window.__arcade.monkey.position.z, yaw: window.__arcade.st.yaw }));
    q = await QF(page);
    chk(q.looks > 3 && Math.abs(p2.yaw - p1.yaw) > 0.1, 'right stick (ctrl+wheel) turns the camera: yaw ' + (p2.yaw - p1.yaw).toFixed(2) + ' rad');
    // gamepad path (if the Quest exposes the Touch controllers to the page): right = look, left = walk
    await page.waitForTimeout(400);
    const y0 = await page.evaluate(() => window.__arcade.st.yaw), m0 = (await QF(page)).moves;
    await page.evaluate(() => { window.__pads = [{ id: 'Oculus Touch (Right)', index: 1, hand: 'right', mapping: 'xr-standard', connected: true, axes: [0, 0, 0.9, 0], buttons: [] }]; });
    await page.waitForFunction(y0 => Math.abs(window.__arcade.st.yaw - y0) > 0.1, y0, { timeout: 4000 }).catch(() => {});
    const y1 = await page.evaluate(() => window.__arcade.st.yaw);
    chk(Math.abs(y1 - y0) > 0.1 && (await QF(page)).moves === m0, 'gamepad right stick turns the camera without walking ' + JSON.stringify({ dy: y1 - y0, m0, m: (await QF(page)).moves, look: await page.evaluate(() => window.__gaQuestPad.read().look), mode: await page.evaluate(() => [window.__arcade.play.mode, !!(window.__start && window.__start.shown && !window.__start.dismissed), window.__gaVR.questFlat().frames]) }));
    await page.evaluate(() => { window.__pads = [{ id: 'Oculus Touch (Left)', index: 0, hand: 'left', mapping: 'xr-standard', connected: true, axes: [0, 0, 0, -0.9], buttons: [] }]; });
    await page.waitForFunction(m0 => window.__gaVR.questFlat().joy.on && window.__gaVR.questFlat().moves > m0, m0, { timeout: 4000 }).catch(() => {});
    q = await QF(page); chk(q.joy.on && q.joy.y < -0.5 && q.moves > m0, 'gamepad left stick walks (forward) ' + JSON.stringify({ joy: q.joy, moves: q.moves, m0, pad: await page.evaluate(() => window.__gaQuestPad.read().move) }));
    await page.evaluate(() => { window.__pads = []; }); await page.waitForFunction(() => !window.__gaVR.questFlat().joy.on, null, { timeout: 4000 }).catch(() => {});
    chk(!(await QF(page)).joy.on, 'gamepad released: walk stops');
    // ---- v9 (t368u): the RIGHT stick only turns the camera, never walks ----
    const wheelAt = (n, o) => page.evaluate(async ([n, o]) => { const cv = document.querySelector('canvas');
      for (let i = 0; i < n; i++) { cv.dispatchEvent(new WheelEvent('wheel', Object.assign({ bubbles: true, cancelable: true }, o))); await new Promise(r => setTimeout(r, 16)); } }, [n, o]);
    const ray = (id, x, y) => page.evaluate(([id, x, y]) => { for (let i = 0; i < 3; i++) window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, pointerType: 'touch', clientX: x, clientY: y + i, bubbles: true })); }, [id, x, y]);
    const pose = () => page.evaluate(() => ({ x: window.__arcade.monkey.position.x, z: window.__arcade.monkey.position.z, yaw: window.__arcade.st.yaw }));
    await page.evaluate(() => { const a = window.__arcade; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); });
    await ray(11, 110, 150); await ray(12, 370, 150); await page.waitForTimeout(300);
    let a0 = await pose(), m0b = (await QF(page)).moves;
    await wheelAt(25, { deltaX: 60, deltaY: 0, clientX: 370, clientY: 151 }); await page.waitForTimeout(300);
    let a1 = await pose(); let lg = await page.evaluate(() => window.__gaQuestPad.evLog[0]);
    chk(lg && lg.cls === 'LOOK' && lg.why === '2ray' && String(lg.pid) === '12', 'two controller rays: a stick scroll on the RIGHT ray is classed LOOK (' + JSON.stringify(lg && { cls: lg.cls, why: lg.why, pid: lg.pid }) + ')');
    chk(Math.abs(a1.yaw - a0.yaw) > 0.1 && Math.hypot(a1.x - a0.x, a1.z - a0.z) < 0.05 && (await QF(page)).moves === m0b, 'right stick turns the camera (yaw ' + (a1.yaw - a0.yaw).toFixed(2) + ') and does NOT move the player (' + Math.hypot(a1.x - a0.x, a1.z - a0.z).toFixed(3) + ' m)');
    await wheelAt(25, { deltaX: 0, deltaY: -60, clientX: 110, clientY: 151 }); await page.waitForTimeout(100);
    let a2 = await pose(); lg = await page.evaluate(() => window.__gaQuestPad.evLog[0]);
    chk(lg && lg.cls === 'MOVE' && Math.hypot(a2.x - a1.x, a2.z - a1.z) > 0.2 && Math.abs(a2.yaw - a1.yaw) < 1e-6, 'left-ray stick scroll walks without turning (' + Math.hypot(a2.x - a1.x, a2.z - a1.z).toFixed(2) + ' m)');
    await page.waitForTimeout(400);
    await page.waitForTimeout(600);
    // debug overlay shows raw events + class
    await ray(11, 110, 150); await ray(12, 370, 150);
    await wheelAt(1, { deltaX: 60, deltaY: 0, clientX: 370, clientY: 151 });
    const dbg = await page.evaluate(() => { window.__gaQuestPad.showDebug(true); const t = document.getElementById('gaQdbg').textContent; window.__gaQuestPad.showDebug(false); return t; });
    chk(/VR v9/.test(dbg) && /last stick events/.test(dbg) && /-> MOVE \(2ray\)/.test(dbg) && /-> LOOK \(2ray\)/.test(dbg) && /rays 11:touch@/.test(dbg), '?qdbg overlay lists rays and each stick event with its class + reason');
    // STICK SETUP calibration: one ray, same spot, but the sticks differ in deltaMode (pixels vs lines)
    // ---- t369u: while FLYING (jetpack), the left stick moves the player, the right stick only turns ----
    await page.evaluate(() => { const a = window.__arcade; window.__gaPlayer.p.back = 'jetpack'; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); a.st.fly.e = 1; });
    await ray(11, 110, 150); await ray(12, 370, 150);
    // the LEFT controller holds FLY (bottom right) with its trigger; its stick comes through as a drag of that held pointer
    await page.evaluate(() => { const b = document.getElementById('bFly'), r = b.getBoundingClientRect(); window.__flyXY = [r.x + r.width / 2, r.y + r.height / 2];
      b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 11, pointerType: 'touch', clientX: window.__flyXY[0], clientY: window.__flyXY[1], bubbles: true, cancelable: true, buttons: 1 })); });
    await page.waitForFunction(() => window.__arcade.st.fly.air, null, { timeout: 8000 }).catch(() => {});
    await ray(12, 370, 150);
    const f0 = await pose();
    await page.evaluate(async () => { const b = document.getElementById('bFly'); let [x, y] = window.__flyXY;
      for (let i = 0; i < 30; i++) { y += 3; b.dispatchEvent(new PointerEvent('pointermove', { pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, buttons: 1 })); await new Promise(r => setTimeout(r, 16)); } });
    const f1 = await pose(); let fl = await page.evaluate(() => ({ air: window.__arcade.st.fly.air, hold: window.__arcade.st.fly.hold, ev: window.__gaQuestPad.evLog[0] }));
    chk(fl.air && fl.hold && fl.ev && fl.ev.src === 'held' && fl.ev.cls === 'MOVE' && Math.hypot(f1.x - f0.x, f1.z - f0.z) > 0.2, 'flying: the LEFT stick (held FLY ray) moves the player ' + Math.hypot(f1.x - f0.x, f1.z - f0.z).toFixed(2) + ' m ' + JSON.stringify({ air: fl.air, ev: fl.ev && [fl.ev.src, fl.ev.cls, fl.ev.why] }));
    // left stick as a plain wheel on the left ray, in the air
    await wheelAt(25, { deltaX: 0, deltaY: -60, clientX: 110, clientY: 151 }); await page.waitForTimeout(100);
    const f2 = await pose();
    chk((await page.evaluate(() => window.__arcade.st.fly.air)) && Math.hypot(f2.x - f1.x, f2.z - f1.z) > 0.2, 'flying: left-stick wheel moves the player ' + Math.hypot(f2.x - f1.x, f2.z - f1.z).toFixed(2) + ' m');
    await page.waitForTimeout(900); await ray(12, 370, 150);
    const f3 = await pose();
    await wheelAt(25, { deltaX: 60, deltaY: 0, clientX: 370, clientY: 151 }); await page.waitForTimeout(200);
    const f4 = await pose(); fl = await page.evaluate(() => ({ air: window.__arcade.st.fly.air, ev: window.__gaQuestPad.evLog[0] }));
    chk(fl.air && fl.ev.cls === 'LOOK' && Math.abs(f4.yaw - f3.yaw) > 0.1 && Math.hypot(f4.x - f3.x, f4.z - f3.z) < 0.08, 'flying: the RIGHT stick only turns (yaw ' + (f4.yaw - f3.yaw).toFixed(2) + ', moved ' + Math.hypot(f4.x - f3.x, f4.z - f3.z).toFixed(3) + ' m)');
    await page.evaluate(() => { const b = document.getElementById('bFly'); b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 11, pointerType: 'touch', bubbles: true })); window.__gaPlayer.p.back = 'none'; });
    await page.waitForFunction(() => !window.__arcade.st.fly.air, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800); await page.evaluate(() => { window.__gaQuestPad.calStart(); });
    const c0 = await pose();
    const hold = async (o, ph) => { const t0 = Date.now(); while (Date.now() - t0 < 4000 && (await page.evaluate(() => window.__gaQuestPad.calibrating)) === ph) await wheelAt(3, o); };
    await hold({ deltaX: 0, deltaY: 37.5, deltaMode: 0, clientX: 240, clientY: 60 }, 'L');
    await page.waitForFunction(() => window.__gaQuestPad.calibrating === 'R', null, { timeout: 5000 }).catch(() => {});
    await hold({ deltaX: 3, deltaY: 0, deltaMode: 1, clientX: 240, clientY: 60 }, 'R');
    const cb = await page.evaluate(() => ({ cal: window.__gaQuestPad.calib, running: window.__gaQuestPad.calibrating, msg: (document.getElementById('gaQcalMsg') || {}).textContent }));
    const c1 = await pose();
    chk(cb.cal && cb.cal.rules.some(r => r.k === 'mode' && r.L === '0' && r.R === '1') && !cb.running, 'STICK SETUP learns the difference (' + JSON.stringify(cb.cal && cb.cal.rules) + ') "' + cb.msg + '"');
    chk(Math.hypot(c1.x - c0.x, c1.z - c0.z) < 0.05 && Math.abs(c1.yaw - c0.yaw) < 1e-6, 'nothing moves while STICK SETUP is listening ' + JSON.stringify({ d: Math.hypot(c1.x - c0.x, c1.z - c0.z), dyaw: c1.yaw - c0.yaw, log: (await page.evaluate(() => window.__gaQuestPad.evLog.slice(0, 3).map(e => e.src + ' ' + e.cls + ' ' + e.why))) }));
    await page.waitForTimeout(400); let b0 = await pose();
    await wheelAt(25, { deltaX: 3, deltaY: 0, deltaMode: 1, clientX: 240, clientY: 60 }); await page.waitForTimeout(300);
    let b1 = await pose(); lg = await page.evaluate(() => window.__gaQuestPad.evLog[0]);
    chk(/^cal:/.test(lg.why) && lg.cls === 'LOOK' && Math.abs(b1.yaw - b0.yaw) > 0.05 && Math.hypot(b1.x - b0.x, b1.z - b0.z) < 0.05, 'after setup: the right stick pans only (' + lg.why + ')');
    await wheelAt(25, { deltaX: 0, deltaY: -37.5, deltaMode: 0, clientX: 240, clientY: 60 }); await page.waitForTimeout(100);
    let b2 = await pose(); lg = await page.evaluate(() => window.__gaQuestPad.evLog[0]);
    chk(lg.cls === 'MOVE' && Math.hypot(b2.x - b1.x, b2.z - b1.z) > 0.2, 'after setup: the left stick walks');
    const kept = await page.evaluate(() => !!localStorage.getItem('gaQuest.stickCal')); chk(kept, 'the setup is saved on the device');
    await page.evaluate(() => window.__gaQuestPad.calClear()); await page.waitForTimeout(400);
    // t366u/t367u: new pictures above the cabinets (13 painted icons in a 2048 atlas) + the claw icon's power-of-two, upload-once texture
    await page.waitForFunction(() => window.__gaVR.icons().done && window.__gaVR.icons().claw, null, { timeout: 20000 }).catch(() => {});
    const ic = await page.evaluate(() => { const r = window.__gaVR.icons(), cv = window.__neonIcons.material.map.image, g = cv.getContext('2d'), C = cv.width / 4;
      const keys = ['strike', 'ghost', 'cyber', 'orc', 'pip', 'berserker', 'monkey', 'nova', 'blaster', 'bb', 'rockfall', 'skytower', 'roadster'];
      r.opaque = keys.map(k => { const i = keys.indexOf(k), d = g.getImageData((i % 4) * C, Math.floor(i / 4) * C, C, C).data; let n = 0; for (let j = 3; j < d.length; j += 16) if (d[j] > 200) n++; return n / (d.length / 16); });
      return r; });
    chk(ic.done && ic.loaded.length === 13 && !ic.failed.length && ic.atlas === 2048, 'all 13 new cabinet pictures loaded into a 2048 px atlas (' + ic.loaded.length + ', failed ' + ic.failed.join(',') + ')');
    chk(ic.opaque.every(v => v > 0.12), 'every picture cell has solid art in it (min ' + Math.min(...ic.opaque).toFixed(2) + ')');
    chk(ic.claw && ic.clawTex === 2048, 'claw icon uses a 2048x256 power-of-two texture');
    const cl = await page.evaluate(async () => { const c = window.__neonClawIcon, t = c.material.map, v0 = t.version, o0 = t.offset.x; await new Promise(r => setTimeout(r, 2000)); return { v0, v1: t.version, o0, o1: t.offset.x }; });
    chk(cl.o0 !== cl.o1 && cl.v1 === cl.v0, 'claw still animates (offset ' + cl.o0.toFixed(2) + ' -> ' + cl.o1.toFixed(2) + ') with no texture re-uploads (version ' + cl.v0 + ' -> ' + cl.v1 + ')');
    // in-game OPTIONS: free with 0 tickets
    const op = await page.evaluate(() => { const O = window.__opts; O.pickRoom('floor', 'ice'); O.pickRoom('walls', 'portals'); const a = window.__gaVR.room();
      return { f: a.floor, w: a.walls, t: localStorage.getItem('neonarcade.tickets') }; });
    chk(op.f === 'ice' && op.w === 'portals' && op.t === '0', 'OPTIONS floor/walls change with 0 tickets and cost nothing (' + op.f + '/' + op.w + ', tickets ' + op.t + ')');
    const note = await page.evaluate(() => { const n = document.getElementById('opRoomNote'); window.__opts.pickRoom('floor', 'lava'); return n ? n.textContent : ''; });
    chk(!/COSTS|NEED/.test(note), 'OPTIONS note no longer mentions a ticket cost ("' + note + '")');
    // reload: back to cobble + medieval
    await page.reload(); await page.waitForFunction(() => window.__arcade && window.__arcade.stats.frames > 3 && window.__gaVR, null, { timeout: 60000 });
    const r1 = await page.evaluate(() => window.__gaVR.room());
    chk(r1.floor === 'cobble' && r1.walls === 'medieval', 'after a reload: cobblestone + medieval again');
    chk(!errors.length, 'no page errors (flat) ' + errors.slice(0, 2).join(' | '));
  } catch (e) { chk(false, 'flat crashed: ' + e); }
  await o.close();
  // ---------------- VR session on the same Quest UA: quest-pad input is ignored; the headset menu picker is free ----------------
  o = await openVR({ init: { content: IWER_SRC + SETUP + FAKE } }); page = o.page; errors = o.errors;
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    const s0 = await QF(page);
    await page.evaluate(() => { const Q = window.__gaQuestPad; for (let i = 0; i < 20; i++) { Q.ingest('wheel', 0, 0.9); Q.ingestLook('wheel', 0.9, 0); } });
    await H.frames(page, 8);
    const s1 = await QF(page);
    chk(s1.xrSkips > s0.xrSkips && s1.moves === s0.moves && s1.looks === s0.looks && !s1.joy.on, 'in VR: the flat stick path does nothing (' + (s1.xrSkips - s0.xrSkips) + ' frames skipped)');
    // ---- t369u in VR: left stick moves while flying (hold A), right stick only turns ----
    await page.evaluate(() => { const a = window.__arcade; window.__gaPlayer.p.back = 'jetpack'; a.st.fly.e = 1; const S = window.__gaVR; S.rig = { x: 2, y: 0, z: 4, yaw: 0 }; S.applyRig(); a.monkey.position.set(2, 0, 4); });
    await H.btn(page, 'right', 'a-button', 1);
    await page.waitForFunction(() => window.__arcade.st.fly.air, null, { timeout: 8000 }).catch(() => {});
    const vp = () => page.evaluate(() => ({ x: window.__arcade.monkey.position.x, z: window.__arcade.monkey.position.z, y: window.__arcade.monkey.position.y, rot: window.__gaVR.rig.yaw }));
    const v0 = await vp(); await H.axes(page, 'left', 0, -1); await page.waitForTimeout(700); await H.axes(page, 'left', 0, 0); const v1 = await vp();
    chk((await page.evaluate(() => window.__arcade.st.fly.air)) && Math.hypot(v1.x - v0.x, v1.z - v0.z) > 0.3, 'VR flying: the left stick moves the player ' + Math.hypot(v1.x - v0.x, v1.z - v0.z).toFixed(2) + ' m (height ' + v1.y.toFixed(2) + ')');
    await page.waitForTimeout(700); const v2 = await vp(); await H.axes(page, 'right', 1, 0); await page.waitForTimeout(700); await H.axes(page, 'right', 0, 0); const v3 = await vp();
    chk(Math.abs(v3.rot - v2.rot) > 0.2 && Math.hypot(v3.x - v2.x, v3.z - v2.z) < 0.08, 'VR flying: the right stick only turns (turn ' + (v3.rot - v2.rot).toFixed(2) + ', moved ' + Math.hypot(v3.x - v2.x, v3.z - v2.z).toFixed(3) + ' m)');
    await H.btn(page, 'right', 'a-button', 0); await page.evaluate(() => { window.__gaPlayer.p.back = 'none'; });
    await page.waitForFunction(() => !window.__arcade.st.fly.air, null, { timeout: 15000 }).catch(() => {});
    const ix = await page.evaluate(() => window.__gaVR.icons()); chk(ix.done && ix.loaded.length === 13 && ix.claw, 'VR: new pictures + claw fix are in place');
    const r = await page.evaluate(() => window.__gaVR.room());
    chk(r.floor === 'cobble' && r.walls === 'medieval', 'VR load also starts cobble + medieval');
    // open the Y/B menu -> FLOOR + WALLS
    const LOCAL = [0.2, 1.3, -0.2];
    const btnAt = id => page.evaluate(id => window.__gaVR.ui.btnWorld(id), id);
    const tap = async id => { await page.evaluate(() => { window.__gaVR.lastPress = null; }); for (let i = 0; i < 3; i++) { const w = await btnAt(id); if (!w) throw new Error('no button ' + id); await H.aim(page, 'right', LOCAL, w); await H.frames(page, 3); await H.press(page, 'right', 'trigger'); await H.frames(page, 4); if (await page.evaluate(id => window.__gaVR.lastPress === id, id)) return true; } return false; };
    await page.evaluate(() => { const a = window.__arcade; window.__gaVR.rig = { x: 2, y: 0, z: 4, yaw: 0 }; window.__gaVR.applyRig(); a.monkey.position.set(2, 0, 4); });
    await page.evaluate(() => window.__gaVR.ui.open('menu')); await H.frames(page, 4);
    chk(!!(await btnAt('room')), 'the headset menu has a FLOOR + WALLS button');
    chk(await tap('room'), 'FLOOR + WALLS opens');
    await H.frames(page, 3);
    const t0 = await page.evaluate(() => localStorage.getItem('neonarcade.tickets'));
    chk(await tap('fl_checkers'), 'tap CHECKERS');
    let rr = await page.evaluate(() => window.__gaVR.room());
    chk(rr.floor === 'checkers', 'floor changes right away in the headset (' + rr.floor + ')');
    chk(await tap('rt_walls'), 'WALLS tab'); await H.frames(page, 3);
    chk(await tap('wl_viking'), 'tap VIKING RUNES');
    rr = await page.evaluate(() => window.__gaVR.room());
    chk(rr.walls === 'viking' && rr.picks >= 2 && (await page.evaluate(() => localStorage.getItem('neonarcade.tickets'))) === t0, 'walls change right away, free (tickets ' + t0 + ' unchanged)');
    chk(await tap('rback'), 'BACK to the menu');
    chk(!errors.length, 'no page errors (VR) ' + errors.slice(0, 2).join(' | '));
  } catch (e) { chk(false, 'VR crashed: ' + e); }
  await o.close();
  console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
