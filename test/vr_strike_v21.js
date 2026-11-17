// v21 (Dave): STRIKE in Galactic Arcade VR: A = HYPER SPEED, B = BOMB, trigger = FIRE, and the bottom-right HYPER SPEED (A) / BOMB (B)
// buttons are drawn in every play mode (solo + co-op) and can be pointed at + triggered in the headset, clicked / tapped on a flat screen,
// and the flat Quest browser's B (its history-back, trapped by quest-pad.js) drops a bomb.
const { open } = require('./lib');
const { openVR, H } = require('./vrlib');
let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : '')); if (!c) ok = false; };
const fresh = `(() => { const G = window.STRIKE.G; G.slowT = 0; G.slowCD = 0; G.bombs = 3; G.god = true; })()`;
async function flat() {
  const { page, errors, close } = await open({ w: 640, h: 400, init: () => { window.__gaForceQuest = 1; localStorage.setItem('neonarcade.tickets', '40'); } });
  try {
    await page.evaluate(() => { const A = window.__arcade, c = A.playables.find(k => /strike/i.test(k.name)), u = c.userData; window.__noAdapt = 1; A.st.fp = false; A.st.vel.set(0, 0, 0); A.monkey.position.set(u.front.x, 0, u.front.z); A.st.face = Math.atan2(u.facing.x, u.facing.z); });
    await page.waitForTimeout(500); await page.evaluate(() => { document.body.classList.add('upright'); const t = document.getElementById('turnHint'); if (t) t.classList.remove('on'); window.__arcade.play.press(); });
    await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 40000 });
    await page.waitForTimeout(1500); await page.evaluate(() => { const p = window.__arcade.play; p.insertTicket(); p.tryPlay(); });
    await page.waitForFunction(() => window.__arcade.play.sub === 'play', null, { timeout: 15000 });
    const fr = page.frames().find(f => /strike-play/.test(f.url()));
    await fr.waitForFunction(() => window.STRIKE.G.scene === 'play' && !window.STRIKE.pl.entering, null, { timeout: 30000 }); await fr.evaluate(fresh);
    const d0 = await fr.evaluate(() => ({ ...window.__strikeBtnDraws })); await page.waitForTimeout(500); const d1 = await fr.evaluate(() => ({ ...window.__strikeBtnDraws }));
    chk(d1.bomb > d0.bomb && d1.slow > d0.slow, 'flat solo: HYPER SPEED + BOMB buttons drawn every frame (not only on touch screens)', d1);
    const fb = await page.$('#game'), box = await fb.boundingBox();
    const click = async id => { const [x, y] = await fr.evaluate(id => window.__strikeBtnXY(id), id); await page.mouse.click(box.x + x, box.y + y); await page.waitForTimeout(150); };
    await click('slow'); let g = await fr.evaluate(() => ({ slowT: window.STRIKE.G.slowT, bombs: window.STRIKE.G.bombs }));
    chk(g.slowT > 0, 'flat: clicking HYPER SPEED (mouse / Quest laser) starts hyper speed', g);
    await click('bomb'); g = await fr.evaluate(() => ({ bombs: window.STRIKE.G.bombs })); chk(g.bombs === 2, 'flat: clicking BOMB drops a bomb (3 -> ' + g.bombs + ')');
    await page.evaluate(() => window.__gaQuestBFire()); await page.waitForTimeout(400); g = await fr.evaluate(() => ({ bombs: window.STRIKE.G.bombs }));
    chk(g.bombs === 1 && (await page.evaluate(() => window.__gaQuestBomb)) >= 1, 'flat Quest: B (browser back, trapped) = BOMB in Strike (2 -> ' + g.bombs + ')');
    await fr.evaluate(() => { window.STRIKE.G.slowCD = 0; window.STRIKE.G.slowT = 0; }); await fr.evaluate(() => { const e = o => window.dispatchEvent(new KeyboardEvent(o, { code: 'KeyC', bubbles: true })); e('keydown'); }); await page.waitForTimeout(150); await fr.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC', bubbles: true })));
    chk((await fr.evaluate(() => window.STRIKE.G.slowT)) > 0, 'flat keyboard: C = hyper speed (unchanged)');
    // co-op HUD (P2 joined): the buttons are drawn there too (v248 pattern)
    await fr.evaluate(() => { window.__strikeCoop.p2on = true; }); const c0 = await fr.evaluate(() => ({ ...window.__strikeBtnDraws })); await page.waitForTimeout(500); const c1 = await fr.evaluate(() => ({ ...window.__strikeBtnDraws }));
    chk(c1.bomb > c0.bomb && c1.slow > c0.slow, 'co-op HUD: HYPER SPEED + BOMB buttons drawn', c1);
    await fr.evaluate(() => { window.STRIKE.G.bombs = 2; }); await click('bomb'); chk((await fr.evaluate(() => window.STRIKE.G.bombs)) === 1, 'co-op: BOMB button works');
    const png = await fb.screenshot(); require('fs').writeFileSync('/workspace/.stt-fixtures/strike_coop_btns.png', png);
    await fr.evaluate(() => { window.__strikeCoop.p2on = false; });
  } catch (e) { chk(false, 'flat threw: ' + e.message); }
  const errs = errors.filter(e => !/supabase|Failed to load resource|net::ERR/i.test(e)); chk(!errs.length, 'flat: no page errors', errs); await close();
}
async function vr() {
  const { page, errors, close } = await openVR({ init: { content: require('./vrlib').IWER_SRC + require('./vrlib').SETUP + ';localStorage.setItem("neonarcade.tickets","40");' } });
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 30000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    const spot = await page.evaluate(() => { const A = window.__arcade, m = A.play.machines.strike, u = m.cab.userData, f = u.front, n = u.inward || { x: 0, z: 1 }, b = new A.THREE.Box3().setFromObject(m.cab), c = b.getCenter(new A.THREE.Vector3()); return { p: { x: f.x + n.x * 1.4, z: f.z + n.z * 1.4 }, yaw: Math.atan2(n.x, n.z), c: [c.x, c.y, c.z] }; });
    await page.evaluate(sp => { const S = window.__gaVR; S.rig = { x: sp.p.x, y: 0, z: sp.p.z, yaw: sp.yaw }; S.applyRig(); window.__arcade.monkey.position.set(sp.p.x, 0, sp.p.z); }, spot); await H.frames(page, 6);
    await H.aim(page, 'right', [0.2, 1.2, -0.2], spot.c); await H.frames(page, 4); await H.press(page, 'right', 'trigger');
    await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 60000 });
    await H.press(page, 'right', 'a-button'); await H.press(page, 'right', 'a-button');
    await page.waitForFunction(() => window.__arcade.play.sub === 'play', null, { timeout: 15000 });
    const fr = page.frames().find(f => /strike-play/.test(f.url()));
    await fr.waitForFunction(() => window.STRIKE.G.scene === 'play' && !window.STRIKE.pl.entering, null, { timeout: 30000 }); await fr.evaluate(fresh); await H.frames(page, 10);
    const help = await page.evaluate(() => window.__gaVR.maps.strike.help); chk(/A HYPER SPEED/.test(help) && /B BOMB/.test(help), 'headset help: ' + help);
    await H.press(page, 'right', 'a-button', 4); let g = await fr.evaluate(() => ({ slowT: window.STRIKE.G.slowT, fire: !!window.STRIKE.Input.keys.fire }));
    chk(g.slowT > 0, 'VR: A = HYPER SPEED', g);
    await H.press(page, 'right', 'b-button', 4); g = await fr.evaluate(() => ({ bombs: window.STRIKE.G.bombs })); chk(g.bombs === 2, 'VR: B = BOMB (3 -> ' + g.bombs + ')');
    await H.aim(page, 'right', [0.2, 1.2, -0.2], spot.c); await H.frames(page, 4);
    await H.btn(page, 'right', 'trigger', 1); await H.frames(page, 5); g = await fr.evaluate(() => ({ fire: !!window.STRIKE.Input.keys.fire })); await H.btn(page, 'right', 'trigger', 0); await H.frames(page, 3);
    chk(g.fire, 'VR: trigger (pointing at the game) = FIRE');
    const d0 = await fr.evaluate(() => ({ ...window.__strikeBtnDraws })); await H.frames(page, 10); const d1 = await fr.evaluate(() => ({ ...window.__strikeBtnDraws }));
    chk(d1.bomb > d0.bomb && d1.slow > d0.slow, 'VR: the buttons are drawn on the in-world screen', d1);
    // point at the in-game buttons + trigger
    const at = async id => { const xy = await fr.evaluate(id => window.__strikeBtnXY(id), id); return page.evaluate(([x, y]) => window.__gaVR.gameScreenWorld(x, y), xy); };
    await fr.evaluate(() => { window.STRIKE.G.slowT = 0; window.STRIKE.G.slowCD = 0; window.STRIKE.G.bombs = 3; });
    let w = await at('slow'); await H.aim(page, 'right', [0.2, 1.2, -0.2], w); await H.frames(page, 4);
    await H.btn(page, 'right', 'trigger', 1); await H.frames(page, 5); g = await fr.evaluate(() => ({ slowT: window.STRIKE.G.slowT, fire: !!window.STRIKE.Input.keys.fire })); await H.btn(page, 'right', 'trigger', 0); await H.frames(page, 3);
    chk(g.slowT > 0 && !g.fire, 'VR: point at HYPER SPEED + trigger = hyper speed (no shot)', g);
    w = await at('bomb'); await H.aim(page, 'right', [0.2, 1.2, -0.2], w); await H.frames(page, 4); await H.press(page, 'right', 'trigger');
    g = await fr.evaluate(() => ({ bombs: window.STRIKE.G.bombs })); chk(g.bombs === 2, 'VR: point at BOMB + trigger = bomb (3 -> ' + g.bombs + ')', await page.evaluate(() => window.__gaVR.btnTaps));
    await H.btn(page, 'left', 'squeeze', 1); await page.waitForFunction(() => window.__arcade.play.mode !== 'game', null, { timeout: 15000 }); await H.btn(page, 'left', 'squeeze', 0);
    await page.waitForFunction(() => window.__arcade.play.mode === 'walk', null, { timeout: 15000 });
    chk(!(await page.evaluate(() => window.__gaVR.state().held.length)), 'hold grip leaves; no keys stuck');
  } catch (e) { chk(false, 'VR threw: ' + e.message); }
  const errs = errors.filter(e => !/supabase|Failed to load resource|net::ERR/i.test(e)); chk(!errs.length, 'VR: no page errors', errs); await close();
}
(async () => { await flat(); await vr(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1); })();
