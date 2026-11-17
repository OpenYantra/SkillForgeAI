/**
 * Test Suite: skill frontmatter parsing.
 * Covers improvement.md #20 (folded descriptions are no longer truncated).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, normalizeDescription, readSkillFrontmatter } from '../src/core/skill-frontmatter.mjs';
import { makeTempDir, removeDir, writeFiles } from './helpers/workspace.ts';

function skillFile(dir: string, content: string): string {
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(file, content);
  return file;
}

describe('frontmatter parser', () => {
  it('reads folded descriptions in full', () => {
    const dir = makeTempDir('frontmatter-folded');
    try {
      const file = skillFile(
        dir,
        `---
name: sfa-demo
description: >-
  Audits source code changes and application architecture
  for security vulnerabilities and leaked secrets.
---

# Demo
`,
      );
      const skill = readSkillFrontmatter(file);
      assert.equal(skill.name, 'sfa-demo');
      assert.equal(
        skill.description,
        'Audits source code changes and application architecture for security vulnerabilities and leaked secrets.',
      );
    } finally {
      removeDir(dir);
    }
  });

  it('reads literal block descriptions and normalizes whitespace', () => {
    const dir = makeTempDir('frontmatter-literal');
    try {
      const file = skillFile(dir, `---\nname: sfa-demo\ndescription: |\n  Line one.\n  Line two.\n---\n`);
      assert.equal(readSkillFrontmatter(file).description, 'Line one. Line two.');
      assert.equal(normalizeDescription('  a\n  b  '), 'a b');
    } finally {
      removeDir(dir);
    }
  });

  it('falls back to the first body paragraph without frontmatter', () => {
    const dir = makeTempDir('frontmatter-none');
    try {
      const file = skillFile(dir, '# Demo\n\nPlain description paragraph.\n');
      assert.equal(readSkillFrontmatter(file).description, 'Plain description paragraph.');
    } finally {
      removeDir(dir);
    }
  });

  it('handles malformed frontmatter without throwing', () => {
    const dir = makeTempDir('frontmatter-bad');
    try {
      const file = skillFile(dir, '---\nname: [unclosed\n---\n\n# Demo\n\nFallback description.\n');
      const parsed = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
      assert.equal(parsed, null);
      assert.equal(readSkillFrontmatter(file).description, 'Fallback description.');
    } finally {
      removeDir(dir);
    }
  });

  it('falls back to the skill directory name when name is absent', () => {
    const dir = makeTempDir('frontmatter-name');
    try {
      const skillDir = path.join(dir, 'sfa-demo');
      writeFiles(dir, { 'sfa-demo/SKILL.md': '---\ndescription: Demo skill\n---\n' });
      assert.equal(readSkillFrontmatter(path.join(skillDir, 'SKILL.md')).name, 'sfa-demo');
    } finally {
      removeDir(dir);
    }
  });
});
