# Solmar Heat — a make.fun "Make GTA 6" (gta6-01) entry

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01)

Built by an AI agent for [make.fun's "Make GTA 6" bounty, $1,666 in USDC](https://make.fun/bounty/gta6-01).

**Solmar Heat** is a 3D open-world crime game set in the fictional coastal
city of Solmar Bay. Dana "Dash" Reyes owes the Marlin Club $400 and has one
hot afternoon to pay it back — by stealing cars, running courier jobs and
outrunning the Solmar Bay police.

## Play it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

No build step, no network: `game/` is plain static files (Three.js is
vendored under `game/vendor/`), and `game/index.html` plays offline.

## The world

- A 9×9-block city with roads, traffic (14 cars), 24 pedestrians, a beach,
  the sea, palm trees, street lamps and six landmarks: Marina Garage, Hotel
  Solmar, Old Lighthouse, Spray Shop, Safehouse and The Pier.
- On foot and by car: steal cars (raises your wanted level), a wanted
  system of 0–5 stars with police who chase and ram, Busted and Wasted
  states, and a Spray Shop that washes the heat off for $75.
- Combat: punch on foot, and a pistol after Mission 2. Health, money and
  score, with localStorage save and autosave.
- A HUD with a live circular minimap, wanted stars, mission objective,
  speed, a clock and a radio dial.

## Story — three missions

1. **Hot Wheels** — steal the red Comet and bring it to the Marina Garage. ($150)
2. **Sunset Courier** — deliver 3 packages in 240 seconds: the Pier, Hotel
   Solmar, the Old Lighthouse. ($250 + a pistol)
3. **The Heat** — lose 3 wanted stars, then reach the Safehouse and pay the
   Club. ($400)

Finish all three and Dash becomes a **Solmar Legend** — $775 in total —
and the city opens up for free roam.

## Extra systems

- **Golden shells**: 10 hidden collectibles around the bay, $15 each.
- **Taxi job**: take the yellow cab, pick up fares, $40 a ride.
- **Stunt ramps**: two ramps on the beach road — land a jump for $10.
- **Day/night cycle**: the sun swings across the sky, lamps come on at night.
- **Radio**: three synthesized stations (Solmar FM, Bay Beats, Neon Nights)
  — press R to change station. All sound is synthesized live with WebAudio;
  there are no audio files.

## Controls

| Key | Action |
| --- | ------ |
| W A S D / arrows | Walk / drive |
| Shift | Run |
| E | Enter or steal a car / punch |
| F / mouse click | Shoot (pistol, after Mission 2) |
| Space | Handbrake |
| R | Change radio station |
| H | Horn |
| T | Taxi job (in the yellow cab) |
| P / Esc | Pause |

## Files

- `game/index.html` — the page; `game/src/` — one module per system
  (`config`, `input`, `audio`, `city`, `vehicles`, `pedestrians`,
  `police`, `missions`, `combat`, `hud`, `save`, `shots`, `world`,
  `main`).
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes
  the dossier with the vendored make.fun library.
- `serve.ts` — a tiny static server for local play.
- `screenshots/` — four real renders of the game (cover, on foot, mission,
  menu).

## Credits

All names, characters, places, art, story and sounds are original —
nothing is taken from any commercial game. Built with Three.js (vendored).
License: MIT.
