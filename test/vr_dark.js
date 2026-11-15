// t349u: Dave's real Quest showed a pitch-black room after ENTER VR, yet the emulator passed.
// Why the emulator missed it: IWER's XRWebGLLayer.framebuffer is null (= the page canvas), so drawing to the page canvas
// "worked". On a real Quest the headset image is its OWN framebuffer; anything drawn to the page canvas is never seen.
// This test gives the emulated headset its own framebuffer like real hardware, then reads the pixels the HEADSET shows:
// at entry, looking around, after a few seconds, and after walking. Plus: every VR room draw targets the XR framebuffer,
// and the VR fill light is on in VR and off after.
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
const { HEADSET_FB } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB } });
  const seen = (r, tag) => { const good = r && r.left.lit > 15 && r.right.lit > 15 && r.left.mean > 8 && r.right.mean > 8;
    chk(good, tag + ' headset not black ' + JSON.stringify(r)); return good; };
  const look = async yawDeg => { await page.evaluate(a => { const q = window.__xrd.quaternion, h = a / 2; q.set(0, Math.sin(h), 0, Math.cos(h)); }, yawDeg * Math.PI / 180); await H.frames(page, 4); };
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await H.frames(page, 8);
    chk(await page.evaluate(() => window.__hsStatus === 'complete' && !!window.__hsLayer), 'emulated headset has its own framebuffer (like a real Quest)');
    seen(await page.evaluate(() => window.__hsRead()), 'at entry:');
    for (const a of [90, 180, 270, 0]) seen((await look(a), await page.evaluate(() => window.__hsRead())), 'looking ' + a + ' deg:');
    await page.waitForTimeout(3000); await H.frames(page, 6);
    seen(await page.evaluate(() => window.__hsRead()), 'after 3 s:');
    await H.axes(page, 'left', 0, -1); await page.waitForTimeout(700); await H.axes(page, 'left', 0, 0); await H.frames(page, 4);
    seen(await page.evaluate(() => window.__hsRead()), 'after walking:');
    const p = await page.evaluate(() => ({ rt: window.__gaVR.rt, fill: !!(window.__gaVR.fill && window.__gaVR.fill.visible) }));
    chk(p.rt && p.rt.xr > 20 && p.rt.bad === 0, 'every VR room draw went into the XR framebuffer ' + JSON.stringify(p.rt));
    chk(p.fill, 'VR fill light is on in VR');
    await page.evaluate(() => window.__gaVR.exit()); await page.waitForFunction(() => !window.__gaVR.presenting, null, { timeout: 20000 });
    chk(await page.evaluate(() => !window.__gaVR.fill.visible), 'fill light off after leaving VR');
  } catch (e) { chk(false, 'exception ' + e); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
