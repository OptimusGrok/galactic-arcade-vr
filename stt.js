// v19 (Dave): talk to Grok. Speech-to-text for the Grok chat (flat + VR), two engines, no accounts, no API keys:
//  1. 'speech'  = the browser's Web Speech API (SpeechRecognition / webkitSpeechRecognition) where it exists and works:
//                 Chrome / Edge / Samsung (desktop + Android) and Safari (Mac + iPhone). NB: those browsers do the recognition on
//                 their own servers (Google / Microsoft / Apple), as part of the browser.
//  2. 'whisper' = fully on-device: OpenAI's Whisper (tiny.en, int8, ~40 MB, downloaded ONCE on the first TALK and then cached by the
//                 browser) run in WebAssembly by transformers.js inside a Web Worker (stt-worker.js) so VR frames never stall.
//                 Used on Quest Browser (no working Web Speech there), Firefox, Brave, and anywhere Web Speech errors out.
//                 Mic audio -> a simple voice-activity detector -> each spoken phrase is transcribed; nothing leaves the device.
// API: start({ continuous, onText(text), onChange() }) / stop() / state / partial / mode / progress / err
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const Q = new URLSearchParams(location.search);
const isQuest = /OculusBrowser|Quest/i.test(navigator.userAgent);
let prefer = Q.get('stt') || (() => { try { return localStorage.getItem('ga.stt') || ''; } catch (e) { return ''; } })();
const canWhisper = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.Worker && window.WebAssembly && (window.AudioContext || window.webkitAudioContext));
const S = {
  state: 'idle',     // idle | loading (model download) | listening | hearing (speech detected) | thinking (transcribing) | error
  partial: '', err: '', progress: 0, mode: null, continuous: false, finals: 0, segs: 0, starts: 0, ready: false, log: [],
  supported: !!SR || canWhisper,
  engine() { if (prefer === 'whisper' || ((isQuest || !SR) && prefer !== 'speech')) return canWhisper ? 'whisper' : null; return SR ? 'speech' : canWhisper ? 'whisper' : null; },
  start, stop, get active() { return active; },
};
window.__gaSTT = S;
let active = false, opts = {}, rec = null, restartT = 0;
const set = (k, v) => { if (S[k] === v) return; S[k] = v; try { opts.onChange && opts.onChange(S); } catch (e) {} };
const lg = m => { S.log.push(Math.round(performance.now()) + ' ' + m); if (S.log.length > 60) S.log.shift(); };
function emit(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || /^[\[(].*[\])]$/.test(t) || /^[.,!?\s-]*$/.test(t)) { lg('drop "' + t + '"'); return; }   // [BLANK_AUDIO], (music)...
  S.finals++; lg('text "' + t + '"'); set('partial', '');
  try { opts.onText && opts.onText(t); } catch (e) { console.warn('stt onText', e); }
  if (!S.continuous) stop();
}

function start(o) {
  if (active) stop();
  opts = o || {}; S.continuous = !!opts.continuous; S.err = ''; S.partial = ''; S.starts++;
  const eng = S.engine(); S.mode = eng; lg('start ' + eng + (S.continuous ? ' continuous' : ''));
  if (!eng) { set('state', 'error'); S.err = 'Speech is not supported in this browser'; return false; }
  active = true;
  if (eng === 'speech') speechStart(); else whisperStart();
  return true;
}
function stop() {
  if (!active && S.state === 'idle') return;
  active = false; clearTimeout(restartT); lg('stop');
  if (rec) { const r = rec; rec = null; try { r.onend = r.onresult = r.onerror = null; r.abort(); } catch (e) {} }
  micStop(); set('partial', ''); set('state', S.state === 'error' ? 'error' : 'idle');
}

// ---------------- 1. Web Speech API ----------------
function speechStart() {
  const r = rec = new SR(); r.lang = navigator.language || 'en-US'; r.interimResults = true; r.continuous = S.continuous; r.maxAlternatives = 1;
  r.onstart = () => { if (rec === r) set('state', 'listening'); };
  r.onspeechstart = () => { if (rec === r) set('state', 'hearing'); };
  r.onresult = e => { if (rec !== r) return; let fin = '', mid = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) fin += x[0].transcript; else mid += x[0].transcript; }
    if (mid) { set('partial', mid.trim()); set('state', 'hearing'); }
    if (fin.trim()) { set('state', 'listening'); emit(fin); } };
  r.onerror = e => { if (rec !== r) return; const er = e.error || 'error'; lg('speech error ' + er);
    if (er === 'no-speech' || er === 'aborted') return;
    if (er === 'not-allowed') { fail('MIC BLOCKED'); return; }
    // the browser has the API but can't use it (no Google/Apple service: Brave, Quest, offline...) or the mic is held: go on-device
    if (canWhisper) { prefer = 'whisper'; rec = null; try { r.abort(); } catch (x) {} S.mode = 'whisper'; whisperStart(); return; }
    fail('SPEECH ERROR: ' + er); };
  r.onend = () => { if (rec !== r) return; if (active && S.continuous) { restartT = setTimeout(() => { if (active && rec === r) try { r.start(); } catch (e) {} }, 250); } else if (active) { active = false; rec = null; set('partial', ''); set('state', 'idle'); } };
  try { r.start(); set('state', 'listening'); } catch (e) { fail(String(e && e.message || e)); }
}
function fail(m) { S.err = m; lg('fail ' + m); active = false; rec = null; micStop(); set('partial', ''); set('state', 'error'); try { opts.onChange && opts.onChange(S); } catch (e) {} }

// ---------------- 2. on-device Whisper ----------------
let worker = null, wid = 0; const pend = new Map();
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./stt-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = e => { const m = e.data || {};
    if (m.t === 'progress') { set('progress', m.p); if (!S.ready && active && S.state !== 'hearing') set('state', 'loading'); }
    else if (m.t === 'ready') { S.ready = true; set('progress', 100); lg('model ready ' + (m.ms | 0) + 'ms'); if (active && S.state === 'loading') set('state', pend.size ? 'thinking' : 'listening'); }
    else if (m.t === 'text') { const cb = pend.get(m.id); pend.delete(m.id); lg('whisper ' + (m.ms | 0) + 'ms'); if (cb) cb(m.text); }
    else if (m.t === 'error') { lg('worker error ' + m.e); const cb = pend.get(m.id); pend.delete(m.id); if (cb) cb(''); if (!S.ready) fail('SPEECH MODEL FAILED TO LOAD'); } };
  worker.onerror = e => { lg('worker crash ' + (e.message || '')); fail('SPEECH MODEL FAILED TO LOAD'); };
  worker.postMessage({ t: 'load' });
  return worker;
}
function transcribe(pcm16k) { return new Promise(res => { const id = ++wid; pend.set(id, res); getWorker().postMessage({ t: 'run', id, audio: pcm16k }, [pcm16k.buffer]); }); }
S.preload = () => { if (canWhisper) getWorker(); };

let mic = null;   // { stream, ctx, src, node, sink }
async function whisperStart() {
  getWorker(); set('state', S.ready ? 'listening' : 'loading');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (e) { if (active) fail((e && e.name) === 'NotAllowedError' ? 'MIC BLOCKED' : 'NO MIC'); return; }
  if (!active) { for (const t of stream.getTracks()) t.stop(); return; }
  const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
  try { if (ctx.state === 'suspended') await ctx.resume(); } catch (e) {}
  const src = ctx.createMediaStreamSource(stream), node = ctx.createScriptProcessor(4096, 1, 1), sink = ctx.createGain(); sink.gain.value = 0;
  src.connect(node); node.connect(sink); sink.connect(ctx.destination);
  mic = { stream, ctx, src, node, sink };
  const sr = ctx.sampleRate, chunkS = 4096 / sr;
  // voice activity detection on 4096-sample chunks: adaptive noise floor, speech starts above ~2.5x floor, ends after 0.8 s quiet
  let floor = 0.004, speaking = false, quiet = 0, seg = [], pre = [], segLen = 0;
  node.onaudioprocess = e => {
    if (!active || !mic || mic.node !== node) return;
    const x = e.inputBuffer.getChannelData(0); let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i];
    const rms = Math.sqrt(s / x.length), copy = new Float32Array(x); S.level = rms;
    if (!speaking) {
      floor = Math.min(0.05, floor * 0.96 + rms * 0.04);
      pre.push(copy); if (pre.length > 4) pre.shift();
      if (rms > Math.max(0.012, floor * 2.5)) { speaking = true; quiet = 0; seg = pre.slice(); pre = []; segLen = seg.length; if (S.state !== 'loading') set('state', 'hearing'); lg('vad on ' + rms.toFixed(3)); }
    } else {
      seg.push(copy); segLen++;
      if (rms < Math.max(0.008, floor * 1.8)) quiet += chunkS; else quiet = 0;
      if (quiet > 0.8 || segLen * chunkS > 12) { speaking = false; const voiced = segLen * chunkS - quiet; lg('vad off ' + voiced.toFixed(2) + 's');
        const parts = seg; seg = []; segLen = 0;
        if (voiced >= 0.3) { S.segs++; const pcm = to16k(parts, sr); if (S.state !== 'loading') set('state', 'thinking'); if (!S.ready) set('partial', '');
          transcribe(pcm).then(t => { if (!active) return; if (S.state === 'thinking') set('state', 'listening'); emit(t); });
        } else if (S.state === 'hearing') set('state', 'listening'); }
    }
  };
}
function micStop() { const m = mic; mic = null; if (!m) return; try { m.node.onaudioprocess = null; m.src.disconnect(); m.node.disconnect(); m.sink.disconnect(); } catch (e) {} for (const t of m.stream.getTracks()) t.stop(); try { m.ctx.close(); } catch (e) {} }
// mono float chunks at the mic rate -> one Float32Array at 16 kHz (box-filter average, fine for speech)
function to16k(parts, sr) {
  let n = 0; for (const p of parts) n += p.length; const all = new Float32Array(n); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
  if (Math.abs(sr - 16000) < 1) return all;
  const r = sr / 16000, out = new Float32Array(Math.floor(n / r));
  for (let i = 0; i < out.length; i++) { const a = Math.floor(i * r), b = Math.min(n, Math.max(a + 1, Math.floor((i + 1) * r))); let s = 0; for (let j = a; j < b; j++) s += all[j]; out[i] = s / (b - a); }
  return out;
}
export default S;
