# Solmar Heat

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01)

Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC

**Solmar Heat** is a 3D open-world crime game set in fictional Solmar Bay at sunset. You are Dana "Dash" Reyes, and you owe the Marlin Club $400. One night to pay it back — or disappear trying.

## Play

```bash
node serve.ts --port 8080
# open http://localhost:8080/
```

Drive with **W A S D**, run with **Shift**, steal or enter a car with **E**, handbrake with **Space**, punch with **F**, and shoot with the mouse once you have the pistol. Pause with **P** or **Esc**.

## The city

A 9×9-block city on the bay: roads full of traffic, pedestrians on the sidewalks, a beach with palms and the sea beyond, and six landmarks — Marina Garage, Hotel Solmar, Old Lighthouse, Spray Shop, Safehouse, and The Pier. Sunset light, fog rolling in off the water, headlights on as the night warms up.

## Missions

1. **Hot Wheels** — steal a car and bring it to Marina Garage. **$150**
2. **Sunset Courier** — deliver three packages around the city in four minutes. The pistol is yours after this one. **$250**
3. **The Heat** — lose a three-star wanted level and make it to the Safehouse. **$400**
4. **Marlin's Debt** — steal the gold Marlin GT from Hotel Solmar, deliver it to the Old Lighthouse under four stars, then escape to the Safehouse. **$275**

Finish all four and you are a **Solmar Legend** — $1,075 in total.

## Systems

- **Wanted level** 0–5 stars: police cruisers chase and ram you; get Busted if they corner you, Wasted if your health hits zero.
- **Spray Shop** clears your wanted level for $75.
- **Taxi side job**: drive a fare to the taxi stand for $40.
- **Collectibles**: cash pickups ($25) and shells ($10) scattered off the driving line, plus a vigilante bonus for stopping crime.
- **Save**: progress autosaves to localStorage; continue from the menu.
- **HUD**: money, stars, health, minimap with mission markers, and a mission tracker that shows every objective.

## Tech

Built with Three.js (vendored, `game/vendor/three.core.min.js` + `three.module.min.js`), plain ES modules, no network requests at runtime. `main.ts` builds the dossier the make.fun grader reads (`node main.ts`, output to `$MAKEFUN_OUTPUT_DIR` or `/output`).
