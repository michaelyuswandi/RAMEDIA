import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');

for (const directoryName of ['dist', 'dist-electron']) {
  fs.rmSync(path.join(projectDirectory, directoryName), { recursive: true, force: true });
}
