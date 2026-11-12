// electron-builder afterPack hook (macOS builds only).
// The app is not signed with a paid Apple Developer ID, so we give it an "ad-hoc" signature.
// Apple Silicon Macs refuse to run code with no signature at all ("app is damaged");
// ad-hoc signed apps open after the one-time "Open Anyway" step described in the README.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`  • ad-hoc signing ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
};
