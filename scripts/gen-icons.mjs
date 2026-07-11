// ============================================================================
//  Icon-Generator — erzeugt PNG-App-Icons ohne externe Bibliotheken.
//  Rendert eine Mondsichel mit Sternen auf nächtlichem Verlauf (Anti-Aliasing).
//  Aufruf:  node scripts/gen-icons.mjs
// ============================================================================
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(OUT, { recursive: true });

// ---- CRC32 ---------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  // scanlines mit Filter-Byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- Zeichnen -------------------------------------------------------------
function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function render(size, { moonScale = 0.30 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const top = [0x3a, 0x2f, 0x6b];      // Verlauf oben (indigo)
  const bot = [0x16, 0x12, 0x2e];      // Verlauf unten (dunkel)
  const moon = [0xff, 0xe0, 0x8a];     // warmes Mondgelb
  const star = [0xf2, 0xf0, 0xfb];

  const cx = size * 0.50, cy = size * 0.46;
  const R = size * moonScale;               // äußerer Mondradius
  const R2 = R * 0.86;                       // ausgeschnittener Kreis
  const ox = cx + R * 0.42, oy = cy - R * 0.30; // Versatz des Ausschnitts
  const aa = size * 0.010;                   // Kantenweichheit

  const stars = [
    { x: size * 0.72, y: size * 0.28, r: size * 0.022 },
    { x: size * 0.80, y: size * 0.44, r: size * 0.014 },
    { x: size * 0.66, y: size * 0.50, r: size * 0.011 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let col = mix(top, bot, y / size);     // Hintergrundverlauf

      // Mondsichel: innerhalb großem Kreis UND außerhalb Ausschnitt-Kreis
      const dBig = Math.hypot(x - cx, y - cy) - R;
      const dCut = Math.hypot(x - ox, y - oy) - R2;
      const inBig = 1 - smoothstep(-aa, aa, dBig);
      const inCut = 1 - smoothstep(-aa, aa, dCut);
      const moonA = inBig * (1 - inCut);
      if (moonA > 0) col = mix(col, moon, moonA);

      // Sterne
      for (const s of stars) {
        const d = Math.hypot(x - s.x, y - s.y) - s.r;
        const a = 1 - smoothstep(-aa, aa, d);
        if (a > 0) col = mix(col, star, a);
      }

      buf[i] = Math.round(col[0]);
      buf[i + 1] = Math.round(col[1]);
      buf[i + 2] = Math.round(col[2]);
      buf[i + 3] = 255;
    }
  }
  return encodePNG(size, size, buf);
}

// ---- Ausgabe --------------------------------------------------------------
const targets = [
  { file: 'icon-192.png', size: 192, opts: { moonScale: 0.30 } },
  { file: 'icon-512.png', size: 512, opts: { moonScale: 0.30 } },
  { file: 'icon-maskable-512.png', size: 512, opts: { moonScale: 0.24 } }, // Safe-Zone
  { file: 'favicon.png', size: 64, opts: { moonScale: 0.32 } },
];
for (const t of targets) {
  writeFileSync(join(OUT, t.file), render(t.size, t.opts));
  console.log('erstellt:', t.file, `(${t.size}×${t.size})`);
}
