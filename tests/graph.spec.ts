/**
 * Test Suite: Code graph generation (CLI engine and legacy script).
 * Covers improvement.md #5 (safety net for `graph`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCodeGraph,
  detectLanguage,
  extractSymbolsAndImports,
  generateRepoMapMarkdown,
} from '../src/cli/commands/graph.mjs';
import { makeTempDir, removeDir, writeFiles, runNode, REPO_ROOT } from './helpers/workspace.ts';

const ENTITY = `export interface OrderProps { id: string; }
export type OrderStatus = 'PENDING' | 'PAID';
export class OrderEntity {
  public static create(): OrderEntity { return new OrderEntity(); }
}
export function helper(): void {}
`;

const SERVICE = `import { OrderEntity } from '../domain/order.entity.ts';
export class OrderService {}
`;

describe('graph helpers', () => {
  it('detects languages by extension', () => {
    assert.equal(detectLanguage('a.ts'), 'typescript');
    assert.equal(detectLanguage('a.mjs'), 'typescript');
    assert.equal(detectLanguage('a.cs'), 'csharp');
    assert.equal(detectLanguage('a.py'), 'python');
    assert.equal(detectLanguage('a.go'), 'go');
    assert.equal(detectLanguage('a.txt'), 'unknown');
  });

  it('extracts TypeScript symbols and internal imports', () => {
    const dir = makeTempDir('graph-extract');
    try {
      const file = path.join(dir, 'order.entity.ts');
      fs.writeFileSync(file, ENTITY + `\nimport type { OrderItem } from './order.item.ts';\n`);
      const extracted = extractSymbolsAndImports(file);
      assert.equal(extracted.language, 'typescript');
      assert.deepEqual(extracted.symbols.classes, ['OrderEntity']);
      assert.deepEqual(extracted.symbols.interfaces, ['OrderProps']);
      assert.deepEqual(extracted.symbols.types, ['OrderStatus']);
      assert.deepEqual(extracted.symbols.functions, ['helper']);
      assert.ok(extracted.internalImports[0].endsWith('order.item.ts'));
    } finally {
      removeDir(dir);
    }
  });

  it('builds reverse dependencies and renders a repo map', () => {
    const dir = makeTempDir('graph-build');
    const previous = process.cwd();
    try {
      writeFiles(dir, {
        'src/domain/order.entity.ts': ENTITY,
        'src/services/order.service.ts': SERVICE,
      });
      process.chdir(dir);

      const { graph } = buildCodeGraph('.');
      const nodes = graph.nodes as Record<string, { importedBy: string[] }>;
      assert.ok(nodes['src/domain/order.entity.ts']);
      assert.deepEqual(nodes['src/domain/order.entity.ts'].importedBy, ['src/services/order.service.ts']);

      const markdown = generateRepoMapMarkdown(graph);
      assert.match(markdown, /Repository Code Map/);
      assert.match(markdown, /OrderEntity/);
      assert.match(markdown, /order\.service\.ts/);
    } finally {
      process.chdir(previous);
      removeDir(dir);
    }
  });
});

describe('generate-code-graph script', () => {
  it('writes code-graph.json and REPO-MAP.md in the target workspace', () => {
    const dir = makeTempDir('graph-script');
    try {
      writeFiles(dir, {
        'src/domain/order.entity.ts': ENTITY,
        'src/services/order.service.ts': SERVICE,
      });

      const result = runNode(path.join(REPO_ROOT, 'scripts', 'generate-code-graph.mjs'), ['.'], dir);
      assert.equal(result.status, 0, result.stderr);

      const graph = JSON.parse(fs.readFileSync(path.join(dir, 'docs', 'context', 'code-graph.json'), 'utf-8'));
      assert.equal(graph.totalFiles, 2);
      assert.ok(fs.existsSync(path.join(dir, 'docs', 'context', 'REPO-MAP.md')));
    } finally {
      removeDir(dir);
    }
  });
});
