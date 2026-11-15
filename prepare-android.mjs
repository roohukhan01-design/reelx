// Prepare the generated Capacitor Android project and install the custom Telegram WebView plugin.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const main = path.join(root, 'android', 'app', 'src', 'main');
if (!fs.existsSync(main)) {
  console.error('Android project not found. Run npx cap add android first.');
  process.exit(1);
}

const javaDest = path.join(main, 'java', 'com', 'reelfinder', 'app');
fs.mkdirSync(javaDest, { recursive: true });
for (const name of ['MainActivity.java', 'TgWebPlugin.java']) {
  const source = path.join(root, name);
  if (!fs.existsSync(source)) throw new Error('Missing required source file: ' + name);
  fs.copyFileSync(source, path.join(javaDest, name));
}

const strings = path.join(main, 'res', 'values', 'strings.xml');
if (fs.existsSync(strings)) {
  let xml = fs.readFileSync(strings, 'utf8');
  xml = xml.replace(/(<string name="app_name">)[^<]*/, '$1Reelfinder');
  fs.writeFileSync(strings, xml);
}

const manifest = path.join(main, 'AndroidManifest.xml');
if (fs.existsSync(manifest)) {
  let xml = fs.readFileSync(manifest, 'utf8');
  xml = xml.replace(/android:allowBackup="[^"]*"/, 'android:allowBackup="false"');
  if (!xml.includes('android:usesCleartextTraffic')) {
    xml = xml.replace('<application', '<application android:usesCleartextTraffic="false"');
  }
  fs.writeFileSync(manifest, xml);
}
console.log('Android project prepared successfully.');
