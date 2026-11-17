// v19: on-device speech-to-text worker for the Grok chat (see stt.js). Loaded only when someone talks on a browser without
// working Web Speech (Quest Browser, Firefox...). transformers.js runs Whisper tiny.en (int8) in WebAssembly; the model (~40 MB) comes
// from the Hugging Face hub once and is then kept in the browser's cache. No account, no key, audio never leaves the device.
const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL = 'onnx-community/whisper-tiny.en';
let asr = null, loading = null;
function load() {
  if (loading) return loading;
  const t0 = performance.now(), files = {};
  loading = (async () => {
    const { pipeline, env } = await import(TJS);
    env.allowLocalModels = false; env.useBrowserCache = true;
    asr = await pipeline('automatic-speech-recognition', MODEL, {
      dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' }, device: 'wasm',
      progress_callback: p => { if (p && p.status === 'progress' && p.file) { files[p.file] = [p.loaded || 0, p.total || 0];
        let a = 0, b = 0; for (const k in files) { a += files[k][0]; b += files[k][1]; } postMessage({ t: 'progress', p: b ? Math.min(99, Math.round(a / b * 100)) : 0 }); } } });
    postMessage({ t: 'ready', ms: performance.now() - t0 });
    return asr;
  })();
  loading.catch(e => { loading = null; postMessage({ t: 'error', e: String(e && e.message || e) }); });
  return loading;
}
onmessage = async e => {
  const m = e.data || {};
  if (m.t === 'load') { load().catch(() => {}); return; }
  if (m.t === 'run') {
    try { await load(); const t0 = performance.now(); const r = await asr(m.audio);
      postMessage({ t: 'text', id: m.id, text: (r && r.text) || '', ms: performance.now() - t0 }); }
    catch (err) { postMessage({ t: 'error', id: m.id, e: String(err && err.message || err) }); }
  }
};
