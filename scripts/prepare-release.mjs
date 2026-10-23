import { readFile, writeFile } from 'node:fs/promises';

const app = JSON.parse(await readFile('app.json', 'utf8'));
const build = Number(process.env.GITHUB_RUN_NUMBER);
if (!Number.isSafeInteger(build) || build < 1 || build > 2099999000) throw new Error('GITHUB_RUN_NUMBER must be a positive integer within Android version-code limits.');
app.expo.version = `1.0.${build}`;
app.expo.android.versionCode = 1000 + build;
await writeFile('app.json', `${JSON.stringify(app, null, 2)}\n`);
console.log(`Preparing Timerlist ${app.expo.version} (${build})`);
