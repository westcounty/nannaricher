/**
 * Generate 256x256 WebP thumbnails for all cell images.
 *
 * Source dirs:
 *   client/public/art/cells/*.png, *.jpg   -> client/public/art/thumb/*.webp
 *   client/public/art/cells/line/*.png      -> client/public/art/thumb/line/*.webp
 *
 * Skips files whose thumbnail already exists and is newer than the source.
 */

import sharp from 'sharp';
import { readdir, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CELLS_DIR = path.join(ROOT, 'client/public/art/cells');
const LINE_DIR = path.join(CELLS_DIR, 'line');
const THUMB_DIR = path.join(ROOT, 'client/public/art/thumb');
const THUMB_LINE_DIR = path.join(THUMB_DIR, 'line');

const SIZE = 256;
const QUALITY = 80;

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function shouldRegenerate(srcPath, destPath) {
  try {
    const srcStat = await stat(srcPath);
    const destStat = await stat(destPath);
    // Regenerate if source is newer than thumbnail
    return srcStat.mtimeMs > destStat.mtimeMs;
  } catch {
    // Destination doesn't exist
    return true;
  }
}

async function generateThumbnail(srcPath, destPath) {
  const needsRegen = await shouldRegenerate(srcPath, destPath);
  if (!needsRegen) {
    return false; // skipped
  }

  await sharp(srcPath)
    .resize(SIZE, SIZE, { fit: 'cover', position: 'center' })
    .webp({ quality: QUALITY })
    .toFile(destPath);

  return true; // generated
}

async function processDirectory(srcDir, destDir, extensions = ['.png', '.jpg', '.jpeg']) {
  await ensureDir(destDir);

  let entries;
  try {
    entries = await readdir(srcDir);
  } catch {
    console.log(`  Directory not found: ${srcDir}`);
    return { generated: 0, skipped: 0 };
  }

  let generated = 0;
  let skipped = 0;

  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (!extensions.includes(ext)) continue;

    // Skip directories
    const srcPath = path.join(srcDir, entry);
    const srcInfo = await stat(srcPath);
    if (srcInfo.isDirectory()) continue;

    const baseName = path.basename(entry, ext);
    const destPath = path.join(destDir, `${baseName}.webp`);

    const didGenerate = await generateThumbnail(srcPath, destPath);
    if (didGenerate) {
      generated++;
      console.log(`  [OK] ${entry} -> ${baseName}.webp`);
    } else {
      skipped++;
    }
  }

  return { generated, skipped };
}

async function main() {
  console.log('=== Generating 256x256 WebP Thumbnails ===\n');

  console.log('Processing main cell images...');
  const mainResult = await processDirectory(CELLS_DIR, THUMB_DIR);
  console.log(`  Main cells: ${mainResult.generated} generated, ${mainResult.skipped} skipped\n`);

  console.log('Processing branch line images...');
  const lineResult = await processDirectory(LINE_DIR, THUMB_LINE_DIR);
  console.log(`  Line cells: ${lineResult.generated} generated, ${lineResult.skipped} skipped\n`);

  const total = mainResult.generated + lineResult.generated;
  const totalSkipped = mainResult.skipped + lineResult.skipped;
  console.log(`=== Done: ${total} thumbnails generated, ${totalSkipped} skipped ===`);
}

main().catch(err => {
  console.error('Thumbnail generation failed:', err);
  process.exit(1);
});
