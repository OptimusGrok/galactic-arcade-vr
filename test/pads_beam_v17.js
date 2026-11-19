// vrtest-v17 (t494u): first and second beam times for the shop pad and the Neon Knockout pad,
// CPU throttled 4x (Quest-like). Also checks the new pad's placement, unlit labels, and that
// no lights were added (a changing light count recompiles shaders). Small viewport.
// Prints BEAM <dest> <n> {msToCut, msToIdle, held, progs, tex}. GA_ROOT=<v16 checkout> compares.
const { open } = require('./lib');
const CPU = +(process.env.CPU || 4), CHECK = !!process.env.CHECK;
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await open({ w: 480, h: 270, cpu: CPU, qs: '?nowarm=0&noveil=1' });
  const ev = (f, a) => page.evaluate(f, a);
  await page.waitForFunction(() => window.__tp && window.__arcade && window.__arcade.bbCab, null, { timeout: 120000 });
  await ev(() => { window.__tpTimeScale = 8; window.__noPrewarm = 0; });

  const info = await ev(() => {
    const tp = window.__tp, A = window.__arcade, lights = [];
    A.scene.traverse(o => { if (o.isLight) lights.push({ type: o.type, name: o.name || '', parent: (o.parent && o.parent.name) || '' }); });
    const padLights = lights.filter(l => /teleportPad/i.test(l.parent) || /teleportLabel/i.test(l.parent));
    const P4 = tp.PAD4, bb = A.bbCab.position, pip = A.pipCab.position;
    return {
      hasP4: !!(P4 && tp.pads && tp.pads[3]),
      p1: tp.PAD1 && [+tp.PAD1.x.toFixed(3), +tp.PAD1.z.toFixed(3)],
      p4: P4 && [+P4.x.toFixed(3), +P4.z.toFixed(3)],
      bb: [+bb.x.toFixed(2), +bb.z.toFixed(2)],
      pip: [+pip.x.toFixed(2), +pip.z.toFixed(2)],
      shopSign: !!A.scene.getObjectByName('teleportLabel_SHOP'),
      nkSign: !!A.scene.getObjectByName('teleportLabel_NEONKNOCKOUT'),
      lights: lights.length, padLights: padLights.length, point: lights.filter(l => l.type === 'PointLight').length,
    };
  });
  console.log('PADS ' + JSON.stringify(info));
  if (info.hasP4) {
    chk(info.p4[0] < -9 && info.p4[1] > 9, 'PAD4 is in the SW corner ' + JSON.stringify(info.p4));
    chk(info.p1[0] < -9 && info.p1[1] < -9, 'PAD1 stays in the NW corner ' + JSON.stringify(info.p1));
    chk(info.shopSign && info.nkSign, 'SHOP and NEON KNOCKOUT label signs are in the scene');
    chk(info.padLights === 0, 'new pad added no lights (padLights=' + info.padLights + ', total ' + info.lights + ')');
  } else {
    console.log('INFO no PAD4 (older build); shop-only timings will still run');
  }

  const beam = async (dest, where, n) => {
    await ev(([d, w]) => {
      const tp = window.__tp, A = window.__arcade, pad = d === 'nk' ? (tp.PAD4 || tp.PAD1) : d === 'shop' ? tp.PAD1 : (w === 3 ? tp.PAD3 : (tp.home === 4 && tp.PAD4) || tp.PAD2);
      if (d === 'shop' || d === 'nk') { A.monkey.position.set(pad.x + 0.4, 0, pad.z + (d === 'nk' && tp.PAD4 ? -0.4 : 0.4)); A.st.vel.set(0, 0, 0); tp.home = d === 'nk' ? 4 : 1; tp.nearPad = d === 'nk' ? 4 : 1; }
      const i = A.renderer.info;
      window.__bm = { t0: performance.now(), cut: 0, idle: 0, held: tp.held || 0, p0: i.programs ? i.programs.length : 0, tx0: i.memory.textures, where0: tp.where };
    }, [dest, where]);
    await ev(d => { window.__tpTimeScale = 8; window.__tp.go(d === 'arcade' ? undefined : d); }, dest);
    await page.waitForFunction(w => window.__tp.where === w && window.__tp.state === 'idle', where, { timeout: 180000 });
    const r = await ev(() => {
      const i = window.__arcade.renderer.info, tp = window.__tp, B = window.__bm || {};
      const t1 = performance.now();
      return { dest: tp.dest, where: tp.where, msToIdle: Math.round(t1 - B.t0), held: (tp.held || 0) - (B.held || 0),
        progs: (i.programs ? i.programs.length : 0) - (B.p0 || 0), tex: i.memory.textures - (B.tx0 || 0),
        home: tp.home || 0 };
    });
    console.log('BEAM ' + dest + ' #' + n + ' ' + JSON.stringify(r));
    return r;
  };

  await ev(() => { const P = window.__tp.PAD1, A = window.__arcade; A.monkey.position.set(P.x + 0.5, 0, P.z + 0.5); A.st.vel.set(0, 0, 0); });
  await page.waitForTimeout(200);
  const s1 = await beam('shop', 2, 1);
  const s1b = await beam('arcade', 1, 1);
  const s2 = await beam('shop', 2, 2);
  const s2b = await beam('arcade', 1, 2);
  let n1, n1b, n2, n2b;
  if (info.hasP4) {
    await ev(() => { const P = window.__tp.PAD4, A = window.__arcade; A.monkey.position.set(P.x + 0.5, 0, P.z - 0.5); A.st.vel.set(0, 0, 0); window.__tp.nearPad = 4; window.__tp.home = 4; });
    await page.waitForTimeout(200);
    n1 = await beam('nk', 3, 1);
    n1b = await beam('arcade', 1, 1);
    chk(n1b.home === 4, 'return from Neon Knockout uses the SW pad (home=' + n1b.home + ')');
    await ev(() => { const P = window.__tp.PAD4, A = window.__arcade; A.monkey.position.set(P.x + 0.5, 0, P.z - 0.5); A.st.vel.set(0, 0, 0); window.__tp.nearPad = 4; window.__tp.home = 4; });
    n2 = await beam('nk', 3, 2);
    n2b = await beam('arcade', 1, 2);
  }

  const lightsAfter = await ev(() => { let n = 0; window.__arcade.scene.traverse(o => { if (o.isLight) n++; }); return n; });
  chk(lightsAfter === info.lights, 'light count stayed ' + info.lights + ' after the beams (now ' + lightsAfter + ')');
  if (CHECK) {
    chk(s1.msToIdle < 20000 && s2.msToIdle < 20000, 'shop beams finished (first ' + s1.msToIdle + ' ms, second ' + s2.msToIdle + ' ms)');
    if (n1) chk(n1.msToIdle < 20000 && n2.msToIdle < 20000, 'NK beams finished (first ' + n1.msToIdle + ' ms, second ' + n2.msToIdle + ' ms)');
  }
  chk(!errors.filter(e => !/Failed to load|supabase|net::/i.test(e)).length, 'no page errors ' + errors.slice(0, 2).join(' | '));
  await close();
  console.log(ok ? 'ALL OK' : 'SOME FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
