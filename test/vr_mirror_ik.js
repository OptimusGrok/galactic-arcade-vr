// v13 (t395u, Dave in the headset mirror): the avatar's arms are a real two-bone IK: the reflected small hands sit on the controllers
// (as far as the arm reaches) and take their rotation; the mirror still hides your own controllers / pink rings (the avatar's little
// controllers have no pink ring); with the laser pistol the gun points along the controller's ray and the shot leaves the gun's muzzle.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB } });
  const place = async (x, z, yaw = 0) => { await page.evaluate(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 6); };
  const pose = () => page.evaluate(() => { const T = window.__arcade.THREE, m = window.__arcade.monkey, S = window.__gaVR; m.updateMatrixWorld(true);
    const L = S.vrLaser(), hands = S.avatarHands(), ik = S.ikStats();
    const g = {}; for (const side of ['left', 'right']) { const a = (m.userData.arms || []).find(q => (q.sd > 0) === (side === 'right')); const sh = a.sh.getWorldPosition(new T.Vector3()); g[side] = { sh: sh.toArray() }; }
    const ctr = S.ctrlGrips ? S.ctrlGrips() : null; return { hands, ik, g, ctr, L }; });
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await place(2, 4, 0);
    const grips = () => page.evaluate(() => window.__gaVR.ctrlGrips());
    // reachable poses: hands low in front, at the sides, raised a little
    const poses = [[[0.25, 0.95, -0.25], [-0.25, 0.95, -0.25]], [[0.38, 0.8, -0.05], [-0.38, 0.8, -0.05]], [[0.2, 1.05, -0.3], [-0.15, 0.85, -0.2]]];
    let worst = 0, n = 0, rs = [];
    const W = (x, y, z) => [2 + x, y, 4 + z];   // the rig stands at (2, 4) facing -z
    const geo = await page.evaluate(() => { const T = window.__arcade.THREE, m = window.__arcade.monkey, S = window.__gaVR; m.updateMatrixWorld(true); const b = new T.Box3().setFromObject(m); return { head: S.head, mon: m.position.toArray(), h: +(b.max.y - b.min.y).toFixed(2), sh: m.userData.arms.map(a => a.sh.getWorldPosition(new T.Vector3()).toArray().map(v => +v.toFixed(2))) }; });
    console.log('geometry ' + JSON.stringify(geo));
    for (const [r, l] of poses) { await H.aim(page, 'right', r, W(r[0] * 3, r[1] - 0.5, -3)); await H.aim(page, 'left', l, W(l[0] * 3, l[1] - 0.5, -3)); await H.frames(page, 5);
      const p = await pose(), G = await grips();
      for (const side of ['right', 'left']) { const h = p.hands.find(a => a.sd && (a.sd > 0) === (side === 'right')), gp = G[side]; const d = Math.hypot(h.hand[0] - gp[0], h.hand[1] - gp[1], h.hand[2] - gp[2]);
        rs.push(side[0] + ':' + d.toFixed(3) + '@' + p.ik.reach[side]);  if (p.ik.reach[side] < 0.97) { worst = Math.max(worst, d); n++; } } }
    chk(n >= 3 && worst < 0.05, 'reachable controllers: the avatar hand sits ON the controller (worst ' + (worst * 100).toFixed(1) + ' cm over ' + n + ' hands; ' + rs.join(' ') + ')');
    // out of reach: the arm points straight at it, full length, not stretched
    await H.aim(page, 'right', [0.45, 2.3, -0.75], W(1, 3, -3)); await H.frames(page, 5);
    const far = await page.evaluate(() => { const T = window.__arcade.THREE, m = window.__arcade.monkey, a = m.userData.arms.find(q => q.sd > 0), S = window.__gaVR; m.updateMatrixWorld(true);
      const s = a.sh.getWorldPosition(new T.Vector3()), h = a.hand.getWorldPosition(new T.Vector3()), g = new T.Vector3(...S.ctrlGrips().right); const u = g.clone().sub(s).normalize(), v = h.clone().sub(s);
      return { cos: v.clone().normalize().dot(u), len: v.length(), reach: S.ikStats().reach.right }; });
    chk(far.reach > 1 && far.cos > 0.97 && far.len < 0.8, 'out of reach (' + far.reach + 'x): the arm reaches straight toward the controller (cos ' + far.cos.toFixed(3) + '), not stretched (' + far.len.toFixed(2) + ' m)');
    // the hand turns with the controller
    await H.aim(page, 'right', [0.25, 0.95, -0.25], W(0.25, 0.95, -3)); await H.frames(page, 4);
    const q1 = await page.evaluate(() => window.__arcade.monkey.userData.arms.find(q => q.sd > 0).hand.getWorldQuaternion(new window.__arcade.THREE.Quaternion()).toArray());
    await H.aim(page, 'right', [0.25, 0.95, -0.25], W(3, 0.95, -0.25)); await H.frames(page, 4);
    const q2 = await page.evaluate(() => window.__arcade.monkey.userData.arms.find(q => q.sd > 0).hand.getWorldQuaternion(new window.__arcade.THREE.Quaternion()).toArray());
    const ang = 2 * Math.acos(Math.min(1, Math.abs(q1[0] * q2[0] + q1[1] * q2[1] + q1[2] * q2[2] + q1[3] * q2[3])));
    chk(ang > 1.2 && ang < 1.95, 'point the controller 90 deg to the side: the avatar hand turns with it (' + (ang * 180 / Math.PI).toFixed(0) + ' deg)');
    // the avatar's little controllers: no pink ring
    const pink = await page.evaluate(() => { let n = 0; window.__arcade.monkey.traverse(o => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0xff3fd2) { for (let q = o; q; q = q.parent) if (q.name === 'vrAvatarCtrl') { n++; break; } } }); return n; });
    chk(pink === 0, 'no pink rings on the avatar\'s hand controllers (' + pink + ')');
    // ---- laser pistol: the gun points along the controller ray, the shot leaves the muzzle ----
    await page.evaluate(() => { window.__arcade.play.addTickets(60); const gp = window.__gaPlayer; gp.tryOn('hand', 'pistol'); gp.buy(); gp.pick('hand', 'pistol'); }); await H.frames(page, 6);
    chk(await page.evaluate(() => window.__gaVR.gear().laser), 'laser pistol equipped');
    await H.aim(page, 'right', [0.25, 1.0, -0.3], W(1.5, 1.2, -4)); await H.frames(page, 5);
    const gun = await page.evaluate(() => { const T = window.__arcade.THREE, m = window.__arcade.monkey, S = window.__gaVR; m.updateMatrixWorld(true); const pg = m.getObjectByName('gaPistol'), mz = m.getObjectByName('gaPistolMuzzle');
      const bz = new T.Vector3(0, 0, 1).applyQuaternion(pg.getWorldQuaternion(new T.Quaternion())), c = S.vrLaser().ctrl, d = new T.Vector3(...c.d);
      const ctlModel = (() => { let v = null; m.traverse(o => { if (o.name === 'vrAvatarCtrl' && o.parent && o.parent.name === 'handR') v = o.visible; }); return v; })();
      const hR = m.getObjectByName('handR').getWorldPosition(new T.Vector3()).toArray(), pp = pg.getWorldPosition(new T.Vector3()).toArray(), sc = pg.getWorldScale(new T.Vector3()).toArray();
      return { hR, pp, dot: bz.dot(d), mz: mz.getWorldPosition(new T.Vector3()).toArray(), g: c.o, vis: pg.visible, ctlModel }; });
    const mg = Math.hypot(gun.mz[0] - gun.g[0], gun.mz[1] - gun.g[1], gun.mz[2] - gun.g[2]), hg = Math.hypot(gun.hR[0] - gun.g[0], gun.hR[1] - gun.g[1], gun.hR[2] - gun.g[2]);
    const cd = await page.evaluate(() => window.__gaVR.vrLaser().ctrl.d), off = (() => { const v = gun.mz.map((x, i) => x - gun.g[i]), t = v[0] * cd[0] + v[1] * cd[1] + v[2] * cd[2]; return Math.hypot(v[0] - t * cd[0], v[1] - t * cd[1], v[2] - t * cd[2]); })();
    chk(gun.vis && hg < 0.05 && gun.dot > 0.95 && off < 0.1 && mg < 0.9 && gun.ctlModel === false, 'the gun is in the avatar\'s RIGHT hand on the right controller (hand ' + (hg * 100).toFixed(1) + ' cm from it), barrel along the controller ray (dot ' + gun.dot.toFixed(3) + '), the muzzle on that ray (' + (off * 100).toFixed(1) + ' cm off, ' + (mg * 100).toFixed(0) + ' cm out: the avatar\'s blaster), no little controller in that hand');
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 4); await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 3);
    const shot = await page.evaluate(() => { const T = window.__arcade.THREE, m = window.__arcade.monkey; m.updateMatrixWorld(true); const L = window.__gaVR.vrLaser(); return { last: L.last, mz: m.getObjectByName('gaPistolMuzzle').getWorldPosition(new T.Vector3()).toArray(), from: window.__gaVR.laserFromMuzzle() }; });
    const sd = shot.last ? Math.hypot(shot.last.o[0] - shot.mz[0], shot.last.o[1] - shot.mz[1], shot.last.o[2] - shot.mz[2]) : 9;
    chk(shot.last && sd < 0.08 && shot.from > 0, 'B: the bolt leaves the gun muzzle (' + (sd * 100).toFixed(1) + ' cm from it), aimed along the controller ray ' + JSON.stringify(shot.last && shot.last.d.map(v => +v.toFixed(2))));
    // the mirror pass still hides your first-person controllers (fpList unchanged)
    const fp = await page.evaluate(() => window.__gaVR.fpNames());
    chk(fp.length >= 6, 'the mirror still hides your own controllers, rings, ray dot, HUD and menu (' + fp.length + ' objects)');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 600)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
