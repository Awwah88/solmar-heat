# Solmar Heat

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01)

Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC

**Solmar Heat** is a 3D open-world crime game set in the sun-soaked fictional city of Solmar Bay. Dana "Dash" Reyes owes the Marlin Club $400 — steal cars, outrun the law, run packages at sunset, and pay the debt before the city eats you alive.

## The world

A 9×9-block coastal city: roads full of traffic, sidewalks full of pedestrians, a sand beach and the open sea to the south, and six landmarks — Marina Garage, Hotel Solmar, the Old Lighthouse, the Spray Shop, the Safehouse and The Pier. Sunset lighting, drifting clouds and glowing windows give the city its golden-hour look.

## What you can do

- **Explore on foot and by car** — walk the streets or steal any car you find (the law notices).
- **Wanted level 0–5 stars** — police cruisers chase, ram and corner you. Get Busted if they catch you slow, or Wasted if your health runs out. The Spray Shop clears your wanted level for $75.
- **Four story missions** — Hot Wheels, Sunset Courier (with a 240-second clock and a pistol reward), The Heat, and the finale, Marlin's Debt: steal the boss's gold Marlin GT and deliver it to the Old Lighthouse with a 4-star wanted level.
- **Side work** — taxi fares, a vigilante bonus for ramming the black getaway car, and ten collectible shells hidden off the driving line.
- **Combat** — fists on foot, and the pistol from Mission 2, with muzzle flash and sound.
- **Systems** — health, money and score, a HUD with a live minimap and mission tracker, a start screen, and localStorage saves with autosave.

## How to play

Serve the folder and open `game/index.html` in a desktop browser:

```sh
node serve.ts --port 8080
```

Then open http://localhost:8080/ and press **New Game**.

| Key | Action |
| --- | --- |
| W A S D | Drive / walk |
| E | Enter or steal a car, pick up a taxi passenger |
| Space | Brake / handbrake |
| Shift | Sprint |
| F | Punch |
| Mouse click | Shoot (once you own the pistol) |

## Tech

- Three.js r180, vendored under `game/vendor/` — no network requests, everything runs from static files.
- All sound is synthesized with WebAudio; all art is procedural (no borrowed assets).
- The game is original: its city, characters, vehicles, names and story are its own.

## Files

- `game/index.html` — the page, HUD and menus
- `game/src/main.js` — boot, game loop and the player
- `game/src/world.js` — terrain, roads, beach, sea, sky and light
- `game/src/city.js` — buildings, landmarks, palms and lamps
- `game/src/vehicles.js` — cars, driving physics and traffic
- `game/src/pedestrians.js` — the crowd
- `game/src/police.js` — wanted stars, cruisers, Busted
- `game/src/combat.js` — fists and the pistol
- `game/src/missions.js` — the four missions, taxi, vigilante, shells
- `game/src/hud.js` — HUD, minimap, toasts and screens
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized sound
- `game/src/save.js` — localStorage saves
- `game/src/shots.js` — staged screenshot scenes
- `game/src/config.js` — tuning, layout and story data
- `main.ts` — builds the submission dossier
- `serve.ts` — static file server for local play
