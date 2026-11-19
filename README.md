[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Heat

A 3D open-world crime game in the fictional coastal city of Solmar Bay,
built with Three.js (vendored, no build step, no network requests). Dana
"Dash" Reyes owes the Marlin Club $400 — steal cars, outrun the police,
run couriers, drive taxi fares and hunt hidden doubloons to pay it off
and become a Solmar Legend.

## Story & missions

Dana starts broke at the Marina. Five story missions pay the debt and
finish the saga:

- **M1 Hot Wheels — $150.** Steal the red sedan at the Marina Garage.
- **M2 Sunset Courier — $250 + pistol.** Deliver 3 packages across the
  city before the 240-second timer runs out.
- **M3 The Heat — $400.** Lose your wanted level, then reach the
  Safehouse without being spotted.
- **M4 Marlin's Debt — $300.** Steal the gold Marlin GT at Hotel
  Solmar, show it at the Old Lighthouse, then vanish at the Safehouse.
- **M5 The Marlin's Last Hand — $500 (new in Round 16).** The finale:
  steal the Marlin Club's black limousine from the new **Casino
  Solmar**, outrun a 4-star police chase to the new **Solmar
  Boardwalk**, then deliver the limo to the Pier before the timer
  expires. Only when M1–M5 are all done does the **SOLMAR LEGEND**
  win screen appear.

## Side activities

- **Taxi fares (expanded in Round 16).** Fare beacons appear across
  the city. Pick a fare up, drop them off in time, and earn $40 plus a
  tip that grows with your streak — the streak resets if a fare times
  out. Fares work on foot or in a car and never block missions.
- **Solmar doubloons (new in Round 16).** 12 hidden gold coins are
  scattered across the map — the Marina, the Hotel, the Lighthouse,
  the Spray Shop, the Safehouse, the Pier, the Casino, the Boardwalk,
  the Plaza and more. Each is worth $10; collecting all 12 pays a
  $200 bonus. The HUD shows your count.
- **Cash pickups** ($25) are hidden around the city and respawn.

## World & systems

- A 9×9-block city with roads, traffic (14 cars), 24 pedestrians,
  a beach and sea, palms, lamps and 8 landmarks: Marina Garage,
  Hotel Solmar, Old Lighthouse, Spray Shop, Safehouse, The Pier,
  **Casino Solmar** (neon sign, M5 limo parked outside) and the
  **Solmar Boardwalk** (by the Pier).
- On foot and driving, with cars to steal (stealing raises your
  wanted level), a 0–5 star wanted system with police chases and
  rams, Busted/Wasted states with a Marina respawn and a $75 fine,
  and a Spray Shop that clears your wanted level for $75.
- Combat: punch (Space/click) and a pistol (F, unlocked after M2).
- HUD with money, health, wanted stars, mission objective, mission
  dots, doubloon counter, taxi streak, timer and a live minimap.
- Synthesized WebAudio sound and music (no audio files): engine,
  sirens, cash, doubloon chimes, fare bells, casino win arpeggios
  and the limo alarm.
- Start / pause / win / busted screens, and localStorage save with
  autosave (missions, doubloons, fare streak and pistol persist).

## Controls

| Key | Action |
| --- | --- |
| W A S D | Drive / walk (A left, D right) |
| Shift | Sprint on foot |
| E | Enter / exit car (steal it — wanted up!) |
| Space / click | Punch |
| F | Fire pistol (after Mission 2) |
| Esc | Pause |

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step,
no install, no network — everything is served from `game/`.

## Shots

- Cover (police chase): `?shot=cover`
- On foot: `?shot=foot`
- Courier mission: `?shot=mission`
- Title menu: `?shot=menu`
- Casino / M5 finale staging: `?shot=casino`

## License

MIT — see LICENSE.
