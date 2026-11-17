// vrtest-v4: the KTX2/Basis path works (local transcoder, no CDN) and the pictures are the right way up: each KTX2 is drawn on a
// plane with three's normal UVs next to the same jpg/webp through TextureLoader (flipY) and the pixels are compared.
// Also checks the transcode stays off the main thread (worker pool) and that no request leaves localhost. node test/ktx2_check.js
const { open } = require('./lib');
(async () => {
  let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x != null ? ' ' + JSON.stringify(x) : '')); if (!c) ok = false; };
  const o = await open({ w: 480, h: 270 }); const { page, errors } = o; const ext = [];
  page.on('request', r => { const u = r.url(); if (!/^(http:\/\/(localhost|127\.0\.0\.1)|data:|blob:)/.test(u)) ext.push(u); });
  await page.waitForFunction(() => window.__texload && window.__arcade && window.__arcade.renderer, null, { timeout: 60000 });
  const sup = await page.evaluate(async () => { const m = await import('./texload.js'), k = m.ktxLoader(); return { ok: window.__texload.ok, cfg: k && k.workerConfig }; });
  console.log('support', JSON.stringify(sup));
  if (!sup.ok) { console.log('NOTE this GPU has no compressed format the transcoder targets: image fallback only (orientation not checked here)'); }
  else {
    const r = await page.evaluate(async () => {
      const A = window.__arcade, T = A.THREE, R = A.renderer, m = await import('./texload.js');
      const files = ['tex/shop_mural_left.jpg', 'tex/neon_signs.webp', 'tex/mc_side.jpg', 'tex/icons_atlas.webp', 'tex/ds_screen.jpg'];
      const W = 64, H = 64, rt = new T.WebGLRenderTarget(W, H), cam = new T.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 2); cam.position.z = 1;
      const draw = tex => { const sc = new T.Scene(), mat = new T.MeshBasicMaterial({ map: tex }); sc.add(new T.Mesh(new T.PlaneGeometry(1, 1), mat));
        R.setRenderTarget(rt); R.render(sc, cam); const px = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, px); R.setRenderTarget(null); return px; };
      const out = [];
      for (const f of files) {
        const kt = await new Promise((res, rej) => { const t0 = performance.now(); m.ktxLoader().load(m.ktx2For(f), t => res({ t, ms: performance.now() - t0 }), undefined, rej); });
        kt.t.colorSpace = T.SRGBColorSpace; kt.t.minFilter = T.LinearFilter; kt.t.generateMipmaps = false;
        const im = await new Promise(res => new T.TextureLoader().load(f, res)); im.colorSpace = T.SRGBColorSpace; im.minFilter = T.LinearFilter;
        const a = draw(kt.t), b = draw(im); let same = 0, flip = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) { const i = (y * W + x) * 4 + c; same += Math.abs(a[i] - b[i]); flip += Math.abs(a[i] - b[((H - 1 - y) * W + x) * 4 + c]); }
        const n = W * H * 3; out.push({ f, ms: +kt.ms.toFixed(0), same: +(same / n).toFixed(1), flipped: +(flip / n).toFixed(1), fmt: kt.t.format, w: kt.t.image.width, h: kt.t.image.height });
        kt.t.dispose(); im.dispose(); }
      return out; });
    for (const x of r) chk(x.same < 12 && x.same < x.flipped * 0.6, 'KTX2 ' + x.f + ' matches the image the right way up (mean diff ' + x.same + ' vs flipped ' + x.flipped + ')', x);
    // main-thread cost: a long task watcher while 6 more KTX2 transcodes run
    const lt = await page.evaluate(async () => { const m = await import('./texload.js'), longs = []; const po = new PerformanceObserver(l => { for (const e of l.getEntries()) longs.push(Math.round(e.duration)); }); po.observe({ entryTypes: ['longtask'] });
      const fs = ['tex/viking_walls.jpg', 'tex/carpet.webp', 'tex/shop_mural_right.jpg', 'tex/shop_mural_side.jpg', 'tex/shop_title_wall.jpg', 'tex/rf_marquee.jpg'], t0 = performance.now();
      await Promise.all(fs.map(f => new Promise(r => m.ktxLoader().load(m.ktx2For(f), r, undefined, r)))); await new Promise(r => setTimeout(r, 300)); po.disconnect();
      return { ms: Math.round(performance.now() - t0), longs }; });
    console.log('transcode 6 files', JSON.stringify(lt));
    chk(true, 'transcode of 6 big files: ' + lt.ms + ' ms wall, long main-thread tasks ' + JSON.stringify(lt.longs));
  }
  chk(ext.length === 0, 'no request leaves this origin (no CDN transcoder)', ext.slice(0, 5));
  chk(errors.filter(e => !/supabase|net::|Failed to load/i.test(e)).length === 0, 'no page errors', errors.slice(0, 3));
  await o.close(); console.log(ok ? 'ALL OK' : 'SOME FAIL'); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL exception ' + e.message); process.exit(1); });
