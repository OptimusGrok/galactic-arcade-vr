// t869u / v11: wall pictures are Arcade's painted tex/icons/<key>.webp art (restored v9 swap).
// Canvas icons are the fallback until the webps load. The claw keeps its two-sided open/close
// mesh and the one-time 2048x256 upload. node test/vr_icons.js
const fs = require('fs');
const { open } = require('./lib');
const { openVR, H } = require('./vrlib');
let ok = true;
const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 400) : '')); if (!c) ok = false; };
const SHOT = '/workspace/shots/vr-v11-painted-cabinet-signs.png';
const WANT = ['strike', 'ghost', 'cyber', 'orc', 'pip', 'berserker', 'monkey', 'nova', 'blaster', 'bb', 'rockfall', 'skytower', 'roadster'];

function inspect() {
  const icons = window.__neonIcons, map = icons && icons.material && icons.material.map, img = map && map.image;
  const r = window.__gaVR && window.__gaVR.icons ? window.__gaVR.icons() : {};
  const keys = ((icons && icons.userData && icons.userData.icons) || []).map(i => i.key);
  let webpHits = 0;
  try { webpHits = performance.getEntriesByType('resource').filter(e => /tex\/icons\//.test(e.name)).length; } catch (e) {}
  const WALL = ['strike', 'ghost', 'cyber', 'orc', 'pip', 'berserker', 'monkey', 'nova', 'blaster', 'bb', 'rockfall', 'skytower', 'roadster'];
  let opaque = [];
  if (img && img.getContext && r.cell) {
    const g = img.getContext('2d'), C = r.cell;
    opaque = WALL.map(k => {
      const i = WALL.concat(['claw']).indexOf(k);
      const d = g.getImageData((i % 4) * C, Math.floor(i / 4) * C, C, C).data;
      let n = 0; for (let j = 3; j < d.length; j += 16) if (d[j] > 200) n++;
      return n / (d.length / 16);
    });
  }
  return {
    r, keys, name: icons && icons.name, k: icons && icons.material && icons.material.color ? +icons.material.color.r.toFixed(3) : 0,
    atlas: img ? img.width : 0, height: img ? img.height : 0, opaque,
    canvas: !!(img && typeof img.getContext === 'function'),
    webpHits, presenting: !!(window.__gaVR && window.__gaVR.presenting)
  };
}

(async () => {
  const o = await open({ w: 640, h: 360 });
  const page = o.page, errors = o.errors;
  await page.waitForFunction(() => window.__arcade && window.__neonIcons && window.__neonIcons.material && window.__neonIcons.material.map, null, { timeout: 120000 });
  await page.waitForFunction(() => window.__gaVR && window.__gaVR.icons && window.__gaVR.icons().done && window.__gaVR.icons().claw, null, { timeout: 20000 }).catch(() => {});
  const flat = await page.evaluate(inspect);
  chk(flat.name === 'neonIcons' && WANT.every(k => flat.keys.includes(k)), 'one icon mesh with all 13 wall pictures', { keys: flat.keys, name: flat.name });
  chk(flat.r.done && flat.r.loaded && flat.r.loaded.length === 13 && !(flat.r.failed && flat.r.failed.length) && flat.atlas === 1024 && flat.r.cell === 256,
    'painted tex/icons webps loaded into a 1024 px atlas (test-v1: 256 px cells, no mips)', { loaded: flat.r.loaded, failed: flat.r.failed, atlas: flat.atlas, cell: flat.r.cell });
  chk(flat.k >= 0.8, 'painted art is a bit brighter than the dim neon (x' + flat.k + ')', { k: flat.k });
  chk(flat.webpHits === 13, 'all 13 tex/icons/*.webp were requested', { webpHits: flat.webpHits });
  chk(flat.opaque.length === 13 && flat.opaque.every(v => v > 0.12), 'every picture cell has solid art in it (min ' + (flat.opaque.length ? Math.min(...flat.opaque).toFixed(2) : '-') + ')', flat.opaque);
  const claw = await page.evaluate(async () => {
    const c = window.__neonClawIcon; if (!c || !c.material || !c.material.map) return { ok: false };
    const t = c.material.map, img = t.image, v0 = t.version, o0 = t.offset.x;
    await new Promise(r => setTimeout(r, 2000));
    return { ok: true, name: c.name, w: img && img.width, h: img && img.height, v0, v1: t.version, o0, o1: t.offset.x };
  });
  chk(claw.ok && claw.name === 'neonClawIcon' && claw.w === 2048 && claw.h === 256, 'claw still uses a 2048x256 power-of-two texture', claw);
  chk(claw.o0 !== claw.o1 && claw.v1 === claw.v0, 'claw still animates by offset with no texture re-uploads', claw);
  chk(errors.length === 0, 'no page errors (flat)', errors.slice(0, 3));
  await o.close();

  const vr = await openVR({ w: 960, h: 540 });
  const vpage = vr.page, verrors = vr.errors;
  await vpage.waitForFunction(() => window.__gaVR && window.__gaVR.supported && document.getElementById('vrBtn') && document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
  await vpage.waitForFunction(() => window.__neonIcons && window.__neonIcons.material && window.__neonIcons.material.map, null, { timeout: 60000 });
  await vpage.evaluate(() => { try { window.__noRandomRoom = 1; } catch (e) {} });
  await vpage.click('#vrBtn');
  await vpage.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
  await vpage.waitForFunction(() => window.__gaVR.icons && window.__gaVR.icons().done && window.__gaVR.icons().claw, null, { timeout: 20000 }).catch(() => {});
  const inXr = await vpage.evaluate(inspect);
  chk(inXr.presenting && inXr.r.done && inXr.r.loaded.length === 13 && inXr.atlas === 1024 && inXr.k >= 0.8,
    'in VR the wall pictures are the painted 1024 px atlas (test-v1)', { loaded: inXr.r.loaded && inXr.r.loaded.length, atlas: inXr.atlas, k: inXr.k });
  chk(inXr.r.claw && inXr.r.clawTex === 2048, 'in VR the claw upload-once fix is still in place', inXr.r);
  await H.frames(vpage, 4);
  await vpage.evaluate(async () => { try { const s = window.__arcade.renderer.xr.getSession(); if (s) await s.end(); } catch (e) {} });
  await vpage.waitForFunction(() => !window.__gaVR.presenting, null, { timeout: 10000 }).catch(() => {});
  await vpage.evaluate(() => {
    const hide = id => { const el = document.getElementById(id); if (el) { el.style.display = 'none'; el.hidden = true; } };
    hide('start'); hide('gaCv'); hide('gaQlook'); hide('gaQsetup'); hide('vrBtn');
    document.body.classList.add('vr');
    try { window.__start = Object.assign(window.__start || {}, { shown: false, dismissed: true }); } catch (e) {}
    const icons = (window.__neonIcons && window.__neonIcons.userData && window.__neonIcons.userData.icons) || [];
    const target = icons.find(i => i.key === 'berserker') || icons[0]; if (!target) return;
    const p = target.pos, alongX = Math.abs(p[0]) < 11.5, inward = alongX ? -Math.sign(p[2] || 1) : -Math.sign(p[0] || 1);
    const x = alongX ? p[0] : p[0] + inward * 7, z = alongX ? p[2] + inward * 7 : p[2];
    if (window.__arcade && window.__arcade.monkey) window.__arcade.monkey.visible = false;
    window.__camOverride = { pos: [x, 3.4, z], at: [p[0], p[1] - 0.2, p[2]], showMonkey: false, bloom: 0.2 };
  });
  await vpage.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  if (!fs.existsSync(SHOT)) {
    await vpage.screenshot({ path: SHOT, type: 'png' });
    chk(fs.existsSync(SHOT) && fs.statSync(SHOT).size > 8000, 'wrote a new VR-edition painted-signs shot to ' + SHOT, { bytes: fs.existsSync(SHOT) ? fs.statSync(SHOT).size : 0 });
  } else {
    chk(true, 'left existing shot alone: ' + SHOT);
  }
  chk(verrors.length === 0, 'no page errors (VR)', verrors.slice(0, 3));
  await vr.close();
  console.log(ok ? 'ALL OK' : 'SOME FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL exception ' + e.message + '\n' + e.stack); process.exit(1); });
