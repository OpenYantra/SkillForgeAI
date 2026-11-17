/**
 * Skill frontmatter parsing.
 *
 * Uses the YAML parser so folded (`>-`) and literal (`|`) descriptions are read
 * in full instead of only their first line.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const FRONTMATTER = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * @param {string} content
 * @returns {Record<string, any>|null}
 */
export function parseFrontmatter(content) {
  const match = String(content).match(FRONTMATTER);
  if (!match) return null;
  try {
    const data = parseYaml(match[1]);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Collapse folded/literal description whitespace onto one line.
 * @param {unknown} value
 */
export function normalizeDescription(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

function fallbackDescription(content) {
  const body = String(content).replace(FRONTMATTER, '');
  const line = body
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0 && !entry.startsWith('#') && !entry.startsWith('```'));
  return line || '';
}

/**
 * Read the name/description for a `SKILL.md` file.
 * @param {string} skillPath
 * @param {string} [fallback]
 * @returns {{data: Record<string, any>, name: string, description: string}}
 */
export function readSkillFrontmatter(skillPath, fallback = 'SDLC Skill') {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const frontmatter = parseFrontmatter(content);
  const data = frontmatter || {};
  const name =
    typeof data.name === 'string' && data.name.trim() ? data.name.trim() : path.basename(path.dirname(skillPath));
  const description = normalizeDescription(data.description) || fallbackDescription(content) || fallback;
  return { data, name, description };
}
