# Palm Neon — Sunset Cover Studio

[![Make.fun competition](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/adelbudi88-crypto/gta6-cover-art-01/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/adelbudi88-crypto/gta6-cover-art-01/reward.svg)](https://make.fun/c/gta6-cover-art-01)

Entry for the [Make GTA 6 Cover Art bounty on make.fun](https://make.fun/c/gta6-cover-art-01).

A web app that turns any photo and a caption into multi-panel poster cover art in the style of GTA 6's posters — and exports it as a PNG to share. It runs offline in a desktop browser from its own static files: photos are read on your machine and never leave it.

## What it does

- **Multi-panel poster**: 3 layouts — Seven Panel, Hero Six, Tilted Snaps — with a pop-out hero cut-out that rises above its frame.
- **Any photo**: upload your own photos (or load the app's illustrated sample scenes), place one photo per panel, click a panel to select it, drag to move, scroll to zoom.
- **Face-aware crop**: a skin-tone scan finds the face in each photo and keeps it inside every panel crop; one click re-centres it.
- **Retro-chrome lettering**: striped chrome title, neon script subtitle, tagline, cast/role tags on every panel, starburst seal and a 5-star heat meter.
- **5 colour grades**: Sunset, Neon, Heatwave, Palm, Vice — sunset sky, slatted sun, skyline and palm silhouettes behind the panels, plus grain and vignette.
- **Fast export**: one click exports a PNG in 1080×1080, 1080×1350 or 1920×1080 — or all three at once.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Originality

All art, lettering and sample scenes are drawn by this app's own code. No Rockstar Games logo, artwork or font is used, and no font files are shipped at all.

## License

MIT — see [LICENSE](LICENSE).
