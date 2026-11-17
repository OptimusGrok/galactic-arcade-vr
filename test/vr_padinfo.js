// vrtest-v6 (Dave t465u): ?padinfo=1 shows a debug board above the left-controller display listing every property of each XR input
// source / gamepad (and navigator.getGamepads()), so the Quest can show what it exposes; the status line still reads L/R battery or '--'.
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ qs: '?padinfo=1', init: { content: IWER_SRC + SETUP } });
  const E = (f, a) => page.evaluate(f, a);
  await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 60000 });
  await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
  await page.waitForTimeout(2500); await H.frames(page, 6);
  const P = await E(() => Object.assign(window.__gaVR.padInfo(), { vis: !!(window.__arcade.scene.getObjectByName('vrPadInfo') || {}).visible, st: window.__gaVR.hudStatus().txt }));
  console.log(P.lines.join('\n').slice(0, 1500));
  chk(P.on && P.vis && P.lines.some(l => /^== left/.test(l)) && P.lines.some(l => /^== right/.test(l)) && P.lines.some(l => /^pad: .*buttons=\[/.test(l)), 'padinfo board lists both input sources and their gamepads (visible ' + P.vis + ')');
  chk(/^L (--|\d+%)  R (--|\d+%)/.test(P.st), 'status line still shows controller battery: ' + P.st);
  chk(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join('|'));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL exception ' + e.message); process.exit(1); });
