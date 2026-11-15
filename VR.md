# Galactic Arcade VR (separate edition)

A copy of Galactic Arcade (live main v234, 64401e1) playable in WebXR on a Meta Quest (Quest Browser). The live game is not changed.
Planned URL (not published): https://optimusgrok.github.io/galactic-arcade-vr/

## Controls (in VR)
- **ENTER VR** button at the top of the flat page (shown on the arcade floor when the browser has a headset).
- Head tracking at real-world scale (1 unit = 1 m, standing 'local-floor').
- **Left stick**: smooth walk where you look (2.2 m/s), using the same wall and cabinet collision. Physically walking is collided too.
- **Right stick left/right**: 30° snap turn.
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
- Cache: `galactic-arcade_vr-v1`. The cleanup only touches `galactic-arcade_vr-*`.
  It isn't `galactic-arcade-vr-*` because the live game's cleanup deletes every cache starting with `galactic-arcade-v`.
- Tests (emulated Quest 3 via IWER, `test/vendor/iwer.min.js`): `test/vr.js`, `test/vr_all.js`, `test/sw_reload.js`.

## No zoom from the sticks (Dave, t346u)
On a Quest the browser turns a controller thumbstick into mouse-wheel events, which the flat arcade uses for camera zoom.
In this edition:
- In VR the left stick only walks and the right stick only snap-turns. Gamepad axes are read in vr.js and never reach setDist or zoom.
- Wheel zoom is ignored while in XR **and** on any Quest headset browser (flat mode too). Desktop mouse-wheel zoom is unchanged.
- Neon Bricks pinch zoom and hold-to-zoom are off while in XR; a held zoom is released.
- Test: `test/vr_zoom.js` checks that the sticks move and turn the player while the camera distance and saved zoom stay the same (VR and flat Quest), and that desktop wheel zoom still works.
