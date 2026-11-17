// vrtest-v5 (Dave t458u: "in the shop the game is still freezing when walking close to Grok's shop counter and walking toward the
// mini golf"): emulated Quest 3 with the CPU throttled (CPU=4 default), beam to the shop, let it settle, then two slow walks:
//   grok = shop pad -> Grok's counter,  golf = counter -> along the back wall to the top of the mini golf stairs (not down).
// Every XR frame records [t, ms, programs, textures, geometries, draw calls]; a long frame is printed with what changed in it
// (+N programs = shader compiles, +N textures = first uploads, +N geometries = first buffer uploads). PROF=1 adds a CPU profile per walk.
// Prints WALK <name> {frames, median, max, over100, over250, top:[[t, ms, '+prog +tex +geo']]}.  Works on old builds (GA_ROOT=...).
// node test/vr_shop_walk.js [grok|golf]     CHECK=1: fail on shader compiles / warm-ups / first uploads in a long frame during a walk; REPEAT=1 walks twice; DIAG=1 lists new programs
const { open } = require('./lib');
const { IWER_SRC, SETUP } = require('./vrlib');
const CPU = +(process.env.CPU || 4), MAXMS = +(process.env.MAXMS || 250), which = process.argv.slice(2);
async function profStart(page) { if (!process.env.PROF) return null; const c = await page.context().newCDPSession(page); await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', { interval: 500 }); await c.send('Profiler.start'); return c; }
async function profStop(c, name) { if (!c) return; const { profile } = await c.send('Profiler.stop'); const self = new Map(), byId = new Map(profile.nodes.map(n => [n.id, n]));
  const dt = profile.timeDeltas || []; (profile.samples || []).forEach((id, i) => { const n = byId.get(id), cf = n.callFrame, k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1); self.set(k, (self.get(k) || 0) + (dt[i + 1] || 0)); });
  const par = new Map(); for (const n of profile.nodes) for (const c of (n.children || [])) par.set(c, n.id);
  const callers = new Map(); (profile.samples || []).forEach((id, i) => { const n = byId.get(id); if (!n || !/^(getParameter|getProgramParameter|readPixels|getError|clientWaitSync|finish)$/.test(n.callFrame.functionName)) return; const ch = []; let q = par.get(id);
    for (let d = 0; d < 6 && q != null; d++) { const m = byId.get(q), cf = m.callFrame; ch.push((cf.functionName || '(anon)') + ':' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1) + ':' + (cf.columnNumber + 1)); q = par.get(q); }
    const k = n.callFrame.functionName + ' <- ' + ch.join(' <- '); callers.set(k, (callers.get(k) || 0) + (dt[i + 1] || 0)); });
  console.log('SYNC ' + name + '\n  ' + [...callers].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, us]) => Math.round(us / 1000) + 'ms ' + k).join('\n  '));
  console.log('PROF ' + name + '\n  ' + [...self].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, us]) => k + ' ' + Math.round(us / 1000) + 'ms').join('\n  ')); }
(async () => {
  let ok = true;
  const { page, close, errors } = await open({ cpu: CPU, w: 480, h: 270, init: { content: IWER_SRC + SETUP } });
  const E = (f, a) => page.evaluate(f, a), until = (f, ms = 240000) => page.waitForFunction(f, null, { timeout: ms });
  await until(() => document.getElementById('vrBtn').classList.contains('on'), 90000);
  await until(() => { const S = window.__gaVR; return !S.prewarm || S.prewarm.done; });
  await page.click('#vrBtn'); await until(() => window.__gaVR.presenting && window.__gaVR.posed, 60000);
  await E(() => { const A = window.__arcade, r = A.renderer, o = r.render.bind(r), R = window.__walk = { f: [], last: 0, t0: performance.now(), on: false };
    r.render = function (s, c) { const out = o(s, c); if (r.xr.isPresenting && s === A.scene && R.on) { const n = performance.now(), i = r.info;
        if (R.last) R.f.push([Math.round(n - R.t0), Math.round(n - R.last), i.programs ? i.programs.length : 0, i.memory.textures, i.memory.geometries, i.render.calls, ((window.__gaVR && window.__gaVR.warms) || []).length, (window.__gaStream && window.__gaStream.ups) || 0]); R.last = n;
        const np = i.programs ? i.programs.length : 0; if (R.pn != null && np !== R.pn) { const ids = new Set(i.programs.map(q => q.id)), prev = R.pids || new Set(), add = i.programs.filter(q => !prev.has(q.id)), gone = [...prev].filter(id => !ids.has(id));
          const names = {}; for (const q of add) { const k = q.name + (q.cacheKey && /,true,|clipping/i.test(q.cacheKey) ? '' : ''); names[k] = (names[k] || 0) + 1; }
          (R.pl = R.pl || []).push({ t: Math.round(n - R.t0), add: add.length, gone: gone.length, names: Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 12), key0: add[0] && add[0].cacheKey && add[0].cacheKey.slice(0, 400) }); }
        if (R.pn == null || np !== R.pn) R.pids = new Set((i.programs || []).map(q => q.id)); R.pn = np; } return out; }; });
  const place = (x, z, yaw) => E(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]);
  await E(() => { window.__tpTimeScale = 3; window.__tp.go(); }); await until(() => window.__tp.where === 2 && window.__tp.state === 'idle');
  await page.waitForTimeout(8000);   // the shop has streamed in and pre-warm is done; the walks start from a steady state
  const G = await E(() => { const gk = window.__shop.grok, T = window.__arcade.THREE, p = gk.getWorldPosition(new T.Vector3()), h = window.__gaVR.head, g = window.__minigolf;
    return { gx: p.x, gz: p.z, hx: h.x, hz: h.z, X0: g.X0, Z0: g.Z0, Z1: g.Z1 }; });
  console.log('  geo ' + JSON.stringify(G));
  console.log('  prewarm ' + JSON.stringify(await E(() => { const P = window.__gaVR.prewarm; return P && { done: P.done, ms: P.ms, err: P.err, areas: P.areas }; })));
  const walk = async (name, pts, yaw) => {
    if (which.length && !which.includes(name.replace(/2$/, ''))) return;
    await place(pts[0][0], pts[0][1], yaw); await page.waitForTimeout(1500);
    await E(() => { const R = window.__walk; R.f = []; R.last = 0; R.on = true; }); const pc = await profStart(page);
    for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i]; for (let k = 1; k <= 8; k++) { await place(ax + (bx - ax) * k / 8, az + (bz - az) * k / 8, yaw); await page.waitForTimeout(150); } }
    await page.waitForTimeout(2500);
    const f = await E(() => { window.__walk.on = false; return window.__walk.f; }); await profStop(pc, name);
    if (process.env.DIAG) console.log('WARMS ' + name + ' ' + JSON.stringify(await E(() => (window.__gaVR.warms || []).slice(-6))));
    if (process.env.DIAG) console.log('PROGS ' + name + ' ' + JSON.stringify(await E(() => { const R = window.__walk, pl = R.pl || []; R.pl = []; return pl; })));
    const iv = f.map(x => x[1]), med = iv.slice().sort((a, b) => a - b)[Math.floor(iv.length / 2)];
    const lab = f.map((x, j) => { const p = f[j - 1] || x; return [x[0], x[1], (x[2] - p[2] ? '+' + (x[2] - p[2]) + 'prog ' : '') + (x[3] - p[3] ? (x[3] > p[3] ? '+' : '') + (x[3] - p[3]) + 'tex ' : '') + (x[4] - p[4] ? (x[4] > p[4] ? '+' : '') + (x[4] - p[4]) + 'geo ' : '') + (x[6] - p[6] ? 'WARM ' : '') + (x[7] - p[7] ? '+' + (x[7] - p[7]) + 'up ' : '') + 'c' + x[5]]; });
    const top = lab.slice().sort((a, b) => b[1] - a[1]).slice(0, 8), max = top[0] ? top[0][1] : 0;
    console.log('WALK ' + name + ' ' + JSON.stringify({ frames: f.length, median: med, max, over100: iv.filter(v => v > 100).length, over250: iv.filter(v => v > 250).length, progs: f.length ? f[f.length - 1][2] - f[0][2] : 0, top }));
    // CHECK: no shader compiles / warm-ups / first texture or geometry uploads during the walk (what freezes a Quest). The emulator's other long
    // frames are GPU time inside IWER's onDeviceFrame (a sync getParameter waiting on SwiftShader), not page work, so they are only printed.
    if (process.env.CHECK) { const progs = f.length ? f[f.length - 1][2] - f[0][2] : 0, warms = f.length ? f[f.length - 1][6] - f[0][6] : 0, bad = lab.filter(x => /prog|WARM|\+\d+tex|\+\d+geo/.test(x[2]) && x[1] > 100);
      const c = progs === 0 && warms === 0 && !bad.length; console.log((c ? 'PASS ' : 'FAIL ') + name + ' walk: no shader compiles / warm-ups / first uploads in a long frame (programs +' + progs + ', warms +' + warms + ', ' + JSON.stringify(bad.slice(0, 3)) + '), longest frame ' + max + ' ms'); if (!c) ok = false; }
  };
  // shop pad -> Grok's counter (stop 1.4 m in front of him)
  await walk('grok', [[G.hx, G.hz], [(G.hx + G.gx - 1.4) / 2, (G.hz + G.gz) / 2], [G.gx - 1.4, G.gz]], -Math.PI / 2);
  // counter -> along the back wall to the top of the golf stairs (stairs run +x from X0 between Z0..Z1); stop just before the first step
  const zm = (G.Z0 + G.Z1) / 2;
  await walk('golf', [[G.gx - 1.4, G.gz], [G.X0 - 2.5, zm + 1.5], [G.X0 - 0.6, zm]], Math.PI / 2 + Math.PI);
  if (process.env.REPEAT) { console.log('  --- second pass (same session) ---');
  // shop pad -> Grok's counter (stop 1.4 m in front of him)
  await walk('grok2', [[G.hx, G.hz], [(G.hx + G.gx - 1.4) / 2, (G.hz + G.gz) / 2], [G.gx - 1.4, G.gz]], -Math.PI / 2);
  // counter -> along the back wall to the top of the golf stairs (stairs run +x from X0 between Z0..Z1); stop just before the first step
  const zm2 = (G.Z0 + G.Z1) / 2;
  await walk('golf2', [[G.gx - 1.4, G.gz], [G.X0 - 2.5, zm2 + 1.5], [G.X0 - 0.6, zm2]], Math.PI / 2 + Math.PI);
  }
  console.log('  state ' + JSON.stringify(await E(() => ({ where: window.__tp.where, golfBelow: window.__minigolf.below, ktx: window.__ktxStats || null, stream: window.__gaStream && { shop: window.__gaStream.shop, room2: window.__gaStream.room2 } }))));
  if (process.env.CHECK) { const c = errors.length === 0; console.log((c ? 'PASS' : 'FAIL') + ' no page errors ' + errors.slice(0, 3).join('|')); if (!c) ok = false; console.log(ok ? 'ALL PASS' : 'SOME FAILED'); }
  await close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL exception ' + e.message); process.exit(1); });
