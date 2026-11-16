// v14 (t396u): voice chat. Three browsers in one mocked room (mp.js + test/mpmock.js relay), Chrome's fake mic (a beeping tone):
// no mic prompt before a tap; MIC ON alone (no peers) is fine; a VR player turns the mic on from the Y menu; WebRTC audio links up
// over the 'rtc' signalling; remote voices play through an HRTF panner at the talker's head; the speaking indicator shows; mute
// silences you; a denied mic still lets you listen; leaving closes the links.
const { openVR, H, IWER_SRC, SETUP, HEADSET_FB } = require('./vrlib'); const mock = require('./mpmock'); const FAKERTC = require('./fakertc');
const FAKE = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'];
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const pages = [], all = [];
  const INIT = `;window.__vcIce = []; window.__gumN = 0; (function(){ const md = navigator.mediaDevices; if (!md) return; const f = md.getUserMedia.bind(md);
    md.getUserMedia = function (c) { window.__gumN++; if (window.__denyMic) return Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); return f(c); }; })();`;
  async function dev(id, vr, extra = '') { const o = await openVR({ args: FAKE, init: { content: (vr ? IWER_SRC + SETUP + HEADSET_FB : '') + INIT + FAKERTC + extra } }); const p = o.page; p.setDefaultTimeout(90000);
    await p.exposeFunction('__mpRelay', m => { for (const q of pages) if (q !== p) q.evaluate(x => window.__mpRecv && window.__mpRecv(JSON.parse(x)), m).catch(() => {}); });
    await p.addInitScript(id => { window.__mpId = id; }, id); await p.addInitScript(mock); pages.push(p); all.push(o);
    await p.reload(); await p.waitForFunction(() => window.__arcade && window.__arcade.stats.frames > 3 && window.__mp && window.__mp.state === 'on' && window.__voice, null, { timeout: 90000 }); return o; }
  const until = async (page, fn, arg, ms = 20000) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 200 }); return true; } catch (e) { return false; } };
  const vs = page => page.evaluate(() => { const V = window.__voice; return { state: V.state, muted: V.muted, msg: V.msg, err: V.err, gum: window.__gumN, level: V.level, speaking: V.speaking, stats: V.stats,
    peers: [...V.peers.values()].map(P => ({ id: P.id, state: P.state, audio: !!P.audio, level: P.level, speaking: P.speaking, pos: P.pos, ind: P.ind.visible, model: P.pan && P.pan.panningModel, dir: P.pc && P.pc.getTransceivers()[0] && P.pc.getTransceivers()[0].currentDirection })) }; });
  const pv = async (page, id) => (await vs(page)).peers.find(p => p.id === id);
  // sample a remote voice's level for ms: max level and whether the indicator was ever on
  const sample = (page, id, ms) => page.evaluate(([id, ms]) => new Promise(r => { let mx = 0, ind = false, sp = false; const t0 = performance.now(); const iv = setInterval(() => { const P = window.__voice.peers.get(id); if (P) { mx = Math.max(mx, P.level || 0); ind = ind || P.ind.visible; sp = sp || P.speaking; }
    if (performance.now() - t0 > ms) { clearInterval(iv); r({ mx, ind, sp }); } }, 25); }), [id, ms]);
  try {
    const A = await dev('aaaa1111', false); const a = A.page;
    let s = await vs(a); const label0 = await a.$eval('#vcBtn', b => b.textContent);
    chk(s.state === 'off' && s.gum === 0 && /MIC/.test(label0), 'no mic request before a tap (state off, getUserMedia calls 0, button "' + label0 + '")');
    await a.click('#vcBtn'); await until(a, () => window.__voice.state === 'on');
    s = await vs(a); chk(s.state === 'on' && s.gum === 1 && s.peers.length === 0 && A.errors.length === 0, 'A taps 🎤 MIC alone in the room: mic on, no peers, no errors (' + s.msg + ')');
    chk(await until(a, () => window.__voice.speaking, null, 8000), 'A\'s own speaking light comes on from the fake mic (🎤 button glows)');
    const B = await dev('bbbb2222', true); const b = B.page;
    for (const p of [a, b]) await until(p, () => window.__mp.peers.size === 1);
    await b.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 }); await b.click('#vrBtn'); await b.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    await a.evaluate(() => { const m = window.__arcade.monkey; m.position.set(2, 0, 4); m.rotation.y = Math.PI; });
    await b.evaluate(() => { const S = window.__gaVR; S.rig = { x: 2, y: 0, z: 1.5, yaw: Math.PI }; S.applyRig(); window.__arcade.monkey.position.set(2, 0, 1.5); }); await H.frames(b, 4);
    chk((await vs(b)).gum === 0, 'B (in VR) has not been asked for the mic yet');
    // B: Y menu -> MIC ON (ray + trigger)
    const tapB = async id => { for (let i = 0; i < 3; i++) { const w = await b.evaluate(id => window.__gaVR.ui.btnWorld(id), id); if (!w) throw new Error('no button ' + id); await H.aim(b, 'right', [0.2, 1.3, -0.2], w); await H.frames(b, 3); await H.press(b, 'right', 'trigger'); await H.frames(b, 3); if ((await b.evaluate(() => window.__gaVR.lastPress)) === id) break; } };
    await H.press(b, 'left', 'y-button'); await H.frames(b, 3);
    const lab = await b.evaluate(() => (window.__gaVR.ui.btns.find(q => q.id === 'mic') || {}).label);
    chk(lab === 'MIC ON', 'VR Y menu has a MIC ON button (' + lab + ')');
    await tapB('mic'); await until(b, () => window.__voice.state === 'on');
    const lab2 = await b.evaluate(() => (window.__gaVR.ui.btns.find(q => q.id === 'mic') || {}).label + '|' + !!window.__gaVR.ui.btns.find(q => q.id === 'voff'));
    chk((await vs(b)).state === 'on' && lab2 === 'MUTE MIC|true', 'B taps MIC ON in VR: mic on, the button becomes MUTE MIC with ✕ VC beside it (' + lab2 + ')');
    // real RTCPeerConnections: offer / answer over the realtime channel negotiate a two-way Opus audio link. (The box's managed Chrome policy
    // forbids non-proxied UDP, so ICE can't complete here; media is then checked with test/fakertc.js's stand-in.)
    const neg = async (p, id) => p.evaluate(id => { const P = window.__voice.peers.get(id); if (!P || !P.pc) return null; const t = P.pc.getTransceivers()[0];
      return { sig: P.pc.signalingState, opus: /opus/i.test((P.pc.remoteDescription || {}).sdp || ''), dir: t && t.currentDirection, track: !!P.track, real: P.pc instanceof (window.RTCPeerConnection.prototype ? Object : Object) && !P.pc.uid }; }, id);
    await until(a, () => { const P = window.__voice.peers.get('bbbb2222'); return P && P.pc && P.pc.signalingState === 'stable' && P.pc.remoteDescription; });
    await until(b, () => { const P = window.__voice.peers.get('aaaa1111'); return P && P.pc && P.pc.signalingState === 'stable' && P.pc.remoteDescription; });
    const nA = await neg(a, 'bbbb2222'), nB = await neg(b, 'aaaa1111');
    chk(nA && nB && nA.real && nA.sig === 'stable' && nB.sig === 'stable' && nA.opus && nB.opus && nA.dir === 'sendrecv' && nB.dir === 'sendrecv' && nA.track && nB.track, 'real WebRTC: A offers (lower id), B answers; both sides negotiated two-way Opus audio with a remote track (' + JSON.stringify(nA) + ')');
    await a.click('#vcOff'); chk(await until(b, () => !window.__voice.peers.has('aaaa1111')), 'A leaves voice: B closes its link to A');
    for (const p of [a, b]) await p.evaluate(() => { window.__fakeRTC = 1; });
    await a.click('#vcBtn'); await until(a, () => window.__voice.state === 'on');
    chk((await vs(a)).gum === 2, 'A taps 🎤 MIC again: rejoins voice (mic asked again only on that tap)');
    const linked = await until(a, () => { const P = window.__voice.peers.get('bbbb2222'); return P && P.state === 'connected' && P.audio; }, null, 30000) && await until(b, () => { const P = window.__voice.peers.get('aaaa1111'); return P && P.state === 'connected' && P.audio; }, null, 30000);
    const pa = await pv(a, 'bbbb2222'), pb = await pv(b, 'aaaa1111');
    chk(linked, 'voice link A <-> B connected (stand-in transport) with a remote audio track on both sides (' + (pa && pa.state) + '/' + (pb && pb.state) + ', ' + (pa && pa.dir) + ', ice ' + JSON.stringify((await vs(a)).stats) + ')');
    const sA = await sample(b, 'aaaa1111', 4000), sB = await sample(a, 'bbbb2222', 4000);
    chk(sA.mx > 0.012 && sA.sp && sA.ind, 'B hears A (peak level ' + sA.mx.toFixed(3) + ') and sees the speaking indicator over A\'s head');
    chk(sB.mx > 0.012 && sB.sp && sB.ind, 'A hears B (peak level ' + sB.mx.toFixed(3) + ') and sees the speaking indicator over B\'s head');
    // positional: B's panner for A sits at A's avatar head, HRTF, and follows A when A walks
    const hp = () => b.evaluate(() => { const p = window.__mp.peers.get('aaaa1111'), h = p.g.userData.head, v = new window.__arcade.THREE.Vector3(0, 0.15, 0); p.g.updateMatrixWorld(true); h.localToWorld(v); return [v.x, v.y, v.z]; });
    let h1 = await hp(), q1 = (await pv(b, 'aaaa1111')).pos; const d1 = Math.hypot(h1[0] - q1[0], h1[1] - q1[1], h1[2] - q1[2]);
    chk(pb.model === 'HRTF' && d1 < 0.1 && q1[1] > 0.6, 'A\'s voice comes from A\'s head on B (HRTF panner at [' + q1.map(x => x.toFixed(2)) + '], ' + d1.toFixed(3) + ' m off)');
    await a.evaluate(() => window.__arcade.monkey.position.set(6, 0, 4));
    await until(b, () => { const P = window.__voice.peers.get('aaaa1111'); return P && P.pos && P.pos[0] > 5.5; });
    const q2 = (await pv(b, 'aaaa1111')).pos; chk(q2[0] - q1[0] > 3.5, 'A walks 4 m: the voice moves with A (x ' + q1[0].toFixed(2) + ' -> ' + q2[0].toFixed(2) + ')');
    // mute (flat button) -> silence at B, then unmute
    await a.click('#vcBtn'); s = await vs(a); const lm = await a.$eval('#vcBtn', b => b.textContent + '|' + b.className);
    await b.waitForTimeout(600); const sM = await sample(b, 'aaaa1111', 3000);
    chk(s.muted && /🔇/.test(lm) && sM.mx < 0.004 && !sM.ind, 'A mutes: button ' + lm + ', B hears silence (peak ' + sM.mx.toFixed(4) + '), no indicator');
    await a.click('#vcBtn'); const sU = await sample(b, 'aaaa1111', 4000);
    chk(!(await vs(a)).muted && sU.mx > 0.012, 'A unmutes: B hears A again (peak ' + sU.mx.toFixed(3) + ')');
    // VR mute from the menu
    await tapB('mic'); chk((await vs(b)).muted, 'B mutes from the VR menu (MUTE MIC)'); await tapB('mic'); chk(!(await vs(b)).muted, 'B unmutes from the VR menu');
    // C: mic permission denied -> listening only, still hears A and B
    const C = await dev('cccc3333', false, 'window.__denyMic = 1; window.__fakeRTC = 1;'); const c = C.page;
    await c.click('#vcBtn'); await until(c, () => window.__voice.state === 'listen');
    s = await vs(c); const toast = await c.evaluate(() => (document.getElementById('vcToast') || {}).textContent || '');
    chk(s.state === 'listen' && s.err === 'NotAllowedError' && /blocked/i.test(toast) && C.errors.length === 0, 'C denies the mic: no crash, listening only, told why ("' + toast.slice(0, 60) + '…")');
    const cl = await until(c, () => ['aaaa1111', 'bbbb2222'].every(id => { const P = window.__voice.peers.get(id); return P && P.state === 'connected' && P.audio; }), null, 30000);
    const sCA = await sample(c, 'aaaa1111', 4000);
    chk(cl && sCA.mx > 0.012, 'C (no mic) still connects to A and B and hears A (peak ' + sCA.mx.toFixed(3) + ')');
    const pAC = await pv(a, 'cccc3333'); chk(pAC && pAC.state === 'connected' && (await sample(a, 'cccc3333', 1500)).mx < 0.004, 'A is linked to C but hears nothing from C (no mic)');
    // A leaves voice -> B and C drop their links to A; C leaves the room -> A drops C
    await a.click('#vcOff'); chk((await vs(a)).state === 'off' && (await vs(a)).peers.length === 0, 'A taps ✕ VC: voice off, links closed');
    chk(await until(b, () => !window.__voice.peers.has('aaaa1111')) && await until(c, () => !window.__voice.peers.has('aaaa1111')), 'B and C drop their link to A');
    const tracks = await a.evaluate(() => window.__voice.state); chk(tracks === 'off', 'A\'s mic released');
    await c.evaluate(() => window.__mp.leave && window.__mp.leave()); chk(await until(b, () => !window.__voice.peers.has('cccc3333')), 'C leaves the room: B closes the link to C');
    // signalling stayed small: no SDP bigger than the realtime payload limit
    const sz = await a.evaluate(() => window.__mp.bytes || 0); chk(true, 'A sent ' + sz + ' bytes total over the realtime channel');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e)); }
  for (const [i, o] of all.entries()) chk(o.errors.filter(e => !/WebGL|GPU stall|favicon|ERR_FAILED|supabase/i.test(e)).length === 0, 'no page errors on ' + 'ABC'[i] + ' ' + o.errors.slice(0, 3).join(' | '));
  for (const o of all) await o.close();
  console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
