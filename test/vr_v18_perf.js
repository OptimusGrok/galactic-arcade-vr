// v18 (t405u / t407u, Dave: "teleporting goes black and freezes", "entering VR freezes"): measures the XR frames on ENTRY (click -> first XR
// frame, longest frame interval in the first 120 XR frames) and around every beam CUT (room 1 -> shop -> room 1 -> Neon Knockout -> room 1):
// longest interval, new shader programs compiled on/after the cut, and what the headset shows on the frames right after the cut
// (% lit pixels; a black void would read ~0). Every XR frame waits for its GPU work (1-pixel read), so a slow GPU frame shows on itself. Works on old builds too (GA_ROOT=<checkout>) for before/after numbers. CHECK=1 asserts.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
const CHECK = !!process.env.CHECK;
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ cpu: +process.env.CPU || 0, init: { content: IWER_SRC + SETUP + HEADSET_FB } });   // vrtest-v8: CPU=4 like the Quest; EARLY=<ms> enters VR that long after ENTER VR shows (pre-warm may still be running, as when Dave taps PLAY)
  const E = (f, a) => page.evaluate(f, a);
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 30000 });
    // v18 pre-warms in the background before you enter; old builds have nothing to wait for
    const pw = process.env.EARLY ? await page.waitForTimeout(+process.env.EARLY).then(() => E(() => Object.assign({}, window.__gaVR.prewarm || {}, { atEntry: true }))) : await page.waitForFunction(() => { const S = window.__gaVR; return !S.prewarm || S.prewarm.done; }, null, { timeout: 180000 }).then(() => E(() => window.__gaVR.prewarm || null));
    console.log('INFO prewarm ' + JSON.stringify(pw));
    await page.waitForTimeout(500);
    // TRACE=1 (v9, Dave t469u: the FIRST shop -> arcade beam froze): per XR frame GL work + first uses since the session began
    // (programs / textures / VAOs never bound in XR, program+framebuffer pairs, uploads, buffer data, render-target allocations)
    if (process.env.TRACE) await E(() => { const gl = window.__arcade.renderer.getContext(), T = window.__gt = { cur: {}, seen: new WeakSet(), pf: new WeakMap() }; let fb = null, fbn = 0; const fid = new WeakMap();
      const bump = (k, n = 1) => { T.cur[k] = (T.cur[k] || 0) + n; };
      for (const n of ['texImage2D', 'texSubImage2D', 'texStorage2D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'bufferData', 'compileShader', 'linkProgram', 'renderbufferStorage', 'renderbufferStorageMultisample', 'generateMipmap', 'createFramebuffer']) { const f = gl[n]; gl[n] = function () { const t = performance.now(); try { return f.apply(gl, arguments); } finally { bump(n); bump(n + '_ms', performance.now() - t); if (n === 'texStorage2D' || n === 'texImage2D') T.cur['@' + n] = (T.cur['@' + n] || '') + (n === 'texStorage2D' ? arguments[3] + 'x' + arguments[4] : (arguments[3] | 0) + 'x' + (arguments[4] | 0)) + ' '; if (n === 'bufferData') bump('bufferKB', ((arguments[1] && arguments[1].byteLength) || 0) / 1024); } }; }
      const bf = gl.bindFramebuffer; gl.bindFramebuffer = function (t, f) { if (t !== gl.READ_FRAMEBUFFER) fb = f; return bf.apply(gl, arguments); };
      const xr = () => window.__arcade.renderer.xr.isPresenting;
      const up = gl.useProgram; gl.useProgram = function (p) { if (p && xr()) { if (!T.seen.has(p)) { T.seen.add(p); bump('newProg'); } const k = fb ? (fid.get(fb) || (fid.set(fb, ++fbn), fbn)) : 0; let s = T.pf.get(p); if (!s) T.pf.set(p, s = new Set()); if (!s.has(k)) { s.add(k); bump('newProgFB'); } } return up.apply(gl, arguments); };
      const bt = gl.bindTexture; gl.bindTexture = function (t, x) { if (x && xr() && !T.seen.has(x)) { T.seen.add(x); bump('newTex'); } return bt.apply(gl, arguments); };
      const bv = gl.bindVertexArray; gl.bindVertexArray = function (v) { if (v && xr() && !T.seen.has(v)) { T.seen.add(v); bump('newVAO'); } return bv.apply(gl, arguments); }; });
    await E(() => { const r = window.__arcade.renderer, o = r.render.bind(r), A = window.__arcade;
      const P = window.__xp = { iv: [], prog: [], where: [], lit: [], last: 0, t0: 0, first: 0, cutAt: [], pend: 0, w0: null };
      r.render = function (s, c) { if (!r.xr.isPresenting || s !== A.scene) return o(s, c); const t = performance.now(), n0 = r.info.programs.length; if (!P.first) P.first = t;
        if (P.last) P.iv.push(+(t - P.last).toFixed(1)); P.last = t; o(s, c); try { const L = window.__hsLayer; if (L && L.__fb) { const gl = L.context, px = new Uint8Array(4), pr = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, L.__fb); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, pr); } } catch (e) {}   // sync with the GPU every frame: each interval includes its own GPU work
        (P.rd = P.rd || []).push(+(performance.now() - t).toFixed(1)); const n1 = r.info.programs.length; P.prog.push(n1 - n0); if (window.__gt) { (P.gl = P.gl || []).push(window.__gt.cur); window.__gt.cur = {}; }
        const w = window.__tp ? window.__tp.where : 0; if (P.w0 !== null && w !== P.w0) { P.cutAt.push(P.iv.length); P.pend = 6; } P.w0 = w; P.where.push(w);
        if (P.pend > 0) { P.pend--; try { const h = window.__hsRead(); P.lit.push([P.cutAt.length, h ? h.left.lit : -1]); } catch (e) {} } }; });
    await E(() => { window.__xp.t0 = performance.now(); document.getElementById('vrBtn').click(); });
    await page.waitForFunction(() => window.__gaVR.presenting && window.__xp.iv.length >= 120, null, { timeout: 180000 });
    // v8: an early entry shows the PREPARING VR card until the pre-warm is done; measure the 120 frames after it lifts as well
    const vl = await page.waitForFunction(() => { const V = window.__gaVR.veil; return !V || !V.on; }, null, { timeout: 240000 }).then(() => E(() => { const V = window.__gaVR.veil, P = window.__xp; return V ? { shows: V.shows, ms: V.ms, at: P.iv.length } : null; }));
    if (vl && vl.shows) { await page.waitForFunction(n => window.__xp.iv.length >= n + 120, vl.at, { timeout: 240000 });
      console.log('VEIL ' + JSON.stringify(await E(n => { const P = window.__xp, a = P.iv.slice(0, n), b = P.iv.slice(n, n + 120), s = b.slice().sort((x, y) => y - x);
        return { pw: window.__gaVR.prewarm, cardMs: window.__gaVR.veil.ms, framesUnderCard: a.length, maxUnderCard: Math.max(...a), after: { maxIv: s[0], top5: s.slice(0, 5), progs: P.prog.slice(n, n + 121).reduce((x, y) => x + y, 0) }, warms: (window.__gaVR.warms || []).map(w => w.why + ':' + w.ms + 'ms/' + w.programs + 'p') }; }, vl.at))); }
    const en = await E(() => { const P = window.__xp, iv = P.iv.slice(0, 120), s = iv.slice().sort((a, b) => b - a); return { clickToFirst: +(P.first - P.t0).toFixed(1), maxIv: s[0], top5: s.slice(0, 5), progs: P.prog.slice(0, 121).reduce((a, b) => a + b, 0), med: iv.slice().sort((a, b) => a - b)[60], warms: (window.__gaVR.warms || []).map(w => w.why + ':' + w.ms + 'ms/' + w.programs + 'p') }; });
    console.log('ENTRY ' + JSON.stringify(en));
    // beams
    const beam = async (dest, where) => { await E(([d, w]) => { const P = window.__xp; P.mark = P.iv.length; window.__tpTimeScale = 3; if (d === 'nk') window.__tp.go('nk'); else window.__tp.go(); }, [dest, where]);
      await page.waitForFunction(w => window.__tp.where === w && window.__tp.state === 'idle', where, { timeout: 120000 }); await H.frames(page, 30);
      const r = await E(() => { const P = window.__xp, c = P.cutAt[P.cutAt.length - 1], win = P.iv.slice(Math.max(P.mark, c - 2), c + 30), pr = P.prog.slice(c - 1, c + 30).reduce((a, b) => a + b, 0), all = P.iv.slice(P.mark), lit = P.lit.filter(x => x[0] === P.cutAt.length).map(x => x[1]);
        const mi = all.indexOf(Math.max(...all)) + P.mark; const G = P.gl || [], sum = {}; for (const g of G.slice(Math.max(P.mark, c - 2), c + 30)) for (const [k, v] of Object.entries(g)) if (typeof v === 'number') sum[k] = Math.round((sum[k] || 0) + v);
        return { glAtMax: [G[mi - 1], G[mi]].map(g => g && Object.fromEntries(Object.entries(g).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 10) / 10 : v.slice(0, 200)]))), glCutWindow: G.length ? sum : undefined, renderAtMax: [P.rd[mi - 1], P.rd[mi]], maxAtCut: Math.max(...win), maxWholeBeam: Math.max(...all), progsAfterCut: pr, litAfterCut: lit, warms: (window.__gaVR.warms || []).slice(-3).map(w => w.why + ':' + w.ms + 'ms/' + w.programs + 'p') }; });
      console.log('BEAM ' + dest + ' ' + JSON.stringify(r)); return r; };
    await page.evaluate(() => { const S = window.__gaVR, P = window.__tp.PAD1; S.rig = { x: P.x + 0.8, y: 0, z: P.z + 0.8, yaw: 0.8 }; S.applyRig(); window.__arcade.monkey.position.set(P.x + 0.8, 0, P.z + 0.8); });
    await H.frames(page, 10);
    const b1 = await beam('shop', 2), b2 = await beam('arcade', 1), b3 = await beam('nk', 3), b4 = await beam('arcade', 1);
    if (process.env.ROUNDTRIP) { await beam('shop', 2); await beam('arcade', 1); }   // v9: the second shop round trip (Dave t469u: only the first return froze)
    if (CHECK) {
      chk(en.maxIv < 1500 && en.progs === 0, 'entry: no shaders compiled and no long freeze in the first 120 XR frames (longest ' + en.maxIv + ' ms, v17: ~4450 ms in this emulator)');
      for (const [n, b] of [['shop', b1], ['arcade', b2], ['nk', b3], ['arcade from nk', b4]]) {
        chk(b.litAfterCut.length >= 3 && b.litAfterCut.every(l => l > 5), 'beam to ' + n + ': the headset shows the room on every frame after the cut (lit % ' + b.litAfterCut.join(',') + ')');
        chk(b.progsAfterCut === 0, 'beam to ' + n + ': no shaders compiled at the cut (' + b.progsAfterCut + ')');
        chk(b.maxAtCut < 600, 'beam to ' + n + ': no freeze at the cut (longest frame ' + b.maxAtCut + ' ms; v17 up to ~1550)'); }
    }
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 600)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
