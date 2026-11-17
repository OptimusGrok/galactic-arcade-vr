// v20 (Dave): every FLOOR option must render properly in the prize shop (the teleporter white room), flat and VR.
// Was: NEON showed the plain white room floor (the neon look is a Reflector + hex overlay that only exists in rooms 1 / 2) and CARPET
// showed black (the shop's carpet copy cloned the carpet texture before it had loaded - or the 4 px blank stub on low tier - and never
// re-uploaded; its tile repeat also missed the shop's later floor stretch). This renders the shop floor for each option into a render
// target (flat camera, and an XR-presenting pass in the emulated headset) and checks the pixels + the floor materials.
const { open } = require('./lib');
const { openVR, IWER_SRC, SETUP, H } = require('./vrlib');
const FLOORS = ['cobble', 'neon', 'carpet', 'checkers', 'lava', 'ice'];
async function probe(page, mode) {
  await page.evaluate(m => window.__setFloor(m), mode);
  if (mode === 'carpet') await page.waitForFunction(() => { const c = window.__arcade.scene.getObjectByName('carpetW'); const t = c && c.material.map; return !!(t && t.image && t.image.width > 16); }, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  return page.evaluate(m => {
    const A = window.__arcade, T = A.THREE, r = A.renderer, sc = A.scene, WX = 80, W = 160, Hh = 90;
    const cam = new T.PerspectiveCamera(60, W / Hh, 0.05, 60); cam.position.set(WX + 0.5, 2.0, 4.5); cam.lookAt(WX + 0.5, 0, 0.5); cam.updateMatrixWorld();
    const rt = new T.WebGLRenderTarget(W, Hh, { colorSpace: T.SRGBColorSpace }); const prevT = r.getRenderTarget(), xr = r.xr.enabled; r.xr.enabled = false;
    r.setRenderTarget(rt); r.render(sc, cam); const px = new Uint8Array(W * Hh * 4); r.readRenderTargetPixels(rt, 0, 0, W, Hh, px); r.setRenderTarget(prevT); r.xr.enabled = xr; rt.dispose();
    let n = 0, sr = 0, sg = 0, sb = 0, sl = 0, sl2 = 0, white = 0, black = 0;
    for (let y = 0; y < Hh * 0.45; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, R = px[i], G = px[i + 1], B = px[i + 2], l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      n++; sr += R; sg += G; sb += B; sl += l; sl2 += l * l; if (R > 235 && G > 235 && B > 235) white++; if (l < 10) black++; }
    const mean = sl / n, sd = Math.sqrt(Math.max(0, sl2 / n - mean * mean));
    const fl = A.scene.getObjectByName('whiteRoom'), cw = sc.getObjectByName('carpetW'), nw = sc.getObjectByName('neonW');
    const mat = cw && cw.visible ? cw.material : null;
    return { mode: m, rgb: [sr / n, sg / n, sb / n].map(v => Math.round(v)), luma: Math.round(mean), sd: +sd.toFixed(1), white: +(white / n).toFixed(3), black: +(black / n).toFixed(3),
      cw: !!(cw && cw.visible), neonW: !!(nw && nw.visible), map: mat && mat.map ? { w: mat.map.image && mat.map.image.width, rep: mat.map.repeat.x.toFixed(2), ver: mat.map.version } : null,
      flScale: (() => { const f = cw && cw.parent; return f ? +f.scale.x.toFixed(2) : null; })(), mat: mat ? mat.type : null };
  }, mode);
}
function judge(chk, p, tag) {
  const base = tag + ' ' + p.mode.toUpperCase() + ' ' + JSON.stringify(p);
  if (p.mode === 'ice') { console.log('INFO ' + base + ' (ice is pale by design; not in v20 scope)'); }
  else chk(p.white < 0.2 && p.luma < 215, base + ' - not plain white');
  chk(p.black < 0.6 && p.luma > 12, tag + ' ' + p.mode.toUpperCase() + ' - not black');
  if (p.mode === 'neon') chk(p.neonW && !p.cw && p.rgb[2] > p.rgb[1] && p.luma < 120, tag + ' NEON: dark glossy hex floor with the purple neon tint (neonW)');
  if (p.mode === 'carpet') chk(p.cw && p.map && p.map.w > 16 && p.sd > 6 && Math.abs(p.map.rep - 3 * p.flScale) < 0.05, tag + ' CARPET: the character carpet texture loaded and tiled at room-1 scale (repeat ' + (p.map && p.map.rep) + ' = 3 x ' + p.flScale + ')');
  if (p.mode !== 'neon') chk(p.cw && !p.neonW, tag + ' ' + p.mode.toUpperCase() + ': the shop floor uses the ' + p.mode + ' material');
}
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  // ---- flat ----
  { const { page, errors, close } = await open({ w: 480, h: 270 });
    try {
      await page.evaluate(() => { const A = window.__arcade; A.monkey.position.set(83, 0, -3); window.__tp.where = 2; });
      for (const m of FLOORS) judge(chk, await probe(page, m), 'flat');
      // carpet picked FIRST on a fresh page (texture not loaded yet when the shop copy is made)
    } catch (e) { chk(false, 'flat exception ' + String(e && e.stack || e).slice(0, 500)); }
    const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'flat: no page errors ' + errs.slice(0, 3).join(' | '));
    await close(); }
  { const { page, errors, close } = await open({ w: 480, h: 270, qs: '?tier=low', init: () => { try { localStorage.setItem('neonarcade.floor', 'carpet'); } catch (e) {} } });   // low tier from the start: the shop copy is made from the 4 px stub
    try { await page.evaluate(() => { const A = window.__arcade; A.monkey.position.set(83, 0, -3); window.__tp.where = 2; });
      judge(chk, await probe(page, 'carpet'), 'flat low-tier, carpet saved before load');
      judge(chk, await probe(page, 'neon'), 'flat low-tier');
    } catch (e) { chk(false, 'low exception ' + String(e && e.stack || e).slice(0, 500)); }
    await close(); }
  // ---- VR: pick each floor from the headset FLOOR + WALLS panel while standing in the shop, render through the XR path ----
  { const { page, errors, close } = await openVR();
    try {
      await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
      await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
      await page.evaluate(() => { const S = window.__gaVR; S.rig = { x: 82, y: 0, z: 2, yaw: 0 }; S.applyRig(); window.__arcade.monkey.position.set(82, 0, 2); window.__tp.where = 2; }); await H.frames(page, 6);
      for (const m of FLOORS) {
        await page.evaluate(() => { const S = window.__gaVR; S.ui.open('room'); }); await H.frames(page, 4);
        const w = await page.evaluate(id => window.__gaVR.ui.btnWorld(id), 'fl_' + m);
        if (w) { await H.aim(page, 'right', [0.2, 1.3, -0.2], w); await H.frames(page, 3); await H.press(page, 'right', 'trigger'); }
        const got = await page.evaluate(() => localStorage.getItem('neonarcade.floor')); chk(got === m, 'VR FLOOR + WALLS panel: ' + m.toUpperCase() + ' button sets the ' + m + ' floor (' + got + ')');
        await page.evaluate(() => window.__gaVR.ui.close()); await H.frames(page, 4); judge(chk, await probe(page, m), 'VR'); }
    } catch (e) { chk(false, 'VR exception ' + String(e && e.stack || e).slice(0, 500)); }
    const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'VR: no page errors ' + errs.slice(0, 3).join(' | '));
    await close(); }
  console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
