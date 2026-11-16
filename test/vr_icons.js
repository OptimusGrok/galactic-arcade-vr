// t866u / v10: wall pictures above the cabinets are the shared neonsigns.js canvas icons
// (same art as the 2D arcade), not the painted tex/icons/*.webp swap. The claw keeps its
// two-sided open/close mesh and the one-time 2048x256 upload. node test/vr_icons.js
const fs = require('fs');
const { open } = require('./lib');
const { openVR, H } = require('./vrlib');
let ok = true;
const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 400) : '')); if (!c) ok = false; };
const SHOT = '/workspace/shots/vr-v10-cabinet-signs.png';
const WANT = ['strike', 'ghost', 'cyber', 'orc', 'pip', 'berserker', 'monkey', 'nova', 'blaster', 'bb', 'rockfall', 'skytower', 'roadster'];

function inspect() {
  const icons = window.__neonIcons, map = icons && icons.material && icons.material.map, img = map && map.image;
  const r = window.__gaVR && window.__gaVR.icons ? window.__gaVR.icons() : {};
  const keys = ((icons && icons.userData && icons.userData.icons) || []).map(i => i.key);
  let webpHits = 0;
  try { webpHits = performance.getEntriesByType('resource').filter(e => /tex\/icons\//.test(e.name)).length; } catch (e) {}
  return {
    r, keys, name: icons && icons.name, k: icons && icons.material && icons.material.color ? +icons.material.color.r.toFixed(3) : 0,
    atlas: img ? img.width : 0, height: img ? img.height : 0,
    canvas: !!(img && typeof img.getContext === 'function'),
    src: img && img.src ? String(img.src).slice(0, 180) : '',
    webpHits, presenting: !!(window.__gaVR && window.__gaVR.presenting)
  };
}

(async () => {
  // ---- flat page ----
  const o = await open({ w: 640, h: 360 });
  const page = o.page, errors = o.errors;
  await page.waitForFunction(() => window.__arcade && window.__neonIcons && window.__neonIcons.material && window.__neonIcons.material.map && window.__neonIcons.material.map.image, null, { timeout: 120000 });
  await page.waitForFunction(() => window.__gaVR && window.__gaVR.icons && window.__gaVR.icons().claw, null, { timeout: 20000 }).catch(() => {});
  const flat = await page.evaluate(inspect);
  chk(flat.name === 'neonIcons' && WANT.every(k => flat.keys.includes(k)), 'one shared icon mesh with all 13 wall pictures', { keys: flat.keys, name: flat.name });
  chk(flat.r.source === 'neonsigns' && flat.r.swapped === false && flat.r.canvas && !flat.r.webp, 'vr.js reports the shared neonsigns atlas, not a webp swap', flat.r);
  chk(flat.canvas && flat.atlas === 1024 && flat.r.cell === 256, 'icon texture is the 1024 px (4x256) canvas atlas from neonsigns.js', { atlas: flat.atlas, cell: flat.r.cell, canvas: flat.canvas });
  chk(flat.k > 0.4 && flat.k <= 0.65, 'dim glow is unchanged (colour x' + flat.k + ', expect ~0.55)', { k: flat.k });
  chk(flat.webpHits === 0, 'tex/icons/*.webp were never requested', { webpHits: flat.webpHits, src: flat.src });
  const claw = await page.evaluate(async () => {
    const c = window.__neonClawIcon; if (!c || !c.material || !c.material.map) return { ok: false };
    const t = c.material.map, img = t.image, v0 = t.version, o0 = t.offset.x;
    await new Promise(r => setTimeout(r, 2000));
    return {
      ok: true, name: c.name, w: img && img.width, h: img && img.height,
      v0, v1: t.version, o0, o1: t.offset.x, parent: c.parent && c.parent.name
    };
  });
  chk(claw.ok && claw.name === 'neonClawIcon' && claw.w === 2048 && claw.h === 256, 'claw still uses a 2048x256 power-of-two texture', claw);
  chk(claw.o0 !== claw.o1 && claw.v1 === claw.v0, 'claw still animates by offset with no texture re-uploads', claw);
  chk(errors.length === 0, 'no page errors (flat)', errors.slice(0, 3));
  await o.close();

  // ---- XR session: the same shared atlas, plus a VR-mode shot of the signs ----
  const vr = await openVR({ w: 960, h: 540 });
  const vpage = vr.page, verrors = vr.errors;
  await vpage.waitForFunction(() => window.__gaVR && window.__gaVR.supported && document.getElementById('vrBtn') && document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
  await vpage.waitForFunction(() => window.__neonIcons && window.__neonIcons.material && window.__neonIcons.material.map, null, { timeout: 60000 });
  await vpage.evaluate(() => { try { window.__noRandomRoom = 1; } catch (e) {} });
  await vpage.click('#vrBtn');
  await vpage.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
  await vpage.waitForFunction(() => window.__gaVR.icons && window.__gaVR.icons().claw, null, { timeout: 20000 }).catch(() => {});
  const inXr = await vpage.evaluate(inspect);
  chk(inXr.presenting && inXr.r.source === 'neonsigns' && inXr.r.swapped === false && inXr.canvas && inXr.atlas === 1024 && inXr.webpHits === 0,
    'in VR the wall pictures are still the shared canvas atlas (no webp swap)', inXr);
  chk(inXr.k > 0.4 && inXr.k <= 0.65, 'in VR the dim glow is unchanged (x' + inXr.k + ')', { k: inXr.k });
  chk(inXr.r.claw && inXr.r.clawTex === 2048, 'in VR the claw upload-once fix is still in place', inXr.r);

  const aimed = await vpage.evaluate(() => {
    const icons = (window.__neonIcons && window.__neonIcons.userData && window.__neonIcons.userData.icons) || [];
    const target = icons.find(i => i.key === 'berserker') || icons.find(i => i.key === 'strike') || icons[0];
    if (!target) return { ok: false };
    const p = target.pos, alongX = Math.abs(p[0]) < 11.5, inward = alongX ? -Math.sign(p[2] || 1) : -Math.sign(p[0] || 1);
    const x = alongX ? p[0] : p[0] + inward * 8, z = alongX ? p[2] + inward * 8 : p[2];
    // yaw 0 looks toward -Z; atan2(stand-target x, stand-target z) matches that convention
    const yaw = Math.atan2(x - p[0], z - p[2]);
    const S = window.__gaVR, A = window.__arcade;
    S.rig = { x, y: 0, z, yaw }; S.applyRig();
    A.monkey.position.set(x, 0, z);
    if (window.__xrd) window.__xrd.position.set(0, 1.6, 0);
    return { ok: true, key: target.key, pos: p, stand: [x, z], yaw };
  });
  chk(aimed.ok, 'aimed the headset at a cabinet picture (' + (aimed.key || '?') + ')', aimed);
  await H.frames(vpage, 8);
  // The headset draws into the XR framebuffer, so the page canvas can be dark. End the session
  // and take a camera look at the same wall of signs in this VR-edition build.
  await vpage.evaluate(async () => { try { const s = window.__arcade.renderer.xr.getSession(); if (s) await s.end(); } catch (e) {} });
  await vpage.waitForFunction(() => !window.__gaVR.presenting, null, { timeout: 10000 }).catch(() => {});
  await vpage.evaluate(() => {
    // Hide the start-screen player preview and HUD so the shot is of the wall pictures.
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
  // This file is this turn's deliverable; replace it if a previous attempt in this run was too dark.
  await vpage.screenshot({ path: SHOT, type: 'png' });
  chk(fs.existsSync(SHOT) && fs.statSync(SHOT).size > 8000, 'wrote a VR-edition shot of the signs to ' + SHOT, { bytes: fs.existsSync(SHOT) ? fs.statSync(SHOT).size : 0 });
  chk(verrors.length === 0, 'no page errors (VR)', verrors.slice(0, 3));
  await vr.close();
  console.log(ok ? 'ALL OK' : 'SOME FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL exception ' + e.message + '\n' + e.stack); process.exit(1); });
