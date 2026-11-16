// v15 (t397u, Dave): in your OWN first-person view the laser pistol is held too: the monkey's right hand + the gun on the right controller
// (not only in the mirror), a real-size gun (~30 cm, muzzle ~25 cm ahead of the grip, not 69 cm), shots and the beam leave its muzzle
// along the aim, the right controller model + cone ray are hidden and a thin ray from the muzzle still points at panels.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB } });
  const D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const fg = () => page.evaluate(() => window.__gaVR.fpGun());
  try {
    // flat first: the third-person gun (for the after-exit check)
    await page.evaluate(() => { window.__arcade.play.addTickets(60); const gp = window.__gaPlayer; gp.tryOn('hand', 'pistol'); gp.buy(); gp.pick('hand', 'pistol'); });
    await page.waitForTimeout(500);
    const flat0 = await page.evaluate(() => { const T = window.__arcade.THREE, m = window.__arcade.monkey; m.updateMatrixWorld(true); const pg = m.getObjectByName('gaPistol'); return { vis: pg.visible, auto: pg.matrixAutoUpdate, p: pg.position.toArray(), s: pg.scale.x, mzLocal: pg.worldToLocal(m.getObjectByName('gaPistolMuzzle').getWorldPosition(new T.Vector3())).toArray() }; });
    chk(flat0.vis && flat0.auto, 'flat screen: the pistol shows in the monkey\'s hand as before (third person, untouched)');
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await page.evaluate(() => { const S = window.__gaVR; S.rig = { x: 2, y: 0, z: 4, yaw: 0 }; S.applyRig(); window.__arcade.monkey.position.set(2, 0, 4); }); await H.frames(page, 6);
    chk(await page.evaluate(() => window.__gaVR.gear().laser), 'laser pistol equipped in VR');
    const W = (x, y, z) => [2 + x, y, 4 + z];
    await H.aim(page, 'right', [0.25, 1.0, -0.3], W(1.5, 1.2, -4)); await H.aim(page, 'left', [-0.25, 1.0, -0.3], W(-1, 1, -4)); await H.frames(page, 5);
    let g = await fg();
    chk(g.on && g.gunVis && g.handVis, 'first person: the monkey hand + gun are drawn in your own view (' + g.frames + ' frames)');
    const hd = D(g.hand, g.grip), md = D(g.muzzle, g.grip), mm = D(g.muzzle, g.mirrorMuzzle);
    chk(hd < 0.05, 'the hand sits on the right controller (' + (hd * 100).toFixed(1) + ' cm)');
    chk(md > 0.15 && md < 0.35 && Math.abs(g.gunScale - 0.42) < 0.02, 'gun held at a natural size: muzzle ' + (md * 100).toFixed(0) + ' cm from the controller grip (was ~69 cm), gun scale ' + g.gunScale.toFixed(2));
    chk(mm < 0.002, 'the first-person gun is exactly where the mirror shows it (' + (mm * 1000).toFixed(1) + ' mm)');
    chk(dot(g.barrel, g.aim) > 0.98, 'barrel along the controller\'s aim (dot ' + dot(g.barrel, g.aim).toFixed(3) + ')');
    chk(!g.ctrlModel && !g.ctrlRay && g.leftModel, 'right controller model + its cone ray hidden while the gun is out; the left controller still shows');
    chk(g.fpRay && D(g.rayO, g.muzzle) < 0.05, 'a thin aim ray starts at the muzzle (' + (D(g.rayO, g.muzzle) * 100).toFixed(1) + ' cm)');
    // a shot: from the muzzle along the aim
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 4); await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 3);
    let L = await page.evaluate(() => window.__gaVR.vrLaser()); g = await fg();
    chk(L.last && D(L.last.o, g.muzzle) < 0.06 && dot(L.last.d, g.aim) > 0.99, 'B tap: the bolt leaves the first-person muzzle (' + (L.last ? (D(L.last.o, g.muzzle) * 100).toFixed(1) : '?') + ' cm) along the aim');
    // hold for the full charge: the beam starts at the muzzle
    const CT = await page.evaluate(() => (window.__roomFire && window.__roomFire.CHARGE_T) || 4);
    await H.btn(page, 'right', 'b-button', 1); const t0 = Date.now(); while (Date.now() - t0 < CT * 1000 + 800) await H.frames(page, 10);
    const beam = await page.evaluate(() => { const b = window.__arcade.scene.getObjectByName('vrLaserBeam'); return b ? { p: b.position.toArray(), d: new window.__arcade.THREE.Vector3(0, 0, 1).applyQuaternion(b.quaternion).toArray() } : null; }); g = await fg();
    await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 3);
    chk(beam && D(beam.p, g.muzzle) < 0.06 && dot(beam.d, g.aim) > 0.99, 'full charge: the beam leaves the muzzle along the aim (' + (beam ? (D(beam.p, g.muzzle) * 100).toFixed(1) + ' cm' : 'no beam') + ')');
    // pointing at the menu with the muzzle ray
    await page.waitForTimeout(3500); await H.frames(page, 3);
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3);
    let hit = false, len = 9;
    for (let i = 0; i < 4 && !hit; i++) { const w = await page.evaluate(() => window.__gaVR.ui.btnWorld('pack')); if (!w) break; await H.aim(page, 'right', [0.2, 1.2, -0.2], w); await H.frames(page, 4); len = (await fg()).fpRayLen;
      await H.press(page, 'right', 'trigger'); await H.frames(page, 3); hit = (await page.evaluate(() => window.__gaVR.lastPress)) === 'pack'; }
    chk(hit && len < 3, 'the muzzle ray points at the Y menu and presses BACKPACK (ray cut at the panel: ' + len.toFixed(2) + ' m)');
    const fpn = await page.evaluate(() => window.__gaVR.fpNames());
    chk(['vrFpGun', 'vrFpHand', 'vrFpRay'].every(n => fpn.includes(n)), 'the mirror pass hides the first-person hand / gun / ray (the mirror shows the avatar\'s own)');
    // put the gun away: controller + normal ray come back
    await page.evaluate(() => window.__gaPlayer.pick('hand', 'none')); await H.frames(page, 5); g = await fg();
    const back = await page.evaluate(() => { const S = window.__gaVR; return S.rayLens(); });
    chk(!g.on && back.right, 'gun put away: first-person gun off, the right controller ray is back');
    await page.evaluate(() => window.__gaPlayer.pick('hand', 'pistol')); await H.frames(page, 5); chk((await fg()).on, 'gun back out: held again');
    // exit VR: the third-person gun goes back to its flat pose
    await page.evaluate(() => window.__gaVR.exit()); await page.waitForFunction(() => !window.__gaVR.presenting, null, { timeout: 20000 }); await page.waitForTimeout(500);
    const flat1 = await page.evaluate(() => { const T = window.__arcade.THREE, m = window.__arcade.monkey; m.updateMatrixWorld(true); const pg = m.getObjectByName('gaPistol'); return { vis: pg.visible, auto: pg.matrixAutoUpdate, p: pg.position.toArray(), s: pg.scale.x, mzLocal: pg.worldToLocal(m.getObjectByName('gaPistolMuzzle').getWorldPosition(new T.Vector3())).toArray(), fp: window.__gaVR.fpGun().on }; });
    chk(flat1.vis && flat1.auto && !flat1.fp && D(flat1.p, flat0.p) < 1e-6 && flat1.s === flat0.s && D(flat1.mzLocal, flat0.mzLocal) < 1e-4, 'exit VR: flat third-person gun back exactly as before, no first-person copy');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 600)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
