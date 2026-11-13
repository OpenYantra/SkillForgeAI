/**
 * SkillForge CLI: Graph Command
 * Symbol-level code graph generator with Mermaid diagram export.
 */

import fs from 'node:fs';
import path from 'node:path';
import { printBanner, printSuccess, printWarning, colors } from '../ui.mjs';
import { generateSliceMaps } from './slice.mjs';

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.agents', '.gemini', 'docs', 'bin', 'obj'
]);

export function scanFiles(dir, fileList = []) {
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

export function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.cs': return 'csharp';
    case '.py': return 'python';
    case '.go': return 'go';
    case '.ts':
    case '.tsx':
    case '.js':
    case '.mjs':
    case '.jsx': return 'typescript';
    default: return 'unknown';
  }
}

export function extractSymbolsAndImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lang = detectLanguage(filePath);
  const symbols = { classes: [], interfaces: [], types: [], functions: [] };
  const internalImports = [];

  if (lang === 'typescript') {
    const classMatches = content.matchAll(/(?:export\s+)?class\s+([A-Za-z0-9_]+)/g);
    for (const m of classMatches) symbols.classes.push(m[1]);

    const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+([A-Za-z0-9_]+)/g);
    for (const m of interfaceMatches) symbols.interfaces.push(m[1]);

    const typeMatches = content.matchAll(/(?:export\s+)?type\s+([A-Za-z0-9_]+)/g);
    for (const m of typeMatches) symbols.types.push(m[1]);

    const funcMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/g);
    for (const m of funcMatches) symbols.functions.push(m[1]);

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
    const classMatches = content.matchAll(/(?:public|internal)\s+(?:abstract\s+|sealed\s+|static\s+)?(?:class|record)\s+([A-Za-z0-9_]+)/g);
    for (const m of classMatches) symbols.classes.push(m[1]);

    const interfaceMatches = content.matchAll(/(?:public|internal)\s+interface\s+([A-Za-z0-9_]+)/g);
    for (const m of interfaceMatches) symbols.interfaces.push(m[1]);
  } else if (lang === 'python') {
    const classMatches = content.matchAll(/^class\s+([A-Za-z0-9_]+)/gm);
    for (const m of classMatches) symbols.classes.push(m[1]);

    const funcMatches = content.matchAll(/^def\s+([A-Za-z0-9_]+)/gm);
    for (const m of funcMatches) {
      if (!m[1].startsWith('__')) symbols.functions.push(m[1]);
    }
  } else if (lang === 'go') {
    const structMatches = content.matchAll(/type\s+([A-Za-z0-9_]+)\s+struct/g);
    for (const m of structMatches) symbols.classes.push(m[1]);

    const ifaceMatches = content.matchAll(/type\s+([A-Za-z0-9_]+)\s+interface/g);
    for (const m of ifaceMatches) symbols.interfaces.push(m[1]);

    const funcMatches = content.matchAll(/func\s+(?:\([A-Za-z0-9_\s*]+\)\s+)?([A-Za-z0-9_]+)\s*\(/g);
    for (const m of funcMatches) symbols.functions.push(m[1]);
  }

  return { symbols, internalImports, language: lang };
}

function buildMermaidDiagram(graph) {
  let mermaid = '```mermaid\nflowchart TD\n';
  const nodes = Object.entries(graph.nodes);
  
  for (const [nodePath, data] of nodes) {
    if (nodePath.startsWith('examples/') || nodePath.startsWith('src/')) {
      const nodeId = nodePath.replace(/[^a-zA-Z0-9]/g, '_');
      const label = path.basename(nodePath);
      mermaid += `    ${nodeId}["${label}"]\n`;
      
      for (const caller of data.importedBy) {
        if (caller.startsWith('examples/') || caller.startsWith('src/')) {
          const callerId = caller.replace(/[^a-zA-Z0-9]/g, '_');
          mermaid += `    ${callerId} --> ${nodeId}\n`;
        }
      }
    }
  }
  mermaid += '```\n';
  return mermaid;
}

export function buildCodeGraph(targetDir = '.') {
  const files = scanFiles(targetDir);
  const normalizedFiles = new Set(files.map(f => f.replace(/\\/g, '/')));

  const graph = {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    languages: {},
    nodes: {},
    circularDependencies: [],
  };

  for (const file of files) {
    const normFile = file.replace(/\\/g, '/');
    const { symbols, internalImports, language } = extractSymbolsAndImports(file);
    graph.languages[language] = (graph.languages[language] || 0) + 1;
    graph.nodes[normFile] = { language, symbols, imports: internalImports, importedBy: [] };
  }

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

  for (const [nodeA, dataA] of Object.entries(graph.nodes)) {
    for (const nodeB of dataA.imports) {
      for (const knownB of normalizedFiles) {
        if (knownB.startsWith(nodeB) && graph.nodes[knownB]?.imports.some(imp => imp.startsWith(nodeA) || nodeA.startsWith(imp))) {
          const pair = [nodeA, knownB].sort().join(' <--> ');
          if (!graph.circularDependencies.includes(pair)) {
            graph.circularDependencies.push(pair);
          }
        }
      }
    }
  }

  return { graph, files, normalizedFiles };
}

export function generateRepoMapMarkdown(graph) {
  let repoMapMarkdown = `# Repository Code Map & Architecture Context
*Auto-generated by SkillForgeAI. Read this file instead of re-scanning entire repository source.*
- **Last Updated:** ${graph.generatedAt}
- **Total Source Files:** ${graph.totalFiles}
- **Detected Stacks:** ${Object.entries(graph.languages).map(([l, c]) => `${l} (${c})`).join(', ')}
- **Circular Dependencies:** ${graph.circularDependencies.length === 0 ? 'None (Clean)' : graph.circularDependencies.length}

## Module & Symbol Directory

| File / Component | Declared Public Symbols | Depended On By (Callers) |
| :--- | :--- | :--- |
`;

  for (const [node, data] of Object.entries(graph.nodes)) {
    if (node.startsWith('examples/') || node.startsWith('src/')) {
      const symList = [
        ...data.symbols.classes.map(c => `\`class ${c}\``),
        ...data.symbols.interfaces.map(i => `\`interface ${i}\``),
        ...data.symbols.types.map(t => `\`type ${t}\``),
        ...data.symbols.functions.map(f => `\`fn ${f}()\``),
      ];
      const symbolsStr = symList.length > 0 ? symList.join(', ') : '*None (Config / Script)*';
      const callers = data.importedBy.map(c => path.basename(c)).join(', ') || 'None (Entrypoint/Root)';
      repoMapMarkdown += `| \`${node}\` | ${symbolsStr} | ${callers} |\n`;
    }
  }

  if (graph.circularDependencies.length > 0) {
    repoMapMarkdown += `\n## ⚠️ Circular Dependency Warnings\n`;
    graph.circularDependencies.forEach(circ => {
      repoMapMarkdown += `- \`${circ}\`\n`;
    });
  }

  return repoMapMarkdown;
}

export function executeGraph(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  skillforge graph [options]

Options:
  --format <md|json|mermaid>  Output format (default: all saved to docs/context/)
  --output <path>             Custom output file destination
  --detect-orphans            Highlight unreferenced classes/interfaces
  --help, -h                  Show this help message

Examples:
  skillforge graph
  skillforge graph --format mermaid
  skillforge graph --format json
`);
    process.exit(0);
  }

  const formatIndex = args.indexOf('--format');
  const format = formatIndex !== -1 ? args[formatIndex + 1]?.toLowerCase() : 'all';

  const { graph, files } = buildCodeGraph('.');

  const contextDir = path.join('docs', 'context');
  if (!fs.existsSync(contextDir)) fs.mkdirSync(contextDir, { recursive: true });

  fs.writeFileSync(path.join(contextDir, 'code-graph.json'), JSON.stringify(graph, null, 2));

  const repoMapMarkdown = generateRepoMapMarkdown(graph);
  fs.writeFileSync(path.join(contextDir, 'REPO-MAP.md'), repoMapMarkdown);

  if (format === 'mermaid') {
    const mermaid = buildMermaidDiagram(graph);
    console.log(mermaid);
    process.exit(0);
  } else if (format === 'json') {
    console.log(JSON.stringify(graph, null, 2));
    process.exit(0);
  } else if (format === 'markdown' || format === 'md') {
    console.log(repoMapMarkdown);
    process.exit(0);
  }

  printBanner('🔍 SkillForgeAI: Symbol-Level Code Graph');
  console.log(`Scanned ${colors.bold}${files.length}${colors.reset} total source files across: ${Object.entries(graph.languages).map(([l, c]) => `${l} (${c})`).join(', ')}`);
  printSuccess(`Wrote ${path.join(contextDir, 'code-graph.json')}`);
  printSuccess(`Wrote ${path.join(contextDir, 'REPO-MAP.md')} (Token-efficient symbol directory)`);

  const { analyzedSlices, globalStats } = generateSliceMaps(graph);
  printSuccess(`Partitioned ${analyzedSlices.length} domain slices in docs/context/slices/ (${globalStats.tokenSavingsPct}% context savings)\n`);
}
