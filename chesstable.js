// CHESS TABLE (Dave, VR edition): a big stylish chess table + two throne chairs in Grok's shop, between the ACCESSORIES wardrobe and the
// pool tables. PLAY CHESS (flat button near the table, or point + trigger at the table / its sign in VR) sits you in your chair; Grok
// walks over from the shop counter and sits opposite; then the flat camera zooms into the board and the chess game opens (chess-play/,
// the standalone Chess unchanged: medieval pieces, capture battles, robot hand). In VR the board appears as a panel over the table.
// ✕ / Escape / grip (VR, Quest) stands you up; Grok walks back to the counter. Free to play; a win vs the Computer pays
// Easy 5 / Medium 10 / Hard 20 tickets (chess-play decides, this page pays through window.__chessWin). The 3D pieces on the table
// follow the live game. Built by shop.js (shop-local coords; the shop group sits at world x = WXp).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CHESS = { CX: 6.6, CZ: 7.6, TOP: 0.78, HALF: 0.68, CHAIR: 1.08, BOX: { x0: 6.6 - 1.4, x1: 6.6 + 1.4, z0: 7.6 - 0.74, z1: 7.6 + 0.74 } };

export function setupChessTable({ G, WXp, grok, legs, arms, head, home, play, st, getMonkey, camera, tp, flagTex }) {
  const { CX, CZ, TOP, HALF, CHAIR } = CHESS, SQ = 0.115, BH = SQ * 4;
  const T = new THREE.Group(); T.name = 'chessTable'; T.position.set(CX, 0, CZ); G.add(T);
  const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const strip = g => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g.index ? g.toNonIndexed() : g; };
  const merge = list => mergeGeometries(list.map(strip));
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a1d0c, roughness: 0.38, metalness: 0.08 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b04a, roughness: 0.28, metalness: 0.85, emissive: 0x3a2400, emissiveIntensity: 0.6 });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x8e1428, roughness: 0.85, emissive: 0x200006 });
  // ---- table: heavy walnut top with a gold rim, carved pedestal, four claw feet, cyan + purple neon under-glow ----
  T.add(Object.assign(new THREE.Mesh(merge([box(2 * HALF, 0.07, 2 * HALF, 0, TOP - 0.035, 0), box(2 * HALF - 0.16, 0.08, 2 * HALF - 0.16, 0, TOP - 0.11, 0),
    new THREE.CylinderGeometry(0.13, 0.19, TOP - 0.2, 12).translate(0, (TOP - 0.2) / 2 + 0.06, 0), new THREE.CylinderGeometry(0.2, 0.13, 0.12, 12).translate(0, TOP - 0.2, 0),
    ...[0, 1, 2, 3].map(i => box(0.13, 0.08, 0.62, 0, 0.04, 0.3).rotateY(i * Math.PI / 2 + Math.PI / 4))]), wood), { name: 'chessTableWood' }));
  T.add(Object.assign(new THREE.Mesh(merge([box(2 * HALF + 0.03, 0.025, 0.03, 0, TOP + 0.005, HALF), box(2 * HALF + 0.03, 0.025, 0.03, 0, TOP + 0.005, -HALF),
    box(0.03, 0.025, 2 * HALF + 0.03, HALF, TOP + 0.005, 0), box(0.03, 0.025, 2 * HALF + 0.03, -HALF, TOP + 0.005, 0),
    new THREE.TorusGeometry(0.16, 0.018, 6, 20).rotateX(Math.PI / 2).translate(0, 0.45, 0), new THREE.TorusGeometry(0.19, 0.02, 6, 20).rotateX(Math.PI / 2).translate(0, TOP - 0.15, 0),
    ...[0, 1, 2, 3].map(i => new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0.05, 0.6).rotateY(i * Math.PI / 2 + Math.PI / 4))]), gold), { name: 'chessTableGold' }));
  const glowC = new THREE.MeshBasicMaterial({ color: 0x40f0ff, toneMapped: false }), glowP = new THREE.MeshBasicMaterial({ color: 0xc04dff, toneMapped: false });
  T.add(Object.assign(new THREE.Mesh(merge([box(2 * HALF - 0.12, 0.012, 0.012, 0, TOP - 0.155, HALF - 0.075), box(2 * HALF - 0.12, 0.012, 0.012, 0, TOP - 0.155, -HALF + 0.075),
    box(0.012, 0.012, 2 * HALF - 0.12, HALF - 0.075, TOP - 0.155, 0), box(0.012, 0.012, 2 * HALF - 0.12, -HALF + 0.075, TOP - 0.155, 0)]), glowC), { name: 'chessTableNeon' }));
  T.add(Object.assign(new THREE.Mesh(new THREE.RingGeometry(1.0, 1.06, 48).rotateX(-Math.PI / 2).translate(0, 0.006, 0), glowP), { name: 'chessFloorRing' }));
  // ---- the board inlay: maple / walnut squares (the chess app's colours), gold frame, file + rank letters ----
  const bc = document.createElement('canvas'); bc.width = bc.height = 512; const bg = bc.getContext('2d');
  bg.fillStyle = '#2a1408'; bg.fillRect(0, 0, 512, 512); bg.fillStyle = '#d9a640'; bg.fillRect(20, 20, 472, 472);
  const B0 = 32, BS = (512 - 2 * B0) / 8;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { bg.fillStyle = (r + f) % 2 ? '#b3845f' : '#f0dab5'; bg.fillRect(B0 + f * BS, B0 + r * BS, BS, BS); }
  bg.fillStyle = '#2a1408'; bg.font = '700 15px Arial, sans-serif'; bg.textAlign = 'center'; bg.textBaseline = 'middle';
  for (let i = 0; i < 8; i++) { bg.fillText('abcdefgh'[i], B0 + (i + 0.5) * BS, 512 - 13); bg.fillText(String(8 - i), 13, B0 + (i + 0.5) * BS); }
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace; bt.anisotropy = 4; if (flagTex) try { flagTex(bt, THREE); } catch (e) {}
  // the board is seen from the player's chair (-x side): white's rank 1 nearest the player -> rotate so 'a1' is on the player's left
  const BW = BH * 2 * (512 / (512 - 2 * B0));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BW, BW).rotateX(-Math.PI / 2).rotateY(-Math.PI / 2).translate(0, TOP + 0.002, 0), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.32, metalness: 0.05 }));
  board.name = 'chessBoardInlay'; T.add(board);
  // ---- 3D pieces (lathe-turned Staunton shapes; one instanced mesh per type, cream or ebony by instance colour), they mirror the live game ----
  const lathe = (pts, extra) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 14); return extra ? merge([g, ...extra]) : strip(g); };
  const base = [[0, 0], [0.036, 0], [0.038, 0.008], [0.03, 0.014], [0.024, 0.02]];
  const PG = { 1: lathe([...base, [0.013, 0.04], [0.016, 0.046], [0.019, 0.058], [0.012, 0.07], [0, 0.072]]),
    2: lathe([...base, [0.02, 0.04], [0.024, 0.05]], [box(0.026, 0.05, 0.05, 0, 0.068, 0.006), box(0.022, 0.025, 0.04, 0, 0.082, 0.026).rotateX(0.5)]),
    3: lathe([...base, [0.014, 0.05], [0.02, 0.058], [0.016, 0.075], [0.019, 0.085], [0.008, 0.1], [0.004, 0.106], [0, 0.108]]),
    4: lathe([...base, [0.02, 0.05], [0.026, 0.056], [0.026, 0.08], [0.02, 0.08], [0.02, 0.074], [0, 0.074]]),
    5: lathe([...base, [0.014, 0.06], [0.022, 0.08], [0.026, 0.1], [0.016, 0.104], [0.01, 0.112], [0, 0.114]]),
    6: lathe([...base, [0.015, 0.065], [0.024, 0.09], [0.02, 0.108], [0, 0.11]], [box(0.008, 0.032, 0.008, 0, 0.122, 0), box(0.022, 0.008, 0.008, 0, 0.126, 0)]) };
  const pieceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 });
  const PI = {}, CREAM = new THREE.Color(0xf4e6c4), EBONY = new THREE.Color(0x2a2730), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
  for (const t in PG) { const m = new THREE.InstancedMesh(PG[t], pieceMat, 10); m.name = 'chessPieces' + t; m.count = 0; m.frustumCulled = false; T.add(m); PI[t] = m; }
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  // square (file 0..7, rank 0..7) -> table-local (x toward Grok = rank up, z = file to the player's left... a-file on the player's left)
  const sqPos = (f, r) => V.set((r - 3.5) * SQ, TOP + 0.003, (3.5 - f) * SQ);
  let shownKey = '';
  function showBoard(cells) {   // cells: array of [file, rank, type 1..6, black?]
    const key = cells.map(c => c.join('')).join(','); if (key === shownKey) return; shownKey = key;
    for (const t in PI) PI[t].count = 0;
    for (const [f, r, t, b] of cells) { const m = PI[t]; if (!m || m.count >= 10) continue; const i = m.count++;
      Q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t === 2 ? (b ? Math.PI / 2 : -Math.PI / 2) : 0); m.setMatrixAt(i, M4.compose(sqPos(f, r).clone(), Q, S1)); m.setColorAt(i, b ? EBONY : CREAM); }
    for (const t in PI) { PI[t].instanceMatrix.needsUpdate = true; if (PI[t].instanceColor) PI[t].instanceColor.needsUpdate = true; } }
  const FEN_T = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
  function fenCells(fen) { const out = []; fen.split('/').forEach((row, i) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) { f += +ch; continue; } out.push([f, 7 - i, FEN_T[ch.toLowerCase()], ch === ch.toLowerCase() ? 1 : 0]); f++; } }); return out; }
  showBoard(fenCells(START));
  function liveCells(w) { try { const A = w && w.chessApp; if (!A || !A.pos) return null; const b = A.pos.board, out = [];
      for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const pc = b[r * 16 + f]; if (pc) out.push([f, r, pc & 7, pc & 8 ? 1 : 0]); } return out; } catch (e) { return null; } }
  // ---- two throne chairs: walnut frame, red velvet seat + back, gold crest and finials ----
  const SEAT = 0.5;
  const chairWood = merge([box(0.56, 0.06, 0.54, 0, SEAT - 0.03, 0), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => box(0.06, SEAT - 0.06, 0.06, a * 0.24, (SEAT - 0.06) / 2, b * 0.23)),
    box(0.62, 1.05, 0.07, 0, SEAT + 0.5, -0.26), box(0.06, 0.26, 0.42, -0.28, SEAT + 0.16, 0), box(0.06, 0.26, 0.42, 0.28, SEAT + 0.16, 0), box(0.09, 0.04, 0.5, -0.28, SEAT + 0.3, 0.01), box(0.09, 0.04, 0.5, 0.28, SEAT + 0.3, 0.01)]);
  const chairVel = merge([box(0.48, 0.07, 0.46, 0, SEAT + 0.035, 0.02), box(0.48, 0.82, 0.03, 0, SEAT + 0.47, -0.215)]);
  const chairGold = merge([new THREE.CylinderGeometry(0.31, 0.31, 0.05, 20, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, SEAT + 1.02, -0.26),
    new THREE.SphereGeometry(0.04, 8, 6).translate(-0.31, SEAT + 1.05, -0.26), new THREE.SphereGeometry(0.04, 8, 6).translate(0.31, SEAT + 1.05, -0.26), new THREE.SphereGeometry(0.055, 8, 6).translate(0, SEAT + 1.36, -0.26),
    box(0.5, 0.025, 0.02, 0, SEAT + 0.07, 0.25)]);
  const mkChair = (name) => { const c = new THREE.Group(); c.name = name; c.add(new THREE.Mesh(chairWood, wood), new THREE.Mesh(chairVel, velvet), new THREE.Mesh(chairGold, gold)); T.add(c); return c; };
  const chairP = mkChair('chessChairPlayer'), chairG = mkChair('chessChairGrok');
  chairP.position.set(-CHAIR, 0, 0); chairP.rotation.y = Math.PI / 2;    // faces +x (the table) ; chair local +z = its front
  chairG.position.set(CHAIR, 0, 0); chairG.rotation.y = -Math.PI / 2;   // faces -x
  // ---- floating neon sign over the table ----
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 128; { const g = sc.getContext('2d'); g.font = '900 64px "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const gr = g.createLinearGradient(60, 0, 452, 0); gr.addColorStop(0, '#ffe14a'); gr.addColorStop(1, '#ff9f1a'); g.shadowColor = '#ffb020'; g.shadowBlur = 22; g.lineWidth = 9; g.strokeStyle = gr; g.strokeText('\u265E CHESS', 256, 66); g.shadowBlur = 0; g.lineWidth = 2; g.strokeStyle = '#fff'; g.strokeText('\u265E CHESS', 256, 66); }
  const st2 = new THREE.CanvasTexture(sc); st2.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Group(); sign.name = 'chessSign'; sign.position.set(0, 2.55, 0); T.add(sign);   // two faces back to back: reads right from both sides
  for (const ry of [-Math.PI / 2, Math.PI / 2]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: st2, transparent: true, depthWrite: false, toneMapped: false })); f.rotation.y = ry; sign.add(f); }

  // ---------- flat UI: PLAY CHESS button, the game overlay (iframe + ✕), SKIP while Grok walks ----------
  const css = document.createElement('style'); css.textContent = '#chessBtn{position:fixed;left:50%;bottom:calc(max(22px,env(safe-area-inset-bottom)) + 6px);transform:translateX(-50%);z-index:24;display:none;min-width:150px;height:58px;padding:0 26px;border-radius:29px;border:3px solid #ffd54a;background:#2a1a04e8;color:#fff4d0;font:900 20px/1 "Courier New",monospace;letter-spacing:.12em;box-shadow:0 0 16px #ffd54aaa,inset 0 0 12px #ffd54a55;text-shadow:0 0 8px #ffd54a;cursor:pointer;touch-action:none;white-space:nowrap}#chessBtn.on{display:block}' +
    '#chessSkip{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:calc(max(22px,env(safe-area-inset-bottom)) + 6px);z-index:24;display:none;height:44px;padding:0 18px;border-radius:22px;border:2px solid #ffd54a;background:#000a;color:#ffe9a8;font:900 16px "Courier New",monospace;cursor:pointer}#chessSkip.on{display:block}' +
    '#chessOv{position:fixed;inset:0;z-index:60;display:none;background:#0f1218;opacity:0;transition:opacity .45s}#chessOv.on{display:block}#chessOv.show{opacity:1}#chessOv iframe{position:absolute;inset:0;width:100%;height:100%;border:0}#chessOv.vr iframe{width:1180px;height:720px;inset:auto;left:0;top:0}' +
    '#chessX{position:absolute;top:max(4px,env(safe-area-inset-top));right:max(4px,env(safe-area-inset-right));z-index:2;height:40px;padding:0 14px;border-radius:20px;border:1px solid #fff5;background:#000b;color:#fff;font:700 15px system-ui;cursor:pointer}';
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'chessBtn'; btn.textContent = '\u265E PLAY CHESS'; document.body.appendChild(btn);
  const skipB = document.createElement('button'); skipB.id = 'chessSkip'; skipB.textContent = 'SKIP \u23E9'; document.body.appendChild(skipB);
  const ov = document.createElement('div'); ov.id = 'chessOv'; ov.innerHTML = '<button id="chessX" aria-label="Stand up">\u2715 STAND UP</button>'; document.body.appendChild(ov);
  const SRC = new URL('./chess-play/index.html', import.meta.url).href;
  const stop = e => e.stopPropagation();
  for (const el of [btn, skipB, ov]) { el.addEventListener('pointerdown', stop); el.addEventListener('touchstart', stop, { passive: true }); }
  btn.addEventListener('click', e => { e.stopPropagation(); api.start(); });
  skipB.addEventListener('click', e => { e.stopPropagation(); api.skip(); });
  ov.querySelector('#chessX').addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); api.exit('x'); });
  addEventListener('keydown', e => { if (api.state === 'idle') { if (api.near && (e.code === 'KeyE' || e.code === 'Enter') && btn.classList.contains('on')) { api.start(); e.preventDefault(); e.stopImmediatePropagation(); } return; }
    if (e.code === 'Escape') { api.exit('esc'); e.preventDefault(); } e.stopImmediatePropagation(); }, true);

  // ---------- state ----------
  const W = (lx, lz) => new THREE.Vector3(WXp + CX + lx, 0, CZ + lz);   // table-local -> world
  const seatP = W(-CHAIR, 0), seatG = { x: CX + CHAIR, z: CZ }, standP = W(-CHAIR - 0.72, 0);
  const api = window.__chessTable = { CX: WXp + CX, CZ, seat: seatP, standAt: standP, state: 'idle', gstate: 'home', seated: false, grokBusy: false, near: false, frame: null, src: SRC,
    plays: 0, exits: 0, wins: 0, paid: 0, skips: 0, sits: 0, T, sign, board, chairs: [chairP, chairG], pieces: PI, BOX: CHESS.BOX, WXp };
  const isVR = () => !!(st && st.vr);
  let t = 0, pT = 0, p0 = null, f0 = 0, cam0 = null, at0 = null, gPath = [], gT = 0, gPh = 0, gK = 0;
  const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
  const angTo = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  const busyElse = () => { const P = window.__pool, Sh = window.__shop; return (tp && tp.locked) || (play && play.mode && play.mode !== 'walk') || (P && P.open) || (Sh && Sh.open) || !!(window.__wardrobe && window.__wardrobe.isOpen) || !!document.querySelector('#inv.on') || !!(st && st.fly && st.fly.air); };
  const inShop = () => { const m = getMonkey(); return !!m && m.position.x > WXp / 2; };
  api.canStart = () => api.state === 'idle' && api.gstate === 'home' && inShop() && !busyElse();
  api.start = function () { if (!api.canStart()) return false; const m = getMonkey(); if (!m) return false;
    api.state = 'sit'; pT = 0; p0 = m.position.clone(); f0 = st.face || 0; api.seated = true; st.seated = 'chess'; st.vel && st.vel.set(0, 0, 0); api.plays++; api.sits++; btn.classList.remove('on');
    const k = window.__arcade && window.__arcade.keys; if (k) for (const c in k) k[c] = false;
    grokGo(); return true; };
  api.skip = function () { if (api.gstate === 'walk' || api.gstate === 'sitdown' || api.gstate === 'turn') { api.skips++; gPath = []; placeGrok(seatG.x, seatG.z, -Math.PI / 2); api.gstate = 'seated'; sitPose(1); }
    if (api.state === 'sit') { pT = 1; } if (api.state === 'zoom') pT = 9; };
  api.exit = function (why) { if (api.state === 'idle' || api.state === 'stand') return false; api.exits++; api.lastExit = why || '';
    closeFrame(); api.state = 'stand'; pT = 0; skipB.classList.remove('on'); return true; };
  // ---- the player ----
  function seatPose(m, k) { const u = m.userData; if (!u || !u.hips) return;
    u.hips.position.y = THREE.MathUtils.lerp(0.8, 0.62, k); u.legs.forEach(l => { l.leg.rotation.x = -1.45 * k; l.knee.rotation.x = 1.4 * k; });
    u.torso.rotation.set(0.06 * k, 0, 0); if (u.neck) u.neck.rotation.x = 0.25 * k;
    u.arms.forEach(a => { a.sh.rotation.x = -0.9 * k; a.sh.rotation.z = 0.2 * a.sd * k; a.el.rotation.x = -0.6 * k; }); }
  api.pose = function (m, s) {   // main.js step(): after the walk animation, before the camera
    if (!api.seated) return; const k = api.state === 'sit' ? ease(pT / 0.8) : api.state === 'stand' ? 1 - ease(pT / 0.6) : 1;
    const to = api.state === 'stand' ? standP : seatP, from = api.state === 'stand' ? seatP : p0 || seatP, kk = api.state === 'stand' ? ease(pT / 0.6) : k;
    m.position.x = THREE.MathUtils.lerp(from.x, to.x, kk); m.position.z = THREE.MathUtils.lerp(from.z, to.z, kk); m.position.y = 0;
    s.face = api.state === 'sit' ? angTo(f0, Math.PI / 2, k) : Math.PI / 2; m.rotation.y = s.face; s.vel.set(0, 0, 0); s.speed = 0;
    seatPose(m, k); };
  // ---- Grok: walk from the counter, sit opposite, walk back ----
  const clerkY = () => home.yaw;
  function placeGrok(x, z, yaw) { grok.position.set(x, 0, z); grok.rotation.set(0, yaw, 0); }
  function sitPose(k) { const s = grok.scale.y || 0.6; for (const l of legs) { l.thigh.rotation.x = -1.5 * k; l.shin.rotation.x = 1.5 * k; }
    grok.position.y = (0.5 - 0.72 * s + 0.02) * k;
    for (const a of arms) { a.sh.rotation.x = THREE.MathUtils.lerp(-0.1, -1.0, k); a.sh.rotation.z = a.sd * THREE.MathUtils.lerp(0.14, 0.05, k); a.el.rotation.x = THREE.MathUtils.lerp(-1.0, -0.55, k); a.el.rotation.z = 0; } }
  function walkPose(ph, on) { for (const l of legs) { l.thigh.rotation.x = on ? Math.sin(ph) * 0.55 * l.sd : 0; l.shin.rotation.x = on ? Math.max(0, -Math.cos(ph) * l.sd) * 0.7 : 0; }
    for (const a of arms) { a.sh.rotation.x = on ? -Math.sin(ph) * 0.45 * a.sd : -0.1; a.sh.rotation.z = a.sd * 0.14; a.el.rotation.x = on ? -0.5 : -1.0; a.el.rotation.z = 0; } }
  const EXIT = { x: home.qx + 2.6 * Math.cos(0.35), z: home.qz + 2.6 * Math.sin(0.35) };   // through the counter's gap (+x side)
  const SIDE = { x: seatG.x, z: seatG.z - 0.68 }, TURN = { x: 8.45, z: 5.7 };
  function grokGo() { api.grokBusy = true; api.gstate = 'walk'; gK = 0; gPath = [{ x: home.x, z: home.z }, EXIT, TURN, SIDE]; gT = 0; skipB.classList.toggle('on', !isVR()); }
  function grokBack() { gT = 0; if (api.gstate === 'walk' || api.gstate === 'turn') { walkPose(0, false); api.gstate = 'back'; gPath = [{ x: grok.position.x, z: grok.position.z }, EXIT, { x: home.x, z: home.z }]; gK = 0; return; }   // left before he sat: turn round
    if (api.gstate === 'seated' || api.gstate === 'sitdown') api.gstate = 'standup'; }
  const GSPD = 1.45;
  function stepPath(dt) { if (gPath.length < 2) return true; const a = gPath[0], b = gPath[1], d = Math.hypot(b.x - a.x, b.z - a.z) || 1e-3; gK += GSPD * dt / d;
    if (gK >= 1) { gPath.shift(); gK = 0; if (gPath.length < 2) { placeGrok(b.x, b.z, grok.rotation.y); return true; } return false; }
    const x = a.x + (b.x - a.x) * gK, z = a.z + (b.z - a.z) * gK, yaw = Math.atan2(b.x - a.x, b.z - a.z);
    grok.position.set(x, Math.abs(Math.sin(gPh)) * 0.02, z); grok.rotation.y = angTo(grok.rotation.y, yaw, Math.min(1, dt * 8)); gPh += dt * 7.5; walkPose(gPh, true); return false; }
  function grokUpdate(dt) { gT += dt;
    if (api.gstate === 'walk') { if (stepPath(dt)) { api.gstate = 'turn'; gT = 0; } return; }
    if (api.gstate === 'turn') { walkPose(0, false); grok.rotation.y = angTo(grok.rotation.y, -Math.PI / 2, Math.min(1, dt * 6)); if (gT > 0.4) { api.gstate = 'sitdown'; gT = 0; } return; }
    if (api.gstate === 'sitdown') { const k = ease(gT / 0.7); grok.position.x = SIDE.x; grok.position.z = THREE.MathUtils.lerp(SIDE.z, seatG.z, k); grok.rotation.y = -Math.PI / 2; sitPose(k); if (gT >= 0.7) { api.gstate = 'seated'; gT = 0; } return; }
    if (api.gstate === 'seated') { sitPose(1); head.rotation.y = Math.sin(t * 0.6) * 0.15; head.rotation.x = 0.25 + Math.sin(t * 1.3) * 0.03; grok.position.y = (0.5 - 0.72 * (grok.scale.y || 0.6) + 0.02) + Math.sin(t * 1.6) * 0.004; return; }
    if (api.gstate === 'standup') { const k = 1 - ease(gT / 0.6); grok.position.z = THREE.MathUtils.lerp(SIDE.z, seatG.z, k); sitPose(k); head.rotation.x = 0;
      if (gT >= 0.6) { api.gstate = 'back'; gPath = [SIDE, TURN, EXIT, { x: home.x, z: home.z }]; gK = 0; } return; }
    if (api.gstate === 'back') { if (stepPath(dt)) { api.gstate = 'home'; walkPose(0, false); placeGrok(home.x, home.z, clerkY()); for (const a of arms) { a.sh.rotation.set(-0.1, 0, a.sd * 0.14); a.el.rotation.set(-1.0, 0, 0); } api.grokBusy = false; api.grokHomes = (api.grokHomes || 0) + 1; } } }
  // ---- the chess game (flat overlay iframe; in VR the same iframe is painted onto the headset panel by vr.js) ----
  function openFrame() { if (api.frame) return; const f = api.frame = document.createElement('iframe'); f.src = SRC; f.title = 'Chess'; f.allow = 'autoplay'; ov.appendChild(f); ov.classList.toggle('vr', isVR()); ov.classList.add('on');
    requestAnimationFrame(() => ov.classList.add('show')); api.opens = (api.opens || 0) + 1;
    f.addEventListener('load', () => { if (api.frame !== f) return; try { f.contentWindow.addEventListener('keydown', e => { if (e.code === 'Escape') { e.preventDefault(); api.exit('esc'); } }, true); if (!isVR()) f.contentWindow.focus(); } catch (e) {} }, { once: true });
    if (!isVR()) setTimeout(() => { if (api.frame === f && api.state === 'play') { const cv = window.__arcade && window.__arcade.renderer && window.__arcade.renderer.domElement; if (cv) cv.style.visibility = 'hidden'; } }, 500); }
  function closeFrame() { const f = api.frame; api.frame = null; ov.classList.remove('show', 'on', 'vr'); if (f) { try { if (f.contentWindow && f.contentWindow.__gaRelease) f.contentWindow.__gaRelease(); } catch (e) {} try { f.src = 'about:blank'; } catch (e) {} f.remove(); }
    const cv = window.__arcade && window.__arcade.renderer && window.__arcade.renderer.domElement; if (cv) cv.style.visibility = ''; try { window.focus(); } catch (e) {} }
  window.__chessWin = (w, n, lvl) => { const f = api.frame; if (!f || w !== f.contentWindow || api.state !== 'play') return false; n = Math.max(1, Math.min(20, n | 0));
    const P = play || (window.__arcade && window.__arcade.play); if (P && P.addTickets) P.addTickets(n); else return false; api.wins++; api.paid += n; api.lastWin = { n, lvl }; return true; };
  // ---- flat camera: smooth zoom from behind the seated player down into the board ----
  const camEnd = () => ({ pos: [WXp + CX - 0.42, TOP + 1.25, CZ], at: [WXp + CX + 0.06, TOP, CZ] });   // over the player's shoulder, looking down onto the board
  function zoomCam(k) { const e = camEnd(), q = ease(k); window.__camOverride = { pos: cam0.map((v, i) => v + (e.pos[i] - v) * q), at: at0.map((v, i) => v + (e.at[i] - v) * q), showMonkey: true, chess: 1 }; }
  function releaseCam() { if (window.__camOverride && window.__camOverride.chess) window.__camOverride = null; }   // main.js eases the camera back from here (no snap)
  api.update = function (dt) { t += dt; const m = getMonkey(); if (!m) return;
    if (api.gstate !== 'home') grokUpdate(dt);
    // near: within ~1.9 m of the table's edge, in the shop, not busy
    const lx = m.position.x - WXp - CX, lz = m.position.z - CZ, dEdge = Math.hypot(Math.max(0, Math.abs(lx) - 1.4), Math.max(0, Math.abs(lz) - 0.74));
    api.dist = dEdge; api.near = api.state === 'idle' && inShop() && dEdge < 1.3 && !busyElse();
    btn.classList.toggle('on', api.near && !isVR() && api.gstate === 'home' && !(window.__pool && window.__pool.near));
    // live position on the 3D table
    const cells = api.frame ? liveCells(api.frame.contentWindow) : null; if (cells) showBoard(cells); else if (api.state === 'idle' && shownKey && api.gstate === 'home' && api.resetBoard !== false) showBoard(fenCells(START));
    if (api.state === 'idle') return;
    pT += dt;
    if (api.state === 'sit') { if (pT >= 0.8) { api.state = 'wait'; pT = 0; } return; }
    if (api.state === 'wait') { if (api.gstate === 'seated') { skipB.classList.remove('on'); if (isVR()) { api.state = 'play'; openFrame(); } else { api.state = 'zoom'; pT = 0; camera.updateMatrixWorld(); cam0 = camera.position.toArray(); at0 = [m.position.x, 1.25, m.position.z]; } } return; }
    if (api.state === 'zoom') { zoomCam(Math.min(1, pT / 1.5)); if (pT >= 1.5) { api.state = 'play'; pT = 0; openFrame(); } return; }
    if (api.state === 'play') { if (!isVR() && window.__camOverride && window.__camOverride.chess) zoomCam(1); return; }
    if (api.state === 'stand') { releaseCam();
      if (pT >= 0.6) { api.state = 'idle'; api.seated = false; st.seated = null; seatPose(m, 0); m.position.copy(standP); st.face = -Math.PI / 2; m.rotation.y = st.face; grokBack(); } } };
  api.vrStand = () => api.exit('grip');
  return api;
}
