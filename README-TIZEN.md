# Tizen packaging for stremio-web

Drop-in files that package the stremio-web build into a sideloadable Samsung
Tizen `.wgt`. No Tizen Studio and no signing certificate required — the `.wgt`
is a plain ZIP that installs in Developer Mode / TizenBrew.

## What's in here

```
.github/workflows/build-tizen.yml   CI: build + package + upload on push/release
scripts/package-tizen.mjs           Node packager (uses jszip)
package.json                        your package.json + 2 additions (see below)
```

## How to install into your repo

Copy the contents of this folder onto the **root** of `NimitForAI/stremio-web`,
merging the directories:

- `.github/workflows/build-tizen.yml`  → new file
- `scripts/package-tizen.mjs`          → new file
- `package.json`                       → replaces yours (only two lines change)

If you'd rather not overwrite `package.json`, add these two entries by hand:

- in `"scripts"`:
  `"package:tizen": "npm run build && node scripts/package-tizen.mjs"`
- in `"devDependencies"`:
  `"jszip": "3.10.1"`

Then commit and push.

## Build locally

```
npm install
npm run package:tizen
```

Produces `NimitStrm1_5.0.0.wgt` at the repo root.

## Build online (GitHub Actions)

`build-tizen.yml` runs automatically on:

- push to `main` or `fix/**`  → uploads the `.wgt` as a workflow artifact
- a published GitHub Release   → also attaches the `.wgt` to the release
- manual "Run workflow"        → on demand

Download the artifact from the Actions run summary.

## Install on the TV

1. Enable Developer Mode on the Samsung TV (Apps > type 12345, set Developer
   Mode on, enter your PC IP).
2. Connect and install:
   ```
   tizen install -n NimitStrm1_5.0.0.wgt -t <device-name>
   ```
   or sideload the `.wgt` via TizenBrew.

## Config knobs (env vars)

- `TIZEN_PACKAGE_ID`        default `NimitStrm1` (10 chars, keep stable)
- `TIZEN_APP_ID`            default `<packageId>.Stremio`
- `TIZEN_REQUIRED_VERSION`  default `5.5`

## Two gotchas

- **Blank screen on device** = absolute asset paths. Check the built
  `build/index.html`; if injected `<script>`/`<link>` tags start with `/`, add
  `publicPath: ''` under `output` in `webpack.config.js`.
- **Offline-clean package**: `src/index.html` loads Google's `cast_sender.js`
  from gstatic. Harmless on TV (fails quietly), but delete that line if you want
  no external fetch at boot.
