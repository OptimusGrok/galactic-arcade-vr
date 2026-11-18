// vrtest-v12 (Dave t484u): in the shop, white around the space window, prize (price) shelves
// and Grok's counter is dimmed 20%; the counter's glow on the neon floor is dimmed 50%.
// Light count is unchanged (the v7 24-light set must stay). Small viewport.
//   flock /workspace/.browser-test.lock node test/shop_dim.js
const { open } = require('./lib');
(async () => {
  let ok = true; const chk = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) ok = false; };
  const { page, errors, close } = await open({ w: 480, h: 270 });
  try {
    const s = await page.evaluate(() => {
      const A = window.__arcade, T = A.THREE, G = window.__shop.G, W = window.__tp.whiteRoom;
      const hex = (c) => '#' + c.getHexString();
      const mat = (n) => { const o = G.getObjectByName(n); return o && o.material; };
      const mOf = (n) => { const m = mat(n); return m ? { name: n, color: hex(m.color), emissive: m.emissive ? hex(m.emissive) : null, opacity: m.opacity, vertexColors: !!m.vertexColors } : { name: n, missing: true }; };
      const lights = [];
      (W || A.scene).traverse(o => { if (o.isLight) lights.push({ name: o.name || o.type, type: o.type, intensity: o.intensity, color: o.color ? hex(o.color) : null }); });
      const sky = mat('shopSkylight');
      return {
        cornice: mOf('shopCornice'), rim: mOf('shopRoofRim'), shelf: mOf('shopShelfFrame'),
        back: mOf('shelfBack'), bay: mOf('grokBayGlow'), pools: mOf('shelfLightPools'),
        lit: mOf('ceilingLight'), top: mOf('checkoutTop'), cyan: mOf('cyanGlow'), mag: mOf('magentaGlow'),
        skyRib: sky && sky.fragmentShader && /vec3\(([^)]+)\), max\(rib/.exec(sky.fragmentShader) ? RegExp.$1 : null,
        wrLights: lights,
        prizeShopLights: (() => { let n = 0; G.traverse(o => { if (o.isLight) n++; }); return n; })(),
      };
    });
    console.log(JSON.stringify(s, null, 2));
    const dim = '#cccccc';
    chk(s.cornice.color === dim && s.cornice.vertexColors, 'shopCornice white multiplier 0xffffff -> 0xcccccc (0.8x), vertex colours kept');
    chk(s.rim.color === '#b2b6bd', 'shopRoofRim 0xdfe4ec -> 0xb2b6bd (0.8x)');
    chk(s.shelf.color === dim && s.shelf.vertexColors, 'shopShelfFrame (price shelf) white multiplier 0xffffff -> 0xcccccc (0.8x)');
    chk(s.back.color === dim, 'shelfBack white 0xffffff -> 0xcccccc (0.8x)');
    chk(s.bay.color === dim, 'grokBayGlow white 0xffffff -> 0xcccccc (0.8x)');
    chk(s.pools.opacity === 0.8, 'shelfLightPools opacity 1 -> 0.8');
    chk(s.lit.color === dim, 'ceilingLight (window soffit + shelf LEDs) 0xffffff -> 0xcccccc (0.8x)');
    chk(s.top.color === dim && s.top.emissive === '#8d9096', 'checkoutTop color 0xffffff -> 0xcccccc, emissive 0xb0b4bc -> 0x8d9096 (0.8x)');
    chk(s.cyan.opacity === 0.5 && s.mag.opacity === 0.5, 'cyanGlow + magentaGlow (counter glow on the neon floor) opacity 1 -> 0.5');
    chk(s.skyRib === '.688,.712,.752', 'shopSkylight silver rib mix vec3(.86,.89,.94) -> vec3(.688,.712,.752) (0.8x)');
    chk(s.prizeShopLights === 0, 'prizeShop added no lights (count ' + s.prizeShopLights + ')');
    const pts = s.wrLights.filter(l => l.type === 'PointLight');
    chk(pts.length === 1 && Math.abs(pts[0].intensity - 52) < 1e-6, 'whiteRoom still has its single PointLight at intensity 40 * 1.3 = 52 (count unchanged): ' + JSON.stringify(pts));
  } catch (e) { chk(false, 'exception ' + String(e && e.stack || e).slice(0, 500)); }
  const errs = errors.filter(e => !/supabase|ERR_FAILED|net::/i.test(e));
  chk(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await close();
  console.log(ok ? 'ALL PASS' : 'SOME FAILED'); process.exit(ok ? 0 : 1);
})();
