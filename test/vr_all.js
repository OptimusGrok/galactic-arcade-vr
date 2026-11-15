// Galactic Arcade VR: every other cabinet launches in VR (emulated Quest 3): game screen texture live, A inserts the ticket price
// and starts it (the machine's own scene() reports play where it can), mapped buttons reach the game, grip leaves.
const { openVR, H } = require('./vrlib');
(async () => {
  const { page, errors, close } = await openVR(process.env.W ? { w: +process.env.W, h: +process.env.H } : {}); let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const rows = []; if (process.env.DUMP) { page.on('pageerror', e => console.log('PAGEERROR', e.stack)); page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text(), JSON.stringify(m.location())); }); }
  try {
    await page.waitForFunction(() => document.getElementById('vrBtn').classList.contains('on'), null, { timeout: 20000 });
    await page.evaluate(() => { window.__arcade.play.tickets.total = 200; window.__noRandomRoom = 1; });
    await page.click('#vrBtn'); await page.waitForFunction(() => window.__gaVR.presenting && window.__gaVR.posed, null, { timeout: 30000 });
    const keys = (process.env.CABS || 'monkey,berserker,orc,cyber,blaster,pip,bb,rockfall,skytower,nova,claw,roadster,ds').split(',');
    for (const key of keys) {
      const r = { key }; const t0 = Date.now();
      try {
        r.has = await page.evaluate(k => !!window.__arcade.play.machines[k], key); if (!r.has) { rows.push(r); continue; }
        const tk0 = await page.evaluate(() => window.__arcade.play.tickets.total);
        await page.evaluate(k => { const m = window.__arcade.play.machines[k]; window.__gaVR.startCab(m.cab, m.cab.userData.centre); }, key);
        await page.waitForFunction(() => window.__arcade.play.mode === 'game' && window.__arcade.play.sub === 'demo', null, { timeout: 90000 });
        const u0 = await page.evaluate(() => window.__gaVR.texUploads); await H.frames(page, 15);
        const h0 = await page.evaluate(() => window.__gaVR.compHash());
        await H.press(page, 'right', 'a-button'); await H.press(page, 'right', 'a-button');
        r.cost = tk0 - await page.evaluate(() => window.__arcade.play.tickets.total);
        r.sub = await page.evaluate(() => window.__arcade.play.sub);
        await H.frames(page, 20);
        r.scene = await page.evaluate(() => { const P = window.__arcade.play; try { return P.cur.scene(P.frame.contentWindow); } catch (e) { return 'err:' + e.message; } });
        const k0 = await page.evaluate(() => window.__gaVR.keysSent);
        await H.axes(page, 'left', 1, 0); await H.frames(page, 6); await H.axes(page, 'left', 0, 0); await H.press(page, 'right', 'a-button', 4);
        r.keys = await page.evaluate(() => window.__gaVR.keysSent) - k0;
        if ((await page.evaluate(k => (window.__gaVR.maps[k] || window.__gaVR.maps.default).trig, key)) === 'ptr') {   // pointer games: aim at the in-world screen, trigger = tap there
          await page.evaluate(() => { const P = window.__arcade.play, w = P.frame.contentWindow; w.__vrTaps = 0; w.document.addEventListener('pointerdown', () => w.__vrTaps++, true); });
          const sp = await page.evaluate(() => { const g = window.__gaVR.screen; g.updateMatrixWorld(true); const p = g.localToWorld(new window.__arcade.THREE.Vector3(0.1, 0.1, 0)); return [p.x, p.y, p.z]; });
          const p0 = await page.evaluate(() => window.__gaVR.ptrSent); await H.aim(page, 'right', [0.15, 1.3, -0.1], sp); await H.frames(page, 3); await H.press(page, 'right', 'trigger', 4);
          r.ptr = await page.evaluate(() => window.__gaVR.ptrSent) - p0; r.taps = await page.evaluate(() => window.__arcade.play.frame.contentWindow.__vrTaps); }
        await H.frames(page, 10);
        const s = await page.evaluate(() => window.__gaVR.state());
        r.uploads = s.texUploads - u0; r.changed = h0 !== await page.evaluate(() => window.__gaVR.compHash()); r.size = s.comp.join('x'); r.pumps = s.pumps;
        r.lit = await page.evaluate(() => { const c = window.__gaVR.comp, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, k = 0; for (let i = 0; i < d.length; i += 4 * 7) { k++; if (d[i] + d[i + 1] + d[i + 2] > 40) n++; } return +(100 * n / k).toFixed(1); });   // % of non-dark pixels (space games are mostly black)
        if (process.env.DUMP) { const u = await page.evaluate(() => window.__gaVR.comp.toDataURL('image/png')); require('fs').writeFileSync('/tmp/vr_' + key + '.png', Buffer.from(u.split(',')[1], 'base64')); }
        await H.btn(page, 'left', 'squeeze', 1); await page.waitForFunction(() => window.__arcade.play.mode !== 'game', null, { timeout: 15000 }); await H.btn(page, 'left', 'squeeze', 0);
        await page.waitForFunction(() => window.__arcade.play.mode === 'walk', null, { timeout: 20000 });
        r.left = true;
      } catch (e) { r.err = String(e.message || e).split('\n')[0]; try { await page.evaluate(() => { const P = window.__arcade.play; if (P.mode === 'game') P.exit('test'); }); await page.waitForFunction(() => window.__arcade.play.mode === 'walk', null, { timeout: 20000 }); } catch (e2) {} }
      r.s = ((Date.now() - t0) / 1000).toFixed(0); rows.push(r); console.log(JSON.stringify(r));
    }
  } catch (e) { chk(false, 'exception ' + (e && e.stack || e)); }
  for (const r of rows) { if (!r.has) { console.log('SKIP ' + r.key + ' (no machine)'); continue; }
    chk(!r.err && r.left && r.uploads > 10 && r.lit > 0.3 && r.cost === (r.key === 'claw' ? 1 : 5) && r.sub === 'play' && r.keys >= 2 && (r.ptr === undefined || (r.ptr >= 3 && r.taps >= 1)),
      r.key + ': launch + screen (' + r.size + ', ' + r.lit + '% lit, changing ' + r.changed + ') + tickets -' + r.cost + ' + start (game scene ' + r.scene + ') + keys ' + r.keys + (r.ptr !== undefined ? ' + screen taps ' + r.taps + ' (' + r.ptr + ' pointer events)' : '') + ' + grip exit' + (r.err ? ' ERR ' + r.err : '')); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e));
  chk(errs.length === 0, 'no page errors ' + errs.slice(0, 6).join(' | '));
  await close(); process.exit(ok ? 0 : 1);
})();
