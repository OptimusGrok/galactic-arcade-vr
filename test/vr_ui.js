// t350u / t351u: smooth analog turn; buying tickets with the ray (ticket exchange); beaming to the shop from the teleporter sign
// and buying a prize there; Neon Bricks starts and plays in VR.
const { openVR, H } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR();
  const st = () => page.evaluate(() => window.__gaVR.state());
  const deg = r => r * 180 / Math.PI;
  const place = async (x, z, yaw = 0) => { await page.evaluate(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 6); };
  const aimPress = async (target, hand = 'right') => { await H.aim(page, hand, [0.2, 1.3, -0.2], target); await H.frames(page, 3); await H.press(page, hand, 'trigger'); };
  const btnAt = id => page.evaluate(id => window.__gaVR.ui.btnWorld(id), id);
  const sign = id => page.evaluate(id => { const s = window.__gaVR.signs().find(q => q.id === id); return s ? s.at : null; }, id);
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await place(2, 4, 0);

    // ---- 1) smooth turn: rate follows how far the right stick is pushed ----
    const rate = async (x, frames = 14) => { const a = await st(); await H.axes(page, 'right', x, 0); await H.frames(page, frames); const b = await st(); await H.axes(page, 'right', 0, 0); await H.frames(page, 3);
      const t = b.turnTime - a.turnTime; return { dps: t > 0 ? deg(b.turnSum - a.turnSum) / t : 0, dyaw: deg(b.rig.yaw - a.rig.yaw), live: deg(b.turnRate) }; };
    const want = x => 90 * Math.pow((Math.abs(x) - 0.15) / 0.85, 2);
    const r0 = await rate(0.12); chk(Math.abs(r0.dyaw) < 0.01 && r0.dps === 0, 'deadzone: stick at 0.12 does not turn (' + r0.dyaw.toFixed(3) + ' deg)');
    const r1 = await rate(0.4), r2 = await rate(0.75), r3 = await rate(1.0), rl = await rate(-0.4);
    chk(Math.abs(r1.dps - want(0.4)) < 0.5 && r1.dyaw < 0, 'small push 0.4 turns slowly right: ' + r1.dps.toFixed(1) + ' deg/s (want ' + want(0.4).toFixed(1) + ')');
    chk(Math.abs(r2.dps - want(0.75)) < 0.5, 'push 0.75: ' + r2.dps.toFixed(1) + ' deg/s (want ' + want(0.75).toFixed(1) + ')');
    chk(Math.abs(r3.dps - 90) < 0.5, 'full push: ' + r3.dps.toFixed(1) + ' deg/s (max 90)');
    chk(r1.dps < r2.dps && r2.dps < r3.dps && r3.dps / r1.dps > 8, 'turn speed grows with the push (x^2 curve): ' + [r1, r2, r3].map(r => r.dps.toFixed(1)).join(' < '));
    chk(rl.dyaw > 0 && Math.abs(rl.dps - want(0.4)) < 0.5, 'stick left turns left at the same rate (' + rl.dps.toFixed(1) + ')');
    const s1 = await st(); chk(s1.snaps === 0 && deg(s1.turnMaxStep) <= 4.5 + 1e-6, 'no snapping: biggest single-frame turn ' + deg(s1.turnMaxStep).toFixed(2) + ' deg, 0 snaps');
    await page.evaluate(() => window.__gaVR.turn(-window.__gaVR.rig.yaw)); await place(2, 4, 0);

    // ---- 2) buy tickets with the ray ----
    await page.evaluate(() => window.__kiosk.addCash(0));   // $5 cash
    const T0 = await page.evaluate(() => window.__arcade.play.tickets.total);
    await aimPress([0, 1.0, 0.24]);   // the kiosk's front panel
    chk((await st()).panel === 'tickets', 'point at the ticket kiosk + trigger opens TICKET EXCHANGE');
    const btns = await page.evaluate(() => window.__gaVR.ui.btns); chk(btns.filter(b => /^offer/.test(b.id)).length === 3 && btns.find(b => b.id === 'offer1').on, 'offers $1 / $5 / $10 shown, $5 affordable');
    await aimPress(await btnAt('offer1'));
    const k1 = await page.evaluate(() => ({ bal: window.__kiosk.C.bal, pending: window.__kiosk.pending, buys: window.__gaVR.ticketBuys }));
    chk(k1.buys === 1 && k1.pending === 60 && k1.bal === 0, 'pressing $5 = 60 TICKETS buys them (cash $' + k1.bal + ', ' + k1.pending + ' dispensing)');
    await page.waitForFunction(() => window.__kiosk.dispK >= 1, null, { timeout: 60000 }); await H.frames(page, 3);
    await aimPress(await btnAt('collect'));
    const T1 = await page.evaluate(() => ({ t: window.__arcade.play.tickets.total, ls: +localStorage.getItem('neonarcade.tickets'), pending: window.__kiosk.pending }));
    chk(T1.t === T0 + 60 && T1.pending === 0, 'COLLECT: ticket count went up ' + T0 + ' -> ' + T1.t);
    chk(T1.ls === T1.t, 'tickets saved (' + T1.ls + ')');
    await aimPress(await btnAt('close')); chk((await st()).panel === null, 'X closes the panel');

    // ---- 3) beam to the shop from the teleporter ----
    await page.evaluate(() => { window.__tpTimeScale = 3; window.__arcade.play.addTickets(400); });
    await H.press(page, 'left', 'y-button'); let m = await page.evaluate(() => window.__gaVR.ui.btns.map(b => b.id + ':' + b.label));
    chk(!m.some(x => /^(beam|tickets|close2):/.test(x)) && m.includes('pack:BACKPACK') && m.includes('room:FLOOR + WALLS'), 'v12 (t388u): the MENU has no BEAM / BUY TICKETS / CLOSE button, beaming is on the pad sign (' + m.join(', ') + ')');
    await aimPress(await btnAt('close'));
    const pad = await page.evaluate(() => [window.__gaVR.ui.tp().PAD1.x, window.__gaVR.ui.tp().PAD1.z]);
    await place(pad[0] + 2.2, pad[1] + 2.2, Math.PI / 4);
    const sg = await sign('beamShop'); chk(!!sg, 'BEAM TO SHOP sign over the teleporter pad ' + JSON.stringify(sg && sg.map(v => +v.toFixed(2))));
    await aimPress(sg);
    await page.waitForFunction(() => { const s = window.__gaVR.state(); return s.tpWhere === 2 && s.tpState === 'idle'; }, null, { timeout: 90000 });
    let s = await st(); const P2 = await page.evaluate(() => [window.__gaVR.ui.tp().PAD2.x, window.__gaVR.ui.tp().PAD2.z]);
    chk(s.beams === 1 && Math.hypot(s.head.x - P2[0], s.head.z - P2[1]) < 0.6 && Math.hypot(s.monkey[0] - P2[0], s.monkey[2] - P2[1]) < 0.6, 'beamed to the shop: you (head ' + s.head.x.toFixed(1) + ', ' + s.head.z.toFixed(1) + ') stand on the shop pad ' + P2.join(', '));
    // prize shop with the ray
    await page.waitForFunction(() => !!window.__gaVR.ui.shop(), null, { timeout: 30000 }); await H.frames(page, 4);
    const ss = await sign('shop'); chk(!!ss, 'PRIZE SHOP sign over the counter');
    if (0 && process.env.DBG) { await H.aim(page, 'right', [0.2, 1.3, -0.2], ss); await H.frames(page, 4); console.log('DBG', JSON.stringify(await page.evaluate(() => ({ head: window.__gaVR.head, sign: window.__gaVR.signs(), hover: window.__gaVR.hover, grok: window.__gaVR.ui.shop().grok.getWorldPosition(new window.__arcade.THREE.Vector3()).toArray() })))); }
    await aimPress(ss); chk((await st()).panel === 'shop', 'point at PRIZE SHOP + trigger opens the prize shop');
    const items = await page.evaluate(() => window.__gaVR.ui.btns.filter(b => /^item_/.test(b.id)));
    const it = items.find(b => b.on), B0 = await page.evaluate(() => window.__gaVR.ui.shop().balance());
    chk(!!it, 'prizes listed (' + items.length + ' on this page), some affordable with ' + B0 + ' tickets');
    await page.waitForFunction(() => {
      const sh = window.__shop, B = window.__gaVR.ui.btns.filter(b => /^item_/.test(b.id));
      return sh && B.length && B.every(b => b.art === 'shopRow' && b.pix && sh.iconAtlas && sh.iconAtlas.cells[b.pix]);
    }, null, { timeout: 30000 });
    const shopThumbs = await page.evaluate(() => {
      const sh = window.__shop, B = window.__gaVR.ui.btns.filter(b => /^item_/.test(b.id));
      return { n: B.length, art: B.every(b => b.art === 'shopRow'), pix: B.map(b => b.pix), cells: B.every(b => b.pix && sh.iconAtlas.cells[b.pix]), rev: sh.iconRev };
    });
    chk(shopThumbs.art && shopThumbs.cells && shopThumbs.n > 0, 'prize shop list shows a baked thumb next to name + ticket price (' + shopThumbs.pix.join(',') + '; rev ' + shopThumbs.rev + ')');
    if (it) { await aimPress(await btnAt(it.id)); const r = await page.evaluate(() => ({ b: window.__gaVR.ui.shop().balance(), buys: window.__gaVR.shopBuys }));
      chk(r.buys === 1 && r.b < B0, 'bought "' + it.label + '" with the ray (' + B0 + ' -> ' + r.b + ' tickets)'); }
    await aimPress(await btnAt('close'));
    // and back
    await place(P2[0] + 2, P2[1] + 2, Math.PI / 4); const sa = await sign('beamArcade'); chk(!!sa, 'BEAM TO ARCADE sign over the shop pad');
    await aimPress(sa); await page.waitForFunction(() => { const s = window.__gaVR.state(); return s.tpWhere === 1 && s.tpState === 'idle'; }, null, { timeout: 90000 });
    s = await st(); chk(Math.hypot(s.head.x - pad[0], s.head.z - pad[1]) < 0.6, 'beamed back to the arcade pad');

    // ---- 4) Neon Bricks in VR ----
    const nbs = await sign('nb'); chk(!!nbs, 'NEON BRICKS sign by the window ' + JSON.stringify(nbs && nbs.map(v => +v.toFixed(2))));
    await place(nbs[0] - 3, nbs[2] + 0.5, -Math.PI / 2);
    await aimPress([nbs[0] + 0.9, 2.5, nbs[2] - 0.6]);   // the window itself
    let nb = await page.evaluate(() => { const n = window.__gaVR.ui.nb(); return { playing: n.playing, moves: n.moves, rot: n.rotates, zoomK: n.zoomK, state: n.G.state }; });
    chk(nb.playing && nb.state === 'play', 'point at the Neon Bricks window + trigger starts the game');
    const mp0 = (await st()).monkey;
    const px = () => page.evaluate(() => { const c = window.__gaVR.ui.nb().G.cur; return c ? c.x : null; });
    const x0 = await px(); await H.axes(page, 'left', 1, 0); await H.frames(page, 3); const x1 = await px(); await H.axes(page, 'left', 0, 0); await H.frames(page, 3);
    const x2 = await px(); await H.axes(page, 'right', -1, 0); await H.frames(page, 3); const x3 = await px(); await H.axes(page, 'right', 0, 0); await H.frames(page, 3);
    await H.press(page, 'right', 'a-button'); await H.press(page, 'right', 'trigger');
    let nb2 = await page.evaluate(() => { const n = window.__gaVR.ui.nb(); return { moves: n.moves, rot: n.rotates, zoomK: n.zoomK, zoom: n.zoomAmt }; });
    const s2 = await st();
    chk(x1 > x0 && x3 < x2, 'left stick right / right stick left move the falling brick (x ' + x0 + ' -> ' + x1 + ', ' + x2 + ' -> ' + x3 + ')');
    chk(nb2.rot >= nb.rot + 2, 'A and trigger rotate (' + nb.rot + ' -> ' + nb2.rot + ')');
    chk(Math.hypot(s2.monkey[0] - mp0[0], s2.monkey[2] - mp0[2]) < 0.05 && Math.abs(s2.rig.yaw - (-Math.PI / 2)) < 0.01, 'while playing, the sticks do not walk or turn you');
    chk(nb2.zoomK === 0 && !nb2.zoom, 'no zoom in VR');
    const d0 = await page.evaluate(() => window.__gaVR.nbDrops); await H.press(page, 'left', 'y-button');
    chk(await page.evaluate(d0 => window.__gaVR.nbDrops === d0 + 1, d0), 'B/Y hard-drops');
    await H.btn(page, 'left', 'squeeze', 1); await page.waitForFunction(() => !window.__gaVR.ui.nb().playing, null, { timeout: 15000 }); await H.btn(page, 'left', 'squeeze', 0); await H.frames(page, 3);
    chk(!(await st()).nb, 'hold grip leaves Neon Bricks');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 400)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
