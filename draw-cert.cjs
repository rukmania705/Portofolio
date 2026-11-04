const fs = require('fs');
const zlib = require('zlib');
const canvas = require('canvas');

function unfilterPng(compressed, width, height, bpp) {
  const data = zlib.inflateSync(compressed);
  const stride = width * bpp;
  const rawRow = 1 + stride;
  const out = Buffer.alloc(width * height * bpp);

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  for (let y = 0; y < height; y++) {
    const filter = data[y * rawRow];
    const srcOffset = y * rawRow + 1;
    const dstOffset = y * stride;
    const prevDstOffset = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const byte = data[srcOffset + x];
      const left = x >= bpp ? out[dstOffset + x - bpp] : 0;
      const up = y > 0 ? out[prevDstOffset + x] : 0;
      const upLeft = (y > 0 && x >= bpp) ? out[prevDstOffset + x - bpp] : 0;

      let val = 0;
      if (filter === 0) val = byte;
      else if (filter === 1) val = (byte + left) & 0xff;
      else if (filter === 2) val = (byte + up) & 0xff;
      else if (filter === 3) val = (byte + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) val = (byte + paeth(left, up, upLeft)) & 0xff;

      out[dstOffset + x] = val;
    }
  }
  return out;
}

function makeRgbaCanvas(rgbBuf, alphaBuf, width, height) {
  const c = canvas.createCanvas(width, height);
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const pixels = imgData.data;

  for (let i = 0; i < width * height; i++) {
    pixels[i * 4 + 0] = rgbBuf[i * 3 + 0];
    pixels[i * 4 + 1] = rgbBuf[i * 3 + 1];
    pixels[i * 4 + 2] = rgbBuf[i * 3 + 2];
    pixels[i * 4 + 3] = alphaBuf[i];
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}

async function renderFullCertificate() {
  const pdf = fs.readFileSync('assets/cert-toefl.pdf');
  const str = pdf.toString('binary');

  function getStream(objNum) {
    const m = str.match(new RegExp(objNum + ' 0 obj[\\s\\S]*?stream\\r?\\n([\\s\\S]*?)\\r?\\nendstream'));
    return Buffer.from(m[1], 'binary');
  }

  // 1. Extract Background Template (obj 9)
  const bgBuf = getStream(9);
  const bgImg = await canvas.loadImage(bgBuf);
  const width = bgImg.width; // 3508
  const height = bgImg.height; // 2482

  const c = canvas.createCanvas(width, height);
  const ctx = c.getContext('2d');

  // Draw background template
  ctx.drawImage(bgImg, 0, 0, width, height);

  // PDF page dimensions
  const PDF_W = 841.89;
  const PDF_H = 595.66;
  const scale = width / PDF_W; // ~4.1668

  function toCanvas(x, y) {
    return {
      x: x * scale,
      y: (PDF_H - y) * scale
    };
  }

  // 2. Extract and Draw Signature (obj 10 + 11)
  const sigRgb = unfilterPng(getStream(10), 1600, 1052, 3);
  const sigAlpha = unfilterPng(getStream(11), 1600, 1052, 1);
  const sigCanvas = makeRgbaCanvas(sigRgb, sigAlpha, 1600, 1052);

  const sigPos = toCanvas(629.29, 95.92 + 102.51);
  const sigW = 155.91 * scale;
  const sigH = 102.51 * scale;

  // 3. Extract and Draw Stamp (obj 12 + 13)
  const stampRgb = unfilterPng(getStream(12), 1820, 2086, 3);
  const stampAlpha = unfilterPng(getStream(13), 1820, 2086, 1);
  const stampCanvas = makeRgbaCanvas(stampRgb, stampAlpha, 1820, 2086);

  const stampPos = toCanvas(555.59, 98.89 + 113.71);
  const stampW = 99.21 * scale;
  const stampH = 113.71 * scale;

  // Draw signature and stamp with natural alpha blending
  ctx.drawImage(sigCanvas, sigPos.x, sigPos.y, sigW, sigH);
  ctx.drawImage(stampCanvas, stampPos.x, stampPos.y, stampW, stampH);

  // 4. Draw Typography
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'alphabetic';

  // Centered headings
  ctx.textAlign = 'center';
  const centerCenterX = (PDF_W / 2) * scale;

  const headings = [
    { font: 'F1', size: 12, y: 370.58, text: 'This is to certify that' },
    { font: 'F2', size: 20, y: 339.83, text: 'RUKMANIA' },
    { font: 'F1', size: 12, y: 313.88, text: 'Has Completed' },
    { font: 'F2', size: 20, y: 283.14, text: 'TOEFL Prediction Test' },
    { font: 'F1', size: 12, y: 260.03, text: 'With Grade of:' }
  ];

  headings.forEach(item => {
    const pxSize = Math.round(item.size * scale);
    if (item.font === 'F1') {
      ctx.font = `${pxSize}px "Times New Roman", Times, Georgia, serif`;
    } else if (item.font === 'F2') {
      ctx.font = `bold ${pxSize}px "Times New Roman", Times, Georgia, serif`;
    }
    const pt = toCanvas(0, item.y);
    ctx.fillText(item.text, centerCenterX, pt.y);
  });

  // Left-aligned score table and footer signature
  ctx.textAlign = 'left';

  const leftTexts = [
    { font: 'F2', size: 14, x: 286.30, y: 236.75, text: 'Listening' },
    { font: 'F2', size: 14, x: 522.08, y: 236.75, text: ':' },
    { font: 'F2', size: 14, x: 541.42, y: 236.75, text: '57' },

    { font: 'F2', size: 14, x: 286.30, y: 208.40, text: 'Structure and Written Expression' },
    { font: 'F2', size: 14, x: 522.08, y: 208.40, text: ':' },
    { font: 'F2', size: 14, x: 541.42, y: 208.40, text: '53' },

    { font: 'F2', size: 14, x: 286.30, y: 180.06, text: 'Reading' },
    { font: 'F2', size: 14, x: 522.08, y: 180.06, text: ':' },
    { font: 'F2', size: 14, x: 541.42, y: 180.06, text: '57' },

    { font: 'F2', size: 16, x: 286.30, y: 151.11, text: 'TOTAL' },
    { font: 'F2', size: 16, x: 521.75, y: 151.11, text: ':' },
    { font: 'F2', size: 16, x: 541.42, y: 151.11, text: '557' },

    { font: 'F3', size: 14, x: 599.74, y: 215.49, text: 'Jakarta, August 28th 2026' },
    { font: 'F3', size: 14, x: 597.97, y: 201.32, text: 'Kepala Lembaga Bahasa' },
    { font: 'F2', size: 14, x: 600.58, y: 99.27, text: 'Yanti Rosalinah, SS, M.Pd' }
  ];

  leftTexts.forEach(item => {
    const pxSize = Math.round(item.size * scale);
    if (item.font === 'F1') {
      ctx.font = `${pxSize}px "Times New Roman", Times, Georgia, serif`;
    } else if (item.font === 'F2') {
      ctx.font = `bold ${pxSize}px "Times New Roman", Times, Georgia, serif`;
    } else if (item.font === 'F3') {
      ctx.font = `bold italic ${pxSize}px "Times New Roman", Times, Georgia, serif`;
    }
    const pt = toCanvas(item.x, item.y);
    ctx.fillText(item.text, pt.x, pt.y);
  });

  const outBuf = c.toBuffer('image/jpeg', { quality: 0.96 });
  fs.writeFileSync('assets/cert-toefl.jpg', outBuf);
  console.log('SUCCESS! Rendered full authentic assets/cert-toefl.jpg, size:', outBuf.length);
}

renderFullCertificate().catch(console.error);
