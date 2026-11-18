// vrtest-v13 (Dave t487u): v12's 20% shop-white dim was hard to see in VR. Another 30% on top
// (0.8 * 0.7 = 0.56 of the original) is applied to ALL shop-room whites, and checkout-top
// emissive intensity is cut so ACES / the headset doesn't clip the change away. Floor glow stays 50%.
// Light count is unchanged (the v7 24-light set must stay). Small viewport.
// Also a pixel-brightness check: average luminance of those regions must drop clearly below undimmed white.
//   flock /workspace/.browser-test.lock node test/shop_dim.js
const { open } = require('./lib');

(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await open({ w: 480, h: 270 });
  try {
    await page.waitForFunction(() => window.__shop && window.__shop.G && window.__shop.WHITE_K && window.__tp && window.__tp.whiteRoom, null, { timeout: 90000 });
    const s = await page.evaluate(() => {
      const A = window.__arcade, T = A.THREE, G = window.__shop.G, W = window.__tp.whiteRoom, k = window.__shop.WHITE_K;
      const hex = (c) => '#' + c.getHexString();
      const dimC = (h, kk = k) => new T.Color().setRGB(((h >> 16) & 255) / 255 * kk, ((h >> 8) & 255) / 255 * kk, (h & 255) / 255 * kk, T.SRGBColorSpace);
      const want = (h, kk) => hex(dimC(h, kk));
      const mat = (n, root) => { const o = (root || G).getObjectByName(n); return o && o.material; };
      const mOf = (n, root) => { const m = mat(n, root); return m ? { name: n, color: hex(Array.isArray(m) ? m[0].color : m.color), emissive: (m.emissive ? hex(m.emissive) : null), emissiveIntensity: m.emissiveIntensity, opacity: m.opacity, vertexColors: !!m.vertexColors } : { name: n, missing: true }; };
      const lights = [];
      (W || A.scene).traverse(o => { if (o.isLight) lights.push({ name: o.name || o.type, type: o.type, intensity: o.intensity, color: o.color ? hex(o.color) : null }); });
      const sky = mat('shopSkylight');
      const floor = W.getObjectByName('shopRoomFloor'), wall = W.getObjectByName('shopRoomWall');
      return {
        k, glowK: window.__shop.FLOOR_GLOW_K, emK: window.__shop.EMISSIVE_K,
        want: { white: want(0xffffff), rim: want(0xdfe4ec), emis: want(0xb0b4bc), lids: want(0xe4e8ef), floor: want(0xd6d9de), wall: want(0xdde0e5), chrome: want(0xd6dbe2) },
        cornice: mOf('shopCornice'), rim: mOf('shopRoofRim'), shelf: mOf('shopShelfFrame'),
        back: mOf('shelfBack'), bay: mOf('grokBayGlow'), pools: mOf('shelfLightPools'),
        lit: mOf('ceilingLight'), top: mOf('checkoutTop'), cyan: mOf('cyanGlow'), mag: mOf('magentaGlow'),
        shell: mOf('shopShell'), candy: mOf('candyStand'), lids: mOf('jarLids'), jars: mOf('candyJars'),
        gloss: mOf('glossFloor'), floor: floor ? { name: 'shopRoomFloor', color: hex(floor.material.color) } : { missing: true },
        wall: wall ? { name: 'shopRoomWall', color: hex(wall.material.color) } : { missing: true },
        wardrobeBody: !!G.getObjectByName('wardrobeCorner') && !!G.getObjectByName('wardrobeCorner').getObjectByName('wardrobeBody'),
        skyRib: sky && sky.fragmentShader && /vec3\(([^)]+)\), max\(rib/.exec(sky.fragmentShader) ? RegExp.$1 : null,
        wrLights: lights,
        prizeShopLights: (() => { let n = 0; G.traverse(o => { if (o.isLight) n++; }); return n; })(),
      };
    });
    console.log(JSON.stringify(s, null, 2));
    chk(s.k === 0.56 && s.glowK === 0.5 && s.emK === 0.56, 'WHITE_K 0.56 (v12 0.8 x 0.7), FLOOR_GLOW_K 0.5, EMISSIVE_K 0.56');
    const dim = s.want.white;
    chk(s.cornice.color === dim && s.cornice.vertexColors, 'shopCornice white multiplier 0xffffff -> ' + dim + ' (0.56x), vertex colours kept');
    chk(s.rim.color === s.want.rim, 'shopRoofRim 0xdfe4ec -> ' + s.want.rim + ' (0.56x)');
    chk(s.shelf.color === dim && s.shelf.vertexColors, 'shopShelfFrame (price shelf) white multiplier 0xffffff -> ' + dim + ' (0.56x)');
    chk(s.back.color === dim, 'shelfBack white 0xffffff -> ' + dim + ' (0.56x)');
    chk(s.bay.color === dim, 'grokBayGlow white 0xffffff -> ' + dim + ' (0.56x)');
    chk(s.pools.opacity === 0.56, 'shelfLightPools opacity 1 -> 0.56');
    chk(s.lit.color === dim, 'ceilingLight (window soffit + shelf LEDs) 0xffffff -> ' + dim + ' (0.56x)');
    chk(s.top.color === dim && s.top.emissive === s.want.emis && Math.abs(s.top.emissiveIntensity - 0.56) < 1e-6, 'checkoutTop color + emissive 0.56x, emissiveIntensity 1 -> 0.56 (so it does not clip)');
    chk(s.cyan.opacity === 0.5 && s.mag.opacity === 0.5, 'cyanGlow + magentaGlow (counter glow on the neon floor) opacity stays 0.5');
    chk(s.skyRib === '.482,.498,.526', 'shopSkylight silver rib mix vec3(.86,.89,.94) -> vec3(.482,.498,.526) (0.56x)');
    chk(s.shell.color === dim && s.shell.vertexColors, 'shopShell back wall white multiplier 0.56x');
    chk(s.candy.color === dim && s.candy.vertexColors, 'candyStand white multiplier 0.56x');
    chk(s.lids.color === s.want.lids, 'jarLids 0xe4e8ef -> ' + s.want.lids + ' (0.56x)');
    chk(s.jars.color === dim, 'candyJars white 0.56x');
    chk(s.floor.color === s.want.floor, 'shopRoomFloor 0xd6d9de -> ' + s.want.floor + ' (0.56x)');
    chk(s.wall.color === s.want.wall, 'shopRoomWall 0xdde0e5 -> ' + s.want.wall + ' (0.56x)');
    chk(s.wardrobeBody, 'wardrobeBody (accessories shelf) is present; its white / chrome vertex colours use 0.56x');
    chk(s.prizeShopLights === 0, 'prizeShop added no lights (count ' + s.prizeShopLights + ')');
    const pts = s.wrLights.filter(l => l.type === 'PointLight');
    chk(pts.length === 1 && Math.abs(pts[0].intensity - 52) < 1e-6, 'whiteRoom still has its single PointLight at intensity 40 * 1.3 = 52 (count unchanged): ' + JSON.stringify(pts));

    // ---- pixel luminance: aim at each white region and sample the projected mesh ----
    const WX = 80;
    const views = [
      { name: 'shopCornice', pos: [WX, 5.2, 2.4], at: [WX, 8.3, -2.6], label: 'space-window soffit / cornice' },
      { name: 'shopShelfFrame', pos: [WX, 2.2, 2.8], at: [WX, 2.4, -3.1], label: 'prize / price shelves' },
      { name: 'checkoutTop', pos: [WX + 4.45, 2.2, 1.4], at: [WX + 4.45, 1.04, -1.95], label: "Grok's counter top" },
      { name: 'candyStand', pos: [WX - 3.1, 1.6, -1.95], at: [WX - 5.0, 0.9, -1.95], label: 'candy stand' },
      { name: 'wardrobeBody', pos: [WX - 1.2, 1.8, 7.5], at: [WX + 1.75, 1.4, 7.5], label: 'accessories shelf' },
      { name: 'shopRoomFloor', pos: [WX, 3.4, 2.0], at: [WX, 0, 2.0], label: 'shop floor', root: 'room' },
      { name: 'ceilingLight', pos: [WX, 4.6, 0.5], at: [WX, 8.1, -2.8], label: 'ceiling / soffit lights' },
    ];

    const lumaOf = async (v) => {
      await page.evaluate(({ pos, at }) => {
        const A = window.__arcade;
        A.monkey.position.set(pos[0], 0, pos[2]);
        A.st.vel.set(0, 0, 0);
        window.__camOverride = { pos, at, showMonkey: false };
      }, v);
      await page.waitForTimeout(350);
      const rect = await page.evaluate((name) => {
        const A = window.__arcade, T = A.THREE, G = window.__shop.G, W = window.__tp.whiteRoom;
        const o = G.getObjectByName(name) || (G.getObjectByName('wardrobeCorner') && G.getObjectByName('wardrobeCorner').getObjectByName(name)) || W.getObjectByName(name);
        if (!o) return { missing: true, name };
        o.updateWorldMatrix(true, true);
        const box = new T.Box3().setFromObject(o), c = new T.Vector3(), s = new T.Vector3();
        box.getCenter(c); box.getSize(s);
        const pts = [];
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const p = new T.Vector3(x, y, z).project(A.camera);
          pts.push({ x: (p.x * 0.5 + 0.5), y: (1 - (p.y * 0.5 + 0.5)) });
        }
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const clamp01 = (n) => Math.max(0, Math.min(1, n));
        // Large merged meshes (floor, cornice, soffit lights) have every AABB corner off-screen.
        // Intersect the projected box with the viewport, then with the aimed central window.
        let x0 = clamp01(Math.min(...xs)), x1 = clamp01(Math.max(...xs)), y0 = clamp01(Math.min(...ys)), y1 = clamp01(Math.max(...ys));
        const ix0 = Math.max(x0, 0.28), ix1 = Math.min(x1, 0.72), iy0 = Math.max(y0, 0.28), iy1 = Math.min(y1, 0.72);
        if (ix1 - ix0 > 0.02 && iy1 - iy0 > 0.02) { x0 = ix0; x1 = ix1; y0 = iy0; y1 = iy1; }
        else {
          const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, hx = Math.max(0.04, (x1 - x0) * 0.25), hy = Math.max(0.04, (y1 - y0) * 0.25);
          x0 = clamp01(mx - hx); x1 = clamp01(mx + hx); y0 = clamp01(my - hy); y1 = clamp01(my + hy);
        }
        const onscreen = Math.max(...xs) > 0 && Math.min(...xs) < 1 && Math.max(...ys) > 0 && Math.min(...ys) < 1;
        return { name, x0, x1, y0, y1, onscreen, ok: onscreen && (x1 - x0) > 0.01 && (y1 - y0) > 0.01 };
      }, v.name);
      if (!rect || rect.missing || !rect.ok) return { name: v.name, label: v.label, skip: true, rect };
      const buf = await page.screenshot({ type: 'png' });
      const b64 = buf.toString('base64');
      return page.evaluate(async ({ b64, rect, label, name }) => {
        const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const x = Math.round(rect.x0 * c.width), y = Math.round(rect.y0 * c.height);
        const w = Math.max(2, Math.round((rect.x1 - rect.x0) * c.width)), h = Math.max(2, Math.round((rect.y1 - rect.y0) * c.height));
        const d = g.getImageData(x, y, w, h).data;
        let sum = 0, n = 0, max = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 8) continue;
          const r = d[i] / 255, gv = d[i + 1] / 255, b = d[i + 2] / 255;
          const yv = 0.2126 * r + 0.7152 * gv + 0.0722 * b;
          sum += yv; if (yv > max) max = yv; n++;
        }
        return { name, label, luma: n ? sum / n : 0, max, n, w, h };
      }, { b64, rect, label: v.label, name: v.name });
    };

    const LUMA_MAX = 0.70;   // undimmed / clipped whites sit around 0.85–1.0; 0.56x must land clearly under this
    for (const v of views) {
      const r = await lumaOf(v);
      if (r.skip) { chk(false, 'pixel luma ' + v.label + ' (' + v.name + '): region not on screen ' + JSON.stringify(r.rect)); continue; }
      const msg = 'pixel luma ' + r.label + ' = ' + r.luma.toFixed(3) + ' (max ' + r.max.toFixed(3) + ', ' + r.n + ' px) should be < ' + LUMA_MAX;
      chk(r.n > 20 && r.luma < LUMA_MAX, msg);
    }
  } catch (e) { chk(false, 'exception ' + String(e && e.stack || e).slice(0, 800)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e));
  chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close();
  console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
