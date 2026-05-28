import { readFileSync, writeFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));
writeFileSync(
  './public/js/buntoolVersion.js',
  `export const BUNTOOL_VERSION = "${version}";\n`
);
console.log(`buntoolVersion.js updated to ${version}`);
