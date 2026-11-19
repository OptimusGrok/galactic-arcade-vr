// diag: what the shop streams (name, size, source) and how long each re-upload takes (CPU throttled). node test/shop_stream_items.js
const { open } = require('./lib');
(async () => {
  const { page, close } = await open({ cpu: +(process.env.CPU || 4), w: 480, h: 270 });
  await page.waitForFunction(() => window.__arcade && window.__arcade.loadShop, null, { timeout: 90000 });
  await page.evaluate(() => { window.__gaStreamHold = 1e9; window.__arcade.loadShop(); });
  await page.waitForFunction(() => window.__shop && window.__shop.gpu, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(async () => { const g = window.__shop.gpu, R = window.__arcade.renderer;
    const desc = it => { const t = it.tex || {}, im = t.image || {}; return { n: it.name, k: it.kind, slot: it.slot, w: im.width || it.w, h: im.height || it.h, src: im.constructor ? im.constructor.name : typeof im }; };
    const out = { items: g.items.map(desc), on: g.on };
    g.set(true); while (g.queue.length) g.pump(99);
    g.set(false); for (let i = 0; i < 50 && g.stats && g.stats.bitmaps < 6; i++) await new Promise(r => setTimeout(r, 100)); g.set(true);
    if (g.stats) { out.bitmaps = g.stats.bitmaps;
      // orientation: the bitmap (flipped when decoded, flipY=false) must equal the <img> flipped (what WebGL's UNPACK_FLIP_Y did)
      const it = g.items.find(i => i.name === 'muralLeft'), b = it.bmp, im = new Image(); im.src = new URL('tex/shop_mural_left.jpg', location.href).href; await im.decode();
      const w = 64, h = 36, c1 = document.createElement('canvas'), c2 = document.createElement('canvas'); c1.width = c2.width = w; c1.height = c2.height = h;
      c1.getContext('2d').drawImage(b, 0, 0, w, h); const x2 = c2.getContext('2d'); x2.translate(0, h); x2.scale(1, -1); x2.drawImage(im, 0, 0, w, h);
      const d1 = c1.getContext('2d').getImageData(0, 0, w, h).data, d2 = x2.getImageData(0, 0, w, h).data; let diff = 0; for (let i = 0; i < d1.length; i++) diff += Math.abs(d1[i] - d2[i]);
      const c3 = document.createElement('canvas'); c3.width = w; c3.height = h; const x3 = c3.getContext('2d'); x3.drawImage(im, 0, 0, w, h); const d3 = x3.getImageData(0, 0, w, h).data; let same = 0; for (let i = 0; i < d1.length; i++) same += Math.abs(d1[i] - d3[i]);
      out.flipCheck = { vsFlipped: +(diff / d1.length).toFixed(2), vsUnflipped: +(same / d1.length).toFixed(2), texFlipY: it.tex.flipY, isBitmap: it.tex.image instanceof ImageBitmap }; }
    out.ups = []; while (g.queue.length) { const it = g.queue[0], t0 = performance.now(); g.pump(1); out.ups.push([it.name, +(performance.now() - t0).toFixed(1)]); }
    return out; });
  console.log(JSON.stringify(r, null, 0));
  await close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
