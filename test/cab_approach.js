// vrtest-v5 (t458u): walk up to EVERY cabinet in the emulated Quest 3 headset (rig moves in 0.5 m steps from 4.5 m out to the
// spot you stand to play) and check that the cabinet's OWN loop starts (window.__cabMusic.cur === key), not a neighbour's or nothing.
// node test/cab_approach.js [key ...]
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, close, errors } = await openVR({ init: { content: IWER_SRC + SETUP } });
  const E = (f, a) => page.evaluate(f, a), until = (f, ms = 60000) => page.waitForFunction(f, null, { timeout: ms });
  await until(() => document.getElementById('vrBtn').classList.contains('on'), 60000);
  await page.click('#vrBtn'); await until(() => window.__gaVR.presenting && window.__gaVR.posed, 30000);
  await until(() => window.__arcade && window.__arcade.play && window.__cabMusic, 90000);
  await E(() => { window.__start = Object.assign(window.__start || {}, { dismissed: true }); if (window.__pa) window.__pa.playing = false; if (window.__music && window.__music.setOn) window.__music.setOn(true); });
  const info = await E(() => { const A = window.__arcade, M = A.play.machines, T = window.__cabMusic.tracks, out = {};
    for (const k in M) { const c = M[k].cab, u = c && c.userData || {}; out[k] = { cab: !!c, track: !!T[k], f: u.front ? [u.front.x, u.front.z] : null, n: u.inward ? [u.inward.x, u.inward.z] : null }; } return out; });
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(info);
  console.log('machines ' + Object.keys(info).join(',') + ' | no track: ' + Object.keys(info).filter(k => !info[k].track).join(',') + ' | no cab: ' + Object.keys(info).filter(k => !info[k].cab).join(','));
  const place = (x, z, yaw) => E(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); window.__arcade.st.vel.set(0, 0, 0); }, [x, z, yaw]);
  const rows = [];
  for (const k of keys) {
    const I = info[k]; if (!I || !I.cab || !I.f) { chk(false, k + ': no cabinet / front point ' + JSON.stringify(I)); continue; }
    const n = I.n || [0, 1], yaw = Math.atan2(-n[0], -n[1]);
    // start well away (in the room centre side) so the previous loop has faded out
    await place(I.f[0] + n[0] * 6, I.f[1] + n[1] * 6, yaw); await H.frames(page, 10); await page.waitForTimeout(900);
    const seen = [];
    for (let d = 4.5; d >= 0.5; d -= 0.5) { await place(I.f[0] + n[0] * d, I.f[1] + n[1] * d, yaw); await H.frames(page, 4); await page.waitForTimeout(220); seen.push([d, await E(() => window.__cabMusic.want)]); }
    let cur = null; const t0 = Date.now();
    while (Date.now() - t0 < 10000) { cur = await E(() => window.__cabMusic.cur); if (cur === k) break; await page.waitForTimeout(250); }
    const st = await E(() => { const C = window.__cabMusic; return { want: C.want, cur: C.cur, err: C.err, dist: (() => { const m = window.__arcade.monkey.position; return +Math.hypot(m.x, m.z).toFixed(1); })() }; });
    rows.push({ k, cur: st.cur, want: st.want, err: st.err, firstOwn: (seen.find(s => s[1] === k) || [null])[0] });
    chk(cur === k, k + ': its own loop plays at the cabinet (cur ' + st.cur + ', want ' + st.want + ', err ' + st.err + ') approach ' + JSON.stringify(seen.map(s => s[0] + ':' + (s[1] || '-')).join(' ')));
  }
  console.log('ROWS ' + JSON.stringify(rows));
  chk(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join('|'));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL exception ' + e.message); process.exit(1); });
