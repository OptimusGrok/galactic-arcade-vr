// v23 (Dave t432u): CHAT WITH GROK in the headset = preset questions only (no TYPE keyboard, no TALK / speech to text, no Whisper download).
const { openVR, H } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : '')); if (!c) ok = false; };
  const { page, errors, close, requests } = await openVR();
  const E = (f, a) => page.evaluate(f, a), until = (f, ms = 30000, arg) => page.waitForFunction(f, arg, { timeout: ms });
  const place = async (x, z, yaw) => { await E(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 6); };
  const tap = async id => { const w = await E(id => window.__gaVR.ui.btnWorld(id), id); if (!w) throw new Error('no button ' + id); await H.aim(page, 'right', [0.2, 1.3, -0.2], w); await H.frames(page, 3); await H.press(page, 'right', 'trigger'); await H.frames(page, 3); };
  try {
    await until(() => document.getElementById('vrBtn').classList.contains('on'), 30000);
    await page.click('#vrBtn'); await until(() => window.__gaVR.presenting && window.__gaVR.posed, 30000);
    await until(() => window.__shop && window.__grokChat && window.__tp, 90000);
    await E(() => { window.__tpTimeScale = 3; window.__tp.go(); }); await until(() => window.__tp.where === 2 && window.__tp.state === 'idle', 90000);
    let cs = await E(() => window.__gaVR.signs().find(q => q.id === 'chatClerk').at); await place(cs[0], cs[2] + 3.5, 0); cs = await E(() => window.__gaVR.signs().find(q => q.id === 'chatClerk').at);
    await H.aim(page, 'right', [0.2, 1.3, -0.2], cs); await H.frames(page, 3); await H.press(page, 'right', 'trigger'); await H.frames(page, 4);
    const P = () => E(() => { const S = window.__gaVR; return { panel: S.state().panel, q: S.chat.q, a: S.chat.a, open: window.__grokChat.open, btns: S.ui.btns.map(b => b.id), labels: S.ui.btns.map(b => b.label) }; });
    let p = await P(); chk(p.panel === 'chat' && p.open, 'trigger on the CHAT sign opens the chat panel');
    const labels = new Set(); for (let i = 0; i < 6; i++) { (await P()).labels.forEach(l => labels.add(l)); const nx = await E(() => (window.__gaVR.ui.btns.find(b => b.id === 'next') || {}).on); if (!nx) break; await tap('next'); }
    chk(!p.btns.includes('type') && !p.btns.includes('talk') && ![...labels].some(l => /TYPE|TALK|DAVE/.test(l)), 'no TYPE / TALK buttons (and no WHO IS DAVE) on any page', [...labels].filter(l => /TYPE|TALK|DAVE/.test(l)));
    chk([...labels].filter(l => /\?|!/.test(l)).length >= 20, 'preset questions on the pages (' + [...labels].filter(l => /\?|!/.test(l)).length + ')');
    await tap('q_1'); p = await P(); chk(/TICKET/.test(p.q) && p.a.length > 15, 'pointing at a question asks it: "' + p.q + '" -> "' + p.a.slice(0, 50) + '"');
    chk(!(await E(() => 'stt' in window.__grokChat || !!window.__gaSTT)) && !requests.some(u => /stt|whisper|onnx|transformers/i.test(u)), 'no speech-to-text code or model is loaded', requests.filter(u => /stt|whisper|onnx/i.test(u)).slice(0, 3));
    await tap('close'); p = await P(); chk(!p.panel && !p.open, 'CLOSE ends the chat');
  } catch (e) { chk(false, 'threw: ' + e.message); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|Failed to load/i.test(e)); chk(!errs.length, 'no page errors', errs.slice(0, 3));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
