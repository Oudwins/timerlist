import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const source = resolve(process.argv[2] || 'android/app/build/outputs/apk/release/app-release.apk');
const output = resolve(process.argv[3] || 'timerlist.apk');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) throw new Error('Set ANDROID_HOME to your Android SDK directory. See README.md.');

let raw = process.env.ANDROID_SIGNING_KEY;
if (!raw) {
  try { raw = await readFile('.signing/android-signing.json', 'utf8'); }
  catch { throw new Error('Android signing key missing. Run `npm run setup:android-signing` first.'); }
}
let signing;
try { signing = JSON.parse(raw); }
catch { throw new Error('ANDROID_SIGNING_KEY must be valid JSON.'); }
if (typeof signing !== 'object' || signing === null) throw new Error('ANDROID_SIGNING_KEY must be a signing-key object.');
if (typeof signing.keystore !== 'string' || !signing.keystore || typeof signing.password !== 'string' || !signing.password || typeof signing.alias !== 'string' || !signing.alias) {
  throw new Error('ANDROID_SIGNING_KEY must contain a keystore, password, and alias.');
}
const tools = join(sdk, 'build-tools', process.env.ANDROID_BUILD_TOOLS_VERSION || '37.0.0');
const zipalign = join(tools, process.platform === 'win32' ? 'zipalign.exe' : 'zipalign');
const apksigner = join(tools, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner');
const temporary = await mkdtemp(join(tmpdir(), 'timerlist-sign-'));
try {
  const keystore = join(temporary, 'release.keystore');
  const aligned = join(temporary, 'aligned.apk');
  await writeFile(keystore, Buffer.from(signing.keystore, 'base64'), { mode: 0o600 });
  const env = { ...process.env, ANDROID_KEYSTORE_PASSWORD: signing.password };
  delete env.ANDROID_SIGNING_KEY;
  const options = { stdio: 'inherit', env };
  // Replace any template/debug signature; only the private release key is distributed.
  execFileSync(zipalign, ['-P', '16', '-f', '4', source, aligned], options);
  execFileSync(apksigner, [
    'sign', '--ks', keystore, '--ks-key-alias', signing.alias,
    '--ks-pass', 'env:ANDROID_KEYSTORE_PASSWORD', '--key-pass', 'env:ANDROID_KEYSTORE_PASSWORD',
    '--v4-signing-enabled', 'false', '--out', output, aligned,
  ], options);
  execFileSync(apksigner, ['verify', '--verbose', '--print-certs', output], options);
  execFileSync(zipalign, ['-c', '-P', '16', '4', output], options);
  console.log(`Signed and verified ${output}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
