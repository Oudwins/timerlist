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

async function workspace(context) {
  const directory = await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), 'timerlist-release-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('release preparation needs no Expo credentials and preserves app settings', async context => {
  const cwd = await workspace(context);
  const config = { expo: { name: 'Timerlist', version: '1.0.0', android: { package: 'com.oudwins.timerlist', versionCode: 1 }, extra: { feature: true } } };
  await writeFile(join(cwd, 'app.json'), JSON.stringify(config));
  await run(process.execPath, [prepare], { cwd, env: { ...process.env, GITHUB_RUN_NUMBER: '42' } });
  const app = JSON.parse(await readFile(join(cwd, 'app.json'), 'utf8')).expo;
  assert.equal(app.version, '1.0.42');
  assert.equal(app.android.versionCode, 1042);
  assert.equal(app.android.package, 'com.oudwins.timerlist');
  assert.deepEqual(app.extra, { feature: true });
});

test('invalid release version numbers fail without changing configuration', async context => {
  const cwd = await workspace(context);
  const original = JSON.stringify({ expo: { android: {} } });
  await writeFile(join(cwd, 'app.json'), original);
  for (const number of ['', '0', '-1', '1.5', 'Infinity', '2099999001']) {
    await assert.rejects(run(process.execPath, [prepare], { cwd, env: { ...process.env, GITHUB_RUN_NUMBER: number } }), /positive integer/);
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
