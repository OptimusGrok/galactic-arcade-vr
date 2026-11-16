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
    const rays2 = (x1 = 110, x2 = 370, y = 150) => page.evaluate(async ([x1, x2, y]) => { for (let i = 0; i < 4; i++) { for (const [id, x] of [[11, x1], [12, x2]]) window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, pointerType: 'touch', clientX: x, clientY: y + i, bubbles: true })); await new Promise(r => setTimeout(r, 8)); } }, [x1, x2, y]);   // two live rays, interleaved
    const ray = (id, x, y) => page.evaluate(([id, x, y]) => { for (let i = 0; i < 3; i++) window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, pointerType: 'touch', clientX: x, clientY: y + i, bubbles: true })); }, [id, x, y]);
    const pose = () => page.evaluate(() => ({ x: window.__arcade.monkey.position.x, z: window.__arcade.monkey.position.z, yaw: window.__arcade.st.yaw }));
    await page.evaluate(() => { const a = window.__arcade; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); });
    await rays2(); await page.waitForTimeout(300);
    let a0 = await pose(), m0b = (await QF(page)).moves;
    await wheelAt(25, { deltaX: 60, deltaY: 0, clientX: 370, clientY: 151 }); await page.waitForTimeout(300);
    let a1 = await pose(); let lg = await page.evaluate(() => window.__gaQuestPad.evLog[0]);
    chk(lg && lg.cls === 'LOOK' && /^(2ray|lock R)$/.test(lg.why) && String(lg.pid) === '12', 'two controller rays: a stick scroll on the RIGHT ray is classed LOOK (' + JSON.stringify(lg && { cls: lg.cls, why: lg.why, pid: lg.pid }) + ')');
    chk(Math.abs(a1.yaw - a0.yaw) > 0.1 && Math.hypot(a1.x - a0.x, a1.z - a0.z) < 0.05 && (await QF(page)).moves === m0b, 'right stick turns the camera (yaw ' + (a1.yaw - a0.yaw).toFixed(2) + ') and does NOT move the player (' + Math.hypot(a1.x - a0.x, a1.z - a0.z).toFixed(3) + ' m)');
    await wheelAt(25, { deltaX: 0, deltaY: -60, clientX: 110, clientY: 151 }); await page.waitForTimeout(100);
    let a2 = await pose(); lg = await page.evaluate(() => window.__gaQuestPad.evLog[0]);
    chk(lg && lg.cls === 'MOVE' && Math.hypot(a2.x - a1.x, a2.z - a1.z) > 0.2 && Math.abs(a2.yaw - a1.yaw) < 1e-6, 'left-ray stick scroll walks without turning (' + Math.hypot(a2.x - a1.x, a2.z - a1.z).toFixed(2) + ' m)');
    // ---- t377u: walking AND turning at the same time (left stick walks while the right stick looks) ----
    // (a) both sticks as interleaved wheels on their own rays; (b) left wheel walking + the right stick on the scroll channel (sentinel
    // scroll right after a wheel: v9 dropped every scroll/visualViewport event within 50 ms of ANY wheel, so walking muted the camera).
    await page.waitForTimeout(500); await page.evaluate(() => { const a = window.__arcade; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); });
    await rays2(); await page.waitForTimeout(200);
    let s0 = await pose(), qs0 = await QF(page);
    await page.evaluate(async () => { const cv = document.querySelector('canvas');
      for (let i = 0; i < 30; i++) {
        cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: -60, clientX: 110, clientY: 151, bubbles: true, cancelable: true }));
        cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 60, deltaY: 0, clientX: 370, clientY: 151, bubbles: true, cancelable: true }));
        await new Promise(r => setTimeout(r, 16)); } });
    let s1 = await pose(), qs1 = await QF(page);
    chk(Math.hypot(s1.x - s0.x, s1.z - s0.z) > 0.2 && Math.abs(s1.yaw - s0.yaw) > 0.1 && qs1.moves > qs0.moves && qs1.looks > qs0.looks, 'both sticks at once (interleaved wheels): walks ' + Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(2) + ' m AND turns ' + (s1.yaw - s0.yaw).toFixed(2) + ' rad');
    await page.waitForTimeout(500); await page.evaluate(() => { const a = window.__arcade; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); });
    s0 = await pose(); qs0 = await QF(page);
    await page.evaluate(async () => { const cv = document.querySelector('canvas'), sn = document.getElementById('gaQscroll'), mx = Math.floor((sn.scrollWidth - sn.clientWidth) / 2);
      for (let i = 0; i < 45; i++) {
        cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: -60, clientX: 110, clientY: 151, bubbles: true, cancelable: true }));   // left stick: wheel on the left ray
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 12, pointerType: 'touch', clientX: 370, clientY: 150, bubbles: true }));   // right ray active
        sn.scrollLeft = mx + 40; sn.dispatchEvent(new Event('scroll'));   // right stick: the scroll channel, right after the left wheel
        await new Promise(r => setTimeout(r, 16)); } });
    s1 = await pose(); qs1 = await QF(page);
    chk(Math.hypot(s1.x - s0.x, s1.z - s0.z) > 0.2 && Math.abs(s1.yaw - s0.yaw) > 0.1, 'walking (wheel) + turning (scroll channel) together: walks ' + Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(2) + ' m AND turns ' + (s1.yaw - s0.yaw).toFixed(2) + ' rad');
    // ---- v12 (t383u): the hand lock never flips. Both sticks scroll while the two rays swing ACROSS each other on the screen (left ray
    // ends up far right, right ray far left), then each controller gets a new pointerId (Quest re-ids a ray per press). ----
    await page.waitForTimeout(500); await page.evaluate(() => { const a = window.__arcade; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); });
    s0 = await pose(); qs0 = await QF(page);
    const sw = await page.evaluate(async () => { const cv = document.querySelector('canvas'), Q = window.__gaQuestPad, out = { L: {}, R: {}, flips: 0, n: 0 }; let prevL = null, prevR = null;
      const mv = (id, x, y) => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
      for (let i = 0; i <= 40; i++) { const k = i / 40, xl = 60 + 360 * k, xr = 420 - 360 * k, yl = 140 + 30 * Math.sin(i / 3), yr = 200 - 30 * Math.cos(i / 4);   // left ray sweeps right, right ray sweeps left
        mv(11, xl, yl); mv(12, xr, yr);
        cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: -60, clientX: xl, clientY: yl, bubbles: true, cancelable: true })); let e = Q.evLog[0]; out.L[e.cls] = (out.L[e.cls] || 0) + 1; if (prevL && prevL !== e.cls) out.flips++; prevL = e.cls;
        cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 60, deltaY: 0, clientX: xr, clientY: yr, bubbles: true, cancelable: true })); e = Q.evLog[0]; out.R[e.cls] = (out.R[e.cls] || 0) + 1; if (prevR && prevR !== e.cls) out.flips++; prevR = e.cls; out.n++;
        await new Promise(r => setTimeout(r, 16)); }
      out.hands = Q.hands; return out; });
    s1 = await pose(); qs1 = await QF(page);
    chk(sw.flips === 0 && sw.L.MOVE === sw.n && sw.R.LOOK === sw.n && sw.hands['11'] === 'L' && sw.hands['12'] === 'R', 'rays swung across each other while both sticks scroll: the classification never flips (' + JSON.stringify(sw) + ')');
    chk(Math.hypot(s1.x - s0.x, s1.z - s0.z) > 0.2 && Math.abs(s1.yaw - s0.yaw) > 0.1, 'and it walks ' + Math.hypot(s1.x - s0.x, s1.z - s0.z).toFixed(2) + ' m AND turns ' + (s1.yaw - s0.yaw).toFixed(2) + ' rad at the same time');
    const reid = await page.evaluate(async () => { const cv = document.querySelector('canvas'), Q = window.__gaQuestPad, mv = (id, x, y) => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
      const r = {}; await new Promise(res => setTimeout(res, 300)); mv(12, 60, 200); mv(21, 420, 150); mv(21, 421, 151);   // the LEFT controller (now pointing far right) comes back with a new id while the right ray is live
      cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: -60, clientX: 421, clientY: 151, bubbles: true, cancelable: true })); r.a = Q.evLog[0].cls + ' ' + Q.evLog[0].why;
      await new Promise(res => setTimeout(res, 1700));   // both quiet; the right controller returns with a new id next to where ray 12 was
      mv(22, 64, 204); mv(22, 66, 205);
      cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 60, deltaY: 0, clientX: 66, clientY: 205, bubbles: true, cancelable: true })); r.b = Q.evLog[0].cls + ' ' + Q.evLog[0].why;
      r.hands = Q.hands; r.log = Q.lockLog; return r; });
    chk(/^MOVE/.test(reid.a) && /^LOOK/.test(reid.b) && reid.hands['21'] === 'L' && reid.hands['22'] === 'R', 'a controller that comes back with a new pointerId keeps its hand (' + JSON.stringify(reid) + ')');
    // ---- v12: Dave's real Quest (?qdbg photo): ONE live ray at a time (a new touch pointerId per press, older ids quiet for seconds), both sticks
    // as a plain wheel dy at that ray. v9 compared the live ray with a QUIET one, so the class flipped with where the new id appeared.
    // Now: one live ray -> the wheel always walks; turning = trigger-drag on the 3D view (or STICK LOOK / STICK SETUP). ----
    await page.waitForTimeout(1700); await page.evaluate(() => window.__gaQuestPad.resetHands());
    const one = await page.evaluate(async () => { const cv = document.querySelector('canvas'), Q = window.__gaQuestPad, out = { cls: {}, why: {}, n: 0 };
      // ONE controller ray sweeps the whole screen (left edge -> right edge and back) while the stick scrolls; every 10 steps a press gives
      // it a new pointerId at the same spot (as on Dave's Quest: ids 2..9, only the newest live)
      let id = 31, x = 30, dir = 1;
      for (let i = 0; i < 80; i++) { if (i && i % 10 === 0) id++; x += dir * 19; if (x > 760 || x < 30) dir = -dir;
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, pointerType: 'touch', clientX: x, clientY: 300 + (i % 7), bubbles: true }));
        cv.dispatchEvent(new WheelEvent('wheel', { deltaX: i % 3 ? 0 : -22, deltaY: (i & 1 ? 25 : -28), clientX: x, clientY: 302, bubbles: true, cancelable: true })); const e = Q.evLog[0]; out.cls[e.cls] = (out.cls[e.cls] || 0) + 1; out.why[e.why] = (out.why[e.why] || 0) + 1; out.n++;
        await new Promise(res => setTimeout(res, 16)); }
      out.hands = Q.hands; out.hint = (document.getElementById('gaQcalMsg') || {}).textContent || ''; out.oneRay = Q.oneRay; return out; });
    chk(!one.cls.LOOK && one.cls.MOVE === one.n && Object.keys(one.hands).length === 0, 'one live ray sweeping the whole screen + re-ids per press: the stick wheel ALWAYS walks, never flips ' + JSON.stringify(one));
    chk(/TRIGGER/.test(one.hint) && /drag/.test(one.hint), 'one-ray headset: an on-screen hint says how to turn ("' + one.hint + '")');
    await page.waitForTimeout(500);
    const dg0 = await pose();
    await page.evaluate(async () => { const cv = document.querySelector('canvas'); let x = 300, y = 200;
      cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, pointerType: 'touch', clientX: x, clientY: y, buttons: 1, bubbles: true, cancelable: true }));
      for (let i = 0; i < 20; i++) { x += 6; cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: 41, pointerType: 'touch', clientX: x, clientY: y, buttons: 1, bubbles: true })); await new Promise(r => setTimeout(r, 16)); }
      cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); });
    const dg1 = await pose(), dl = await page.evaluate(() => window.__gaQuestPad.dragLook);
    chk(Math.abs(dg1.yaw - dg0.yaw) > 0.3 && Math.hypot(dg1.x - dg0.x, dg1.z - dg0.z) < 0.05 && dl.n > 5, 'trigger-drag on the 3D view turns the camera (yaw ' + (dg1.yaw - dg0.yaw).toFixed(2) + ') without walking ' + JSON.stringify(dl));
    const dbg1 = await page.evaluate(() => { window.__gaQuestPad.showDebug(true); const t = document.getElementById('gaQdbg').textContent; window.__gaQuestPad.showDebug(false); return t; });
    chk(/MODE 1 RAY: stick wheel = MOVE always.*TURN = trigger-drag/.test(dbg1) && /-> MOVE \(1ray\)/.test(dbg1) && /drag-turns \d+/.test(dbg1), '?qdbg=1 shows the mode (1 RAY), the turn alternative and each event (1ray)');
    // ---- v12 (Dave's 2nd photo): LEFT stick pushed sideways = wheel dx (MOVE) while the Quest also reports that ray pressed and dragging
    // (touch + pointer drag). v11 turned the camera from that drag; now the drag is ignored while stick wheels arrive: strafe only. ----
    await page.waitForTimeout(600); await page.evaluate(() => { window.__gaQuestPad.resetHands(); const a = window.__arcade; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); });
    const sd0 = await pose(), blk0 = await page.evaluate(() => window.__gaQuestPad.dragBlocked);
    await page.evaluate(async () => { const cv = document.querySelector('canvas'); let x = 748, y = 209; const T = (type, xx) => { const t = new Touch({ identifier: 6, target: cv, clientX: xx, clientY: y }); cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] })); };
      cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 6, pointerType: 'touch', clientX: x, clientY: y, buttons: 1, bubbles: true, cancelable: true })); T('touchstart', x);
      cv.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, buttons: 1, bubbles: true }));
      for (let i = 0; i < 30; i++) { cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 22, deltaY: 0, clientX: x, clientY: y, bubbles: true, cancelable: true })); x += 4;
        cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: 6, pointerType: 'touch', clientX: x, clientY: y, buttons: 1, bubbles: true })); T('touchmove', x);
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, buttons: 1, bubbles: true }));
        await new Promise(r => setTimeout(r, 16)); }
      T('touchend', x); window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: 6, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); });
    const sd1 = await pose(), blk1 = await page.evaluate(() => window.__gaQuestPad.dragBlocked);
    chk(Math.abs(sd1.yaw - sd0.yaw) < 1e-6 && Math.hypot(sd1.x - sd0.x, sd1.z - sd0.z) > 0.2 && blk1 > blk0, 'left stick sideways (wheel dx + the Quest\'s pressed-ray drag): strafes ' + Math.hypot(sd1.x - sd0.x, sd1.z - sd0.z).toFixed(2) + ' m, camera does NOT turn (yaw ' + (sd1.yaw - sd0.yaw).toFixed(3) + ', ' + (blk1 - blk0) + ' stick drags ignored)');
    // ---- v12 (t382u): GRIP = BACK in flat Quest mode: every grip candidate -> the game's Escape (and counted in ?qdbg=1) ----
    const gb = await page.evaluate(async () => { const Q = window.__gaQuestPad; let esc = 0; const h = e => { if (e.code === 'Escape') esc++; }; addEventListener('keydown', h, true);
      const w = ms => new Promise(r => setTimeout(r, ms));
      document.querySelector('canvas').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })); await w(300);
      const e1 = esc;
      window.__pads = [{ id: 'Oculus Touch (Right)', index: 1, hand: 'right', mapping: 'xr-standard', connected: true, axes: [0, 0, 0, 0], buttons: [{ pressed: false, value: 0 }, { pressed: true, value: 1 }] }]; await w(300);
      window.__pads = []; await w(100); const e2 = esc;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'BrowserBack', code: 'BrowserBack', bubbles: true, cancelable: true })); await w(300); const e3 = esc;
      removeEventListener('keydown', h, true); Q.showDebug(true); const t = document.getElementById('gaQdbg').textContent; Q.showDebug(false);
      return { e1, e2, e3, backs: Q.backs, dbg: (t.match(/grip\/back[^\n]*/) || [''])[0] }; });
    chk(gb.e1 === 1 && gb.e2 === 2 && gb.e3 === 3 && gb.backs.contextmenu === 1 && gb.backs['gamepad grip right'] === 1 && /grip\/back .*contextmenu=1/.test(gb.dbg), 'flat Quest GRIP = back: contextmenu / gamepad grip / BrowserBack each send the game\'s Escape once, listed in ?qdbg=1 ' + JSON.stringify(gb));
    await page.waitForTimeout(600);
    // debug overlay shows raw events + class
    await rays2();
    await wheelAt(1, { deltaX: 0, deltaY: -60, clientX: 110, clientY: 151 }); await wheelAt(1, { deltaX: 60, deltaY: 0, clientX: 370, clientY: 151 });
    const dbg = await page.evaluate(() => { window.__gaQuestPad.showDebug(true); const t = document.getElementById('gaQdbg').textContent; window.__gaQuestPad.showDebug(false); return t; });
    chk(/VR v12/.test(dbg) && /last stick events/.test(dbg) && /-> MOVE \((2ray|lock L)\)/.test(dbg) && /-> LOOK \((2ray|lock R)\)/.test(dbg) && /[ |]11\[L\]:touch@/.test(dbg) && /hand lock ray11=L\(MOVE\)/.test(dbg) && /ray12=R\(LOOK\)/.test(dbg), '?qdbg overlay lists rays and each stick event with its class + reason');
    // STICK SETUP calibration: one ray, same spot, but the sticks differ in deltaMode (pixels vs lines)
    // ---- t369u: while FLYING (jetpack), the left stick moves the player, the right stick only turns ----
    await page.evaluate(() => { const a = window.__arcade; window.__gaPlayer.p.back = 'jetpack'; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); a.st.fly.e = 1; });
    await rays2();
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
    await page.waitForTimeout(800); await page.evaluate(() => { const a = window.__arcade; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); a.st.lookT = a.st.t; }); await page.waitForTimeout(1500); await page.evaluate(() => { window.__gaQuestPad.calStart(); });   // v12: away from the STRIKE showcase swing
    const c0 = await pose(); await page.evaluate(() => { window.__yawLog = []; const A = window.__arcade; window.__yawT = setInterval(() => window.__yawLog.push([+A.st.yaw.toFixed(3), +(A.st.showK || 0).toFixed(2), A.st.fly.air ? 1 : 0, +A.monkey.position.x.toFixed(2), +A.monkey.position.z.toFixed(2)]), 200); });
    const hold = async (o, ph) => { const t0 = Date.now(); while (Date.now() - t0 < 4000 && (await page.evaluate(() => window.__gaQuestPad.calibrating)) === ph) await wheelAt(1, o); };   // one event per check: no burst tail after the setup finishes
    await hold({ deltaX: 0, deltaY: 37.5, deltaMode: 0, clientX: 240, clientY: 60 }, 'L');
    await page.waitForFunction(() => window.__gaQuestPad.calibrating === 'R', null, { timeout: 5000 }).catch(() => {});
    await hold({ deltaX: 3, deltaY: 0, deltaMode: 1, clientX: 240, clientY: 60 }, 'R');
    const cb = await page.evaluate(() => ({ cal: window.__gaQuestPad.calib, running: window.__gaQuestPad.calibrating, msg: (document.getElementById('gaQcalMsg') || {}).textContent }));
    const c1 = await pose();
    chk(cb.cal && cb.cal.rules.some(r => r.k === 'mode' && r.L === '0' && r.R === '1') && !cb.running, 'STICK SETUP learns the difference (' + JSON.stringify(cb.cal && cb.cal.rules) + ') "' + cb.msg + '"');
    chk(Math.hypot(c1.x - c0.x, c1.z - c0.z) < 0.05 && Math.abs(c1.yaw - c0.yaw) < 0.005, 'nothing moves while STICK SETUP is listening ' + JSON.stringify({ yl: await page.evaluate(() => window.__yawLog.slice(0, 25)), d: Math.hypot(c1.x - c0.x, c1.z - c0.z), dyaw: c1.yaw - c0.yaw, log: (await page.evaluate(() => window.__gaQuestPad.evLog.slice(0, 3).map(e => e.src + ' ' + e.cls + ' ' + e.why))) }));
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
