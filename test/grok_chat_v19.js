// v19 (Dave): flat Grok chat: typed messages, 🎤 TALK with the Web Speech API (mocked SpeechRecognition), automatic listening while the
// voice-chat mic is on, and the on-device Whisper fallback end-to-end (Chrome's fake mic plays test/fixtures speech wav: "How do I get tickets?").
// node test/grok_chat_v19.js      (WHISPER=0 skips the ~40 MB model download part)
const { open } = require('./lib');
const path = require('path'), fs = require('fs');
let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 400) : '')); if (!c) ok = false; };
const WAV = process.env.WAV || '/tmp/speech_q1.wav';
const MOCK = `(() => { class FakeSR { constructor() { this.continuous = false; this.interimResults = false; FakeSR.made = (FakeSR.made || 0) + 1; window.__fakeSR = this; }
  start() { this.started = (this.started || 0) + 1; setTimeout(() => { this.onstart && this.onstart(); this.onspeechstart && this.onspeechstart(); }, 30);
    const res = (t, fin) => { const r = [{ transcript: t, confidence: 0.9 }]; r.isFinal = fin; const all = [r]; return { resultIndex: 0, results: all }; };
    setTimeout(() => this.onresult && this.onresult(res('how do I', false)), 300);
    setTimeout(() => { window.__sawPartial = document.getElementById('gcSt').textContent; this.onresult && this.onresult(res(window.__say || 'how do I play mini golf', true)); }, 900);
    setTimeout(() => { if (!this.continuous) this.onend && this.onend(); }, 1000); }
  stop() { this.onend && this.onend(); } abort() { this.aborted = (this.aborted || 0) + 1; } }
  window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR; })();`;
async function phase(name, opts, fn) { const o = await open(Object.assign({ w: 900, h: 560 }, opts)); try { await o.page.waitForFunction(() => window.__grokChat && window.__shop && window.__grokChat.hooks.clerk && window.__tp, null, { timeout: 90000 });
    await o.page.evaluate(() => { window.__tpTimeScale = 3; window.__tp.go(); }); await o.page.waitForFunction(() => window.__tp.where === 2 && window.__tp.state === 'idle', null, { timeout: 90000 }); await fn(o.page, o); } catch (e) { chk(false, name + ' threw: ' + e.message); } finally { const errs = o.errors.filter(e => !/supabase|Failed to load resource|net::ERR/i.test(e)); chk(!errs.length, name + ': no page errors', errs); await o.close(); } }
(async () => {
  // ---- A: typing + Web Speech (mock) ----
  await phase('webspeech', { init: MOCK }, async page => {
    await page.evaluate(() => window.__grokChat.openChat('clerk'));
    const ui = await page.evaluate(() => { const m = document.getElementById('gcMic'), r = m.getBoundingClientRect(); return { shown: !m.hidden && r.width > 30, inView: r.right <= innerWidth && r.bottom <= innerHeight, input: !!document.getElementById('gcIn') }; });
    chk(ui.shown && ui.inView && ui.input, 'chat has the text box (TYPE) and a 🎤 button', ui);
    await page.fill('#gcIn', 'tell me a joke'); await page.press('#gcIn', 'Enter');
    let r = await page.evaluate(() => { const G = window.__grokChat; return { q: G.lastQ, a: G.lastA, via: G.lastVia, id: G.last, n: document.querySelectorAll('#gcLog .gcM.u').length }; });
    chk(r.q === 'tell me a joke' && r.via === 'type' && r.id === 'joke' && r.n === 1, 'typed message: shows as your line, Grok answers', r);
    await page.click('#gcMic'); await page.waitForTimeout(150);
    let st = await page.evaluate(() => ({ mode: window.__gaSTT.mode, active: window.__gaSTT.active, cont: window.__gaSTT.continuous, cls: document.getElementById('gcMic').className }));
    chk(st.mode === 'speech' && st.active && !st.cont && /on/.test(st.cls), '🎤 tap: Web Speech API listening (one phrase)', st);
    await page.waitForFunction(() => window.__grokChat.voiceAsks >= 1, null, { timeout: 8000 });
    r = await page.evaluate(() => { const G = window.__grokChat, us = [...document.querySelectorAll('#gcLog .gcM.u')].map(e => e.textContent); return { q: G.lastQ, a: G.lastA, via: G.lastVia, id: G.last, us, partial: window.__sawPartial, active: window.__gaSTT.active, st: document.getElementById('gcSt').textContent }; });
    chk(/how do i/i.test(r.partial), 'words show as text while talking: "' + r.partial + '"');
    chk(r.q === 'how do I play mini golf' && r.us[r.us.length - 1] === r.q && r.via === 'voice' && r.id === 'golf' && r.a.length > 20, 'spoken message becomes your chat line; Grok answers it like a typed one', r);
    chk(!r.active && r.st === '', 'one-phrase TALK stops by itself', r);
    // voice-chat mic on -> listens automatically (continuous) while the chat is open
    await page.evaluate(() => { window.__grokChat.close('t'); window.__voice = { state: 'on', muted: false }; window.__say = 'what are viking tickets'; window.__grokChat.openChat('clerk'); });
    await page.waitForFunction(() => window.__grokChat.voiceAsks >= 2, null, { timeout: 8000 });
    r = await page.evaluate(() => ({ q: window.__grokChat.lastQ, id: window.__grokChat.last, active: window.__gaSTT.active, cont: window.__gaSTT.continuous }));
    chk(r.q === 'what are viking tickets' && r.id === 'viking' && r.active && r.cont, 'voice mic on: listens automatically, keeps listening after each answer', r);
    await page.evaluate(() => { window.__voice.muted = true; }); await page.waitForTimeout(900);
    chk(!(await page.evaluate(() => window.__gaSTT.active)), 'muting the voice mic stops chat listening');
    await page.evaluate(() => { window.__voice.muted = false; }); await page.waitForTimeout(900);
    chk(await page.evaluate(() => window.__gaSTT.active), 'unmuting starts it again');
    await page.click('#gcX'); await page.waitForTimeout(100);
    chk(!(await page.evaluate(() => window.__gaSTT.active)), 'closing the chat stops listening');
  });
  if (process.env.WHISPER === '0') { console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1); }
  // ---- B: no working Web Speech (real Chromium: its speech service needs Google keys) -> on-device Whisper, real speech from a fake mic ----
  if (!fs.existsSync(WAV)) { chk(false, 'missing ' + WAV); }
  await phase('whisper', { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + WAV], qs: process.env.QS || '' }, async (page, o) => {
    await page.evaluate(() => window.__grokChat.openChat('clerk'));
    const t0 = Date.now(); await page.click('#gcMic');
    let seen = new Set(); const t1 = Date.now();
    while (Date.now() - t1 < 240000) { const s = await page.evaluate(() => ({ st: window.__gaSTT.state, mode: window.__gaSTT.mode, v: window.__grokChat.voiceAsks, line: document.getElementById('gcSt').textContent })); seen.add(s.mode + ':' + s.st + (s.st === 'loading' ? '' : '')); if (s.st === 'loading' && /Loading speech/.test(s.line)) seen.add('loadline'); if (s.v >= 1) break; await page.waitForTimeout(250); }
    const r = await page.evaluate(() => ({ q: window.__grokChat.lastQ, a: window.__grokChat.lastA, via: window.__grokChat.lastVia, id: window.__grokChat.last, mode: window.__gaSTT.mode, log: window.__gaSTT.log.slice(-12), active: window.__gaSTT.active }));
    console.log('  states seen', [...seen].join(' '), '·', ((Date.now() - t0) / 1000).toFixed(1) + 's incl. model download'); console.log('  stt log', r.log.join(' | '));
    chk(r.mode === 'whisper', 'engine: on-device Whisper', r.mode);
    chk(/tickets?/i.test(r.q) && r.via === 'voice' && r.id === 'tickets', 'Whisper heard "' + r.q + '" -> Grok: "' + (r.a || '').slice(0, 60) + '..."', r.id);
    chk(!r.active, 'one-phrase TALK stops after the answer');
    const hf = o.requests.filter(u => /huggingface|hf\.co|jsdelivr/.test(u)).map(u => u.replace(/\?.*/, '').split('/').slice(2, 4).join('/'));
    chk(hf.length > 0 && o.requests.every(u => !/api\.openai|speech\.googleapis|deepgram|assemblyai/.test(u)), 'downloads only the model/library (no speech API): ' + [...new Set(hf)].join(', '));
  });
  console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
