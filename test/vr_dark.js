// t349u: Dave's real Quest showed a pitch-black room after ENTER VR, yet the emulator passed.
// Why the emulator missed it: IWER's XRWebGLLayer.framebuffer is null (= the page canvas), so drawing to the page canvas
// "worked". On a real Quest the headset image is its OWN framebuffer; anything drawn to the page canvas is never seen.
// This test gives the emulated headset its own framebuffer like real hardware, then reads the pixels the HEADSET shows:
// at entry, looking around, after a few seconds, and after walking. Plus: every VR room draw targets the XR framebuffer,
// and the VR fill light is on in VR and off after.
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
const HEADSET_FB = `;(function(){ const P = XRWebGLLayer.prototype, d = Object.getOwnPropertyDescriptor(P, 'framebuffer');
  Object.defineProperty(P, 'framebuffer', { configurable: true, get() {
    if (!this.__fb) { const gl = this.context, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, prev = gl.getParameter(gl.FRAMEBUFFER_BINDING), prb = gl.getParameter(gl.RENDERBUFFER_BINDING);
      const fb = gl.createFramebuffer(), c = gl.createRenderbuffer(), z = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, c); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
      gl.bindRenderbuffer(gl.RENDERBUFFER, z); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, z);
      window.__hsStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE ? 'complete' : 'incomplete';
      gl.bindFramebuffer(gl.FRAMEBUFFER, prev); gl.bindRenderbuffer(gl.RENDERBUFFER, prb); this.__fb = fb; this.__w = w; this.__h = h; window.__hsLayer = this; }
    return this.__fb; } });
  // what the headset shows: % of pixels that are not near-black, mean brightness, per eye
  window.__hsRead = () => { const L = window.__hsLayer; if (!L) return null; const gl = L.context, w = L.__w, h = L.__h, px = new Uint8Array(w * h * 4);
    const prev = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, L.__fb); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prev);
    const eye = [{ lit: 0, n: 0, sum: 0 }, { lit: 0, n: 0, sum: 0 }];
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const i = (y * w + x) * 4, l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2], e = eye[x < w / 2 ? 0 : 1]; e.n++; e.sum += l; if (l > 24) e.lit++; }
    const f = e => ({ lit: +(100 * e.lit / e.n).toFixed(1), mean: +(e.sum / e.n).toFixed(1) });
    return { w, h, status: window.__hsStatus, left: f(eye[0]), right: f(eye[1]) }; };
})();`;
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP + HEADSET_FB } });
  const seen = (r, tag) => { const good = r && r.left.lit > 15 && r.right.lit > 15 && r.left.mean > 8 && r.right.mean > 8;
    chk(good, tag + ' headset not black ' + JSON.stringify(r)); return good; };
  const look = async yawDeg => { await page.evaluate(a => { const q = window.__xrd.quaternion, h = a / 2; q.set(0, Math.sin(h), 0, Math.cos(h)); }, yawDeg * Math.PI / 180); await H.frames(page, 4); };
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await H.frames(page, 8);
    chk(await page.evaluate(() => window.__hsStatus === 'complete' && !!window.__hsLayer), 'emulated headset has its own framebuffer (like a real Quest)');
    seen(await page.evaluate(() => window.__hsRead()), 'at entry:');
    for (const a of [90, 180, 270, 0]) seen((await look(a), await page.evaluate(() => window.__hsRead())), 'looking ' + a + ' deg:');
    await page.waitForTimeout(3000); await H.frames(page, 6);
    seen(await page.evaluate(() => window.__hsRead()), 'after 3 s:');
    await H.axes(page, 'left', 0, -1); await page.waitForTimeout(700); await H.axes(page, 'left', 0, 0); await H.frames(page, 4);
    seen(await page.evaluate(() => window.__hsRead()), 'after walking:');
    const p = await page.evaluate(() => ({ rt: window.__gaVR.rt, fill: !!(window.__gaVR.fill && window.__gaVR.fill.visible) }));
    chk(p.rt && p.rt.xr > 20 && p.rt.bad === 0, 'every VR room draw went into the XR framebuffer ' + JSON.stringify(p.rt));
    chk(p.fill, 'VR fill light is on in VR');
    await page.evaluate(() => window.__gaVR.exit()); await page.waitForFunction(() => !window.__gaVR.presenting, null, { timeout: 20000 });
    chk(await page.evaluate(() => !window.__gaVR.fill.visible), 'fill light off after leaving VR');
  } catch (e) { chk(false, 'exception ' + e); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
