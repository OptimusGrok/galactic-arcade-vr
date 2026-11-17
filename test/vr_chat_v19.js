// v19 (Dave): Grok chat in the headset (emulated Quest 3): no WHO IS DAVE? question, TYPE = floating keyboard (ray + trigger keys,
// DEL, SEND, grip = back), TALK = speech to text. Quest Browser has no working Web Speech, so it's on-device Whisper; Chrome's fake mic
// plays a speech wav ("How do I get tickets?") and the words show in the panel, then Grok answers.  WHISPER=0 skips the model part.
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
const WAV = process.env.WAV || '/tmp/speech_q1.wav';
(async () => {
  let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : '')); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP }, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + WAV] });
  const E = (f, a) => page.evaluate(f, a), until = (f, ms = 30000, arg) => page.waitForFunction(f, arg, { timeout: ms });
  const place = async (x, z, yaw) => { await E(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 6); };
  const tap = async id => { for (let i = 0; i < 3; i++) { const w = await E(id => window.__gaVR.ui.btnWorld(id), id); if (!w) throw new Error('no button ' + id); await H.aim(page, 'right', [0.2, 1.3, -0.2], w); await H.frames(page, 3); await E(() => { window.__gaVR.lastPress = null; }); await H.press(page, 'right', 'trigger'); if ((await E(() => window.__gaVR.lastPress)) === id) return; } throw new Error('tap failed ' + id); };
  const P = () => E(() => { const S = window.__gaVR; return { panel: S.state().panel, q: S.chat.q, a: S.chat.a, typed: S.chat.typed, sub: S.uiSub(), open: window.__grokChat.open, id: window.__grokChat.last, via: window.__grokChat.lastVia }; });
  try {
    await until(() => document.getElementById('vrBtn').classList.contains('on'), 30000);
    await page.click('#vrBtn'); await until(() => window.__gaVR.presenting && window.__gaVR.posed, 30000);
    await until(() => window.__shop && window.__grokChat && window.__tp, 90000);
    await E(() => { window.__tpTimeScale = 3; window.__tp.go(); }); await until(() => window.__tp.where === 2 && window.__tp.state === 'idle', 90000);
    let cs = await E(() => { const s = window.__gaVR.signs().find(q => q.id === 'chatClerk'); return s ? s.at : null; });
    chk(!!cs, 'CHAT WITH GROK sign over the clerk');
    await place(cs[0], cs[2] + 3.5, 0); cs = await E(() => window.__gaVR.signs().find(q => q.id === 'chatClerk').at);
    await H.aim(page, 'right', [0.2, 1.3, -0.2], cs); await H.frames(page, 3); await H.press(page, 'right', 'trigger'); await H.frames(page, 4);
    let p = await P(); chk(p.panel === 'chat' && p.open, 'trigger on the sign opens the chat panel', p);
    // every question page: no WHO IS DAVE?
    const labels = new Set(); for (let i = 0; i < 6; i++) { (await E(() => window.__gaVR.ui.btns.filter(b => /^q_/.test(b.id)).map(b => b.label))).forEach(l => labels.add(l)); const nx = await E(() => (window.__gaVR.ui.btns.find(b => b.id === 'next') || {}).on); if (!nx) break; await tap('next'); }
    chk(labels.size >= 20 && ![...labels].some(l => /DAVE/.test(l)), 'no "WHO IS DAVE?" on any page (' + labels.size + ' questions)');
    const bt = await E(() => window.__gaVR.ui.btns.map(b => b.id)); chk(bt.includes('type') && bt.includes('talk'), 'TYPE A MESSAGE + TALK TO GROK buttons', bt);
    // TYPE: floating keyboard
    await tap('type'); p = await P(); chk(p.panel === 'chatType', 'TYPE opens the floating keyboard', p.panel);
    for (const k of ['J', 'O', 'K', 'E', 'X', 'DEL', 'SPACE', 'P', 'L', 'E', 'A', 'S', 'E']) await tap('k_' + k);
    p = await P(); chk(p.typed === 'JOKE PLEASE' && /JOKE PLEASE_$/.test(p.sub), 'keys type (DEL deletes): "' + p.typed + '"');
    await H.press(page, 'right', 'squeeze'); await H.frames(page, 3); p = await P(); chk(p.panel === 'chat' && p.open, 'GRIP on the keyboard = back to the chat (chat stays open)', p.panel);
    await tap('type'); p = await P(); chk(p.typed === 'JOKE PLEASE', 'what you typed is kept'); await tap('k_SEND');
    p = await P(); chk(p.panel === 'chat' && p.q === 'JOKE PLEASE' && p.id === 'joke' && p.via === 'type' && /YOU: JOKE PLEASE/.test(p.sub) && p.a.length > 15, 'SEND: your message shows, Grok answers: "' + p.a.slice(0, 60) + '"', p.sub);
    if (process.env.WHISPER !== '0') {
      await tap('talk'); const t0 = Date.now(); const subs = new Set();
      while (Date.now() - t0 < 240000) { const s = await E(() => ({ v: window.__grokChat.voiceAsks, sub: window.__gaVR.uiSub(), st: window.__gaSTT.state })); subs.add(s.sub.replace(/\d+%/, 'n%')); if (s.v >= 1) break; await H.frames(page, 2); }
      p = await P(); const T = await E(() => ({ mode: window.__gaSTT.mode, log: window.__gaSTT.log.slice(-8), active: window.__gaSTT.active }));
      console.log('  panel lines seen:', [...subs].join(' | ')); console.log('  ' + T.log.join(' | '));
      chk(T.mode === 'whisper', 'Quest browser -> on-device Whisper', T.mode);
      chk([...subs].some(s => /LOADING SPEECH|LISTENING|HEARING|WRITING/.test(s)), 'panel shows the listening state');
      chk(/TICKET/i.test(p.q) && p.via === 'voice' && p.id === 'tickets' && /YOU: .*TICKET/.test(p.sub), 'spoken "' + p.q + '" shows as text; Grok: "' + p.a.slice(0, 50) + '..."', p.sub);
      chk(!T.active, 'TALK listened for one phrase and stopped');
    }
    const fr = await E(() => window.__gaVR.frames); await H.frames(page, 10); chk((await E(() => window.__gaVR.frames)) > fr, 'VR still rendering');
    await tap('close'); p = await P(); chk(!p.panel && !p.open && !(await E(() => window.__gaSTT.active)), 'CLOSE ends the chat');
  } catch (e) { chk(false, 'threw: ' + e.message); }
  const errs = errors.filter(e => !/supabase|Failed to load resource|net::ERR/i.test(e)); chk(!errs.length, 'no page errors', errs);
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
