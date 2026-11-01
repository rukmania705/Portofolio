/**
 * extract.cjs - Ekstraktor Gambar JPEG dari File PDF (CommonJS Murni)
 * 
 * Fitur:
 * - Menggunakan modul bawaan Node.js (fs, path) tanpa dependensi eksternal (npm).
 * - Parser JPEG berstandar ITU-T T.81 (melewati penanda thumbnail EXIF sehingga gambar tidak terpotong).
 * - Inspeksi stream PDF (/DCTDecode) untuk ekstraksi byte yang presisi dan utuh.
 * - Deteksi otomatis file PDF di direktori kerja jika argumen tidak diberikan.
 * - Membaca dimensi gambar (lebar x tinggi) dan ukuran file.
 * - Dapat dijalankan langsung via CLI atau di-require sebagai modul CommonJS.
 * 
 * Penggunaan CLI:
 *   node extract.cjs [file_pdf] [folder_output] [min_size_kb]
 * Contoh:
 *   node extract.cjs
 *   node extract.cjs CV_ATS_RUKMANIA.pdf assets 5
 */

const fs = require('fs');
const path = require('path');

/**
 * Menghitung panjang sebenarnya dari sebuah JPEG di dalam buffer biner.
 * Mampu membaca struktur segment marker (APPn, DQT, SOF, DHT, SOS)
 * dan melewati data entropy (termasuk thumbnail di dalam EXIF) sampai EOI (0xFF 0xD9) utama.
 * 
 * @param {Buffer} buf - Buffer file PDF
 * @param {number} startOffset - Titik awal marker SOI (0xFF 0xD8)
 * @returns {number} Panjang byte JPEG, atau -1 jika tidak valid
 */
function parseJpegLength(buf, startOffset) {
  if (startOffset + 2 > buf.length) return -1;
  if (buf[startOffset] !== 0xFF || buf[startOffset + 1] !== 0xD8) return -1;

  let i = startOffset + 2;

  while (i < buf.length - 1) {
    if (buf[i] !== 0xFF) {
      i++;
      continue;
    }

    // Lewati padding 0xFF beruntun
    while (i < buf.length && buf[i] === 0xFF) {
      i++;
    }
    if (i >= buf.length) break;

    const marker = buf[i];
    i++;

    // End Of Image (EOI)
    if (marker === 0xD9) {
      return i - startOffset;
    }

    // Start of Scan (SOS) - Mulai aliran data terkompresi
    if (marker === 0xDA) {
      if (i + 2 > buf.length) break;
      const sosLen = buf.readUInt16BE(i);
      i += sosLen;

      // Telusuri data entropy
      while (i < buf.length - 1) {
        if (buf[i] === 0xFF) {
          const next = buf[i + 1];

          // 0xFF 0xD9 menandai akhir dari stream gambar utama
          if (next === 0xD9) {
            return (i + 2) - startOffset;
          }

          // Byte stuffing (0xFF 0x00) atau Restart Markers (RST0..RST7: 0xD0..0xD7)
          if (next === 0x00 || (next >= 0xD0 && next <= 0xD7)) {
            i += 2;
            continue;
          }

          // Jika ada scan lanjutan (Progressive JPEG), kembali ke loop marker
          if (
            next === 0xC4 ||
            next === 0xDA ||
            (next >= 0xC0 && next <= 0xCF && next !== 0xC4 && next !== 0xC8 && next !== 0xCC)
          ) {
            i++;
            break;
          }
        }
        i++;
      }
      continue;
    }

    // Marker tanpa panjang (misal TEM atau RST)
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD8)) {
      continue;
    }

    // Marker dengan field panjang 16-bit
    if (i + 2 > buf.length) break;
    const markerLen = buf.readUInt16BE(i);
    i += markerLen;
  }

  return -1;
}

/**
 * Membaca resolusi (lebar x tinggi) dan jumlah channel warna dari buffer JPEG.
 * Mencari marker SOF (Start of Frame) dan mengambil resolusi terbesar (jika ada thumbnail).
 * 
 * @param {Buffer} imgBuf - Buffer gambar JPEG
 * @returns {{ width: number, height: number, channels: number }}
 */
function getJpegDimensions(imgBuf) {
  let maxWidth = 0;
  let maxHeight = 0;
  let channels = 3;

  for (let i = 0; i < imgBuf.length - 9; i++) {
    // Deteksi marker SOF0 (Baseline), SOF1 (Extended), SOF2 (Progressive)
    if (imgBuf[i] === 0xFF && (imgBuf[i + 1] === 0xC0 || imgBuf[i + 1] === 0xC1 || imgBuf[i + 1] === 0xC2)) {
      const h = imgBuf.readUInt16BE(i + 5);
      const w = imgBuf.readUInt16BE(i + 7);
      const ch = imgBuf[i + 9];

      if (w * h > maxWidth * maxHeight) {
        maxWidth = w;
        maxHeight = h;
        channels = ch;
      }
    }
  }

  return { width: maxWidth, height: maxHeight, channels };
}

/**
 * Format ukuran byte ke string KB / MB yang rapi
 * @param {number} bytes 
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Mengekstrak seluruh gambar JPEG dari buffer file PDF
 * 
 * @param {string} pdfPath - Path file PDF target
 * @param {string} outputDir - Folder penyimpanan gambar
 * @param {object} [options] - Opsi konfigurasi
 * @param {number} [options.minSizeKB=5] - Ukuran minimum file (KB) untuk menyaring ikon/thumbnail kecil
 * @param {string} [options.prefix='extracted_'] - Awalan nama file yang disimpan
 * @returns {{ count: number, images: Array<{ path: string, size: number, width: number, height: number }> }}
 */
function extractJpegsFromPdf(pdfPath, outputDir, options = {}) {
  const minSizeKB = options.minSizeKB ?? 5;
  const prefix = options.prefix ?? 'extracted_';
  const minSizeBytes = minSizeKB * 1024;

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`File PDF tidak ditemukan: ${pdfPath}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const buf = fs.readFileSync(pdfPath);
  const foundRanges = [];

  // Strategi 1: Cari objek stream /DCTDecode di struktur objek PDF
  let streamMatchIdx = 0;
  while ((streamMatchIdx = buf.indexOf('DCTDecode', streamMatchIdx)) !== -1) {
    const streamIdx = buf.indexOf('stream', streamMatchIdx);
    if (streamIdx !== -1 && streamIdx - streamMatchIdx < 2500) {
      let dataStart = streamIdx + 6;
      if (buf[dataStart] === 0x0D && buf[dataStart + 1] === 0x0A) {
        dataStart += 2;
      } else if (buf[dataStart] === 0x0A || buf[dataStart] === 0x0D) {
        dataStart += 1;
      }

      // Pastikan data stream diawali oleh header JPEG (FF D8)
      if (buf[dataStart] === 0xFF && buf[dataStart + 1] === 0xD8) {
        const endStreamIdx = buf.indexOf('endstream', dataStart);
        if (endStreamIdx !== -1) {
          let dataEnd = endStreamIdx;
          while (
            dataEnd > dataStart &&
            (buf[dataEnd - 1] === 0x0A || buf[dataEnd - 1] === 0x0D || buf[dataEnd - 1] === 0x20)
          ) {
            dataEnd--;
          }

          // Validasi EOI (0xFF 0xD9)
          if (buf[dataEnd - 2] === 0xFF && buf[dataEnd - 1] === 0xD9) {
            foundRanges.push({ start: dataStart, end: dataEnd });
          } else {
            // Jika ada whitespace tersembunyi, cari EOI terakhir sebelum endstream
            const lastEoi = buf.lastIndexOf(Buffer.from([0xFF, 0xD9]), endStreamIdx);
            if (lastEoi !== -1 && lastEoi > dataStart) {
              foundRanges.push({ start: dataStart, end: lastEoi + 2 });
            }
          }
        }
      }
    }
    streamMatchIdx += 9;
  }

  // Strategi 2: Binary scan marker (FF D8 FF) dengan ITU-T T.81 parser (sebagai pelengkap/fallback)
  let scanIdx = 0;
  const startMarker = Buffer.from([0xFF, 0xD8, 0xFF]);
  while ((scanIdx = buf.indexOf(startMarker, scanIdx)) !== -1) {
    // Periksa apakah offset ini sudah tercakup di Strategi 1
    const alreadyFound = foundRanges.some(r => scanIdx >= r.start && scanIdx < r.end);
    if (!alreadyFound) {
      const len = parseJpegLength(buf, scanIdx);
      if (len > 0) {
        foundRanges.push({ start: scanIdx, end: scanIdx + len });
        scanIdx += len;
        continue;
      }
    }
    scanIdx += 3;
  }

  // Urutkan berdasarkan posisi offset di dalam file PDF
  foundRanges.sort((a, b) => a.start - b.start);

  // Filter overlapping & duplicate ranges
  const uniqueRanges = [];
  for (const r of foundRanges) {
    const isOverlapping = uniqueRanges.some(
      u => (r.start >= u.start && r.start < u.end) || (r.end > u.start && r.end <= u.end)
    );
    if (!isOverlapping) {
      uniqueRanges.push(r);
    }
  }

  const results = [];
  let fileIndex = 1;

  for (const range of uniqueRanges) {
    const imgBuf = buf.subarray(range.start, range.end);
    if (imgBuf.length < minSizeBytes) {
      continue;
    }

    const dims = getJpegDimensions(imgBuf);
    const fileName = `${prefix}${String(fileIndex).padStart(2, '0')}.jpg`;
    const outPath = path.join(outputDir, fileName);

    fs.writeFileSync(outPath, imgBuf);

    results.push({
      fileName,
      path: outPath,
      size: imgBuf.length,
      width: dims.width,
      height: dims.height,
      channels: dims.channels
    });

    fileIndex++;
  }

  return {
    count: results.length,
    outputDir,
    images: results
  };
}

/**
 * Menemukan file PDF default di direktori jika tidak dispesifikasikan
 * @param {string} cwd 
 * @returns {string|null}
 */
function findDefaultPdf(cwd) {
  // Prioritas 1: File spesifik CV / portofolio yang ada di proyek
  const preferred = ['CV_ATS_RUKMANIA.pdf', 'cv.pdf', 'portfolio.pdf', 'dokumen.pdf'];
  for (const name of preferred) {
    const p = path.join(cwd, name);
    if (fs.existsSync(p)) return p;
  }

  // Prioritas 2: Cari file .pdf pertama di direktori
  const files = fs.readdirSync(cwd);
  const pdfFile = files.find(f => f.toLowerCase().endsWith('.pdf'));
  return pdfFile ? path.join(cwd, pdfFile) : null;
}

// ==========================================
// CLI Execution Handler
// ==========================================
if (require.main === module) {
  const args = process.argv.slice(2);

  // Ambil argumen CLI atau gunakan nilai default cerdas
  let inputPdf = args[0];
  const outDir = args[1] ? path.resolve(args[1]) : path.join(__dirname, 'assets');
  const minSizeKB = args[2] ? parseFloat(args[2]) : 5;

  if (!inputPdf) {
    inputPdf = findDefaultPdf(__dirname);
  } else {
    inputPdf = path.resolve(inputPdf);
  }

  console.log('='.repeat(60));
  console.log('   PDF JPEG Image Extractor (CommonJS Pure Node.js)');
  console.log('='.repeat(60));

  if (!inputPdf || !fs.existsSync(inputPdf)) {
    console.error('\n[Error] File PDF target tidak ditemukan!');
    console.log('\nPenggunaan:');
    console.log('  node extract.cjs [nama_file.pdf] [folder_output] [min_size_kb]');
    console.log('\nContoh:');
    console.log('  node extract.cjs CV_ATS_RUKMANIA.pdf assets 5\n');
    process.exit(1);
  }

  console.log(`[Target PDF]    : ${path.basename(inputPdf)}`);
  console.log(`[Folder Output] : ${outDir}`);
  console.log(`[Filter Minimal]: > ${minSizeKB} KB`);
  console.log('-'.repeat(60));

  const startTime = Date.now();

  try {
    const result = extractJpegsFromPdf(inputPdf, outDir, { minSizeKB });

    if (result.count === 0) {
      console.log('\nTidak ditemukan gambar JPEG yang memenuhi kriteria filter.');
    } else {
      console.log('\nGambar yang berhasil diekstrak:');
      result.images.forEach((img, idx) => {
        const dimStr = img.width && img.height ? `${img.width}x${img.height}px` : 'Resolusi tidak terdeteksi';
        const colorStr = img.channels === 3 ? 'RGB' : img.channels === 1 ? 'Grayscale' : `${img.channels}ch`;
        console.log(
          `  [${idx + 1}] ${img.fileName.padEnd(16)} | ${formatBytes(img.size).padStart(9)} | ${dimStr.padEnd(14)} | ${colorStr}`
        );
      });

      console.log('-'.repeat(60));
      console.log(
        `Selesai dalam ${(Date.now() - startTime)}ms! Berhasil mengekstrak ${result.count} gambar ke folder "${path.basename(outDir)}".`
      );
    }
  } catch (err) {
    console.error('\n[Terjadi Kesalahan]:', err.message);
    process.exit(1);
  }
}

// Ekspor untuk penggunaan modular jika di-import di file lain
module.exports = {
  extractJpegsFromPdf,
  parseJpegLength,
  getJpegDimensions,
  formatBytes
};