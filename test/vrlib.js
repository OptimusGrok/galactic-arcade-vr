// Galactic Arcade VR test helpers: an emulated Meta Quest 3 (IWER, test/vendor/iwer.min.js) injected before any app script.
const fs = require('fs'), path = require('path');
const { open } = require('./lib');
const IWER_SRC = fs.readFileSync(path.join(__dirname, 'vendor', 'iwer.min.js'), 'utf8');
const SETUP = `;(function(){ try { const d = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: true }); d.installRuntime({ forceInstall: true }); d.position.set(0, 1.6, 0); window.__xrd = d; window.__gavrNoModels = 1; } catch (e) { window.__xrdErr = String(e); } })();`;
async function openVR(opts = {}) { return open(Object.assign({ w: 480, h: 270, init: { content: IWER_SRC + SETUP } }, opts)); }
// controller / headset helpers (run in the page)
const H = {
  async frames(page, n = 3) { const f0 = await page.evaluate(() => window.__gaVR.frames); await page.waitForFunction(([f0, n]) => window.__gaVR.frames >= f0 + n, [f0, n], { timeout: 60000 }); },
  async btn(page, hand, id, v) { await page.evaluate(([hand, id, v]) => window.__xrd.controllers[hand].updateButtonValue(id, v), [hand, id, v]); },
  async axes(page, hand, x, y) { await page.evaluate(([hand, x, y]) => window.__xrd.controllers[hand].updateAxes('thumbstick', x, y), [hand, x, y]); },
  async press(page, hand, id, holdFrames = 3) { await H.btn(page, hand, id, 1); await H.frames(page, holdFrames); await H.btn(page, hand, id, 0); await H.frames(page, 3); },
  // point a controller (local XR coords relative to the rig) at a world-space target
  async aim(page, hand, local, target) { await page.evaluate(([hand, local, target]) => { const A = window.__arcade, T = A.THREE, S = window.__gaVR, r = S.rig;
      const c = Math.cos(r.yaw), s = Math.sin(r.yaw), wx = r.x + local[0] * c + local[2] * s, wz = r.z - local[0] * s + local[2] * c, wy = r.y + local[1];
      const m = new T.Matrix4().lookAt(new T.Vector3(wx, wy, wz), new T.Vector3(...target), new T.Vector3(0, 1, 0)), qw = new T.Quaternion().setFromRotationMatrix(m);
      const ql = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -r.yaw).multiply(qw);
      const C = window.__xrd.controllers[hand]; C.position.set(...local); C.quaternion.set(ql.x, ql.y, ql.z, ql.w); }, [hand, local, target]); },
};
// the emulated headset gets its OWN framebuffer like real hardware (t349u); __hsRead() = the pixels the headset shows
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
  window.__hsRead = (rx0 = 0, ry0 = 0, rx1 = 1, ry1 = 1) => { const L = window.__hsLayer; if (!L) return null; const gl = L.context, w = L.__w, h = L.__h, px = new Uint8Array(w * h * 4);
    const prev = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, L.__fb); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prev);
    const eye = [{ lit: 0, n: 0, sum: 0 }, { lit: 0, n: 0, sum: 0 }];
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const ex = (x % (w / 2)) / (w / 2), ey = 1 - y / h; if (ex < rx0 || ex > rx1 || ey < ry0 || ey > ry1) continue; const i = (y * w + x) * 4, l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2], e = eye[x < w / 2 ? 0 : 1]; e.n++; e.sum += l; if (l > 24) e.lit++; }
    const f = e => ({ lit: +(100 * e.lit / e.n).toFixed(1), mean: +(e.sum / e.n).toFixed(1) });
    return { w, h, status: window.__hsStatus, left: f(eye[0]), right: f(eye[1]) }; };
})();`;
module.exports = { openVR, H, IWER_SRC, SETUP, HEADSET_FB };
