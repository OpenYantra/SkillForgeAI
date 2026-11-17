#!/usr/bin/env node
/**
 * SkillForgeAI: Local Model Context Protocol (MCP) Server
 * Exposes SkillForgeAI SDLC tools natively to AI agents (Cursor, Claude Desktop, Antigravity)
 * using the standard JSON-RPC 2.0 over stdio MCP specification.
 * 
 * Tools Exposed:
 * - get_code_graph: Returns cached symbol-level dependency graph
 * - check_breaking_changes: Runs semantic change impact analysis
 * - run_quality_gate: Evaluates all or specific SDLC phase gates
 * - verify_human_signoff: Checks human approval status
 * - get_skill_instructions: Retrieves instructions for a specific skill
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const SERVER_NAME = 'skillforge-ai-mcp';
const SERVER_VERSION = '1.0.0';

const TOOLS = [
  {
    name: 'get_code_graph',
    description: 'Returns the cached symbol-level dependency graph and module map of the repository.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'check_breaking_changes',
    description: 'Analyzes uncommitted Git diffs for destructive breaking changes (MAJOR) vs additive changes (MINOR) and affected callers.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_quality_gate',
    description: 'Executes automated SDLC quality gates across all 7 phases or for a specific phase (1-7).',
    inputSchema: {
      type: 'object',
      properties: {
        phase: {
          type: 'integer',
          description: 'Optional phase number (1 to 7) to evaluate. If omitted, runs all gates.',
          minimum: 1,
          maximum: 7,
        },
      },
    },
  },
  {
    name: 'verify_human_signoff',
    description: 'Checks if human approval (HITL) has been granted for the target feature before scaffolding or releasing.',
    inputSchema: {
      type: 'object',
      properties: {
        signOffPath: {
          type: 'string',
          description: 'Path to the sign-off document in docs/approvals/',
        },
      },
      required: ['signOffPath'],
    },
  },
  {
    name: 'get_skill_instructions',
    description: 'Retrieves the complete instructions, steps, and criteria for a specific SDLC skill.',
    inputSchema: {
      type: 'object',
      properties: {
        skillName: {
          type: 'string',
          description: 'Name of the skill (e.g., sfa-prd-generator-validator, sfa-feature-scaffolder, sfa-unit-test-synthesizer)',
        },
      },
      required: ['skillName'],
    },
  },
  {
    name: 'list_domain_slices',
    description: 'Lists all partitioned vertical domain slices in the monorepo with root paths, stacks, file counts, and token estimates.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_domain_slice',
    description: 'Retrieves the token-efficient architectural slice map for a specific domain/feature (e.g. order-service, dotnet-order-service, cli).',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name or identifier of the domain slice (e.g. order-service, dotnet-order-service, cli)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'audit_security',
    description: 'Audits code changes or application codebases for vulnerabilities, secrets, and hacker-targetable weaknesses (OWASP Top 10, CWE Top 25).',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Optional path to file or directory to scan. Defaults to repository root.',
        },
        diff: {
          type: 'boolean',
          description: 'If true, scans only files modified in Git diff.',
        },
        strict: {
          type: 'boolean',
          description: 'If true, flags medium and low warnings as failures.',
        },
      },
    },
  },
];

function handleToolCall(name, args = {}) {
  switch (name) {
    case 'get_code_graph': {
      const graphPath = path.join('docs', 'context', 'code-graph.json');
      if (fs.existsSync(graphPath)) {
        return fs.readFileSync(graphPath, 'utf-8');
      }
      return 'Code graph not found. Run scripts/generate-code-graph.mjs first.';
    }

    case 'check_breaking_changes': {
      try {
        const out = execSync('node scripts/detect-breaking-changes.mjs', { encoding: 'utf-8' });
        return out;
      } catch (err) {
        return err.stdout || err.message;
      }
    }

    case 'run_quality_gate': {
      const phaseFlag = args.phase ? `--phase ${args.phase}` : '';
      try {
        const out = execSync(`node .agents/skills/sfa-quality-gate-orchestrator/scripts/run-all-gates.mjs ${phaseFlag}`, { encoding: 'utf-8' });
        return out;
      } catch (err) {
        return err.stdout || err.message;
      }
    }

    case 'verify_human_signoff': {
      try {
        const out = execSync(`node scripts/verify-human-signoff.mjs "${args.signOffPath}"`, { encoding: 'utf-8' });
        return out;
      } catch (err) {
        return err.stdout || err.message;
      }
    }

    case 'get_skill_instructions': {
      const skillPath = path.join('.agents', 'skills', args.skillName, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        return fs.readFileSync(skillPath, 'utf-8');
      }
      return `Skill "${args.skillName}" not found in .agents/skills/`;
    }

    case 'list_domain_slices': {
      const indexPath = path.join('docs', 'context', 'slices', 'index.md');
      if (fs.existsSync(indexPath)) {
        return fs.readFileSync(indexPath, 'utf-8');
      }
      return 'Domain slices not found. Run "skillforge slice" first.';
    }

    case 'get_domain_slice': {
      const slicesDir = path.join('docs', 'context', 'slices');
      const targetName = (args.name || '').toLowerCase();
      const directMap = path.join(slicesDir, `${targetName}-map.md`);
      if (fs.existsSync(directMap)) {
        return fs.readFileSync(directMap, 'utf-8');
      }
      if (fs.existsSync(slicesDir)) {
        const files = fs.readdirSync(slicesDir);
        const matched = files.find(f => f.toLowerCase().includes(targetName) && f.endsWith('-map.md'));
        if (matched) {
          return fs.readFileSync(path.join(slicesDir, matched), 'utf-8');
        }
        return `Domain slice "${args.name}" not found. Available slices:\n` + files.filter(f => f.endsWith('-map.md')).map(f => `- ${f.replace('-map.md', '')}`).join('\n');
      }
      return 'Domain slices directory not found. Run "skillforge slice" first.';
    }

    case 'audit_security': {
      const target = args.path || '.';
      const isDiff = Boolean(args.diff);
      const isStrict = Boolean(args.strict);
      const flagDiff = isDiff ? '--diff' : '';
      const flagStrict = isStrict ? '--strict' : '';
      return execSync(`node bin/skillforge.mjs security --json ${flagDiff} ${flagStrict} --path "${target}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function processMessage(message) {
  const { id, method, params } = message;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
        },
      },
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: TOOLS,
      },
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params;
    try {
      const output = handleToolCall(name, toolArgs);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
            },
          ],
        },
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message,
        },
      };
    }
  }

  // Fallback for unsupported notifications or methods
  if (id !== undefined) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    };
  }

  return null;
}

function startServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const message = JSON.parse(line);
      const response = processMessage(message);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (err) {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      }) + '\n');
    }
  });
}

// If run directly in CLI test mode
if (process.argv.includes('--test')) {
  console.log(`✅ ${SERVER_NAME} v${SERVER_VERSION} initialized.`);
  console.log(`Available Tools: ${TOOLS.map(t => t.name).join(', ')}`);
  process.exit(0);
}

startServer();
