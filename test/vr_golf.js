// v19 (t411u) / v23 (Dave t432u): mini golf in the headset: free and open (no PAY sign, no energy shield), walking down the stairs with the
// left stick, then putting with a controller: point at the green, hold the trigger (aim line + putter), let go = putt; the ball rolls toward the spot.
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP } });
  const E = (f, a) => page.evaluate(f, a), until = (f, ms = 30000, arg) => page.waitForFunction(f, arg, { timeout: ms });
  const place = async (x, y, z, yaw) => { await E(([x, y, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, y, z); }, [x, y, z, yaw]); await H.frames(page, 6); };
  const setT = n => E(n => { localStorage.setItem('neonarcade.tickets', String(n)); window.__neonSync && window.__neonSync(); window.__arcade.play.tickets.total = n; }, n);
  const G = () => E(() => { const g = window.__minigolf, S = window.__gaVR; return { open: g.open, below: g.below, aiming: g.aiming, vr: !!g.vr, rolling: g.rolling, putts: S.golfPutts || 0, t: window.__arcade.play.tickets.total, msg: S.msgT > 0 ? S.msg : '', y: window.__arcade.monkey.position.y }; });
  try {
    await until(() => document.getElementById('vrBtn').classList.contains('on'), 30000);
    await page.click('#vrBtn'); await until(() => window.__gaVR.presenting && window.__gaVR.posed, 30000);
    await until(() => window.__minigolf && window.__shop, 90000);
    await E(() => { window.__tpTimeScale = 3; window.__tp.go(); }); await until(() => window.__tp.where === 2 && window.__tp.state === 'idle', 90000);
    const g0 = await E(() => { const g = window.__minigolf; return { X0: g.X0, Z: (g.Z0 + g.Z1) / 2 }; });
    await place(g0.X0 - 2.2, 0, g0.Z, -Math.PI / 2); await H.frames(page, 6);
    // v23 (Dave t432u): mini golf is free and open: no PAY sign, no shield, no tickets taken
    const sign = await E(() => !!window.__gaVR.signs().find(q => q.id === 'golfPay'));
    const sh = await E(() => { const o = window.__arcade.scene.getObjectByName('golfShield'); return !!(o && o.parent && o.visible); });
    await setT(0); let s = await G();
    chk(!sign && !sh && s.open, 'no PAY sign, no energy shield, the stairs are open ' + JSON.stringify({ sign, sh, open: s.open }));
    // walk down the stairs with the left stick (facing +x)
    await H.axes(page, 'left', 0, -1);
    for (let i = 0; i < 200 && !(await E(() => window.__minigolf.below && window.__arcade.monkey.position.y < -2)); i++) await H.frames(page, 3);
    await H.axes(page, 'left', 0, 0); s = await G();
    chk(s.below && s.y < -2 && s.t === 0, 'with 0 tickets the left stick walks straight down the stairs (free) ' + JSON.stringify(s));
    // putt hole 1
    const h1 = await E(() => { const g = window.__minigolf, h = g.holes[0], b = g.ballAt(h); return { b: [b.x, b.y, b.z], cup: [h.cx + h.H.cup.x, h.cz + h.H.cup.z], fy: g.FY }; });
    const dx = h1.cup[0] - h1.b[0], dz = h1.cup[1] - h1.b[2], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    await place(h1.b[0] - ux * 0.9, h1.fy + 0.08, h1.b[2] - uz * 0.9, Math.atan2(-ux, -uz)); await H.frames(page, 6);
    const hint = await E(() => window.__gaVR.hudLine ? window.__gaVR.hudLine() : null);
    const distCup = () => E(([cx, cz]) => { const g = window.__minigolf, h = g.holes[0], b = g.ballAt(h); return { d: Math.hypot(b.x - cx, b.z - cz), sunk: h.ball.sunk, strokes: h.strokes }; }, h1.cup);
    const d0 = (await distCup()).d; let last = null, maxPow = 0;
    for (let k = 0; k < 4; k++) {
      const st = await distCup(); if (st.sunk) break;
      const b = await E(() => { const g = window.__minigolf, b = g.ballAt(g.holes[0]); return [b.x, b.y, b.z]; });
      const ex = h1.cup[0] - b[0], ez = h1.cup[1] - b[2], el = Math.hypot(ex, ez), aimD = Math.min(3, el * 0.9 + 0.3), tgt = [b[0] + ex / el * aimD, b[1], b[2] + ez / el * aimD];
      await H.aim(page, 'right', [0.15, 1.2, -0.25], tgt); await H.frames(page, 3);
      await H.btn(page, 'right', 'trigger', 1); await H.frames(page, 6);
      const a = await E(() => ({ g: window.__gaVR.golfVR(), pow: window.__minigolf.power, line: window.__arcade.scene.getObjectByName('golfPutter').visible }));
      if (k === 0) chk(a.g.aiming && a.g.vr && a.pow > 0.05 && a.line, 'holding the trigger aims (putter + power ' + Math.round(a.pow * 100) + '%) ' + JSON.stringify(a)); maxPow = Math.max(maxPow, a.pow);
      await H.btn(page, 'right', 'trigger', 0); await H.frames(page, 3);
      if (k === 0) { s = await G(); chk(s.putts === 1 && (s.rolling || (await distCup()).strokes === 1), 'letting go putts ' + JSON.stringify(s)); }
      await until(() => !window.__minigolf.rolling, 60000).catch(() => {}); await H.frames(page, 4); last = await distCup();
    }
    chk(last && (last.sunk || last.d < d0 - 0.5) && last.strokes >= 1, 'the ball went toward the cup (' + d0.toFixed(2) + ' m -> ' + (last ? last.d.toFixed(2) : '?') + ' m, sunk ' + (last && last.sunk) + ', strokes ' + (last && last.strokes) + ')');
    s = await G(); chk(s.y < -2 && s.below, 'putting never moved you (no teleport to the ball) ' + JSON.stringify(s));
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 600)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
