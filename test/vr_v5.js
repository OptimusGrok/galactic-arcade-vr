// t354u: MONKEY BACKPACK in the Y/B menu (list Grok Shop + claw prizes, equip into the hands with the ray, put away), and Sky Tower
// in VR: left stick moves, right stick pans the camera, X/A hold = jetpack, Y/B = laser (and Y/B go to the game, not the menu).
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB } });
  const st = () => page.evaluate(() => window.__gaVR.state());
  const place = async (x, z, yaw = 0) => { await page.evaluate(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 6); };
  const LOCAL = [0.2, 1.3, -0.2];
  const aim = async (target, hand = 'right') => { await H.aimGun(page, hand, LOCAL, target); await H.frames(page, 3); };
  const btnAt = id => page.evaluate(id => window.__gaVR.ui.btnWorld(id), id);
  const tap = async id => { const w = await btnAt(id); if (!w) throw new Error('no button ' + id + ' in ' + (await page.evaluate(() => window.__gaVR.ui.kind + ': ' + window.__gaVR.ui.btns.map(b => b.id).join(',')))); for (let i = 0; i < 3; i++) { await aim(await btnAt(id) || w); await H.press(page, 'right', 'trigger'); await H.frames(page, 3); if ((await page.evaluate(() => window.__gaVR.lastPress)) === id) break; await page.evaluate(() => { window.__gaVR.lastPress = null; }); } await page.evaluate(() => { window.__gaVR.lastPress = null; }); };
  const held = () => page.evaluate(() => { const h = window.__shop && window.__shop.held; return h ? { R: h.R || null, L: h.L || null } : null; });
  const ids = () => page.evaluate(() => window.__gaVR.ui.btns.map(b => b.id));
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await place(2, 4, 0);
    // ---- backpack: one Grok Shop candy (hand), one teddy (hug), two claw bears (hand) ----
    await page.evaluate(() => { localStorage.setItem('neonarcade.prizes', JSON.stringify({ cotton: 1, teddy: 1 })); localStorage.setItem('arcade_clawMachine.collection', JSON.stringify({ bear: 2 })); localStorage.removeItem('neonarcade.held'); });
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3);   // v25: Y = menu (B = gun fire only)
    chk((await st()).panel === 'menu' && (await ids()).includes('pack'), 'Y opens the menu and it has MONKEY BACKPACK (' + (await page.evaluate(() => (window.__gaVR.ui.btns.find(b => b.id === 'pack') || {}).label)) + ')');
    await tap('pack'); chk((await st()).panel === 'pack', 'pointing at MONKEY BACKPACK + trigger opens the backpack');
    await page.waitForFunction(() => window.__gaVR.ui.btns.some(b => b.id === 'p_cotton'), null, { timeout: 60000 });
    await page.waitForFunction(() => window.__shop && window.__shop.registerHoldable && JSON.stringify(window.__shop.held) && true, null, { timeout: 10000 });
    await page.waitForTimeout(2500);   // inventory.js registers claw plushes as holdables on its 2 s tick
    const items = await page.evaluate(() => window.__gaVR.ui.btns.filter(b => /^p_/.test(b.id)).map(b => b.label));
    chk(items.length === 3 && items.some(l => /COTTON/.test(l)) && items.some(l => /TEDDY BEAR x?/.test(l)) && items.some(l => /TEDDY BEAR PLUSH x2/.test(l)), 'the backpack lists shop + claw prizes: ' + items.join(' | '));
    await tap('p_claw:bear'); let h = await held(); chk(h && h.R === 'claw:bear', 'tap the claw bear -> held in the RIGHT hand ' + JSON.stringify(h));
    await tap('p_cotton'); h = await held(); chk(h && h.R === 'claw:bear' && h.L === 'cotton', 'tap the cotton candy -> LEFT hand, bear stays in the right ' + JSON.stringify(h));
    const obj = await page.evaluate(() => { const o = window.__shop.heldObj; return !!(o && o.parent); }); chk(obj, 'the held prize is on the monkey in 3D');
    const lbl = await page.evaluate(() => (window.__gaVR.ui.btns.find(b => b.id === 'p_cotton') || {}).label); chk(/·\s+L$/.test(lbl), 'the button shows which hand (' + lbl + ')');
    await tap('away_R'); h = await held(); chk(h.R === null && h.L === 'cotton', 'PUT R AWAY empties the right hand ' + JSON.stringify(h));
    await tap('p_teddy'); h = await held(); chk(h.R === 'teddy' && h.L === null, 'the big teddy is a two-arm hug ' + JSON.stringify(h));
    await tap('p_teddy'); h = await held(); chk(h.R === null && h.L === null, 'tap the held teddy again puts it away ' + JSON.stringify(h));
    await tap('p_claw:bear'); await tap('p_cotton'); await tap('away'); h = await held(); chk(h.R === null && h.L === null, 'PUT BOTH AWAY empties both hands ' + JSON.stringify(h));
    const c = await page.evaluate(() => ({ e: window.__gaVR.packEquips, u: window.__gaVR.packUnequips })); chk(c.e === 5 && c.u === 3, 'equips ' + c.e + ', put-aways ' + c.u);
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3); chk(!(await st()).panel, 'Y closes the backpack');   // v25: Y = menu
    // ---- t355u: money + tickets in the menu ----
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3);
    const subOf = () => page.evaluate(() => { const c = window.__gaVR.ui; return c.kind === 'menu' ? window.__gaVR.uiSub() : null; });
    let w = await page.evaluate(() => window.__gaVR.wallet()); let sb = await subOf();
    chk(sb === '$' + w.cash + ' CASH   ·   ' + w.tickets + ' TICKETS' && w.tickets > 0, 'the menu shows money + tickets: "' + sb + '"');
    await page.evaluate(() => window.__arcade.play.addTickets(7)); await H.frames(page, 3); const w2 = await page.evaluate(() => window.__gaVR.wallet()); sb = await subOf();
    chk(w2.tickets === w.tickets + 7 && sb.includes(w2.tickets + ' TICKETS'), 'tickets update live in the open menu (' + w.tickets + ' -> ' + w2.tickets + ')');
    await page.evaluate(() => { window.__kiosk.C.bal = 3; }); await H.frames(page, 3); sb = await subOf(); chk(/^\$3 CASH/.test(sb), 'cash updates live ("' + sb + '")');
    // ---- t355u: JETPACK on -> hold A flies (in the arcade world) ----
    await page.evaluate(() => window.__arcade.play.addTickets(30)); await H.frames(page, 3);
    await tap('pack'); await tap('ward'); await tap('cat_back'); await tap('w_back_jetpack'); let gr = await page.evaluate(() => window.__gaVR.gear());
    chk(gr.jet, 'JETPACK bought + worn from ACCESSORIES in VR'); await tap('close');
    const fy0 = await page.evaluate(() => ({ m: window.__arcade.monkey.position.y, r: window.__gaVR.rig.y }));
    await H.btn(page, 'right', 'a-button', 1); await page.waitForFunction(y0 => window.__arcade.monkey.position.y > y0 + 0.8, fy0.m, { timeout: 5000 }).catch(() => {}); await H.frames(page, 4);   // slow emulator frames: wait for the rise, not a fixed time
    const fy1 = await page.evaluate(() => ({ m: window.__arcade.monkey.position.y, r: window.__gaVR.rig.y, hold: window.__arcade.st.fly.hold, air: window.__arcade.st.fly.air }));
    chk(fy1.hold && fy1.m > fy0.m + 0.8 && Math.abs(fy1.r - fy1.m) < 0.05, 'hold A flies: the player + headset rise (' + fy0.m.toFixed(2) + ' -> ' + fy1.m.toFixed(2) + ' m)');
    await H.btn(page, 'right', 'a-button', 0); await H.frames(page, 90);
    const fy2 = await page.evaluate(() => ({ m: window.__arcade.monkey.position.y, hold: window.__arcade.st.fly.hold }));
    chk(!fy2.hold && fy2.m < fy1.m - 0.3, 'let go of A and you come back down (' + fy2.m.toFixed(2) + ' m)');
    await page.waitForFunction(() => !window.__arcade.st.fly.air, null, { timeout: 30000 }); await H.frames(page, 6);
    await H.press(page, 'right', 'b-button'); await H.frames(page, 3); chk(!(await st()).panel, 'v25 jetpack only: B does nothing (no menu)');
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3); chk((await st()).panel === 'menu', 'jetpack only: Y opens the menu');
    // ---- t355u: LASER PISTOL on -> B shoots, menu on Y only ----
    await tap('pack'); await tap('ward'); await tap('cat_hand'); await tap('w_hand_pistol'); gr = await page.evaluate(() => window.__gaVR.gear()); chk(gr.laser, 'LASER PISTOL bought + held from ACCESSORIES in VR'); await tap('close');
    await H.frames(page, 6); const rs = await page.evaluate(() => window.__roomFire.shown); chk(rs, 'the pistol is live in VR');
    const s0 = await page.evaluate(() => window.__roomFire.shots);
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 4); const hd = await page.evaluate(() => window.__gaVR.vrLaser().held); await page.waitForTimeout(250);
    await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 6); const s1 = await page.evaluate(() => window.__roomFire.shots);
    chk(hd && s1 > s0 && !(await st()).panel, 'B shoots the laser (shots ' + s0 + ' -> ' + s1 + '), no menu');
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3); chk((await st()).panel === 'menu', 'with the laser on, Y opens the menu');
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3); chk(!(await st()).panel, 'and Y closes it');
    await H.btn(page, 'right', 'a-button', 1); await page.waitForTimeout(500); const both = await page.evaluate(() => window.__arcade.st.fly.hold); await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 4);
    const bothF = await page.evaluate(() => window.__gaVR.vrLaser().held); await H.btn(page, 'right', 'b-button', 0); await H.btn(page, 'right', 'a-button', 0); await page.waitForTimeout(1500);
    chk(both && bothF, 'fly (A) and shoot (B) together');
    await H.press(page, 'left', 'y-button'); await tap('pack'); await tap('ward'); await tap('cat_hand'); await tap('remove'); await tap('close');
    { const s0 = await page.evaluate(() => window.__roomFire.shots); await H.press(page, 'right', 'b-button'); await H.frames(page, 3);
      chk(!(await st()).panel && !(await page.evaluate(() => window.__gaVR.gear().laser)) && (await page.evaluate(() => window.__roomFire.shots)) === s0, 'v25 pistol off: B does nothing (no menu, no shot)'); }
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3); chk((await st()).panel === 'menu', 'pistol off: Y opens the menu');
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3);
    // ---- Sky Tower ----
    await page.evaluate(() => { window.__arcade.play.addTickets(20); const m = window.__arcade.play.machines.skytower; window.__gaVR.startCab(m.cab, m.cab.userData.centre); });
    await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 90000 });
    for (let i = 0; i < 6 && (await page.evaluate(() => window.__arcade.play.sub)) !== 'play'; i++) { await H.press(page, 'right', 'a-button'); await page.waitForTimeout(500); }
    chk((await st()).sub === 'play', 'Sky Tower started with A');
    const sky = s => page.evaluate(s => { const w = window.__arcade.play.frame.contentWindow, T = w.__skytower; return T ? (0, eval)('(T => (' + s + '))')(T) : null; }, s);
    await page.waitForFunction(() => { const T = window.__arcade.play.frame.contentWindow.__skytower; return T && T.active(); }, null, { timeout: 30000 });
    await H.frames(page, 10);
    // left stick: moves (G.ix / G.iz) - and does not turn the camera
    let y0 = await sky('T.G.camYaw');
    await H.axes(page, 'left', 1, 0); await H.frames(page, 6); let m = await sky('({ ix: T.G.ix, iz: T.G.iz, yaw: T.G.camYaw })');
    chk(m.ix === 1 && Math.abs(m.yaw - y0) < 1e-6, 'left stick right = move right (ix ' + m.ix + '), camera still');
    await H.axes(page, 'left', 0, -1); await H.frames(page, 6); m = await sky('({ ix: T.G.ix, iz: T.G.iz })'); chk(m.iz === -1 && m.ix === 0, 'left stick up = move forward (iz ' + m.iz + ')');
    await H.axes(page, 'left', 0, 0); await H.frames(page, 6);
    // right stick: pans the camera, does not move
    y0 = await sky('T.G.camYaw'); const p0 = await sky('T.G.camPitch');
    await H.axes(page, 'right', 1, 0); await H.frames(page, 20); m = await sky('({ ix: T.G.ix, iz: T.G.iz, yaw: T.G.camYaw })');
    chk(m.ix === 0 && m.iz === 0 && Math.abs(m.yaw - y0) > 0.2, 'right stick right pans the camera (yaw ' + y0.toFixed(2) + ' -> ' + m.yaw.toFixed(2) + '), no walking');
    await H.axes(page, 'right', 1, 0); const yA = await sky('T.G.camYaw'); await H.axes(page, 'right', -1, 0); await H.frames(page, 10); const yB = await sky('T.G.camYaw');
    chk(Math.sign(yB - yA) === -Math.sign(m.yaw - y0), 'right stick left pans the other way');
    await H.axes(page, 'right', 0, -1); await H.frames(page, 10); const p1 = await sky('T.G.camPitch'); chk(Math.abs(p1 - p0) > 0.05, 'right stick up/down tilts the camera (pitch ' + p0.toFixed(2) + ' -> ' + p1.toFixed(2) + ')');
    await H.axes(page, 'right', 0, 0); await H.frames(page, 6);
    // X / A hold = jetpack
    for (const [hand, b] of [['left', 'x-button'], ['right', 'a-button']]) {
      const yy = await sky('T.player.position.y');
      await H.btn(page, hand, b, 1); await H.frames(page, 4); const on = await sky('T.G.flyHeld'); await page.waitForTimeout(900); await H.frames(page, 4);
      const y1 = await sky('T.player.position.y'); await H.btn(page, hand, b, 0); await H.frames(page, 4); const off = await sky('T.G.flyHeld');
      chk(on === true && off === false && y1 > yy + 0.3, (b === 'x-button' ? 'X' : 'A') + ' held flies the jetpack (y ' + yy.toFixed(2) + ' -> ' + y1.toFixed(2) + '), release stops');
      await page.waitForTimeout(1500);
    }
    // Y / B = laser (hold charges, release shoots), and they stay in the game (no menu)
    for (const [hand, b] of [['left', 'y-button'], ['right', 'b-button']]) {
      const n0 = await sky('T.SHOT.n');
      await H.btn(page, hand, b, 1); await H.frames(page, 4); const on = await sky('T.G.fireHeld'); await page.waitForTimeout(300);
      await H.btn(page, hand, b, 0); await H.frames(page, 6); const n1 = await sky('T.SHOT.n'); const s = await st();
      chk(on === true && n1 > n0 && !s.panel && s.mode === 'game', (b === 'y-button' ? 'Y' : 'B') + ' fires the laser (shots ' + n0 + ' -> ' + n1 + '), no menu');
      await page.waitForTimeout(700);
    }
    const n0 = await sky('T.SHOT.n'); await H.btn(page, 'right', 'trigger', 1); await H.frames(page, 4); await page.waitForTimeout(200); await H.btn(page, 'right', 'trigger', 0); await H.frames(page, 6);
    chk((await sky('T.SHOT.n')) > n0, 'trigger fires the laser too');
    await H.btn(page, 'left', 'squeeze', 1); await page.waitForFunction(() => window.__arcade.play.mode !== 'game', null, { timeout: 15000 }); await H.btn(page, 'left', 'squeeze', 0);
    await page.waitForFunction(() => window.__arcade.play.mode === 'walk', null, { timeout: 20000 }); await H.frames(page, 6);
    await H.press(page, 'left', 'y-button'); await H.frames(page, 3); chk((await st()).panel === 'menu', 'after leaving, Y opens the menu again');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 500)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
