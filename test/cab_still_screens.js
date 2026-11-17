// v22 (Dave t426u/t429u): the idle cabinet screens are still painted images: no Strike / Ghost attract-demo iframes, no per-frame attract
// redraws, Strike + Ghost keep the v250 4:3 wide screens with their painted art. VR=1 runs it in the emulated Quest 3 headset.
const VR = !!process.env.VR;
const { open } = require('./lib');
const { openVR, H } = require('./vrlib');
(async () => {
  const o = VR ? await openVR() : await open({ w: 844, h: 390, init: () => { localStorage.setItem('neonarcade.tickets', '40'); } }); const { page, errors, close } = o;
  let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 500) : '')); if (!c) ok = false; };
  const tag = VR ? 'VR: ' : 'flat: ';
  try {
    if (VR) { await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 30000 });
      await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 }); }
    else await page.waitForFunction(() => window.__arcade && window.__arcade.stats.frames > 3, null, { timeout: 90000 });
    await page.waitForTimeout(7000);   // past the old 4 s demo attach
    const place = key => page.evaluate(key => { const A = window.__arcade, u = A[key].userData, f = u.front || u.centre, n = u.inward || { x: 0, z: 1 }, x = f.x + n.x * 2.4, z = f.z + n.z * 2.4;
      if (window.__gaVR && window.__gaVR.presenting) { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw: Math.atan2(n.x, n.z) }; S.applyRig(); }
      else { A.monkey.position.set(x, 0, z); A.st.fp = false; A.st.camInit = false; A.st.pitch = 0.12; const face = Math.atan2(-n.x, -n.z); A.st.yaw = face; A.st.face = face; } }, key);
    const snap = () => page.evaluate(() => { const A = window.__arcade, T = A.THREE, out = {};
      const keys = ['strikeCab', 'ghostCab', 'berserkerCab', 'monkeyCab', 'orcCab', 'novaCab', 'cyberCab', 'blasterCab', 'pipCab', 'roadsterCab', 'bbCab', 'rockfallCab', 'skyTowerCab'];
      for (const k of keys) { const u = A[k].userData, s = u.screen, mat = s && s.material, t = mat && ((mat.uniforms && mat.uniforms.map && mat.uniforms.map.value) || mat.map || mat.emissiveMap), img = t && t.image;
        let frac = null; if (img && img.width) { const c = document.createElement('canvas'); c.width = 48; c.height = 36; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 48, 36); const d = g.getImageData(0, 0, 48, 36).data; let nz = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 18) nz++; frac = +(nz / 1728).toFixed(2); }
        out[k] = { v: t ? t.version : -1, frac }; }
      const along = cab => { const b = new T.Box3().setFromObject(cab.getObjectByName('screen')).getSize(new T.Vector3()), w = cab.userData.wall; return +((w === 'west' || w === 'east') ? b.z : b.x).toFixed(3); };
      out.w = { strike: along(A.strikeCab), ghost: along(A.ghostCab), orc: along(A.orcCab) };
      out.iframes = [...document.querySelectorAll('iframe')].map(f => f.getAttribute('src') || '').filter(s => /demo/.test(s));
      out.demo = { s: [A.demo.still, A.demo.frames], g: [A.ghostDemo.still, A.ghostDemo.frames], sOnCrt: A.strikeCab.userData.crt.uniforms.map.value === A.strikeCab.userData.viewTex, gOnCrt: A.ghostCab.userData.crt.uniforms.map.value === A.ghostCab.userData.viewTex };
      return out; });
    await page.evaluate(() => { window.__forceDemo = 1; });   // every cabinet counts as near + in view
    await place('strikeCab'); await page.waitForTimeout(800); const a = await snap(); await page.waitForTimeout(3000); const b = await snap();
    chk(a.iframes.length === 0, tag + 'no Strike / Ghost attract-demo iframes are loaded', a.iframes);
    chk(a.demo.s[0] && a.demo.g[0] && b.demo.s[1] === 0 && b.demo.g[1] === 0, tag + 'Strike + Ghost demos stay off (still mode)', b.demo);
    chk(b.demo.sOnCrt && b.demo.gOnCrt && b.strikeCab.frac > 0.3 && b.ghostCab.frac > 0.2, tag + 'Strike + Ghost CRTs show the painted attract art', { s: b.strikeCab, g: b.ghostCab });
    chk(b.w.strike >= 0.6 && b.w.ghost >= 0.6 && Math.abs(b.w.ghost - b.w.orc) < 0.05, tag + 'Strike + Ghost keep the wide 4:3 screens (v250)', b.w);
    const moved = Object.keys(a).filter(k => /Cab$/.test(k) && a[k].v !== b[k].v);
    chk(moved.length === 0, tag + 'no idle cabinet screen is redrawn over 3 s near the cabinets', moved);
    const blank = Object.keys(b).filter(k => /Cab$/.test(k) && !(b[k].frac > 0.05));
    chk(blank.length === 0, tag + 'every cabinet screen shows a painted still (not blank)', Object.fromEntries(Object.keys(b).filter(k => /Cab$/.test(k)).map(k => [k, b[k].frac])));
    if (!VR) {   // Dave t429u: pressing PLAY at a cabinet still loads + plays its game exactly as before
      for (const key of ['ghost'])   // Strike's play flow: play.js + vr_strike_v21.js
      {
        await page.evaluate(k => { window.__forceDemo = 0; const p = window.__arcade.play; p.start(p.machines[k]); }, key);
        await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 40000 });
        await page.waitForTimeout(1500); await page.evaluate(() => { const p = window.__arcade.play; p.insertTicket(); p.tryPlay(); });
        const ok2 = await page.waitForFunction(() => window.__arcade.play.sub === 'play', null, { timeout: 20000 }).then(() => true, () => false);
        const src = await page.evaluate(() => { const g = document.getElementById('game'); return g && g.getAttribute('src'); });
        chk(ok2 && new RegExp(key).test(src || ''), tag + 'PLAY at ' + key.toUpperCase() + ' loads and starts the real game', { sub: await page.evaluate(() => window.__arcade.play.sub), src });
        await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__arcade.play.mode !== 'game', null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500);
      }
    }
  } catch (e) { chk(false, 'threw: ' + e.message); }
  const errs = errors.filter(e => !/supabase|Failed to load resource|net::ERR/i.test(e)); chk(!errs.length, tag + 'no page errors', errs.slice(0, 3));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
