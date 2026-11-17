#!/usr/bin/env node
/**
 * SkillForgeAI: Master Unified CLI
 * The single command-line interface for all SDLC agent skills, quality gates,
 * code graph analysis, breaking change tracking, scaffolding, and MCP tooling.
 */

import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { printBanner, printError, colors } from '../src/cli/ui.mjs';

const VERSION = '1.1.0';

const HELP_TEXT = `
${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}
${colors.bold}🛡️  SkillForgeAI Unified CLI (v${VERSION})${colors.reset}
${colors.dim}The Autonomous SDLC Engineering Platform for AI Coding Agents & Dev Teams.${colors.reset}
${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}

${colors.bold}Usage:${colors.reset}
  skillforge <command> [options]
  node bin/skillforge.mjs <command> [options]

${colors.bold}Core SDLC Commands:${colors.reset}
  ${colors.green}gate${colors.reset} [options]        Evaluate SDLC quality gates against project artifacts (--phase <1-7>)
  ${colors.green}security${colors.reset} [options]    Audit code changes & application for vulnerabilities (CWE/OWASP)
  ${colors.green}diff${colors.reset} [options]        Analyze Git diff for semantic breaking changes (SemVer)
  ${colors.green}graph${colors.reset} [options]       Generate symbol-level code graph (C#, Python, TS, Go)
  ${colors.green}slice${colors.reset} [options]       Generate token-efficient monorepo vertical slice maps (docs/context/slices/)
  ${colors.green}scaffold${colors.reset} [options]    Generate Clean Architecture features (TypeScript / .NET 10)
  ${colors.green}signoff${colors.reset} [options]     Record and verify Human-in-the-Loop (HITL) phase approvals
  ${colors.green}heal${colors.reset} [options]        Execute automated self-healing test runner loop
  ${colors.green}init${colors.reset}                  Full setup: installs Git hooks & syncs all 8 editors
  ${colors.green}sync${colors.reset}                  Synchronize canonical skills to Cursor, VSCode, OpenCode
  ${colors.green}mcp${colors.reset}                   Launch native Model Context Protocol (MCP) server
  ${colors.green}version${colors.reset}               Display SkillForgeAI platform version
  ${colors.green}help${colors.reset}                  Display this help message

${colors.bold}Configuration:${colors.reset}
  Gates read "skillforge.config.json" (mode: project | self-test).
  Copy "skillforge.config.example.json" to target your own artifacts.

${colors.bold}Examples:${colors.reset}
  skillforge gate --phase 6
  skillforge gate --config skillforge.config.json
  skillforge gate --self-test
  skillforge security --diff
  skillforge security --path src/
  skillforge diff --json
  skillforge graph --format mermaid
  skillforge scaffold --name catalog --lang dotnet
  skillforge signoff --feature order-service --by "Rishikesh Kumar"
  skillforge heal
`;

function runScript(scriptPath, args = []) {
  try {
    execFileSync(process.execPath, [path.resolve(scriptPath), ...args], { stdio: 'inherit' });
  } catch (err) {
    process.exit(err.status || 1);
  }
}

async function main() {
  const [, , command, ...args] = process.argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  switch (command.toLowerCase()) {
    case 'gate': {
      const { executeGate } = await import('../src/cli/commands/gate.mjs');
      await executeGate(args);
      break;
    }

    case 'security':
    case 'audit': {
      const { executeSecurity } = await import('../src/cli/commands/security.mjs');
      executeSecurity(args);
      break;
    }

    case 'diff': {
      const { executeDiff } = await import('../src/cli/commands/diff.mjs');
      executeDiff(args);
      break;
    }

    case 'graph': {
      const { executeGraph } = await import('../src/cli/commands/graph.mjs');
      executeGraph(args);
      break;
    }

    case 'slice': {
      const { executeSlice } = await import('../src/cli/commands/slice.mjs');
      executeSlice(args);
      break;
    }

    case 'scaffold': {
      const { executeScaffold } = await import('../src/cli/commands/scaffold.mjs');
      executeScaffold(args);
      break;
    }

    case 'signoff': {
      const { executeSignoff } = await import('../src/cli/commands/signoff.mjs');
      executeSignoff(args);
      break;
    }

    case 'init': {
      printBanner('🚀 Initializing SkillForgeAI Environment');
      runScript('scripts/install-git-hooks.mjs');
      runScript('scripts/sync-editors.mjs');
      runScript('scripts/generate-code-graph.mjs');
      const { executeSlice } = await import('../src/cli/commands/slice.mjs');
      executeSlice([]);
      console.log(`\n${colors.green}🎉 SkillForgeAI initialized successfully across all editors!${colors.reset}\n`);
      break;
    }

    case 'heal': {
      runScript('scripts/self-heal-loop.mjs', args);
      break;
    }

    case 'sync': {
      runScript('scripts/sync-editors.mjs');
      break;
    }

    case 'mcp': {
      const mcpProcess = spawn('node', [path.resolve('scripts/mcp-server.mjs'), ...args], {
        stdio: 'inherit',
      });
      mcpProcess.on('exit', (code) => process.exit(code || 0));
      break;
    }

    case 'version':
    case '--version':
    case '-v': {
      console.log(`SkillForgeAI v${VERSION}`);
      break;
    }

    default: {
      printError(`Unknown command: "${command}"\nRun "skillforge help" for available commands.`);
      process.exit(2);
    }
  }
}

await main();
