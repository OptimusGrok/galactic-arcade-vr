// v14 voice chat: WebRTC peer audio (mesh, max 10) with signalling over the multiplayer realtime channel ('rtc' broadcasts).
// Mic permission is only requested from a user tap (MIC ON). Remote voices are positional (Web Audio HRTF panner at each
// player's head); a green speaking indicator floats above any avatar that is talking. Public STUN only, no TURN.
import * as THREE from 'three';

export function setupVoice({ mp, camera, scene, monkey }) {
  const ICE = () => (Array.isArray(window.__vcIce) ? window.__vcIce : [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]);
  const V = { state: 'off', muted: false, msg: '', peers: new Map(), level: 0, speaking: false, stats: { offers: 0, answers: 0, ice: 0, tracks: 0, fails: 0, gum: 0, closed: 0 }, err: '' };
  window.__voice = V;
  let ctx = null, local = null, localAn = null, master = null, timer = 0, retryAt = new Map();
  const me = () => mp && mp.id;
  const log = s => { V.msg = s; try { toast(s); } catch (e) {} if (V.onMsg) try { V.onMsg(s); } catch (e) {} };
  const sig = pl => { if (!mp || !mp.rtcSend) return false; return mp.rtcSend(pl); };

  // ---------- indicator sprites ----------
  let tex = null;
  function indTex() { if (tex) return tex; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#39ff8a'; g.strokeStyle = '#39ff8a'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(12, 26); g.lineTo(22, 26); g.lineTo(34, 14); g.lineTo(34, 50); g.lineTo(22, 38); g.lineTo(12, 38); g.closePath(); g.fill();
    for (const r of [10, 18]) { g.beginPath(); g.arc(36, 32, r, -0.9, 0.9); g.stroke(); }
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex; }
  function mkInd() { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: indTex(), transparent: true, depthWrite: false, toneMapped: false })); s.name = 'vcSpeak'; s.scale.setScalar(0.32); s.visible = false; s.renderOrder = 5; scene.add(s); return s; }
  const selfInd = mkInd();
  const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _q = new THREE.Quaternion();
  function headOf(g, out, up) { const h = (g.userData && g.userData.head) || g; g.updateMatrixWorld(true); out.set(0, up, 0); h.localToWorld(out);
    if (!(g.userData && g.userData.head)) out.y += 1.6; return out; }

  // ---------- audio graph ----------
  function audio() { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; }
  const rms = an => { const a = an._b || (an._b = new Float32Array(an.fftSize)); an.getFloatTimeDomainData(a); let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); };
  function wire(P, stream) { const c = audio(); if (!c) return;
    // Chrome only feeds a remote WebRTC stream into Web Audio if the stream is also playing in a media element (muted here)
    if (!P.el) { P.el = document.createElement('audio'); P.el.autoplay = true; P.el.muted = true; P.el.setAttribute('playsinline', ''); P.el.style.display = 'none'; document.body.appendChild(P.el); }
    P.el.srcObject = stream; const pr = P.el.play && P.el.play(); if (pr && pr.catch) pr.catch(() => {});
    try { if (P.src) P.src.disconnect(); } catch (e) {}
    P.src = c.createMediaStreamSource(stream); P.an = c.createAnalyser(); P.an.fftSize = 512;
    if (!P.pan) { const p = c.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.2; p.maxDistance = 40; p.rolloffFactor = 1; P.pan = p; P.gain = c.createGain(); p.connect(P.gain); P.gain.connect(master); }
    P.src.connect(P.an); P.src.connect(P.pan); P.audio = true; }
  function setPos(node, pre, x, y, z) { if (node[pre + 'X']) { node[pre + 'X'].value = x; node[pre + 'Y'].value = y; node[pre + 'Z'].value = z; } else if (pre === 'position') node.setPosition(x, y, z); }

  // ---------- peer connections ----------
  function peer(id) { let P = V.peers.get(id); if (P) return P; P = { id, pc: null, q: [], state: 'new', level: 0, speaking: false, holdTo: 0, ind: mkInd(), inVoice: true }; V.peers.set(id, P); return P; }
  function closePeer(id, why) { const P = V.peers.get(id); if (!P) return; V.peers.delete(id); V.stats.closed++;
    try { P.pc && P.pc.close(); } catch (e) {} try { P.src && P.src.disconnect(); P.pan && P.pan.disconnect(); P.gain && P.gain.disconnect(); } catch (e) {}
    if (P.el) { try { P.el.srcObject = null; P.el.remove(); } catch (e) {} } if (P.ind) { scene.remove(P.ind); P.ind.material.dispose(); } }
  function mkPC(P) { const pc = new RTCPeerConnection({ iceServers: ICE() }); P.pc = pc; P.state = 'connecting';
    pc.onicecandidate = e => { if (e.candidate) sig({ t: 'ice', to: P.id, c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.ontrack = e => { V.stats.tracks++; P.track = e.track; wire(P, (e.streams && e.streams[0]) || new MediaStream([e.track])); };
    pc.onconnectionstatechange = () => { P.state = pc.connectionState;
      if (pc.connectionState === 'failed') { V.stats.fails++; log('Voice link to ' + nameOf(P.id) + ' failed (their network may need a relay)'); const id = P.id; closePeer(id, 'failed');
        const n = (retryAt.get(id) || 0) + 1; retryAt.set(id, n); if (n <= 2 && V.state !== 'off') setTimeout(() => { if (V.state !== 'off') sig({ t: 'hi', to: id, m: V.state === 'on' ? 1 : 0 }); if (me() < id) call(id); }, 4000 * n); } };
    return pc; }
  function attachMic(tr) { const track = local && local.getAudioTracks()[0]; tr.direction = 'sendrecv'; if (track) tr.sender.replaceTrack(track).catch(() => {}); }
  async function call(id) { if (V.state === 'off' || V.peers.get(id)?.pc) return; const P = peer(id), pc = mkPC(P);
    try { const tr = pc.addTransceiver('audio', { direction: 'sendrecv', streams: local ? [local] : [] }); attachMic(tr);
      const o = await pc.createOffer(); await pc.setLocalDescription(o); V.stats.offers++; sig({ t: 'offer', to: id, sdp: pc.localDescription.sdp }); }
    catch (e) { V.err = String(e && e.message || e); closePeer(id, 'offer-err'); } }
  async function onOffer(from, sdp) { if (V.state === 'off') return; let P = V.peers.get(from); if (P && P.pc) { closePeer(from, 'reoffer'); } P = peer(from); const pc = mkPC(P);
    try { await pc.setRemoteDescription({ type: 'offer', sdp }); const tr = pc.getTransceivers()[0]; if (tr) { if (local) tr.sender.setStreams && tr.sender.setStreams(local); attachMic(tr); }
      const a = await pc.createAnswer(); await pc.setLocalDescription(a); V.stats.answers++; sig({ t: 'answer', to: from, sdp: pc.localDescription.sdp }); flushIce(P); }
    catch (e) { V.err = String(e && e.message || e); closePeer(from, 'answer-err'); } }
  async function onAnswer(from, sdp) { const P = V.peers.get(from); if (!P || !P.pc) return; try { await P.pc.setRemoteDescription({ type: 'answer', sdp }); flushIce(P); } catch (e) { V.err = String(e && e.message || e); } }
  function flushIce(P) { const q = P.q; P.q = []; for (const c of q) P.pc.addIceCandidate(c).catch(() => {}); }
  function onIce(from, c) { const P = V.peers.get(from); if (!P || !P.pc) return; V.stats.ice++; if (!P.pc.remoteDescription) P.q.push(c); else P.pc.addIceCandidate(c).catch(() => {}); }
  function onRtc(m) { if (!m || typeof m.i !== 'string' || m.i === me()) return; if (m.to && m.to !== me()) return; const from = m.i;
    if (m.t === 'bye') { closePeer(from, 'bye'); return; }
    if (V.state === 'off') return;
    if (m.t === 'hi') { let P = V.peers.get(from); if (!m.to) { if (P) { closePeer(from, 'rejoin'); P = null; } sig({ t: 'hi', to: from, m: V.state === 'on' ? 1 : 0 }); }   // a fresh hi = they (re)joined: drop any stale link
      if (!(P && P.pc) && me() < from) call(from); return; }
    if (m.t === 'offer' && typeof m.sdp === 'string') onOffer(from, m.sdp);
    else if (m.t === 'answer' && typeof m.sdp === 'string') onAnswer(from, m.sdp);
    else if (m.t === 'ice' && m.c) onIce(from, m.c); }
  if (mp) mp.onRtc = onRtc;
  const nameOf = id => { const p = mp && mp.peers && mp.peers.get(id); return (p && p.name) || 'player'; };

  // ---------- public controls ----------
  async function join() { if (V.state === 'on' || V.state === 'listen' || V.state === 'starting') return V.state;
    if (!mp || mp.state !== 'on') { log('Voice needs the online room. Not connected yet.'); return V.state; }
    if (!window.RTCPeerConnection) { log('Voice chat is not supported in this browser'); return V.state; }
    V.state = 'starting'; audio();
    try { if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('no mic API'), { name: 'NotSupportedError' }); V.stats.gum++;
      local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const c = audio(); if (c) { const s = c.createMediaStreamSource(local); localAn = c.createAnalyser(); localAn.fftSize = 512; s.connect(localAn); }
      V.state = 'on'; V.muted = false; V.err = '';
    } catch (e) { local = null; V.err = (e && e.name) || String(e); V.state = 'listen';
      log(V.err === 'NotAllowedError' || V.err === 'SecurityError' ? 'Mic blocked: you can hear others but they cannot hear you. Allow the mic in the browser settings and tap again.' : 'No microphone available: listening only'); }
    if (V.state === 'on') { const others = mp.peers ? mp.peers.size : 0; log(others ? 'Mic on: players in voice can hear you' : 'Mic on. No one else is here yet; voice connects when they join and tap MIC ON'); }
    sig({ t: 'hi', m: V.state === 'on' ? 1 : 0 }); if (!timer) timer = setInterval(tick, 50); ui(); return V.state; }
  function setMute(on) { V.muted = on == null ? !V.muted : !!on; if (local) for (const t of local.getAudioTracks()) t.enabled = !V.muted; log(V.muted ? 'Mic muted' : 'Mic live'); ui(); return V.muted; }
  function leave() { if (V.state === 'off') return; sig({ t: 'bye' }); for (const id of [...V.peers.keys()]) closePeer(id, 'leave');
    if (local) for (const t of local.getTracks()) t.stop(); local = null; localAn = null; V.state = 'off'; V.muted = false; selfInd.visible = false; log('Voice off'); ui(); }
  // one-button flow (used by the flat 🎤 button and the VR menu): off -> join, blocked -> retry, on -> mute/unmute
  function tap() { if (V.state === 'off' || V.state === 'listen') return join(); if (V.state === 'on') setMute(); return V.state; }
  function label() { return V.state === 'on' ? (V.muted ? 'UNMUTE MIC' : 'MUTE MIC') : V.state === 'listen' ? 'MIC BLOCKED' : V.state === 'starting' ? 'MIC...' : 'MIC ON'; }
  Object.assign(V, { join, leave, setMute, tap, label, onRtc, closePeer });

  // ---------- per-frame: positions, listener, speaking ----------
  function tick() { if (V.state === 'off') return; const now = performance.now();
    // drop links to players who left the room
    for (const id of [...V.peers.keys()]) if (mp.peers && !mp.peers.has(id)) closePeer(id, 'gone');
    if (ctx) { camera.updateMatrixWorld(true); camera.getWorldPosition(_v); camera.getWorldQuaternion(_q); _f.set(0, 0, -1).applyQuaternion(_q); _u.set(0, 1, 0).applyQuaternion(_q); const L = ctx.listener;
      if (L.positionX) { L.positionX.value = _v.x; L.positionY.value = _v.y; L.positionZ.value = _v.z; L.forwardX.value = _f.x; L.forwardY.value = _f.y; L.forwardZ.value = _f.z; L.upX.value = _u.x; L.upY.value = _u.y; L.upZ.value = _u.z; }
      else { L.setPosition(_v.x, _v.y, _v.z); L.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z); } }
    for (const P of V.peers.values()) { const mpP = mp.peers && mp.peers.get(P.id), g = mpP && mpP.g;
      if (P.an) { const l = rms(P.an); P.level = l; if (l > 0.012) P.holdTo = now + 350; P.speaking = now < P.holdTo; }
      if (g && P.pan) { headOf(g, _v, 0.15); setPos(P.pan, 'position', _v.x, _v.y, _v.z); P.pos = [_v.x, _v.y, _v.z]; }
      if (P.ind) { const on = !!(g && g.visible && P.speaking); P.ind.visible = on; if (on) { headOf(g, _v, 0.5); P.ind.position.copy(_v); P.ind.scale.setScalar(0.26 + Math.min(0.14, P.level * 2)); } } }
    let sl = 0; if (localAn && !V.muted) sl = rms(localAn); V.level = sl; if (sl > 0.012) V.selfHold = now + 350; V.speaking = V.state === 'on' && !V.muted && now < (V.selfHold || 0);
    selfInd.visible = V.speaking && !!(monkey && monkey.visible !== false); if (selfInd.visible) { headOf(V.self ? V.self() : monkey, _v, 0.5); selfInd.position.copy(_v); }
    if (now - (V._ui || 0) > 400) { V._ui = now; ui(); } }

  // ---------- flat-screen HUD button (sits in the multiplayer bar above CHAT) ----------
  const css = document.createElement('style'); css.textContent = `#vcBtn{font:700 10px 'Courier New',monospace!important;color:#bfffd8!important;border-color:#39ff8a88!important;position:relative}
#vcBtn.on{background:#0d3a1fcc!important}#vcBtn.mut{background:#4a0d18cc!important;border-color:#ff4f6e!important;color:#ffd0d8!important}#vcBtn.lis{border-color:#ffb02e!important;color:#ffe2a8!important}
#vcBtn.talk{box-shadow:0 0 0 2px #39ff8a,0 0 12px #39ff8a}#vcOff{font:700 10px sans-serif!important;width:40px!important;height:22px!important;display:none}#vcOff.on{display:block}
#vcToast{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:60;background:#0a0612e6;color:#dfffea;border:1px solid #39ff8a88;border-radius:10px;padding:6px 12px;font:600 13px sans-serif;max-width:80vw;text-align:center;pointer-events:none;opacity:0;transition:opacity .25s}
#vcToast.on{opacity:1}body.ingame #vcToast{display:none}`;
  document.head.appendChild(css);
  const bar = document.getElementById('mpBar'); let btn = null, off = null, toastEl = null, toastT = 0;
  if (bar) { btn = document.createElement('button'); btn.id = 'vcBtn'; btn.type = 'button'; btn.title = 'Voice chat: tap to turn your mic on, tap again to mute';
    off = document.createElement('button'); off.id = 'vcOff'; off.type = 'button'; off.textContent = '✕ VC'; off.title = 'Leave voice chat';
    bar.insertBefore(off, bar.firstChild); bar.insertBefore(btn, off.nextSibling);
    for (const n of [btn, off]) for (const ev of ['pointerdown', 'touchstart', 'mousedown']) n.addEventListener(ev, e => e.stopPropagation(), { passive: true });
    btn.addEventListener('click', e => { e.stopPropagation(); tap(); }); off.addEventListener('click', e => { e.stopPropagation(); leave(); }); }
  function toast(s) { if (document.body.classList.contains('xr')) return; if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'vcToast'; document.body.appendChild(toastEl); }
    toastEl.textContent = s; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 3500); }
  function ui() { if (!btn) return; const st = V.state; btn.textContent = st === 'on' ? (V.muted ? '🔇' : '🎤 ON') : st === 'listen' ? '🎧' : st === 'starting' ? '…' : '🎤 MIC';
    btn.className = st === 'on' ? (V.muted ? 'mut' : 'on' + (V.speaking ? ' talk' : '')) : st === 'listen' ? 'lis' : '';
    off.className = st === 'off' ? '' : 'on'; if (V.onUi) try { V.onUi(); } catch (e) {} }
  ui();
  addEventListener('pagehide', () => { try { if (V.state !== 'off') sig({ t: 'bye' }); } catch (e) {} });
  return V;
}
