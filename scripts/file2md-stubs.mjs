import { existsSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Ensure nested pdfjs-dist doesn't shadow the root version
// npm overrides doesn't apply to optionalDependencies, so we handle it here
const nestedPdfjs = join(root, 'node_modules/@covoyage/file2md/node_modules/pdfjs-dist');
if (existsSync(nestedPdfjs)) {
  renameSync(nestedPdfjs, nestedPdfjs + '.bak');
  console.log('Disabled nested pdfjs-dist (moved to pdfjs-dist.bak)');
}
