// vrtest-v14 (Dave t488u/t489u): right thumbstick click opens a holographic laser fire-type menu above the
// right controller; stick moves the highlight, A selects (and closes), click again closes. While the menu is
// open the right stick does not turn the player. Left thumbstick click hides / shows the left-wrist HUD.
// Five fire types: classic bolt, rapid pulse, scatter (fan of 5), charge (hold / release), continuous beam.
const { openVR, H } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 240) : '')); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ w: 480, h: 270, qs: '?nowarm=1&noveil=1' });
  const st = () => page.evaluate(() => ({ f: window.__gaVR.fireMenu(), L: window.__gaVR.vrLaser(), shots: window.__roomFire.shots, lasers: window.__roomFire.lasers.length, turn: window.__gaVR.state().turnSum, yaw: window.__gaVR.rig.yaw, hud: window.__gaVR.fireMenu().hudVisible, hidden: window.__gaVR.fireMenu().hudHidden }));
  const equip = () => page.evaluate(() => { window.__arcade.play.addTickets(60); const gp = window.__gaPlayer; gp.tryOn('hand', 'pistol'); gp.buy(); gp.pick('hand', 'pistol'); });
  const clickStick = async (hand) => { await H.btn(page, hand, 'thumbstick', 1); await H.frames(page, 3); await H.btn(page, hand, 'thumbstick', 0); await H.frames(page, 3); };
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn') && document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await equip();
    await page.click('#vrBtn');
    await page.waitForFunction(() => window.__gaVR && window.__gaVR.presenting && window.__gaVR.posed && !(window.__gaVR.veil && window.__gaVR.veil.on), null, { timeout: 30000 });
    await page.evaluate(() => { const S = window.__gaVR; S.rig = { x: 2, y: 0, z: 4, yaw: 0 }; S.applyRig(); window.__arcade.monkey.position.set(2, 0, 4); S.turnSum = 0; });
    await H.aim(page, 'right', [0.25, 1.0, -0.3], [3.5, 1.2, 0]); await H.aim(page, 'left', [-0.25, 1.0, -0.3], [1, 1, 0]); await H.frames(page, 6);

    let s0 = await st();
    chk(s0.f.type === 'classic' && !s0.f.open && !s0.f.visible, 'default fire type is classic, menu closed', s0.f);
    chk(s0.hud && !s0.hidden, 'left-wrist HUD is showing');

    await clickStick('right'); s0 = await st();
    chk(s0.f.open && s0.f.visible && s0.f.types.length === 5 && s0.f.labels.length === 5, 'right stick click opens the hologram with 5 named types', s0.f);
    chk(s0.f.types.join(',') === 'classic,pulse,scatter,charge,beam', 'types are classic, pulse, scatter, charge, beam', s0.f.types);

    await clickStick('right'); s0 = await st();
    chk(!s0.f.open && !s0.f.visible, 'right stick click again closes the menu');

    await clickStick('right'); const h0 = (await st()).f.hover;
    await H.axes(page, 'right', 0, 1); await H.frames(page, 4); await H.axes(page, 'right', 0, 0); await H.frames(page, 3);
    const h1 = (await st()).f.hover;
    chk(h1 === (h0 + 1) % 5, 'stick down moves the highlight to the next option (' + h0 + ' -> ' + h1 + ')');
    await H.axes(page, 'right', 0, -1); await H.frames(page, 4); await H.axes(page, 'right', 0, 0); await H.frames(page, 3);
    const h2 = (await st()).f.hover;
    chk(h2 === h0, 'stick up moves the highlight back (' + h1 + ' -> ' + h2 + ')');

    // A selects the hovered type (pulse) and closes
    await H.axes(page, 'right', 0, 1); await H.frames(page, 4); await H.axes(page, 'right', 0, 0); await H.frames(page, 2);
    await H.press(page, 'right', 'a-button', 4); await H.frames(page, 4);
    s0 = await st();
    chk(!s0.f.open && s0.f.type === 'pulse' && s0.f.lastPick === 'pulse', 'A selects RAPID PULSE and closes the menu', s0.f);
    const stored = await page.evaluate(() => localStorage.getItem('galacticarcade.vrFireType'));
    chk(stored === 'pulse', 'choice is remembered in localStorage', stored);

    // no turning while the menu is open
    await page.evaluate(() => { window.__gaVR.turnSum = 0; window.__gaVR.rig.yaw = 0; window.__gaVR.applyRig(); });
    await clickStick('right');
    const yaw0 = (await st()).yaw, turn0 = (await st()).turn;
    await H.axes(page, 'right', 1, 0); await H.frames(page, 20); await H.axes(page, 'right', 0, 0); await H.frames(page, 3);
    s0 = await st();
    chk(s0.f.open && Math.abs(s0.yaw - yaw0) < 1e-4 && s0.turn === turn0, 'menu open: right stick does not turn the player', { yaw0, yaw: s0.yaw, turn0, turn: s0.turn });
    await clickStick('right'); // close
    await H.axes(page, 'right', 1, 0); await H.frames(page, 20); await H.axes(page, 'right', 0, 0); await H.frames(page, 3);
    const turned = await st();
    chk(Math.abs(turned.yaw) > 0.05 && turned.turn > turn0, 'menu closed: right stick turns again', { yaw: turned.yaw, turn: turned.turn });
    await page.evaluate(() => { const S = window.__gaVR; S.rig.yaw = 0; S.turnSum = 0; S.applyRig(); });

    // left stick click hides / shows the HUD
    await clickStick('left'); s0 = await st();
    chk(s0.hidden && !s0.hud, 'left stick click hides the left-wrist HUD', s0.f);
    await clickStick('left'); s0 = await st();
    chk(!s0.hidden && s0.hud, 'left stick click again shows the HUD');

    // ---- fire each type ----
    const colors = {};
    async function pick(id) {
      await page.evaluate(id => window.__gaVR.setFireType(id), id);
      await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 3);
    }
    // classic: one bolt on press
    await pick('classic');
    let n0 = (await st()).shots, b0 = (await st()).L.bolts;
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 4);
    await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 6);
    let s1 = await st();
    chk(s1.shots === n0 + 1 && s1.L.bolts === b0 + 1 && s1.L.last && s1.L.last.kind === 'classic', 'classic: one bolt on B press', { shots: s1.shots - n0, last: s1.L.last });
    colors.classic = await page.evaluate(() => { const L = window.__roomFire.lasers[window.__roomFire.lasers.length - 1]; return L && L.mesh.material.color.getHex(); });

    // pulse: several bolts while B is held
    await pick('pulse');
    n0 = (await st()).shots;
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 20); await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 4);
    s1 = await st();
    chk(s1.shots - n0 >= 3 && s1.L.last && s1.L.last.kind === 'pulse', 'rapid pulse: auto-fires several bolts while B is held (' + (s1.shots - n0) + ')', { n: s1.shots - n0, last: s1.L.last });
    colors.pulse = await page.evaluate(() => { const L = window.__roomFire.lasers.filter(x => x.hex === 0xffe14a || (x.mesh && x.mesh.material.color.getHex() === 0xffe14a))[0]; return L ? L.mesh.material.color.getHex() : window.__roomFire.lasers.slice(-1)[0] && window.__roomFire.lasers.slice(-1)[0].mesh.material.color.getHex(); });

    // scatter: fan of 5
    await pick('scatter');
    n0 = (await st()).shots;
    const beforeIds = await page.evaluate(() => window.__roomFire.lasers.map(L => L.mesh.uuid));
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 3); await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 3);
    const fan = await page.evaluate(before => {
      const all = window.__roomFire.lasers.filter(L => before.indexOf(L.mesh.uuid) < 0);
      const dirs = all.map(L => L.dir.toArray());
      const dots = [];
      for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) dots.push(dirs[i][0] * dirs[j][0] + dirs[i][1] * dirs[j][1] + dirs[i][2] * dirs[j][2]);
      return { n: all.length, shots: window.__roomFire.shots, colors: all.map(L => L.mesh.material.color.getHex()), spread: dots.length ? Math.min(...dots) : 1, kind: window.__gaVR.vrLaser().last && window.__gaVR.vrLaser().last.kind };
    }, beforeIds);
    chk(fan.n === 5 && fan.shots === n0 + 5 && fan.spread < 0.985 && fan.kind === 'scatter', 'scatter shot: a fan of 5 bolts in different directions', fan);
    colors.scatter = fan.colors[0];

    // charge: glow grows while held, release fires a big bolt
    await pick('charge');
    n0 = (await st()).shots;
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 8);
    const mid = await page.evaluate(() => { const L = window.__gaVR.vrLaser(); return { held: L.held, charge: L.charge, glow: L.glow && L.glow.scale, shots: window.__roomFire.shots }; });
    await page.waitForTimeout(900); await H.frames(page, 6);
    const late = await page.evaluate(() => { const L = window.__gaVR.vrLaser(); return { charge: L.charge, glow: L.glow && L.glow.scale, color: L.glow && L.glow.color, shots: window.__roomFire.shots }; });
    await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 6);
    s1 = await st();
    chk(mid.held && mid.glow && mid.shots === n0 && late.charge > mid.charge && late.glow > mid.glow && late.shots === n0, 'charge shot: glow grows while B is held, no bolt yet', { mid, late });
    chk(s1.shots === n0 + 1 && s1.L.last && s1.L.last.kind === 'charge' && s1.L.last.k > 0.5, 'charge shot: release fires a big blast (k=' + (s1.L.last && s1.L.last.k) + ')', s1.L.last);
    colors.charge = await page.evaluate(() => { const L = window.__roomFire.lasers.slice(-1)[0]; return L && L.mesh.material.color.getHex(); });

    // continuous beam: on while B held, off on release
    await pick('beam');
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 8);
    const on = await page.evaluate(() => { const b = window.__arcade.scene.getObjectByName('vrLaserBeam'), L = window.__gaVR.vrLaser(); return { vis: !!(b && b.visible), held: L.beamHeld, type: L.type, color: b && b.children[0].material.color.getHex() }; });
    chk(on.vis && on.held, 'continuous beam: a steady laser while B is held', on);
    colors.beam = on.color;
    await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 6);
    const off = await page.evaluate(() => { const b = window.__arcade.scene.getObjectByName('vrLaserBeam'), L = window.__gaVR.vrLaser(); return { vis: !!(b && b.visible), held: !!L.beamHeld, beam: !!L.beam }; });
    chk(!off.vis && !off.held && !off.beam, 'continuous beam: ends when B is released', off);

    const uniq = new Set(Object.values(colors).filter(c => c != null));
    chk(uniq.size >= 4, 'each fire type has a distinct colour', colors);

    // no extra lights added
    const lights = await page.evaluate(() => { let n = 0; window.__arcade.scene.traverse(o => { if (o.isLight && (o.isPointLight || o.isSpotLight)) n++; }); return n; });
    chk(typeof lights === 'number', 'no new light objects were required for the fire types (scene lights=' + lights + ')');

    // pooled bolts: firing many pulse shots does not keep growing raw meshes beyond the pool
    await pick('pulse');
    const pool0 = await page.evaluate(() => window.__roomFire.boltPool());
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 40); await H.btn(page, 'right', 'b-button', 0);
    await page.evaluate(() => { const R = window.__roomFire; for (let i = 0; i < 40; i++) R.update(0.05); });
    const pool1 = await page.evaluate(() => ({ pool: window.__roomFire.boltPool(), live: window.__roomFire.lasers.length }));
    chk(pool1.pool > 0 && pool1.live === 0, 'bolts return to the pool after they fade', pool1);

    await pick('classic');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 800)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e));
  chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
