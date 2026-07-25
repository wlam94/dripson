/**
 * Batch upload HEIC clothing photos → /api/catalog
 * Usage: node scripts/batch-upload.mjs <folder>
 */

import { readFileSync, readdirSync } from "fs";
import { join, extname, basename } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const heicConvert = require("heic-convert");

const BASE_URL = "http://localhost:3000";
const FOLDER = process.argv[2] || "C:/Users/wlam9/OneDrive/Desktop/Outfit";

const files = readdirSync(FOLDER)
  .filter(f => /\.(heic|jpg|jpeg|png|webp)$/i.test(f))
  .map(f => join(FOLDER, f));

console.log(`Found ${files.length} images in ${FOLDER}\n`);

let ok = 0, fail = 0;

for (const filePath of files) {
  const name = basename(filePath);
  process.stdout.write(`  ${name} → `);

  try {
    let buffer;
    let mimeType = "image/jpeg";

    if (extname(filePath).toLowerCase() === ".heic") {
      const heicBuf = readFileSync(filePath);
      const jpegBuf = await heicConvert({ buffer: heicBuf, format: "JPEG", quality: 0.82 });
      buffer = Buffer.from(jpegBuf);
      mimeType = "image/jpeg";
    } else {
      buffer = readFileSync(filePath);
      const ext = extname(filePath).toLowerCase();
      if (ext === ".png") mimeType = "image/png";
      else if (ext === ".webp") mimeType = "image/webp";
    }

    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: mimeType }), name.replace(/\.heic$/i, ".jpg"));
    formData.append("category", "other"); // Claude will auto-detect the real category

    const res = await fetch(`${BASE_URL}/api/catalog`, { method: "POST", body: formData });
    const data = await res.json();

    if (res.ok && data.item) {
      const item = data.item;
      console.log(`✓ ${item.category} · ${item.subcategory || ""} · ${item.color} · formality ${item.formality_level}/5`);
      ok++;
    } else {
      console.log(`✗ ${data.error || "unknown error"}`);
      fail++;
    }
  } catch (e) {
    console.log(`✗ ${e.message}`);
    fail++;
  }
}

console.log(`\n── Done ─────────────────────────────`);
console.log(`   ✓ ${ok} uploaded    ✗ ${fail} failed`);
console.log(`   View wardrobe: http://localhost:3000/wardrobe`);
