// CHESS (arcade copy only; injected after the chess UI script by tools_build_chess_play.py). The game itself (engine, medieval
// pieces, capture battles, robot hand, settings) is the standalone Chess unchanged. Added here:
//  - TICKETS: win a game vs the Computer -> Easy 5, Medium 10, Hard 20 gold tickets (the LOWEST level used during that game counts).
//    Once per game; no tickets if Undo was used in that game, for draws, losses, two-player games, or a finished game restored on load.
//    Paid by the arcade page (window.parent.__chessWin), which owns the ticket total. A +N banner shows inside the game.
//  - VR PAINTER (window.__chessVR): draws the whole chess page (board, pieces incl. slides / captures, battle sprites + FX canvas,
//    robot arm canvases + held piece, status, buttons, overlays) into one canvas, for the headset panel. A headset can't show the
//    page's DOM, so vr.js copies this canvas into a texture and sends ray taps back as pointer events at the same page coordinates.
(function () {
'use strict';
var A = window.chessApp; if (!A) return;
var LVL = { easy: 5, medium: 10, hard: 20 }, RANK = { easy: 0, medium: 1, hard: 2 };
var G = { paid: false, tainted: false, low: null, wins: 0, got: 0, last: 0, restored: !!A.over };
function low() { var l = A.cfg.level; if (G.low == null || RANK[l] < RANK[G.low]) G.low = l; return G.low; }
var undoEl = document.getElementById('undoBtn'); if (undoEl) undoEl.addEventListener('click', function () { if (A.sans.length) G.tainted = true; }, true);
var _undo = A.undo; A.undo = function () { G.tainted = true; return _undo.apply(this, arguments); };
var banner = document.createElement('div'); banner.id = 'gaChessWin';
banner.style.cssText = 'position:fixed;left:50%;top:30%;transform:translate(-50%,-50%);z-index:300;display:none;padding:14px 26px;border-radius:16px;border:3px solid #ffd54a;background:#1a1030ee;color:#ffe680;font:900 36px/1.15 "Arial Black",Impact,sans-serif;text-align:center;box-shadow:0 0 30px #ffd54a99;pointer-events:none;white-space:nowrap';
document.body.appendChild(banner);
function humanWon() { var c = A.cfg, o = A.over, e = A.ended; if (c.mode !== 'hvc' || !o) return false;
  if (o === 'checkmate') return (A.pos.turn ^ 8) === c.human; if (o === 'flag') return e && (e.loser ^ 8) === c.human; return false; }
function tick() {
  if (!A.sans.length) { G.paid = false; G.tainted = false; G.low = null; G.restored = false; }
  if (!A.over) { G.restored = false; low(); return; }
  if (G.paid || G.restored) return;
  G.paid = true;
  if (!humanWon() || G.tainted) return;
  var n = LVL[low()] || 5, ok = false;
  try { ok = !!(window.parent && window.parent !== window && window.parent.__chessWin && window.parent.__chessWin(window, n, low())); } catch (e) {}
  if (!ok) return;
  G.wins++; G.got += n; G.last = n;
  banner.innerHTML = 'YOU WIN!<br>+' + n + ' \uD83C\uDF9F TICKETS'; banner.style.display = 'block';
  clearTimeout(banner.t); banner.t = setTimeout(function () { banner.style.display = 'none'; }, 3500);
}
setInterval(tick, 250);
window.__chessArcade = { G: G, LVL: LVL, tick: tick, humanWon: humanWon };

/* ---------- VR painter ---------- */
var cv = document.createElement('canvas'), g = cv.getContext('2d'), IMG = {}, frames = 0;
function pieceImg(key) {   // 'w1'..'b6' -> Image of the page's own <symbol>
  var im = IMG[key]; if (im) return im.complete && im.naturalWidth ? im : null;
  var sym = document.getElementById('pc-' + key); if (!sym) return null;
  var src = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 45 45" width="180" height="180">' + sym.innerHTML + '</svg>';
  im = IMG[key] = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); return null; }
function keyOf(svg) { var u = svg.querySelector('use'); if (!u) return null; var h = u.getAttribute('href') || u.getAttribute('xlink:href') || ''; var m = /pc-([wb][1-6])/.exec(h); return m ? m[1] : null; }
function vis(el) { for (var e = el; e && e !== document.documentElement; e = e.parentElement) { var cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; } return 1; }
function alpha(el) { var a = 1; for (var e = el; e && e !== document.documentElement; e = e.parentElement) a *= +getComputedStyle(e).opacity; return a; }
function rr(x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); else g.rect(x, y, w, h); }
var COL = /rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi;
function bgFill(cs, r) {   // background colour or a (linear / radial) gradient approximated by its first + last colours
  var bi = cs.backgroundImage, c = cs.backgroundColor;
  if (bi && bi !== 'none') { var cols = bi.match(COL); if (cols && cols.length >= 2) {
    if (/radial/.test(bi)) { var gr = g.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 0, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) / 2); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[cols.length - 1]); return gr; }
    var lg = /90deg/.test(bi) ? g.createLinearGradient(r.x, 0, r.x + r.w, 0) : g.createLinearGradient(r.x, r.y, r.x + (/145deg/.test(bi) ? r.w : 0), r.y + r.h); lg.addColorStop(0, cols[0]); lg.addColorStop(1, cols[cols.length - 1]); return lg; } }
  if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; return null; }
function R(el) { var b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }
function box(el, cs) { var r = R(el); if (r.w < 1 || r.h < 1) return; var f = bgFill(cs, r); var rad = parseFloat(cs.borderTopLeftRadius) || 0;
  if (f) { g.fillStyle = f; rr(r.x, r.y, r.w, r.h, rad); g.fill(); }
  var bw = parseFloat(cs.borderTopWidth) || 0; if (bw >= 1 && cs.borderTopStyle !== 'none' && !/rgba\(.*, 0\)$/.test(cs.borderTopColor)) { g.strokeStyle = cs.borderTopColor; g.lineWidth = bw; rr(r.x + bw / 2, r.y + bw / 2, r.w - bw, r.h - bw, rad); g.stroke(); } }
function texts(el) {   // every visible text node under el, at its real layout position
  var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, rg = document.createRange();
  while ((n = w.nextNode())) { var t = n.nodeValue; if (!t || !t.trim()) continue; var p = n.parentElement; if (!p || !vis(p)) continue; var cs = getComputedStyle(p);
    rg.selectNodeContents(n); var rs = rg.getClientRects(); if (!rs.length) continue; var b = rs[0]; if (b.width < 1) continue;
    g.save(); g.globalAlpha = alpha(p); g.fillStyle = cs.color; g.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; g.textBaseline = 'middle'; g.textAlign = 'left';
    var s = t.replace(/\s+/g, ' ').trim(), pr = p.getBoundingClientRect(), maxW = Math.max(4, Math.min(pr.right, innerWidth) - b.left + 1);
    if (rs.length > 1) { var words = s.split(' '), line = '', li = 0; for (var i = 0; i < words.length; i++) { var tt = line ? line + ' ' + words[i] : words[i]; if (g.measureText(tt).width > (rs[li].width + 2) && line && li < rs.length - 1) { g.fillText(line, rs[li].left, rs[li].top + rs[li].height / 2); li++; line = words[i]; } else line = tt; } g.fillText(line, rs[li].left, rs[li].top + rs[li].height / 2); }
    else g.fillText(s, b.left, b.top + b.height / 2, maxW);
    g.restore(); } }
function pieceAt(svg, x, y, w, h, extraA) { var k = keyOf(svg), im = k && pieceImg(k); if (!im) return; var cs = getComputedStyle(svg), a = alpha(svg) * (extraA == null ? 1 : extraA); if (a < 0.01) return;
  g.save(); g.globalAlpha = a; var f = cs.filter; if (f && f !== 'none') g.filter = f; g.drawImage(im, x, y, w, h); g.restore(); }
function pieceEl(svg) { var r = R(svg); if (r.w < 2) return; pieceAt(svg, r.x, r.y, r.w, r.h); }
function sprite(sp) {   // absolutely placed sprite (battle / robot / drag ghost) with its full transform (rotate / scale) + opacity
  if (!vis(sp)) return; var cs = getComputedStyle(sp), svg = sp.querySelector('svg.pc'); if (!svg) return;
  var a = alpha(sp); if (a < 0.01) return; var w = sp.offsetWidth, h = sp.offsetHeight, par = sp.offsetParent, pr = par ? par.getBoundingClientRect() : { left: 0, top: 0 };
  if (cs.position === 'fixed') pr = { left: 0, top: 0 };
  var o = (cs.transformOrigin || '').split(' ').map(parseFloat), ox = isFinite(o[0]) ? o[0] : w / 2, oy = isFinite(o[1]) ? o[1] : h / 2, m = cs.transform && cs.transform !== 'none' ? new DOMMatrix(cs.transform) : new DOMMatrix();
  var sw = parseFloat(getComputedStyle(svg).width) || w, sh = parseFloat(getComputedStyle(svg).height) || h;
  g.save(); g.translate(pr.left + sp.offsetLeft + ox, pr.top + sp.offsetTop + oy); g.transform(m.a, m.b, m.c, m.d, m.e, m.f); g.translate(-ox, -oy);
  var f = getComputedStyle(svg).filter; if (f && f !== 'none') g.filter = f; g.globalAlpha = a * alpha(svg) / Math.max(0.0001, alpha(sp));
  var k = keyOf(svg), im = k && pieceImg(k); if (im) g.drawImage(im, (w - sw) / 2, (h - sh) / 2, sw, sh); g.restore(); }
function canvasEl(c) { if (!vis(c) || !c.width) return; var r = R(c); g.save(); g.globalAlpha = alpha(c); try { g.drawImage(c, r.x, r.y, r.w, r.h); } catch (e) {} g.restore(); }
function pseudo(sq, which, r) { var ps = getComputedStyle(sq, which); if (!ps || ps.content === 'none' || ps.content === 'normal') return;
  var bi = ps.backgroundImage, bc = ps.backgroundColor;
  if (bi && /radial/.test(bi)) { var gr = g.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 0, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.5); gr.addColorStop(0, 'rgba(255,40,40,.95)'); gr.addColorStop(0.6, 'rgba(230,0,0,.5)'); gr.addColorStop(1, 'rgba(200,0,0,0)'); g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h); return; }
  var pw = parseFloat(ps.width), ph = parseFloat(ps.height), bw = parseFloat(ps.borderTopWidth) || 0, round = parseFloat(ps.borderTopLeftRadius) || 0;
  var x = r.x, y = r.y, w = r.w, h = r.h; if (ps.inset && ps.inset !== 'auto') { var ins = parseFloat(ps.top); if (isFinite(ins)) { x += ins; y += ins; w -= 2 * ins; h -= 2 * ins; } }
  if (isFinite(pw) && pw > 0 && pw < r.w * 0.9) { w = pw; h = ph || pw; x = r.x + (r.w - w) / 2; y = r.y + (r.h - h) / 2; }
  if (/%/.test(ps.borderTopLeftRadius) || round >= w / 2 - 0.5) round = /18%/.test(ps.borderTopLeftRadius) ? w * 0.18 : Math.min(w, h) / 2;
  if (bc && bc !== 'rgba(0, 0, 0, 0)') { g.fillStyle = bc; rr(x, y, w, h, round); g.fill(); }
  if (bw > 0 && ps.borderTopStyle !== 'none') { g.strokeStyle = ps.borderTopColor; g.lineWidth = bw; rr(x + bw / 2, y + bw / 2, w - bw, h - bw, round); g.stroke(); } }
function board() {
  var sqs = document.querySelectorAll('#board .sq'), i, sq, r, cs, pcs = [];
  for (i = 0; i < sqs.length; i++) { sq = sqs[i]; r = R(sq); cs = getComputedStyle(sq); g.fillStyle = cs.backgroundColor; g.fillRect(r.x, r.y, r.w + 0.5, r.h + 0.5); pseudo(sq, '::before', r);
    if (cs.boxShadow && cs.boxShadow !== 'none') { g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = Math.max(2, r.w / 18); g.strokeRect(r.x + g.lineWidth / 2, r.y + g.lineWidth / 2, r.w - g.lineWidth, r.h - g.lineWidth); } }
  for (i = 0; i < sqs.length; i++) { var co = sqs[i].querySelectorAll('.coord'); for (var j = 0; j < co.length; j++) texts(co[j]); }
  for (i = 0; i < sqs.length; i++) { sq = sqs[i]; var gh = sq.querySelector('.cap-ghost svg.pc'); if (gh) pieceEl(gh); }
  for (i = 0; i < sqs.length; i++) { sq = sqs[i]; var pc = sq.querySelector(':scope > svg.pc'); if (pc) pcs.push([+(getComputedStyle(pc).zIndex) || 0, i, pc]); }
  pcs.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }); pcs.forEach(function (p) { pieceEl(p[2]); });
  for (i = 0; i < sqs.length; i++) { sq = sqs[i]; pseudo(sq, '::after', R(sq)); } }
function paintTree(root) {   // boxes + texts + mini pieces of a panel (header, bars, status, buttons, moves, cards)
  if (!root || !vis(root)) return; var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
  for (var i = 0; i < all.length; i++) { var el = all[i]; if (el.closest('#board') || el.closest('svg')) { if (el.matches && el.matches('svg.pc') && !el.closest('#board') && vis(el)) pieceEl(el); continue; }
    if (!vis(el)) continue; var cs = getComputedStyle(el); g.save(); g.globalAlpha = alpha(el); box(el, cs);
    if (el.tagName === 'SELECT') { var r = R(el); g.fillStyle = cs.color; g.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; g.textBaseline = 'middle'; g.fillText((el.options[el.selectedIndex] || {}).text || '', r.x + 6, r.y + r.h / 2, r.w - 12); }
    g.restore(); }
  texts(root); }
function draw() {
  var W = innerWidth, H = innerHeight; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none';
  var bg = g.createRadialGradient(W * 0.2, 0, 0, W * 0.2, 0, Math.max(W, H)); bg.addColorStop(0, '#2a3042'); bg.addColorStop(0.45, '#1b1f2a'); bg.addColorStop(1, '#0f1218'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  paintTree(document.querySelector('header')); paintTree(document.querySelector('.pbar#barTop')); paintTree(document.querySelector('.pbar#barBottom'));
  var fr = document.getElementById('frame'); if (fr) { var cs = getComputedStyle(fr), r = R(fr); g.fillStyle = bgFill(cs, r) || '#4a3220'; rr(r.x, r.y, r.w, r.h, parseFloat(cs.borderTopLeftRadius) || 10); g.fill(); }
  board();
  paintTree(document.querySelector('aside.panel'));
  var rf = document.querySelector('.rfx'); if (rf) { var cs2 = rf.querySelectorAll('canvas'); if (cs2[0]) canvasEl(cs2[0]); var rs = rf.querySelector('.rsprite'); if (rs) sprite(rs); if (cs2[1]) canvasEl(cs2[1]); }
  var bx = document.querySelectorAll('.bfx'); for (var i = 0; i < bx.length; i++) { var sp = bx[i].querySelectorAll('.bsprite'); for (var j = 0; j < sp.length; j++) sprite(sp[j]); var bc = bx[i].querySelector('canvas'); if (bc) canvasEl(bc); }
  ['promo', 'overlay'].forEach(function (id) { var e = document.getElementById(id); if (e && vis(e)) paintTree(e); });
  var gh = document.querySelector('body > .ghost'); if (gh) sprite(gh);
  ['toast', 'dlg', 'gaChessWin'].forEach(function (id) { var e = document.getElementById(id); if (e && vis(e)) paintTree(e); });
  frames++; return cv; }
window.__chessVR = { draw: draw, get canvas() { return cv; }, get frames() { return frames; }, pieceImg: pieceImg, ready: function () { var k = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6']; return k.every(function (x) { return !!pieceImg(x); }); } };
try { window.__chessVR.ready(); } catch (e) {}
})();
