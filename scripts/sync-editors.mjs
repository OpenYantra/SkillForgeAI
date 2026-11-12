#!/usr/bin/env node
/**
 * SkillForgeAI: Universal Editor Config Bridge
 * Generates editor-specific rules (.cursorrules, CLAUDE.md, .windsurfrules, AGENTS.md)
 * that point directly to the centralized .agents/skills/ library.
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

  // 1. Antigravity & Agentic Standard: AGENTS.md
  fs.writeFileSync('AGENTS.md', baseInstructions);
  console.log('   ✅ Updated AGENTS.md (Antigravity & universal agent standard)');

  // 2. Cursor: .cursorrules
  fs.writeFileSync('.cursorrules', baseInstructions);
  console.log('   ✅ Updated .cursorrules (Cursor IDE)');

  // 3. Claude Code: CLAUDE.md
  fs.writeFileSync('CLAUDE.md', baseInstructions);
  console.log('   ✅ Updated CLAUDE.md (Anthropic Claude Code)');

  // 4. Windsurf: .windsurfrules
  fs.writeFileSync('.windsurfrules', baseInstructions);
  console.log('   ✅ Updated .windsurfrules (Windsurf / Codeium)');

  // 5. GitHub Copilot: .github/copilot-instructions.md
  const githubDir = '.github';
  if (!fs.existsSync(githubDir)) fs.mkdirSync(githubDir, { recursive: true });
  fs.writeFileSync(path.join(githubDir, 'copilot-instructions.md'), baseInstructions);
  console.log('   ✅ Updated .github/copilot-instructions.md (GitHub Copilot)');

  console.log('\n🎉 All agentic editor configs are synchronized to SkillForgeAI skills!\n');
}

generateEditorConfigs();
