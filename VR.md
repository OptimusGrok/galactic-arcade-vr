# Galactic Arcade VR (separate edition)

A copy of Galactic Arcade (live main v234, 64401e1) playable in WebXR on a Meta Quest (Quest Browser). The live game is not changed.
Planned URL (not published): https://optimusgrok.github.io/galactic-arcade-vr/

## Controls (in VR)
- **ENTER VR** button at the top of the flat page (shown on the arcade floor when the browser has a headset).
- Head tracking at real-world scale (1 unit = 1 m, standing 'local-floor').
- **Left stick**: smooth walk where you look (2.2 m/s), using the same wall and cabinet collision. Physically walking is collided too.
- **Right stick left/right**: smooth turn.
- **Trigger**: point at a cabinet to play it, or point at the floor to teleport (cyan ring; red ring = blocked).
- **In a game** (shown on a big screen in front of you):
  - A/X/trigger on the attract screen: insert the ticket price, then press again to start.
  - Sticks: arrow keys. A/X: primary (Strike fire = Z; Ghost = Space; others Space + Z). B/Y: secondary (Strike bomb = X), or CONTINUE when the game offers it.
  - Trigger: fire on Strike, Ghost and similar games. Pointer games (Orc Attack, Claw, and the default for most others) get a tap on the screen where you point.
  - **Hold grip** (0.6 s): leave the machine.
- An in-world ticket display sits on the left controller.

## Files
- `vr.js`: all VR logic (session, rig as an offset reference space, input, rays, teleport, game screen, key/pointer mapping, HUD).
- `vr-frame-shim.js`: loaded first in every cabinet page. It lets the XR loop run the game's requestAnimationFrame callbacks.
  Re-run `python3 tools_vr_inject_shim.py` after rebuilding any `*-play` or `*-demo` copy.
- `main.js` hooks: renderer.xr, setAnimationLoop handoff, bloom/Reflector off in XR, no dpr changes in XR, Quest caps the tier at mid.
- Cache: `galactic-arcade_vr-v5`. The cleanup only touches `galactic-arcade_vr-*`.
  It isn't `galactic-arcade-vr-*` because the live game's cleanup deletes every cache starting with `galactic-arcade-v`.
- Tests (emulated Quest 3 via IWER, `test/vendor/iwer.min.js`): `test/vr.js`, `test/vr_all.js`, `test/sw_reload.js`.

## No zoom from the sticks (Dave, t346u)
On a Quest the browser turns a controller thumbstick into mouse-wheel events, which the flat arcade uses for camera zoom.
In this edition:
- In VR the left stick only walks and the right stick only snap-turns. Gamepad axes are read in vr.js and never reach setDist or zoom.
- Wheel zoom is ignored while in XR **and** on any Quest headset browser (flat mode too). Desktop mouse-wheel zoom is unchanged.
- Neon Bricks pinch zoom and hold-to-zoom are off while in XR; a held zoom is released.
- Test: `test/vr_zoom.js` checks that the sticks move and turn the player while the camera distance and saved zoom stay the same (VR and flat Quest), and that desktop wheel zoom still works.

## Pitch-black headset fix (Dave, t349u)
On a real Quest the room was pitch black after ENTER VR. Cause: before drawing each VR frame the arcade unbound the headset's framebuffer (`setRenderTarget(null)`), so the room was drawn onto the hidden page canvas and the headset got nothing. The emulator missed it because its headset framebuffer *is* the page canvas.
- Fix: draw straight into the XR framebuffer three binds for the frame. The space-window reflection and the floor warm-up never render into or with the XR camera.
- Safety net: a soft fill light (hemisphere) is on while in VR so the room is never fully dark.
- Test: `test/vr_dark.js` gives the emulated headset its own framebuffer like real hardware and reads the pixels the headset shows (at entry, four directions, after 3 s, after walking). It fails on the old build (0% lit) and passes on the fix.
- Cache bumped to `galactic-arcade_vr-v5` so headsets pick up the fix.

## Tickets, shop, teleporter, smooth turn, Neon Bricks (Dave, t350u / t351u)
- **Smooth turn:** the right stick turns smoothly. The further you push, the faster: nothing inside 0.15, then a x² curve up to 90°/s at full push. No snapping.
- **Buying tickets:** point at the ticket kiosk (or its BUY TICKETS sign) and pull the trigger. A TICKET EXCHANGE panel offers $1 = 10, $5 = 60 and $10 = 150 tickets. Press an offer with the ray, wait for it to dispense, then press COLLECT. It uses the same kiosk cash and purchase code as the flat game.
- **Teleporter:** a BEAM TO SHOP sign floats over the arcade pad and BEAM TO ARCADE over the shop pad. Point and pull the trigger to beam; the headset view travels with you.
- **Prize shop:** point at the PRIZE SHOP sign over Grok (or Grok himself) and pull the trigger. The panel lists the prizes four per page with < and > buttons; press one to buy it with the shop's own buy function.
- **Menu:** Y or B opens it, with BEAM TO SHOP / ARCADE, BUY TICKETS, PLAY NEON BRICKS and PRIZE SHOP (in the shop).
- **Neon Bricks:** point at the window game (or its sign) and pull the trigger. Either stick moves the brick (down = soft drop), A/X/trigger rotates, B/Y hard-drops, and holding grip leaves. No zoom in VR.
- **Signs:** they only show in VR, always face you, and grow with distance so they stay readable (ray range for signs is 30 m).
- **Tests:** `test/vr_ui.js` (turn rates, ticket buying, beam to the shop and back, a prize purchase, Neon Bricks).
- Cache: `galactic-arcade_vr-v5`.

## Accessories, mirror, Berserker power-ups, laser (Dave, t353u)
- **Accessories:** point at the ACCESSORIES sign over the shop mirror (or use MENU > ACCESSORIES). The panel has tabs (HAT, GLASSES, BACK, HAND, HOODIE, SUIT, FUR, SHOES) and six items per page. Press an item to wear it, or to buy and wear it if you don't own it yet (same price and ticket rules as the flat wardrobe, using player.js's own pick / tryOn / buy). REMOVE takes the item off where the category has a "none" option.
- **Mirror:** it was black because the shop's mirror only renders for the main camera, and in VR three passes it the per-eye XR cameras, so it never rendered. vr.js now triggers it once per frame with the main camera (the Reflector turns XR off for its own pass and restores the render target). Your avatar faces where you look, so you see yourself in it.
- **Berserker:** right A or trigger attacks, right B dashes. Power-ups appear as yellow buttons to the right of the game screen when they're ready, each labelled with its button: **X = THOR**, **Y = BERSERK**, **short right-grip tap = ODIN** (holding grip still leaves the game). You can also point at a power-up button and pull the trigger.
- **Laser:** every ray stops at the first VR button, panel, sign or screen it reaches (exact rectangle test), and hovered signs and power-up buttons light up.
- **Tests:** `test/vr_v4.js`. Against the old build the mirror check fails (0 renders, 0.5% lit).
- Cache: `galactic-arcade_vr-v5`.

## t354u: Monkey backpack in the menu, Sky Tower controls (cache v5)
- **MONKEY BACKPACK** (Y/B menu, with a little monkey-backpack icon) opens a panel listing everything you own: Grok Shop prizes
  (`neonarcade.prizes`) and claw-machine plushes (`arcade_clawMachine.collection`). Point + trigger on an item to hold it, using
  shop.js's own two-hand API (`__shop.hold(id, 'R'|'L')`): small items go to the right hand, then the left. Big plushes are a two-arm hug.
  Tap a held item again to put it away. PUT R AWAY, PUT L AWAY and PUT BOTH AWAY work as labelled. Each button shows which hand holds it. The shop code
  loads on demand (`__arcade.loadShop()`) if you haven't been to the shop yet.
- **Sky Tower**: the left stick moves (arrow keys). The right stick pans the camera through the game's own `lookDrag` (full push = 2 rad/s, up = look up).
  X/A held = jetpack (Space). Y/B (or the trigger) = laser (F: hold charges, release shoots). Inside a cabinet Y/B always go to the game.
  The menu only opens while walking. Berserker's mapping is unchanged.
- Test: `test/vr_v5.js` (26 checks).

## t355u: Money + tickets in the menu, jetpack and laser pistol in the arcade world (same v5)
- The Y/B menu's subtitle shows your kiosk cash and tickets ("$5 CASH · 42 TICKETS") and updates live while it's open.
- Walking around (not in a cabinet or Neon Bricks): with the **JETPACK** (Accessories, back) on, **hold A** to fly. This uses main.js's own fly
  code (`st.fly.hold`, the same as the flat FLY button), so energy, the ceilings and descending all work as in the flat game, and the headset rises with you.
  With the **LASER PISTOL** (Accessories, hand) on, **B shoots**. This uses roomfire.js's `setHeld` (same as the flat FIRE button: tap = bolt, hold = charge,
  4 s = beam). While the pistol is on, the menu opens with **Y only**. Without it, Y or B opens the menu as before.
- Tests: in `test/vr_v5.js` (40 checks in total).

## t356u: Sharper mirror in VR (same v5)
- The shop mirror's Reflector target is a fixed 512x420 in shop.js. That's only 420 px for 1.9 m of glass, and the wrong aspect, so it looked blurred in a headset.
  In VR, vr.js resizes it to 1536 px on the long side (1024 on the low tier), matching the glass aspect (1002x1536). It uses linear filtering and no mipmaps.
  It goes back to 512x420 when you leave VR. shop.js still skips the pass unless the mirror is in view and facing you, and the VR redraw
  only runs within 5 m. Check: `test/vr_v4.js` "the mirror render target goes up in VR".

## t358u: Live mirror, jetpack energy bar, Berserker buttons, smoother arcade (cache v6)
- **Mirror**: in VR, vr.js swaps the shop mirror for its own Reflector twin with the same size and place (1536 px on the long side, 1024 on the low tier).
  It draws as soon as you beam in: every frame within 8 m or whenever you're reflected in it, every 2nd frame out to 25 m when it's in view and facing you.
  The shop's own mirror is hidden with a layer (shop.js keeps setting `.visible`) and comes back when you leave VR. `__gaVR.mirrorStats()`.
- **Jetpack energy bar**: the left-controller display shows an ENERGY bar from the game's real fuel (`st.fly.e`) while the jetpack is on (red when low).
- **Berserker**: TRIGGER = attack, **A = DASH** (always shown), **B = THOR**, **X = BERSERK**, **Y = ODIN**. Power-ups only fire when ready.
  The grip-tap Odin was removed. Holding grip still exits.
- **Performance**:
  - Low tier uses framebuffer scale 0.85, and foveation is 1.
  - At XR start, every program is compiled and linked for the XR target and the mirror target, and textures are uploaded.
  - A new set of lit lights (the shop, back in the arcade) is compiled in one go the first frame it shows, instead of shader by shader.
  - The Dead Signal station spotlight blinked on and off as its group was culled, which recompiled the cabinets' shaders while you turned. In VR it now
    sits on an always-on holder and drops to intensity 0 when it should be off.
  - Fewer per-frame allocations.
  - Profile: `test/vr_perf.js` (GA_ROOT=<old checkout> profiles an older build).

## t359u: Laser from the right controller (same v6)
- The pistol shoots along the right controller's pointer in full 3D. Hand down shoots down, and the bolt starts at the controller.
- Hold B to charge: the glow sits on the controller (blue for the monkey, red for the alien, from roomfire.js `playerCols()`), and grows over the
  game's 4 s charge. A full charge fires the beam for 3 s. Releasing earlier fires the game's own bolt (`__roomFire.fire`), re-aimed along the controller.

## t360u: Hands in the mirror, chat with Grok (same v6)
- The avatar's arms follow the controllers (shoulder aimed at the grip, elbow bends with reach), with a small controller model in each hand, so the
  mirror shows them.
- A **CHAT WITH GROK** sign over the clerk in the shop (and over the visiting Grok in the arcade) opens a VR chat panel. It has the original's questions
  (8 per page, PREV/NEXT) and shows your question and Grok's reply. It uses grokchat.js's `openChat` / `ask` / `close`.

## t361u: Alien laser from its machine, headset battery (same v6)
- As the alien, the bolt, beam and charge glow come from its floating machine. The aim still follows the right controller.
- The left-controller display shows the headset battery % from `navigator.getBattery()` and updates live, with a lightning bolt while charging and red at 20% or less.
  If the browser has no Battery API, the readout is hidden.
- Tests: `test/vr_v6.js` (battery uses a mocked `getBattery`).
