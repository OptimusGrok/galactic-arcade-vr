// v13 (t391u-t393u): Quest Browser 2D. Dave: "still swapping and now both sticks move the camera". The 2D browser cannot tell the sticks
// apart, so by default every stick signal WALKS and NOTHING a stick sends turns the camera. Replays the event patterns from Dave's three
// ?qdbg photos (plain wheel ~20 px steps at ~82/s, dx or dy, touch pointermove from the ray with buttons=0, the pressed-ray drag a sideways
// push adds) and asserts ZERO yaw change. TURN = hold the on-screen turn buttons (or a real trigger-held drag); handed gamepads (if a
// browser ever exposes them) = the real split. An old STICK SETUP saved by v9-v12 is wiped. ?qdbg=1 shows the version + every yaw cause.
const { open } = require('./lib');
const QUA = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/37.0.0 SamsungBrowser/4.0 Chrome/130.0.0.0 VR Safari/537.36';
const FAKE = `Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ${JSON.stringify(QUA)} });
  window.__pads = []; Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => window.__pads });
  if (window === window.top && !sessionStorage.getItem('q13seed')) try { sessionStorage.setItem('q13seed', '1');
    localStorage.setItem('gaQuest.ver', 'v12'); localStorage.setItem('gaQuest.stickCal', JSON.stringify({ rules: [{ k: 'step', L: '4', R: '4.5' }, { k: 'src', L: 'wheel', R: 'scroll' }], at: 1 })); } catch (e) {}`;
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await open({ w: 480, h: 270, init: { content: FAKE } });
  const pose = () => page.evaluate(() => ({ x: window.__arcade.monkey.position.x, z: window.__arcade.monkey.position.z, yaw: window.__arcade.st.yaw }));
  const reset = () => page.evaluate(() => { const a = window.__arcade; a.monkey.position.set(2, 0, 4); a.st.vel.set(0, 0, 0); });
  const dbg = () => page.evaluate(() => { const Q = window.__gaQuestPad; Q.showDebug(true); const t = document.getElementById('gaQdbg').textContent; Q.showDebug(false); return t; });
  try {
    const v = await page.evaluate(() => ({ q: window.__gaQuestPad.isQuest(), ver: window.__gaQuestPad.VER, split: window.__gaQuestPad.split, cal: localStorage.getItem('gaQuest.stickCal'), lsv: localStorage.getItem('gaQuest.ver'), page: window.__GA_VR }));
    chk(v.q && v.ver === 'v13' && !v.split && v.page === 'vr13', 'Quest flat, quest-pad v13, page vr13, classifier off by default ' + JSON.stringify(v));
    chk(v.cal === null && v.lsv === 'v13', 'an old STICK SETUP saved by v12 is wiped on the version change');
    await page.waitForTimeout(400);
    const vis = await page.evaluate(() => ({ cal: (document.getElementById('gaQcal') || { hidden: true }).hidden, look: (document.getElementById('gaQlook') || { hidden: true }).hidden, tl: !!document.getElementById('gaQturnL') && !document.getElementById('gaQturnL').hidden, tr: !!document.getElementById('gaQturnR') && !document.getElementById('gaQturnR').hidden }));
    chk(vis.cal && vis.look && vis.tl && vis.tr, 'STICK SETUP / STICK LOOK hidden; the turn buttons show ' + JSON.stringify(vis));
    // ---- Dave's photos: replay, ZERO yaw ----
    const replay = (kind) => page.evaluate(async (kind) => { const cv = document.querySelector('canvas'), w = ms => new Promise(r => setTimeout(r, ms)); let x = kind === 'right' ? 380 : 110, y = 150, id = kind === 'right' ? 9 : 7;
      const T = (type, xx) => { const t = new Touch({ identifier: 6, target: cv, clientX: xx, clientY: y }); cv.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] })); };
      if (kind === 'side') { cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, button: 0, buttons: 1, bubbles: true, cancelable: true })); T('touchstart', x); cv.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, buttons: 1, bubbles: true })); }
      for (let i = 0; i < 50; i++) {   // ~82 events/s, ~20 px steps
        const dx = kind === 'side' || kind === 'dx' ? (i % 4 ? 20 : 19) : 0, dy = kind === 'side' || kind === 'dx' ? 0 : -(i % 4 ? 20 : 21);
        if (kind === 'side') { x += 3; cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, buttons: 1, bubbles: true })); T('touchmove', x); window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, buttons: 1, bubbles: true })); }
        else { x += (i & 1 ? 2 : -1); window.dispatchEvent(new PointerEvent('pointermove', { pointerId: id, pointerType: 'touch', clientX: x, clientY: y + (i % 3), buttons: 0, bubbles: true })); }
        cv.dispatchEvent(new WheelEvent('wheel', { deltaX: dx, deltaY: dy, deltaMode: 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
        if (i % 5 === 0) { const sn = document.getElementById('gaQscroll'); if (sn) { sn.scrollTop += dy ? Math.sign(dy) * 20 : 0; sn.scrollLeft += dx ? 20 : 0; sn.dispatchEvent(new Event('scroll')); } }
        await w(12); }
      if (kind === 'side') { T('touchend', x); window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); } }, kind);
    for (const [kind, what] of [['left', 'photo 1: LEFT stick forward (plain wheel dy at the left ray, touch hover buttons=0)'], ['right', 'photo 3: RIGHT stick forward (same wheel at the right ray)'], ['dx', 'photo 2: stick sideways (wheel dx, hover ray)'], ['side', 'photo 2: stick sideways + the pressed-ray / touch / mouse drag the Quest adds']]) {
      await reset(); await page.waitForTimeout(300); const a = await pose(); await replay(kind); await page.waitForTimeout(150); const b = await pose();
      chk(Math.abs(b.yaw - a.yaw) < 1e-9 && Math.hypot(b.x - a.x, b.z - a.z) > 0.2, what + ': walks ' + Math.hypot(b.x - a.x, b.z - a.z).toFixed(2) + ' m, yaw change ' + (b.yaw - a.yaw).toExponential(1));
      await page.waitForTimeout(400); }
    // ctrl+wheel / zoom channel: nothing a stick makes turns the camera
    await reset(); let a = await pose();
    await page.evaluate(async () => { const cv = document.querySelector('canvas'); for (let i = 0; i < 25; i++) { cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 40, ctrlKey: true, bubbles: true, cancelable: true, clientX: 200, clientY: 120 })); await new Promise(r => setTimeout(r, 16)); } });
    let b = await pose(); const ign = await page.evaluate(() => window.__gaQuestPad.lookIgnored);
    chk(Math.abs(b.yaw - a.yaw) < 1e-9, 'ctrl+wheel (old LOOK channel) does not turn either (yaw ' + (b.yaw - a.yaw).toExponential(1) + ')');
    const Y0 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__gaYaw.by)));
    chk(!Object.keys(Y0).length, 'no yaw cause logged at all during the stick replays ' + JSON.stringify(Y0));
    // ---- turn buttons ----
    await page.waitForTimeout(500); await reset(); a = await pose();
    const hold = (id, ms) => page.evaluate(async ([id, ms]) => { const b = document.getElementById(id), r = b.getBoundingClientRect(), o = { pointerId: 50, pointerType: 'touch', clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, button: 0, buttons: 1, bubbles: true, cancelable: true };
      b.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(res => setTimeout(res, ms)); b.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, { buttons: 0 }))); }, [id, ms]);
    await hold('gaQturnR', 600); await page.waitForTimeout(250); b = await pose();
    chk(b.yaw - a.yaw < -0.3 && Math.hypot(b.x - a.x, b.z - a.z) < 0.02, 'hold \u25B6: the camera turns right (yaw ' + (b.yaw - a.yaw).toFixed(2) + ' rad), no walking');
    await page.waitForTimeout(300); const c0 = await pose(); await page.waitForTimeout(300); const c1 = await pose();
    chk(Math.abs(c1.yaw - c0.yaw) < 1e-6, 'let go: the turn stops');
    await hold('gaQturnL', 600); await page.waitForTimeout(250); const d = await pose();
    chk(d.yaw - c1.yaw > 0.3, 'hold \u25C0: the camera turns left (yaw +' + (d.yaw - c1.yaw).toFixed(2) + ')');
    // trigger-held drag still turns; a hover drag (buttons=0) does not
    await page.waitForTimeout(400); a = await pose();
    await page.evaluate(async () => { const cv = document.querySelector('canvas'); let x = 200; cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 61, pointerType: 'touch', clientX: x, clientY: 150, button: 0, buttons: 1, bubbles: true, cancelable: true }));
      for (let i = 0; i < 20; i++) { x += 6; cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: 61, pointerType: 'touch', clientX: x, clientY: 150, buttons: 1, bubbles: true })); await new Promise(r => setTimeout(r, 16)); }
      cv.dispatchEvent(new PointerEvent('pointerup', { pointerId: 61, pointerType: 'touch', clientX: x, clientY: 150, bubbles: true })); });
    b = await pose(); chk(Math.abs(b.yaw - a.yaw) > 0.3, 'trigger held on the 3D view + drag turns (yaw ' + (b.yaw - a.yaw).toFixed(2) + ')');
    a = b; await page.evaluate(async () => { const cv = document.querySelector('canvas'); let x = 200; for (let i = 0; i < 20; i++) { x += 6; window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 62, pointerType: 'touch', clientX: x, clientY: 150, buttons: 0, bubbles: true })); await new Promise(r => setTimeout(r, 16)); } });
    b = await pose(); chk(Math.abs(b.yaw - a.yaw) < 1e-9, 'a ray hovering across the screen (buttons=0) never turns');
    // ---- ?qdbg=1: version + every yaw cause ----
    const t = await dbg();
    chk(/VR v13 \| page vr13 \| sw /.test(t) && /STICKS: both WALK/.test(t) && /yaw by .*quest-look:turn=\d+/.test(t) && /trigger-drag=\d+/.test(t) && /stick look ignored /.test(t), '?qdbg=1: version, stick rule, yaw causes, ignored stick looks:\n' + t.split('\n').slice(0, 5).join('\n'));
    // ---- handed gamepads (a browser that exposes them): left stick walks, right stick turns; their wheel is ignored ----
    await reset(); await page.waitForTimeout(300); a = await pose();
    await page.evaluate(() => { window.__pads = [{ id: 'Oculus Touch (Left)', index: 0, hand: 'left', mapping: 'xr-standard', connected: true, axes: [0, 0, 0, -1], buttons: [] }]; });
    await page.waitForTimeout(600); b = await pose(); await page.evaluate(() => { window.__pads = []; }); await page.waitForTimeout(300);
    chk(Math.hypot(b.x - a.x, b.z - a.z) > 0.3 && Math.abs(b.yaw - a.yaw) < 1e-9, 'gamepad LEFT stick walks (' + Math.hypot(b.x - a.x, b.z - a.z).toFixed(2) + ' m), no turn');
    a = await pose();
    await page.evaluate(async () => { window.__pads = [{ id: 'Oculus Touch (Right)', index: 1, hand: 'right', mapping: 'xr-standard', connected: true, axes: [0, 0, 1, 0], buttons: [] }];
      const cv = document.querySelector('canvas'); for (let i = 0; i < 30; i++) { cv.dispatchEvent(new WheelEvent('wheel', { deltaX: 20, bubbles: true, cancelable: true, clientX: 200, clientY: 120 })); await new Promise(r => setTimeout(r, 16)); } });
    b = await pose(); await page.evaluate(() => { window.__pads = []; });
    const sk = await page.evaluate(() => window.__gaQuestPad.padWheelSkip);
    chk(b.yaw - a.yaw < -0.2 && Math.hypot(b.x - a.x, b.z - a.z) < 0.05 && sk > 10, 'gamepad RIGHT stick turns (yaw ' + (b.yaw - a.yaw).toFixed(2) + '), the wheel it also makes is ignored (' + sk + ')');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 500)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
