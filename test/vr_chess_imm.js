// v17 (t403u, Dave: "VR chess is laggy and pieces are impossible to move"): IMMERSIVE VR chess. Once the game is up at the shop table the
// headset gets its own chess room (vrchess.js): a starry dome + a big tilted board in front of you, the shop around it is not drawn.
// Ray + trigger: pick a piece (its legal moves light up), pick a lit square; Grok replies; NEW GAME / UNDO / EXIT on the bar; GRIP or X
// = back to the shop; the page's robot arm / battles are off while immersive and restored after. Also profiles the frame (draw calls,
// texture uploads, page pumps) and checks flat Quest mode: tap a piece, tap its square. PROFILE_ONLY=1 prints just the profile
// (runs on older builds too, eg GA_ROOT=/tmp/arc/v15wt). node test/vr_chess_imm.js
const { open } = require('./lib');
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
const PROFILE_ONLY = !!process.env.PROFILE_ONLY;
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const CLEAN = `try { if (window === window.top) { localStorage.removeItem('arcade_chess.save.v2'); localStorage.removeItem('arcade_chess.prefs.v1'); } } catch (e) {}`;
  let o = await openVR({ init: { content: IWER_SRC + SETUP + CLEAN } }), page = o.page, errors = o.errors;
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await page.waitForFunction(() => window.__shop && window.__chessTable && window.__shop.grok, null, { timeout: 60000 });
    await page.evaluate(() => { const S = window.__gaVR, C = window.__chessTable, x = C.CX - 2.4, z = C.CZ - 0.6; S.rig = { x, y: 0, z, yaw: 0.4 }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); if (window.__tp) window.__tp.where = 2; });
    await H.frames(page, 8);
    const LOCAL = [0.2, 1.3, -0.2];
    // profile helper: wrap renderer.render (draw calls after each render), the chess page painter, texture uploads, page pumps
    await page.evaluate(() => { const r = window.__arcade.renderer, f = r.render.bind(r); window.__prof = { calls: [], tris: [] };
      r.render = function (s, c) { f(s, c); if (s === window.__arcade.scene) { window.__prof.calls.push(r.info.render.calls); window.__prof.tris.push(r.info.render.triangles); } }; });
    const profile = async (label, n = 40) => { await page.evaluate(() => { const S = window.__gaVR; window.__prof.calls = []; window.__prof.tris = []; window.__prof.p0 = { up: S.texUploads + (S.vrChess ? S.vrChess.V.draws + S.vrChess.V.bdraws : 0), pumps: S.pumps, f: S.frames, t: performance.now(), pd: (() => { try { return window.__chessTable.frame.contentWindow.__chessVR.frames; } catch (e) { return 0; } })() }; });
      await H.frames(page, n);
      const r = await page.evaluate(() => { const S = window.__gaVR, P = window.__prof, a = P.calls, m = x => x.length ? x.reduce((s, v) => s + v, 0) / x.length : 0; let pd = 0; try { pd = window.__chessTable.frame.contentWindow.__chessVR.frames; } catch (e) {}
        const nf = S.frames - P.p0.f; return { frames: nf, calls: +m(a).toFixed(1), tris: Math.round(m(P.tris)), uploadsPerFrame: +((S.texUploads + (S.vrChess ? S.vrChess.V.draws + S.vrChess.V.bdraws : 0) - P.p0.up) / nf).toFixed(2), pumpsPerFrame: +((S.pumps - P.p0.pumps) / nf).toFixed(2), pagePaints: pd - P.p0.pd, msPerFrame: +((performance.now() - P.p0.t) / nf).toFixed(1), imm: !!window.__chessImmersive, vc: S.vrChess ? S.vrChess.V.draws : null }; });
      console.log('PROFILE ' + label + ' ' + JSON.stringify(r)); return r; };
    const shop = await profile('shop (standing, before chess)');
    const tbl = await page.evaluate(() => [window.__chessTable.CX - 0.3, 0.6, window.__chessTable.CZ]);
    await H.aim(page, 'right', LOCAL, tbl); await H.frames(page, 3); await H.press(page, 'right', 'trigger');
    await page.waitForFunction(() => window.__chessTable.state !== 'idle', null, { timeout: 5000 }).catch(() => {});
    await H.press(page, 'right', 'a-button');
    await page.waitForFunction(() => { const C = window.__chessTable; try { return C.state === 'play' && C.frame.contentWindow.chessApp && C.frame.contentWindow.__chessVR && C.frame.contentWindow.__chessVR.ready(); } catch (e) { return false; } }, null, { timeout: 30000 }).catch(() => {});
    await H.frames(page, 10);
    const game = await profile('chess game up');
    if (PROFILE_ONLY) { console.log('PROFILE_ONLY done'); return; }
    // ---- immersive scene ----
    const im = await page.evaluate(() => { const S = window.__gaVR, V = S.vrChess, T = window.__arcade.THREE, h = S.head, w = window.__chessTable.frame.contentWindow, b = V.board.getWorldPosition(new T.Vector3()), tp = window.__tp;
      return { on: S.chessImmOn(), flag: !!window.__chessImmersive, G: V.G.visible, panel: S.chessM.visible, white: tp ? tp.whiteRoom.visible : null, d: Math.hypot(b.x - h.x, b.z - h.z), dy: h.y - b.y, robot: w.chessApp.prefs.robot, battle: w.chessApp.prefs.battle, draws: V.V.draws, err: V.V.lastErr }; });
    chk(im.on && im.flag && im.G && !im.panel && im.white === false && im.d > 0.4 && im.d < 0.9 && im.dy > 0.2 && im.dy < 0.7 && im.draws >= 1 && !im.err, 'chess game up -> immersive chess room: board in front of you below your eyes, old panel off, shop (white room) not drawn ' + JSON.stringify(im));
    chk(im.robot === false && im.battle === false, 'robot arm + capture battles off while immersive ' + JSON.stringify({ robot: im.robot, battle: im.battle }));
    chk(game.calls < shop.calls && game.uploadsPerFrame < 0.1 && game.pumpsPerFrame <= 0.3, 'perf: fewer draw calls than the shop (' + shop.calls + ' -> ' + game.calls + '), almost no texture uploads (' + game.uploadsPerFrame + '/frame), page pumped every 4th frame (' + game.pumpsPerFrame + ')');
    await page.evaluate(() => { const w = window.__chessTable.frame.contentWindow; if (w.chessApp.sans.length) w.chessApp.newGame(); }); await H.frames(page, 6);
    const sqW = sq => page.evaluate(sq => { const S = window.__gaVR, V = S.vrChess, T = window.__arcade.THREE, f = sq.charCodeAt(0) - 97, r = +sq[1] - 1, flip = V.V.flip, c = flip ? 7 - f : f, rw = flip ? r : 7 - r, B = V.board.geometry.parameters.width;
      V.board.updateMatrixWorld(true); return V.board.localToWorld(new T.Vector3(((c + 0.5) / 8 - 0.5) * B, (0.5 - (rw + 0.5) / 8) * B, 0)).toArray(); }, sq);
    const btnW = id => page.evaluate(id => { const V = window.__gaVR.vrChess, T = window.__arcade.THREE, b = V.BTN.find(b => b.id === id), g = V.bar.geometry.parameters; V.bar.updateMatrixWorld(true); return V.bar.localToWorld(new T.Vector3(((b.x + 150) / 1024 - 0.5) * g.width, (0.5 - 166 / 228) * g.height, 0)).toArray(); }, id);
    const tapSq = async (sq, hand = 'right') => { await H.aim(page, hand, LOCAL, await sqW(sq)); await H.frames(page, 3); await H.press(page, hand, 'trigger'); await H.frames(page, 3); return page.evaluate(() => ({ last: window.__gaVR.chessLast, sel: window.__gaVR.vrChess.V.sel, hover: window.__gaVR.vrChess.V.hover })); };
    // hover highlight
    await H.aim(page, 'right', LOCAL, await sqW('g1')); await H.frames(page, 4);
    const hv = await page.evaluate(() => ({ hover: window.__gaVR.vrChess.V.hover, dot: window.__gaVR.state ? true : true }));
    chk(hv.hover === 6, 'the ray over g1 highlights that square (hover 0x88 = 6) ' + JSON.stringify(hv));
    const s1 = await tapSq('e2');
    const lg = await page.evaluate(() => { const V = window.__gaVR.vrChess, w = window.__chessTable.frame.contentWindow; return V.legalFrom(w.chessApp, V.V.sel).map(m => (m >> 7) & 127).sort(); });
    chk(s1.last === 'select' && s1.sel === 0x14 && JSON.stringify(lg) === JSON.stringify([0x24, 0x34]), 'trigger on e2 selects the pawn; its legal moves (e3, e4) light up ' + JSON.stringify({ s1, lg }));
    const s2 = await tapSq('e5');   // not legal for this pawn: cancels
    chk(s2.last === 'clear' && s2.sel === -1, 'trigger on an unreachable empty square cancels the pick ' + JSON.stringify(s2));
    await tapSq('g1'); const s3 = await tapSq('f3');
    let sans = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.slice());
    chk(s3.last === 'move' && sans[0] === 'Nf3', 'select-then-target plays Ng1-f3 with the ray + trigger ' + JSON.stringify({ s3, sans }));
    const s4 = await tapSq('e2');
    chk(s4.last === 'wait' || s4.last === 'select', 'during Grok\'s turn a pick waits (no move) ' + JSON.stringify(s4));
    for (let i = 0; i < 120; i++) { const n = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.length); if (n >= 2) break; await H.frames(page, 4); }
    sans = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.slice());
    chk(sans.length >= 2, 'Grok replies (' + sans.join(' ') + ')');
    await H.frames(page, 6);
    const bd = await page.evaluate(() => { const V = window.__gaVR.vrChess, w = window.__chessTable.frame.contentWindow; return { key: V.V.key.split('|')[0] === Array.from(w.chessApp.pos.board).join(','), draws: V.V.draws }; });
    chk(bd.key, 'the immersive board shows the page\'s position after Grok\'s reply ' + JSON.stringify(bd));
    // a second move: e2-e4 (or another legal pawn push)
    const s5 = await tapSq('e2'); const s6 = await tapSq('e4');
    sans = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.slice());
    chk(s6.last === 'move' && sans.length >= 3 && /e4/.test(sans[2]), 'second move e2-e4 ' + JSON.stringify({ s5, s6, sans }));
    for (let i = 0; i < 120; i++) { const n = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.length); if (n >= 4) break; await H.frames(page, 4); }
    // UNDO button on the bar
    const nU = (await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.length));
    await H.aim(page, 'right', LOCAL, await btnW('undo')); await H.frames(page, 3);
    const hb = await page.evaluate(() => window.__gaVR.vrChess.V.hbtn);
    await H.press(page, 'right', 'trigger'); await H.frames(page, 4);
    const nU2 = await page.evaluate(() => ({ n: window.__chessTable.frame.contentWindow.chessApp.sans.length, last: window.__gaVR.chessLast }));
    chk(hb === 'undo' && nU2.last === 'undo' && nU2.n < nU, 'the ray lights the UNDO button; trigger undoes (' + nU + ' -> ' + nU2.n + ' moves)');
    // left hand works too
    await page.evaluate(() => { const w = window.__chessTable.frame.contentWindow; w.chessApp.newGame(); }); await H.frames(page, 6);
    const l1 = await tapSq('d2', 'left'); const l2 = await tapSq('d4', 'left');
    sans = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.slice());
    chk(l2.last === 'move' && sans[0] === 'd4', 'the left controller moves pieces too (d2-d4) ' + JSON.stringify({ l1, l2, sans }));
    for (let i = 0; i < 120; i++) { const n = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.length); if (n >= 2) break; await H.frames(page, 4); }
    const late = await profile('immersive, mid-game');
    chk(late.uploadsPerFrame < 0.1 && late.pumpsPerFrame <= 0.3 && late.calls < shop.calls, 'perf mid-game stays low ' + JSON.stringify(late));
    // X = back to the shop
    await H.press(page, 'left', 'x-button');
    await page.waitForFunction(() => window.__chessTable.state === 'idle', null, { timeout: 5000 }).catch(() => {});
    await H.frames(page, 4);
    const ex = await page.evaluate(() => { const S = window.__gaVR, tp = window.__tp, C = window.__chessTable; let pr = null; try { pr = JSON.parse(localStorage.getItem('arcade_chess.prefs.v1') || 'null'); } catch (e) {} return { s: C.state, on: S.chessImmOn(), flag: !!window.__chessImmersive, G: S.vrChess.G.visible, white: tp ? tp.whiteRoom.visible : null, backs: S.backs.chess, pr }; });
    chk(ex.s === 'idle' && !ex.on && !ex.flag && !ex.G && ex.white === true && ex.backs === 1, 'X = back to the shop: chess room gone, shop drawn again ' + JSON.stringify(ex));
    chk(!ex.pr || (ex.pr.robot !== false && ex.pr.battle !== false), 'robot / battle prefs were not saved as off ' + JSON.stringify(ex.pr));
    // sit again -> grip exits; prefs restored on the live page
    await page.waitForFunction(() => window.__chessTable.gstate === 'home', null, { timeout: 1000 }).catch(() => {});
    for (let i = 0; i < 80 && !(await page.evaluate(() => window.__chessTable.gstate === 'home')); i++) await H.frames(page, 3);
    await page.evaluate(() => { const S = window.__gaVR, C = window.__chessTable, x = C.CX - 2.4, z = C.CZ - 0.6; S.rig = { x, y: 0, z, yaw: 0.4 }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); });
    await H.frames(page, 4);
    await H.aim(page, 'right', LOCAL, tbl); await H.frames(page, 3); await H.press(page, 'right', 'trigger');
    await page.waitForFunction(() => window.__chessTable.state !== 'idle', null, { timeout: 5000 }).catch(() => {});
    await H.press(page, 'right', 'a-button');
    await page.waitForFunction(() => { try { return window.__gaVR.chessImmOn(); } catch (e) { return false; } }, null, { timeout: 30000 }).catch(() => {});
    for (let i = 0; i < 40 && !(await page.evaluate(() => window.__gaVR.chessImmOn())); i++) await H.frames(page, 3);
    const again = await page.evaluate(() => window.__gaVR.chessImmOn());
    const w2 = await page.evaluate(() => { const w = window.__chessTable.frame.contentWindow; return w.__chessWinRef = true; });
    await H.press(page, 'right', 'squeeze');
    await page.waitForFunction(() => window.__chessTable.state === 'idle', null, { timeout: 5000 }).catch(() => {});
    await H.frames(page, 3);
    const g2 = await page.evaluate(() => ({ s: window.__chessTable.state, on: window.__gaVR.chessImmOn(), backs: window.__gaVR.backs.chess, white: window.__tp.whiteRoom.visible }));
    chk(again && w2 && g2.s === 'idle' && !g2.on && g2.backs === 2 && g2.white, 'sit again -> immersive again; GRIP = back to the shop ' + JSON.stringify({ again, g2 }));
    chk(!errors.length, 'no page errors (VR) ' + errors.join(' | '));
  } finally { await o.close(); }
  if (PROFILE_ONLY) process.exit(0);
  // ---------------- flat Quest browser (2D tab): tap a piece, tap its square ----------------
  const QUA = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.0.0.0 SamsungBrowser/4.0 Chrome/128.0.0.0 VR Safari/537.36';
  o = await open({ phone: true, w: 800, h: 480, dsf: 1, ua: QUA, init: { content: CLEAN } }); page = o.page; errors = o.errors;
  try {
    await page.waitForFunction(() => window.__arcade && window.__shop && window.__chessTable && window.__shop.grok, null, { timeout: 90000 });
    await page.evaluate(() => { const A = window.__arcade, C = window.__chessTable; A.monkey.position.set(C.CX - 2.6, 0, C.CZ + 0.4); A.st.vel.set(0, 0, 0); A.st.yaw = Math.PI / 2 + 0.5; A.st.camInit = false; if (window.__tp) window.__tp.where = 2; });
    await page.waitForFunction(() => !!document.querySelector('#chessBtn.on'), null, { timeout: 10000 }).catch(() => {});
    await page.tap('#chessBtn');
    await page.waitForFunction(() => window.__chessTable.state !== 'idle', null, { timeout: 4000 }).catch(() => {});
    await page.waitForFunction(() => window.__chessTable.grokBusy !== undefined, null, { timeout: 1000 }).catch(() => {});
    await page.evaluate(() => { try { window.__chessTable.skip(); } catch (e) {} });
    await page.waitForFunction(() => { const C = window.__chessTable; try { return C.state === 'play' && C.frame.contentWindow.chessApp; } catch (e) { return false; } }, null, { timeout: 40000 }).catch(() => {});
    await page.evaluate(() => { const w = window.__chessTable.frame.contentWindow; if (w.chessApp.sans.length) w.chessApp.newGame(); });
    await page.waitForTimeout(400);
    const fl = await page.evaluate(() => ({ s: window.__chessTable.state, hid: window.__arcade.renderer.domElement.style.visibility, imm: !!window.__chessImmersive }));
    chk(fl.s === 'play' && fl.hid === 'hidden' && !fl.imm, 'flat Quest: the chess page covers the screen (3D canvas hidden, no immersive mode) ' + JSON.stringify(fl));
    const n0 = await page.evaluate(() => window.__arcade.powerSave.draws); await page.waitForTimeout(2000); const n1 = await page.evaluate(() => window.__arcade.powerSave.draws);
    const sqXY = sq => page.evaluate(sq => { const fr = window.__chessTable.frame.getBoundingClientRect(), w = window.__chessTable.frame.contentWindow, b = w.document.getElementById('board').getBoundingClientRect(), f = sq.charCodeAt(0) - 97, r = +sq[1], fl = w.chessApp.cfg.human === 8;
      const c = fl ? 7 - f : f, rw = fl ? r - 1 : 8 - r; return { x: fr.left + b.left + (c + 0.5) * b.width / 8, y: fr.top + b.top + (rw + 0.5) * b.height / 8 }; }, sq);
    for (const sq of ['e2', 'e4']) { const p = await sqXY(sq); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(300); }
    let fs = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.slice());
    chk(fs[0] === 'e4', 'flat Quest: tap e2, tap e4 plays the move ' + JSON.stringify(fs));
    await page.waitForFunction(() => window.__chessTable.frame.contentWindow.chessApp.sans.length >= 2 && !window.__chessTable.frame.contentWindow.chessApp.robot, null, { timeout: 30000 }).catch(() => {});
    for (const sq of ['g1', 'f3']) { const p = await sqXY(sq); await page.mouse.click(p.x, p.y); await page.waitForTimeout(300); }
    fs = await page.evaluate(() => window.__chessTable.frame.contentWindow.chessApp.sans.slice());
    chk(fs.length >= 3 && fs[2] === 'Nf3', 'flat Quest: controller trigger (click) g1 then f3 plays Nf3 ' + JSON.stringify(fs));
    const fps3d = (n1 - n0) / 2;
    chk(fps3d <= 3, 'flat: the hidden 3D arcade behind the chess page draws at ~2 fps (' + fps3d.toFixed(1) + ' draws/s)');
    console.log('INFO flat 3D frames/s while chess covers the screen: ' + fps3d);
    chk(!errors.length, 'no page errors (flat Quest) ' + errors.join(' | '));
  } finally { await o.close(); }
  console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL exception ' + (e && e.stack || e)); process.exit(1); });
