/**
 * Test Suite: MCP server JSON-RPC surface.
 * Covers improvement.md #5 (safety net for `mcp`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeTempDir, removeDir, writeFiles, runNode, REPO_ROOT } from './helpers/workspace.ts';

const SERVER = path.join(REPO_ROOT, 'scripts', 'mcp-server.mjs');

function rpc(dir: string, messages: unknown[]): Array<Record<string, unknown>> {
  const input = messages.map((message) => JSON.stringify(message)).join('\n') + '\n';
  const result = runNode(SERVER, [], dir, input);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('mcp-server', () => {
  it('supports the --test smoke mode', () => {
    const result = runNode(SERVER, ['--test']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /skillforge-ai-mcp/);
    assert.match(result.stdout, /get_code_graph/);
  });

  it('handles initialize, tools/list, and tools/call', () => {
    const dir = makeTempDir('mcp');
    try {
      writeFiles(dir, {
        '.agents/skills/sfa-demo/SKILL.md': '# Demo Skill\nFollow the demo workflow.\n',
        'docs/context/code-graph.json': JSON.stringify({ nodes: {}, totalFiles: 0 }),
      });

      const responses = rpc(dir, [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
        { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'get_skill_instructions', arguments: { skillName: 'sfa-demo' } },
        },
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'get_code_graph', arguments: {} },
        },
      ]);

      assert.equal(responses.length, 4);
      const initialize = responses[0].result as { serverInfo: { name: string } };
      assert.equal(initialize.serverInfo.name, 'skillforge-ai-mcp');

      const tools = responses[1].result as { tools: Array<{ name: string }> };
      assert.ok(tools.tools.some((tool) => tool.name === 'run_quality_gate'));

      const skill = responses[2].result as { content: Array<{ text: string }> };
      assert.match(skill.content[0].text, /Demo Skill/);

      const graph = responses[3].result as { content: Array<{ text: string }> };
      assert.match(graph.content[0].text, /totalFiles/);
    } finally {
      removeDir(dir);
    }
  });

  it('returns JSON-RPC errors for unknown methods and malformed input', () => {
    const dir = makeTempDir('mcp-errors');
    try {
      const unknown = rpc(dir, [{ jsonrpc: '2.0', id: 9, method: 'unknown/method', params: {} }]);
      assert.equal(unknown.length, 1);
      assert.equal((unknown[0].error as { code: number }).code, -32601);

      const malformed = runNode(SERVER, [], dir, 'not-json\n');
      assert.equal(malformed.status, 0, malformed.stderr);
      const parsed = JSON.parse(malformed.stdout.trim());
      assert.equal(parsed.error.code, -32700);
    } finally {
      removeDir(dir);
    }
  });

  it('passes sign-off paths containing spaces without shell interpolation', () => {
    const dir = makeTempDir('mcp-signoff');
    try {
      writeFiles(dir, {
        'docs/approvals/order service-signoff.md': `# Sign-Off
- **Status:** APPROVED
- **Reviewed By (Human):** Dana Human
- **Approval Date:** 2026-11-11
- **Commit / Artifact Hash:** abc123

- [x] Authorized to proceed to **Phase 4: Feature Scaffolding & Implementation**
`,
      });

      const responses = rpc(dir, [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'verify_human_signoff',
            arguments: { signOffPath: 'docs/approvals/order service-signoff.md' },
          },
        },
      ]);

      const result = responses[0].result as { content: Array<{ text: string }> };
      assert.match(result.content[0].text, /PASSED/);
    } finally {
      removeDir(dir);
    }
  });

  it('runs the security audit for a target directory containing spaces', () => {
    const dir = makeTempDir('mcp-security');
    try {
      writeFiles(dir, { 'src dir/clean.ts': 'export class Clean {}\n' });

      const responses = rpc(dir, [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'audit_security', arguments: { path: 'src dir' } },
        },
      ]);

      const result = responses[0].result as { content: Array<{ text: string }> };
      const report = JSON.parse(result.content[0].text) as { status: string; filesScanned: number };
      assert.equal(report.status, 'PASSED');
      assert.ok(report.filesScanned > 0);
    } finally {
      removeDir(dir);
    }
  });
});
