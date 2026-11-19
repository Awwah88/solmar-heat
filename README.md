[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Heat

A 3D open-world crime game in the fictional coastal city of Solmar Bay,
built with Three.js (vendored) and plain static files — no build step, no
network requests, playable offline in desktop Chrome.

## Story

Dana "Dash" Reyes owes the Marlin Club **$400**. Four jobs stand between
her and freedom:

1. **Hot Wheels** ($150) — steal the red sedan parked at Marina Garage.
2. **Sunset Courier** ($250 + pistol) — deliver three packages in 240 seconds.
3. **The Heat** ($400) — lose a three-star manhunt, then slip to the Safehouse.
4. **Marlin's Debt** ($300 + $25) — steal the gold Marlin GT from Hotel
   Solmar, drop it at the Old Lighthouse with fewer than 4 stars, then
   vanish to the Safehouse.

Finish all four and the debt is paid: **Solmar Legend**.

## World

- 9x9-block city with roads, 14 traffic cars, 24 pedestrians, a beach and
  the sea to the east, palms, lamps and six landmarks: Marina Garage,
  Hotel Solmar, Old Lighthouse, Spray Shop, Safehouse and The Pier.
- Wanted level 0–5 with police cruisers that chase and ram; Busted and
  Wasted states with fines; the Spray Shop clears your wanted level for $75.
- Combat on foot: punch (F) and a pistol (unlocked after Mission 2, click
  to shoot). Taxi side job, cash pickups, health, money, autosave and a
  live minimap.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk / drive (A turns left, D turns right) |
| Shift | Sprint on foot |
| Space | Handbrake |
| E | Enter / steal a car, exit a car, Spray Shop |
| F | Punch |
| Click | Shoot (pistol, after Mission 2) |
| Mouse drag | Orbit camera, wheel zooms |
| Esc | Pause |

## Run it

```sh
node serve.ts            # serves game/ at http://localhost:8080
```

Open the page, press **New Game**, and drive. Your progress autosaves to
the browser (Continue on the title screen).

## Shots

`?shot=cover`, `?shot=foot`, `?shot=mission` and `?shot=menu` stage
real moments of the running game for screenshots.

## License

MIT — see LICENSE.
