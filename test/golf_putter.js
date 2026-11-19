// vrtest-v2 (Dave t449u): stepping into the mini golf room = holding a putter in the right hand; gun, jetpack and held prizes are put away
// and come back when you leave. The putter stays in the hand when the ball is hit (it used to sit at the ball and ride along with it).
// Flat first, then the emulated Quest 3 (putter on the right controller + in the avatar's hand for the mirror). node test/golf_putter.js
const { open } = require('./lib');
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x != null ? ' ' + JSON.stringify(x) : '')); if (!c) ok = false; };
  const GEAR = () => { const A = window.__arcade, g = window.__minigolf, T = A.THREE, PL = window.__gaPlayer, sh = window.__shop, hr = A.monkey.getObjectByName('handR');
    const held = A.scene.getObjectByName('golfPutterHeld'), vrp = A.scene.getObjectByName('golfPutterVR'), wp = A.scene.getObjectByName('golfPutter');
    const hp = hr ? hr.getWorldPosition(new T.Vector3()) : null, pp = held && held.parent ? held.getWorldPosition(new T.Vector3()) : null;
    return { below: g.below, on: g.gear.on, inHand: !!(held && held.parent && held.parent.name === 'handR' && held.visible), handGap: hp && pp ? +hp.distanceTo(pp).toFixed(3) : null,
      vr: !!(vrp && vrp.parent && vrp.visible), vrParent: vrp && vrp.parent ? (vrp.parent.type + ':' + (vrp.parent.userData.hand || '')) : null, worldPutter: !!(wp && wp.visible),
      hand: PL.p.hand, back: PL.p.back, held: sh.held, pistolMesh: (() => { const g = A.monkey.getObjectByName('gaPistol'); if (!g) return false; for (let x = g; x; x = x.parent) if (!x.visible) return false; return true; })() };
  };
  const setup = page => page.evaluate(() => { const A = window.__arcade, T = A.THREE, PL = window.__gaPlayer, sh = window.__shop;
    sh.registerHoldable('testPlush', { name: 'Test Plush', kind: 'hand', build: () => new T.Mesh(new T.SphereGeometry(0.08), new T.MeshBasicMaterial({ color: 0x44ff88 })) });
    PL.p.hand = 'pistol'; PL.p.back = 'jetpack'; PL.apply(); localStorage.setItem('galacticarcade.player', JSON.stringify(PL.p)); sh.hold('testPlush', 'L'); });
  const intoGolf = page => page.evaluate(() => { const g = window.__minigolf; g.enterVisit(); g.goTee(0); });
  const outOfGolf = async page => { await page.evaluate(() => { const g = window.__minigolf, A = window.__arcade; if (g.stopAim) g.stopAim(); A.monkey.position.set(g.X0 - 0.4, 0, (g.Z0 + g.Z1) / 2); A.st.vel.set(0, 0, 0); }); await page.waitForTimeout(800); };
  // ---------- flat ----------
  { const { page, errors, close } = await open({ w: 640, h: 360 });
    try {
      await page.waitForFunction(() => window.__minigolf && window.__shop && window.__gaPlayer, null, { timeout: 60000 });
      await setup(page); await page.waitForTimeout(400);
      let s = await page.evaluate(GEAR);
      chk(s.hand === 'pistol' && s.back === 'jetpack' && s.held.L === 'testPlush' && !s.on, 'before golf: pistol, jetpack and a prize are equipped', s);
      await intoGolf(page); await page.waitForTimeout(600); s = await page.evaluate(GEAR);
      chk(s.below && s.on && s.inHand && s.handGap < 0.2, 'stepping into the golf room puts a putter in the right hand', s);
      chk(s.hand === 'none' && s.back === 'none' && !s.held.R && !s.held.L && !s.pistolMesh, 'gun, jetpack and held prizes are put away', s);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('galacticarcade.player') || '{}'));
      chk(saved.hand === 'pistol' && saved.back === 'jetpack', 'the saved outfit still has the gun + jetpack (only put away for the visit)', { hand: saved.hand, back: saved.back });
      // putt: the putter stays in the hand while the ball rolls away
      const r = await page.evaluate(async () => { const g = window.__minigolf, A = window.__arcade, T = A.THREE, h = g.holes[0]; g.startAim(h); const b0 = g.ballAt(h).clone();
        g.strike(g.aim, 0.6); const hp = () => A.scene.getObjectByName('golfPutterHeld').getWorldPosition(new T.Vector3()); const p0 = hp(); const gaps = [];
        for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 100)); const hr = A.monkey.getObjectByName('handR').getWorldPosition(new T.Vector3()); gaps.push(+hr.distanceTo(hp()).toFixed(3)); }
        const b1 = g.ballAt(h); return { ballMoved: +Math.hypot(b1.x - b0.x, b1.z - b0.z).toFixed(2), putterMoved: +p0.distanceTo(hp()).toFixed(2), maxGap: Math.max(...gaps), world: A.scene.getObjectByName('golfPutter').visible }; });
      chk(r.ballMoved > 0.5 && r.putterMoved < 0.3 && r.maxGap < 0.2 && !r.world, 'after the putt the ball rolls on its own and the putter stays in the hand', r);
      await outOfGolf(page); s = await page.evaluate(GEAR);
      chk(!s.below && !s.on && !s.inHand && s.hand === 'pistol' && s.back === 'jetpack' && s.held.L === 'testPlush' && s.pistolMesh, 'leaving the golf room: putter gone, gun / jetpack / prize back', s);
    } catch (e) { chk(false, 'flat exception ' + String(e && e.stack || e).slice(0, 400)); }
    chk(errors.filter(e => !/Failed to load|supabase|net::/i.test(e)).length === 0, 'no page errors (flat)', errors.slice(0, 3)); await close(); }
  // ---------- headset ----------
  { const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP } });
    const E = (f, a) => page.evaluate(f, a), until = (f, ms = 60000) => page.waitForFunction(f, null, { timeout: ms });
    try {
      await until(() => document.getElementById('vrBtn').classList.contains('on'), 30000);
      await page.click('#vrBtn'); await until(() => window.__gaVR.presenting && window.__gaVR.posed);
      await until(() => window.__minigolf && window.__shop && window.__gaPlayer, 90000);
      await setup(page); await H.frames(page, 6);
      await E(() => { window.__tpTimeScale = 3; window.__tp.go(); }); await until(() => window.__tp.where === 2 && window.__tp.state === 'idle', 90000);
      const b = await E(() => { const g = window.__minigolf, b = g.ballAt(g.holes[0]); return [b.x, b.y, b.z, g.FY]; });
      // stand on the first green in the headset, then step in (the rig drives the avatar, so enter after placing it)
      await E(([x, y, z]) => { const S = window.__gaVR; S.rig = { x: x - 0.6, y, z: z - 0.6, yaw: Math.PI * 0.75 }; S.applyRig(); window.__arcade.monkey.position.set(x - 0.6, y, z - 0.6); window.__minigolf.enterVisit(); }, [b[0], b[3] + 0.08, b[2]]);
      await H.frames(page, 10); let s = await E(GEAR);
      chk(s.on && s.vr && /right/.test(s.vrParent || '') && s.inHand && s.hand === 'none' && s.back === 'none' && !s.held.L, 'headset: putter on the right controller (first person) and in the avatar hand (mirror); gear put away', s);
      const fp = await E(() => window.__gaVR.fpNames());
      // putt with the trigger: hold, aim, release
      await H.aim(page, 'right', [0.15, 1.2, -0.25], [b[0] + 1.2, b[1], b[2] + 1.2]); await H.frames(page, 3);
      await H.btn(page, 'right', 'trigger', 1); await H.frames(page, 8); await H.aim(page, 'right', [0.15, 1.2, -0.25], [b[0] + 1.6, b[1], b[2] + 1.6]); await H.frames(page, 6); await H.btn(page, 'right', 'trigger', 0);
      const p0 = await E(() => { const T = window.__arcade.THREE; return window.__arcade.scene.getObjectByName('golfPutterVR').getWorldPosition(new T.Vector3()).toArray(); });
      await H.frames(page, 40);
      const r = await E(([bx, bz, p0]) => { const g = window.__minigolf, A = window.__arcade, T = A.THREE, b1 = g.ballAt(g.holes[0]), p = A.scene.getObjectByName('golfPutterVR').getWorldPosition(new T.Vector3());
        return { putts: window.__gaVR.golfPutts || 0, ballMoved: +Math.hypot(b1.x - bx, b1.z - bz).toFixed(2), putterMoved: +p.distanceTo(new T.Vector3(...p0)).toFixed(2), world: A.scene.getObjectByName('golfPutter').visible }; }, [b[0], b[2], p0]);
      chk(r.putts >= 1 && r.ballMoved > 0.3 && r.putterMoved < 0.05 && !r.world, 'headset putt: the ball rolls away, the putter stays on the controller', r);
      await E(() => { const g = window.__minigolf, S = window.__gaVR; if (g.stopAim) g.stopAim(); const x = g.X0 - 0.6, z = (g.Z0 + g.Z1) / 2; S.rig = { x, y: 0, z, yaw: Math.PI / 2 }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); });
      await H.frames(page, 12); s = await E(GEAR);
      chk(!s.on && !s.vr && !s.inHand && s.hand === 'pistol' && s.back === 'jetpack' && s.held.L === 'testPlush', 'headset: leaving the golf room gives the gear back and drops the putter', s);
    } catch (e) { chk(false, 'VR exception ' + String(e && e.stack || e).slice(0, 400)); }
    chk(errors.filter(e => !/Failed to load|supabase|net::|ERR_FAILED/i.test(e)).length === 0, 'no page errors (VR)', errors.slice(0, 3)); await close(); }
  console.log(ok ? 'ALL OK' : 'SOME FAIL'); process.exit(ok ? 0 : 1);
})();
