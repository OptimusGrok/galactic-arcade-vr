// v24 (Dave t435u / t437u): STRIKE in Galactic Arcade VR.
// (1) A HYPER SPEED + B BOMB buttons side by side at the TOP RIGHT, bomb icons at the TOP LEFT, both just under the black HUD bar, see-through (solo + co-op).
// (2) The A bug: the A press that started the game stayed held into play, fired HYPER SPEED during the stage intro and left a 60 s recharge,
//     so Dave's A presses did nothing. Real flow here (no slowCD resets): start with A held, then A during play must slow the enemy ships.
const { open } = require('./lib');
const { openVR, H } = require('./vrlib');
let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : '')); if (!c) ok = false; };
const QUEST_UA = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/37.0 Chrome/132.0 Mobile VR Safari/537.36';
// fake gamepads: window.__fakeA = true presses A; window.__padLeg = true uses the old non xr-standard layout (A = button 3)
const PADS = () => { localStorage.setItem('neonarcade.tickets', '40'); const mk = () => { const leg = !!window.__padLeg, ai = leg ? 3 : 4; return { id: 'Oculus Touch (Right)', index: 0, connected: true, mapping: leg ? '' : 'xr-standard', hand: 'right', axes: [0, 0, 0, 0],
  buttons: (leg ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6]).map(i => ({ pressed: !!(i === ai && window.__fakeA), value: i === ai && window.__fakeA ? 1 : 0, touched: false })) }; };
  Object.defineProperty(navigator, 'getGamepads', { value: () => [mk()], configurable: true }); };
// enemy clock + speed: own ticks (e.t) per game step and on-screen px per step, over the enemies alive the whole window
const ENEMY = `(async () => { const S = window.STRIKE, G = S.G; const a = S.pools.enemies.items.filter(e => e.alive && !e.ground).map(e => [e, e.t, e.x, e.y]), g0 = G.t; await new Promise(r => setTimeout(r, 900));
  let d = 0, m = 0, c = 0; for (const [e, t, x, y] of a) if (e.alive) { d += e.t - t; m += Math.hypot(e.x - x, e.y - y); c++; } const st = Math.max(1, G.t - g0);
  return { n: c, rate: c ? +(d / c / st).toFixed(3) : null, px: c ? +(m / c / st).toFixed(3) : null, slowT: G.slowT, slowCD: G.slowCD }; })()`;
async function measure(fr) { for (let i = 0; i < 8; i++) { const r = await fr.evaluate(ENEMY); if (r.n) return r; } return { n: 0 }; }
const slowed = (n, s) => s.slowT > 0 && n.rate > 0.9 && s.rate < 0.5 && s.px < n.px * 0.8;   // px are from whichever ships are on screen, so only a loose check; the enemy clock (rate) is the exact one
async function layout(fr, tag) {
  const L = await fr.evaluate(() => ({ s: window.__strikeBtnXY('slow'), b: window.__strikeBtnXY('bomb'), W: innerWidth, H: innerHeight, icons: window.__strikeBombIcons, sb: window.__strikeBtnAt(...window.__strikeBtnXY('slow')), bb: window.__strikeBtnAt(...window.__strikeBtnXY('bomb')) }));
  chk(Math.abs(L.s[1] - L.b[1]) < 1 && L.s[0] < L.b[0] && L.b[0] > L.W * 0.6 && L.b[1] < L.H * 0.3, tag + ': A HYPER SPEED + B BOMB side by side at the top right (A left of B)', L);
  chk(L.icons && L.icons.n > 0 && L.icons.x < 20 && L.icons.y > 33 && L.icons.y < 60, tag + ': bomb icons at the top left under the black bar', L.icons);
  chk(L.sb === 'slow' && L.bb === 'bomb', tag + ': the moved buttons are still tappable / pointable', { sb: L.sb, bb: L.bb });
}
async function flat() {
  const { page, errors, close } = await open({ w: 480, h: 360, ua: QUEST_UA, init: PADS });
  try {
    await page.evaluate(() => { document.body.classList.add('upright'); const t = document.getElementById('turnHint'); if (t) t.classList.remove('on'); const p = window.__arcade.play; p.start(p.machines.strike); });
    await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 40000 });
    await page.waitForTimeout(1500); await page.evaluate(() => { const p = window.__arcade.play; p.insertTicket(); p.tryPlay(); });
    await page.waitForFunction(() => window.__arcade.play.sub === 'play', null, { timeout: 15000 });
    const fr = page.frames().find(f => /strike-play/.test(f.url()));
    await fr.waitForFunction(() => window.STRIKE.G.scene === 'play' && !window.STRIKE.pl.entering, null, { timeout: 30000 }); await fr.evaluate(() => { window.STRIKE.G.god = true; });
    await page.waitForTimeout(600); await layout(fr, 'flat solo');
    const alpha = await fr.evaluate(() => typeof BTN_A === 'number' ? BTN_A : null); chk(alpha >= 0.3 && alpha <= 0.5, 'buttons drawn see-through (fill alpha x' + alpha + ')');
    await fr.evaluate(() => { window.__strikeCoop.p2on = true; }); await page.waitForTimeout(400); await layout(fr, 'flat co-op');
    await fr.evaluate(() => { window.__strikeCoop.p2on = false; }); await page.waitForTimeout(3500);
    const n = await measure(fr);
    await page.evaluate(() => { window.__fakeA = true; }); await page.waitForTimeout(300); const s = await measure(fr); await page.evaluate(() => { window.__fakeA = false; });
    chk(slowed(n, s), 'flat gamepad (xr-standard A = 4) HELD: enemy ships slow (ticks ' + n.rate + ' -> ' + s.rate + ', px/step ' + n.px + ' -> ' + s.px + ')', { n, s });
    await fr.evaluate(() => { const G = window.STRIKE.G; G.slowT = 0; G.slowCD = 0; }); await page.waitForTimeout(300);
    await page.evaluate(() => { window.__padLeg = true; window.__fakeA = true; }); await page.waitForTimeout(300); const s2 = await measure(fr); await page.evaluate(() => { window.__fakeA = false; });
    chk(slowed(n, s2), 'flat gamepad (old layout A = 3) HELD: enemy ships slow (' + s2.rate + ')', s2);
  } catch (e) { chk(false, 'flat threw: ' + e.message); }
  chk(!errors.filter(e => !/supabase|ERR_FAILED|Failed to load/i.test(e)).length, 'flat: no page errors', errors.slice(0, 3)); await close();
}
async function vr() {
  const { page, errors, close } = await openVR({ init: { content: require('./vrlib').IWER_SRC + require('./vrlib').SETUP + ';localStorage.setItem("neonarcade.tickets","40");' } });
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 30000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    const spot = await page.evaluate(() => { const A = window.__arcade, m = A.play.machines.strike, u = m.cab.userData, f = u.front, n = u.inward || { x: 0, z: 1 }, c = new A.THREE.Box3().setFromObject(m.cab).getCenter(new A.THREE.Vector3()); return { p: { x: f.x + n.x * 1.4, z: f.z + n.z * 1.4 }, yaw: Math.atan2(n.x, n.z), c: [c.x, c.y, c.z] }; });
    await page.evaluate(sp => { const S = window.__gaVR; S.rig = { x: sp.p.x, y: 0, z: sp.p.z, yaw: sp.yaw }; S.applyRig(); window.__arcade.monkey.position.set(sp.p.x, 0, sp.p.z); }, spot); await H.frames(page, 6);
    await H.aim(page, 'right', [0.2, 1.2, -0.2], spot.c); await H.frames(page, 4); await H.press(page, 'right', 'trigger');
    await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    // like a person: A inserts the ticket, A again starts and is still held as the game begins
    await H.press(page, 'right', 'a-button'); await H.frames(page, 10); await H.btn(page, 'right', 'a-button', 1);
    for (let i = 0; i < 40; i++) { await H.frames(page, 3); if (await page.evaluate(() => window.__arcade.play.sub) === 'play') break; }
    await H.frames(page, 30); await H.btn(page, 'right', 'a-button', 0); await H.frames(page, 5);
    const fr = page.frames().find(f => /strike-play/.test(f.url()));
    await fr.waitForFunction(() => window.STRIKE.G.scene === 'play' && !window.STRIKE.pl.entering, null, { timeout: 30000 }); await fr.evaluate(() => { window.STRIKE.G.god = true; });
    const g0 = await fr.evaluate(() => ({ slowT: window.STRIKE.G.slowT, slowCD: window.STRIKE.G.slowCD }));
    chk(g0.slowT === 0 && g0.slowCD === 0, 'headset: the A press that starts the game does NOT burn HYPER SPEED (the bug: it fired at the start, then 60 s recharge)', g0);
    await layout(fr, 'headset');
    await H.frames(page, 200); const n = await measure(fr);
    await H.btn(page, 'right', 'a-button', 1); await H.frames(page, 3); const s = await measure(fr); await H.btn(page, 'right', 'a-button', 0); await H.frames(page, 3);
    chk(slowed(n, s), 'headset: A HELD (no cooldown reset) slows the enemy ships (ticks ' + n.rate + ' -> ' + s.rate + ', px/step ' + n.px + ' -> ' + s.px + ')', { n, s });
    // left hand X does it too
    await fr.evaluate(() => { const G = window.STRIKE.G; G.slowT = 0; G.slowCD = 0; }); await H.frames(page, 30);
    await H.press(page, 'left', 'x-button'); await H.frames(page, 3); const x = await fr.evaluate(() => window.STRIKE.G.slowT);
    chk(x > 0, 'headset: X (left) = HYPER SPEED too', x);
  } catch (e) { chk(false, 'vr threw: ' + e.message); }
  chk(!errors.filter(e => !/supabase|ERR_FAILED|Failed to load/i.test(e)).length, 'VR: no page errors', errors.slice(0, 3)); await close();
}
(async () => { await flat(); await vr(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1); })();
