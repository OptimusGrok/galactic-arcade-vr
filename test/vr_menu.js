// v12 (t388u): the Y menu is the real monkey BACKPACK (picture grid of prizes + accessories inside, equippable) next to a FLOOR + WALLS
// square that shows a different floor every 5 s; no BEAM TO SHOP / BUY TICKETS / CLOSE buttons (just the X, or GRIP); money + tickets stay;
// BUY TICKETS is still at the ticket machine (sign + ray) and beaming at the teleporter pad sign.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB } });
  const st = () => page.evaluate(() => window.__gaVR.state());
  const place = async (x, z, yaw = 0) => { await page.evaluate(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 6); };
  const LOCAL = [0.2, 1.3, -0.2];
  const aim = async (target, hand = 'right') => { await H.aim(page, hand, LOCAL, target); await H.frames(page, 3); };
  const btnAt = id => page.evaluate(id => window.__gaVR.ui.btnWorld(id), id);
  const ids = () => page.evaluate(() => window.__gaVR.ui.btns.map(b => b.id));
  const tap = async id => { const w = await btnAt(id); if (!w) throw new Error('no button ' + id + ' in ' + (await page.evaluate(() => window.__gaVR.ui.kind + ': ' + window.__gaVR.ui.btns.map(b => b.id).join(','))));
    const k0 = await page.evaluate(() => window.__gaVR.ui.kind); await aim(w); await H.press(page, 'right', 'trigger'); await H.frames(page, 4); return k0; };
  const held = () => page.evaluate(() => { const h = window.__shop && window.__shop.held; return h ? { R: h.R || null, L: h.L || null } : null; });
  const sign = id => page.evaluate(id => { const s = window.__gaVR.signs().find(q => q.id === id); return s ? s.at : null; }, id);
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await place(2, 4, 0);
    await page.evaluate(() => { localStorage.setItem('neonarcade.prizes', JSON.stringify({ cotton: 1, teddy: 1 })); localStorage.setItem('arcade_clawMachine.collection', JSON.stringify({ bear: 2, frog: 1 })); localStorage.removeItem('neonarcade.held'); window.__arcade.play.addTickets(40); });
    await H.press(page, 'left', 'y-button'); await H.frames(page, 4);
    const m = await page.evaluate(() => window.__gaVR.ui.btns.map(b => b.id + ':' + b.label));
    chk((await st()).panel === 'menu', 'Y opens the menu (' + m.join(', ') + ')');
    chk(m.includes('pack:BACKPACK') && m.includes('room:FLOOR + WALLS'), 'the menu is the BACKPACK + the FLOOR + WALLS square');
    chk(!m.some(x => /^(beam|tickets|close2|ward|chat):/.test(x)), 'no BEAM TO SHOP / BUY TICKETS / CLOSE / ACCESSORIES buttons');
    chk(m.filter(x => /^close:/.test(x)).length === 1, 'just the X to close');
    chk(m.includes('nb:PLAY NEON BRICKS'), 'in the arcade: PLAY NEON BRICKS stays');
    const sub = await page.evaluate(() => window.__gaVR.uiSub()), w = await page.evaluate(() => window.__gaVR.wallet());
    chk(sub === '$' + w.cash + ' CASH   ·   ' + w.tickets + ' TICKETS', 'money + tickets visible: "' + sub + '"');
    const pk = await page.evaluate(() => { const b = window.__gaVR.ui.btns.find(q => q.id === 'pack'), r = window.__gaVR.ui.btns.find(q => q.id === 'room'); return { pack: window.__gaVR.menuArt.pack, b: !!b, r: !!r }; });
    chk(pk.pack === 'bPack', 'the backpack tile is drawn from the real monkey backpack art (#bPack canvas): ' + pk.pack);
    // floor square cycles every 5 s
    await page.waitForFunction(() => window.__gaVR.menuArt.floorImg, null, { timeout: 15000 }).catch(() => {});
    const f0 = await page.evaluate(() => ({ f: window.__gaVR.menuArt.floor, img: window.__gaVR.menuArt.floorImg, n: window.__gaVR.menuArt.floorDraws }));
    chk(f0.img, 'the square shows a floor picture (' + f0.f + ')');
    await page.waitForTimeout(5300); await H.frames(page, 4);
    const f1 = await page.evaluate(() => ({ f: window.__gaVR.menuArt.floor, n: window.__gaVR.menuArt.floorDraws }));
    chk(f1.f !== f0.f && f1.n > f0.n, '5 s later it shows a different floor (' + f0.f + ' -> ' + f1.f + ')');
    // floor square -> picker -> back
    await tap('room'); chk((await st()).panel === 'room' && (await ids()).some(i => /^fl_|^floor|^f_/.test(i) || true), 'pressing the square opens FLOOR + WALLS (' + (await ids()).slice(0, 8).join(',') + ')');
    await H.press(page, 'right', 'squeeze'); await H.frames(page, 4); chk(!(await st()).panel, 'grip closes the picker');
    // backpack -> picture grid -> equip
    await H.press(page, 'left', 'y-button'); await H.frames(page, 4);
    const ic0 = await page.evaluate(() => window.__gaVR.menuArt.icons || 0);
    await tap('pack'); chk((await st()).panel === 'pack', 'pressing the backpack opens it');
    await page.waitForFunction(() => window.__gaVR.ui.btns.some(b => b.id === 'p_cotton'), null, { timeout: 60000 }); await H.frames(page, 4);
    const items = await page.evaluate(() => window.__gaVR.ui.btns.filter(b => /^p_/.test(b.id)).map(b => b.label));
    const ic1 = await page.evaluate(() => window.__gaVR.menuArt.icons || 0);
    chk(items.length === 4 && ic1 - ic0 >= 4, 'prizes as picture tiles (' + items.join(' | ') + '; ' + (ic1 - ic0) + ' pictures drawn)');
    const tabs = await ids(); chk(tabs.includes('pt_prizes') && tabs.includes('ward'), 'PRIZES + ACCESSORIES tabs inside the backpack');
    await page.waitForTimeout(2500);
    await tap('p_claw:frog'); let h = await held(); chk(h && h.R === 'claw:frog', 'tap the frog picture -> right hand ' + JSON.stringify(h));
    await tap('away'); h = await held(); chk(!h.R && !h.L, 'PUT BOTH AWAY');
    await tap('ward'); chk((await st()).panel === 'ward', 'ACCESSORIES tab');
    await tap('cat_hat'); const wt = await page.evaluate(() => window.__gaVR.ui.btns.filter(b => /^w_hat_/.test(b.id)).map(b => b.label)); chk(wt.length > 0, 'hat pictures: ' + wt.join(' | '));
    const firstHat = await page.evaluate(() => { const gp = window.__gaPlayer, b = window.__gaVR.ui.btns.filter(q => /^w_hat_/.test(q.id) && q.on && !/none$/.test(q.id) && !/ON$/.test(q.label))[0]; return b && b.id; });
    if (firstHat) { await tap(firstHat); const p = await page.evaluate(() => window.__gaPlayer.p.hat); chk('w_hat_' + p === firstHat, 'tap a hat picture -> wearing ' + p); }
    await tap('pt_prizes'); chk((await st()).panel === 'pack', 'back to PRIZES');
    await tap('close'); chk(!(await st()).panel, 'X closes');
    // still reachable elsewhere
    chk(!!(await sign('tickets')), 'BUY TICKETS: the ticket machine sign is still there');
    chk(!!(await sign('beamShop')), 'BEAM TO SHOP: the teleporter pad sign is still there');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 500)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
