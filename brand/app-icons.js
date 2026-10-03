// Usage : npm install --no-save @resvg/resvg-js@2 && node brand/app-icons.js
// Icônes de l'appli installée (PWA) :
// - icon-192 / icon-512 : rondes sur fond transparent (Windows, macOS, onglets), comme Discord ;
// - maskable-192 / maskable-512 : pleines, Android et iOS découpent eux-mêmes la forme.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = path.join(__dirname, '..', 'public', 'icons');
const CREAM = '#f5f1ec';

const glyph = `<g transform="translate(97.28 97.28) scale(3.174)">
  <path d="M22 88 V50 C22 33 36 22 50 12 C64 22 78 33 78 50 V88" fill="none" stroke="${CREAM}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <g stroke="${CREAM}" stroke-width="5" stroke-linecap="round">
    <line x1="34" y1="54" x2="34" y2="70"/><line x1="42" y1="47" x2="42" y2="77"/><line x1="50" y1="40" x2="50" y2="84"/><line x1="58" y1="47" x2="58" y2="77"/><line x1="66" y1="54" x2="66" y2="70"/>
  </g>
</g>`;
const defs = `<defs><radialGradient id="g" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="#3d6a66"/><stop offset="1" stop-color="#25403f"/></radialGradient></defs>`;

const round = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<circle cx="256" cy="256" r="256" fill="url(#g)"/>${glyph}</svg>`;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#g)"/>${glyph}</svg>`;

function png(svg, size, file) {
  const data = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(OUT, file), data);
  console.log(file, data.length, 'octets');
}

png(round, 192, 'icon-192.png');
png(round, 512, 'icon-512.png');
png(full, 192, 'maskable-192.png');
png(full, 512, 'maskable-512.png');
png(full, 180, 'apple-touch-icon.png');
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), round);
console.log('favicon.svg');
