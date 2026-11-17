// v23 (Dave t421u): STRIKE in Galactic Arcade VR. (1) the A HYPER SPEED and B BOMB buttons sit side by side at the bottom right;
// (2) HYPER SPEED really slows the enemy ships (37.5 %): flat Quest browser A (was FIRE: the slow-mo never started) and headset A.
const { open } = require('./lib');
const { openVR, H } = require('./vrlib');
let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : '')); if (!c) ok = false; };
const QUEST_UA = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/37.0 Chrome/132.0 Mobile VR Safari/537.36';
// fake Quest 2D-browser gamepads: window.__fakeA = true presses A (xr-standard button 4) on the right controller
const PADS = () => { localStorage.setItem('neonarcade.tickets', '40'); const mk = () => ({ id: 'Oculus Touch (Right)', index: 0, connected: true, mapping: 'xr-standard', hand: 'right', axes: [0, 0, 0, 0],
  buttons: [0, 1, 2, 3, 4, 5, 6].map(i => ({ pressed: !!(i === 4 && window.__fakeA), value: i === 4 && window.__fakeA ? 1 : 0, touched: false })) });
  Object.defineProperty(navigator, 'getGamepads', { value: () => [mk()], configurable: true }); };
// enemy clock: how many of an enemy's own ticks (e.t) pass per game step, over the enemies alive the whole window
const ENEMY_RATE = `(async () => { const S = window.STRIKE, G = S.G; const a = S.pools.enemies.items.filter(e => e.alive).map(e => [e, e.t]), g0 = G.t; await new Promise(r => setTimeout(r, 900));
  let d = 0, c = 0; for (const [e, t] of a) if (e.alive) { d += e.t - t; c++; } return { n: c, rate: c ? +(d / c / Math.max(1, G.t - g0)).toFixed(3) : null, slowT: G.slowT }; })()`;
async function rate(fr) { for (let i = 0; i < 6; i++) { const r = await fr.evaluate(ENEMY_RATE); if (r.n) return r; } return { n: 0 }; }
async function flat() {
  const { page, errors, close } = await open({ w: 640, h: 400, ua: QUEST_UA, init: PADS });
  try {
    await page.evaluate(() => { document.body.classList.add('upright'); const t = document.getElementById('turnHint'); if (t) t.classList.remove('on'); const p = window.__arcade.play; p.start(p.machines.strike); });
    await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 40000 });
    await page.waitForTimeout(1500); await page.evaluate(() => { const p = window.__arcade.play; p.insertTicket(); p.tryPlay(); });
    await page.waitForFunction(() => window.__arcade.play.sub === 'play', null, { timeout: 15000 });
    const fr = page.frames().find(f => /strike-play/.test(f.url()));
    await fr.waitForFunction(() => window.STRIKE.G.scene === 'play' && !window.STRIKE.pl.entering, null, { timeout: 30000 }); await fr.evaluate(() => { window.STRIKE.G.god = true; });
    const pos = await fr.evaluate(() => ({ s: window.__strikeBtnXY('slow'), b: window.__strikeBtnXY('bomb'), W: innerWidth, H: innerHeight }));
    chk(Math.abs(pos.s[1] - pos.b[1]) < 1 && pos.s[0] < pos.b[0] && pos.b[0] - pos.s[0] < 60 && pos.b[1] < pos.H * 0.3 && pos.b[0] > pos.W * 0.6, 'A HYPER SPEED + B BOMB side by side (A left of B), top right since v24', pos);
    if (process.env.SHOT) { await page.waitForTimeout(1500); await page.screenshot({ path: process.env.SHOT }); }
    await page.waitForTimeout(4000); const n = await rate(fr);
    const shots0 = await fr.evaluate(() => window.STRIKE.pools.pshots.items.filter(s => s.alive).length);
    await fr.evaluate(() => { window.STRIKE.G.slowCD = 0; }); await page.evaluate(() => { window.__fakeA = true; }); await page.waitForTimeout(400); await page.evaluate(() => { window.__fakeA = false; });
    const s = await rate(fr);
    chk(s.slowT > 0, 'flat Quest: A starts HYPER SPEED in Strike (it did nothing before)', s);
    chk(n.rate > 0.9 && s.rate < 0.5, 'enemy ships slow down to ~37 % during HYPER SPEED (' + n.rate + ' -> ' + s.rate + ' ticks per step)', { n, s });
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
    await H.press(page, 'right', 'a-button'); await H.press(page, 'right', 'a-button'); await page.waitForFunction(() => window.__arcade.play.sub === 'play', null, { timeout: 15000 });
    const fr = page.frames().find(f => /strike-play/.test(f.url()));
    await fr.waitForFunction(() => window.STRIKE.G.scene === 'play' && !window.STRIKE.pl.entering, null, { timeout: 30000 }); await fr.evaluate(() => { window.STRIKE.G.god = true; });
    await H.frames(page, 200); const n = await rate(fr);
    await fr.evaluate(() => { window.STRIKE.G.slowCD = 0; }); await H.press(page, 'right', 'a-button'); await H.frames(page, 2); const s = await rate(fr);
    chk(s.slowT > 0 && n.rate > 0.9 && s.rate < 0.5, 'headset: A = HYPER SPEED slows the enemy ships (' + n.rate + ' -> ' + s.rate + ')', { n, s });
  } catch (e) { chk(false, 'vr threw: ' + e.message); }
  chk(!errors.filter(e => !/supabase|ERR_FAILED|Failed to load/i.test(e)).length, 'VR: no page errors', errors.slice(0, 3)); await close();
}
(async () => { await flat(); await vr(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1); })();
