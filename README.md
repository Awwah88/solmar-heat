# Solmar Heat

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01)

Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC

**Solmar Heat** is a 3D open-world crime game in the fictional coastal city of Solmar Bay, built with Three.js (vendored) and plain static files — no build step, no network requests, playable offline in desktop Chrome.

## The story

Dana "Dash" Reyes owes the Marlin Club **$400**. One sunset, three jobs, and the whole bay is watching.

- **Mission 1 — Hot Wheels:** steal a car and take it to the Marina Garage. **+$150**
- **Mission 2 — Sunset Courier:** deliver three packages — the Pier, Hotel Solmar, the Old Lighthouse — before the 240-second clock runs out. Earns a pistol. **+$250**
- **Mission 3 — The Heat:** three stars and every cop in the bay is after you. Lose the heat, then vanish to the Safehouse. **+$400**

Finish all three and the win screen names you a **Solmar Legend** — $775 in total — then free roam unlocks.

## The world

- A 9×9-block city: roads, traffic, 24 pedestrians, a beach, the sea, palms, lamps, and six landmarks — Marina Garage, Hotel Solmar, Old Lighthouse, Spray Shop, Safehouse, and The Pier.
- **Wanted 0–5 stars:** stealing cars and hitting people raises the heat; police cars chase, ram, and will bust you on foot. The Spray Shop clears your record for $75.
- **Driving and on-foot play:** steal any parked car or the taxi, drive with arcade physics, or walk the sidewalks.
- **Combat:** fists from the start, pistol after Mission 2. Health regrows once you are safe.
- **Side work:** drive the taxi for $40 a fare; grab cash pickups ($25) and golden shells ($15) on the beach.
- **HUD:** money, health, wanted stars, mission objective with countdown, speed, and a live minimap with police, traffic, and markers.
- **Save:** autosaves to localStorage; CONTINUE on the start screen picks up where you left off.
- **Sound:** fully synthesized WebAudio — engine hum, sirens, a sunset-synth bass loop, and effects. No audio files. `M` mutes.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Drive / walk (Shift to run) |
| E | Get in / out of a car |
| Space | Handbrake |
| F | Punch, or shoot once you own the pistol |
| M | Mute |
| Esc | Pause |

## Play it

```bash
node serve.ts
# open http://localhost:8080
```

## Build

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library:

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are real renders of the game in a browser: a three-star chase, the city on foot, the courier run, and the title menu.

## Credits

All names, places, characters, art, story, and sounds are original. No assets from any commercial game. License: MIT.
