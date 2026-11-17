# Solmar Heat — a make.fun "Make GTA 6" (gta6-01) entry

**Solmar Heat** is an original open-world crime game in the fictional sun-soaked
coastal city of Solmar Bay. Dana "Dash" Reyes, a courier with a debt to the
Marlin Club, has three jobs to finish: steal a ride, run the sunset courier
route, and lose the heat. Nothing in it is taken from any commercial game —
the city, people, cars, names, story, art, sound and music are all invented
for this game.

## Play it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

No build step, no network: `game/index.html` and everything it loads live
under `game/`, including a vendored three.js build
(`game/vendor/three.module.min.js`, Three.js r180, MIT).

## Controls

| Key | Action |
| --- | ------ |
| W A S D | Move / drive |
| Mouse drag | Look around |
| Shift | Sprint |
| E | Enter / exit car, deliver, pick up |
| Space | Handbrake (in car) |
| F | Punch |
| Click | Shoot (after Mission 2) |
| T | Start a taxi fare |
| M | Music on / off |
| P / Esc | Pause |
| R | Restart from last save |

## What is in the game

- **A complete open world:** a 9×9-block city with roads, traffic, pedestrians,
  a beach and the sea, explored on foot and by car.
- **Cars to steal:** parked cars and traffic cars (stealing one raises your
  wanted level); arcade driving with handbrake drift.
- **Wanted level and police:** 0–5 stars, police cars that chase and ram you,
  a Spray Shop that clears your wanted level for $75, Busted and Wasted.
- **Missions and story:** three story missions (Hot Wheels, Sunset Courier,
  The Heat), a taxi side job, cash pickups, and a win screen when all three
  missions are done.
- **Combat:** punch and, after Mission 2, a pistol.
- **HUD with minimap:** money, health, wanted stars, mission objectives and
  timer, speed, and a live top-down minimap showing the player, traffic,
  police and the mission marker.
- **Start screen, pause menu, and a save** in localStorage (autosaves on
  mission completion and every 30 seconds).
- **Sound and music:** engine hum, police sirens, effects and a sunset pad
  loop, all synthesized live with WebAudio — no audio files.

## Screenshots

`?shot=cover`, `?shot=foot`, `?shot=mission` and `?shot=menu` stage real
gameplay scenes for the four screenshots in `screenshots/`.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the vendored
`vendor/makefun-game.ts`. Run it with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.
