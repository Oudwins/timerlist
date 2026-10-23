import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

await mkdir('assets/sounds', { recursive: true });
await mkdir('assets/brand', { recursive: true });

for (const [name, notes] of Object.entries({ beep: [880, 880, 880], chime: [660, 830, 990], bell: [1046, 1318, 1568] })) {
  const rate = 22050;
  const length = rate * 2;
  const buffer = Buffer.alloc(44 + length * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36);
  buffer.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const time = i / rate;
    let sample = 0;
    notes.forEach((frequency, index) => {
      const t = time - index * 0.4;
      if (t < 0 || t > (name === 'beep' ? 0.22 : 0.9)) return;
      const envelope = Math.min(1, t / 0.012) * Math.exp(-t * (name === 'beep' ? 9 : 5));
      sample += Math.sin(2 * Math.PI * frequency * t) * envelope * 0.35;
      if (name === 'bell') sample += Math.sin(2 * Math.PI * frequency * 2.76 * t) * envelope * 0.07;
    });
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2);
  }
  await writeFile(`assets/sounds/${name}.wav`, buffer);
}

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(name, data) {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
}

function icon(size, foreground = false, monochrome = false) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size, ny = y / size;
      const distance = Math.hypot(nx - 0.5, ny - 0.53);
      const angle = Math.atan2(ny - 0.53, nx - 0.5);
      const ring = Math.abs(distance - 0.22) < 0.025 && !(angle < -0.9 && angle > -1.5);
      const hand = nx > 0.485 && nx < 0.515 && ny > 0.39 && ny < 0.54;
      const top = nx > 0.44 && nx < 0.56 && ny > 0.20 && ny < 0.235;
      const stem = nx > 0.485 && nx < 0.515 && ny > 0.23 && ny < 0.285;
      const diagonal = Math.abs(ny - 0.53 + (nx - 0.5) * 0.7) < 0.017 && nx >= 0.5 && nx < 0.6;
      const mark = ring || hand || top || stem || diagonal;
      const color = mark ? (monochrome ? [255, 255, 255, 255] : [255, 99, 55, 255]) : foreground ? [0, 0, 0, 0] : [33, 29, 26, 255];
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      pixels.set(color, offset);
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

await Promise.all([
  writeFile('assets/brand/icon.png', icon(1024)),
  writeFile('assets/brand/adaptive-icon.png', icon(1024, true)),
  writeFile('assets/brand/monochrome-icon.png', icon(1024, true, true)),
  writeFile('assets/brand/favicon.png', icon(64)),
]);
