// Room 1 background music: "Neon Nights" (105 BPM, 32-bar seamless loop, 3225600 samples @ 44.1 kHz), decoded with WebAudio and
// looped on exact sample points (encoder padding trimmed). Plays in room 1, the hallway and room 2 without a break (t244), while a cabinet
// is zoomed in / played, on the start screen, when the tab is hidden, or when MUSIC is off in Options ('neonarcade.music' = '0').
(function () {
  var N = 3225600, SR = 44100, VOL = 0.42, KEY = 'neonarcade.music';
  var M = window.__music = { loaded: false, playing: false, gain: 0, target: 0, on: true, loopStart: 0, loopEnd: 0, len: 0, src: '' };
  try { M.on = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  var ac = null, g = null, node = null, loading = false, idleSince = 0;
  M.drops = 0; M.loads = 0; M.decodedMB = 0;
  function pickSrc() { var a = document.createElement('audio'); return a.canPlayType('audio/ogg; codecs="opus"') ? 'audio/neon_nights.ogg' : 'audio/neon_nights.m4a'; }
  function load() { if (loading) return; loading = true; M.loads++; ac = ac || window.__unlockAC || new (window.AudioContext || window.webkitAudioContext)(); window.__unlockAC = ac;
    if (!g) { g = ac.createGain(); g.gain.value = 0; g.connect(ac.destination); } M.src = pickSrc();
    fetch(M.src).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return new Promise(function (ok, no) { ac.decodeAudioData(b, ok, no); }); }).then(function (buf) {
      var extra = buf.length - Math.round(N * buf.sampleRate / SR), lead = extra >= 2112 ? 2112 : extra >= 1024 ? 1024 : 0;   // AAC priming if a browser keeps it
      M.len = buf.length; M.loopStart = lead / buf.sampleRate; M.loopEnd = M.loopStart + N / SR;
      node = ac.createBufferSource(); node.buffer = buf; node.loop = true; node.loopStart = M.loopStart; node.loopEnd = M.loopEnd; node.connect(g); node.start(0, M.loopStart);
      M.t0 = ac.currentTime; M.loaded = true; M.playing = true; M.decodedMB = +(buf.length * buf.numberOfChannels * 4 / 1048576).toFixed(1); }).catch(function (e) { M.err = String(e); loading = false; });
  }
  // TEST v1 (VR memory): the decoded loop is ~26 MB of float PCM. Keep it only while it can be heard: after 10 s silent because you are
  // in a game, in the Neon Knockout studio (its own beat) or MUSIC is off, drop it; it is fetched + decoded again (from the loop start) on return.
  function drop() { try { if (node) { node.stop(); node.disconnect(); } } catch (e) {} node = null; loading = false; M.loaded = false; M.playing = false; M.decodedMB = 0; M.drops++; }
  M.drop = drop;
  M.setOn = function (on) { M.on = !!on; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} tick(); };
  M.pos = function () { return M.loaded ? ((ac.currentTime - M.t0) % (M.loopEnd - M.loopStart)) : 0; };
  function tick() {
    var S = window.__start, A = window.__arcade, onStart = !!document.getElementById('start') && !(S && S.dismissed);
    if (S && S.dismissed && !loading && !idleSince) load();   // first START (a user gesture already unlocked the context)
    var t = 0;
    if (M.on && !onStart && !document.hidden && A && A.play) {
      var z = A.monkey.position.z, R = window.__mp && window.__mp.roomOf, k = R && R(A.monkey.position) === 'white' ? Math.max(0, Math.min(1, (z + 12 + 2.5) / 3)) : 1;   // t244: same track plays on through the hallway and room 2 (only the white shop keeps the old fade)
      t = A.play.mode === 'walk' ? VOL * k : 0;
      if (A.monkey.position.x < -40) t = 0; }   // v16: the Neon Knockout studio (far west) plays its own beat
    if (window.__pa && window.__pa.playing) t *= 0.3;   // duck under the PA announcement
    if (window.__cabMusic) t *= 1 - window.__cabMusic.duck;   // cabinet loop near / in demo (cabinet-music.js)
    var A2 = A, away = !M.on || (A2 && A2.play && A2.play.mode === 'game') || (A2 && A2.monkey && A2.monkey.position.x < -40);
    if (t > 0 || !away) idleSince = 0; else if (!idleSince) idleSince = Date.now();
    var holdMs = window.__gaMusicHold != null ? +window.__gaMusicHold : 10000;
    if (idleSince && M.loaded && Date.now() - idleSince >= holdMs && g && g.gain.value < 0.01) drop();
    if (t > 0 && !M.loaded && !loading && S && S.dismissed) load();
    M.target = t; M.room1 = t > 0;
    if (g) { if (ac.state === 'suspended' && t > 0) ac.resume(); g.gain.setTargetAtTime(t, ac.currentTime, t > M.gain ? 0.5 : 0.25); M.gain = g.gain.value; }
  }
  setInterval(tick, 120); document.addEventListener('visibilitychange', tick);
})();
