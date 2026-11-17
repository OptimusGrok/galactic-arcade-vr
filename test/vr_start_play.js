// v18 (t408u / t409u, Dave): on a Quest headset browser the start screen's PLAY goes straight into immersive VR (requestSession inside the
// click), and a second PLAY ON SCREEN button starts the flat game. Computers / phones: only PLAY, flat as before.
const { open } = require('./lib');
const { IWER_SRC, SETUP } = require('./vrlib');
const QUA = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.0.0.0 SamsungBrowser/4.0 Chrome/128.0.0.0 VR Safari/537.36';
const supa = r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const run = async (label, opts, act) => { const o = await open(Object.assign({ start: true, supa, w: 800, h: 560 }, opts)); const page = o.page;
    try {
      await page.evaluate(() => { localStorage.removeItem('galacticarcade.player'); window.__noPrewarm = 1; }); await page.reload();
      await page.waitForFunction(() => window.__arcade && window.__arcade.stats.frames > 3, null, { timeout: 90000 }); await page.waitForTimeout(1500);
      await page.waitForSelector('#gaIn'); await page.click('#gaIn'); await page.keyboard.type('Astro' + label.length);
      await page.waitForSelector('#gaGo:not([hidden])', { timeout: 20000 }); await page.waitForTimeout(500);
      const s = await page.evaluate(() => { const g = document.getElementById('gaGo').getBoundingClientRect(), f = document.getElementById('gaGoFlat'), fr = f && f.getBoundingClientRect(), shown = !!f && getComputedStyle(f).display !== 'none';
        return { quest: document.body.classList.contains('gaQuestVR'), flat: shown, flatLabel: f && f.textContent, go: document.getElementById('gaGo').textContent, overlap: shown && !(fr.right <= g.left || fr.left >= g.right || fr.bottom <= g.top || fr.top >= g.bottom), inView: shown && fr.bottom <= innerHeight && fr.top >= 0 }; });
      console.log('INFO ' + label + ' ' + JSON.stringify(s));
      await act(page, s);
      chk(!o.errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)).length, label + ': no page errors ' + o.errors.slice(0, 2).join(' | '));
    } catch (e) { chk(false, label + ' exception ' + String(e && e.stack || e).slice(0, 400)); }
    await o.close(); };
  const started = page => page.waitForFunction(() => !document.getElementById('start') || (window.__start && window.__start.dismissed), null, { timeout: 15000 }).then(() => true, () => false);
  await run('quest PLAY', { ua: QUA, init: { content: IWER_SRC + SETUP } }, async (page, s) => {
    chk(s.quest && s.flat && s.flatLabel === 'PLAY ON SCREEN' && s.go === 'PLAY' && !s.overlap && s.inView, 'Quest headset browser: PLAY plus a separate PLAY ON SCREEN button ' + JSON.stringify(s));
    await page.click('#gaGo');
    const vr = await page.waitForFunction(() => window.__gaVR && window.__gaVR.presenting, null, { timeout: 30000 }).then(() => true, () => false);
    chk(vr && await started(page), 'PLAY: straight into immersive VR (one click), start screen gone');
    const st = await page.evaluate(() => ({ starts: window.__gaVR.starts, frames: window.__gaVR.frames, err: window.__gaVR.state().err }));
    await page.waitForFunction(() => window.__gaVR.frames > 20, null, { timeout: 30000 }).catch(() => {});
    chk(st.starts === 1 && !st.err, 'one XR session, no errors ' + JSON.stringify(st)); });
  await run('quest PLAY ON SCREEN', { ua: QUA, init: { content: IWER_SRC + SETUP } }, async page => {
    await page.click('#gaGoFlat'); const ok1 = await started(page); await page.waitForTimeout(1500);
    const p = await page.evaluate(() => ({ pres: !!(window.__gaVR && window.__gaVR.presenting), mode: window.__arcade.play.mode }));
    chk(ok1 && !p.pres && p.mode === 'walk', 'PLAY ON SCREEN: the flat game, no VR session ' + JSON.stringify(p)); });
  await run('computer', { init: { content: IWER_SRC + SETUP } }, async (page, s) => {
    chk(!s.quest && !s.flat, 'computer (even with a headset runtime): only PLAY ' + JSON.stringify(s));
    await page.click('#gaGo'); const ok1 = await started(page); await page.waitForTimeout(1500);
    chk(ok1 && !(await page.evaluate(() => !!(window.__gaVR && window.__gaVR.presenting))), 'computer PLAY: flat game as before'); });
  await run('phone', { phone: true, w: 412, h: 860 }, async (page, s) => {
    chk(!s.quest && !s.flat, 'phone: only PLAY ' + JSON.stringify(s));
    await page.tap('#gaGo'); chk(await started(page), 'phone PLAY: flat game as before'); });
  console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
