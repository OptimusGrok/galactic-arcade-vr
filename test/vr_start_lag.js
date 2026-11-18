// vrtest-v9 (Dave t468u: "There is still some lag on the start screen"): the real start / player-select screen on an emulated Quest 3 with the
// CPU slowed (CPU=4 default) while the VR pre-warm runs in the background. Every page frame interval (rAF) is recorded from load until the
// pre-warm is done + 2 s. Prints START {prewarmMs, frames, max, top5, over50, over100, p95} and the pre-warm stages. CHECK=1: no frame > MAXMS (150).
const { openVR, IWER_SRC, SETUP } = require('./vrlib');
const CPU = +(process.env.CPU || 4), MAXMS = +(process.env.MAXMS || 150);
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ cpu: CPU, start: true, supa: r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    init: { content: IWER_SRC + SETUP + ';try{localStorage.setItem("galacticarcade.player",JSON.stringify({name:"VRTEST"}))}catch(e){};(function(){var L=window.__lag={iv:[],last:0};function f(t){if(L.last)L.iv.push([Math.round(t),+(t-L.last).toFixed(1)]);L.last=t;requestAnimationFrame(f)}requestAnimationFrame(f)})();' } });
  await page.waitForFunction(() => window.__gaVR && window.__gaVR.prewarm && window.__gaVR.prewarm.done, null, { timeout: 300000 });
  await page.waitForTimeout(2000);
  const R = await page.evaluate(() => { const P = window.__gaVR.prewarm, a = window.__lag.iv.filter(x => x[0] > P.startedAt - 200), v = a.map(x => x[1]), s = v.slice().sort((x, y) => y - x);
    return { prewarmMs: P.ms, startScreen: !!document.getElementById('start'), frames: v.length, max: s[0], top5: s.slice(0, 5), over50: v.filter(x => x > 50).length, over100: v.filter(x => x > 100).length, p95: s[Math.floor(s.length * 0.05)], areas: P.areas, programs: P.programs, textures: P.textures }; });
  console.log('START ' + JSON.stringify(R));
  if (process.env.CHECK) { chk(R.startScreen, 'measured on the start screen'); chk(R.max <= MAXMS, 'start screen: no frame over ' + MAXMS + ' ms while the VR pre-warm runs (longest ' + R.max + ' ms, ' + R.over100 + ' over 100 ms)'); chk(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join('|')); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); }
  await close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FAIL exception ' + e.message); process.exit(1); });
