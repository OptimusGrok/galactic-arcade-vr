// v16 (t399u, Dave): NEON KNOCKOUT in Galactic Arcade VR (flat screen path). Lazy load (nothing requested at startup), the room-1 teleporter's
// NEON KNOCKOUT button beams to the studio, the flat menu (difficulty / daily / gloves / start), F / J punches + SPACE ducks through real key
// events, a finished round pays tickets by grade, the daily routine is the same all day and pays its bonus once, glove skins from the shop,
// the high-score wall, the studio silences the room music, leaving mid-round pays nothing, the pad's ARCADE button goes back.
const { open } = require('./lib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, requests, close } = await open({ w: 640, h: 360 });
  const E = (f, a) => page.evaluate(f, a), until = (f, ms = 30000, arg) => page.waitForFunction(f, arg, { timeout: ms });
  try {
    await page.waitForTimeout(1500);
    chk(!requests.some(u => /nk\/nkgame\.js/.test(u)) && !(await E(() => !!window.__nkGame)), 'lazy: nk/nkgame.js is not requested at startup');
    await E(() => { localStorage.removeItem('gaNK.scores'); localStorage.removeItem('gaNK.dailyDone'); localStorage.removeItem('gaNK.gloves'); localStorage.removeItem('gaNK.diff'); window.__arcade.play.tickets.total = 500; });
    // glove shop: Fire Gloves tile in Grok's hologram shop, BUY then WEAR (no second charge)
    await E(() => window.__shop.openShop()); await page.waitForTimeout(300);
    let s = await E(() => ({ tiles: [...document.querySelectorAll('#holoL [data-nkt]')].map(e => e.dataset.nkt), prizes: document.querySelectorAll('#holoL button[data-id]').length, items: window.__shop.ITEMS.length }));
    chk(s.tiles.join() === 'gold,fire,ice' && s.prizes === s.items, 'shop: Gold / Fire / Ice glove tiles after the prizes ' + JSON.stringify(s));
    await E(() => { const b = document.querySelector('#holoL button[data-nk="fire"]'); for (const t of ['pointerdown', 'pointerup']) b.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: 5, clientY: 5 })); }); await page.waitForTimeout(200);   // the hologram tap path (holoAct / holoDo)
    s = await E(() => ({ t: window.__arcade.play.tickets.total, g: JSON.parse(localStorage.getItem('gaNK.gloves')), lbl: document.querySelector('#holoL button[data-nk="fire"]').textContent }));
    chk(s.t === 300 && s.g.owned.includes('fire') && s.g.on === 'fire' && s.lbl === 'WEARING', 'BUY Fire Gloves: -200 tickets, owned + worn ' + JSON.stringify(s));
    await E(() => window.__shop.buyGlove('fire')); chk((await E(() => window.__arcade.play.tickets.total)) === 300, 'owned gloves: WEAR again costs nothing');
    await E(() => window.__shop.closeShop());
    // beam to the studio with the NEON KNOCKOUT button
    await E(() => { const A = window.__arcade, P = window.__tp.PAD1; A.monkey.position.set(P.x + 0.3, 0, P.z + 0.3); window.__tpTimeScale = 3; });
    await until(() => document.querySelector('#tpNK.on') && document.querySelector('#tpBtn.on'), 15000);
    s = await E(() => { const a = document.getElementById('tpBtn').getBoundingClientRect(), b = document.getElementById('tpNK').getBoundingClientRect(); return { shop: document.getElementById('tpBtn').textContent, nk: document.getElementById('tpNK').textContent, side: b.left >= a.right - 2 && Math.abs(a.top - b.top) < 4 }; });
    chk(s.shop === 'SHOP' && s.nk === 'NEON KNOCKOUT' && s.side, 'room-1 pad: NEON KNOCKOUT button beside SHOP ' + JSON.stringify(s));
    await page.click('#tpNK');
    await until(() => window.__tp.where === 3 && window.__tp.state === 'idle' && window.__nkGame && window.__nkGame.inStudio, 40000);
    s = await E(() => { const A = window.__arcade, N = window.__nkGame, sc = A.scene; return { req: performance.getEntriesByType('resource').some(r => /nk\/nkgame\.js/.test(r.name)), root: sc.getObjectByName('nkStudio').visible, x: A.monkey.position.x, mus: window.__music.target, ui: document.getElementById('nkUI').classList.contains('on'), tp: document.getElementById('tpBtn').textContent, err: N.err || null }; });
    chk(s.req && s.root && s.x < -70 && s.ui, 'beamed to the studio: module loaded on the beam, studio shown, flat menu up ' + JSON.stringify(s));
    await page.waitForTimeout(400);
    chk((await E(() => window.__music.target)) === 0, 'room music silent in the studio (the game has its own beat)');
    chk(await E(() => window.__nkGame.state.skin === 'fire' && window.__nkGame.gloves.L.userData.white.color.getHex() === 0xff4a12), 'Fire Gloves worn in the game');
    // difficulty: BEAST is faster with more duck bars than EASY
    const run = async (sel) => { await page.click('#nkUI [data-nk="' + sel + '"]'); await page.click('#nkGo'); await page.waitForTimeout(150);
      const r = await E(() => { const N = window.__nkGame, ev = N.events(); return { bpm: N.BPM, bars: ev.filter(e => e.type === 'BAR').length, n: ev.length, sig: JSON.stringify(ev.slice(0, 40)), mode: N.state.mode }; });
      await page.keyboard.press('Escape'); await page.waitForTimeout(150); return r; };
    const ez = await run('easy'), bs = await run('beast'), nm = await run('normal');
    chk(ez.mode === 'play' && ez.bpm === 110 && nm.bpm === 124 && bs.bpm === 140, 'tempo by difficulty: EASY ' + ez.bpm + ' / NORMAL ' + nm.bpm + ' / BEAST ' + bs.bpm + ' BPM');
    chk(bs.bars > nm.bars && nm.bars > ez.bars, 'more duck bars as it gets harder: ' + ez.bars + ' / ' + nm.bars + ' / ' + bs.bars);
    chk((await E(() => window.__nkGame.state.mode)) === 'title' && (await E(() => window.__arcade.play.tickets.total)) === 300, 'ESC quits a round: back to the menu, no tickets');
    // daily: the same routine every start today
    await page.click('#nkUI [data-nk="daily"]'); await page.click('#nkGo'); await page.waitForTimeout(150);
    const d1 = await E(() => { const N = window.__nkGame; return { sig: JSON.stringify(N.events().slice(0, 40)), bpm: N.BPM, daily: N.state.daily }; }); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    const d2 = await E(() => { const N = window.__nkGame; if (!N.state.daily) N.menuAct('daily'); N.startRound(); const r = JSON.stringify(N.events().slice(0, 40)); N.abort('t'); return r; });
    const n2 = await run('normal');
    chk(d1.daily && d1.sig === d2 && d1.bpm === 124, 'DAILY: the routine is identical on every start today (date-seeded, NORMAL tempo)');
    chk(n2.sig !== nm.sig, 'normal rounds are shuffled (not the daily routine)');
    // play with real key presses: an in-page bot presses F / J on the beat and SPACE under the bars
    await page.click('#nkUI [data-nk="normal"]'); await page.click('#nkGo');
    await E(() => { const N = window.__nkGame, done = new Set(); window.__nkBot = true; const key = k => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true, cancelable: true })); };
      (function loop() { if (!window.__nkBot) return; const st = N.state; if (st.mode === 'play') { for (const t of N.targets()) { const id = t.type + ':' + (st.t + t.dt).toFixed(3); if (t.dt < 0.05 && !done.has(id)) { done.add(id); key(t.type === 'R' || (t.type === 'C' && t.x > 0) ? 'j' : 'f'); } }
        const b = N.bars(); if (b.some(d => d < 0.25 && d > 0)) key(' '); } requestAnimationFrame(loop); })(); });
    await until(() => window.__nkGame.state.t > 22, 120000);
    s = await E(() => { const st = window.__nkGame.state; return { hits: st.hits, misses: st.misses, dodges: st.dodges, bumps: st.bumps, score: st.score, pads: getComputedStyle(document.querySelector('#nkUI .pads')).display, moved: window.__arcade.monkey.position.toArray().map(v => +v.toFixed(2)) }; });
    chk(s.hits >= 8 && s.hits > s.misses * 2 && s.dodges >= 1 && s.score > 0, 'flat play with keys: F / J punches hit, SPACE dodges ' + JSON.stringify(s));
    chk(s.pads === 'flex', 'on-screen LEFT / DUCK / RIGHT buttons shown during a flat round');
    await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
    const mv = await E(() => window.__arcade.monkey.position.toArray().map(v => +v.toFixed(2)));
    chk(JSON.stringify(mv) === JSON.stringify(s.moved), 'the monkey stands still during a round (walk keys locked)');
    // on-screen buttons punch too
    const w0 = await E(() => window.__nkGame.state.whiffs || 0); await page.dispatchEvent('#nkL', 'pointerdown'); await page.waitForTimeout(100);
    chk(await E(w0 => (window.__nkGame.state.whiffs || 0) + window.__nkGame.state.hits > w0, w0), 'LEFT button throws a punch');
    // finish the round (skip ahead) -> results + tickets
    await E(() => { const N = window.__nkGame; N.skipTo(N.state.lastT - 1); }); await until(() => window.__nkGame.state.mode === 'results', 30000); await E(() => { window.__nkBot = false; });
    s = await E(() => { const N = window.__nkGame, r = N.state.result, p = N.state.payouts.slice(-1)[0]; return { r, p, t: window.__arcade.play.tickets.total, sc: JSON.parse(localStorage.getItem('gaNK.scores')), info: document.getElementById('nkInfo').textContent }; });
    chk(s.r && s.r.tix >= 1 && s.t === 300 + s.r.tix && s.r.bonus === 0, 'round complete: grade ' + (s.r && s.r.grade) + ', +' + (s.r && s.r.tix) + ' tickets paid into the arcade wallet (' + s.t + ')');
    chk(s.sc && s.sc.length === 1 && s.sc[0].s === s.r.score && s.sc[0].d === 'normal', 'score saved to the local high-score list ' + JSON.stringify(s.sc));
    chk(/GRADE/.test(s.info) && /TICKETS/.test(s.info), 'results shown in the flat menu: ' + s.info);
    // daily bonus once per day
    const daily = async () => { await E(() => { const N = window.__nkGame; if (!N.state.daily) N.menuAct('daily'); N.startRound(); N.skipTo(N.state.lastT - 0.5); }); await until(() => window.__nkGame.state.mode === 'results', 30000); return E(() => window.__nkGame.state.result); };
    const t1 = await E(() => window.__arcade.play.tickets.total), r1 = await daily(), t2 = await E(() => window.__arcade.play.tickets.total), r2 = await daily(), t3 = await E(() => window.__arcade.play.tickets.total);
    chk(r1.bonus === 15 && t2 === t1 + r1.tix + 15 && r2.bonus === 0 && t3 === t2 + r2.tix && (await E(() => localStorage.getItem('gaNK.dailyDone'))) === (await E(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })),
      'DAILY bonus +15 paid once today (second daily: ' + r2.bonus + ') ' + [t1, t2, t3].join(' -> '));
    // high-score wall
    s = await E(() => { const N = window.__nkGame, b = N.board.m, T = window.__arcade.THREE, p = b.getWorldPosition(new T.Vector3()), P = window.__tp.PAD3; return { vis: b.visible && N.board.m.parent.visible, d: Math.hypot(p.x - P.x, p.z - P.z), n: N.scores().length }; });
    chk(s.vis && s.d < 2.5 && s.n === 3, 'high-score wall beside the studio pad lists the local scores ' + JSON.stringify(s));
    // leave mid-round: aborted, nothing paid; ARCADE button on the studio pad goes back
    await E(() => { const N = window.__nkGame; N.menuAct('normal'); N.startRound(); });
    const t4 = await E(() => window.__arcade.play.tickets.total);
    await E(() => { const A = window.__arcade, P = window.__tp.PAD3; window.__nkGame.abort('test'); A.monkey.position.set(P.x + 0.2, 0, P.z + 0.2); });
    await until(() => document.querySelector('#tpBtn.on') && document.getElementById('tpBtn').textContent === 'ARCADE' && !document.querySelector('#tpNK.on'), 15000);
    await page.click('#tpBtn'); await until(() => window.__tp.where === 1 && window.__tp.state === 'idle', 40000); await page.waitForTimeout(300);
    s = await E(() => ({ root: window.__arcade.scene.getObjectByName('nkStudio').visible, ui: document.getElementById('nkUI').classList.contains('on'), t: window.__arcade.play.tickets.total, mode: window.__nkGame.state.mode, sy: window.__arcade.monkey.scale.y }));
    chk(!s.root && !s.ui && s.t === t4 && s.mode !== 'play', 'ARCADE on the studio pad beams back: studio hidden, menu gone, no payout for the unfinished round ' + JSON.stringify(s));
    await page.waitForTimeout(800); chk((await E(() => window.__music.target)) > 0, 'room music back in the arcade');
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e).toString().slice(0, 600)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e)); chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
