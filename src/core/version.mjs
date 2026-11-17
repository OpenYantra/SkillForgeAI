/**
 * Single source of truth for the platform version.
 * Reads `package.json` so the CLI and MCP server never drift from the package.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));

export const PRODUCT_NAME = 'SkillForgeAI';
export const VERSION = pkg.version;
