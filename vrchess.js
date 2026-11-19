// v17 (t403u, Dave: 'VR chess is laggy and pieces are impossible to move'): IMMERSIVE VR CHESS. Once the chess game is up at the shop
// table, the headset gets its own chess scene: a dark starry dome around you hides the shop (main.js stops drawing the white room / shop
// while it is up), a big tilted board in front of you (0.84 m, each square ~10.5 cm) drawn by THIS module from the chess page's real
// position + its own piece pictures, and a status / button bar above it. Ray + trigger: pick one of your pieces (its legal moves light
// up), then pick a lit square (pawns promote to a queen); pick another of your pieces to switch, empty / illegal = cancel. Moves go
// into the page's own engine (chessApp.playUci), so the computer, clocks, tickets and saves are unchanged. The board texture is only
// redrawn when something on it changes (was: the whole DOM page re-painted + a 1180x720 upload every 2nd frame), and the page's robot
// arm + capture battles are switched off while you play in the headset (restored afterwards). GRIP or X = back to the shop.
import * as THREE from 'three';
const FILES = 'abcdefgh';
export function createVRChess({ scene }) {
  const G = new THREE.Group(); G.name = 'vrChessRoom'; G.visible = false; scene.add(G);
  // dome: dark blue-violet gradient + stars, drawn behind everything (no depth write), big enough to hide the shop around you
  const dc = document.createElement('canvas'); dc.width = 512; dc.height = 256; { const g = dc.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#05030c'); gr.addColorStop(0.5, '#14102a'); gr.addColorStop(0.62, '#1d1636'); gr.addColorStop(1, '#07050e'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 420; i++) { const y = Math.random() * 150; g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.7})`; g.fillRect(Math.random() * 512, y, Math.random() < 0.1 ? 2 : 1, 1); } }
  const dt = new THREE.CanvasTexture(dc); dt.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 16), new THREE.MeshBasicMaterial({ map: dt, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }));
  dome.name = 'vrChessDome'; dome.renderOrder = -10; G.add(dome);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshBasicMaterial({ color: 0x120c22, fog: false, toneMapped: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.005; floor.renderOrder = -9; G.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.2, 64), new THREE.MeshBasicMaterial({ color: 0x7f5cff, fog: false, toneMapped: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006; G.add(ring);
  // board (canvas texture, square) on a tilted "table" in front of you
  const BS = 0.84, BC = 1024, bc = document.createElement('canvas'); bc.width = bc.height = 1; /* TEST v1: full size only while you play (mem()) */ const bg = bc.getContext('2d'), bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace; bt.anisotropy = 4;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BS, BS), new THREE.MeshBasicMaterial({ map: bt, fog: false, toneMapped: false })); board.name = 'vrChessBoard';
  const frame = new THREE.Mesh(new THREE.BoxGeometry(BS + 0.08, BS + 0.08, 0.03), new THREE.MeshBasicMaterial({ color: 0x4a3220, fog: false, toneMapped: false })); frame.position.z = -0.017;
  const tbl = new THREE.Group(); tbl.add(frame, board); G.add(tbl);
  // status + buttons bar
  const PW = 0.9, PH = 0.2, pc = document.createElement('canvas'); pc.width = 1; pc.height = 1; const pg = pc.getContext('2d'), ptx = new THREE.CanvasTexture(pc); ptx.colorSpace = THREE.SRGBColorSpace;
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: ptx, transparent: true, fog: false, toneMapped: false })); bar.name = 'vrChessBar'; G.add(bar);
  const BTN = [{ id: 'new', label: 'NEW GAME', x: 24 }, { id: 'undo', label: 'UNDO', x: 362 }, { id: 'exit', label: 'EXIT  (GRIP / X)', x: 700 }];
  const V = { on: false, sel: -1, hover: -1, hbtn: null, key: '', bkey: '', draws: 0, bdraws: 0, moves: 0, picks: 0, lastErr: null, flip: false, msg: '', msgT: 0 };
  const _p = new THREE.Vector3(), _l = new THREE.Vector3(), _pl = new THREE.Plane(), _n = new THREE.Vector3();
  // place everything around the head: board ~0.62 m ahead, centre 0.42 m below the eyes, tilted 40 degrees toward you
  function place(head) {   // head: { x, y, z, yaw } (yaw: facing = -z rotated by yaw, as vr.js S.head)
    G.position.set(head.x, 0, head.z); G.rotation.set(0, head.yaw, 0); G.updateMatrixWorld(true);
    tbl.position.set(0, Math.max(0.55, head.y - 0.42), -0.62); tbl.rotation.set(-Math.PI / 2 + 0.7, 0, 0);
    bar.position.set(0, Math.max(0.8, head.y - 0.42) + 0.43, -0.98); bar.rotation.set(-0.15, 0, 0);
    G.updateMatrixWorld(true); }
  // squares: 0x88 index; white at the bottom unless you play black
  const sqXY = sq => { let f = sq & 7, r = sq >> 4; if (V.flip) { f = 7 - f; r = 7 - r; } return [f, 7 - r]; };
  const xySq = (c, rw) => { let f = c, r = 7 - rw; if (V.flip) { f = 7 - f; r = 7 - r; } return r * 16 + f; };
  function legalFrom(A, sq) { const out = []; try { for (const m of A.pos.legalMoves()) if ((m & 127) === sq) out.push(m); } catch (e) {} return out; }
  const uci = m => { const f = m & 127, t = (m >> 7) & 127, p = (m >> 14) & 15; return FILES[f & 7] + ((f >> 4) + 1) + FILES[t & 7] + ((t >> 4) + 1) + (p ? ' nbrq'[p - 1] : ''); };
  function lastMove(A) { try { const n = A.pos.ply, m = A.pos.sMove && A.pos.sMove[n - 1]; return m ? [m & 127, (m >> 7) & 127] : null; } catch (e) { return null; } }
  function drawBoard(w, A) {
    const b = A.pos.board, Q = BC / 8, sel = V.sel, tg = sel >= 0 ? legalFrom(A, sel).map(m => (m >> 7) & 127) : [], lm = lastMove(A);
    bg.clearRect(0, 0, BC, BC);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const sq = xySq(c, r), light = ((sq & 7) + (sq >> 4)) % 2 === 1; bg.fillStyle = light ? '#ecd9b4' : '#a8784c'; bg.fillRect(c * Q, r * Q, Q, Q);
      if (lm && (sq === lm[0] || sq === lm[1])) { bg.fillStyle = 'rgba(255,214,60,.38)'; bg.fillRect(c * Q, r * Q, Q, Q); } }
    if (sel >= 0) { const [c, r] = sqXY(sel); bg.fillStyle = 'rgba(60,255,160,.55)'; bg.fillRect(c * Q, r * Q, Q, Q); }
    if (V.hover >= 0) { const [c, r] = sqXY(V.hover); bg.strokeStyle = '#3ff3ff'; bg.lineWidth = 10; bg.strokeRect(c * Q + 5, r * Q + 5, Q - 10, Q - 10); }
    // king in check
    try { if (A.pos.inCheck && A.pos.inCheck()) for (let s = 0; s < 128; s++) if (!(s & 0x88) && (b[s] & 7) === 6 && (b[s] & 8) === A.pos.turn) { const [c, r] = sqXY(s); const gr = bg.createRadialGradient(c * Q + Q / 2, r * Q + Q / 2, 4, c * Q + Q / 2, r * Q + Q / 2, Q * 0.7); gr.addColorStop(0, 'rgba(255,40,40,.9)'); gr.addColorStop(1, 'rgba(255,40,40,0)'); bg.fillStyle = gr; bg.fillRect(c * Q, r * Q, Q, Q); } } catch (e) {}
    const P = w.__chessVR;
    for (let s = 0; s < 128; s++) { if (s & 0x88) continue; const pc = b[s]; if (!pc) continue; const [c, r] = sqXY(s), im = P && P.pieceImg((pc & 8 ? 'b' : 'w') + (pc & 7));
      if (im) bg.drawImage(im, c * Q + Q * 0.06, r * Q + Q * 0.06, Q * 0.88, Q * 0.88); else { bg.fillStyle = pc & 8 ? '#111' : '#fff'; bg.font = '900 ' + (Q * 0.5) + 'px sans-serif'; bg.textAlign = 'center'; bg.textBaseline = 'middle'; bg.fillText(' PNBRQK'[pc & 7], c * Q + Q / 2, r * Q + Q / 2); } }
    for (const t of tg) { const [c, r] = sqXY(t), cap = !!b[t]; bg.fillStyle = 'rgba(40,220,120,.85)'; bg.strokeStyle = 'rgba(40,220,120,.95)'; bg.lineWidth = 12;
      if (cap) { bg.beginPath(); bg.arc(c * Q + Q / 2, r * Q + Q / 2, Q * 0.44, 0, 7); bg.stroke(); } else { bg.beginPath(); bg.arc(c * Q + Q / 2, r * Q + Q / 2, Q * 0.17, 0, 7); bg.fill(); } }
    bg.font = '700 22px sans-serif'; bg.textBaseline = 'top'; bg.textAlign = 'left';
    for (let i = 0; i < 8; i++) { const f = V.flip ? 7 - i : i, rk = V.flip ? i + 1 : 8 - i; bg.fillStyle = (i % 2) ? '#ecd9b4' : '#a8784c'; bg.fillText(FILES[f], i * Q + 6, BC - 28); bg.fillStyle = (i % 2) ? '#a8784c' : '#ecd9b4'; bg.fillText(String(rk), 6, i * Q + 6); }
    bt.needsUpdate = true; V.draws++; }
  function status(A) { const c = A.cfg, o = A.over, me = c.human, turn = A.pos.turn;
    if (o) { if (o === 'checkmate') return (turn ^ 8) === me && c.mode === 'hvc' ? 'CHECKMATE - YOU WIN!' : c.mode === 'hvc' ? 'CHECKMATE - GROK WINS' : 'CHECKMATE'; return 'GAME OVER: ' + String(o).toUpperCase(); }
    if (c.mode === 'hvc' && turn !== me) return A.thinking ? 'GROK IS THINKING...' : "GROK'S MOVE";
    return V.sel >= 0 ? 'NOW PICK A GREEN SQUARE' : 'YOUR MOVE: PICK A PIECE'; }
  function drawBar(A) { const s = (V.msgT > 0 ? V.msg : status(A)), key = s + '|' + V.hbtn; if (key === V.bkey) return; V.bkey = key;
    pg.clearRect(0, 0, 1024, 228); pg.fillStyle = 'rgba(16,10,34,.92)'; pg.beginPath(); pg.roundRect(4, 4, 1016, 220, 26); pg.fill(); pg.strokeStyle = '#7f5cff'; pg.lineWidth = 5; pg.stroke();
    pg.fillStyle = '#ffe680'; pg.font = '900 50px "Arial Black",sans-serif'; pg.textAlign = 'center'; pg.textBaseline = 'middle'; pg.fillText(s, 512, 62);
    for (const b of BTN) { const hv = V.hbtn === b.id; pg.fillStyle = hv ? '#3ff3ff' : '#2a2050'; pg.beginPath(); pg.roundRect(b.x, 124, 300, 84, 20); pg.fill(); pg.strokeStyle = '#3ff3ff'; pg.lineWidth = 4; pg.stroke();
      pg.fillStyle = hv ? '#0a0614' : '#e6fdff'; pg.font = '900 ' + (b.id === 'exit' ? 30 : 38) + 'px sans-serif'; pg.fillText(b.label, b.x + 150, 166); }
    ptx.needsUpdate = true; V.bdraws++; }
  function frameUpdate(w, A, dt) { if (V.msgT > 0) V.msgT -= dt; V.flip = A.cfg.human === 8;
    let key = ''; try { key = A.pos.board.join(',') + '|' + A.pos.turn + '|' + V.sel + '|' + V.hover + '|' + A.pos.ply + '|' + !!(w.__chessVR && w.__chessVR.ready()); } catch (e) { key = 'x'; }
    if (key !== V.key) { V.key = key; try { drawBoard(w, A); } catch (e) { V.lastErr = String(e); } }
    drawBar(A); }
  // ray -> what it points at: { kind: 'sq', sq, p, t } | { kind: 'btn', id, p, t } | null
  function hit(ray) { for (const [m, kind] of [[board, 'sq'], [bar, 'btn']]) { m.updateMatrixWorld(); _n.set(0, 0, 1).transformDirection(m.matrixWorld); m.getWorldPosition(_p); _pl.setFromNormalAndCoplanarPoint(_n, _p);
      const t = ray.distanceToPlane(_pl); if (t == null || t <= 0 || t > 6) continue; const p = ray.at(t, new THREE.Vector3()); m.worldToLocal(_l.copy(p));
      if (kind === 'sq') { const u = _l.x / BS + 0.5, v = 0.5 - _l.y / BS; if (u < 0 || u >= 1 || v < 0 || v >= 1) continue; return { kind, sq: xySq(Math.floor(u * 8), Math.floor(v * 8)), p, t }; }
      const u = (_l.x / PW + 0.5) * 1024, v = (0.5 - _l.y / PH) * 228; if (u < 0 || u > 1024 || v < 0 || v > 228) continue;
      const b = BTN.find(b => u >= b.x - 10 && u <= b.x + 310 && v >= 110 && v <= 222); return { kind, id: b ? b.id : null, p, t }; }
    return null; }
  function say(m) { V.msg = m; V.msgT = 1.6; V.bkey = ''; }
  // trigger on a square: select-then-target
  function pick(A, sq) { V.picks++; const c = A.cfg, mine = sq >= 0 ? A.pos.board[sq] : 0, myTurn = !A.over && (c.mode !== 'hvc' || A.pos.turn === c.human) && A.viewPly < 0;
    if (!myTurn) { V.sel = -1; say(A.over ? 'GAME OVER - NEW GAME?' : 'WAIT FOR GROK'); return 'wait'; }
    if (V.sel >= 0) { const ms = legalFrom(A, V.sel).filter(m => ((m >> 7) & 127) === sq);
      if (ms.length) { const m = ms.find(m => ((m >> 14) & 15) === 0 || ' nbrq'[((m >> 14) & 15) - 1] === 'q') || ms[0]; const ok = A.playUci(uci(m), { noSlide: true }); V.sel = -1; if (ok) { V.moves++; return 'move'; } say('MOVE NOT ALLOWED'); return 'bad'; } }
    if (mine && (mine & 8) === A.pos.turn && legalFrom(A, sq).length) { V.sel = sq === V.sel ? -1 : sq; return 'select'; }
    if (mine && (mine & 8) === A.pos.turn) { V.sel = -1; say('THAT PIECE CANNOT MOVE'); return 'stuck'; }
    V.sel = -1; return 'clear'; }
  // TEST v1 (VR memory): the 1024x1024 board + 1024x228 bar canvases (and their GPU textures) exist only while you are seated at chess.
  // Off: canvases shrink to 1x1 and the textures are freed. Same materials (programs) either way, so nothing compiles when you sit.
  const M = { on: false, ons: 0, offs: 0 };
  function mem(on) { on = !!on; if (on === M.on) return; M.on = on; if (on) M.ons++; else M.offs++;
    bc.width = bc.height = on ? BC : 1; pc.width = on ? 1024 : 1; pc.height = on ? 228 : 1;
    for (const t of [bt, ptx]) { try { t.dispose(); } catch (e) {} if (on) t.needsUpdate = true; }
    V.key = ''; V.bkey = ''; }
  return { G, dome, board, bar, V, M, mem, place, frameUpdate, hit, pick, say, BTN, uci, legalFrom };
}
