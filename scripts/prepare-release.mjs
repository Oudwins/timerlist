import { appendFile, readFile, writeFile } from 'node:fs/promises';

const app = JSON.parse(await readFile('app.json', 'utf8'));
const pages = JSON.parse(await readFile('releases.json', 'utf8'));
if (!Array.isArray(pages) || !pages.every(Array.isArray)) throw new Error('Expected paginated GitHub release data.');
let patch = 0;
for (const release of pages.flat()) {
  if (release.draft || release.prerelease) continue;
  const match = /^v?0\.0\.(0|[1-9]\d*)$/.exec(release.tag_name);
  if (!match) continue;
  const previous = Number(match[1]);
  if (!Number.isSafeInteger(previous)) throw new Error('Release patch number exceeds the supported range.');
  patch = Math.max(patch, previous);
}
if (!Number.isSafeInteger(patch + 1)) throw new Error('Release patch number exceeds the supported range.');
// Keep the new series above the Android version codes used by the old 1.0.x builds.
const versionCode = 1000000 + patch + 1;
if (versionCode > 2100000000) throw new Error('Release patch number exceeds Android version-code limits.');
app.expo.version = `0.0.${patch + 1}`;
app.expo.android.versionCode = versionCode;
await writeFile('app.json', `${JSON.stringify(app, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `version=${app.expo.version}\ntag=v${app.expo.version}\n`);
console.log(`Preparing Timerlist ${app.expo.version} (${versionCode})`);
