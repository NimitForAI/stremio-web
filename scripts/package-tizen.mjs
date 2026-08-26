import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const buildDir = path.join(rootDir, "build");
const stagingDir = path.join(rootDir, ".cache", "tizen-package");

// Tizen identity. Package id is a fixed 10-char handle; keep it stable so
// updates replace the same app on the TV instead of installing a duplicate.
const APP_NAME = "Stremio";
const PACKAGE_ID = process.env.TIZEN_PACKAGE_ID || "NimitStrm1";
const APP_ID = process.env.TIZEN_APP_ID || `${PACKAGE_ID}.Stremio`;
const WIDGET_URI = "https://stremio.nimitforai.app";
const REQUIRED_VERSION = process.env.TIZEN_REQUIRED_VERSION || "5.5";

function normalizeVersion(version) {
  const parts = String(version || "0.0.0")
    .replace(/^v/i, "")
    .split(".")
    .map((p) => String(Number.parseInt(p, 10) || 0));
  while (parts.length < 3) parts.push("0");
  return parts.slice(0, 3).join(".");
}

async function pathExists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertBuildExists() {
  if (!(await pathExists(path.join(buildDir, "index.html")))) {
    throw new Error(`Build output not found at ${buildDir}. Run "npm run build" first.`);
  }
}

function buildConfigXml({ version }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns:tizen="http://tizen.org/ns/widgets" xmlns="http://www.w3.org/ns/widgets" id="${WIDGET_URI}" version="${version}" viewmodes="maximized">
  <access origin="*" subdomains="true"/>
  <tizen:application id="${APP_ID}" package="${PACKAGE_ID}" required_version="${REQUIRED_VERSION}"/>
  <author href="${WIDGET_URI}">NimitForAI</author>
  <content src="index.html"/>
  <feature name="http://tizen.org/feature/screen.size.all"/>
  <icon src="icon.png"/>
  <name>${APP_NAME}</name>
  <tizen:privilege name="http://tizen.org/privilege/internet"/>
  <tizen:privilege name="http://developer.samsung.com/privilege/network.public"/>
  <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
  <tizen:profile name="tv-samsung"/>
  <tizen:setting screen-orientation="landscape" context-menu="enable" background-support="disable" encryption="disable" install-location="auto" hwkey-event="enable"/>
</widget>
`;
}

// Injected into <head> so window.webapis (and avplay) exists before the app
// bundles run, and so the remote's Back/media keys emit keydown events.
const HEAD_INJECT = `
    <script src="$WEBAPIS/webapis/webapis.js"></script>
    <script>
      (function () {
        try {
          var tv = window.tizen && window.tizen.tvinputdevice;
          if (tv && typeof tv.registerKey === "function") {
            ["Back","Return","MediaPlay","MediaPause","MediaPlayPause","MediaStop",
             "MediaFastForward","MediaRewind","MediaTrackPrevious","MediaTrackNext",
             "ColorF0Red","ColorF1Green","ColorF2Yellow","ColorF3Blue"].forEach(function (k) {
              try { tv.registerKey(k); } catch (e) {}
            });
          }
        } catch (e) {}
      })();
    </script>`;

async function injectHead() {
  const indexPath = path.join(stagingDir, "index.html");
  const html = await readFile(indexPath, "utf8");
  if (!/<head[^>]*>/i.test(html)) {
    throw new Error("Could not find <head> in build/index.html to inject webapis.js.");
  }
  await writeFile(indexPath, html.replace(/<head[^>]*>/i, (m) => `${m}${HEAD_INJECT}`), "utf8");
}

async function resolveIcon() {
  const preferred = path.join(rootDir, "favicons", "icon-96.png");
  if (await pathExists(preferred)) return preferred;
  const faviconsDir = path.join(rootDir, "favicons");
  if (await pathExists(faviconsDir)) {
    const png = (await readdir(faviconsDir)).find((f) => f.toLowerCase().endsWith(".png"));
    if (png) return path.join(faviconsDir, png);
  }
  throw new Error("No icon PNG found in favicons/. Add favicons/icon-96.png or set an icon.");
}

async function addDirectoryToZip(zip, dir, baseDir = dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(baseDir, full).split(path.sep).join("/");
    if (entry.isDirectory()) await addDirectoryToZip(zip, full, baseDir);
    else if (entry.isFile()) zip.file(rel, await readFile(full));
  }
}

async function packageTizen() {
  await assertBuildExists();

  const pkg = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
  const version = normalizeVersion(pkg.version);

  console.log("staging Tizen package...");
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  await cp(buildDir, stagingDir, { recursive: true });

  await cp(await resolveIcon(), path.join(stagingDir, "icon.png"));
  await writeFile(path.join(stagingDir, "config.xml"), buildConfigXml({ version }), "utf8");
  await injectHead();

  console.log("zipping .wgt...");
  const zip = new JSZip();
  await addDirectoryToZip(zip, stagingDir);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  const outputPath = path.join(rootDir, `${PACKAGE_ID}_${version}.wgt`);
  await writeFile(outputPath, buffer);
  console.log(`Tizen WGT created: ${outputPath}`);
  console.log(`  app id: ${APP_ID}  package id: ${PACKAGE_ID}  required_version: ${REQUIRED_VERSION}`);
}

try {
  await packageTizen();
} catch (error) {
  console.error("\nTizen packaging failed:");
  console.error(error);
  process.exit(1);
}
