// t346u: on a Quest the controller thumbsticks zoomed the camera (Quest Browser sends them as wheel events).
// VR edition: in XR the sticks only move (left) and snap-turn (right); wheel / zoom never change the camera distance.
// Also flat mode with a Quest browser user agent: wheel does not zoom. A desktop browser still wheel-zooms (unchanged).
const fs = require('fs'), path = require('path');
const { open } = require('./lib');
const { openVR, H } = require('./vrlib');
const QUEST_UA = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.2.0.0 SamsungBrowser/4.0 Chrome/126.0.0.0 VR Safari/537.36';
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const zoomState = page => page.evaluate(() => ({ dist: window.__arcade.st.dist, key: localStorage.getItem(window.__arcade.zoom.key), hold: window.__arcade.zoomHoldState, blocked: window.__arcade.st.wheelBlocked || 0 }));
  const wheel = async (page, n = 8) => { await page.mouse.move(240, 135); for (let i = 0; i < n; i++) { await page.mouse.wheel(0, i % 2 ? -240 : 240); await page.mouse.wheel(0, 240); } await page.evaluate(n => { const cv = window.__arcade.renderer ? window.__arcade.renderer.domElement : document.querySelector('canvas');
    for (let i = 0; i < n; i++) cv.dispatchEvent(new WheelEvent('wheel', { deltaY: i % 2 ? -240 : 240, bubbles: true, cancelable: true, clientX: 240, clientY: 135 })); }, n * 2);
    await page.waitForTimeout(300); };
  // ---- 1) in VR (emulated Quest 3) ----
  { const { page, errors, close } = await openVR();
    try {
      await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
      await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
      await page.evaluate(() => { const S = window.__gaVR; S.rig = { x: 2, y: 0, z: 4, yaw: 0 }; S.applyRig(); window.__arcade.monkey.position.set(2, 0, 4); }); await H.frames(page, 6);
      const z0 = await zoomState(page), s0 = await page.evaluate(() => window.__gaVR.state());
      await wheel(page);   // what the Quest Browser sends for a thumbstick
      await H.axes(page, 'left', 0, -1); await wheel(page, 4); await page.waitForTimeout(900); await H.axes(page, 'left', 0, 0); await H.frames(page, 4);
      await H.axes(page, 'right', 1, 0); await H.frames(page, 4); await H.axes(page, 'right', 0, 0); await H.frames(page, 4);
      await H.axes(page, 'left', 0.9, 0); await page.waitForTimeout(600); await H.axes(page, 'left', 0, 0); await H.frames(page, 4);
      const z1 = await zoomState(page), s1 = await page.evaluate(() => window.__gaVR.state());
      const moved = Math.hypot(s1.monkey[0] - s0.monkey[0], s1.monkey[2] - s0.monkey[2]);
      chk(moved > 0.8, 'left stick moves the player (' + moved.toFixed(2) + ' m)');
      chk(Math.abs(s1.rig.yaw - s0.rig.yaw + Math.PI / 6) < 0.01, 'right stick snap-turns 30 deg (' + ((s1.rig.yaw - s0.rig.yaw) * 180 / Math.PI).toFixed(1) + ')');
      chk(z1.dist === z0.dist, 'camera distance unchanged in VR (' + z0.dist + ' -> ' + z1.dist + ')');
      chk(z1.key === z0.key, 'saved zoom unchanged (' + z0.key + ' -> ' + z1.key + ')');
      chk(!z1.hold.on && !z1.hold.lock && z1.hold.k === 0, 'hold-to-zoom never engaged ' + JSON.stringify(z1.hold));
      chk(z1.blocked > 0, 'wheel events reached the canvas and were ignored (' + z1.blocked + ')');
    } catch (e) { chk(false, 'VR exception ' + e); }
    const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'VR: no page errors ' + errs.slice(0, 3).join(' | '));
    await close(); }
  // ---- 2) flat page in a Quest browser: the stick (wheel) does not zoom ----
  { const { page, close } = await open({ w: 480, h: 270, init: { content: `Object.defineProperty(Navigator.prototype, 'userAgent', { get: () => ${JSON.stringify(QUEST_UA)} });` } });
    const z0 = await zoomState(page); await wheel(page); const z1 = await zoomState(page);
    chk(await page.evaluate(() => window.__gaQuest) && z1.dist === z0.dist && z1.blocked > 0, 'flat page on a Quest: wheel / thumbstick does not zoom (' + z0.dist + ' -> ' + z1.dist + ')');
    await close(); }
  // ---- 3) desktop browser: mouse-wheel zoom still works ----
  { const { page, close } = await open({ w: 480, h: 270 });
    const z0 = await zoomState(page); await wheel(page, 4); const z1 = await zoomState(page);
    chk(!(await page.evaluate(() => window.__gaQuest)) && z1.dist !== z0.dist, 'desktop: mouse-wheel zoom still works (' + z0.dist + ' -> ' + z1.dist.toFixed(2) + ')');
    await close(); }
  process.exit(ok ? 0 : 1);
})();
