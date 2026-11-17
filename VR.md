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
- Cache: `galactic-arcade_vr-v11`. The cleanup only touches `galactic-arcade_vr-*`.
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

## t362u: Two (or more) people in the VR arcade (cache v7)
- How to join: everyone opens the same link (https://optimusgrok.github.io/galactic-arcade-vr/) and is automatically in the one public room
  (mp.js, Supabase Realtime channel `galactic-arcade-public`, up to 10 players). That's the same room as the flat game, so headset players, phone and PC players all see each other.
  Nothing needs pairing or a code. Press ENTER VR whenever you like; you stay in the room.
- In a headset, each state packet (10 Hz, only when something changed) also carries `v`: head + left/right controller poses relative to the
  body (cm positions, quaternions, ~150 bytes). Flat and older clients ignore it.
- Everyone else sees a VR player with a visor on the avatar, the body facing where they look, the head nodding, and both arms reaching for their
  controllers (the same solver as the mirror), with a small controller in each hand. Poses ease toward each packet so 10 Hz looks smooth.
- Their laser shots fly along their controller's aim (the multiplayer zap carries the VR aim). The charge ball shows at their controller (or the
  alien's machine), and their 3 s beam shows too. The remote beam is drawn level, as roomfire.js always draws other players' beams.
  Jetpack flight (height, flying pose, thrusters) and held items (pistol, hats, backpack) come through as before.
- mp.js changes (additive): `M.vrSnap` adds `v` to the snapshot; `p.v` / `p.vAt` are kept from received states. `M.posePeer` runs per peer after the pose,
  and `M.step` lets vr.js move remote players from the XR frame loop (the page's own animation loop pauses during an immersive session).
- Test: `test/vr_mp.js`: two emulated headsets and a flat player in one mocked room.

## t364u: Mirror shows only the avatar (same v7)
- On a real Quest the mirror showed two big arms and big pink rings: your own first-person controller models (with their magenta rings), rays,
  cursor, left-hand display, menu and charge glow were drawn in the mirror pass right in front of its camera. They're now hidden for the mirror pass only
  (you still see them in your view), so the mirror shows the avatar with its small hand controllers. The avatar's hand controllers re-check their size
  every frame, so they stay about 12 cm whatever the avatar's scale. The arms only rotate and are never stretched.
- Test: `test/vr_v6.js` counts what the mirror pass draws: the avatar's hand controllers yes, first-person meshes none.

## t365u: Quest sticks on the screen, cobblestone + medieval for everyone, free floor/walls picker (cache v8)
- Meta Quest Browser, flat (on the screen, not in VR): the left thumbstick walks and the right thumbstick turns the camera. `quest-pad.js` is ported unchanged
  from the original Galactic Arcade (v242). The Quest's 2D browser sends sticks as wheel/scroll/zoom input (plain wheel = move; ctrl/zoom-wheel, pinch/zoom gesture
  or the STICK LOOK toggle = look), or as real gamepads when it exposes the Touch controllers (left = move, right = look). vr.js applies it like the original's
  `applyQuestPad`: move -> the on-screen stick (`st.joy`, same gentle-to-sprint speed curve), look -> camera yaw/pitch. Not on the start screen or inside a cabinet,
  and nothing at all during an XR session (vr.js drives the sticks there). The v1 Quest wheel block still stops wheel-zoom; it never stopped propagation, so quest-pad
  still sees the wheel. `?qdbg=1` shows quest-pad's live input overlay.
- Every load starts on COBBLESTONE floor + MEDIEVAL walls, overriding what an earlier visit saved, and the 30 s random floor/walls shuffle is off (the
  shuffle was the likely reason two headsets on the same link showed different floors). Head script in index.html.
- Floor + walls are free: in-game OPTIONS (opts.js skips the ticket when `window.__gaRoomFree`; note reads FREE · TAP TO CHANGE), the start-screen options (already free) and
  the headset Y/B menu (new FLOOR + WALLS button: FLOOR / WALLS tabs, applies at once). A choice lasts until the next load.

## t366u/t367u: New pictures above the cabinets, claw icon black-panel fix (same v8)
- vr.js used to replace the wall pictures with painted `tex/icons/<key>.webp` art in a 2048 px atlas (1024 on the low tier), a bit brighter than the dim neon.
  The neon game titles were unchanged, and the claw kept its two-sided open/close mesh with a one-time 2048x256 upload so Quest did not get a black panel.
- Removed in v10 (t866u): the wall pictures are the shared 2D canvas icons again. The claw upload fix is kept.

## t368u: Right stick only turns the camera on the Quest screen (cache v9)
- Dave's real Quest: both thumbsticks walked. In the Quest's 2D browser both sticks are the same plain wheel scroll (no gamepads in 2D), so quest-pad.js
  (VR repo copy, now "VR v9") classifies every stick event: STICK LOOK toggle -> look; ctrl/meta/alt -> look; saved STICK SETUP calibration; two-ray rule
  (each controller's ray sends its own pointer events; a scroll landing on the ray further RIGHT on screen is the right stick) -> look; else walk.
  Looked-at events feed only the camera (yaw/pitch), never `st.joy`. Gamepads with handedness are still used if the browser ever exposes them.
- STICK SETUP button (above STICK WALK, bottom right, not on the start screen): hold the left stick, let go, hold the right stick. Whatever differs (ray, screen side,
  channel, deltaMode, step size) becomes the rule, saved on the device (`localStorage gaQuest.stickCal`). Nothing moves while it listens.
- `?qdbg=1` now shows every ray seen (id, type, x,y, age), the setup rules, and the last 8 stick events: raw dx/dy/dz, deltaMode, modifiers, x,y,
  the matched ray, and MOVE/LOOK with the reason (toggle / mod / cal:... / 2ray / default). Gamepads list id, hand and axes.
- Test: `test/quest_flat.js` (two rays: right-ray scroll pans and does not move; left-ray scroll walks; calibration by deltaMode; overlay text).
## t866u: Wall pictures match the 2D arcade (cache v10)
- The t366u/t367u painted `tex/icons/<key>.webp` swap in vr.js is removed. The pictures above the cabinets are once again the shared
  `neonsigns.js` / `neon_atlas.js` canvas icons (detailed Viking with an axe, blue Strike ship, orc, and the rest), at the same size,
  placement and dim glow (colour ×0.55) as the non-VR game. Performance tiers are unchanged (icon atlas 128 px / 512 cap on low, 256 otherwise).
- The free-standing claw's two-sided open/close mesh and its one-time 2048×256 upload fix are kept, so Quest does not get a black panel.
- Test: `test/vr_icons.js` (shared atlas, no `tex/icons` webp, dim glow, claw upload-once, also in an XR session). `test/quest_flat.js`
  is unchanged (Arcade's right-stick work).

## t869u: Painted cabinet pictures restored (cache v11)
- Dave asked for Arcade's painted `tex/icons/<key>.webp` pictures back in VR, and also in the non-VR game. The v10 removal of the
  vr.js swap is reversed: wall pictures are again redrawn into a 2048 px atlas (1024 on the low tier) from those webps, fitted to
  each quad, a bit brighter than the dim neon. Canvas icons stay as the fallback until a picture loads. The claw keeps its two-sided
  open/close mesh and one-time 2048×256 upload. The 13 webps are precached in `sw.js` again.
- Test: `test/vr_icons.js` (painted atlas, 13 webps, brightness, claw upload-once, also in an XR session).

## v12 (t374u/t376u/t377u/t382u/t383u/t388u): Chess table, claw text, Quest sticks from real headset data, GRIP = back (cache v12)
- **Chess table** (`chesstable.js`, `chess-play/` built by `tools_build_chess_play.py` from the chess app, unchanged pieces / battles / robot arm):
  shop-local (6.6, 7.6), between the ACCESSORIES wardrobe and the pool tables, solid (OBST box). Flat: PLAY CHESS -> you sit, Grok walks
  from the counter (out through the counter gap, round to the table, 1.45 m/s walk cycle), turns, slides into the chair opposite and sits;
  the camera eases in over your shoulder, then the chess page opens (✕ / Esc / grip stands you up, Grok walks back). VR: ray + trigger on the
  table or the CHESS · PLAY sign; the rig turns once to face the board and rides the sit tween; A skips Grok's walk; the page is painted by its
  own `window.__chessVR` painter onto a 1.36 m panel over the table; ray + trigger press / drag / release go into the page; GRIP = stand up.
  Tickets (arcade copy only): a win vs the Computer pays Easy 5 / Medium 10 / Hard 20 (lowest level used in the game), once per game, none
  if Undo was used; paid only through `window.__chessWin` from the open frame. Free to play.
- **Claw text**: the marquee "CLAW MACHINE" and the "1 TICKET" plate use `fitText` (shrinks the font until glyphs + glow fit with a
  margin, undistorted on the plate). The VR tier's smaller canvas (768x165) used to keep the 120 px font -> cut off. The floating neon
  "CLAW MACHINE" name is <= 1.9 m wide and on its own mesh (renderOrder 4) so the wall pictures no longer paint over it.
- **Quest flat sticks** (Dave's ?qdbg photos): one live ray at a time (new touch pointerId per press), both sticks = the same plain wheel
  (m0, ~20 px steps, ~82 events/s) at that ray. v9 compared it with a ray gone quiet for seconds -> MOVE/LOOK flipped. Now: two rays count only
  if both are busy (>= 3 events in 400 ms); then each ray is LOCKED to a hand. With one ray the wheel always walks (dy walk, dx strafe) and
  never turns; a pressed-ray drag that comes with stick wheels (the Quest does that on a sideways push) is ignored. TURN: trigger-drag on the
  3D view, the STICK WALK/LOOK toggle, or STICK SETUP. ?qdbg=1 shows MODE, the hand locks, drag-turns and ignored stick drags.
- **GRIP = back**: VR short press closes any panel (menu, shop, accessories, tickets, chat, pack) and stands you up from chess; cabinet games
  and Neon Bricks keep the 0.6 s hold (no accidental exits mid-game). Flat Quest: every grip candidate (gamepad grip, non-primary pointer
  button / contextmenu, BrowserBack key) sends the game's Escape; counted in ?qdbg=1. **B fires**: in VR B/Y = laser/fire; in the flat
  Quest browser B/Y is the browser's back, caught by a one-entry history trap and turned into FIRE (a Space tap), shown in ?qdbg=1.
- **Y menu (t388u)**: title MENU, subtitle "$cash CASH · N TICKETS". Left: the BACKPACK tile (the real monkey backpack art from the flat
  #bPack button); opens the backpack with PRIZES / ACCESSORIES tabs, both picture tiles (emoji pictures + names; tap = equip / wear / buy
  like before; PUT R/L/BOTH AWAY, REMOVE, < >). Right: the FLOOR + WALLS square showing a different floor picture every 5 s; opens the free
  floor + walls picker. Bottom: PLAY NEON BRICKS (arcade) or PRIZE SHOP (shop). Only the X (or GRIP) closes. BEAM TO SHOP is on the
  teleporter pad signs, BUY TICKETS at the ticket machine (sign + ray), Grok chat by pointing at Grok. Test: test/vr_menu.js.

## v13 (t391u-t395u): Quest 2D sticks never turn the camera, turn buttons, real arm IK in the mirror, laser from the gun muzzle (cache v13)
- **What turned the camera in v12** (Dave: "still swapping and both sticks move the camera"): (1) a STICK SETUP saved in localStorage by
  v9-v12 kept classifying wheels by step size / source, so a stick flipped to LOOK with how far it was pushed; (2) the hand locks /
  2-ray rule could still mark a ray LOOK; (3) the zoom channel (visualViewport scale / ctrl+wheel) was LOOK; (4) main.js drag-turned from
  the touch / mouse drags the Quest fakes from the ray; (5) the showcase camera swing near featured cabinets turned the view while walking.
- **v13 rule (default)**: every stick signal WALKS (dy forward/back, dx strafe); nothing a stick sends can turn. TURN = hold the on-screen
  ◀ ▶ buttons (beside the walk stick), or hold the TRIGGER on the 3D view and drag (only after 150 ms + 10 px with no stick wheel; a stick
  wheel cancels that press). main.js never drag-turns on a Quest; no showcase swing on a Quest. Handed gamepads (if the browser ever
  exposes them) = the real split: left stick walks, right stick turns, by the pad's own handedness, and their wheel is ignored.
- The Quest 2D browser exposes no gamepads outside WebXR (Meta: the system shell, not the browser, owns the controllers), one ray is live at
  a time and both sticks arrive as the same plain wheel, so there is no reliable left/right signal. The old classifier, STICK SETUP and
  STICK LOOK only run with ?qsplit=1; a saved STICK SETUP is wiped on a version change.
- ?qdbg=1: version (quest-pad, page, SW cache + controller), the stick rule, every camera yaw change by cause (turn buttons, trigger-drag,
  gamepad, showcase, neon-bricks, other) and the stick looks / drags ignored. Test: test/quest_v13.js (replays Dave's 3 photos: 0 yaw).
- **Mirror arms**: two-bone IK from the avatar's shoulder (real bone lengths, elbow down/out/back): the small hands sit on the controllers
  as far as the arm reaches (no stretching) and turn with them; the avatar's little controllers have no pink ring; your own controllers,
  rings, rays and HUD stay hidden in the mirror. **Laser**: with the pistol the gun replaces the little controller in the right hand, its
  barrel follows the controller ray and bolts / the beam leave the muzzle. Test: test/vr_mirror_ik.js.

## v14 — voice chat (t396u)

- **voice.js** (new): WebRTC peer audio between players in the shared room. Signalling (`hi` / `offer` / `answer` / `ice` / `bye`) rides the
  existing Supabase Realtime channel as `rtc` broadcasts (mp.js `M.rtcSend` / `M.onRtc`). Full mesh (room cap 10); the lower player id
  makes the offer, so there is no glare. ICE: public Google STUN only, no TURN.
- **Mic only on a tap.** Flat: the **🎤 MIC** button above CHAT (tap again = mute 🔇 / unmute, **✕ VC** = leave voice). VR: Y menu, bottom row:
  **MIC ON** → **MUTE MIC** / **UNMUTE MIC**, and **✕ VC**. A denied or missing mic leaves you **listening only** (🎧 / MIC BLOCKED) with a
  message; tapping again retries. With no one else in voice you get a "no one else here yet" note and links form when others join.
- **Positional:** each voice goes through a Web Audio HRTF panner placed at that player's head (updated 20×/s); the listener follows your
  camera (headset in VR).
- **Speaking indicator:** a green speaker sprite floats over a talking avatar's head (yours too, in the mirror / third person); the flat
  🎤 button glows while you talk.
- **Limits:** no TURN, so two players behind strict / symmetric NAT (some mobile carriers, corporate Wi-Fi) may not connect ("voice link
  failed" message, two retries). Mesh audio = one upload per listener. Quest browser shows its own mic prompt the first time; doing it from the
  flat screen first is the smoothest.
- **Tests:** `test/voice.js` (three browsers, fake mic). The box's managed Chrome policy blocks non-proxied UDP, so real WebRTC is tested up to
  offer/answer (two-way Opus negotiated); the media path (levels, indicator, mute, panner, listen-only) uses `test/fakertc.js`'s stand-in.

## v15 (t397u): the gun in your own hand, first person (cache v15)

- **First person:** with the laser pistol out (monkey), your own view now shows the monkey's right hand holding the gun on the right
  controller: exactly the mirror's hand + gun (same world transform). The right controller model and its cone ray are hidden while the
  gun is out; a thin aim ray leaves the **muzzle**, and all of that hand's pointing (Y menu, signs, screens, teleport) starts there.
  The left controller is unchanged. Putting the gun away (or exiting VR) brings the controller and its normal ray back.
- **Natural size:** in VR the held gun is a real-size blaster (~30 cm, `GUN_S` 0.42 of the model) with its grip in the hand on the
  controller; the muzzle is ~27 cm ahead of the controller grip (was ~69 cm at the avatar's scale). Same for the mirror and for other
  VR players' avatars (aligned with their grip). Bolts, the charge glow and the full-charge beam leave the muzzle along the aim.
- **Flat screen:** unchanged (third-person monkey holds the gun as before); exiting VR restores the gun's flat pose exactly.
- **Test:** `test/vr_fpgun.js`.
