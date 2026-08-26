# Tizen packaging for stremio-web (development branch)

Drop-in files that package the stremio-web build into a sideloadable Samsung
Tizen `.wgt`. No Tizen Studio, no signing certificate — the `.wgt` is a plain
ZIP that installs in Developer Mode / TizenBrew.

Targets the modern `development` branch: pnpm, Node 22, webpack + TypeScript,
Workbox service worker. Uses the runner's built-in `zip`, so it adds NO npm
dependency and does NOT touch `pnpm-lock.yaml`.

## What's in here

```
.github/workflows/build-tizen.yml   CI: pnpm build + package + upload
scripts/package-tizen.mjs           Node packager (uses system `zip`)
package.json                        the REAL development package.json + 1 script line
```

## IMPORTANT: fixing the broken branch first

An earlier version of these files overwrote `package.json` with an old (npm,
v5) file, which no longer matched `pnpm-lock.yaml` — that's the
`ERR_PNPM_OUTDATED_LOCKFILE` CI failure.

The `package.json` in this folder is the CORRECT modern one
(`5.0.0-beta.39`, all real deps) with only one line added:
`"package:tizen"` in `scripts`. No dependency was added, so it matches the
existing `pnpm-lock.yaml` and frozen install passes.

## How to install into your repo

Copy the contents of this folder onto the root of `NimitForAI/stremio-web`
(`development` branch), merging directories:

- `.github/workflows/build-tizen.yml`  -> new file
- `scripts/package-tizen.mjs`          -> new file
- `package.json`                       -> replaces the broken one (restores it + adds the script)

Do NOT run `pnpm install` expecting a lockfile change — there is none. Commit
and push. The repo's own `build.yml` should go green again because
`package.json` matches the lockfile.

If you prefer not to overwrite `package.json`, instead:
1. restore it to the pre-break version (e.g. `git checkout <commit-before-paste> -- package.json`)
2. add one line to `"scripts"`:
   `"package:tizen": "webpack --mode production && node scripts/package-tizen.mjs"`

## Build online (GitHub Actions)

`build-tizen.yml` runs on:
- push to `development` or `fix/**`  -> uploads the `.wgt` as a workflow artifact
- a published GitHub Release          -> also attaches the `.wgt`
- manual "Run workflow"

It uses pnpm + `.nvmrc` (Node 22) to match the repo, sets
`SERVICE_WORKER_DISABLED=true`, and zips with the runner's `zip`.

## Build locally

```
pnpm install
SERVICE_WORKER_DISABLED=true pnpm package:tizen
```

Produces `NimitStrm1_5.0.0.wgt` at the repo root. (macOS/Linux `zip` required —
both have it by default.)

## Install on the TV

1. Enable Developer Mode on the Samsung TV (Apps > 12345 > Developer Mode on,
   enter your PC IP).
2. `tizen install -n NimitStrm1_5.0.0.wgt -t <device-name>` or sideload via
   TizenBrew.

## Config knobs (env vars)

- `TIZEN_PACKAGE_ID`        default `NimitStrm1` (10 chars, keep stable)
- `TIZEN_APP_ID`            default `<packageId>.Stremio`
- `TIZEN_REQUIRED_VERSION`  default `5.5`
- `SERVICE_WORKER_DISABLED` set `true` for the Tizen build

## Gotchas

- **Blank screen on device** = absolute asset paths. The modern build uses
  relative paths (HtmlWebpackPlugin `auto` publicPath), so this should be fine;
  if not, set `publicPath: ''` under `output` in `webpack.config.js`.
- **External scripts**: `src/index.html` loads Google `cast_sender.js` and
  Apple `appleid.auth.js`. Harmless on TV (fail quietly); delete those two lines
  for a fully offline boot.
- **Icon**: taken from `build/images/icon_196x196.png` produced by the build.
