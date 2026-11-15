// t353u: the shop mirror is not black in VR; ACCESSORIES (wardrobe) works with the ray; Berserker power-ups show beside the screen
// and fire from their own buttons (X = THOR, Y = BERSERK, right-grip tap = ODIN) or the ray; every ray stops at the button it hits.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB } });
  const st = () => page.evaluate(() => window.__gaVR.state());
  const place = async (x, z, yaw = 0) => { await page.evaluate(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 6); };
  const LOCAL = [0.2, 1.3, -0.2];
  const aim = async (target, hand = 'right') => { await H.aim(page, hand, LOCAL, target); await H.frames(page, 3); };
  const aimPress = async (target, hand = 'right') => { await aim(target, hand); await H.press(page, hand, 'trigger'); };
  const btnAt = id => page.evaluate(id => window.__gaVR.ui.btnWorld(id), id);
  const sign = id => page.evaluate(id => { const s = window.__gaVR.signs().find(q => q.id === id); return s ? s.at : null; }, id);
  // ray length vs the distance from the controller to the thing it points at
  const rayCut = async (target, hand = 'right') => page.evaluate(([hand, target]) => { const r = window.__gaVR.rayLens ? window.__gaVR.rayLens()[hand] : null; if (!r || !r.o) return { len: null, dist: -1 };
    return { len: r.len, dist: Math.hypot(r.o[0] - target[0], r.o[1] - target[1], r.o[2] - target[2]) }; }, [hand, target]);
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await place(2, 4, 0);
    // ---- laser stops at a menu button (and highlights it) ----
    if (!process.env.MIRROR_ONLY) {
    await H.press(page, 'right', 'b-button'); const bw = await btnAt('beam'); await aim(bw);
    let rc = await rayCut(bw); const hov = await page.evaluate(() => window.__gaVR.ui.kind === 'menu');
    chk(Math.abs(rc.len - rc.dist) < 0.06, 'ray stops at the menu button: ray ' + rc.len.toFixed(2) + ' m, button ' + rc.dist.toFixed(2) + ' m away');
    chk(hov, 'B opened the menu');
    await aimPress(await btnAt('close2'));
    }
    // ---- beam to the shop ----
    await page.evaluate(() => { window.__tpTimeScale = 3; window.__arcade.play.addTickets(60); window.__gaVR.ui.beam(); });
    await page.waitForFunction(() => { const s = window.__gaVR.state(); return s.tpWhere === 2 && s.tpState === 'idle' && window.__gaVR.ui.shop() && window.__gaVR.ui.shop().wardrobe; }, null, { timeout: 90000 });
    // ---- the mirror: stand in front of it, looking at it ----
    const M = await page.evaluate(() => { const m = window.__gaVR.ui.shop().wardrobe.mirror.mesh, T = window.__arcade.THREE, p = m.getWorldPosition(new T.Vector3()), n = m.getWorldDirection(new T.Vector3()); return { p: p.toArray(), n: n.toArray() }; });
    const yaw = Math.atan2(M.n[0], M.n[2]);
    await place(M.p[0] + M.n[0] * 1.3, M.p[2] + M.n[2] * 1.3, yaw);
    await page.evaluate(([y]) => { window.__xrd.position.set(0, 1.25, 0); }, [yaw]); await H.frames(page, 10);
    const r0 = await page.evaluate(() => window.__gaVR.ui.shop().wardrobe.mirror.renders); await page.waitForTimeout(1500); await H.frames(page, 6);
    const mir = await page.evaluate(() => ({ renders: window.__gaVR.ui.shop().wardrobe.mirror.renders, kicks: window.__gaVR.mirrorKicks }));
    chk(mir.renders > r0 + 3 && mir.kicks > 3, 'the mirror renders in VR (' + r0 + ' -> ' + mir.renders + ' renders)');
    const hs = await page.evaluate(() => window.__hsRead(0.3, 0.3, 0.7, 0.7));
    chk(hs && hs.left.lit > 30 && hs.right.lit > 30 && hs.left.mean > 25 && hs.right.mean > 25, 'the headset sees a lit (not black) mirror where you look ' + JSON.stringify(hs && { l: hs.left, r: hs.right }));
    if (process.env.MIRROR_ONLY) { await close(); process.exit(ok ? 0 : 1); }
    // ---- accessories ----
    await place(M.p[0] + M.n[0] * 2.2, M.p[2] + M.n[2] * 2.2, yaw);
    const ws = await sign('ward'); chk(!!ws, 'ACCESSORIES sign over the mirror');
    await aimPress(ws); chk((await st()).panel === 'ward', 'point at ACCESSORIES + trigger opens the accessories');
    await aimPress(await btnAt('cat_glasses'));
    const T0 = await page.evaluate(() => window.__gaPlayer.balance());
    await aimPress(await btnAt('w_glasses_monocle'));
    let g = await page.evaluate(() => ({ on: window.__gaPlayer.p.glasses, owned: window.__gaPlayer.has('glasses', 'monocle'), t: window.__gaPlayer.balance(), buys: window.__gaVR.wardBuys }));
    chk(g.buys === 1 && g.on === 'monocle' && g.owned && g.t === T0 - 5, 'bought + wearing the MONOCLE with the ray (' + T0 + ' -> ' + g.t + ' tickets)');
    await aimPress(await btnAt('remove')); g = await page.evaluate(() => window.__gaPlayer.p.glasses);
    chk(g === 'none', 'REMOVE takes the glasses off');
    await aimPress(await btnAt('w_glasses_monocle')); g = await page.evaluate(() => ({ on: window.__gaPlayer.p.glasses, t: window.__gaPlayer.balance() }));
    chk(g.on === 'monocle' && g.t === T0 - 5, 'owned items equip again for free');
    await aimPress(await btnAt('cat_hat')); const hats = await page.evaluate(() => window.__gaVR.ui.btns.filter(b => /^w_hat_/.test(b.id)).length); chk(hats > 0, 'HAT tab lists hats (' + hats + ')');
    await aimPress(await btnAt('close'));
    // ---- back to the arcade, Berserker ----
    await page.evaluate(() => window.__gaVR.ui.beam());
    await page.waitForFunction(() => { const s = window.__gaVR.state(); return s.tpWhere === 1 && s.tpState === 'idle'; }, null, { timeout: 90000 });
    await place(2, 4, 0);
    await page.evaluate(() => { window.__arcade.play.addTickets(20); const m = window.__arcade.play.machines.berserker; window.__gaVR.startCab(m.cab, m.cab.userData.centre); });
    await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 30000 });
    for (let i = 0; i < 6 && (await page.evaluate(() => window.__arcade.play.sub)) !== 'play'; i++) { await H.press(page, 'right', 'a-button'); await page.waitForTimeout(400); }
    chk((await st()).sub === 'play', 'Berserker started with A');
    const fr = page.frames().find(f => /berserker-play/.test(f.url()));
    await page.waitForFunction(() => true); await H.frames(page, 10);
    // A = attack (KeyJ), B = dash (Space)
    const k0 = await page.evaluate(() => window.__gaVR.keysSent); await H.press(page, 'right', 'a-button'); const ka = await page.evaluate(() => window.__gaVR.lastKey);
    chk(/KeyJ/.test(ka), 'A = attack (' + ka + ')');
    // nothing ready -> no power-up buttons
    await fr.evaluate('P.energy = 0; G.rgReady = false; G.odReady = false;'); await H.frames(page, 6);
    chk((await page.evaluate(() => window.__gaVR.pw.ready())).length === 0 && !(await page.evaluate(() => window.__gaVR.pw.world('thor'))), 'no power-up buttons before they are ready');
    // all three become ready
    await fr.evaluate('P.energy = 100; G.rgReady = true; G.odReady = true; G.odS = 0; P.rage = 0;'); await H.frames(page, 8);
    const rd = await page.evaluate(() => window.__gaVR.pw.ready()); chk(rd.join() === 'thor,rage,odin', 'THOR / BERSERK / ODIN ready (' + rd.join(', ') + ')');
    const pos = await page.evaluate(() => { const S = window.__gaVR, scr = S.screen, T = window.__arcade.THREE; return ['thor', 'rage', 'odin'].map(id => { const w = S.pw.world(id); return w ? scr.worldToLocal(new T.Vector3(...w)).x : null; }); });
    chk(pos.every(x => x != null && x > 0.5), 'their buttons sit on the right of the screen (x ' + pos.map(x => x == null ? 'none' : x.toFixed(2)).join(', ') + ')');
    await H.press(page, 'left', 'x-button'); await H.frames(page, 6);
    let e = await fr.evaluate('({ energy: P.energy, rage: P.rage, odS: G.odS })'); let f = await page.evaluate(() => window.__gaVR.pwFired);
    chk(f.thor === 1 && e.energy < 100, 'X fires THOR (energy 100 -> ' + Math.round(e.energy) + ')');
    await H.press(page, 'left', 'y-button'); await H.frames(page, 6); e = await fr.evaluate('({ energy: P.energy, rage: P.rage, odS: G.odS })'); f = await page.evaluate(() => window.__gaVR.pwFired);
    chk(f.rage === 1 && e.rage > 0, 'Y fires BERSERK (rage ' + (+e.rage).toFixed(2) + ')');
    await H.btn(page, 'right', 'squeeze', 1); await H.frames(page, 2); await H.btn(page, 'right', 'squeeze', 0); await H.frames(page, 6);
    e = await fr.evaluate('({ energy: P.energy, rage: P.rage, odS: G.odS, mode: 1 })'); f = await page.evaluate(() => window.__gaVR.pwFired);
    chk(f.odin === 1 && e.odS > 0 && (await st()).mode === 'game', 'a short right-grip tap fires ODIN and stays in the game (odS ' + (+e.odS).toFixed(2) + ')');
    // ray + trigger on a power-up button; the ray stops on it
    await fr.evaluate('P.energy = 100;'); await H.frames(page, 6); const tw = await page.evaluate(() => window.__gaVR.pw.world('thor'));
    await aim(tw); rc = await rayCut(tw); chk(rc.len != null && Math.abs(rc.len - rc.dist) < 0.06, 'ray stops at the THOR button: ray ' + (rc.len || 0).toFixed(2) + ' m, button ' + rc.dist.toFixed(2) + ' m');
    await H.press(page, 'right', 'trigger'); await H.frames(page, 4); f = await page.evaluate(() => window.__gaVR.pwFired);
    chk(f.thor === 2, 'point at THOR + trigger fires it too');
    await H.btn(page, 'left', 'squeeze', 1); await page.waitForFunction(() => window.__arcade.play.mode !== 'game', null, { timeout: 15000 }); await H.btn(page, 'left', 'squeeze', 0);
    chk(true, 'hold grip still leaves the game');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 500)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
