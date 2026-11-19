[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Heat

A 3D open-world crime game in the fictional coastal city of **Solmar Bay**, built with Three.js for the make.fun "Make GTA 6" bounty. Drive, steal, run, and fight your way out of debt under a burning sunset.

## Story

Dana "Dash" Reyes owes the **Marlin Club $400**. Four jobs stand between Dash and freedom — and the Solmar PD stands between Dash and all of it.

## Missions

| # | Mission | Reward | What to do |
|---|---------|--------|------------|
| 1 | Hot Wheels | $150 | Steal the red sedan parked by the Marina Garage |
| 2 | Sunset Courier | $250 + pistol | Deliver 3 packages around the bay in 240 seconds |
| 3 | The Heat | $400 | Lose 3 stars of heat, then reach the Safehouse |
| 4 | Marlin's Debt | $300 | Steal the gold Marlin GT at Hotel Solmar, drop it at the Old Lighthouse under 4 stars, then escape to the Safehouse |

Finish all four and the debt is paid: **Solmar Legend**.

## World & systems

- **9×9-block open city** — roads, traffic (14 cars), 24 pedestrians, beach and sea, palms, lamps, and 6 landmarks: Marina Garage, Hotel Solmar, Old Lighthouse, Spray Shop, Safehouse, The Pier.
- **On foot + driving** — steal any car (raises your wanted level), with acceleration, braking and handbrake physics.
- **Wanted 0–5 stars** — police cruisers chase and ram; get Busted on foot or Wasted at zero health, pay a $75 fine, wake up at the Marina.
- **Spray Shop** — drive in with $75 and your wanted level is cleared.
- **Combat** — punch up close, pistol after Mission 2 (click to shoot).
- **Taxi side job** — pick up passengers at the yellow signs, earn $50 a fare.
- **Cash & health pickups** scattered around the city, localStorage save/autosave, HUD with live minimap, start/pause/win screens, synthesized WebAudio engine, sirens and music (no audio files).

## Controls

| Key | Action |
|-----|--------|
| W / A / S / D | Drive or walk (A left, D right) |
| E | Enter / exit car |
| F | Punch |
| Mouse click | Shoot (pistol, after Mission 2) |
| T | Taxi fare near a yellow sign |
| Space | Brake / handbrake |
| Shift | Run on foot |
| Esc / P | Pause |
| M | Mute |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — the game serves `game/` and plays offline in desktop Chrome, no network needed.

## Shots

Real renders of the running game (see `shots.json`):

- `?shot=cover` — police chase down a palm-lined road
- `?shot=foot` — on foot at a downtown intersection
- `?shot=mission` — courier run to the next drop
- `?shot=menu` — title screen over the orbiting city

## License

MIT — see `LICENSE`.
