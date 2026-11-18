// vrtest-v10 (Dave t475u/t476u on a real Quest: "it will freeze on 60% with black screen while I can hear the arcade running", "have the arcade
// play after the loading", "the greeting and grok entering too"). Enter VR straight away on an emulated Quest 3 at CPU=4 with ?warmlog=1:
//  - the PREPARING VR card's number moves through real steps and the card lifts (well under the 20 s cap)
//  - while it is up: no arcade sound (AudioContext suspended, room music target 0, no cabinet loop), no greeting, no Grok, no attract demo
//  - after it lifts: sound resumes, room music fades in from 0, the greeting starts only after the reveal
// NEVER=1 fakes KHR_parallel_shader_compile whose links never report ready (the worst case for the Quest stall): the link cap must still lift the card.
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
const NEVER = !!process.env.NEVER;
const FAKE_KHR = `;(function(){ for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) { const P = C.prototype, ge = P.getExtension, gs = P.getSupportedExtensions, gp = P.getProgramParameter;
  P.getExtension = function (n) { if (n === 'KHR_parallel_shader_compile') return { COMPLETION_STATUS_KHR: 37297, MAX_SHADER_COMPILER_THREADS_KHR: 37296, maxShaderCompilerThreadsKHR() {} }; return ge.call(this, n); };
  P.getSupportedExtensions = function () { return (gs.call(this) || []).concat('KHR_parallel_shader_compile'); };
  P.getProgramParameter = function (p, k) { if (k === 37297) { window.__neverPolls = (window.__neverPolls || 0) + 1; return false; } return gp.call(this, p, k); }; } })();`;
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ cpu: 4, qs: '?warmlog=1', init: { content: (NEVER ? FAKE_KHR : '') + IWER_SRC + SETUP } });
  const E = (f, a) => page.evaluate(f, a); const logs = []; page.on('console', m => { const t = m.text(); if (t.startsWith('[warm]')) logs.push(t); });
  try {
    // like Dave tapping PLAY then entering VR before the pre-warm is done: the start screen counts as dismissed now (greeting due in 3 s, music + Grok armed)
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 60000 });
    await E(() => { const S = window.__start; S.dismissed = true; S.at = performance.now(); }); await page.click('#vrBtn');
    await page.waitForFunction(() => window.__gaVR.presenting, null, { timeout: 30000 });
    const samples = [];
    for (let k = 0; k < 400; k++) { const s = await E(() => { const S = window.__gaVR, ac = window.__unlockAC, M = window.__music || {}, C = window.__cabMusic || {}, P = window.__pa || {}, G = window.__grokVisit || {};
        return { on: S.veil.on, pct: S.veil.pct, hold: !!window.__gaHoldAV, ac: ac ? ac.state : 'none', mt: M.target || 0, cab: C.want || null, pa: !!P.playing, paN: P.played || 0, grok: G.state || null, t: Math.round(performance.now()) }; });
      samples.push(s); if (!s.on && k > 2) break; await page.waitForTimeout(100); }
    const up = samples.filter(s => s.on), V = await E(() => ({ ms: window.__gaVR.veil.ms, timedOut: window.__gaVR.veil.timedOut || 0, capped: window.__gaVR.prewarm.linkCapped || 0, link1Max: window.__gaVR.prewarm.link1Max || 0, reveal: window.__gaRevealAt, polls: window.__neverPolls || 0, log: window.__gaVR.warmLog() }));
    const pcts = [...new Set(up.map(s => s.pct).filter(x => x != null))];
    console.log('CARD ' + JSON.stringify({ ms: V.ms, timedOut: V.timedOut, capped: V.capped, link1Max: V.link1Max, polls: V.polls, pcts, samples: up.length }));
    console.log('LOG ' + JSON.stringify(V.log.slice(0, 14)));
    chk(up.length > 0 && V.ms > 0, 'the PREPARING VR card was up after entering VR early (' + V.ms + ' ms)');
    chk(!V.timedOut && V.ms < (NEVER ? 15000 : 12000), 'the card lifted on its own, before the 20 s cap (' + V.ms + ' ms' + (NEVER ? ', links never report ready: capped ' + V.capped + ', longest single link ' + V.link1Max + ' ms' : '') + ')');
    chk(pcts.length >= 3 && pcts.every((p, i) => !i || p >= pcts[i - 1]), 'the card number moves through the steps ' + JSON.stringify(pcts));
    chk(up.every(s => s.hold && s.ac !== 'running' && s.mt === 0 && !s.cab && !s.pa), 'while the card is up: AV held, AudioContext not running, room music target 0, no cabinet loop, no greeting ' + JSON.stringify(up.filter(s => !(s.hold && s.ac !== 'running' && s.mt === 0 && !s.cab && !s.pa)).slice(0, 3)));
    chk(up.every(s => !s.grok || s.grok === 'idle'), 'Grok does not start his visit under the card');
    chk(up.every(s => s.paN === 0), 'the greeting has not played before the reveal');
    await page.waitForTimeout(1500);
    await page.waitForTimeout(1500); const a = await E(() => ({ hold: !!window.__gaHoldAV, ac: window.__unlockAC ? window.__unlockAC.state : 'none', mt: window.__music ? window.__music.target : 0, g: window.__music ? window.__music.gain : 0, loaded: window.__music && window.__music.loaded }));
    chk(!a.hold && a.ac === 'running' && a.mt > 0 && (!a.loaded || a.g > 0.05), 'after the reveal the arcade sound runs again and the room music fades in ' + JSON.stringify(a));
    const pa = await page.waitForFunction(() => window.__pa && window.__pa.played > 0, null, { timeout: 15000 }).then(() => E(() => ({ at: window.__pa.at, reveal: window.__gaRevealAt }))).catch(() => null);
    chk(pa && pa.at >= pa.reveal + 1400, 'the greeting starts after the reveal ' + JSON.stringify(pa && { afterRevealMs: Math.round(pa.at - pa.reveal) }));
    chk(logs.length > 3 && V.log.some(l => /linked 1:vis/.test(l)), '?warmlog=1 logs the steps (' + logs.length + ' console lines)');
  } catch (e) { chk(false, 'exception ' + e.message.split('\n')[0]); }
  chk(errors.filter(e => !/supabase|net::|Failed to load/i.test(e)).length === 0, 'no page errors ' + JSON.stringify(errors.filter(e => !/supabase|net::|Failed to load/i.test(e)).slice(0, 3)));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL exception ' + e.message); process.exit(1); });
