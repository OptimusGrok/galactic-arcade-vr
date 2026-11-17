// v18 (t405u / t407u, Dave: "teleporting goes black and freezes", "entering VR freezes"): measures the XR frames on ENTRY (click -> first XR
// frame, longest frame interval in the first 120 XR frames) and around every beam CUT (room 1 -> shop -> room 1 -> Neon Knockout -> room 1):
// longest interval, new shader programs compiled on/after the cut, and what the headset shows on the frames right after the cut
// (% lit pixels; a black void would read ~0). Works on old builds too (GA_ROOT=<checkout>) for before/after numbers. CHECK=1 asserts.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
const CHECK = !!process.env.CHECK;
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB } });
  const E = (f, a) => page.evaluate(f, a);
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 30000 });
    // v18 pre-warms in the background before you enter; old builds have nothing to wait for
    const pw = await page.waitForFunction(() => { const S = window.__gaVR; return !S.prewarm || S.prewarm.done; }, null, { timeout: 180000 }).then(() => E(() => window.__gaVR.prewarm || null));
    console.log('INFO prewarm ' + JSON.stringify(pw));
    await page.waitForTimeout(500);
    await E(() => { const r = window.__arcade.renderer, o = r.render.bind(r), A = window.__arcade;
      const P = window.__xp = { iv: [], prog: [], where: [], lit: [], last: 0, t0: 0, first: 0, cutAt: [], pend: 0, w0: null };
      r.render = function (s, c) { if (!r.xr.isPresenting || s !== A.scene) return o(s, c); const t = performance.now(), n0 = r.info.programs.length; if (!P.first) P.first = t;
        if (P.last) P.iv.push(+(t - P.last).toFixed(1)); P.last = t; o(s, c); (P.rd = P.rd || []).push(+(performance.now() - t).toFixed(1)); const n1 = r.info.programs.length; P.prog.push(n1 - n0);
        const w = window.__tp ? window.__tp.where : 0; if (P.w0 !== null && w !== P.w0) { P.cutAt.push(P.iv.length); P.pend = 6; } P.w0 = w; P.where.push(w);
        if (P.pend > 0) { P.pend--; try { const h = window.__hsRead(); P.lit.push([P.cutAt.length, h ? h.left.lit : -1]); } catch (e) {} } }; });
    await E(() => { window.__xp.t0 = performance.now(); document.getElementById('vrBtn').click(); });
    await page.waitForFunction(() => window.__gaVR.presenting && window.__xp.iv.length >= 120, null, { timeout: 180000 });
    const en = await E(() => { const P = window.__xp, iv = P.iv.slice(0, 120), s = iv.slice().sort((a, b) => b - a); return { clickToFirst: +(P.first - P.t0).toFixed(1), maxIv: s[0], top5: s.slice(0, 5), progs: P.prog.slice(0, 121).reduce((a, b) => a + b, 0), med: iv.slice().sort((a, b) => a - b)[60], warms: (window.__gaVR.warms || []).map(w => w.why + ':' + w.ms + 'ms/' + w.programs + 'p') }; });
    console.log('ENTRY ' + JSON.stringify(en));
    // beams
    const beam = async (dest, where) => { await E(([d, w]) => { const P = window.__xp; P.mark = P.iv.length; window.__tpTimeScale = 3; if (d === 'nk') window.__tp.go('nk'); else window.__tp.go(); }, [dest, where]);
      await page.waitForFunction(w => window.__tp.where === w && window.__tp.state === 'idle', where, { timeout: 120000 }); await H.frames(page, 30);
      const r = await E(() => { const P = window.__xp, c = P.cutAt[P.cutAt.length - 1], win = P.iv.slice(Math.max(P.mark, c - 2), c + 30), pr = P.prog.slice(c - 1, c + 30).reduce((a, b) => a + b, 0), all = P.iv.slice(P.mark), lit = P.lit.filter(x => x[0] === P.cutAt.length).map(x => x[1]);
        const mi = all.indexOf(Math.max(...all)) + P.mark; return { renderAtMax: [P.rd[mi - 1], P.rd[mi]], maxAtCut: Math.max(...win), maxWholeBeam: Math.max(...all), progsAfterCut: pr, litAfterCut: lit, warms: (window.__gaVR.warms || []).slice(-3).map(w => w.why + ':' + w.ms + 'ms/' + w.programs + 'p') }; });
      console.log('BEAM ' + dest + ' ' + JSON.stringify(r)); return r; };
    await page.evaluate(() => { const S = window.__gaVR, P = window.__tp.PAD1; S.rig = { x: P.x + 0.8, y: 0, z: P.z + 0.8, yaw: 0.8 }; S.applyRig(); window.__arcade.monkey.position.set(P.x + 0.8, 0, P.z + 0.8); });
    await H.frames(page, 10);
    const b1 = await beam('shop', 2), b2 = await beam('arcade', 1), b3 = await beam('nk', 3), b4 = await beam('arcade', 1);
    if (CHECK) {
      chk(en.maxIv < 250, 'entry: no long freeze in the first 120 XR frames (longest ' + en.maxIv + ' ms)');
      for (const [n, b] of [['shop', b1], ['arcade', b2], ['nk', b3], ['arcade from nk', b4]]) {
        chk(b.litAfterCut.length >= 3 && b.litAfterCut.every(l => l > 5), 'beam to ' + n + ': the headset shows the room on every frame after the cut (lit % ' + b.litAfterCut.join(',') + ')');
        chk(b.progsAfterCut === 0, 'beam to ' + n + ': no shaders compiled at the cut (' + b.progsAfterCut + ')');
        chk(b.maxAtCut < 250, 'beam to ' + n + ': no freeze at the cut (longest frame ' + b.maxAtCut + ' ms)'); }
    }
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 600)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
