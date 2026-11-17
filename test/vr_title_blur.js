// vrtest-v5: (1) Dave t461u: the Quest system overlay (right Meta button) makes the XR session 'visible-blurred'; the game must stop
// reading the controllers (no Y menu, no movement, nothing held in a cabinet game), stop haptics and suspend audio, and pick up again
// on 'visible'. (2) Dave t462u: Y menu -> BACK TO TITLE SCREEN -> YES/NO in-world; YES ends the XR session cleanly, leaves the cabinet
// game, shows the start screen, and PLAY + ENTER VR work again.   node test/vr_title_blur.js
const { openVR, H, IWER_SRC, SETUP } = require('./vrlib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await openVR({ init: { content: IWER_SRC + SETUP } });
  const E = (f, a) => page.evaluate(f, a), until = (f, ms = 30000) => page.waitForFunction(f, null, { timeout: ms });
  const kind = () => E(() => window.__gaVR.ui.kind || null);
  const place = async (x, z, yaw = 0) => { await E(([x, z, yaw]) => { const S = window.__gaVR; S.rig = { x, y: 0, z, yaw }; S.applyRig(); window.__arcade.monkey.position.set(x, 0, z); }, [x, z, yaw]); await H.frames(page, 6); };
  const tap = async id => { const w = await E(id => window.__gaVR.ui.btnWorld(id), id); if (!w) throw new Error('no button ' + id + ' in ' + (await kind()) + ' ' + JSON.stringify(await E(() => window.__gaVR.ui.btns.map(b => b.id))));
    await H.aim(page, 'right', [0.2, 1.3, -0.2], w); await H.frames(page, 3); await H.press(page, 'right', 'trigger'); await H.frames(page, 4); };
  const vis = v => E(v => { const s = window.__arcade.renderer.xr.getSession(); Object.defineProperty(s, 'visibilityState', { configurable: true, get: () => v }); s.dispatchEvent(new Event('visibilitychange')); }, v);
  try {
    await until(() => document.getElementById('vrBtn').classList.contains('on'), 60000);
    await page.click('#vrBtn'); await until(() => window.__gaVR.presenting && window.__gaVR.posed);
    await place(2, 4, 0);
    await E(() => { const AC = window.AudioContext || window.webkitAudioContext; window.__unlockAC = window.__unlockAC || new AC(); return window.__unlockAC.resume(); });
    // ---- (1) system overlay ----
    await vis('visible-blurred'); await H.frames(page, 4);
    const b0 = await E(() => ({ blurred: window.__gaVR.blurred, polls: window.__gaVR.blurPolls || 0, ac: window.__unlockAC.state }));
    await H.press(page, 'left', 'y-button'); await H.frames(page, 6);
    const mv0 = await E(() => [window.__arcade.monkey.position.x, window.__arcade.monkey.position.z]);
    await H.frames(page, 10);
    const b1 = await E(() => ({ blurred: window.__gaVR.blurred, polls: window.__gaVR.blurPolls || 0, frames: window.__gaVR.blurFrames || 0, kind: window.__gaVR.ui.kind || null, ac: window.__unlockAC.state, move: window.__arcade.st.vrMove }));
    chk(b0.blurred === true && b1.polls > b0.polls && b1.frames > 0, 'visible-blurred: input polling paused (' + JSON.stringify(b1) + ')');
    chk(!b1.kind, 'visible-blurred: Y does nothing (no menu behind the system overlay)');
    chk(b1.ac === 'suspended', 'visible-blurred: audio suspended (' + b1.ac + ')');
    await page.waitForTimeout(400); chk((await E(() => window.__unlockAC.state)) === 'suspended', 'audio stays suspended while blurred (music / cabinet loops cannot resume it)');
    await vis('visible'); await H.frames(page, 4); await page.waitForTimeout(300);
    const b2 = await E(() => ({ blurred: window.__gaVR.blurred, ac: window.__unlockAC.state }));
    chk(b2.blurred === false && b2.ac === 'running', 'visible again: input + audio back ' + JSON.stringify(b2));
    // ---- (2) back to title ----
    await H.press(page, 'left', 'y-button'); await H.frames(page, 4);
    chk((await kind()) === 'menu', 'Y opens the menu after the overlay closed');
    const ids = await E(() => window.__gaVR.ui.btns.map(b => b.id + ':' + b.label));
    chk(ids.includes('toTitle:BACK TO TITLE SCREEN'), 'menu has BACK TO TITLE SCREEN (' + ids.join(', ') + ')');
    await tap('toTitle'); chk((await kind()) === 'toTitle', 'it asks first (YES / NO)');
    await tap('ttNo'); chk((await kind()) === 'menu' && (await E(() => window.__gaVR.presenting)), 'NO goes back to the menu, still in VR');
    await tap('toTitle'); await tap('ttYes');
    await until(() => !window.__gaVR.presenting, 10000).catch(() => {});
    await page.waitForTimeout(800);
    const t = await E(() => ({ presenting: window.__gaVR.presenting, shown: window.__start.shown, dismissed: window.__start.dismissed, inDom: !!document.getElementById('start'), mode: window.__arcade.play.mode, toTitles: window.__gaVR.toTitles || 0, held: Object.keys(window.__gaVR.held || {}).filter(k => window.__gaVR.held[k]) }));
    chk(!t.presenting && t.shown && !t.dismissed && t.inDom && t.mode === 'walk' && t.toTitles === 1, 'YES: XR session ended, start screen shown, walk mode ' + JSON.stringify(t));
    // PLAY again (flat), then ENTER VR again
    await page.click('#stStart'); await until(() => window.__start.dismissed, 10000);
    await until(() => document.getElementById('vrBtn').classList.contains('on'), 20000);
    await page.click('#vrBtn'); const back = await until(() => window.__gaVR.presenting && window.__gaVR.posed, 20000).then(() => true, () => false);
    chk(back, 'PLAY then ENTER VR works again after going back to the title');
  } catch (e) { chk(false, 'exception ' + e.message.split('\n')[0]); }
  chk(errors.length === 0, 'no page errors ' + errors.slice(0, 3).join('|'));
  await close(); console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
