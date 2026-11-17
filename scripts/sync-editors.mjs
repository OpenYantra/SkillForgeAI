#!/usr/bin/env node
/**
 * SkillForgeAI: Universal Editor Config Bridge
 * Generates editor-specific rules and configurations for:
 * - Antigravity (AGENTS.md)
 * - Cursor (.cursorrules)
 * - Claude Code (CLAUDE.md)
 * - Windsurf (.windsurfrules)
 * - OpenCode (OPENCODE.md & .opencode/instructions.md)
 * - VSCode (.vscode/tasks.json, .clinerules, GitHub Copilot)
 *
 * `--check` verifies the generated files without writing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSkillFrontmatter } from '../src/core/skill-frontmatter.mjs';

const SKILLS_DIR = '.agents/skills';

export function getInstalledSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => {
      const skillPath = path.join(SKILLS_DIR, dirent.name, 'SKILL.md');
      const description = fs.existsSync(skillPath) ? readSkillFrontmatter(skillPath).description : 'SDLC Skill';
      return { name: dirent.name, description };
    });
}

function vscodeTasks() {
  return {
    version: '2.0.0',
    tasks: [
      {
        label: 'SkillForge: Run All Quality Gates',
        type: 'shell',
        command: 'node',
        args: ['.agents/skills/sfa-quality-gate-orchestrator/scripts/run-all-gates.mjs'],
        group: {
          kind: 'test',
          isDefault: true,
        },
        presentation: {
          reveal: 'always',
          panel: 'dedicated',
        },
        problemMatcher: [],
      },
      {
        label: 'SkillForge: Detect Breaking Changes & Impact',
        type: 'shell',
        command: 'node',
        args: ['scripts/detect-breaking-changes.mjs'],
        presentation: {
          reveal: 'always',
          panel: 'dedicated',
        },
        problemMatcher: [],
      },
      {
        label: 'SkillForge: Run Security & Vulnerability Audit',
        type: 'shell',
        command: 'node',
        args: ['bin/skillforge.mjs', 'security'],
        presentation: {
          reveal: 'always',
          panel: 'dedicated',
        },
        problemMatcher: [],
      },
      {
        label: 'SkillForge: Generate Code Graph & Repo Map',
        type: 'shell',
        command: 'node',
        args: ['scripts/generate-code-graph.mjs'],
        presentation: {
          reveal: 'always',
          panel: 'dedicated',
        },
        problemMatcher: [],
      },
      {
        label: 'SkillForge: Run Self-Healing Test Loop',
        type: 'shell',
        command: 'node',
        args: ['scripts/self-heal-loop.mjs'],
        presentation: {
          reveal: 'always',
          panel: 'dedicated',
        },
        problemMatcher: [],
      },
      {
        label: 'SkillForge: Sync Editor Configurations',
        type: 'shell',
        command: 'node',
        args: ['scripts/sync-editors.mjs'],
        presentation: {
          reveal: 'always',
          panel: 'dedicated',
        },
        problemMatcher: [],
      },
    ],
  };
}

/**
 * Build every generated editor configuration in memory.
 * @returns {Array<{file: string, label: string, content: string}>}
 */
export function renderEditorConfigs() {
  const skills = getInstalledSkills();
  const skillsListMarkdown = skills.map((skill) => `- **\`${skill.name}\`**: ${skill.description}`).join('\n');

  const baseInstructions = `# SkillForgeAI Unified Agent Instructions
This codebase uses the SkillForgeAI SDLC framework. When executing software engineering tasks,
always invoke the appropriate specialized skill from \`.agents/skills/<skill-name>/SKILL.md\`:

## Available SDLC Skills
${skillsListMarkdown}

## Core Rules for All Agents & Models
1. **Never Guess Requirements:** For new features, execute \`sfa-prd-generator-validator\` first.
2. **Architecture Boundaries:** Enforce Clean Architecture. Domain entities must not import infrastructure frameworks.
3. **Traceability:** All tests must cite requirement IDs (e.g. \`FR-001\`, \`EC-001\`).
4. **Automated Quality Gate:** Before finishing a task or opening a PR, always run:
   \`\`\`bash
   node .agents/skills/sfa-quality-gate-orchestrator/scripts/run-all-gates.mjs
   \`\`\`
`;

  return [
    { file: 'AGENTS.md', label: 'AGENTS.md (Antigravity & universal agent standard)', content: baseInstructions },
    { file: '.cursorrules', label: '.cursorrules (Cursor IDE)', content: baseInstructions },
    { file: 'CLAUDE.md', label: 'CLAUDE.md (Anthropic Claude Code)', content: baseInstructions },
    { file: '.windsurfrules', label: '.windsurfrules (Windsurf)', content: baseInstructions },
    { file: 'OPENCODE.md', label: 'OPENCODE.md (OpenCode)', content: baseInstructions },
    { file: '.opencode/instructions.md', label: '.opencode/instructions.md (OpenCode)', content: baseInstructions },
    {
      file: '.github/copilot-instructions.md',
      label: '.github/copilot-instructions.md (GitHub Copilot)',
      content: baseInstructions,
    },
    {
      file: '.vscode/tasks.json',
      label: '.vscode/tasks.json (VSCode One-Click Tasks)',
      content: JSON.stringify(vscodeTasks(), null, 2),
    },
    { file: '.clinerules', label: '.clinerules (VSCode Cline & Roo-Code extensions)', content: baseInstructions },
  ];
}

function normalized(text) {
  return text.replace(/\r\n/g, '\n');
}

function writeOutputs(outputs) {
  for (const output of outputs) {
    const dir = path.dirname(output.file);
    if (dir && dir !== '.' && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(output.file, output.content);
    console.log(`   ✅ Updated ${output.label}`);
  }
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
Usage:
  node scripts/sync-editors.mjs [--check]

Options:
  --check    Verify generated editor configs are up to date without writing
  --help,-h  Show this help message
`);
    return 0;
  }

  const skills = getInstalledSkills();
  const outputs = renderEditorConfigs();

  if (argv.includes('--check')) {
    const drift = outputs.filter((output) => {
      if (!fs.existsSync(output.file)) return true;
      return normalized(fs.readFileSync(output.file, 'utf-8')) !== normalized(output.content);
    });

    if (drift.length > 0) {
      console.error(`❌ Editor configs are stale (${drift.length} file(s)):`);
      for (const output of drift) console.error(`   - ${output.file}`);
      console.error('\nRun "node scripts/sync-editors.mjs" to regenerate them.\n');
      return 1;
    }

    console.log(`✅ Editor configs are up to date (${outputs.length} files).`);
    return 0;
  }

  console.log(`\n🔄 Syncing ${skills.length} SkillForgeAI skills across agentic code editors...`);
  writeOutputs(outputs);
  console.log('\n🎉 All editor configurations are synchronized!\n');
  return 0;
}

const isDirectCall = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectCall) {
  process.exit(main());
}
