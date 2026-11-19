# Solmar Heat

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01)

Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC

**Solmar Heat** is a 3D open-world crime game set in fictional Solmar Bay. Dana "Dash" Reyes owes the Marlin Club $400 — and the whole city is one long job to pay it back.

## Play

Open `game/index.html` (or run `node serve.ts` and visit http://localhost:8080) and click **START GAME**.

- **WASD** — drive / walk (Shift to run)
- **E** — enter and exit a car (stealing one raises your wanted level)
- **F** — punch, or shoot once you have the pistol
- **Mouse click** — attack too

## The city

A 9×9-block island with roads, 14 traffic cars, 24 pedestrians, a beach and sea to the south, palms, lamps, and six landmarks: the Marina Garage, Hotel Solmar, the Old Lighthouse, the Spray Shop, the Safehouse, and The Pier. The HUD has a minimap, health, cash, and a wanted meter.

## Missions

1. **Hot Wheels** ($150) — steal any car and bring it to the Marina Garage.
2. **Sunset Courier** ($250 + pistol) — deliver three packages across the city in 240 seconds.
3. **The Heat** ($400) — lose three stars at the Spray Shop ($75), then reach the Safehouse.
4. **Marlin's Debt** ($300) — steal the gold Marlin GT from the Hotel Solmar, drop it at the Old Lighthouse under four stars, and escape to the Safehouse.

Finish all four and the debt is paid: **Solmar Legend**.

## Systems

- Wanted level 0–5 stars: police chase, ram, and bust you on foot.
- Spray Shop clears your wanted level for $75.
- Taxi side job: stop your cab at a fare marker to earn $40 a ride.
- Cash pickups scattered on the sidewalks.
- Busted / Wasted / win screens, and an autosave (localStorage) that picks your run back up.
