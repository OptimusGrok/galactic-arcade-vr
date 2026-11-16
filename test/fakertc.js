// test-only: the box's managed Chrome policy (WebRtcIPHandling disable_non_proxied_udp) gives WebRTC no ICE candidates, so real
// peer audio cannot flow between test browsers. With window.__fakeRTC = 1 new RTCPeerConnections are this stand-in: same API
// surface voice.js uses (transceivers, offer/answer, ice, ontrack, connectionState). Each side tells the other over the mocked
// realtime channel ('rtc' t:'fk') whether its sender has a live, enabled mic track; the receiver plays a tone while it does.
module.exports = `;(function(){ const Real = window.RTCPeerConnection; if (!Real) return; window.__fpcs = {}; let n = 0;
  class FakePC { constructor(cfg) { this.cfg = cfg; this.uid = ++n; this.tr = []; this.connectionState = 'new'; this.signalingState = 'stable'; this.localDescription = null; this.remoteDescription = null; this.rid = null; this.cands = 0; }
    addTransceiver(kind, o) { const t = { kind, direction: (o && o.direction) || 'sendrecv', currentDirection: null, sender: { track: null, replaceTrack(x) { this.track = x; return Promise.resolve(); }, setStreams() {} } }; this.tr.push(t); return t; }
    getTransceivers() { return this.tr; }
    async createOffer() { return { type: 'offer', sdp: 'fake|' + window.__mp.id + '|' + this.uid }; }
    async createAnswer() { return { type: 'answer', sdp: 'fake|' + window.__mp.id + '|' + this.uid }; }
    async setLocalDescription(d) { this.localDescription = d; this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable'; setTimeout(() => { this.onicecandidate && this.onicecandidate({ candidate: { candidate: 'candidate:fake ' + this.uid, sdpMid: '0', toJSON() { return { candidate: this.candidate, sdpMid: '0' }; } } }); }, 20); this.maybe(); }
    async setRemoteDescription(d) { this.remoteDescription = d; this.rid = String(d.sdp).split('|')[1]; window.__fpcs[this.rid] = this; if (d.type === 'offer' && !this.tr.length) this.addTransceiver('audio', { direction: 'recvonly' }); this.signalingState = d.type === 'offer' ? 'have-remote-offer' : 'stable'; this.maybe(); }
    async addIceCandidate() { this.cands++; }
    maybe() { if (!this.localDescription || !this.remoteDescription || this.connectionState !== 'new') return; this.connectionState = 'connecting'; for (const t of this.tr) t.currentDirection = t.direction;
      setTimeout(() => { if (this.connectionState !== 'connecting') return; this.connectionState = 'connected'; this.onconnectionstatechange && this.onconnectionstatechange();
        const C = window.__fakeAC || (window.__fakeAC = new AudioContext()); const o = C.createOscillator(), g = C.createGain(), d = C.createMediaStreamDestination(); o.frequency.value = 440; g.gain.value = 0; o.connect(g); g.connect(d); o.start(); this.gain = g;
        const track = d.stream.getAudioTracks()[0]; this.ontrack && this.ontrack({ track, streams: [d.stream] });
        this.iv = setInterval(() => { const s = this.tr[0] && this.tr[0].sender.track; window.__mp.rtcSend({ t: 'fk', to: this.rid, on: !!(s && s.enabled && s.readyState === 'live') }); }, 150); }, 300); }
    remote(on) { if (this.gain) this.gain.gain.value = on ? 0.2 : 0; }
    close() { this.connectionState = 'closed'; clearInterval(this.iv); if (this.gain) this.gain.gain.value = 0; if (window.__fpcs[this.rid] === this) delete window.__fpcs[this.rid]; } }
  window.RTCPeerConnection = function (cfg) { return window.__fakeRTC ? new FakePC(cfg) : new Real(cfg); };
  // route the stand-in's 'fk' messages to it (voice.js ignores unknown types anyway)
  const iv = setInterval(() => { const M = window.__mp; if (!M || !M.onRtc || M.onRtc.__fk) return; const f = M.onRtc; M.onRtc = m => { if (m && m.t === 'fk') { if (m.to === M.id) { const pc = window.__fpcs[m.i]; pc && pc.remote(m.on); } return; } f(m); }; M.onRtc.__fk = 1; }, 100); })();`;
