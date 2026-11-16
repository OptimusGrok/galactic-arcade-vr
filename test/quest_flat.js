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
    chk(q.moves > 3 && moved > 0.3, 'left stick (plain wheel) walks the player: moved ' + moved.toFixed(2) + ' m, ' + q.moves + ' stick frames');
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
    await page.waitForTimeout(400);
    const y1 = await page.evaluate(() => window.__arcade.st.yaw);
    chk(Math.abs(y1 - y0) > 0.1 && (await QF(page)).moves === m0, 'gamepad right stick turns the camera without walking');
    await page.evaluate(() => { window.__pads = [{ id: 'Oculus Touch (Left)', index: 0, hand: 'left', mapping: 'xr-standard', connected: true, axes: [0, 0, 0, -0.9], buttons: [] }]; });
    await page.waitForTimeout(400);
    q = await QF(page); chk(q.joy.on && q.joy.y < -0.5 && q.moves > m0, 'gamepad left stick walks (forward) ' + JSON.stringify({ joy: q.joy, moves: q.moves, m0, pad: await page.evaluate(() => window.__gaQuestPad.read().move) }));
    await page.evaluate(() => { window.__pads = []; }); await page.waitForTimeout(200);
    chk(!(await QF(page)).joy.on, 'gamepad released: walk stops');
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
