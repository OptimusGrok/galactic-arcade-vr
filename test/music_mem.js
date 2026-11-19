// test-v1 (VR memory): only the current music loop stays decoded. The room loop (~26 MB PCM) is dropped after it has been silent for the
// hold (game / Neon Knockout studio / MUSIC off) and decoded again on return; cabinet loops keep at most one decoded buffer.
const { open, play } = require('./lib');
(async () => {
  const supa = r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  const o = await open({ start: true, w: 640, h: 360, supa }); const { page, errors } = o;
  let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x != null ? ' ' + JSON.stringify(x) : '')); if (!c) ok = false; };
  const ev = (f, a) => page.evaluate(f, a), at = (x, z) => ev(([x, z]) => { const A = window.__arcade; A.st.vel.set(0, 0, 0); A.monkey.position.set(x, 0, z); }, [x, z]);
  const M = () => ev(() => { const m = window.__music, c = window.__cabMusic; return { loaded: m.loaded, target: +m.target.toFixed(2), mb: m.decodedMB, drops: m.drops, loads: m.loads, cab: c ? { cur: c.cur, drops: c.drops || 0, loads: c.loads } : null }; });
  try {
    await page.waitForTimeout(800);
    await play(page, false, 'Astro'); await ev(() => { window.__gaMusicHold = 1500; });
    await page.waitForFunction(() => window.__music.loaded || window.__music.err, null, { timeout: 30000 });
    await at(0, 4); await page.waitForTimeout(1500);
    let m = await M(); chk(m.loaded && m.mb > 5, 'room loop decoded and playing in room 1', m);   // v11: mono AAC decodes to ~13.4 MB at the context rate (v9 stereo 26.8)
    await at(-48, 0); await page.waitForFunction(() => !window.__music.loaded, null, { timeout: 20000 }).catch(() => {});
    m = await M(); chk(!m.loaded && m.drops >= 1 && m.mb === 0, 'in the Neon Knockout studio the room loop is dropped after the hold', m);
    await page.waitForTimeout(2500); m = await M(); chk(!m.loaded && m.loads === 1, 'it is not re-decoded while still away', m);
    await at(0, 4); await page.waitForFunction(() => window.__music.loaded && window.__music.gain > 0.1, null, { timeout: 30000 }).catch(() => {});
    m = await M(); chk(m.loaded && m.loads === 2 && m.target > 0.1, 'back in room 1 the loop is decoded again and plays (target may be ducked under the PA)', m);
    // cabinet loops: walk past two cabinets, then away; at most one stays decoded
    const fronts = await ev(() => { const P = window.__arcade.play.machines, out = []; for (const k of ['claw', 'bb', 'pip', 'orc']) { const c = P[k] && P[k].cab; if (c && c.userData.front) out.push([k, c.userData.front.x, c.userData.front.z]); } return out; });
    for (const [k, x, z] of fronts.slice(0, 3)) { await at(x, z); await page.waitForTimeout(2500); }
    await at(0, 4); await page.waitForTimeout(2500);
    const cc = await ev(() => { const c = window.__cabMusic; return { loads: c.loads, drops: c.drops || 0, cur: c.cur }; });
    chk(cc.loads >= 2 && cc.drops >= cc.loads - 1 && !cc.cur, 'cabinet loops: older loops are released, only the current one is kept (' + JSON.stringify(cc) + ')');
  } catch (e) { chk(false, 'exception ' + String(e && e.stack || e).slice(0, 400)); }
  chk(errors.filter(e => !/Failed to load|supabase|net::/i.test(e)).length === 0, 'no page errors', errors.slice(0, 3));
  await o.close(); console.log(ok ? 'ALL OK' : 'SOME FAIL'); process.exit(ok ? 0 : 1);
})();
