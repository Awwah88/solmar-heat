[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Heat

A 3D open-world crime game in the fictional coastal city of **Solmar Bay**, built with Three.js. You are Dana "Dash" Reyes. You owe the Marlin Club **$400** — and six jobs stand between you and freedom, ending with a bank vault, an armored van and a 5-star chase to the Airport runway at dusk.

## Story

Solmar Bay never sleeps: neon over the Casino, the lighthouse sweeping the west cliff, the Bank's gold sign glowing at dusk. Dash came home owing the Marlin Club $400. The Club doesn't send reminders — it sends jobs. Hot-wire a sedan. Run packages at sunset. Lose a 3-star heat. Steal a gold GT, then a black limo, then crack the Solmar Bank vault in an armored van and outrun every cop in the city to the runway. Pay the debt. Become a **Solmar Legend**.

## Missions

| # | Mission | Reward | What happens |
|---|---------|--------|--------------|
| M1 | Hot Wheels | $150 | Steal the red sedan at the Marina Garage. |
| M2 | Sunset Courier | $250 + pistol | Deliver 3 packages in 240 seconds. |
| M3 | The Heat | $400 | Lose a 3-star wanted level, then reach the Safehouse. |
| M4 | Marlin's Debt | $325 | Steal the gold Marlin GT at the Hotel, drop it at the Old Lighthouse, escape to the Safehouse. |
| M5 | The Marlin's Last Hand | $500 | Steal the black limo at the Casino, outrun a 4-star chase to the Boardwalk, deliver it to the Pier in 120 seconds. |
| M6 | The Solmar Bank Job | $750 | Steal the armored van at the Bank, crack the vault (hold the van at the dock for 8 seconds), escape a 5-star chase to the Airport runway. |

Finish all six and the debt is paid — the **SOLMAR LEGEND** win screen.

## Side activities

- **Taxi fares** — pick up passengers (green marker), drive them to their destination: $40 per fare plus a growing streak tip. A timed-out fare resets the streak.
- **Solmar doubloons** — 12 hidden gold coins across the city (rooftops, beach, pier, lighthouse, casino, bank, airport). Collect all 12 for a **$200 bonus**.
- **Street races** — 3 checkpoint races (Pier Sprint, Casino Loop, Runway Dash). Press **R** in a car near a race start. Each win pays **$100**, plus a **$50 bonus** for beating your best time.
- **Cash pickups** — green discs worth $25 scattered around the city.

## World and systems

- **9x9-block city** with roads, traffic (14 cars), 24 pedestrians, beach and sea, palms, lamps, and 10 landmarks: Marina Garage, Hotel Solmar, Old Lighthouse, Spray Shop, Safehouse, The Pier, Casino Solmar, Solmar Boardwalk, Solmar Bank and Solmar Airport (with a runway).
- **Dusk lighting** — low warm sun, glowing lamps, neon casino/bank/hotel signs, a sweeping lighthouse beam, and working headlights on your car.
- **Wanted 0–5 stars** with police who chase and ram; the Spray Shop clears your wanted level for $75. Busted or Wasted drops you back at the Marina (health 60, wanted 0, $75 fine).
- **On foot + driving** — steal any car (raises wanted), punch (F) and, after M2, a pistol (F). Health regens while calm.
- **HUD with live minimap** — money, health, wanted stars, objective, mission ticks, doubloon count, fare streak, race timer.
- **Save** — progress autosaves to localStorage (missions, money, doubloons, race bests).

## Controls

| Key | Action |
|-----|--------|
| W / S | Drive forward / reverse (walk forward / back on foot) |
| A / D | Steer left / right |
| E | Enter or exit the nearest car |
| F | Punch, or fire the pistol (after M2) |
| R | Start a street race near a race marker |
| Space | Handbrake |
| Shift | Sprint on foot |
| M | Mute sound |
| Esc | Pause |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — the game is plain static files under `game/`, no build step, no network requests. Sound is synthesized with WebAudio; there are no audio files.

## Shots

- `?shot=cover` — dusk chase in the armored van by the Bank, 4 stars, M6 live
- `?shot=foot` — on foot at the Marina, red sedan ahead, M1 objective
- `?shot=mission` — cracking the Bank vault in the van, police closing in
- `?shot=menu` — title screen over a slow orbit of the city

## License

MIT — see `LICENSE`.
