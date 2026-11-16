// t358u/t359u: the shop mirror is live as soon as you beam in (not frozen until you walk halfway), smooth when near or when you are in it;
// the left-controller HUD shows the jetpack ENERGY bar (main.js st.fly.e); the laser pistol fires from the RIGHT CONTROLLER in full 3D
// (hand down = shoots down) with a charge glow on the controller: blue for the monkey, red for the alien.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB } });
  const st = () => page.evaluate(() => window.__gaVR.state());
  const place = async (x, z, yaw = 0) => { await page.evaluate(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 6); };
  const LOCAL = [0.2, 1.3, -0.2];
  const aim = async (target, hand = 'right') => { await H.aim(page, hand, LOCAL, target); await H.frames(page, 3); };
  const btnAt = id => page.evaluate(id => window.__gaVR.ui.btnWorld(id), id);
  const tap = async id => { for (let i = 0; i < 3; i++) { const w = await btnAt(id); if (!w) throw new Error('no button ' + id); await aim(w); await H.press(page, 'right', 'trigger'); await H.frames(page, 3); if ((await page.evaluate(() => window.__gaVR.lastPress)) === id) break; } await page.evaluate(() => { window.__gaVR.lastPress = null; }); };
  const ms = () => page.evaluate(() => window.__gaVR.mirrorStats());
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await place(2, 4, 0);
    // ---- jetpack ENERGY bar on the left-controller HUD ----
    let hb = await page.evaluate(() => window.__gaVR.hudBar); chk(hb == null, 'no energy bar without the jetpack');
    await page.evaluate(() => { window.__gaPlayer.p.back = 'jetpack'; }); await H.frames(page, 6);
    hb = await page.evaluate(() => ({ bar: window.__gaVR.hudBar, e: window.__arcade.st.fly.e, txt: window.__arcade.scene.getObjectByName('vrHud').userData.txt }));
    chk(hb.bar === Math.round(hb.e * 100) && hb.bar >= 99 && /\|bar\d+/.test(hb.txt), 'jetpack on: the HUD shows a full ENERGY bar (' + hb.bar + '%)');
    await H.btn(page, 'right', 'a-button', 1); await H.frames(page, 60);
    const hb2 = await page.evaluate(() => ({ bar: window.__gaVR.hudBar, e: window.__arcade.st.fly.e, y: window.__arcade.monkey.position.y }));
    await H.btn(page, 'right', 'a-button', 0);
    chk(hb2.y > 0.3 && hb2.bar < hb.bar && Math.abs(hb2.bar - hb2.e * 100) <= 1, 'flying drains it: ' + hb.bar + '% -> ' + hb2.bar + '% (game energy ' + (hb2.e * 100).toFixed(1) + '%)');
    await page.waitForFunction(() => !window.__arcade.st.fly.air, null, { timeout: 30000 }); await H.frames(page, 40);
    const hb3 = await page.evaluate(() => window.__gaVR.hudBar); chk(hb3 > hb2.bar, 'it refills on the ground (' + hb2.bar + '% -> ' + hb3 + '%)');
    await page.evaluate(() => { window.__gaPlayer.p.back = 'none'; }); await H.frames(page, 4); chk((await page.evaluate(() => window.__gaVR.hudBar)) == null, 'jetpack off: the bar goes away');
    // ---- beam to the shop: the mirror is live straight away ----
    await page.evaluate(() => { window.__tpTimeScale = 3; window.__arcade.play.addTickets(60); window.__gaVR.ui.beam(); });
    await page.waitForFunction(() => { const s = window.__gaVR.state(); return s.tpWhere === 2 && s.tpState === 'idle' && window.__gaVR.ui.shop() && window.__gaVR.ui.shop().wardrobe; }, null, { timeout: 90000 });
    await H.frames(page, 4);
    const M = await page.evaluate(() => { const m = window.__gaVR.ui.shop().wardrobe.mirror.mesh, T = window.__arcade.THREE, p = m.getWorldPosition(new T.Vector3()), n = m.getWorldDirection(new T.Vector3()); return { p: p.toArray(), n: n.toArray() }; });
    const pad = await page.evaluate(() => window.__arcade.monkey.position.toArray());
    const dPad = Math.hypot(pad[0] - M.p[0], pad[2] - M.p[2]);
    // stand on the pad and look at the mirror
    await place(pad[0], pad[2], Math.atan2(-(M.p[0] - pad[0]), -(M.p[2] - pad[2])));
    const m0 = await ms(); await H.frames(page, 30); const m1 = await ms();
    chk(m1.twin && !m1.shopVisible && m1.renders - m0.renders >= 6, 'from the teleporter pad (' + dPad.toFixed(1) + ' m away) the mirror redraws: ' + (m1.renders - m0.renders) + ' draws in 30 frames' + (m1.far > m0.far ? ' (far rate)' : '') + ' ' + JSON.stringify(m1));
    const rt = await page.evaluate(() => window.__gaVR.mirrorRT()); chk(rt && rt.vr && Math.max(rt.w, rt.h) >= 1024, 'sharp VR mirror target ' + rt.w + 'x' + rt.h);
    // near the mirror, seeing yourself: every frame
    const yaw = Math.atan2(M.n[0], M.n[2]); await place(M.p[0] + M.n[0] * 1.6, M.p[2] + M.n[2] * 1.6, yaw);
    const n0 = await ms(); const f0 = await page.evaluate(() => window.__gaVR.frames); await H.frames(page, 20); const n1 = await ms(); const f1 = await page.evaluate(() => window.__gaVR.frames);
    chk(n1.renders - n0.renders >= (f1 - f0) - 1, 'in front of it (you are in it): one draw per frame (' + (n1.renders - n0.renders) + ' draws / ' + (f1 - f0) + ' frames)');
    // turn your back: no draws
    await place(M.p[0] + M.n[0] * 1.6, M.p[2] + M.n[2] * 1.6, yaw + Math.PI); const b0 = await ms(); await H.frames(page, 15); const b1 = await ms();
    chk(b1.renders - b0.renders <= 1, 'looking away: it stops drawing (' + (b1.renders - b0.renders) + ' draws)');
    // ---- laser pistol from the right controller ----
    await place(M.p[0] + M.n[0] * 3, M.p[2] + M.n[2] * 3, 0);
    await page.evaluate(() => { const g = window.__gaPlayer; window.__arcade.play.addTickets(10); });
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3); await tap('ward'); await tap('cat_hand'); await tap('w_hand_pistol'); await tap('close');
    chk(await page.evaluate(() => window.__gaVR.gear().laser && window.__roomFire.shown), 'LASER PISTOL on');
    const rig = await page.evaluate(() => window.__gaVR.rig);
    const shoot = async (target, holdMs = 300) => { await aim(target); await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 6); await page.waitForTimeout(holdMs); await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 4);
      return page.evaluate(() => { const v = window.__gaVR.vrLaser(), L = window.__roomFire.lasers[window.__roomFire.lasers.length - 1]; return { v, L: L && { dir: L.dir.toArray(), y: L.mesh.position.y, p: L.mesh.position.toArray(), hue: L.hue }, shots: window.__roomFire.shots }; }); };
    // hand down -> shoots down
    let s0 = await page.evaluate(() => window.__roomFire.shots);
    let r = await shoot([rig.x + 0.25, 0.05, rig.z - 0.45]);
    chk(r.shots === s0 + 1 && r.v.last && r.v.last.d[1] < -0.6 && r.L && r.L.dir[1] < -0.6, 'hand pointing down: the bolt flies down (dir y ' + (r.L ? r.L.dir[1].toFixed(2) : '?') + ')');
    const ao = r.v.aim && r.v.aim.o, lo = r.v.last && r.v.last.o; chk(ao && lo && Math.hypot(ao[0] - lo[0], ao[1] - lo[1], ao[2] - lo[2]) < 0.2 && lo[1] < 1.5, 'it leaves from the right controller (origin y ' + (lo ? lo[1].toFixed(2) : '?') + ' m), not the head');
    const y1 = r.L.y; await H.frames(page, 3); const y2 = await page.evaluate(() => { const L = window.__roomFire.lasers[window.__roomFire.lasers.length - 1]; return L ? L.mesh.position.y : null; });
    chk(y2 != null && y2 < y1, 'and keeps going down (' + y1.toFixed(2) + ' -> ' + (y2 != null ? y2.toFixed(2) : 'gone') + ')');
    // hand up -> shoots up; hand to the right -> shoots right
    r = await shoot([rig.x + 0.4, 3.2, rig.z - 1.2]); chk(r.L && r.L.dir[1] > 0.5, 'hand pointing up: the bolt flies up (dir y ' + (r.L ? r.L.dir[1].toFixed(2) : '?') + ')');
    r = await shoot([rig.x + 3, 1.3, rig.z - 0.2]); chk(r.L && r.L.dir[0] > 0.8, 'hand pointing right: the bolt flies right (dir x ' + (r.L ? r.L.dir[0].toFixed(2) : '?') + ')');
    // charge glow on the controller: blue for the monkey, grows while held
    await aim([rig.x + 0.2, 1.3, rig.z - 2]);
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 8); const g1 = await page.evaluate(() => window.__gaVR.vrLaser()); await H.frames(page, 25); const g2 = await page.evaluate(() => window.__gaVR.vrLaser());
    await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 4); const g3 = await page.evaluate(() => window.__gaVR.vrLaser());
    chk(g1.glow && g1.glow.color === 0x2f8cff && g2.glow.scale > g1.glow.scale && !g3.glow, 'monkey: blue charge glow on the controller, growing (' + (g1.glow ? g1.glow.scale.toFixed(2) + ' -> ' + g2.glow.scale.toFixed(2) : 'none') + '), gone on release');
    const gd = g2.glow && g2.aim ? Math.hypot(g2.glow.at[0] - g2.aim.o[0], g2.glow.at[1] - g2.aim.o[1], g2.glow.at[2] - g2.aim.o[2]) : 9; chk(gd < 0.05, 'the glow sits on the right controller (' + gd.toFixed(3) + ' m)');
    // alien: red
    await page.evaluate(() => window.__gaPlayer.setChar('alien')); await H.frames(page, 6);
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 10); const ga = await page.evaluate(() => window.__gaVR.vrLaser()); await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 4);
    const lh = await page.evaluate(() => window.__roomFire.last);
    chk(ga.glow && ga.glow.color === 0xff2a33 && lh && lh.hue === 'red', 'alien: red charge glow, red bolt (' + (ga.glow ? '#' + ga.glow.color.toString(16) : 'none') + ', ' + (lh && lh.hue) + ')');
    await page.evaluate(() => window.__gaPlayer.setChar('monkey')); await H.frames(page, 6);
    // full charge = beam along the controller
    await aim([rig.x + 0.25, 0.2, rig.z - 1.0]);
    await H.btn(page, 'right', 'b-button', 1); await page.waitForFunction(() => window.__gaVR.vrLaser().beam, null, { timeout: 60000 });
    const bm = await page.evaluate(() => window.__gaVR.vrLaser()); await H.btn(page, 'right', 'b-button', 0);
    chk(bm.beam && bm.last && bm.last.beam && bm.last.d[1] < -0.5, 'a full charge fires the beam along the controller (dir y ' + (bm.last ? bm.last.d[1].toFixed(2) : '?') + ')');
    await page.waitForFunction(() => !window.__gaVR.vrLaser().beam, null, { timeout: 60000 }); chk(true, 'the beam ends');
    chk(!(await page.evaluate(() => window.__roomFire.held)), "roomfire's body aim stays unused in VR");
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 500)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
