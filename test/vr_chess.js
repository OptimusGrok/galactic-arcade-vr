// v12 (t374u): the CHESS table in the shop, between the ACCESSORIES wardrobe and the pool tables. Flat: walk up, PLAY CHESS -> you sit,
// Grok walks over from the counter and sits opposite, the camera zooms in, the real chess page (same pieces / battles / robot arm) opens;
// a legal move, the Computer replies with the robot arm, a win pays tickets only through the open frame; ✕ stands you up and Grok walks back.
// VR: ray + trigger on the table seats you (rig turns to the board), A skips Grok's walk, the board panel shows over the table, ray + trigger
// moves a piece, GRIP stands you up; GRIP also closes the headset menu (t382u). node test/vr_chess.js
const { open } = require('./lib');
const { openVR, H } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const CLEAN = `try { if (window === window.top) { localStorage.removeItem('arcade_chess.save.v2'); localStorage.removeItem('arcade_chess.prefs.v1'); } } catch (e) {}`;
  const grokAt = page => page.evaluate(() => { const C = window.__chessTable, g = window.__shop.grok, p = g.getWorldPosition(new window.__arcade.THREE.Vector3()); return { x: p.x, y: p.y, z: p.z, gs: C.gstate, s: C.state }; });
  const sqXY = (page, sq) => page.evaluate(sq => { const w = window.__chessTable.frame.contentWindow, b = w.document.getElementById('board').getBoundingClientRect(), f = sq.charCodeAt(0) - 97, r = +sq[1];
    return { x: b.left + (f + 0.5) * b.width / 8, y: b.top + (8 - r + 0.5) * b.height / 8, W: w.innerWidth, H: w.innerHeight }; }, sq);
  // ---------------- flat ----------------
  let o = await open({ w: 640, h: 400, init: { content: CLEAN } }); let { page, errors } = o;
  try {
    await page.waitForFunction(() => window.__arcade && window.__shop && window.__chessTable && window.__shop.grok, null, { timeout: 90000 });
    const g0 = await page.evaluate(() => { const C = window.__chessTable, W = C.WXp, P = window.__pool; return { cx: C.CX - W, cz: C.CZ, W, pool: P.PX, sign: !!C.sign, chairs: C.chairs.length, pieces: C.pieces ? (C.pieces.length || Object.keys(C.pieces).length) : 0, box: C.BOX }; });
    chk(g0.cx > 1.75 + 1.5 && g0.cx < g0.pool - 0.78 - 1.5 && g0.chairs === 2 && g0.sign && g0.pieces > 0, 'table between the ACCESSORIES wardrobe (x 1.75) and the pool tables (x ' + g0.pool + '), 2 chairs, sign, 3D pieces ' + JSON.stringify(g0));
    const home = await grokAt(page);
    // collision: dropped onto the table, the player is pushed out of its box
    await page.evaluate(() => { const A = window.__arcade, C = window.__chessTable; A.monkey.position.set(C.CX, 0, C.CZ + 0.3); A.st.vel.set(0, 0, 0); });
    await page.waitForTimeout(500);
    const pc = await page.evaluate(() => { const A = window.__arcade, C = window.__chessTable, b = C.BOX, x = A.monkey.position.x - C.WXp, z = A.monkey.position.z; return { x, z, inside: x > b.x0 + 0.05 && x < b.x1 - 0.05 && z > b.z0 + 0.05 && z < b.z1 - 0.05 }; });
    chk(!pc.inside, 'the table is solid (player pushed out of it) ' + JSON.stringify(pc));
    await page.evaluate(() => { const A = window.__arcade, C = window.__chessTable; A.monkey.position.set(C.CX - 2.6, 0, C.CZ + 0.4); A.st.vel.set(0, 0, 0); A.st.yaw = Math.PI / 2 + 0.5; A.st.camInit = false; });
    await page.waitForFunction(() => !!document.querySelector('#chessBtn.on'), null, { timeout: 8000 }).catch(() => {});
    chk(await page.evaluate(() => !!document.querySelector('#chessBtn.on')), '"PLAY CHESS" button shows next to the table');
    await page.click('#chessBtn');
    await page.waitForFunction(() => window.__chessTable.state !== 'idle', null, { timeout: 3000 }).catch(() => {});
    let s1 = await page.evaluate(() => ({ s: window.__chessTable.state, g: window.__chessTable.gstate, seated: window.__arcade.st.seated, skip: !!document.querySelector('#chessSkip.on') }));
    chk(s1.s === 'sit' && s1.seated === 'chess' && (s1.g === 'walk' || s1.g === 'turn'), 'PLAY CHESS: you sit down and Grok leaves the counter ' + JSON.stringify(s1));
    await page.waitForTimeout(1200);
    const mid = await grokAt(page);
    chk(Math.hypot(mid.x - home.x, mid.z - home.z) > 0.25 && (mid.gs === 'walk' || mid.gs === 'turn'), 'Grok WALKS over (moved ' + Math.hypot(mid.x - home.x, mid.z - home.z).toFixed(2) + ' m in 1.2 s, not teleported)');
    await page.waitForFunction(() => window.__chessTable.state !== 'sit', null, { timeout: 8000 }).catch(() => {});
    const seatShow = await page.evaluate(() => { const A = window.__arcade; return { x: A.monkey.position.x, z: A.monkey.position.z, seat: window.__chessTable.seat, s: window.__chessTable.state, face: A.st.face }; });
    chk(Math.hypot(seatShow.x - seatShow.seat.x, seatShow.z - seatShow.seat.z) < 0.05, 'the player is in their chair ' + JSON.stringify(seatShow));
    await page.waitForFunction(() => window.__chessTable.gstate === 'seated', null, { timeout: 25000 }).catch(() => {});
    const gs = await grokAt(page), C0 = await page.evaluate(() => ({ cx: window.__chessTable.CX, cz: window.__chessTable.CZ }));
    chk(gs.gs === 'seated' && Math.abs(gs.x - (C0.cx + 1.08)) < 0.12 && Math.abs(gs.z - C0.cz) < 0.12 && gs.y > home.y + 0.03, 'Grok sits in the chair opposite ' + JSON.stringify(gs));
    await page.waitForFunction(() => window.__chessTable.state === 'zoom' && window.__camOverride, null, { timeout: 4000 }).catch(() => {});
    const z0 = await page.evaluate(() => ({ s: window.__chessTable.state, cam: window.__camOverride && window.__camOverride.chess, d: window.__arcade.camera.position.distanceTo(new window.__arcade.THREE.Vector3(window.__chessTable.CX, 0.78, window.__chessTable.CZ)) }));
    await page.waitForTimeout(700);
    const z1 = await page.evaluate(() => ({ d: window.__arcade.camera.position.distanceTo(new window.__arcade.THREE.Vector3(window.__chessTable.CX, 0.78, window.__chessTable.CZ)) }));
    chk(z0.s === 'zoom' && z0.cam && z1.d < z0.d - 0.3, JSON.stringify(z0) + ' ' + 'the camera zooms in toward the board (' + z0.d.toFixed(2) + ' -> ' + z1.d.toFixed(2) + ' m)');
    await page.waitForFunction(() => { const C = window.__chessTable; try { return C.state === 'play' && C.frame && C.frame.contentWindow.chessApp && C.frame.contentWindow.__chessVR; } catch (e) { return false; } }, null, { timeout: 20000 }).catch(() => {});
    const pl = await page.evaluate(() => { const C = window.__chessTable, w = C.frame.contentWindow, d = w.document; return { s: C.state, ov: !!document.querySelector('#chessOv.on'), src: C.frame.src.replace(/^.*\/(chess-play\/.*)$/, '$1'), rfx: d.documentElement.innerHTML.indexOf("className = 'rfx'") > 0, bfx: d.documentElement.innerHTML.indexOf("className = 'bfx'") > 0, sym: d.querySelectorAll('symbol[id^="pc-"]').length, arcade: !!w.__chessArcade }; });
    chk(pl.s === 'play' && pl.ov && /chess-play\//.test(pl.src) && pl.sym >= 12 && pl.rfx && pl.bfx && pl.arcade, 'the chess page opens: same piece set, battle layer, robot-arm layer, arcade ticket hook ' + JSON.stringify(pl));
    await page.evaluate(() => { const w = window.__chessTable.frame.contentWindow; if (w.chessApp.sans.length) w.chessApp.newGame && w.chessApp.newGame(); });
    await page.waitForTimeout(300);
    const fr = await page.evaluate(() => { const r = window.__chessTable.frame.getBoundingClientRect(); return { x: r.left, y: r.top }; });
    for (const sq of ['e2', 'e4']) { const p = await sqXY(page, sq); await page.mouse.click(fr.x + p.x, fr.y + p.y); await page.waitForTimeout(250); }
    const mv = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.slice());
    chk(mv[0] === 'e4', 'a legal move with the mouse (e2-e4): ' + JSON.stringify(mv));
    let robotSeen = false; for (let i = 0; i < 60 && !robotSeen; i++) { robotSeen = await page.evaluate(() => { const w = window.__chessTable.frame.contentWindow; return !!w.chessApp.robot || !!w.document.querySelector('.rfx .rsprite'); }); if (!robotSeen) await page.waitForTimeout(100); }
    await page.waitForFunction(() => window.__chessTable.frame.contentWindow.chessApp.sans.length >= 2, null, { timeout: 20000 }).catch(() => {});
    const rep = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.slice());
    chk(robotSeen && rep.length >= 2, 'the Computer replies with the robot arm (' + rep.join(' ') + ')');
    const tk = await page.evaluate(() => { const t = window.__arcade.play.tickets, a = t.total, C = window.__chessTable, w = C.frame.contentWindow; const bad = window.__chessWin(window, 20, 'Hard'), b = t.total, good = window.__chessWin(w, 10, 'Medium'), c = t.total; return { bad, good, a, b, c }; });
    chk(tk.bad === false && tk.b === tk.a && tk.good !== false && tk.c === tk.a + 10, 'tickets: a win pays only through the open chess frame (+10 Medium; a fake call pays 0) ' + JSON.stringify(tk));
    await page.click('#chessX');
    await page.waitForFunction(() => window.__chessTable.state === 'idle', null, { timeout: 5000 }).catch(() => {});
    const ex = await page.evaluate(() => ({ s: window.__chessTable.state, seated: window.__arcade.st.seated, ov: !!document.querySelector('#chessOv.on'), cam: !!window.__camOverride }));
    chk(ex.s === 'idle' && !ex.seated && !ex.ov && !ex.cam, '✕ STAND UP: overlay closes, you stand, the camera is yours again ' + JSON.stringify(ex));
    await page.waitForFunction(() => window.__chessTable.gstate === 'home', null, { timeout: 60000 }).catch(() => {});
    const back = await grokAt(page);
    chk(back.gs === 'home' && Math.hypot(back.x - home.x, back.z - home.z) < 0.1, 'Grok walks back behind the counter ' + JSON.stringify(back));
    // can walk again
    const w0 = await page.evaluate(() => [window.__arcade.monkey.position.x, window.__arcade.monkey.position.z]);
    await page.keyboard.down('KeyA'); await page.waitForTimeout(500); await page.keyboard.up('KeyA');
    const w1 = await page.evaluate(() => [window.__arcade.monkey.position.x, window.__arcade.monkey.position.z]);
    chk(Math.hypot(w1[0] - w0[0], w1[1] - w0[1]) > 0.2, 'you can walk again afterwards');
    chk(!errors.length, 'no page errors (flat) ' + errors.join(' | '));
  } finally { await o.close(); }
  // ---------------- VR ----------------
  o = await openVR({ init: { content: require('./vrlib').IWER_SRC + require('./vrlib').SETUP + CLEAN } }); page = o.page; errors = o.errors;
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await page.waitForFunction(() => window.__shop && window.__chessTable && window.__shop.grok, null, { timeout: 60000 });
    const home = await grokAt(page);
    await page.evaluate(() => { const S = window.__gaVR, C = window.__chessTable, x = C.CX - 2.4, z = C.CZ - 0.6; S.rig = { x, y: 0, z, yaw: 0.4 }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); if (window.__tp) window.__tp.where = 2; });
    await H.frames(page, 8);
    const LOCAL = [0.2, 1.3, -0.2];
    const sg = await page.evaluate(() => (window.__gaVR.signs() || []).find(s => s.id === 'chess'));
    chk(!!sg, 'headset: a CHESS · PLAY sign over the table ' + JSON.stringify(sg));
    const tbl = await page.evaluate(() => [window.__chessTable.CX - 0.3, 0.6, window.__chessTable.CZ]);
    await H.aim(page, 'right', LOCAL, tbl); await H.frames(page, 3);
    const hv = await page.evaluate(() => window.__gaVR.hover);
    chk(hv && hv.target === 'chessTable', 'the ray on the table itself targets it ' + JSON.stringify(hv));
    await H.press(page, 'right', 'trigger');
    await page.waitForFunction(() => window.__chessTable.state === 'wait' || window.__chessTable.state === 'play', null, { timeout: 5000 }).catch(() => {});
    const vs = await page.evaluate(() => { const S = window.__gaVR, C = window.__chessTable, h = S.head; return { s: C.state, g: C.gstate, aligns: S.chess.aligns, yaw: h.yaw, d: Math.hypot(h.x - C.seat.x, h.z - C.seat.z) }; });
    const yawOK = Math.abs(Math.atan2(Math.sin(vs.yaw + Math.PI / 2), Math.cos(vs.yaw + Math.PI / 2))) < 0.15;
    chk(vs.aligns === 1 && yawOK && vs.d < 0.25 && (vs.g === 'walk' || vs.g === 'turn'), 'trigger: you are seated facing the board (rig turned once, head over the chair), Grok walks over ' + JSON.stringify(vs));
    // no walking / turning while seated
    const r0 = await page.evaluate(() => ({ ...window.__gaVR.rig }));
    await H.axes(page, 'left', 0, -1); await H.axes(page, 'right', 1, 0); await H.frames(page, 20); await H.axes(page, 'left', 0, 0); await H.axes(page, 'right', 0, 0); await H.frames(page, 3);
    const r1 = await page.evaluate(() => ({ ...window.__gaVR.rig }));
    chk(Math.hypot(r1.x - r0.x, r1.z - r0.z) < 0.02 && Math.abs(r1.yaw - r0.yaw) < 1e-6, 'seated: the sticks do not walk or turn you');
    await H.frames(page, 20); const vm = await grokAt(page);
    chk(Math.hypot(vm.x - home.x, vm.z - home.z) > 0.3, 'headset: Grok is walking over (' + Math.hypot(vm.x - home.x, vm.z - home.z).toFixed(2) + ' m)');
    await H.press(page, 'right', 'a-button');   // A = skip the walk
    await page.waitForFunction(() => { const C = window.__chessTable; try { return C.state === 'play' && C.frame.contentWindow.__chessVR && window.__gaVR.chessM.visible && window.__gaVR.chess.draws > 2; } catch (e) { return false; } }, null, { timeout: 25000 }).catch(() => {});
    const vp = await page.evaluate(() => { const S = window.__gaVR, C = window.__chessTable, m = S.chessM, p = m.getWorldPosition(new window.__arcade.THREE.Vector3()); return { s: C.state, g: C.gstate, skips: C.skips, vis: m.visible, draws: S.chess.draws, at: [p.x - C.CX, p.y, p.z - C.CZ] }; });
    chk(vp.g === 'seated' && vp.skips === 1, 'A skips Grok\'s walk: he is seated opposite ' + JSON.stringify(vp));
    chk(vp.s === 'play' && vp.vis && vp.draws > 2 && Math.abs(vp.at[0]) < 0.3 && Math.abs(vp.at[2]) < 0.05 && vp.at[1] > 0.9, 'the chess board panel shows over the table, painted from the real chess page ' + JSON.stringify(vp));
    const ph = await page.evaluate(() => window.__gaVR.compHash ? 0 : 0);
    await page.evaluate(() => { const w = window.__chessTable.frame.contentWindow; if (w.chessApp.sans.length) w.chessApp.newGame(); }); await H.frames(page, 6);
    const world = async sq => { const p = await sqXY(page, sq); return page.evaluate(([u, v]) => { const m = window.__gaVR.chessM, g = m.geometry.parameters; m.updateMatrixWorld(true); return m.localToWorld(new window.__arcade.THREE.Vector3((u - 0.5) * g.width, (0.5 - v) * g.height, 0)).toArray(); }, [p.x / p.W, p.y / p.H]); };
    const pm0 = await page.evaluate(() => { window.__robSeen = false; try { const fw = window.__chessTable.frame.contentWindow; new fw.MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.querySelector && (n.querySelector('.rsprite') || (n.className && /rsprite/.test(n.className)))) window.__robSeen = true; }).observe(fw.document.body, { childList: true, subtree: true }); } catch (e) {} return { p: window.__gaVR.pumps, d: window.__gaVR.chess.draws }; });
    for (const sq of ['e2', 'e4']) { const w = await world(sq); await H.aim(page, 'right', LOCAL, w); await H.frames(page, 3); await H.press(page, 'right', 'trigger'); await H.frames(page, 4); }
    const vmv = await page.evaluate(() => ({ sans: window.__chessTable.frame.contentWindow.chessApp.sans.slice(), ptr: window.__gaVR.chess.ptr }));
    chk(vmv.sans[0] === 'e4', 'ray + trigger on the panel plays e2-e4 ' + JSON.stringify(vmv));
    let rob = false; for (let i = 0; i < 90; i++) { const r = await page.evaluate(() => { const w = window.__chessTable.frame.contentWindow; return { r: !!w.chessApp.robot || window.__robSeen, n: w.chessApp.sans.length, live: !!w.chessApp.robot }; }); rob = rob || r.r; if (r.n >= 2 && !r.live) break; await H.frames(page, 2); }
    const pm1 = await page.evaluate(() => ({ p: window.__gaVR.pumps, d: window.__gaVR.chess.draws })), robDrawn = pm1.p > pm0.p && pm1.d > pm0.d;
    const vr2 = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.slice());
    chk(rob && robDrawn && vr2.length >= 2, 'headset: the robot arm moves the Computer\'s reply and the panel keeps repainting (' + vr2.join(' ') + '; arm seen ' + rob + ', pumps ' + pm0.p + '->' + pm1.p + ', draws ' + pm0.d + '->' + pm1.d + ')');
    await H.press(page, 'left', 'squeeze');
    await page.waitForFunction(() => window.__chessTable.state === 'idle', null, { timeout: 5000 }).catch(() => {});
    const vx = await page.evaluate(() => { const S = window.__gaVR, C = window.__chessTable, h = S.head, m = window.__arcade.monkey.position; return { s: C.state, vis: S.chessM.visible, backs: S.backs, d: Math.hypot(h.x - m.x, h.z - m.z), frame: !!C.frame }; });
    chk(vx.s === 'idle' && !vx.vis && !vx.frame && vx.backs.chess === 1 && vx.d < 0.2, 'GRIP (short press) stands you up: panel gone, headset with the player ' + JSON.stringify(vx));
    const vb0 = await grokAt(page); for (let i = 0; i < 60 && !(await page.evaluate(() => window.__chessTable.gstate === 'home')); i++) await H.frames(page, 3);   // XR frames drive the world in the emulator (slow headless: he may still be on his way)
    const vb = await grokAt(page), dHome = v => Math.hypot(v.x - home.x, v.z - home.z);
    chk((vb.gs === 'home' && dHome(vb) < 0.1) || (vb.gs === 'back' && dHome(vb) < dHome(vb0) - 1), 'headset: Grok walks back to the counter (home, or still walking there and closer: ' + dHome(vb0).toFixed(1) + ' -> ' + dHome(vb).toFixed(1) + ' m; the flat run checks the arrival) ' + JSON.stringify(vb) + ' home ' + JSON.stringify(home));
    // t382u: GRIP = back for the headset menu / panels too
    await H.press(page, 'right', 'b-button'); await H.frames(page, 3);
    const m1 = await page.evaluate(() => window.__gaVR.state().panel);
    await H.press(page, 'right', 'squeeze'); await H.frames(page, 3);
    const m2 = await page.evaluate(() => ({ p: window.__gaVR.state().panel, backs: window.__gaVR.backs }));
    chk(m1 === 'menu' && !m2.p && m2.backs.menu === 1, 'GRIP closes the headset menu (back) ' + JSON.stringify({ m1, m2 }));
    chk(!errors.length, 'no page errors (VR) ' + errors.join(' | '));
  } finally { await o.close(); }
  console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
