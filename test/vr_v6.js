// t358u/t359u: the shop mirror is live as soon as you beam in (not frozen until you walk halfway), smooth when near or when you are in it;
// the left-controller HUD shows the jetpack ENERGY bar (main.js st.fly.e); the laser pistol fires from the RIGHT CONTROLLER in full 3D
// (hand down = shoots down) with a charge glow on the controller: blue for the monkey, red for the alien.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB + `
    window.__batMock = Object.assign(new EventTarget(), { level: 0.62, charging: false, chargingTime: Infinity, dischargingTime: 3600 });
    Object.defineProperty(navigator, 'getBattery', { configurable: true, value: () => Promise.resolve(window.__batMock) });` } });
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
    // ---- t361u: headset battery on the left-controller display (mocked navigator.getBattery) ----
    await H.frames(page, 6); let bt = await page.evaluate(() => window.__gaVR.battery());
    chk(bt.supported && bt.shown && Math.round(bt.level * 100) === 62 && !bt.charging && /\|bat62(\||$)/.test(await page.evaluate(() => window.__arcade.scene.getObjectByName('vrHud').userData.txt)), 'the HUD shows the headset battery: 62%');
    await page.evaluate(() => { const b = window.__batMock; b.level = 0.35; b.dispatchEvent(new Event('levelchange')); b.charging = true; b.dispatchEvent(new Event('chargingchange')); }); await H.frames(page, 4);
    bt = await page.evaluate(() => window.__gaVR.battery()); const btx = await page.evaluate(() => window.__arcade.scene.getObjectByName('vrHud').userData.txt);
    chk(Math.round(bt.level * 100) === 35 && bt.charging && /\|bat35c/.test(btx), 'it updates live: 35% + charging bolt');
    await page.evaluate(() => { const b = window.__batMock; b.charging = false; b.dispatchEvent(new Event('chargingchange')); }); await H.frames(page, 4);
    chk(/\|bat35(\||$)/.test(await page.evaluate(() => window.__arcade.scene.getObjectByName('vrHud').userData.txt)), 'unplugged: the bolt goes away');
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
    // ---- t360u: the avatar's hands follow the controllers (seen in the mirror) ----
    await place(M.p[0] + M.n[0] * 1.6, M.p[2] + M.n[2] * 1.6, yaw);
    const hands = () => page.evaluate(() => window.__gaVR.avatarHands());
    const fwd = await page.evaluate(() => { const r = window.__gaVR.rig; return [r.x, r.z]; });
    const T1 = [fwd[0] + M.n[0] * -2, 1.5, fwd[1] + M.n[2] * -2];
    await H.aim(page, 'right', [0.25, 1.75, -0.35], T1); await H.aim(page, 'left', [-0.25, 1.75, -0.35], T1); await H.frames(page, 6); const up = await hands();
    await H.aim(page, 'right', [0.25, 0.85, -0.05], T1); await H.aim(page, 'left', [-0.25, 0.85, -0.05], T1); await H.frames(page, 6); const dn = await hands();
    const R1 = up.find(a => a.sd > 0), R2 = dn.find(a => a.sd > 0), L1 = up.find(a => a.sd < 0), L2 = dn.find(a => a.sd < 0);
    chk(R1 && R2 && R1.hand[1] - R2.hand[1] > 0.15 && L1.hand[1] - L2.hand[1] > 0.15, 'raise / lower the controllers: the avatar hands go up and down (right ' + R1.hand[1].toFixed(2) + ' -> ' + R2.hand[1].toFixed(2) + ' m, left ' + L1.hand[1].toFixed(2) + ' -> ' + L2.hand[1].toFixed(2) + ' m)');
    await H.aim(page, 'right', [0.6, 1.3, -0.2], T1); await H.frames(page, 6); const out = await hands(); const R3 = out.find(a => a.sd > 0);
    const side = await page.evaluate(([a, b]) => { const h = window.__gaVR.state().head; const rx = Math.cos(h.yaw), rz = -Math.sin(h.yaw); return (b[0] - a[0]) * rx + (b[2] - a[2]) * rz; }, [R2.hand, R3.hand]);
    chk(side > 0.05, 'move the right controller out to the side: the avatar hand follows (' + side.toFixed(2) + ' m to the right)');
    chk(dn.filter(a => a.sd).every(a => a.model), 'each avatar hand holds a controller model');
    // ---- t360u: CHAT WITH GROK (the shop clerk) ----
    await H.aim(page, 'left', [-0.2, 1.3, -0.2], T1);
    const cs = await page.evaluate(() => { const s = window.__gaVR.signs().find(q => q.id === 'chatClerk'); return s ? s.at : null; });
    chk(!!cs, 'CHAT WITH GROK sign over the shop clerk');
    await place(cs[0] + 0, cs[2] + 3.5, Math.atan2(0, 3.5)); await H.frames(page, 4);
    const cs2 = await page.evaluate(() => { const s = window.__gaVR.signs().find(q => q.id === 'chatClerk'); return s ? s.at : null; });
    await aim(cs2); await H.press(page, 'right', 'trigger'); await H.frames(page, 4);
    let ch = await page.evaluate(() => ({ panel: window.__gaVR.state().panel, open: window.__grokChat.open, src: window.__grokChat.ctx && window.__grokChat.ctx.source, a: window.__gaVR.chat.a }));
    chk(ch.panel === 'chat' && ch.open && ch.src === 'clerk' && /Grok/.test(ch.a), 'point + trigger opens the chat; Grok says hi: "' + ch.a.slice(0, 60) + '..."');
    await tap('q_4'); ch = await page.evaluate(() => ({ q: window.__gaVR.chat.q, a: window.__gaVR.chat.a, last: window.__grokChat.log.slice(-2), id: window.__grokChat.last }));
    chk(ch.q === 'TELL ME A JOKE' && ch.id === 'joke' && ch.last[0].text === 'TELL ME A JOKE' && ch.last[1].who === 'g' && ch.last[1].text === ch.a, 'TELL ME A JOKE -> Grok: "' + ch.a.slice(0, 70) + '"');
    await tap('q_0'); ch = await page.evaluate(() => ({ a: window.__gaVR.chat.a, id: window.__grokChat.last })); chk(ch.id === 'games' && ch.a.length > 20, 'WHAT GAMES ARE THERE? -> the games answer');
    await tap('next'); const q8 = await page.evaluate(() => window.__gaVR.ui.btns.filter(b => /^q_/.test(b.id)).map(b => b.label)); chk(q8.includes('HOW DO I PLAY BERSERKER?'), 'more questions on the next page (' + q8.length + ')');
    await tap('q_10'); ch = await page.evaluate(() => ({ a: window.__gaVR.chat.a, id: window.__grokChat.last })); chk(ch.id === 'berserker', 'HOW DO I PLAY BERSERKER? -> "' + ch.a.slice(0, 60) + '..."');
    await tap('close'); ch = await page.evaluate(() => ({ panel: window.__gaVR.state().panel, open: window.__grokChat.open })); chk(!ch.panel && !ch.open, 'CLOSE ends the chat (Grok goes back to work)');
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
    // t361u: the alien's shot leaves its floating machine, aimed where the right controller points
    await aim([rig.x + 0.3, 0.4, rig.z - 1.6]); await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 8); const ge = await page.evaluate(() => window.__gaVR.vrLaser()); await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 3);
    const al = await page.evaluate(() => window.__gaVR.vrLaser());
    const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const tgt = al.ctrl && al.ctrl.o.map((v, i) => v + al.ctrl.d[i] * 20), want = tgt && al.eye ? (() => { const v = tgt.map((x, i) => x - al.eye[i]), l = Math.hypot(...v); return v.map(x => x / l); })() : null;
    const dot = want && al.last ? al.last.d.reduce((a, x, i) => a + x * want[i], 0) : 0;
    chk(al.eye && al.last && dE(al.last.o, al.eye) < 0.2 && dE(al.last.o, al.ctrl.o) > 0.15, 'alien: the bolt leaves the floating machine (' + (al.eye ? dE(al.last.o, al.eye).toFixed(2) : '?') + ' m from it, not the hand)');
    chk(dot > 0.999 && al.last.d[1] < -0.2, 'and flies where the right controller points (aim match ' + dot.toFixed(4) + ')');
    chk(ge.glow && al.eye && dE(ge.glow.at, al.eye) < 0.2, 'the red charge glow sits on the machine (' + (ge.glow && al.eye ? dE(ge.glow.at, al.eye).toFixed(2) : '?') + ' m)');
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
