import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const prepare = resolve('scripts/prepare-release.mjs');
const setup = resolve('scripts/setup-android-signing.mjs');
const sign = resolve('scripts/sign-android.mjs');
const verifyApk = resolve('scripts/verify-apk.mjs');

async function workspace(context) {
  const directory = await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), 'timerlist-release-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('release preparation needs no Expo credentials and preserves app settings', async context => {
  const cwd = await workspace(context);
  const config = { expo: { name: 'Timerlist', version: '0.0.1', android: { package: 'com.oudwins.timerlist', versionCode: 1 }, extra: { feature: true } } };
  await writeFile(join(cwd, 'app.json'), JSON.stringify(config));
  await writeFile(join(cwd, 'releases.json'), '[[]]');
  await run(process.execPath, [prepare], { cwd, env: { ...process.env, GITHUB_RUN_NUMBER: '42', GITHUB_OUTPUT: '' } });
  const app = JSON.parse(await readFile(join(cwd, 'app.json'), 'utf8')).expo;
  assert.equal(app.version, '0.0.1');
  assert.equal(app.android.versionCode, 1000001);
  assert.equal(app.android.package, 'com.oudwins.timerlist');
  assert.deepEqual(app.extra, { feature: true });
});

test('release patches use published versions across pages, not names or run numbers', async context => {
  const cwd = await workspace(context);
  await writeFile(join(cwd, 'app.json'), JSON.stringify({ expo: { android: {} } }));
  await writeFile(join(cwd, 'releases.json'), JSON.stringify([
    [{ tag_name: 'v0.0.9' }, { tag_name: 'v1.0.99' }, { tag_name: 'v0.0.500', draft: true }],
    [{ tag_name: 'v0.0.10' }, { tag_name: 'v0.1.0' }, { tag_name: 'v0.0.501', prerelease: true }],
  ]));
  await run(process.execPath, [prepare], { cwd, env: { ...process.env, GITHUB_RUN_NUMBER: '77', GITHUB_OUTPUT: '' } });
  assert.equal(JSON.parse(await readFile(join(cwd, 'app.json'), 'utf8')).expo.version, '0.0.11');
});

test('release output and APK version agree and only the patch increases', async context => {
  const cwd = await workspace(context);
  const output = join(cwd, 'output');
  await writeFile(join(cwd, 'app.json'), JSON.stringify({ expo: { android: {} } }));
  await writeFile(join(cwd, 'releases.json'), '[[]]');
  await run(process.execPath, [prepare], { cwd, env: { ...process.env, GITHUB_RUN_NUMBER: '50', GITHUB_OUTPUT: output } });
  const first = JSON.parse(await readFile(join(cwd, 'app.json'), 'utf8')).expo;
  assert.equal(first.version, '0.0.1');
  await writeFile(join(cwd, 'releases.json'), JSON.stringify([[{ tag_name: 'v0.0.1' }]]));
  await run(process.execPath, [prepare], { cwd, env: { ...process.env, GITHUB_RUN_NUMBER: '50', GITHUB_OUTPUT: output } });
  const second = JSON.parse(await readFile(join(cwd, 'app.json'), 'utf8')).expo;
  assert.equal(second.version, '0.0.2');
  assert.equal(second.android.versionCode, first.android.versionCode + 1);
  assert.equal(await readFile(output, 'utf8'), 'version=0.0.1\ntag=v0.0.1\nversion=0.0.2\ntag=v0.0.2\n');
});

test('patches never automatically roll over into minor or major versions', async context => {
  const cwd = await workspace(context);
  await writeFile(join(cwd, 'app.json'), JSON.stringify({ expo: { android: {} } }));
  await writeFile(join(cwd, 'releases.json'), JSON.stringify([[{ tag_name: 'v0.0.999' }]]));
  await run(process.execPath, [prepare], { cwd, env: { ...process.env, GITHUB_RUN_NUMBER: '52', GITHUB_OUTPUT: '' } });
  assert.equal(JSON.parse(await readFile(join(cwd, 'app.json'), 'utf8')).expo.version, '0.0.1000');
});

test('invalid GitHub release data cannot silently reset the patch number', async context => {
  const cwd = await workspace(context);
  const original = JSON.stringify({ expo: { android: {} } });
  await writeFile(join(cwd, 'app.json'), original);
  await writeFile(join(cwd, 'releases.json'), '{}');
  await assert.rejects(run(process.execPath, [prepare], { cwd, env: { ...process.env, GITHUB_RUN_NUMBER: '53', GITHUB_OUTPUT: '' } }), /paginated GitHub release data/);
  assert.equal(await readFile(join(cwd, 'app.json'), 'utf8'), original);
});

test('patch numbers exceeding numeric or Android limits do not change configuration', async context => {
  const cwd = await workspace(context);
  const original = JSON.stringify({ expo: { android: {} } });
  await writeFile(join(cwd, 'app.json'), original);
  for (const patch of ['2099000000', '9007199254740991', '9007199254740992']) {
    await writeFile(join(cwd, 'releases.json'), JSON.stringify([[{ tag_name: `v0.0.${patch}` }]]));
    await assert.rejects(run(process.execPath, [prepare], { cwd, env: { ...process.env, GITHUB_OUTPUT: '' } }), /supported range|Android version-code limits/);
    assert.equal(await readFile(join(cwd, 'app.json'), 'utf8'), original);
  }
});

test('local signing setup creates a real private key and never replaces it', async context => {
  const cwd = await workspace(context);
  await run(process.execPath, [setup], { cwd });
  const path = join(cwd, '.signing/android-signing.json');
  const first = await readFile(path, 'utf8');
  const signing = JSON.parse(first);
  assert.equal(signing.alias, 'timerlist');
  assert.equal(signing.password.length, 64);
  assert.ok(Buffer.from(signing.keystore, 'base64').length > 1000);
  if (process.platform !== 'win32') assert.equal((await stat(path)).mode & 0o777, 0o600);
  await run(process.execPath, [setup], { cwd });
  assert.equal(await readFile(path, 'utf8'), first);
  const keystore = join(cwd, 'test.keystore');
  await writeFile(keystore, Buffer.from(signing.keystore, 'base64'));
  await run('keytool', ['-list', '-keystore', keystore, '-alias', signing.alias, '-storepass:env', 'TEST_KEY_PASSWORD'], { env: { ...process.env, TEST_KEY_PASSWORD: signing.password } });
});

test('signing fails clearly when the SDK or key is missing', async context => {
  const cwd = await workspace(context);
  await assert.rejects(run(process.execPath, [sign], { cwd, env: { ...process.env, ANDROID_HOME: '', ANDROID_SDK_ROOT: '', ANDROID_SIGNING_KEY: '' } }), /Set ANDROID_HOME/);
  await assert.rejects(run(process.execPath, [sign], { cwd, env: { ...process.env, ANDROID_HOME: cwd, ANDROID_SIGNING_KEY: '' } }), /signing key missing/);
});

test('malformed signing secrets are rejected without echoing their contents', async context => {
  const cwd = await workspace(context);
  for (const value of ['not-json-private-value', 'null', '{}']) {
    await assert.rejects(run(process.execPath, [sign], { cwd, env: { ...process.env, ANDROID_HOME: cwd, ANDROID_SIGNING_KEY: value } }), error => {
      assert.match(error.stderr, /ANDROID_SIGNING_KEY must/);
      assert.ok(!error.stderr.includes('not-json-private-value'));
      return true;
    });
  }
});

async function signingTools(context) {
  const cwd = await workspace(context);
  const directory = join(cwd, 'build-tools', '37.0.0');
  await mkdir(directory, { recursive: true });
  // Exercise orchestration without downloading the Android SDK in the unit suite.
  const stub = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.SIGN_TEST_LOG, JSON.stringify({ tool: path.basename(process.argv[1]), args, hasPassword: !!process.env.ANDROID_KEYSTORE_PASSWORD, hasSecret: !!process.env.ANDROID_SIGNING_KEY }) + '\\n');
if (args[0] === 'sign') fs.copyFileSync(args.at(-1), args[args.indexOf('--out') + 1]);
else if (args[0] === 'verify' && process.env.FAIL_VERIFICATION) process.exit(1);
else if (args[0] === '-P') fs.copyFileSync(args.at(-2), args.at(-1));
`;
  for (const tool of ['zipalign', 'apksigner']) {
    const path = join(directory, tool);
    await writeFile(path, stub);
    await chmod(path, 0o755);
  }
  await writeFile(join(cwd, 'input.apk'), 'APK fixture');
  const env = { ...process.env, ANDROID_HOME: cwd, ANDROID_BUILD_TOOLS_VERSION: '37.0.0', ANDROID_SIGNING_KEY: JSON.stringify({ keystore: Buffer.from('fixture').toString('base64'), password: 'private', alias: 'timerlist' }), SIGN_TEST_LOG: join(cwd, 'calls.jsonl') };
  return { cwd, env };
}

test('APK signing aligns, signs with private credentials, verifies, and cleans up', async context => {
  const { cwd, env } = await signingTools(context);
  await run(process.execPath, [sign, 'input.apk'], { cwd, env });
  assert.equal(await readFile(join(cwd, 'timerlist.apk'), 'utf8'), 'APK fixture');
  const calls = (await readFile(env.SIGN_TEST_LOG, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(calls.map(call => [call.tool, call.args[0]]), [['zipalign', '-P'], ['apksigner', 'sign'], ['apksigner', 'verify'], ['zipalign', '-c']]);
  assert.ok(calls.every(call => call.hasPassword && !call.hasSecret));
  const keyPath = calls[1].args[calls[1].args.indexOf('--ks') + 1];
  await assert.rejects(access(keyPath));
});

test('a failed APK verification fails the release and removes the temporary key', async context => {
  const { cwd, env } = await signingTools(context);
  await assert.rejects(run(process.execPath, [sign, 'input.apk'], { cwd, env: { ...env, FAIL_VERIFICATION: '1' } }));
  const calls = (await readFile(env.SIGN_TEST_LOG, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const signing = calls.find(call => call.args[0] === 'sign');
  await assert.rejects(access(signing.args[signing.args.indexOf('--ks') + 1]));
});

async function apkMetadataTools(context) {
  const cwd = await workspace(context);
  const directory = join(cwd, 'bin');
  await mkdir(directory);
  const analyzer = join(directory, 'apkanalyzer');
  await writeFile(analyzer, `#!/usr/bin/env node
const fs = require('node:fs');
const [command, field, apk] = process.argv.slice(2);
if (command !== 'manifest' || !fs.existsSync(apk)) process.exit(1);
console.log(JSON.parse(process.env.TEST_APK_FIELDS)[field]);
`);
  await chmod(analyzer, 0o755);
  await writeFile(join(cwd, 'timerlist.apk'), 'APK fixture');
  const expected = { 'application-id': 'com.oudwins.timerlist', 'version-name': '0.0.1', 'version-code': '1000001' };
  await writeFile(join(cwd, 'app.json'), JSON.stringify({ expo: { version: expected['version-name'], android: { package: expected['application-id'], versionCode: Number(expected['version-code']) } } }));
  return { cwd, expected, env: { ...process.env, PATH: `${directory}:${process.env.PATH}` } };
}

test('APK metadata verification checks the actual package and both versions', async context => {
  const { cwd, env, expected } = await apkMetadataTools(context);
  const result = await run(process.execPath, [verifyApk], { cwd, env: { ...env, TEST_APK_FIELDS: JSON.stringify(expected) } });
  assert.match(result.stdout, /com\.oudwins\.timerlist 0\.0\.1 \(1000001\)/);
  for (const [field, value] of [['application-id', 'com.wrong.app'], ['version-name', '1.0.7'], ['version-code', '1']]) {
    await assert.rejects(run(process.execPath, [verifyApk], { cwd, env: { ...env, TEST_APK_FIELDS: JSON.stringify({ ...expected, [field]: value }) } }), new RegExp(`APK ${field}: expected`));
  }
});

test('Obtainium install link supplies the real app ID and GitHub source', async () => {
  const readme = await readFile('README.md', 'utf8');
  const app = JSON.parse(await readFile('app.json', 'utf8')).expo;
  const link = readme.match(/\[Add Timerlist to Obtainium\]\(([^)]+)\)/);
  assert.ok(link);
  const deepLink = new URL(link[1]).searchParams.get('r');
  assert.ok(deepLink?.startsWith('obtainium://app/'));
  const config = JSON.parse(deepLink.slice('obtainium://app/'.length));
  assert.equal(config.id, app.android.package);
  assert.equal(config.url, 'https://github.com/Oudwins/timerlist');
  assert.equal(config.name, app.name);
});
