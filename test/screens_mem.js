// v22: memory / per-frame cost of the idle cabinet screens, in the emulated Quest 3 headset, standing in the arcade looking at the cabinets.
// Prints one JSON line (run against any tree with GA_ROOT to compare before / after).
const { openVR, H } = require('./vrlib');
(async () => {
  const { page, close } = await openVR();
  await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 30000 });
  await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
  await page.waitForTimeout(9000);   // demo iframes attach ~4 s after the start screen in the old build
  await page.evaluate(() => { const A = window.__arcade, c = A.strikeCab.userData, f = c.front || c.centre, n = c.inward || { x: 0, z: 1 };
    const S = window.__gaVR; S.rig = { x: f.x + n.x * 4, y: 0, z: f.z + n.z * 4, yaw: Math.atan2(n.x, n.z) }; S.applyRig(); });
  await H.frames(page, 30);
  const gc = async () => { try { const cdp = await page.context().newCDPSession(page); await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); } catch (e) {} };
  await gc();
  const r = await page.evaluate(async () => {
    const A = window.__arcade, gl = A.renderer ? A.renderer.info : null;
    // count canvas texture uploads (needsUpdate sets) over 120 frames
    let ups = 0; const T = window.THREE_TEX_PROTO;
    const cpu0 = A.stats.cpuAvg; const f0 = A.stats.frames;
    const texs = new Set(); A.scene && A.scene.traverse(o => { const m = o.material; const ms = Array.isArray(m) ? m : m ? [m] : []; for (const q of ms) { for (const k of ['map', 'emissiveMap']) if (q[k] && q[k].isCanvasTexture) texs.add(q[k]); if (q && q.uniforms && q.uniforms.map && q.uniforms.map.value && q.uniforms.map.value.isCanvasTexture) texs.add(q.uniforms.map.value); } }) ;
    const ver0 = new Map([...texs].map(t => [t, t.version]));
    await new Promise(res => { let n = 0; const tick = () => { if (++n >= 120) return res(); setTimeout(tick, 16); }; tick(); });
    for (const [t, v] of ver0) ups += t.version - v;
    const m = A.mem ? A.mem() : {};
    return { iframes: document.querySelectorAll('iframe').length, demoFrames: [A.demo.frames, A.ghostDemo.frames], heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      texMB: m.texMB || (m.texBytes ? +(m.texBytes / 1048576).toFixed(1) : null), glTextures: A.renderer.info.memory.textures, texN: m.texN, canvasTexUploads120f: ups, canvasMB: m.canvasMB, canvases: m.canvases, jsMB: m.jsMB, iframeSrc: (m.iframeSrc || []).map(x => String(x || '').replace(/^.*\/\/[^/]+\//, '')), calls: m.info && m.info.calls, frames: A.stats.frames - f0, cpuAvgMs: +A.stats.cpuAvg.toFixed(2) };
  });
  console.log('SCREENS_MEM ' + JSON.stringify(r));
  await close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
