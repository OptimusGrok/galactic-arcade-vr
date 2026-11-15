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
module.exports = { openVR, H };
