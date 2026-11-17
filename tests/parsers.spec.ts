/**
 * Test Suite: tree-sitter symbol extraction and exact import resolution.
 * Covers improvement.md #8 (real parsers + no prefix-match false edges).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildCodeGraph, extractSymbolsAndImports, writeGraphArtifacts } from '../src/core/code-graph.mjs';
import { extractImportSources } from '../src/core/parsers/symbols.mjs';
import { resolveImport } from '../src/core/parsers/resolve.mjs';
import { makeTempDir, removeDir, writeFiles } from './helpers/workspace.ts';

function buildIn(dir: string) {
  const previous = process.cwd();
  try {
    process.chdir(dir);
    return buildCodeGraph('.').graph;
  } finally {
    process.chdir(previous);
  }
}

describe('exact import resolution', () => {
  it('does not link ./foo to foobar.ts', () => {
    const dir = makeTempDir('graph-prefix');
    try {
      writeFiles(dir, {
        'src/foo.ts': 'export class Foo {}\n',
        'src/foobar.ts': 'export class FooBar {}\n',
        'src/user.ts': "import { Foo } from './foo';\nexport class User {}\n",
      });
      const graph = buildIn(dir);
      const nodes = graph.nodes as Record<string, { importedBy: string[] }>;
      assert.deepEqual(nodes['src/foo.ts'].importedBy, ['src/user.ts']);
      assert.deepEqual(nodes['src/foobar.ts'].importedBy, []);
    } finally {
      removeDir(dir);
    }
  });

  it('resolves directory imports to index files', () => {
    const dir = makeTempDir('graph-index');
    try {
      writeFiles(dir, {
        'src/pkg/index.ts': 'export class Pkg {}\n',
        'src/user.ts': "import { Pkg } from './pkg';\nexport class User {}\n",
      });
      const graph = buildIn(dir);
      assert.deepEqual((graph.nodes as Record<string, { importedBy: string[] }>)['src/pkg/index.ts'].importedBy, [
        'src/user.ts',
      ]);
    } finally {
      removeDir(dir);
    }
  });

  it('returns null for unresolved and package imports', () => {
    const fileSet = new Set(['src/a.ts']);
    assert.equal(resolveImport('src/a.ts', 'react', fileSet), null);
    assert.equal(resolveImport('src/a.ts', './missing', fileSet), null);
    assert.equal(resolveImport('src/a.ts', './a', fileSet), 'src/a.ts');
  });

  it('detects direct circular dependencies from real edges', () => {
    const dir = makeTempDir('graph-cycle');
    try {
      writeFiles(dir, {
        'src/a.ts': "import { B } from './b';\nexport class A {}\n",
        'src/b.ts': "import { A } from './a';\nexport class B {}\n",
      });
      const graph = buildIn(dir);
      assert.deepEqual(graph.circularDependencies, ['src/a.ts <--> src/b.ts']);
    } finally {
      removeDir(dir);
    }
  });

  it('resolves Python relative imports', () => {
    const dir = makeTempDir('graph-python');
    try {
      writeFiles(dir, {
        'pkg/a.py': 'from .b import helper\n',
        'pkg/b.py': 'def helper():\n    return 1\n',
      });
      const graph = buildIn(dir);
      assert.deepEqual((graph.nodes as Record<string, { importedBy: string[] }>)['pkg/b.py'].importedBy, ['pkg/a.py']);
    } finally {
      removeDir(dir);
    }
  });
});

describe('tree-sitter symbol extraction', () => {
  it('extracts TypeScript/TSX and C#/Python/Go symbols', () => {
    const dir = makeTempDir('graph-langs');
    try {
      writeFiles(dir, {
        'a.tsx': 'export interface Props { id: string; }\nexport class View {}\nexport function render(): void {}\n',
        'b.cs': 'public interface IRepo {}\npublic class Repo {}\npublic record Dto(int Id);\ninternal struct Box {}\n',
        'c.py': 'class Service:\n    pass\n\ndef run():\n    pass\n\ndef __init__():\n    pass\n',
        'd.go':
          'package demo\ntype Store struct{}\ntype Reader interface{}\nfunc NewStore() Store { return Store{} }\n',
      });

      const tsx = extractSymbolsAndImports(path.join(dir, 'a.tsx'));
      assert.equal(tsx.parser, 'tree-sitter');
      assert.deepEqual(tsx.symbols.interfaces, ['Props']);
      assert.deepEqual(tsx.symbols.classes, ['View']);
      assert.deepEqual(tsx.symbols.functions, ['render']);

      const cs = extractSymbolsAndImports(path.join(dir, 'b.cs'));
      assert.deepEqual(cs.symbols.interfaces, ['IRepo']);
      assert.deepEqual(cs.symbols.classes, ['Repo', 'Dto', 'Box']);

      const py = extractSymbolsAndImports(path.join(dir, 'c.py'));
      assert.deepEqual(py.symbols.classes, ['Service']);
      assert.deepEqual(py.symbols.functions, ['run']);

      const go = extractSymbolsAndImports(path.join(dir, 'd.go'));
      assert.deepEqual(go.symbols.classes, ['Store']);
      assert.deepEqual(go.symbols.interfaces, ['Reader']);
      assert.deepEqual(go.symbols.functions, ['NewStore']);
    } finally {
      removeDir(dir);
    }
  });

  it('labels unknown extensions as heuristic', () => {
    const dir = makeTempDir('graph-unknown');
    try {
      writeFiles(dir, { 'notes.txt': 'export class Ignored {}\n' });
      const extracted = extractSymbolsAndImports(path.join(dir, 'notes.txt'));
      assert.equal(extracted.language, 'unknown');
      assert.equal(extracted.parser, 'heuristic');
      assert.deepEqual(extracted.symbols.classes, []);
    } finally {
      removeDir(dir);
    }
  });

  it('collects bare and relative import sources for boundary checks', () => {
    const dir = makeTempDir('graph-imports');
    try {
      writeFiles(dir, {
        'a.ts': "import express from 'express';\nimport { X } from './x';\nconst y = require('pg');\n",
        'b.py': 'import fastapi\nfrom ..core import value\n',
        'c.cs': 'using Microsoft.EntityFrameworkCore;\n',
        'd.go': 'package demo\nimport (\n  "net/http"\n  "gorm.io/gorm"\n)\n',
      });

      const ts = extractImportSources(path.join(dir, 'a.ts'));
      assert.ok(ts.sources.includes('express'));
      assert.ok(ts.sources.includes('./x'));
      assert.ok(ts.sources.includes('pg'));

      const py = extractImportSources(path.join(dir, 'b.py'));
      assert.ok(py.sources.includes('fastapi'));
      assert.ok(py.sources.includes('..core'));

      const cs = extractImportSources(path.join(dir, 'c.cs'));
      assert.ok(cs.sources.includes('Microsoft.EntityFrameworkCore'));

      const go = extractImportSources(path.join(dir, 'd.go'));
      assert.ok(go.sources.includes('net/http'));
      assert.ok(go.sources.includes('gorm.io/gorm'));
    } finally {
      removeDir(dir);
    }
  });
});

describe('graph artifacts', () => {
  it('records parser metadata in generated docs', () => {
    const dir = makeTempDir('graph-artifacts');
    try {
      writeFiles(dir, { 'src/a.ts': 'export class A {}\n' });
      const previous = process.cwd();
      try {
        process.chdir(dir);
        const { graph } = buildCodeGraph('.');
        assert.ok(graph.parsers['tree-sitter'] >= 1);
        const files = writeGraphArtifacts(graph);
        assert.ok(fs.existsSync(files.graphFile));
        assert.match(fs.readFileSync(files.repoMapFile, 'utf-8'), /tree-sitter \(1\)/);
      } finally {
        process.chdir(previous);
      }
    } finally {
      removeDir(dir);
    }
  });
});
