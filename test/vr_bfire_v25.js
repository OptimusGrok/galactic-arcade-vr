// v25 (Dave t442u): in the arcade room, headset: Y = menu (open / close), B = laser pistol FIRE only while it is equipped, B with no gun = nothing.
// The bug: roomfire.js only fires while its FIRE button is "shown", which needs #bZoom 'on'; main.js stopped syncing #bZoom in XR, so after
// PLAY -> straight into VR (v18) it never came on and B never fired. Runs the real PLAY -> VR start. Flat Quest: B (trapped history back) the same.
const { open } = require('./lib');
const { IWER_SRC, SETUP, H } = require('./vrlib');
const QUA = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.0.0.0 SamsungBrowser/4.0 Chrome/128.0.0.0 VR Safari/537.36';
const supa = r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : '')); if (!c) ok = false; };
const equip = page => page.evaluate(() => { window.__arcade.play.addTickets(60); const gp = window.__gaPlayer; gp.tryOn('hand', 'pistol'); gp.buy(); gp.pick('hand', 'pistol'); });
const unequip = page => page.evaluate(() => window.__gaPlayer.pick('hand', 'none'));
async function startQuest(o, label) { const page = o.page;
  await page.evaluate(() => { localStorage.removeItem('galacticarcade.player'); window.__noPrewarm = 1; }); await page.reload();
  await page.waitForFunction(() => window.__arcade && window.__arcade.stats.frames > 3, null, { timeout: 90000 }); await page.waitForTimeout(1500);
  await page.waitForSelector('#gaIn'); await page.click('#gaIn'); await page.keyboard.type('Astro' + label);
  await page.waitForSelector('#gaGo:not([hidden])', { timeout: 20000 }); await page.waitForTimeout(500); }
async function headset() {
  const o = await open({ start: true, supa, w: 640, h: 400, ua: QUA, init: { content: IWER_SRC + SETUP } }), page = o.page;
  try {
    await startQuest(o, 'B'); await page.click('#gaGo'); await page.waitForFunction(() => window.__gaVR && window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 }); await page.waitForTimeout(2500);
    const st = () => page.evaluate(() => ({ panel: window.__gaVR.ui.kind, shots: window.__roomFire.shots, shown: window.__roomFire.shown, laser: window.__gaVR.gear().laser, mode: window.__arcade.play.mode }));
    let s0 = await st(); await H.press(page, 'right', 'b-button', 6); await H.frames(page, 6); let s1 = await st();
    chk(!s0.laser && !s1.panel && s1.shots === s0.shots, 'no gun: B does nothing (no menu, no shot)', s1);
    await H.press(page, 'left', 'y-button'); await H.frames(page, 4); chk((await st()).panel === 'menu', 'Y opens the menu');
    await H.press(page, 'left', 'y-button'); await H.frames(page, 4); chk(!(await st()).panel, 'Y closes it');
    await equip(page); await H.frames(page, 20); s0 = await st();
    chk(s0.laser && s0.shown, 'pistol equipped after PLAY -> VR: the room FIRE is live (the bug: shown stayed false)', s0);
    await H.btn(page, 'right', 'b-button', 1); await H.frames(page, 6); await page.waitForTimeout(250); await H.btn(page, 'right', 'b-button', 0); await H.frames(page, 8); s1 = await st();
    chk(s1.shots > s0.shots && !s1.panel, 'gun on: B fires the laser (shots ' + s0.shots + ' -> ' + s1.shots + '), no menu', s1);
    await H.press(page, 'left', 'y-button'); await H.frames(page, 4); chk((await st()).panel === 'menu', 'gun on: Y opens the menu'); await H.press(page, 'left', 'y-button'); await H.frames(page, 4);
    await unequip(page); await H.frames(page, 20); s0 = await st(); await H.press(page, 'right', 'b-button', 6); await H.frames(page, 6); s1 = await st();
    chk(!s0.laser && !s1.panel && s1.shots === s0.shots, 'gun off again: B does nothing', s1);
  } catch (e) { chk(false, 'headset threw: ' + e.message); }
  chk(!o.errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)).length, 'headset: no page errors', o.errors.slice(0, 2)); await o.close();
}
async function flat() {
  const o = await open({ start: true, supa, w: 640, h: 400, ua: QUA, init: { content: IWER_SRC + SETUP } }), page = o.page;
  try {
    await startQuest(o, 'F'); await page.click('#gaGoFlat'); await page.waitForFunction(() => window.__start && window.__start.dismissed || !document.getElementById('start'), null, { timeout: 15000 }); await page.waitForTimeout(2000);
    await page.evaluate(() => { window.__gaForceQuest = 1; });
    const st = () => page.evaluate(() => ({ shots: window.__roomFire.shots, shown: window.__roomFire.shown, none: window.__gaQuestBNone || 0, jump: window.__arcade.st.jumpReq || 0, pres: !!(window.__gaVR && window.__gaVR.presenting) }));
    let s0 = await st(); await page.evaluate(() => window.__gaQuestBFire()); await page.waitForTimeout(500); let s1 = await st();
    chk(!s0.pres && s1.shots === s0.shots && s1.none > s0.none && s1.jump === s0.jump, 'flat Quest, no gun: B does nothing (no shot, no jump)', { s0, s1 });
    await equip(page); await page.waitForTimeout(800); s0 = await st(); await page.evaluate(() => window.__gaQuestBFire()); await page.waitForTimeout(700); s1 = await st();
    chk(s0.shown && s1.shots > s0.shots, 'flat Quest, gun on: B fires the laser (' + s0.shots + ' -> ' + s1.shots + ')', { s0, s1 });
  } catch (e) { chk(false, 'flat threw: ' + e.message); }
  chk(!o.errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)).length, 'flat: no page errors', o.errors.slice(0, 2)); await o.close();
}
(async () => { await headset(); await flat(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1); })();
