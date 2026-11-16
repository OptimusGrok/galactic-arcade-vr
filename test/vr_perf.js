// t358u: VR frame-time profile of the arcade (works on old and new builds: GA_ROOT=<checkout>). Fixed route: turn 360 in room 1, walk the room,
// beam to the shop and look at the mirror, beam back. Reports frame intervals, render time, long tasks, new shader programs, texture count.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB + `
    window.__lt = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration, (e.attribution && e.attribution[0] && (e.attribution[0].containerSrc || e.attribution[0].containerType)) || e.name]); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}` } });
  const place = async (x, z, yaw = 0) => { await page.evaluate(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); };
  const stats = async (label) => { const r = await page.evaluate(() => { const P = window.__perf; const iv = P.iv.slice().sort((a, b) => a - b), rd = P.rd.slice().sort((a, b) => a - b), cp = P.cpu.slice().sort((a, b) => a - b), q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
      const lt = window.__lt.filter(e => e[0] >= P.t0); return { n: iv.length, med: q(iv, 0.5), p95: q(iv, 0.95), max: iv.length ? iv[iv.length - 1] : 0, over50: iv.filter(v => v > 50).length, over100: iv.filter(v => v > 100).length,
        cpuMed: q(cp, 0.5), cpuP95: q(cp, 0.95), cpuMax: cp.length ? cp[cp.length - 1] : 0, cpuOver50: cp.filter(v => v > 50).length, cpuOver20: cp.filter(v => v > 20).length, rdMed: q(rd, 0.5), rdMax: rd.length ? rd[rd.length - 1] : 0, progs: P.progs, newProgs: P.newProgs, tex: window.__arcade.renderer.info.memory.textures, lt: lt.length, ltMax: lt.reduce((m, e) => Math.max(m, e[1]), 0), ltSum: lt.reduce((m, e) => m + e[1], 0), ltSrc: Object.entries(lt.reduce((m, e) => { const k = String(e[2]).split('/').slice(-2).join('/'); m[k] = (m[k] || 0) + Math.round(e[1]); return m; }, {})).map(x => x.join(':')).join(','), timeline: JSON.stringify((P.tl || []).slice(0, 30)), warms: JSON.stringify(window.__gaVR.warms || []), pinned: String(window.__gaVR.pinned ? window.__gaVR.pinned() : "") }; });
    console.log('PERF ' + label + ' ' + JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(1) : v])))); return r; };
  const reset = () => page.evaluate(() => { window.__perfKeys = []; const P = window.__perf; P.iv = []; P.cpu = []; P.rd = []; P.newProgs = 0; P.names = []; P.tl = []; P.t0 = performance.now(); P.last = 0; });
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.evaluate(() => { const r = window.__arcade.renderer, o = r.render.bind(r); window.__perf = { iv: [], cpu: [], rd: [], progs: 0, newProgs: 0, t0: 0, last: 0 };
      r.render = function (s, c) { const P = window.__perf, t = performance.now(); if (r.xr.isPresenting) { if (P.last) { P.iv.push(t - P.last); P.cpu.push(window.__arcade.stats.cpu); } P.last = t; } const n0 = r.info.programs ? r.info.programs.length : 0; o(s, c); const n1 = r.info.programs ? r.info.programs.length : 0; if (r.xr.isPresenting) { P.rd.push(performance.now() - t); if (n1 > n0) { (P.tl = P.tl || []).push([window.__gaVR.frames, n1 - n0, (s => s.tpWhere + s.tpState)(window.__gaVR.state()), !!window.__gaVR.inMirror, Math.round(performance.now() - t)]); P.newProgs += n1 - n0; if (window.__perfKeys) for (let i = n0; i < n1; i++) window.__perfKeys.push([window.__gaVR.frames, r.info.programs[i].cacheKey]); for (let i = n0; i < n1; i++) (P.names = P.names || []).push(r.info.programs[i].name || '?'); } } P.progs = n1; }; });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await H.frames(page, 5); await reset();
    // 1) XR start + turn 360 in room 1
    await place(2, 4, 0); for (let i = 0; i <= 72; i++) { await page.evaluate(y => { const S = window.__gaVR; S.rig.yaw = y; S.applyRig(); }, i * Math.PI / 36); await H.frames(page, 2); }
    const a = await stats('turn360'); await reset();
    // 2) walk the room (x -8..12 along z 4, then back along z -2)
    for (let i = 0; i <= 40; i++) { await place(-8 + i * 0.5, 4, Math.PI / 2); await H.frames(page, 2); }
    for (let i = 0; i <= 40; i++) { await place(12 - i * 0.5, -2, -Math.PI / 2); await H.frames(page, 2); }
    const b = await stats('walk'); await reset();
    for (let i = 0; i <= 40; i++) { await place(-8 + i * 0.5, 4, Math.PI / 2); await H.frames(page, 2); }
    for (let i = 0; i <= 40; i++) { await place(12 - i * 0.5, -2, -Math.PI / 2); await H.frames(page, 2); }
    await stats('walk again (steady state)'); await reset();
    // 3) beam to the shop, look at the mirror, beam back
    await page.evaluate(() => { window.__tpTimeScale = 3; window.__gaVR.ui.beam(); });
    await page.waitForFunction(() => { const s = window.__gaVR.state(); return s.tpWhere === 2 && s.tpState === 'idle'; }, null, { timeout: 90000 });
    const M = await page.evaluate(() => { const sh = window.__gaVR.ui.shop(); const m = sh && sh.wardrobe && sh.wardrobe.mirror.mesh; if (!m) return null; const T = window.__arcade.THREE, p = m.getWorldPosition(new T.Vector3()), n = m.getWorldDirection(new T.Vector3()); return { p: p.toArray(), n: n.toArray() }; });
    if (M) { await place(M.p[0] + M.n[0] * 1.6, M.p[2] + M.n[2] * 1.6, Math.atan2(M.n[0], M.n[2])); await H.frames(page, 60); }
    await page.evaluate(() => window.__gaVR.ui.beam()); await page.waitForFunction(() => { const s = window.__gaVR.state(); return s.tpWhere === 1 && s.tpState === 'idle'; }, null, { timeout: 90000 });
    await H.frames(page, 20); const c = await stats('shop+mirror+beams');
    if (process.env.PERF_DIFF) console.log('DIFFS ' + await page.evaluate(() => { const all = window.__arcade.renderer.info.programs.map(p => p.cacheKey); return JSON.stringify((window.__perfKeys || []).map(([f, k]) => { const a = k.split(','); let best = null, bd = 1e9; for (const kk of all) { if (kk === k) continue; const b = kk.split(','); if (b[0] !== a[0]) continue; let d = 0; const idx = []; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { d++; idx.push(i + ':' + a[i] + '/' + b[i]); } if (d < bd) { bd = d; best = idx.slice(0, 4).join(' '); } } return f + ' ' + a[0].slice(0, 12) + ' => ' + best; })); }));
    chk(a.n > 50 && b.n > 50 && c.n > 50, 'profile collected (' + [a.n, b.n, c.n].join(' / ') + ' frames)');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 500)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
