/**
 * AUD-M: MCP tool boundary violations.
 *
 * The MCP server is the interface an AI agent calls. Its tools must not be
 * usable to read arbitrary files, scan outside the workspace, or certify a repo
 * using the framework's own self-test fixtures. Expected to FAIL.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { makeTempDir, removeDir, REPO_ROOT, runNode, writeFiles } from './helpers/audit.ts';

const SERVER = path.join(REPO_ROOT, 'scripts', 'mcp-server.mjs');

function rpc(dir: string, messages: unknown[]): Array<Record<string, any>> {
  const input = messages.map((message) => JSON.stringify(message)).join('\n') + '\n';
  const result = runNode(SERVER, [], dir, input);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, any>);
}

function toolText(response: Record<string, any>): string {
  const content = response.result && response.result.content;
  return content && content[0] ? String(content[0].text) : '';
}

describe('AUD-M: MCP tool boundaries', () => {
  it('AUD-M01: get_skill_instructions must reject path traversal', () => {
    const dir = makeTempDir('audit-mcp-skill');
    try {
      writeFiles(dir, { '.agents/secret/SKILL.md': 'TOP_SECRET_TOKEN\n' });
      const responses = rpc(dir, [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'get_skill_instructions', arguments: { skillName: '../secret' } },
        },
      ]);

      const text = toolText(responses[0]);
      assert.doesNotMatch(text, /TOP_SECRET_TOKEN/, 'skillName traversal read a file outside .agents/skills/');
    } finally {
      removeDir(dir);
    }
  });

  it('AUD-M02: audit_security must reject paths outside the workspace', () => {
    const workspace = makeTempDir('audit-mcp-ws');
    const outside = makeTempDir('audit-mcp-ext');
    try {
      writeFiles(outside, { 'leak.ts': "const key = 'AKIAIOSFODNN7EXAMPLE';\n" });
      const responses = rpc(workspace, [
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'audit_security', arguments: { path: outside } },
        },
      ]);

      const text = toolText(responses[0]);
      assert.doesNotMatch(
        text,
        /SEC-002|AKIAIOSFODNN7EXAMPLE|leak\.ts/,
        'audit_security scanned an arbitrary absolute path outside the workspace',
      );
    } finally {
      removeDir(workspace);
      removeDir(outside);
    }
  });

  it('AUD-M03: run_quality_gate must not certify production in self-test mode', () => {
    const responses = rpc(REPO_ROOT, [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'run_quality_gate', arguments: {} },
      },
    ]);

    const text = toolText(responses[0]);
    assert.doesNotMatch(
      text,
      /ready for production/i,
      'MCP run_quality_gate returned a production-ready verdict using framework self-test fixtures',
    );
  });
});
