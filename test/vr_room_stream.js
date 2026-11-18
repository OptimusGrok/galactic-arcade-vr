// VR test build (test-v1): room streaming in the emulated Quest 3 headset. The shop and room 2 textures are evicted when far, and
// v18's pre-warm + instant teleport keep working: walking onto the pad and beaming straight away (shop evicted until then) shows the
// shop's real murals on the very first frame after the cut, with no shaders compiled, no black frames and no long frame; jumping
// (ray-teleport) from the south of room 1 straight into room 2 compiles nothing either. CHECK=1 style asserts always on.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x != null ? ' ' + JSON.stringify(x) : '')); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB } });
  const E = (f, a) => page.evaluate(f, a), until = (f, ms = 60000, arg) => page.waitForFunction(f, arg, { timeout: ms });
  try {
    await until(() => document.getElementById('vrBtn').classList.contains('on'), 30000);
    await until(() => { const S = window.__gaVR; return !S.prewarm || S.prewarm.done; }, 180000);
    await E(() => { window.__gaStreamHold = 1500; });
    await E(() => { const r = window.__arcade.renderer, o = r.render.bind(r), A = window.__arcade;
      const real = n => { let m = null; A.scene.traverse(q => { if (q.name === n) m = q; }); const t = m && m.material && m.material.map; return !!t && t.name !== 'streamPlaceholder'; };
      const P = window.__xp = { iv: [], prog: [], lit: [], last: 0, cutAt: [], cutSnap: [], pend: 0, w0: null, mark: 0 };
      r.render = function (s, c) { if (!r.xr.isPresenting || s !== A.scene) return o(s, c); const t = performance.now(), n0 = r.info.programs.length;
        if (P.last) P.iv.push(+(t - P.last).toFixed(1)); P.last = t; o(s, c);
        try { const L = window.__hsLayer; if (L && L.__fb) { const gl = L.context, px = new Uint8Array(4), pr = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, L.__fb); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, pr); } } catch (e) {}
        P.prog.push(r.info.programs.length - n0);
        const w = window.__tp ? window.__tp.where : 0; if (P.w0 !== null && w !== P.w0) { P.cutAt.push(P.iv.length); P.pend = 6; P.cutSnap.push({ where: w, shop: window.__gaStream.shop, mural: real('muralLeft'), shelf: real('shelfBoxes'), title: real('muralTitle') }); } P.w0 = w;
        if (P.pend > 0) { P.pend--; try { const h = window.__hsRead(); P.lit.push([P.cutAt.length, h ? h.left.lit : -1]); } catch (e) {} } }; });
    await page.click('#vrBtn'); await until(() => window.__gaVR.presenting && window.__gaVR.posed, 30000);
    await until(() => window.__shop && window.__tp, 90000);
    const place = async (x, z, yaw = 0) => { await E(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 4); };
    await place(0, 6, 0);
    await until(() => window.__gaStream.shop === 'off' && window.__gaStream.room2 === 'off', 60000);
    chk(true, 'at spawn in the headset, shop + room 2 textures are evicted', await E(() => window.__gaStream));
    const win = () => E(() => { const P = window.__xp, c = P.cutAt[P.cutAt.length - 1], w = P.iv.slice(Math.max(P.mark, c - 2), c + 30), all = P.iv.slice(P.mark);
      return { maxAtCut: Math.max(...w), maxWhole: Math.max(...all), progsAfterCut: P.prog.slice(c - 1, c + 30).reduce((a, b) => a + b, 0), progsWhole: P.prog.slice(P.mark).reduce((a, b) => a + b, 0),
        lit: P.lit.filter(x => x[0] === P.cutAt.length).map(x => x[1]), snap: P.cutSnap[P.cutSnap.length - 1] }; });
    // 1) step onto the pad and beam at once: the shop was evicted until this moment
    await E(() => { const P = window.__tp.PAD1, S = window.__gaVR; S.rig = { x: P.x + 0.3, y: 0, z: P.z + 0.3, yaw: 0.8 }; S.applyRig(); window.__arcade.monkey.position.set(P.x + 0.3, 0, P.z + 0.3);
      window.__xp.mark = window.__xp.iv.length; window.__tpTimeScale = 3; window.__tp.go(); });
    await until(() => window.__tp.where === 2 && window.__tp.state === 'idle', 120000); await H.frames(page, 30);
    let b = await win(); console.log('BEAM shop ' + JSON.stringify(b));
    chk(b.snap && b.snap.shop === 'on' && b.snap.mural && b.snap.shelf && b.snap.title, 'beam to shop from an evicted state: real murals / shelves are on the GPU at the cut (pre-warmed before arrival)', b.snap);
    chk(b.progsWhole === 0, 'beam to shop: no shaders compiled during the whole beam', b.progsWhole);
    chk(b.lit.length >= 3 && b.lit.every(l => l > 5), 'beam to shop: headset shows the room on every frame after the cut (no black frames)', b.lit);
    chk(b.maxAtCut < 600, 'beam to shop: no freeze at the cut (longest ' + b.maxAtCut + ' ms)');
    // 2) back to the arcade, walk away, wait for the eviction, then come back and beam to Neon Knockout and back
    await E(() => { window.__xp.mark = window.__xp.iv.length; window.__tp.go(); }); await until(() => window.__tp.where === 1 && window.__tp.state === 'idle', 120000); await H.frames(page, 30);
    b = await win(); console.log('BEAM arcade ' + JSON.stringify(b));
    chk(b.progsWhole === 0 && b.lit.every(l => l > 5) && b.maxAtCut < 600, 'beam back to the arcade: no compiles, no black, no freeze', b);
    await place(0, 6, 0); await until(() => window.__gaStream.shop === 'off', 30000);
    { const g = await E(() => window.__gaStream); chk(g.shop === 'on' && g.room2 === 'on', 'v8: in the headset the shop + room 2 textures stay resident after walking away (no re-upload at the next beam)', g); }
    await E(() => { const P = window.__tp.PAD1, S = window.__gaVR; S.rig = { x: P.x + 0.3, y: 0, z: P.z + 0.3, yaw: 0.8 }; S.applyRig(); window.__arcade.monkey.position.set(P.x + 0.3, 0, P.z + 0.3);
      window.__xp.mark = window.__xp.iv.length; window.__tp.go('nk'); });
    await until(() => window.__tp.where === 3 && window.__tp.state === 'idle', 120000); await H.frames(page, 30);
    b = await win(); console.log('BEAM nk ' + JSON.stringify(b));
    chk(b.progsWhole === 0 && b.lit.every(l => l > 5) && b.maxAtCut < 600, 'beam to Neon Knockout: no compiles, no black, no freeze', b);
    await E(() => { window.__xp.mark = window.__xp.iv.length; window.__tp.go(); }); await until(() => window.__tp.where === 1 && window.__tp.state === 'idle', 120000); await H.frames(page, 30);
    b = await win(); console.log('BEAM arcade2 ' + JSON.stringify(b));
    chk(b.progsWhole === 0 && b.lit.every(l => l > 5) && b.maxAtCut < 600, 'beam back from Neon Knockout: no compiles, no black, no freeze', b);
    // 3) room 2: evicted from the south of room 1, then a single jump (like a ray teleport) into room 2
    await place(0, 8, 0); await until(() => window.__gaStream.room2 === 'off', 30000);
    const z2 = await E(() => window.__arcade.Z2);
    await E(() => { window.__xp.mark = window.__xp.iv.length; });
    await place(0, z2 + 3, Math.PI); await H.frames(page, 40);
    const r2 = await E(() => { const P = window.__xp, iv = P.iv.slice(P.mark), h = window.__hsRead(); return { progs: P.prog.slice(P.mark).reduce((a, b) => a + b, 0), maxIv: Math.max(...iv), lit: h ? h.left.lit : -1, stream: window.__gaStream.room2,
      ds: (() => { const s = window.__arcade.dsCab.getObjectByName('screen'), m = s && s.material && s.material.map; return !!m && m.name !== 'streamPlaceholder'; })() }; });
    console.log('ROOM2 ' + JSON.stringify(r2));
    chk(r2.stream === 'on' && r2.ds, 'jump into room 2: Dead Signal art streamed back in', r2);
    chk(r2.progs === 0, 'jump into room 2: no shaders compiled', r2.progs);
    chk(r2.maxIv < 600 && r2.lit > 5, 'jump into room 2: no freeze, headset shows the room (longest ' + r2.maxIv + ' ms, lit ' + r2.lit + '%)');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 600)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
