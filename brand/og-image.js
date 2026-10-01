// Usage : npm install --no-save @resvg/resvg-js@2 && node brand/og-image.js public/og-image.png
// Image d'aperçu (Open Graph) de Podsal : 1200 × 630, utilisée par LinkedIn, WhatsApp, X…
const fs = require('fs');
const { Resvg } = require('@resvg/resvg-js');

const out = process.argv[2];
const GOLD = '#e2c485';
const CREAM = '#f5f1ec';

function star(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 8) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

// Une couverture (viewBox 100) placée en (x, y), taille s, légèrement inclinée.
function cover(x, y, s, rot, body, shadow = true) {
  return `<g transform="translate(${x} ${y}) rotate(${rot} ${s / 2} ${s / 2})">
    ${shadow ? `<rect x="6" y="14" width="${s}" height="${s}" rx="${s * 0.12}" fill="#000" opacity="0.35" filter="url(#blur)"/>` : ''}
    <svg width="${s}" height="${s}" viewBox="0 0 100 100"><clipPath id="c${x}${y}"><rect width="100" height="100" rx="12"/></clipPath>
      <g clip-path="url(#c${x}${y})">${body}<rect width="100" height="100" fill="url(#gloss)"/></g>
      <rect x="0.5" y="0.5" width="99" height="99" rx="12" fill="none" stroke="#fff" stroke-opacity="0.08"/>
    </svg></g>`;
}

const islamic = `<rect width="100" height="100" fill="#1f5f46"/>
  <g fill="none" stroke="${GOLD}" stroke-width="0.6" opacity="0.35">${[0, 25, 50, 75, 100].flatMap((a) => [0, 25, 50, 75, 100].map((b) => `<polygon points="${star(a, b, 7, 5)}"/>`)).join('')}</g>
  <path d="M22 90 V52 C22 34 36 22 50 11 C64 22 78 34 78 52 V90" fill="#113a2b" fill-opacity="0.7" stroke="${GOLD}" stroke-width="2.4"/>
  <polygon points="${star(50, 31, 5, 3.5)}" fill="${GOLD}"/>
  <g stroke="${GOLD}" stroke-width="2.4" stroke-linecap="round">${[[38, 12], [44, 20], [50, 28], [56, 20], [62, 12]].map(([x, h]) => `<line x1="${x}" y1="${64 - h / 2}" x2="${x}" y2="${64 + h / 2}"/>`).join('')}</g>`;
const quran = `<rect width="100" height="100" fill="#1a3030"/>
  <path d="M22 90 V52 C22 34 36 22 50 11 C64 22 78 34 78 52 V90" fill="#132626" stroke="${GOLD}" stroke-width="2.4"/>
  <polygon points="${star(50, 58, 13, 9.5)}" fill="${GOLD}"/><polygon points="${star(50, 58, 7, 5)}" fill="#1a3030"/>`;
const bands = `<rect width="100" height="100" fill="#b85a14"/><g transform="rotate(-25 50 50)">
  <rect x="-20" y="-40" width="16" height="180" fill="#e08a2e"/><rect x="4" y="-40" width="12" height="180" fill="#f4c26b"/>
  <rect x="24" y="-40" width="18" height="180" fill="#6fa4d8"/><rect x="50" y="-40" width="14" height="180" fill="#e08a2e"/><rect x="72" y="-40" width="20" height="180" fill="#8c3c0c"/></g>`;
const mountains = `<rect width="100" height="100" fill="#1e3a8a"/><circle cx="78" cy="22" r="10" fill="#f4c26b"/>
  <polygon points="-10,100 40,30 100,100" fill="#3b63c4"/><polygon points="35,100 78,48 110,100" fill="#152a66"/><polygon points="33,39 40,30 47,39" fill="#dbe6fb"/>`;
const bubbles = `<rect width="100" height="100" fill="#a3242f"/><circle cx="78" cy="24" r="34" fill="#d9475a"/>
  <circle cx="18" cy="86" r="28" fill="#6e1220"/><circle cx="48" cy="54" r="14" fill="#f7b3bd"/><circle cx="82" cy="82" r="6" fill="#7fd1c3"/>`;
const rings = `<rect width="100" height="100" fill="#166534"/>${[46, 34, 22, 11].map((r, i) => `<circle cx="38" cy="58" r="${r}" fill="${['#0d4423', '#2f8a4c', '#a7e3b5', '#f2c46d'][i]}"/>`).join('')}`;
const waves = `<rect width="100" height="100" fill="#0f5f73"/><circle cx="30" cy="26" r="13" fill="#d8f1f5"/>
  <path d="M0 58 Q25 48 50 58 T100 58 V100 H0Z" fill="#2a8ca3"/><path d="M0 72 Q25 82 50 72 T100 72 V100 H0Z" fill="#0a4250"/><path d="M0 86 Q25 76 50 86 T100 86 V100 H0Z" fill="#e7a35a"/>`;

const mark = `<rect width="512" height="512" rx="112" fill="#2f4f4f"/><g transform="translate(97.28 97.28) scale(3.174)"><path d="M22 88 V50 C22 33 36 22 50 12 C64 22 78 33 78 50 V88" fill="none" stroke="${CREAM}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><g stroke="${CREAM}" stroke-width="5" stroke-linecap="round"><line x1="34" y1="54" x2="34" y2="70"/><line x1="42" y1="47" x2="42" y2="77"/><line x1="50" y1="40" x2="50" y2="84"/><line x1="58" y1="47" x2="58" y2="77"/><line x1="66" y1="54" x2="66" y2="70"/></g></g>`;

const pill = (x, y, w, label) => `<g transform="translate(${x} ${y})"><rect width="${w}" height="40" rx="20" fill="#ffffff" fill-opacity="0.07" stroke="#ffffff" stroke-opacity="0.12"/>
  <circle cx="22" cy="20" r="5" fill="#6cc4b4"/><text x="36" y="26" font-family="Segoe UI" font-size="17" font-weight="600" fill="#dfe8e6">${label}</text></g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
  <radialGradient id="bg" cx="25%" cy="20%" r="95%"><stop offset="0" stop-color="#1c4741"/><stop offset="0.55" stop-color="#0f1d1c"/><stop offset="1" stop-color="#080c0c"/></radialGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#6cc4b4" stop-opacity="0.28"/><stop offset="1" stop-color="#6cc4b4" stop-opacity="0"/></radialGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <pattern id="stars" width="72" height="72" patternUnits="userSpaceOnUse"><polygon points="${star(36, 36, 13, 9)}" fill="none" stroke="${GOLD}" stroke-width="1" opacity="0.08"/></pattern>
  <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="12"/></filter>
</defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<rect width="1200" height="630" fill="url(#stars)"/>
<circle cx="900" cy="315" r="330" fill="url(#glow)"/>

<g transform="translate(80 92)">
  <svg width="64" height="64" viewBox="0 0 512 512">${mark}</svg>
  <text x="84" y="46" font-family="Segoe UI" font-size="40" font-weight="700" fill="${CREAM}">Podsal</text>
</g>
<text x="80" y="250" font-family="Segoe UI" font-size="60" font-weight="800" fill="#ffffff" letter-spacing="-1">Podcasts, Coran</text>
<text x="80" y="322" font-family="Segoe UI" font-size="60" font-weight="800" fill="#ffffff" letter-spacing="-1">et rappels, <tspan fill="#6cc4b4">réunis.</tspan></text>
<text x="80" y="378" font-family="Segoe UI" font-size="22" fill="#a9b8b5">L’appli d’écoute pensée pour vivre sa foi au quotidien :</text>
<text x="80" y="408" font-family="Segoe UI" font-size="22" fill="#a9b8b5">podcasts, récitations du Coran et horaires de prière.</text>
${pill(80, 448, 168, 'Coran récité')}${pill(260, 448, 210, 'Horaires de prière')}${pill(482, 448, 156, 'Hors-ligne')}
${pill(80, 500, 238, 'Podcasts vérifiés')}${pill(330, 500, 212, 'Vos audios &amp; vidéos')}
<text x="80" y="590" font-family="Segoe UI" font-size="18" font-weight="600" fill="#6cc4b4">grfz9.github.io/Podsnew</text>

${cover(740, 70, 190, -8, bands)}
${cover(950, 120, 170, 7, islamic)}
${cover(700, 300, 170, 6, mountains)}
${cover(890, 330, 200, -5, quran)}
${cover(1080, 360, 140, 9, bubbles)}
${cover(1065, 0, 120, -12, waves)}
${cover(640, 520, 120, -10, rings)}
</svg>`;

const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng();
fs.writeFileSync(out, png);
fs.writeFileSync(out.replace(/\.png$/, '.svg'), svg);
console.log('ok', png.length, 'octets');
