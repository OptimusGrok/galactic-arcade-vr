// vrtest-v2 (Dave t446u: "freezes on the start screen and when approaching grok in the shop"): longest frames with the CPU throttled
// (CPU=4 default) in the emulated Quest 3. Scenes: start = the start screen for 45 s after load (pre-warm + shop load + streaming run here);
// shop = enter VR, beam to the shop (real speed), walk up to Grok's counter and around the shop for 20 s.
// Each long frame is labelled with what happened in it (stream ups/evicts/queue, pre-warm stage). Works on old builds (GA_ROOT=...).
// node test/vr_freeze.js [start|shop]
const { open } = require('./lib');
const { IWER_SRC, SETUP, H } = require('./vrlib');
const CPU = +(process.env.CPU || 4), which = process.argv[2] || 'both';
const REC = `;(function(){ const R = window.__frz = { f: [], last: 0, t0: performance.now() };
  function lab() { const s = window.__gaStream || {}, pw = window.__gaVR && window.__gaVR.prewarm, m = window.__music;
    return (s.ups || 0) + '/' + (s.evicts || 0) + '/' + (s.queued || 0) + (s.shop ? s.shop[1] : '-') + (pw ? (pw.done ? 'W' : pw.busy ? 'w' + pw.areas.length + '.' + pw.textures : '.') : '') + (m && m.loaded ? 'M' : '') + ' p' + (window.__arcade && window.__arcade.renderer && window.__arcade.renderer.info.programs ? window.__arcade.renderer.info.programs.length : 0) + (window.__gaVR && window.__gaVR.lightSig && window.__gaVR.presenting ? ' ' + window.__gaVR.lightSig() : '') + (window.__gaVR && window.__gaVR.warms ? ' wm' + window.__gaVR.warms.length : ''); }
  R.lab = lab;
  function tick(t) { const n = performance.now(); if (R.last) R.f.push([Math.round(n - R.t0), Math.round(n - R.last), lab()]); R.last = n; if (!R.xr) requestAnimationFrame(tick); }
  requestAnimationFrame(tick); })();`;
// PROF=1: CDP sampling profile over the measured window; prints the top self-time functions (long frames dominate the sum)
async function profStart(page) { if (!process.env.PROF) return null; const c = await page.context().newCDPSession(page); await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 500 }); await c.send('Profiler.start'); return c; }
async function profStop(c, name) { if (!c) return; const { profile } = await c.send('Profiler.stop'); const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas || []; (profile.samples || []).forEach((id, i) => { const n = byId.get(id), cf = n.callFrame, k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1); self.set(k, (self.get(k) || 0) + (dt[i + 1] || 0)); });
  const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, us]) => k + ' ' + Math.round(us / 1000) + 'ms');
  console.log('PROF ' + name + '\n  ' + top.join('\n  ')); }
function summary(name, f) { const iv = f.map(x => x[1]), s = f.slice().sort((a, b) => b[1] - a[1]);
  const med = iv.slice().sort((a, b) => a - b)[Math.floor(iv.length / 2)];
  console.log('FREEZE ' + name + ' ' + JSON.stringify({ frames: f.length, median: med, max: s[0] && s[0][1], over250: iv.filter(v => v > 250).length, over500: iv.filter(v => v > 500).length, over1000: iv.filter(v => v > 1000).length, top: s.slice(0, 6) })); }
(async () => {
  if (which !== 'shop') {
    const { page, close } = await open({ start: true, cpu: CPU, w: 480, h: 270, init: { content: IWER_SRC + SETUP + REC } });
    const pc = await profStart(page);
    await page.waitForTimeout(45000); await profStop(pc, 'start');
    summary('start', await page.evaluate(() => window.__frz.f.filter(x => x[0] > 3000)));   // after the first 3 s of boot
    console.log('  state ' + JSON.stringify(await page.evaluate(() => ({ stream: window.__gaStream, pw: window.__gaVR && window.__gaVR.prewarm && { done: window.__gaVR.prewarm.done, ms: window.__gaVR.prewarm.ms, tex: window.__gaVR.prewarm.textures } }))));
    await close();
  }
  if (which !== 'start') {
    const { page, close } = await open({ cpu: CPU, w: 480, h: 270, init: { content: IWER_SRC + SETUP + REC } });
    const E = (f, a) => page.evaluate(f, a), until = (f, ms = 240000, arg) => page.waitForFunction(f, arg, { timeout: ms });
    await until(() => document.getElementById('vrBtn').classList.contains('on'), 60000);
    await until(() => { const S = window.__gaVR; return !S.prewarm || S.prewarm.done; });
    await page.click('#vrBtn'); await until(() => window.__gaVR.presenting && window.__gaVR.posed, 60000);
    await E(() => { const R = window.__frz, A = window.__arcade, r = A.renderer, o = r.render.bind(r); R.xr = true; R.f = []; R.last = 0;
      r.render = function (s, c) { if (r.xr.isPresenting && s === A.scene) { const n = performance.now(); if (R.last) R.f.push([Math.round(n - R.t0), Math.round(n - R.last), R.lab()]); R.last = n; } return o(s, c); }; });
    const place = (x, z, yaw) => E(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]);
    await place(0, 6, 0); await page.waitForTimeout(12000);   // settle in room 1 (shop evicted on the stream build)
    // walk to the pad over 4 s, then beam at real speed
    const P = await E(() => [window.__tp.PAD1.x, window.__tp.PAD1.z]);
    for (let i = 1; i <= 8; i++) { await place(P[0] * i / 8 + 0.3, 6 + (P[1] - 6) * i / 8 + 0.3, 0.8); await page.waitForTimeout(500); }
    await E(() => { window.__frz.mark = window.__frz.f.length; window.__tpTimeScale = 1; window.__tp.go(); });
    await until(() => window.__tp.where === 2 && window.__tp.state === 'idle');
    const beamF = await E(() => window.__frz.f.slice(window.__frz.mark));
    // walk from the shop pad up to Grok's counter and around, 20 s
    const g = await E(() => { const gk = window.__shop && window.__shop.grok, T = window.__arcade.THREE, p = gk.getWorldPosition(new T.Vector3()), h = window.__gaVR.head; return { gx: p.x, gz: p.z, hx: h.x, hz: h.z }; });
    await E(() => { window.__frz.mark = window.__frz.f.length; });
    const pc = await profStart(page);
    for (let i = 1; i <= 20; i++) { const k = Math.min(1, i / 10); await place(g.hx + (g.gx - 1.4 - g.hx) * k + (i > 10 ? Math.sin(i) : 0), g.hz + (g.gz - g.hz) * k + (i > 10 ? Math.cos(i) : 0), -Math.PI / 2); await page.waitForTimeout(1000); }
    const walkF = await E(() => window.__frz.f.slice(window.__frz.mark)); await profStop(pc, 'shopWalk');
    summary('beam', beamF); summary('shopWalk', walkF);
    console.log('  state ' + JSON.stringify(await E(() => ({ stream: window.__gaStream, where: window.__tp.where, shopUploads: window.__shop && window.__shop.gpu && window.__shop.gpu.stats ? { n: window.__shop.gpu.stats.ups, ms: +window.__shop.gpu.stats.upMs.toFixed(1), max: +window.__shop.gpu.stats.maxMs.toFixed(1), bitmaps: window.__shop.gpu.stats.bitmaps } : null }))));
    await close();
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
