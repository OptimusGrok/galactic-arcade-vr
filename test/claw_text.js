// v12 (t376u): the writing on the CLAW MACHINE fits. The cabinet marquee ("CLAW MACHINE") and price plate ("1 TICKET") shrink their font until
// glyphs + glow sit inside the plate with a margin (also for a much wider fallback font, like the Quest's), drawn undistorted on the plate;
// the floating neon "CLAW MACHINE" name on top is about cabinet-wide (<= 1.9 m) and on its own mesh drawn after the wall pictures (no longer
// painted over). Flat and in the headset. node test/claw_text.js
const { open } = require('./lib');
const { openVR, H } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const probe = page => page.evaluate(async () => { const A = window.__arcade, cab = A.clawCab, T = cab.userData.text || [];
    const mod = await import('./clawcab.js'), cv = document.createElement('canvas'); cv.width = 1024; cv.height = 220; const g = cv.getContext('2d');
    const wide = mod.fitText(g, 'CLAW MACHINE', 1024, 220, { name: 'wideTest', px: 120, weight: '900', family: 'monospace', glow: '#f0f', blur: 26, color: '#f0f', aspect: 5.5 });
    const huge = mod.fitText(g, 'CLAW MACHINE CLAW MACHINE', 1024, 220, { name: 'hugeTest', px: 200, weight: '900', family: 'serif', glow: '#f0f', blur: 26, color: '#f0f', aspect: 5.5 });
    // ink check: no lit pixel touches the left/right/top/bottom 3% of the plate canvas
    const edge = name => { const m = cab.getObjectByName(name), img = m && m.material.map && m.material.map.image; if (!img) return null; const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data, mx = Math.ceil(c.width * 0.03), my = Math.ceil(c.height * 0.03); let hits = 0;
      for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) { if (xx >= mx && xx < c.width - mx && yy >= my && yy < c.height - my) continue; const i = (yy * c.width + xx) * 4; if (d[i] > 200 && d[i + 2] > 150 && d[i + 1] < 140) hits++; }
      return { w: c.width, h: c.height, hits }; };
    const si = window.__neonSigns && window.__neonSigns.userData.signs.find(s => s.key === 'claw'), cs = window.__neonClawSign, ic = window.__neonIcons;
    return { text: T.filter(r => r.name === 'marquee' || r.name === 'price'), wide, huge, edgeM: edge('marquee'), sign: si && { w: si.w, h: si.h }, csOrder: cs ? cs.renderOrder : null, csParent: !!(cs && cs.parent), icOrder: ic ? ic.renderOrder : null,
      inMain: (() => { const m = window.__neonSigns; if (!m || !si) return null; const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - si.pos[0]) < 0.97 && Math.abs(p.getZ(i) - si.pos[2]) < 0.05 && Math.abs(p.getY(i) - si.pos[1]) < 0.2) return true; return false; })() }; });
  const report = (r, tag) => {
    const m = r.text.find(x => x.name === 'marquee'), p = r.text.find(x => x.name === 'price');
    chk(m && m.fits && m.textW <= m.availW && m.textH <= m.availH, tag + 'marquee "CLAW MACHINE" fits its plate with margin ' + JSON.stringify(m));
    chk(p && p.fits, tag + 'price plate "1 TICKET" fits ' + JSON.stringify(p));
    chk(r.wide.fits && r.huge.fits && r.huge.px < r.huge.px0, tag + 'a much wider font still fits (shrinks: ' + r.wide.px + 'px / ' + r.huge.px + 'px)');
    chk(r.edgeM && r.edgeM.hits === 0, tag + 'no bright lettering at the marquee canvas edges (not cut off) ' + JSON.stringify(r.edgeM));
    chk(r.sign && r.sign.w <= 1.9 + 1e-6, tag + 'neon name on top is about cabinet-wide (' + (r.sign && r.sign.w) + ' m)');
    chk(r.csParent && r.csOrder > r.icOrder && r.inMain === false, tag + 'neon claw name on its own mesh drawn after the wall pictures (order ' + r.csOrder + ' > ' + r.icOrder + ')');
  };
  let o = await open({ w: 480, h: 270 });
  try { await o.page.waitForFunction(() => window.__arcade && window.__arcade.clawCab && window.__neonSigns, null, { timeout: 60000 }); report(await probe(o.page), 'flat: ');
    chk(!o.errors.length, 'no page errors (flat) ' + o.errors.join(' | ')); } finally { await o.close(); }
  o = await openVR();
  try { const page = o.page;
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 }); await H.frames(page, 5);
    report(await probe(page), 'VR: ');
    chk(!o.errors.length, 'no page errors (VR) ' + o.errors.join(' | ')); } finally { await o.close(); }
  console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
