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
- Cache: `galactic-arcade_vr-v3`. The cleanup only touches `galactic-arcade_vr-*`.
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
- Cache bumped to `galactic-arcade_vr-v3` so headsets pick up the fix.

## Tickets, shop, teleporter, smooth turn, Neon Bricks (Dave, t350u / t351u)
- **Smooth turn:** the right stick turns smoothly. The further you push, the faster: nothing inside 0.15, then a x² curve up to 90°/s at full push. No snapping.
- **Buying tickets:** point at the ticket kiosk (or its BUY TICKETS sign) and pull the trigger. A TICKET EXCHANGE panel offers $1 = 10, $5 = 60 and $10 = 150 tickets. Press an offer with the ray, wait for it to dispense, then press COLLECT. It uses the same kiosk cash and purchase code as the flat game.
- **Teleporter:** a BEAM TO SHOP sign floats over the arcade pad and BEAM TO ARCADE over the shop pad. Point and pull the trigger to beam; the headset view travels with you.
- **Prize shop:** point at the PRIZE SHOP sign over Grok (or Grok himself) and pull the trigger. The panel lists the prizes four per page with < and > buttons; press one to buy it with the shop's own buy function.
- **Menu:** Y or B opens it, with BEAM TO SHOP / ARCADE, BUY TICKETS, PLAY NEON BRICKS and PRIZE SHOP (in the shop).
- **Neon Bricks:** point at the window game (or its sign) and pull the trigger. Either stick moves the brick (down = soft drop), A/X/trigger rotates, B/Y hard-drops, and holding grip leaves. No zoom in VR.
- **Signs:** they only show in VR, always face you, and grow with distance so they stay readable (ray range for signs is 30 m).
- **Tests:** `test/vr_ui.js` (turn rates, ticket buying, beam to the shop and back, a prize purchase, Neon Bricks).
- Cache: `galactic-arcade_vr-v3`.
