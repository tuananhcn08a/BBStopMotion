#!/usr/bin/env node
/**
 * copy-ffmpeg.mjs — Sao chép ffmpeg-core binaries từ node_modules vào public/ffmpeg/.
 *
 * Chạy tự động qua npm postinstall. Chạy thủ công: node scripts/copy-ffmpeg.mjs
 *
 * Lý do không commit binary:
 *   - ffmpeg-core.wasm ~31MB, ffmpeg-core.js ~112KB — quá lớn cho git.
 *   - File đã có sẵn trong @ffmpeg/core sau khi npm install.
 *   - Gitignored: public/ffmpeg/ffmpeg-core.wasm, public/ffmpeg/ffmpeg-core.js
 */

import { copyFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");

// Nguồn: @ffmpeg/core@0.12.6 ESM dist (đơn luồng, không cần COOP/COEP)
const srcDir = join(webRoot, "node_modules", "@ffmpeg", "core", "dist", "esm");
const destDir = join(webRoot, "public", "ffmpeg");

const files = ["ffmpeg-core.wasm", "ffmpeg-core.js"];

mkdirSync(destDir, { recursive: true });

let allOk = true;
for (const file of files) {
  const src = join(srcDir, file);
  const dest = join(destDir, file);

  if (!existsSync(src)) {
    console.error(`[copy-ffmpeg] MISSING: ${src}`);
    console.error("[copy-ffmpeg] Chạy `npm install` trước rồi thử lại.");
    allOk = false;
    continue;
  }

  copyFileSync(src, dest);
  console.log(`[copy-ffmpeg] Copied: ${file} → public/ffmpeg/${file}`);
}

if (!allOk) {
  process.exit(1);
}

console.log("[copy-ffmpeg] Done. public/ffmpeg/ sẵn sàng cho dev/build.");
