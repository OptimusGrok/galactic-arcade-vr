// v22 (Dave t431u): Galactic Arcade VR memory in the emulated Quest 3 headset, one fresh session per scene:
// idle room 1, shop, Neon Knockout studio, seated at chess, playing a cabinet game (Strike), after the TALK Whisper model loaded.
// Prints one MEM line per scene (JS heap after a forced GC, renderer.info, estimated GPU texture / render-target MB, iframes) + top textures.
// node test/vr_mem.js [scene ...]   (WHISPER needs /workspace/.stt-fixtures/speech_q1.wav)
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
const WAV = '/workspace/.stt-fixtures/speech_q1.wav';
const ALL = ['room1', 'shop', 'nk', 'chess', 'play'];   // v23 removed TALK (still runnable by name on old builds)
const SETTLE = +(process.env.SETTLE || 9000);   // test-v1: let room streaming reach steady state (8 s hold) before measuring; same wait on old builds
const want = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
async function measure(page, scene) {
  try { const cdp = await page.context().newCDPSession(page); await cdp.send('HeapProfiler.enable'); for (let i = 0; i < 3; i++) await cdp.send('HeapProfiler.collectGarbage'); } catch (e) {}
  await H.frames(page, 20);
  const r = await page.evaluate(async () => {
    const A = window.__arcade, R = A.renderer, m = A.mem(), info = R.info;
    let uasm = null; try { if (performance.measureUserAgentSpecificMemory && window.crossOriginIsolated) uasm = +((await performance.measureUserAgentSpecificMemory()).bytes / 1e6).toFixed(1); } catch (e) {}
    const seen = new Set(), list = [];
    A.scene.traverse(o => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const q of ms) { const ts = []; for (const k in q) { const v = q[k]; if (v && v.isTexture) ts.push(v); } if (q.uniforms) for (const k in q.uniforms) { const v = q.uniforms[k] && q.uniforms[k].value; if (v && v.isTexture) ts.push(v); }
        for (const t of ts) { if (seen.has(t)) continue; seen.add(t); const im = t.image || {}; const w = im.width || 0, h = im.height || 0; if (!w) continue;
          list.push({ mb: +(w * h * 4 * (t.generateMipmaps ? 4 / 3 : 1) / 1e6).toFixed(2), wh: w + 'x' + h, name: (t.name || '') + '@' + (o.name || o.parent && o.parent.name || '?') + (im.src ? ':' + String(im.src).split('/').pop().slice(0, 40) : (im.getContext ? ':canvas' : '')) }); } } });
    list.sort((a, b) => b.mb - a.mb);
    const ifr = [...document.querySelectorAll('iframe')].map(f => (f.getAttribute('src') || '').split('?')[0]).filter(Boolean);
    return { jsHeapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null, uasmMB: uasm, textures: info.memory.textures, geometries: info.memory.geometries, programs: (info.programs || []).length,
      texMB: m.texMB, rtMB: m.rtMB, geoMB: m.geoMB, canvasMB: m.canvasMB, drawCalls: info.render.calls, iframes: ifr, top: list.slice(0, 8),
      musicMB: window.__music ? (window.__music.decodedMB != null ? window.__music.decodedMB : (window.__music.loaded ? 'loaded' : 0)) : null, stream: window.__gaStream ? { shop: window.__gaStream.shop, room2: window.__gaStream.room2 } : null,
      compRT: (() => { try { const c = A.renderer.xr.isPresenting; return c; } catch (e) { return null; } })() };
  });
  // whole-browser resident memory by Chromium process type (Whisper's worker, iframes and the GPU process are not in the page's JS heap)
  try { const out = require('child_process').execSync('ps -eo rss=,args= | grep -E "[c]hrom(e|ium).*--type=(renderer|gpu-process)"', { encoding: 'utf8' }); const rss = { renderer: 0, gpu: 0 };
    for (const l of out.trim().split('\n')) { const m = l.trim().match(/^(\d+)\s+(.*)$/); if (!m) continue; if (/--type=gpu-process/.test(m[2])) rss.gpu += +m[1]; else if (!/--extension-process/.test(m[2])) rss.renderer += +m[1]; }
    r.rssRendererMB = Math.round(rss.renderer / 1024); r.rssGpuMB = Math.round(rss.gpu / 1024); } catch (e) { r.rssErr = String(e.message).slice(0, 80); }
  console.log('MEM ' + scene + ' ' + JSON.stringify(r));
}
(async () => {
  for (const scene of want) {
    const args = scene === 'talk' ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + WAV] : [];
    const { page, close } = await openVR({ init: { content: IWER_SRC + SETUP + ';try{localStorage.setItem("neonarcade.tickets","40")}catch(e){}' }, args });
    const E = (f, a) => page.evaluate(f, a), until = (f, ms = 60000, arg) => page.waitForFunction(f, arg, { timeout: ms });
    const place = async (x, z, yaw) => { await E(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 6); };
    try {
      await until(() => document.getElementById('vrBtn').classList.contains('on'), 30000);
      await page.click('#vrBtn'); await until(() => window.__gaVR.presenting && window.__gaVR.posed, 30000);
      await until(() => window.__shop && window.__tp && window.__chessTable, 90000); await page.waitForTimeout(6000);
      if (scene === 'room1') { const c = await E(() => { const u = window.__arcade.strikeCab.userData, f = u.front, n = u.inward; return [f.x + n.x * 4, f.z + n.z * 4, Math.atan2(n.x, n.z)]; }); await place(...c); }
      if (scene === 'shop' || scene === 'talk') { await E(() => { window.__tpTimeScale = 3; window.__tp.go(); }); await until(() => window.__tp.where === 2 && window.__tp.state === 'idle', 120000); }
      if (scene === 'nk') { await E(() => { window.__tpTimeScale = 3; window.__tp.go('nk'); }); await until(() => window.__tp.where === 3 && window.__tp.state === 'idle', 120000); }
      if (scene === 'chess') {
        await E(() => { const S = window.__gaVR, C = window.__chessTable, x = C.CX - 2.4, z = C.CZ - 0.6; S.rig = { x, y: 0, z, yaw: 0.4 }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); if (window.__tp) window.__tp.where = 2; });
        await H.frames(page, 8); const tbl = await E(() => [window.__chessTable.CX - 0.3, 0.6, window.__chessTable.CZ]);
        await H.aim(page, 'right', [0.2, 1.3, -0.2], tbl); await H.frames(page, 3); await H.press(page, 'right', 'trigger');
        await until(() => window.__chessTable.state === 'wait' || window.__chessTable.state === 'play', 10000);
        for (let i = 0; i < 40; i++) { if (await E(() => { const C = window.__chessTable; try { return C.state === 'play' && !!C.frame.contentWindow.__chessVR && window.__gaVR.chess.draws > 2; } catch (e) { return false; } })) break; await H.press(page, 'right', 'a-button'); await H.frames(page, 20); }
        console.log('  chess: ' + JSON.stringify(await E(() => { const C = window.__chessTable; return { s: C.state, g: C.gstate, draws: window.__gaVR.chess.draws }; }))); }
      if (scene === 'play') {
        const sp = await E(() => { const A = window.__arcade, m = A.play.machines.strike, u = m.cab.userData, f = u.front, n = u.inward || { x: 0, z: 1 }, c = new A.THREE.Box3().setFromObject(m.cab).getCenter(new A.THREE.Vector3()); return { p: [f.x + n.x * 1.4, f.z + n.z * 1.4, Math.atan2(n.x, n.z)], c: [c.x, c.y, c.z] }; });
        await place(...sp.p); await H.aim(page, 'right', [0.2, 1.2, -0.2], sp.c); await H.frames(page, 4); await H.press(page, 'right', 'trigger');
        await until(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', 60000);
        await H.press(page, 'right', 'a-button'); await H.press(page, 'right', 'a-button'); await until(() => window.__arcade.play.sub === 'play', 20000); await page.waitForTimeout(4000); }
      if (scene === 'talk') {
        let cs = await E(() => window.__gaVR.signs().find(q => q.id === 'chatClerk').at); await place(cs[0], cs[2] + 3.5, 0); cs = await E(() => window.__gaVR.signs().find(q => q.id === 'chatClerk').at);
        await H.aim(page, 'right', [0.2, 1.3, -0.2], cs); await H.frames(page, 3); await H.press(page, 'right', 'trigger'); await H.frames(page, 4);
        const w = await E(() => window.__gaVR.ui.btnWorld('talk')); await H.aim(page, 'right', [0.2, 1.3, -0.2], w); await H.frames(page, 3); await H.press(page, 'right', 'trigger');
        const t0 = Date.now(); while (Date.now() - t0 < 300000) { if (await E(() => window.__grokChat.voiceAsks >= 1)) break; await H.frames(page, 4); }
        console.log('  talk: voiceAsks=' + (await E(() => window.__grokChat.voiceAsks)) + ' mode=' + (await E(() => window.__gaSTT.mode))); }
      await page.waitForTimeout(SETTLE);
      await measure(page, scene);
    } catch (e) { console.log('MEM ' + scene + ' ERROR ' + e.message.split('\n')[0]); }
    await close();
  }
  process.exit(0);
})();
