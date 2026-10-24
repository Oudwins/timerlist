import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

// Never prune a developer's SDK or a persistent self-hosted runner.
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_ENVIRONMENT !== 'github-hosted') {
  throw new Error('SDK pruning is restricted to disposable GitHub-hosted runners.');
}

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) throw new Error('Android SDK directory is required.');
const ndkVersion = '27.1.12297006';
const required = [
  'platforms;android-37.0',
  `build-tools;${process.env.ANDROID_BUILD_TOOLS_VERSION || '37.0.0'}`,
  'platform-tools',
  `ndk;${ndkVersion}`,
  'cmake;3.22.1',
];
const installed = execFileSync('sdkmanager', ['--list_installed'], { encoding: 'utf8' })
  .split('\n').map(line => line.split('|')[0].trim());
const unused = installed.filter(path =>
  (path === 'emulator' || /^(ndk|cmake|platforms|build-tools|system-images);/.test(path)) && !required.includes(path));

if (unused.length) execFileSync('sdkmanager', ['--uninstall', ...unused], { stdio: 'inherit' });
execFileSync('sdkmanager', required, { stdio: 'inherit' });
if (process.env.GITHUB_ENV) {
  const ndk = join(sdk, 'ndk', ndkVersion);
  await appendFile(process.env.GITHUB_ENV, ['ANDROID_NDK', 'ANDROID_NDK_HOME', 'ANDROID_NDK_ROOT', 'ANDROID_NDK_LATEST_HOME'].map(name => `${name}=${ndk}\n`).join(''));
}
