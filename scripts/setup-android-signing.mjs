import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const upload = process.argv.includes('--github');
const path = '.signing/android-signing.json';

// Never replace a repository's established signing identity.
if (upload) {
  const secrets = JSON.parse(execFileSync('gh', ['secret', 'list', '--json', 'name'], { encoding: 'utf8' }));
  if (secrets.some(secret => secret.name === 'ANDROID_SIGNING_KEY')) {
    console.log('ANDROID_SIGNING_KEY already exists on GitHub; leaving it unchanged.');
    process.exit(0);
  }
}

let signing;
try {
  signing = await readFile(path, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const temporary = await mkdtemp(join(tmpdir(), 'timerlist-key-'));
  try {
    const password = randomBytes(32).toString('hex');
    const keystore = join(temporary, 'release.keystore');
    execFileSync('keytool', [
      '-genkeypair', '-keystore', keystore, '-storetype', 'PKCS12',
      '-alias', 'timerlist', '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
      '-storepass:env', 'ANDROID_KEYSTORE_PASSWORD', '-dname', 'CN=Timerlist, O=Timerlist, C=US',
    ], { stdio: 'inherit', env: { ...process.env, ANDROID_KEYSTORE_PASSWORD: password } });
    signing = JSON.stringify({ keystore: (await readFile(keystore)).toString('base64'), password, alias: 'timerlist' });
    await mkdir('.signing', { recursive: true, mode: 0o700 });
    await writeFile(path, signing, { mode: 0o600, flag: 'wx' });
    console.log(`Created ${path}. Back up this private file securely; never commit it.`);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (upload) {
  execFileSync('gh', ['secret', 'set', 'ANDROID_SIGNING_KEY'], { input: signing, stdio: ['pipe', 'inherit', 'inherit'] });
  console.log('Stored the signing key in the encrypted GitHub Actions secret ANDROID_SIGNING_KEY.');
} else {
  console.log('Signing is ready locally. Add --github to also configure GitHub Actions.');
}
