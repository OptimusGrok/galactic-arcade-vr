// Galactic Arcade VR: emulated Meta Quest 3 (IWER) in headless Chromium.
// ENTER VR -> head tracking -> thumbstick walk + collision -> smooth turn -> teleport -> point + trigger at STRIKE ->
// tickets / start via A -> game texture updates and reacts to mapped controller input -> grip exit -> GHOST 256 the same -> leave VR.
const { openVR, H } = require('./vrlib');
(async () => {
  const { page, errors, close } = await openVR(); let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const st = () => page.evaluate(() => window.__gaVR.state());
  try {
    await page.waitForFunction(() => window.__gaVR && window.__gaVR.supported, null, { timeout: 15000 });
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 15000 });
    chk(true, 'ENTER VR button shown on the arcade floor (emulated Quest 3)');
    await page.evaluate(() => { const P = window.__arcade.play; P.tickets.total = 40; window.__noRandomRoom = 1; });
    const fov0 = await page.evaluate(() => window.__arcade.camera.fov);
    await page.click('#vrBtn');
    await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    let s = await st(); chk(s.presenting, 'XR session started (local-floor), rig at the player ' + JSON.stringify(s.rig));
    chk(await page.evaluate(() => document.body.classList.contains('vr') && getComputedStyle(document.getElementById('playUI') || document.body).visibility === 'hidden'), 'DOM HUD hidden in VR');
    chk(await page.evaluate(() => !window.__arcade.monkey.visible), 'own avatar hidden (first person)');

    // ---- head tracking ----
    await page.evaluate(() => { const S = window.__gaVR; S.rig = { x: -6, y: 0, z: 0, yaw: 0 }; S.applyRig(); window.__arcade.monkey.position.set(-6, 0, 0); window.__xrd.position.set(0, 1.6, 0); window.__xrd.quaternion.set(0, 0, 0, 1); });
    await H.frames(page, 6);
    const c0 = await page.evaluate(() => window.__arcade.camera.position.toArray());
    await page.evaluate(() => window.__xrd.position.set(0.4, 1.7, 0)); await H.frames(page, 6);
    const c1 = await page.evaluate(() => window.__arcade.camera.position.toArray());
    chk(Math.abs(c1[0] - c0[0] - 0.4) < 0.06 && Math.abs(c1[1] - c0[1] - 0.1) < 0.06, 'camera follows head position (dx ' + (c1[0] - c0[0]).toFixed(3) + ', dy ' + (c1[1] - c0[1]).toFixed(3) + ')');
    chk(Math.abs(c1[1] - 1.7) < 0.1, 'eye height = real head height (local-floor, 1 m = 1 unit): ' + c1[1].toFixed(2));
    await page.evaluate(() => { const a = Math.PI / 2; window.__xrd.quaternion.set(0, Math.sin(a / 2), 0, Math.cos(a / 2)); }); await H.frames(page, 6);
    s = await st(); chk(Math.abs(s.head.yaw - Math.PI / 2) < 0.05, 'head yaw tracked ' + s.head.yaw.toFixed(2));
    const dirX = await page.evaluate(() => { const v = new window.__arcade.THREE.Vector3(); window.__arcade.camera.getWorldDirection(v); return v.x; });
    chk(dirX < -0.9, 'camera looks where the head looks (dir.x ' + dirX.toFixed(2) + ')');
    await page.evaluate(() => { window.__xrd.position.set(0, 1.6, 0); window.__xrd.quaternion.set(0, 0, 0, 1); }); await H.frames(page, 6);

    // ---- left stick: walk where you look, with collision ----
    s = await st(); const m0 = s.monkey;
    await H.axes(page, 'left', 0, -1); await page.waitForTimeout(1200); await H.axes(page, 'left', 0, 0); await H.frames(page, 4);
    s = await st(); chk(m0[2] - s.monkey[2] > 0.8 && Math.abs(s.monkey[0] - m0[0]) < 0.3, 'left stick forward walks forward (z ' + m0[2].toFixed(2) + ' -> ' + s.monkey[2].toFixed(2) + ')');
    const camZ = await page.evaluate(() => window.__arcade.camera.position.z); chk(Math.abs(camZ - s.monkey[2]) < 0.25, 'view moves with the player (cam z ' + camZ.toFixed(2) + ')');
    await H.axes(page, 'left', 0, -1); await page.waitForFunction(() => { const S = window.__gaVR; S._z = S._z || []; S._z.push(window.__arcade.monkey.position.z); return S._z.length > 40 && Math.abs(S._z[S._z.length - 1] - S._z[S._z.length - 30]) < 0.005; }, null, { timeout: 60000, polling: 100 });
    await H.axes(page, 'left', 0, 0); s = await st();
    chk(s.monkey[2] > -12 + 1.45 + 0.29 - 0.05 && s.monkey[2] < -9.4, 'stopped by the north cabinets / plinth at z=' + s.monkey[2].toFixed(2));
    // roomscale: physically stepping into the cabinet row is pushed back too
    await page.evaluate(() => window.__xrd.position.set(0, 1.6, -1.0)); await H.frames(page, 6); s = await st();
    chk(s.monkey[2] > -12 + 1.45 + 0.29 - 0.05, 'real-world step into the cabinets is blocked (z ' + s.monkey[2].toFixed(2) + ')');
    await page.evaluate(() => window.__xrd.position.set(0, 1.6, 0)); await H.frames(page, 6);

    // ---- right stick: smooth turn (t350u; the rate tests are in vr_ui.js) ----
    s = await st(); const y0 = s.rig.yaw, ts0 = s.turnSum;
    await H.axes(page, 'right', 1, 0); await H.frames(page, 6); await H.axes(page, 'right', 0, 0); await H.frames(page, 4);
    s = await st(); const dTurn = s.rig.yaw - y0;
    chk(dTurn < -0.01 && Math.abs(-dTurn - (s.turnSum - ts0)) < 1e-6 && s.snaps === 0 && s.turnMaxStep <= Math.PI / 2 * 0.05 + 1e-9, 'right stick right = smooth turn right (' + (dTurn * 180 / Math.PI).toFixed(1) + ' deg, no snap)');
    await page.evaluate(a => window.__gaVR.turn(a), y0 - s.rig.yaw); await H.frames(page, 4);
    s = await st(); chk(Math.abs(s.rig.yaw - y0) < 0.01, 'turned back');

    // ---- teleport: right trigger at the floor ----
    await page.evaluate(() => { const S = window.__gaVR; S.rig = { x: 2, y: 0, z: 4, yaw: 0 }; S.applyRig(); window.__arcade.monkey.position.set(2, 0, 4); }); await H.frames(page, 6);   // open floor (the claw machine is at x -5..-4, z -1..0)
    await H.aim(page, 'right', [0.2, 1.2, -0.2], [2, 0, 1]); await H.frames(page, 4);
    const ring = await page.evaluate(() => { const r = window.__arcade.scene.getObjectByName('vrTeleportRing'); return [r.visible, r.position.x, r.position.z]; });
    chk(ring[0] && Math.abs(ring[2] - 1) < 0.25, 'teleport ring on the floor where the ray points ' + ring.map(v => typeof v === 'number' ? v.toFixed(2) : v));
    await H.press(page, 'right', 'trigger'); s = await st();
    chk(s.teleports === 1 && Math.abs(s.monkey[2] - 1) < 0.3 && Math.abs(s.monkey[0] - 2) < 0.3, 'trigger teleports there (' + s.monkey.map(v => v.toFixed(2)) + ')');

    // ---- STRIKE: point + trigger ----
    const go = async (key) => {
      const spot = await page.evaluate(key => { const A = window.__arcade, m = A.play.machines[key], u = m.cab.userData, f = u.front, n = u.inward || { x: 0, z: 1 }, b = new A.THREE.Box3().setFromObject(m.cab), c = b.getCenter(new A.THREE.Vector3());
        const p = { x: f.x + n.x * 1.4, z: f.z + n.z * 1.4 }, yaw = Math.atan2(n.x, n.z); return { p, yaw, c: [c.x, c.y, c.z] }; }, key);
      await page.evaluate(sp => { const S = window.__gaVR; S.rig = { x: sp.p.x, y: 0, z: sp.p.z, yaw: sp.yaw }; S.applyRig(); window.__arcade.monkey.position.set(sp.p.x, 0, sp.p.z); }, spot); await H.frames(page, 6);
      await H.aim(page, 'right', [0.2, 1.2, -0.2], spot.c); await H.frames(page, 4);
      return spot; };
    await go('strike'); s = await st(); chk(s.hover === 'strike', 'ray hover = strike cabinet (' + s.hover + ')');
    const tk0 = await page.evaluate(() => window.__arcade.play.tickets.total);
    await H.press(page, 'right', 'trigger');
    await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 60000 });
    s = await st(); chk(s.cur === 'strike' && s.launches === 1 && s.screen, 'trigger launched STRIKE; in-world game screen shown');
    await page.waitForFunction(() => window.__gaVR.texUploads > 20 && window.__gaVR.pumps > 20, null, { timeout: 60000 });
    const h1 = await page.evaluate(() => window.__gaVR.compHash()); await H.frames(page, 20); const h2 = await page.evaluate(() => window.__gaVR.compHash());
    s = await st(); chk(h1 !== h2 && s.texUploads > 20, 'game canvas -> texture updates every frame (uploads ' + s.texUploads + ', pumped game frames ' + s.pumps + ', ' + s.comp.join('x') + ')');
    await H.press(page, 'right', 'a-button');
    const after = await page.evaluate(() => ({ t: window.__arcade.play.tickets.total, c: window.__arcade.play.machines.strike.credits }));
    chk(after.t === tk0 - 5 && after.c === 1, 'A inserts 5 tickets -> 1 credit (tickets ' + tk0 + ' -> ' + after.t + ')');
    await H.press(page, 'right', 'a-button');
    await page.waitForFunction(() => window.__arcade.play.sub === 'play', null, { timeout: 10000 });
    const fr = page.frames().find(f => /strike-play/.test(f.url()));
    await fr.waitForFunction(() => window.STRIKE.G.scene === 'play' && !window.STRIKE.pl.entering, null, { timeout: 30000 }).catch(() => {});
    chk(await fr.evaluate(() => window.STRIKE.G.scene) === 'play', 'A again starts the game (credit used)');
    const x0 = await fr.evaluate(() => window.STRIKE.pl.x);
    await H.axes(page, 'left', -1, 0); await H.frames(page, 25);
    const kL = await fr.evaluate(() => !!window.STRIKE.Input.keys.left), x1 = await fr.evaluate(() => window.STRIKE.pl.x);
    await H.axes(page, 'left', 0, 0); await H.frames(page, 3);
    chk(kL && x1 < x0 - 5, 'left stick -> ArrowLeft: ship moves left (x ' + x0.toFixed(1) + ' -> ' + x1.toFixed(1) + ')');
    chk(!(await fr.evaluate(() => window.STRIKE.Input.keys.left)), 'stick release -> keyup');
    await H.btn(page, 'right', 'trigger', 1); await H.frames(page, 5);
    const fire = await fr.evaluate(() => !!window.STRIKE.Input.keys.fire); await H.btn(page, 'right', 'trigger', 0); await H.frames(page, 3);
    chk(fire, 'trigger -> fire (KeyZ)');   // v21: A is HYPER SPEED now (test/vr_strike_v21.js)
    await H.btn(page, 'left', 'y-button', 1); await H.frames(page, 4); const bomb = await fr.evaluate(() => !!window.STRIKE.Input.keys.bomb); await H.btn(page, 'left', 'y-button', 0); await H.frames(page, 3);
    chk(bomb, 'Y -> bomb (KeyX)');
    const h3 = await page.evaluate(() => window.__gaVR.compHash()); await H.frames(page, 10); chk(h3 !== await page.evaluate(() => window.__gaVR.compHash()), 'screen keeps updating during play');
    // payout path is the original one (session ticket API)
    const pay = await fr.evaluate(() => { const t0 = parent.__neonSession.tickets; const n = parent.__neonSession.addTickets(5, 'strike'); return [t0, n, parent.__neonSession.tickets]; });
    chk(pay[1] === 5 && pay[2] === pay[0] + 5, 'in-game ticket payout still credited (' + pay.join(' / ') + ')');
    // grip hold = leave
    await H.btn(page, 'left', 'squeeze', 1); await page.waitForFunction(() => window.__arcade.play.mode !== 'game', null, { timeout: 15000 }); await H.btn(page, 'left', 'squeeze', 0);
    await page.waitForFunction(() => window.__arcade.play.mode === 'walk', null, { timeout: 15000 });
    s = await st(); chk(s.exits === 1 && !s.screen && !s.held.length, 'hold grip left STRIKE; screen gone, no keys stuck');

    // ---- GHOST 256 ----
    await go('ghost'); s = await st(); chk(s.hover === 'ghost', 'ray hover = ghost cabinet');
    await H.press(page, 'right', 'trigger');
    await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 60000 });
    await H.press(page, 'left', 'x-button'); await H.press(page, 'left', 'x-button');
    await page.waitForFunction(() => window.__arcade.play.sub === 'play', null, { timeout: 10000 });
    const gf = page.frames().find(f => /ghost-play/.test(f.url()));
    await gf.waitForFunction(() => window.__ghost.G.state === 'play', null, { timeout: 20000 }).catch(() => {});
    chk(await gf.evaluate(() => window.__ghost.G.state) === 'play', 'GHOST 256 started with X (insert) + X (start)');
    const g0 = await page.evaluate(() => window.__gaVR.compHash());
    for (const [ax, ay, want] of [[1, 0, 3], [0, 1, 2], [-1, 0, 1], [0, -1, 0]]) {
      await H.axes(page, 'right', ax, ay); await H.frames(page, 4);
      const w = await gf.evaluate(() => [window.__ghost.P.want, window.__ghost.P.dir]); await H.axes(page, 'right', 0, 0); await H.frames(page, 3);
      chk(w[0] === want || w[1] === want, 'right stick ' + ax + ',' + ay + ' -> ghost direction ' + want + ' (want ' + w[0] + ', dir ' + w[1] + ')'); }
    await H.frames(page, 10); chk(g0 !== await page.evaluate(() => window.__gaVR.compHash()), 'ghost screen texture updates');
    await H.btn(page, 'right', 'squeeze', 1); await page.waitForFunction(() => window.__arcade.play.mode !== 'game', null, { timeout: 15000 }); await H.btn(page, 'right', 'squeeze', 0);
    await page.waitForFunction(() => window.__arcade.play.mode === 'walk', null, { timeout: 15000 });

    // ---- leave VR: flat game resumes ----
    const f0 = await page.evaluate(() => window.__arcade.stats.frames);
    await page.evaluate(() => window.__gaVR.exit()); await page.waitForFunction(() => !window.__gaVR.presenting, null, { timeout: 15000 });
    await page.waitForFunction(f0 => window.__arcade.stats.frames > f0 + 20, f0 + 0, { timeout: 30000 });
    const flat = await page.evaluate(() => ({ fov: window.__arcade.camera.fov, vr: document.body.classList.contains('vr'), mv: window.__arcade.monkey.visible, btn: document.getElementById('vrBtn').classList.contains('on') }));
    chk(Math.abs(flat.fov - fov0) < 0.01 && !flat.vr && flat.mv, 'session end: flat rAF loop resumes, camera fov restored, avatar back ' + JSON.stringify(flat));
    await page.evaluate(() => { const A = window.__arcade; window.__noAdapt = 1; A.monkey.position.set(-6, 0, 0); A.st.yaw = 0; A.st.vel.set(0, 0, 0); A.keys.KeyW = true; for (let i = 0; i < 60; i++) A.step(1 / 60); A.keys.KeyW = false; });
    chk(await page.evaluate(() => window.__arcade.monkey.position.z) < -1.5, 'flat keyboard walking still works after VR');
    const caches = await page.evaluate(() => caches.keys()); chk(!caches.some(k => /^galactic-arcade-(v|test)/.test(k)), 'no live / test caches created here: ' + JSON.stringify(caches));
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e)); console.log(JSON.stringify(await st().catch(() => null))); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e));
  chk(errs.length === 0, 'no page errors ' + errs.slice(0, 5).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
