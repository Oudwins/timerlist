import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const { expo: app } = JSON.parse(await readFile('app.json', 'utf8'));
const apk = process.argv[2] || 'timerlist.apk';
for (const [field, expected] of [
  ['application-id', app.android.package],
  ['version-name', app.version],
  ['version-code', String(app.android.versionCode)],
]) {
  const actual = execFileSync('apkanalyzer', ['manifest', field, apk], { encoding: 'utf8' }).trim();
  if (actual !== expected) throw new Error(`APK ${field}: expected ${expected}, found ${actual}.`);
}
console.log(`Verified APK metadata: ${app.android.package} ${app.version} (${app.android.versionCode})`);
