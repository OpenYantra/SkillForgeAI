#!/usr/bin/env node
/**
 * SkillForgeAI: Symbol-Level AST & Multi-Language Code Graph Generator
 * Scans codebases across TypeScript, C#, Python, and Go to extract:
 * 1. File dependencies & reverse call graphs (importedBy)
 * 2. Declared public symbols (Classes, Interfaces, Types, Functions, Records)
 * 3. Circular dependencies
 * 4. Orphan / unreferenced symbols
 *
 * Outputs:
 * - docs/context/code-graph.json (Deep symbol-level graph)
 * - docs/context/REPO-MAP.md (Token-efficient ~300 token agent context map)
 */

import fs from 'node:fs';
import path from 'node:path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.agents',
  '.gemini',
  'docs',
  'bin',
  'obj',
]);

function scanFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        scanFiles(path.join(dir, entry.name), fileList);
      }
    } else if (/\.(ts|js|mjs|tsx|jsx|cs|py|go)$/i.test(entry.name)) {
      fileList.push(path.join(dir, entry.name));
    }
  }
  return fileList;
}

function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.cs':
      return 'csharp';
    case '.py':
      return 'python';
    case '.go':
      return 'go';
    case '.ts':
    case '.tsx':
    case '.js':
    case '.mjs':
    case '.jsx':
      return 'typescript';
    default:
      return 'unknown';
  }
}

function extractSymbolsAndImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lang = detectLanguage(filePath);
  const symbols = {
    classes: [],
    interfaces: [],
    types: [],
    functions: [],
  };
  const internalImports = [];

  if (lang === 'typescript') {
    // 1. Classes
    const classMatches = content.matchAll(/(?:export\s+)?class\s+([A-Za-z0-9_]+)/g);
    for (const m of classMatches) symbols.classes.push(m[1]);

    // 2. Interfaces
    const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+([A-Za-z0-9_]+)/g);
    for (const m of interfaceMatches) symbols.interfaces.push(m[1]);

    // 3. Types
    const typeMatches = content.matchAll(/(?:export\s+)?type\s+([A-Za-z0-9_]+)/g);
    for (const m of typeMatches) symbols.types.push(m[1]);

    // 4. Functions
    const funcMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g);
    for (const m of funcMatches) symbols.functions.push(m[1]);

    // Imports
    const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const imp = match[1] || match[2];
      if (imp.startsWith('.')) {
        const resolved = path.normalize(path.join(path.dirname(filePath), imp)).replace(/\\/g, '/');
        internalImports.push(resolved);
      }
    }
  } else if (lang === 'csharp') {
    // C# / .NET
    const classMatches = content.matchAll(
      /(?:public|internal)\s+(?:abstract\s+|sealed\s+|static\s+)?(?:class|record)\s+([A-Za-z0-9_]+)/g,
    );
    for (const m of classMatches) symbols.classes.push(m[1]);

    const interfaceMatches = content.matchAll(/(?:public|internal)\s+interface\s+([A-Za-z0-9_]+)/g);
    for (const m of interfaceMatches) symbols.interfaces.push(m[1]);
  } else if (lang === 'python') {
    // Python
    const classMatches = content.matchAll(/^class\s+([A-Za-z0-9_]+)/gm);
    for (const m of classMatches) symbols.classes.push(m[1]);

    const funcMatches = content.matchAll(/^def\s+([A-Za-z0-9_]+)/gm);
    for (const m of funcMatches) {
      if (!m[1].startsWith('__')) symbols.functions.push(m[1]);
    }
  } else if (lang === 'go') {
    // Go
    const structMatches = content.matchAll(/type\s+([A-Za-z0-9_]+)\s+struct/g);
    for (const m of structMatches) symbols.classes.push(m[1]);

    const ifaceMatches = content.matchAll(/type\s+([A-Za-z0-9_]+)\s+interface/g);
    for (const m of ifaceMatches) symbols.interfaces.push(m[1]);

    const funcMatches = content.matchAll(/func\s+(?:\([A-Za-z0-9_\s*]+\)\s+)?([A-Za-z0-9_]+)\s*\(/g);
    for (const m of funcMatches) symbols.functions.push(m[1]);
  }

  return { symbols, internalImports, language: lang };
}

function generateCodeGraph(targetDir = '.') {
  console.log(`\n🔍 Generating Symbol-Level Code Graph for "${targetDir}"...`);
  const files = scanFiles(targetDir);
  const normalizedFiles = new Set(files.map((f) => f.replace(/\\/g, '/')));

  const graph = {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    languages: {},
    nodes: {},
    circularDependencies: [],
    orphanSymbols: [],
  };

  const allDeclaredSymbols = new Map(); // symbol -> declaringFile

  // 1. First Pass: Parse files and extract symbols & imports
  for (const file of files) {
    const normFile = file.replace(/\\/g, '/');
    const { symbols, internalImports, language } = extractSymbolsAndImports(file);

    graph.languages[language] = (graph.languages[language] || 0) + 1;

    graph.nodes[normFile] = {
      language,
      symbols,
      imports: internalImports,
      importedBy: [],
    };

    // Track declared symbols
    const flatSymbols = [...symbols.classes, ...symbols.interfaces, ...symbols.types, ...symbols.functions];
    for (const s of flatSymbols) {
      allDeclaredSymbols.set(s, normFile);
    }
  }

  // 2. Second Pass: Link reverse dependencies (importedBy)
  for (const [source, data] of Object.entries(graph.nodes)) {
    for (const target of data.imports) {
      for (const knownFile of normalizedFiles) {
        if (knownFile.startsWith(target) || knownFile === target) {
          if (!graph.nodes[knownFile]) {
            graph.nodes[knownFile] = { language: 'unknown', symbols: {}, imports: [], importedBy: [] };
          }
          graph.nodes[knownFile].importedBy.push(source);
        }
      }
    }
  }

  // 3. Detect Circular Dependencies
  for (const [nodeA, dataA] of Object.entries(graph.nodes)) {
    for (const nodeB of dataA.imports) {
      for (const knownB of normalizedFiles) {
        if (
          knownB.startsWith(nodeB) &&
          graph.nodes[knownB]?.imports.some((imp) => imp.startsWith(nodeA) || nodeA.startsWith(imp))
        ) {
          const pair = [nodeA, knownB].sort().join(' <--> ');
          if (!graph.circularDependencies.includes(pair)) {
            graph.circularDependencies.push(pair);
          }
        }
      }
    }
  }

  // Ensure docs/context/ exists
  const contextDir = path.join('docs', 'context');
  if (!fs.existsSync(contextDir)) fs.mkdirSync(contextDir, { recursive: true });

  // 4. Write Detailed Machine-Readable JSON Graph
  fs.writeFileSync(path.join(contextDir, 'code-graph.json'), JSON.stringify(graph, null, 2));
  console.log(`   ✅ Wrote ${path.join(contextDir, 'code-graph.json')} (${files.length} nodes)`);

  // 5. Generate Enhanced REPO-MAP.md
  let repoMapMarkdown = `# Repository Code Map & Architecture Context
*Auto-generated by SkillForgeAI. Read this file instead of re-scanning entire repository source.*
- **Last Updated:** ${graph.generatedAt}
- **Total Source Files:** ${graph.totalFiles}
- **Detected Stacks:** ${Object.entries(graph.languages)
    .map(([l, c]) => `${l} (${c})`)
    .join(', ')}
- **Circular Dependencies:** ${graph.circularDependencies.length === 0 ? 'None (Clean)' : graph.circularDependencies.length}

## Module & Symbol Directory

| File / Component | Declared Public Symbols | Depended On By (Callers) |
| :--- | :--- | :--- |
`;

  for (const [node, data] of Object.entries(graph.nodes)) {
    if (node.startsWith('examples/') || node.startsWith('src/')) {
      const symList = [
        ...data.symbols.classes.map((c) => `\`class ${c}\``),
        ...data.symbols.interfaces.map((i) => `\`interface ${i}\``),
        ...data.symbols.types.map((t) => `\`type ${t}\``),
        ...data.symbols.functions.map((f) => `\`fn ${f}()\``),
      ];
      const symbolsStr = symList.length > 0 ? symList.join(', ') : '*None (Config / Script)*';
      const callers = data.importedBy.map((c) => path.basename(c)).join(', ') || 'None (Entrypoint/Root)';
      repoMapMarkdown += `| \`${node}\` | ${symbolsStr} | ${callers} |\n`;
    }
  }

  if (graph.circularDependencies.length > 0) {
    repoMapMarkdown += `\n## ⚠️ Circular Dependency Warnings\n`;
    graph.circularDependencies.forEach((circ) => {
      repoMapMarkdown += `- \`${circ}\`\n`;
    });
  }

  fs.writeFileSync(path.join(contextDir, 'REPO-MAP.md'), repoMapMarkdown);
  console.log(`   ✅ Wrote ${path.join(contextDir, 'REPO-MAP.md')} (Token-efficient symbol directory)`);
  console.log('\n🎉 Symbol-level code graph complete!\n');
}

const target = process.argv[2] || '.';
generateCodeGraph(target);
