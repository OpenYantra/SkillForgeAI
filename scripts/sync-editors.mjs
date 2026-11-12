#!/usr/bin/env node
/**
 * SkillForgeAI: Universal Editor Config Bridge
 * Generates editor-specific rules and configurations for:
 * - Antigravity (AGENTS.md)
 * - Cursor (.cursorrules)
 * - Claude Code (CLAUDE.md)
 * - Windsurf (.windsurfrules)
 * - OpenCode (OPENCODE.md & .opencode/instructions.md)
 * - VSCode (.vscode/tasks.json, .vscode/settings.json, .clinerules, GitHub Copilot)
 */

import fs from 'node:fs';
import path from 'node:path';

const SKILLS_DIR = '.agents/skills';

function getInstalledSkills() {
  if (!fs.existsSync(SKILLS_DIR)) return [];
  return fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => {
      const skillPath = path.join(SKILLS_DIR, dirent.name, 'SKILL.md');
      let description = 'SDLC Skill';
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, 'utf-8');
        const descMatch = content.match(/description:\s*>?-?\s*([^\n\r]+)/i);
        if (descMatch) description = descMatch[1].trim();
      }
      return { name: dirent.name, description };
    });
}

function generateEditorConfigs() {
  const skills = getInstalledSkills();
  console.log(`\n🔄 Syncing ${skills.length} SkillForgeAI skills across agentic code editors...`);

  const skillsListMarkdown = skills
    .map(s => `- **\`${s.name}\`**: ${s.description}`)
    .join('\n');

  const baseInstructions = `# SkillForgeAI Unified Agent Instructions
This codebase uses the SkillForgeAI SDLC framework. When executing software engineering tasks,
always invoke the appropriate specialized skill from \`.agents/skills/<skill-name>/SKILL.md\`:

## Available SDLC Skills
${skillsListMarkdown}

## Core Rules for All Agents & Models
1. **Never Guess Requirements:** For new features, execute \`prd-generator-validator\` first.
2. **Architecture Boundaries:** Enforce Clean Architecture. Domain entities must not import infrastructure frameworks.
3. **Traceability:** All tests must cite requirement IDs (e.g. \`FR-001\`, \`EC-001\`).
4. **Automated Quality Gate:** Before finishing a task or opening a PR, always run:
   \`\`\`bash
   node .agents/skills/quality-gate-orchestrator/scripts/run-all-gates.mjs
   \`\`\`
`;

  // 1. Antigravity & Universal Agent Standard: AGENTS.md
  fs.writeFileSync('AGENTS.md', baseInstructions);
  console.log('   ✅ Updated AGENTS.md (Antigravity & universal agent standard)');

  // 2. Cursor: .cursorrules
  fs.writeFileSync('.cursorrules', baseInstructions);
  console.log('   ✅ Updated .cursorrules (Cursor IDE)');

  // 3. Claude Code: CLAUDE.md
  fs.writeFileSync('CLAUDE.md', baseInstructions);
  console.log('   ✅ Updated CLAUDE.md (Anthropic Claude Code)');

  // 4. Windsurf / Codeium: .windsurfrules
  fs.writeFileSync('.windsurfrules', baseInstructions);
  console.log('   ✅ Updated .windsurfrules (Windsurf)');

  // 5. OpenCode: OPENCODE.md & .opencode/instructions.md
  fs.writeFileSync('OPENCODE.md', baseInstructions);
  const openCodeDir = '.opencode';
  if (!fs.existsSync(openCodeDir)) fs.mkdirSync(openCodeDir, { recursive: true });
  fs.writeFileSync(path.join(openCodeDir, 'instructions.md'), baseInstructions);
  console.log('   ✅ Updated OPENCODE.md & .opencode/instructions.md (OpenCode)');

  // 6. GitHub Copilot: .github/copilot-instructions.md
  const githubDir = '.github';
  if (!fs.existsSync(githubDir)) fs.mkdirSync(githubDir, { recursive: true });
  fs.writeFileSync(path.join(githubDir, 'copilot-instructions.md'), baseInstructions);
  console.log('   ✅ Updated .github/copilot-instructions.md (GitHub Copilot)');

  // 7. VSCode Native Tasks & Configuration (.vscode/tasks.json & .vscode/settings.json)
  const vscodeDir = '.vscode';
  if (!fs.existsSync(vscodeDir)) fs.mkdirSync(vscodeDir, { recursive: true });

  const vscodeTasks = {
    version: '2.0.0',
    tasks: [
      {
        label: 'SkillForge: Run All Quality Gates',
        type: 'shell',
        command: 'node',
        args: ['.agents/skills/quality-gate-orchestrator/scripts/run-all-gates.mjs'],
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

  fs.writeFileSync(path.join(vscodeDir, 'tasks.json'), JSON.stringify(vscodeTasks, null, 2));
  console.log('   ✅ Updated .vscode/tasks.json (VSCode One-Click Tasks)');

  // 8. VSCode Cline / Roo-Code Agent Rules
  fs.writeFileSync('.clinerules', baseInstructions);
  console.log('   ✅ Updated .clinerules (VSCode Cline & Roo-Code extensions)');

  console.log('\n🎉 All editor configurations (including OpenCode & VSCode) are synchronized!\n');
}

generateEditorConfigs();
