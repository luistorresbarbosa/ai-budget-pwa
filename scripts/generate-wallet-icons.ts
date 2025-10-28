import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ICON_DIR = path.resolve(__dirname, '../public/icons');
const OUTPUT_SIZES = [192, 512];

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function lerpChannel(start: number, end: number, t: number): number {
  return Math.round(start + (end - start) * t);
}

function lerpColor(start: RGB, end: RGB, t: number): RGB {
  return {
    r: lerpChannel(start.r, end.r, t),
    g: lerpChannel(start.g, end.g, t),
    b: lerpChannel(start.b, end.b, t)
  };
}

function setPixel(png: PNG, x: number, y: number, color: RGB, alpha = 255) {
  const idx = (png.width * y + x) << 2;
  const data = png.data;
  data[idx] = color.r;
  data[idx + 1] = color.g;
  data[idx + 2] = color.b;
  data[idx + 3] = alpha;
}

function insideRoundedRect(
  x: number,
  y: number,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number
): boolean {
  const right = left + width - 1;
  const bottom = top + height - 1;

  if (x >= left + radius && x <= right - radius) return y >= top && y <= bottom;
  if (y >= top + radius && y <= bottom - radius) return x >= left && x <= right;

  const cornerX = x < left + radius ? left + radius : right - radius;
  const cornerY = y < top + radius ? top + radius : bottom - radius;
  const dx = x - cornerX;
  const dy = y - cornerY;
  return dx * dx + dy * dy <= radius * radius;
}

function drawRoundedRect(
  png: PNG,
  left: number,
  top: number,
  width: number,
  height: number,
  radius: number,
  color: RGB,
  alpha = 255
) {
  for (let y = Math.max(0, top); y < Math.min(png.height, top + height); y += 1) {
    for (let x = Math.max(0, left); x < Math.min(png.width, left + width); x += 1) {
      if (insideRoundedRect(x, y, left, top, width, height, radius)) {
        setPixel(png, x, y, color, alpha);
      }
    }
  }
}

function drawCircle(png: PNG, centerX: number, centerY: number, radius: number, color: RGB, alpha = 255) {
  const radiusSq = radius * radius;
  const minX = Math.max(0, Math.floor(centerX - radius));
  const maxX = Math.min(png.width - 1, Math.ceil(centerX + radius));
  const minY = Math.max(0, Math.floor(centerY - radius));
  const maxY = Math.min(png.height - 1, Math.ceil(centerY + radius));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      if (dx * dx + dy * dy <= radiusSq) {
        setPixel(png, x, y, color, alpha);
      }
    }
  }
}

function createWalletIcon(size: number): PNG {
  const png = new PNG({ width: size, height: size });

  const gradientTop = hexToRgb('#0f172a');
  const gradientBottom = hexToRgb('#1e40af');

  for (let y = 0; y < size; y += 1) {
    const t = y / Math.max(1, size - 1);
    const rowColor = lerpColor(gradientTop, gradientBottom, t);
    for (let x = 0; x < size; x += 1) {
      setPixel(png, x, y, rowColor);
    }
  }

  const bodyColor = hexToRgb('#1f2937');
  const flapColor = hexToRgb('#111827');
  const accentColor = hexToRgb('#facc15');
  const stitchingColor = hexToRgb('#334155');

  const bodyWidth = Math.round(size * 0.68);
  const bodyHeight = Math.round(size * 0.38);
  const bodyX = Math.round((size - bodyWidth) / 2);
  const bodyY = Math.round(size * 0.45);
  const radius = Math.round(size * 0.08);

  drawRoundedRect(png, bodyX, bodyY, bodyWidth, bodyHeight, radius, bodyColor);

  const flapHeight = Math.round(size * 0.22);
  const flapY = bodyY - Math.round(size * 0.18);
  drawRoundedRect(png, bodyX, flapY, bodyWidth, flapHeight, Math.round(radius * 1.1), flapColor);

  const strapWidth = Math.round(size * 0.16);
  const strapHeight = Math.round(flapHeight * 0.72);
  const strapX = bodyX + bodyWidth - strapWidth - Math.round(size * 0.05);
  const strapY = flapY + Math.round(size * 0.04);
  drawRoundedRect(png, strapX, strapY, strapWidth, strapHeight, Math.round(radius * 0.6), bodyColor);

  const buttonRadius = Math.max(2, Math.round(size * 0.025));
  drawCircle(png, strapX + Math.round(strapWidth / 2), strapY + Math.round(strapHeight / 2), buttonRadius, accentColor);

  const coinRadius = Math.round(size * 0.08);
  const coinX = bodyX + Math.round(size * 0.16);
  const coinY = flapY - Math.round(size * 0.04);
  drawCircle(png, coinX, coinY, coinRadius, accentColor);
  drawCircle(png, coinX, coinY, Math.round(coinRadius * 0.65), hexToRgb('#fde047'));

  const stitchPadding = Math.round(size * 0.035);
  const stitchLength = Math.max(2, Math.round(size * 0.04));
  const stitchGap = Math.max(2, Math.round(size * 0.025));
  const stitchY = bodyY + Math.round(size * 0.08);
  const stitchEndX = bodyX + bodyWidth - stitchPadding;
  for (let x = bodyX + stitchPadding; x < stitchEndX; x += stitchLength + stitchGap) {
    for (let i = 0; i < stitchLength && x + i < stitchEndX; i += 1) {
      setPixel(png, x + i, stitchY, stitchingColor);
    }
  }

  return png;
}

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeIcon(size: number) {
  const png = createWalletIcon(size);
  const filePath = path.join(ICON_DIR, `icon-${size}.png`);
  const buffer = PNG.sync.write(png);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function main() {
  await ensureDirectory(ICON_DIR);
  for (const size of OUTPUT_SIZES) {
    const filePath = await writeIcon(size);
    console.log(`Generated wallet icon: ${path.relative(path.resolve(__dirname, '..'), filePath)}`);
  }
}

main().catch((error) => {
  console.error('Failed to generate wallet icons');
  console.error(error);
  process.exitCode = 1;
});
