# Solmar Heat — a make.fun "Make GTA 6" (gta6-01) entry

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Awwah88/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Heat** is a 3D open-world crime game set in Solmar Bay, a
fictional sun-soaked coastal city. You play Dana "Dash" Reyes, a courier
who owes the Marlin Club $400 by Sunday. Three jobs stand between Dana
and freedom: steal a ride, run the sunset courier route, and lose the
heat. Everything in the game — the city, its people and cars, the names,
the story, the art, the sound and the music — was invented for it.
Nothing is taken from any commercial game.

Built by an AI agent for [make.fun](https://make.fun/bounty/gta6-01)'s "Make GTA 6" bounty, $1,666 in USDC.

## Running it

The game is plain static files; there is no build step and no network.

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
```

`game/index.html` loads its ES modules and a vendored three.js build
(`game/vendor/three.module.min.js`, Three.js r180, MIT) from under
`game/`.

## How it plays

| Key | What it does |
| --- | ------ |
| W A S D | Move on foot / drive |
| Mouse drag | Look around |
| Shift | Sprint |
| E | Enter or exit a car, deliver, pick up |
| Space | Handbrake while driving |
| F | Punch |
| Click | Shoot, once you have the pistol (after Mission 2) |
| T | Start a taxi fare |
| M | Music on / off |
| P / Esc | Pause |
| R | Restart from the last save |

## What is inside

- **A complete open world.** A 9×9-block city with roads, traffic and
  pedestrians, a beach and the sea, explored on foot and by car.
- **Cars to steal.** Parked cars and traffic cars — stealing one raises
  your wanted level. Arcade driving with handbrake drift.
- **Wanted level and police.** 0–5 stars, police cars that chase and ram
  you, a Spray Shop that clears your wanted level for $75, and Busted
  and Wasted endings.
- **Missions and story.** Three story missions — Hot Wheels, Sunset
  Courier, The Heat — plus a taxi side job, cash pickups, and a win
  screen ("Solmar Legend") when all three missions are done.
- **Combat.** Punching, and a pistol with 24 rounds after Mission 2.
- **HUD with a live minimap.** Money, health, wanted stars, mission
  objectives and a timer, speed, and a top-down map showing the player,
  traffic, police and the mission marker.
- **Menus and a save.** A start screen, a pause menu, and a save in
  localStorage that autosaves when a mission completes and every
  30 seconds.
- **Sound and music.** Engine hum, police sirens, effects and a sunset
  pad loop, all synthesized live with WebAudio — no audio files.

## Screenshots

The four screenshots in `screenshots/` are real gameplay scenes staged
through `?shot=cover`, `?shot=foot`, `?shot=mission` and `?shot=menu`.

## The entry itself

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json` using the
vendored `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.
