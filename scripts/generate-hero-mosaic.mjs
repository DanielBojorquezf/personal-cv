import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public', 'assets', 'img', 'profile-img.jpg');
const out = join(root, 'public', 'assets', 'img', 'hero-mosaic.svg');

const tiles = 24;
const view = 400;
const gap = 3;
const cell = view / tiles;
const size = cell - gap;

const { data } = await sharp(src)
  .resize(tiles, tiles, { kernel: sharp.kernel.lanczos3, fit: 'cover' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const rects = [];
for (let y = 0; y < tiles; y += 1) {
  for (let x = 0; x < tiles; x += 1) {
    const i = (y * tiles + x) * 3;
    const hex = [data[i], data[i + 1], data[i + 2]]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    rects.push(
      `<rect x="${(x * cell + gap / 2).toFixed(2)}" y="${(y * cell + gap / 2).toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="#${hex}"/>`,
    );
  }
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}" role="img" aria-label="Daniel Bojorquez">
  <rect width="${view}" height="${view}" fill="#050d18"/>
  ${rects.join('\n  ')}
</svg>
`;

await writeFile(out, svg);
console.log(`Wrote ${tiles}x${tiles} mosaic to ${out}`);
