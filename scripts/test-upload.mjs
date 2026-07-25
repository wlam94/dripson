/**
 * Test upload script — creates synthetic clothing images and uploads via /api/catalog
 * Usage: node scripts/test-upload.mjs
 */

import { createDeflate } from "zlib";
import { promisify } from "util";
import { pipeline } from "stream";
import { Writable } from "stream";

const BASE_URL = "http://localhost:3000";

// ── Minimal PNG generator (no external deps) ─────────────────────────────────

function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  const payload = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

async function makePNG(w, h, r, g, b) {
  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines: filter byte (0) + RGB per pixel
  const raw = Buffer.allocUnsafe(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter none
    for (let x = 0; x < w; x++) {
      const off = y * (1 + w * 3) + 1 + x * 3;
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b;
    }
  }

  // Compress with zlib
  const deflate = createDeflate({ level: 6 });
  const chunks = [];
  deflate.on("data", d => chunks.push(d));
  const done = new Promise((res, rej) => { deflate.on("end", res); deflate.on("error", rej); });
  deflate.end(raw);
  await done;
  const idat = Buffer.concat(chunks);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Test items ────────────────────────────────────────────────────────────────

const ITEMS = [
  { name: "white-oxford-shirt.png",   category: "shirt",     r: 245, g: 243, b: 238, label: "White Oxford Shirt" },
  { name: "navy-chino-pants.png",     category: "pants",     r: 30,  g: 45,  b: 80,  label: "Navy Chino Pants"   },
  { name: "white-sneakers.png",       category: "shoes",     r: 250, g: 250, b: 250, label: "White Sneakers"     },
  { name: "charcoal-blazer.png",      category: "outerwear", r: 55,  g: 55,  b: 60,  label: "Charcoal Blazer"   },
];

// ── Upload ────────────────────────────────────────────────────────────────────

async function uploadItem({ name, category, r, g, b, label }) {
  const png = await makePNG(200, 200, r, g, b);

  const formData = new FormData();
  formData.append("file", new Blob([png], { type: "image/png" }), name);
  formData.append("category", category);

  try {
    const res = await fetch(`${BASE_URL}/api/catalog`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      console.log(`✓  ${label}`);
      console.log(`   subcategory: ${data.item?.subcategory}`);
      console.log(`   color:       ${data.item?.color}`);
      console.log(`   style:       ${data.item?.style}`);
      console.log(`   formality:   ${data.item?.formality_level}/5`);
      console.log(`   occasions:   ${data.item?.occasions?.join(", ")}`);
    } else {
      console.log(`✗  ${label} — ${data.error}`);
    }
  } catch (e) {
    console.log(`✗  ${label} — ${e.message}`);
  }
}

(async () => {
  console.log("Uploading test clothing items to Dripson...\n");
  for (const item of ITEMS) {
    await uploadItem(item);
    console.log();
  }
  console.log("Done. Visit http://localhost:3000/wardrobe to see results.");
})();
