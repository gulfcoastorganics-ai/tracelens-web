import { readFile, stat } from 'node:fs/promises';

const required = [
  'index.html',
  'app.js',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'camera-errors.js',
  'camera-lifecycle.js',
];

for (const file of required) {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile() || info.size === 0) {
    throw new Error(`Release preflight failed: missing or empty ${file}`);
  }
}

const manifest = JSON.parse(await readFile('manifest.webmanifest', 'utf8'));
if (manifest.start_url !== './' || manifest.scope !== './') {
  throw new Error('Release preflight failed: PWA start_url and scope must stay project-subpath safe (./).');
}
for (const icon of manifest.icons ?? []) {
  const iconPath = String(icon.src ?? '').replace(/^\.\//, '');
  const info = iconPath ? await stat(iconPath).catch(() => null) : null;
  if (!info?.isFile()) throw new Error(`Release preflight failed: missing manifest icon ${icon.src}`);
}

const html = await readFile('index.html', 'utf8');
if (!/rel=["']manifest["'][^>]+href=["']\.\/manifest\.webmanifest["']|href=["']\.\/manifest\.webmanifest["'][^>]+rel=["']manifest["']/i.test(html)) {
  throw new Error('Release preflight failed: index.html must reference ./manifest.webmanifest.');
}
if (!/name=["']viewport["']/i.test(html)) {
  throw new Error('Release preflight failed: viewport metadata is missing.');
}

const rootAssetPattern = /(?:src|href)=["']\/(?!\/|#)/gi;
if (rootAssetPattern.test(html)) {
  throw new Error('Release preflight failed: root-absolute asset/navigation URL found in index.html; this breaks GitHub project Pages.');
}

console.log('TraceLens release preflight passed.');
