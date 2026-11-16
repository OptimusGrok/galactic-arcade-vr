// t362u: two people in the VR arcade at once (plus a flat player): mp.js's shared room (mocked Supabase, relayed between three browsers).
// VR players send head + both controller poses with their state; everyone else sees their head turn and their arms / hands (with controllers)
// follow, smoothed; a visor marks them as VR. Their laser shots (along the controller), charge, jetpack flight and held pistol show too.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib'); const mock = require('./mpmock');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const pages = [], all = [];
  async function dev(id, vr) { const o = await openVR(vr ? { init: { content: IWER_SRC + SETUP + HEADSET_FB } } : { init: { content: ';' } }); const p = o.page; p.setDefaultTimeout(90000);
    await p.exposeFunction('__mpRelay', m => { for (const q of pages) if (q !== p) q.evaluate(x => window.__mpRecv && window.__mpRecv(JSON.parse(x)), m).catch(() => {}); });
    await p.addInitScript(id => { window.__mpId = id; }, id); await p.addInitScript(mock); pages.push(p); all.push(o);
    await p.reload(); await p.waitForFunction(() => window.__arcade && window.__arcade.stats.frames > 3 && window.__mp && window.__mp.state === 'on', null, { timeout: 90000 }); return o; }
  const peer = (page, pid) => page.evaluate(pid => (window.__gaVR.mp().peers.find(p => p.id === pid) || null), pid);
  const until = async (page, fn, arg, ms = 20000) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  try {
    const A = await dev('aaaa1111', true), B = await dev('bbbb2222', true), C = await dev('cccc3333', false); const a = A.page, b = B.page, c = C.page;
    for (const p of [a, b, c]) await until(p, () => window.__mp.peers.size === 2);
    chk((await Promise.all([a, b, c].map(p => p.evaluate(() => window.__mp.peers.size)))).every(n => n === 2), 'three players in one room (2 VR + 1 flat), each sees the other two');
    for (const p of [a, b]) { await p.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 }); await p.click('#vrBtn'); await p.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 }); }
    const place = async (p, x, z, yaw) => { await p.evaluate(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(p, 4); };
    await place(a, 2, 4, 0); await place(b, 2, 1.5, Math.PI);   // facing each other
    await c.evaluate(() => { const m = window.__arcade.monkey; m.position.set(4.5, 0, 3); m.rotation.y = -Math.PI / 2; });
    // B: right hand up high, left hand low, head turned to its left
    const handsB = async (rUp) => { await b.evaluate(rUp => { const C = window.__xrd.controllers; const set = (h, x, y, z) => { C[h].position.set(x, y, z); };
        set('right', 0.25, rUp ? 1.9 : 0.85, -0.3); set('left', -0.25, rUp ? 0.85 : 1.9, -0.3); }, rUp); await H.frames(b, 4); };
    await handsB(true); await b.evaluate(() => { const s = Math.sin(0.35), c0 = Math.cos(0.35); window.__xrd.quaternion.set(0, s, 0, c0); }); await H.frames(b, 4);
    const sent = await b.evaluate(() => window.__gaVR.mp().sent); chk(sent > 0, 'B (in VR) sends its head + controller poses (' + sent + ' packets)');
    const vB = await until(a, () => { const p = window.__gaVR.mp().peers.find(q => q.id === 'bbbb2222'); return p && p.vr && p.visor && p.ctrlR && p.ctrlL && p.handR && p.handL && p.handR[1] > p.handL[1] + 0.25; });
    let pb = await peer(a, 'bbbb2222');
    chk(vB, 'A sees B as a VR player (visor) holding two controllers, right hand up (' + (pb && pb.handR ? pb.handR[1].toFixed(2) : '?') + ' m) above the left (' + (pb && pb.handL ? pb.handL[1].toFixed(2) : '?') + ' m)');
    chk(pb && pb.headQ && Math.abs(pb.headQ[1]) > 0.15, 'B\'s head turn shows on A (head quaternion ' + JSON.stringify(pb && pb.headQ) + ')');
    // swap hands: A's copy eases across (in-between frames), then left is up
    await handsB(false); const ys = [];
    for (let i = 0; i < 40 && ys.length < 60; i++) { const q = await peer(a, 'bbbb2222'); if (q && q.handR) ys.push(q.handR[1]); if (q && q.handL && q.handR && q.handL[1] > q.handR[1] + 0.25) break; await H.frames(a, 1); }
    pb = await peer(a, 'bbbb2222'); const hi = ys[0], lo = pb.handR[1], mid = ys.filter(y => y < hi - 0.05 && y > lo + 0.05).length;
    chk(pb.handL[1] > pb.handR[1] + 0.25 && mid >= 1, 'B swaps hands: A\'s copy follows smoothly (' + mid + ' in-between frames, right ' + hi.toFixed(2) + ' -> ' + lo.toFixed(2) + ')');
    // B walks 1.5 m: A sees it move
    const x0 = pb.pos[0]; await place(b, 3.5, 1.5, Math.PI);
    const mv = await until(a, x0 => { const p = window.__gaVR.mp().peers.find(q => q.id === 'bbbb2222'); return p && Math.abs(p.pos[0] - x0 - 1.5) < 0.1; }, x0);
    chk(mv, 'B moves 1.5 m: A sees it (x ' + x0.toFixed(2) + ' -> ' + (await peer(a, 'bbbb2222')).pos[0].toFixed(2) + ')');
    // the other way round + the flat player
    const vA = await until(b, () => { const p = window.__gaVR.mp().peers.find(q => q.id === 'aaaa1111'); return p && p.vr && p.visor && p.ctrlR && p.ctrlL; });
    chk(vA, 'B sees A as a VR player with head and hands too');
    const vC = await until(c, () => { const ps = window.__gaVR.mp().peers, x = ps.find(q => q.id === 'bbbb2222'), y = ps.find(q => q.id === 'aaaa1111'); return x && y && x.vr && y.vr && x.visor && x.ctrlL && x.handL[1] > x.handR[1] + 0.25; });
    chk(vC, 'the flat player sees both VR players with visors, and B\'s hands where B holds them');
    const pc = await peer(a, 'cccc3333'), cs = await c.evaluate(() => window.__gaVR.mp().sent);
    chk(pc && !pc.vr && !pc.visor && pc.vis && cs === 0, 'A sees the flat player as a normal avatar (no visor; the flat client sends no VR pose)');
    // ---- laser: B buys + holds the pistol (ray menu), shoots down, then charges ----
    await place(b, 2, 1.5, Math.PI); await b.evaluate(() => window.__arcade.play.addTickets(40));
    const LOCAL = [0.2, 1.3, -0.2], aimB = async t => { await H.aim(b, 'right', LOCAL, t); await H.frames(b, 3); };
    const tapB = async id => { for (let i = 0; i < 3; i++) { const w = await b.evaluate(id => window.__gaVR.ui.btnWorld(id), id); if (!w) throw new Error('no button ' + id); await aimB(w); await H.press(b, 'right', 'trigger'); await H.frames(b, 3); if ((await b.evaluate(() => window.__gaVR.lastPress)) === id) break; } await b.evaluate(() => { window.__gaVR.lastPress = null; }); };
    await H.press(b, 'left', 'y-button'); await H.frames(b, 3); await tapB('ward'); await tapB('cat_hand'); await tapB('w_hand_pistol'); await tapB('cat_back'); await tapB('w_back_jetpack'); await tapB('close');
    const gB = await b.evaluate(() => window.__gaVR.gear()); chk(gB.laser && gB.jet, 'B holds the laser pistol and wears the jetpack');
    chk(await until(a, () => { const p = window.__gaVR.mp().peers.find(q => q.id === 'bbbb2222'); return p && p.pistol; }), 'A sees the pistol in B\'s hand');
    const z0 = await a.evaluate(() => window.__mp.zapRecv || 0), rig = await b.evaluate(() => window.__gaVR.rig);
    await aimB([rig.x - 0.25, 0.05, rig.z + 0.6]); await H.btn(b, 'right', 'b-button', 1); await H.frames(b, 4); await b.waitForTimeout(250); await H.btn(b, 'right', 'b-button', 0); await H.frames(b, 4);
    const zp = await until(a, z0 => (window.__mp.zapRecv || 0) > z0, z0, 8000);
    const rl = await a.evaluate(() => { const L = window.__roomFire.lasers; const r = L.filter(l => l.remote || l.mesh && /emote|Remote/i.test(l.mesh.name)); const l = (r.length ? r : L)[(r.length ? r : L).length - 1]; return l ? { dir: l.dir.toArray(), y: l.mesh.position.y } : null; });
    const bz = await b.evaluate(() => window.__gaVR.mp().zaps);
    chk(zp && bz >= 1 && rl && rl.dir[1] < -0.5, 'B shoots with the hand pointing down: A sees the bolt fly down (dir y ' + (rl ? rl.dir[1].toFixed(2) : '?') + ')');
    await aimB([rig.x, 1.3, rig.z + 3]); await H.btn(b, 'right', 'b-button', 1); await H.frames(b, 10); await b.waitForTimeout(400);
    const chg = await until(a, () => { const p = window.__gaVR.mp().peers.find(q => q.id === 'bbbb2222'); return p && p.lz && p.lz.k > 0.02 && window.__roomFire.remoteState().some(r => r.id === 'bbbb2222' && r.hasBall); }, null, 8000);
    const lz = (await peer(a, 'bbbb2222')).lz; const cB = await b.evaluate(() => window.__gaVR.vrLaser().aim);
    chk(chg && lz && cB && Math.hypot(lz.o[0] - cB.o[0], lz.o[1] - cB.o[1], lz.o[2] - cB.o[2]) < 0.3, 'B charging: A sees the charge ball at B\'s controller (k ' + (lz ? lz.k : '?') + ')');
    await H.btn(b, 'right', 'b-button', 0); await H.frames(b, 4);
    // ---- jetpack: B holds A and flies; A sees it up in the air with the thrusters lit ----
    await H.btn(b, 'right', 'a-button', 1);
    const fly = await until(a, () => { const p = window.__gaVR.mp().peers.find(q => q.id === 'bbbb2222'); return p && p.a === 'fly' && p.pos[1] > 0.3 && p.thr && p.vr; }, null, 20000);
    const pf = await peer(a, 'bbbb2222'); await H.btn(b, 'right', 'a-button', 0);
    chk(fly, 'B flies the jetpack: A sees it in the air (y ' + pf.pos[1].toFixed(2) + ', ' + pf.a + ', thrusters ' + pf.thr + ') with its head and hands still tracked');
    const st = await a.evaluate(() => { const m = window.__gaVR.mp(); return { posed: m.posed, steps: m.steps }; });
    chk(st.posed > 20, 'A poses the remote VR avatar every frame (' + st.posed + ' poses, ' + st.steps + ' steps from the headset loop)');
  } catch (e) { chk(false, 'exception ' + String(e && e.stack || e).slice(0, 600)); }
  for (const [i, o] of all.entries()) { const errs = o.errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors on ' + 'ABC'[i] + ' ' + errs.slice(0, 3).join(' | ')); }
  for (const o of all) await o.close().catch(() => {});
  process.exit(ok ? 0 : 1);
})();
