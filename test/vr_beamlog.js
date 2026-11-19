// vrtest-v16 (t492u): ?beamlog=1 shows a panel in VR after a beam, and the kill-switch flags
// (?oldacc=1 ?noatlas=1 ?nofiretypes=1 ?olddim=1) skip those features. Small viewport.
const { openVR, H } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 280) : '')); if (!c) ok = false; };
  try {
    // ---- flags skip creation ----
    const flags = await openVR({ w: 480, h: 270, qs: '?oldacc=1&noatlas=1&nofiretypes=1&olddim=1&nowarm=1&noveil=1' });
    await flags.page.waitForFunction(() => window.__shop && window.__gaPlayer && document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 90000 });
    const f = await flags.page.evaluate(() => {
      const sh = window.__shop, gp = window.__gaPlayer, D = (window.__gaDbg || {});
      return { oldAcc: !!(gp && gp.oldAcc), NOATLAS: !!sh.NOATLAS, OLDDIM: !!sh.OLDDIM, WHITE_K: sh.WHITE_K, EMISSIVE_K: sh.EMISSIVE_K,
        pending: sh.iconsPending ? sh.iconsPending() : -1, atlasCv: !!(sh.iconAtlas && sh.iconAtlas.cv),
        dbg: { oldacc: !!D.oldacc, noatlas: !!D.noatlas, nofiretypes: !!D.nofiretypes, olddim: !!D.olddim } };
    });
    chk(f.oldAcc && f.NOATLAS && f.OLDDIM && f.WHITE_K === 0.8 && f.EMISSIVE_K === 1, 'flags: v12 accessories, no atlas, v12 dim 0.8x', f);
    chk(f.pending === 0 && !f.atlasCv, 'noatlas skips atlas canvas and bake queue', { pending: f.pending, atlasCv: f.atlasCv });
    await flags.page.click('#vrBtn');
    await flags.page.waitForFunction(() => window.__gaVR && window.__gaVR.presenting && window.__gaVR.posed && !(window.__gaVR.veil && window.__gaVR.veil.on), null, { timeout: 30000 });
    const D = await flags.page.evaluate(() => window.__gaVR.dbg());
    chk(D.oldacc && D.noatlas && D.nofiretypes && D.olddim, 'vr.js dbg() sees all four kill-switches', D);
    await flags.page.evaluate(() => { const S = window.__gaVR; S.rig = { x: 2, y: 0, z: 4, yaw: 0 }; S.applyRig(); window.__arcade.monkey.position.set(2, 0, 4); });
    await H.frames(flags.page, 4);
    await H.btn(flags.page, 'right', 'thumbstick', 1); await H.frames(flags.page, 3); await H.btn(flags.page, 'right', 'thumbstick', 0); await H.frames(flags.page, 3);
    const menu = await flags.page.evaluate(() => window.__gaVR.fireMenu());
    chk(!menu.open && !menu.visible, 'nofiretypes: right stick click does not open the fire-type wheel', menu);
    chk(flags.errors.filter(e => !/supabase|net::|Failed to load/i.test(e)).length === 0, 'no page errors on flag run ' + flags.errors.slice(0, 2).join(' | '));
    await flags.close();

    // ---- beamlog panel after a shop beam ----
    const { page, errors, close } = await openVR({ w: 480, h: 270, qs: '?beamlog=1&nowarm=1&noveil=1' });
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 90000 });
    chk(await page.evaluate(() => !!(window.__gaVR.dbg && window.__gaVR.dbg().beamlog)), '?beamlog=1 is on');
    await page.click('#vrBtn');
    await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed && !(window.__gaVR.veil && window.__gaVR.veil.on), null, { timeout: 60000 });
    await page.evaluate(() => { window.__tpTimeScale = 3; window.__gaVR.ui.beam(); });
    await page.waitForFunction(() => { const s = window.__gaVR.state(); return s.tpWhere === 2 && s.tpState === 'idle'; }, null, { timeout: 90000 });
    const log = await page.waitForFunction(() => { const r = window.__gaVR.beamLog && window.__gaVR.beamLog(); return r && r.dest && r.worstMs != null ? r : null; }, null, { timeout: 15000 });
    const r = await log.jsonValue();
    console.log('BEAMLOG ' + JSON.stringify(r));
    chk(r.dest === 'shop' && typeof r.worstMs === 'number' && r.frames > 0, 'beamlog report covers the shop beam', { dest: r.dest, worstMs: r.worstMs, frames: r.frames, progs: r.progs, tex: r.tex, texMB: r.texMB, geo: r.geo });
    chk('progs' in r && 'tex' in r && 'texMB' in r && 'geo' in r, 'report has shader / texture / geometry upload counts');
    chk('atlas' in r && 'warm' in r && 'longTask' in r && 'audio' in r, 'report says whether atlas bake, pre-warm, long task or audio decode ran');
    chk(Array.isArray(r.first), 'report lists first-drawn objects', r.first && r.first.slice(0, 8));
    const panel = await page.evaluate(() => { const m = window.__arcade.scene.getObjectByName('vrBeamLog');
      return m ? { visible: !!m.visible, name: m.name, lines: (m.userData && m.userData.txt) || '' } : null; });
    chk(panel && panel.visible && /BEAM SHOP/.test(panel.lines) && /WORST FRAME/.test(panel.lines), 'in-VR panel shows the beam readout', panel);
    chk(errors.filter(e => !/supabase|net::|Failed to load/i.test(e)).length === 0, 'no page errors on beamlog run ' + errors.slice(0, 2).join(' | '));
    await close();
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().split('\n')[0]); }
  console.log(ok ? 'ALL PASS' : 'SOME FAILED');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL exception ' + e.message); process.exit(1); });
