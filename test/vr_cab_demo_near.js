// v22 (normal v250 port): in the headset, the STRIKE and GHOST 256 attract demos run when you stand near and look at the cabinet
// (the visibility test uses the headset view), their CRTs show the painted attract / cropped demo on the wide 4:3 screen, and they pause
// when you walk away. Emulated Quest 3 (IWER).
const { openVR, H } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 400) : '')); if (!c) ok = false; };
  const { page, errors, close } = await openVR();
  const E = (f, a) => page.evaluate(f, a);
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 30000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await page.waitForFunction(() => { const A = window.__arcade; return A.demo && A.demo.ready && A.ghostDemo && A.ghostDemo.ready; }, null, { timeout: 90000 });
    const lit = () => E(() => { const A = window.__arcade, r = {};
      for (const [k, cab, D] of [['strike', A.strikeCab, A.demo], ['ghost', A.ghostCab, A.ghostDemo]]) { const cv = D.view, c = document.createElement('canvas'); c.width = 64; c.height = 48; const g = c.getContext('2d'); g.drawImage(cv, 0, 0, 64, 48);
        const d = g.getImageData(0, 0, 64, 48).data; let nz = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 18) nz++;
        r[k] = { frames: D.frames, w: cv.width, h: cv.height, frac: +(nz / 3072).toFixed(2), onCrt: cab.userData.crt.uniforms.map.value === D.texture }; } return r; });
    const stand = async (key, d, face) => { await E(([key, d, face]) => { const A = window.__arcade, cab = key === 'strike' ? A.strikeCab : A.ghostCab, u = cab.userData, f = u.front || u.centre, n = u.inward || { x: 0, z: 1 };
      const x = f.x + n.x * d, z = f.z + n.z * d, yaw = face ? Math.atan2(n.x, n.z) : Math.atan2(-n.x, -n.z); const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); A.monkey.position.set(x, 0, z); }, [key, d, face]); await H.frames(page, 8); };
    for (const key of ['strike', 'ghost']) {
      await stand(key, 1.6, true); const a = (await lit())[key]; await H.frames(page, 30); const b = (await lit())[key];
      chk(b.frames > a.frames + 5, 'VR: standing at ' + key.toUpperCase() + ' runs its demo (' + a.frames + ' -> ' + b.frames + ' frames)');
      chk(b.frac > 0.2 && b.w > b.h && b.onCrt, 'VR: ' + key.toUpperCase() + ' CRT shows the demo on the wide 4:3 texture', b);
      await stand(key, 26, false); await H.frames(page, 6); const c = (await lit())[key]; await H.frames(page, 30); const d = (await lit())[key];
      chk(d.frames === c.frames, 'VR: walking away (26 m, facing away) pauses the ' + key + ' demo (' + c.frames + ' -> ' + d.frames + ')');
    }
  } catch (e) { chk(false, 'threw: ' + e.message); }
  const errs = errors.filter(e => !/supabase|Failed to load resource|net::ERR/i.test(e)); chk(!errs.length, 'no page errors', errs);
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
