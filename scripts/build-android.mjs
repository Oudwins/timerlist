import { execFileSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) throw new Error('Install the Android SDK and set ANDROID_HOME first. See README.md.');
if (!process.env.ANDROID_SIGNING_KEY) {
  try { await access('.signing/android-signing.json'); }
  catch { throw new Error('Run `npm run setup:android-signing` once before building.'); }
}
const env = { ...process.env, EXPO_OFFLINE: '1', EXPO_NO_TELEMETRY: '1' };
execFileSync(process.execPath, ['scripts/expo.mjs', 'prebuild', '--platform', 'android', '--no-install'], { stdio: 'inherit', env });
execFileSync(resolve('android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'), [':app:assembleRelease', '--no-daemon', '--max-workers=2', '--build-cache', '--parallel', '--profile'], { cwd: 'android', stdio: 'inherit', env });
execFileSync(process.execPath, ['scripts/sign-android.mjs'], { stdio: 'inherit', env });
