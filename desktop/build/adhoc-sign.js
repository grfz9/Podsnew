// macOS : signature « ad hoc » de l'appli. Sans signature, les Mac à puce Apple refusent de la lancer
// (« endommagée »). Une signature Apple Developer ID (99 $/an) supprimera aussi l'avertissement au premier lancement.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
