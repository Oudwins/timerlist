import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

await mkdir('assets/sounds', { recursive: true });
await mkdir('assets/brand', { recursive: true });

// Struck tones built from partials that each decay at their own speed. Nothing is
// cut off: every strike rings out, and whatever is still sounding at the end of
// the loop wraps into its start, so looping is seamless.
const rate = 48000;
const voices = {
  beep: { length: 2, strikes: [[0, 880], [0.26, 880], [0.52, 880]], decay: 0.07, partials: [[1, 1, 1], [2, 0.18, 0.7], [3, 0.05, 0.5]] },
  chime: { length: 3, strikes: [[0, 659.26], [0.3, 830.61], [0.6, 987.77]], decay: 0.42, partials: [[1, 1, 1], [2, 0.22, 0.55], [3, 0.07, 0.35], [4.2, 0.03, 0.2]] },
  bell: { length: 4, strikes: [[0, 523.25], [1.1, 392]], decay: 0.5, partials: [[0.5, 0.28, 1.6], [1, 1, 1], [1.2, 0.3, 0.8], [1.5, 0.12, 0.6], [2, 0.45, 0.5], [3, 0.12, 0.3], [4.07, 0.06, 0.2]] },
};
const reflections = [[0.031, 0.16], [0.067, 0.1], [0.109, 0.06]];

for (const [name, { length, strikes, decay, partials }] of Object.entries(voices)) {
  const size = rate * length;
  const samples = new Float64Array(size);
  for (const [at, frequency] of strikes) for (const [ratio, gain, sustain] of partials) {
    // Quiet early reflections soften the tone the way a small room would.
    for (const [delay, level] of [[0, 1], ...reflections]) {
      const first = Math.round((at + delay) * rate);
      for (let i = first; i < first + size * 2; i++) {
        const t = (i - first) / rate;
        const attack = t < 0.006 ? 0.5 - 0.5 * Math.cos(Math.PI * t / 0.006) : 1;
        samples[i % size] += Math.sin(2 * Math.PI * frequency * ratio * t) * attack * Math.exp(-t / (decay * sustain)) * gain * level;
      }
    }
  }
  // Match loudness across tones (-17 dBFS RMS) without letting any peak pass -1 dBFS.
  const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
  const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / size);
  const scale = Math.min(0.89 / peak, 0.141 / rms);
  const buffer = Buffer.alloc(44 + size * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36);
  buffer.writeUInt32LE(size * 2, 40);
  samples.forEach((sample, i) => buffer.writeInt16LE(Math.round(sample * scale * 32767), 44 + i * 2));
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
