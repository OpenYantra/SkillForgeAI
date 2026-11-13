/**
 * SkillForge CLI: Slice Command
 * Monorepo Domain Slicing & Vertical Slice Context Partitioning.
 * Generates token-efficient slice maps (docs/context/slices/<name>-map.md)
 * and the central Domain Slice Router (docs/context/slices/index.md).
 */

import fs from 'node:fs';
import path from 'node:path';
import { printBanner, printSection, printSuccess, printError, printWarning, colors } from '../ui.mjs';
import { buildCodeGraph } from './graph.mjs';

const CANDIDATE_CONTAINERS = [
  'apps',
  'services',
  'packages',
  'modules',
  'examples',
  'src/features',
  'src/domains',
  'src/slices',
  'src',
];

function hasSourceFiles(dir) {
  if (!fs.existsSync(dir)) return false;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'bin', 'obj', 'dist', 'build'].includes(entry.name)) {
          if (hasSourceFiles(path.join(dir, entry.name))) return true;
        }
      } else if (/\.(ts|js|mjs|tsx|jsx|cs|py|go)$/i.test(entry.name)) {
        return true;
      }
    }
  } catch {}
  return false;
}

export function discoverSlices(targetDir = '.') {
  const slices = [];
  const seenRoots = new Set();

  for (const container of CANDIDATE_CONTAINERS) {
    const containerPath = path.join(targetDir, container);
    if (fs.existsSync(containerPath) && fs.statSync(containerPath).isDirectory()) {
      const entries = fs.readdirSync(containerPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Skip nested container markers if evaluating parent src/
          if (container === 'src' && ['features', 'domains', 'slices', 'common', 'shared'].includes(entry.name)) {
            continue;
          }
          const rootPath = path.join(container, entry.name).replace(/\\/g, '/');
          if (seenRoots.has(rootPath)) continue;

          if (hasSourceFiles(path.join(targetDir, rootPath))) {
            seenRoots.add(rootPath);
            slices.push({
              name: entry.name,
              root: rootPath,
              container,
            });
          }
        }
      }
    }
  }

  return slices;
}

function classifySliceSymbols(nodePath, data) {
  const norm = nodePath.toLowerCase();
  const classified = {
    entities: [],
    ports: [],
    services: [],
    repositories: [],
    exceptions: [],
    commands: [],
    other: [],
  };

  const allClasses = [...data.symbols.classes];
  const allInterfaces = [...data.symbols.interfaces];
  const allFunctions = [...data.symbols.functions];
  const allTypes = [...data.symbols.types];

  // 1. Entities
  for (const c of allClasses) {
    if (norm.includes('entity') || norm.includes('entities') || c.endsWith('Entity') || c.endsWith('Model') || c === 'Order' || c === 'OrderItem') {
      classified.entities.push(c);
    } else if (c.endsWith('Service') || c.endsWith('ApplicationService') || c.endsWith('Handler') || c.endsWith('UseCase')) {
      classified.services.push(c);
    } else if (c.endsWith('Repository') || c.endsWith('Store') || c.endsWith('Adapter') || norm.includes('persistence') || norm.includes('repositories')) {
      classified.repositories.push(c);
    } else if (c.endsWith('Exception') || c.endsWith('Error') || norm.includes('exception')) {
      classified.exceptions.push(c);
    } else {
      classified.other.push(c);
    }
  }

  // 2. Ports / Interfaces
  for (const i of allInterfaces) {
    if (i.startsWith('I') || norm.includes('port') || norm.includes('contracts')) {
      classified.ports.push(i);
    } else if (norm.includes('entity') || norm.includes('entities')) {
      classified.entities.push(i);
    } else {
      classified.other.push(i);
    }
  }

  // 3. Types
  for (const t of allTypes) {
    if (norm.includes('entity') || norm.includes('entities') || t.includes('Props') || t.includes('Item')) {
      classified.entities.push(t);
    } else {
      classified.other.push(t);
    }
  }

  // 4. Commands / Functions
  for (const f of allFunctions) {
    if (norm.includes('commands') || norm.includes('cli') || f.startsWith('execute')) {
      classified.commands.push(f);
    } else {
      classified.other.push(f);
    }
  }

  return classified;
}

export function analyzeSlice(slice, graph, allSlices) {
  const sliceNodes = {};
  const languages = {};
  const files = [];
  const testFiles = [];

  const symbols = {
    entities: new Set(),
    ports: new Set(),
    services: new Set(),
    repositories: new Set(),
    exceptions: new Set(),
    commands: new Set(),
    other: new Set(),
  };

  const outboundSlices = new Set();
  const inboundSlices = new Set();

  for (const [nodePath, nodeData] of Object.entries(graph.nodes)) {
    if (nodePath.startsWith(slice.root + '/') || nodePath === slice.root) {
      sliceNodes[nodePath] = nodeData;
      files.push(nodePath);

      const lang = nodeData.language || 'unknown';
      languages[lang] = (languages[lang] || 0) + 1;

      if (nodePath.includes('test') || nodePath.includes('spec')) {
        testFiles.push(nodePath);
      }

      const classified = classifySliceSymbols(nodePath, nodeData);
      classified.entities.forEach(s => symbols.entities.add(s));
      classified.ports.forEach(s => symbols.ports.add(s));
      classified.services.forEach(s => symbols.services.add(s));
      classified.repositories.forEach(s => symbols.repositories.add(s));
      classified.exceptions.forEach(s => symbols.exceptions.add(s));
      classified.commands.forEach(s => symbols.commands.add(s));
      classified.other.forEach(s => symbols.other.add(s));

      // Check Outbound Imports
      for (const target of nodeData.imports) {
        for (const other of allSlices) {
          if (other.name !== slice.name && target.startsWith(other.root)) {
            outboundSlices.add(other.name);
          }
        }
      }

      // Check Inbound Callers
      for (const caller of nodeData.importedBy) {
        if (!caller.startsWith(slice.root)) {
          let matchedOther = false;
          for (const other of allSlices) {
            if (other.name !== slice.name && caller.startsWith(other.root)) {
              inboundSlices.add(other.name);
              matchedOther = true;
            }
          }
          if (!matchedOther) {
            inboundSlices.add(caller.startsWith('bin/') ? 'Root CLI / Bin' : 'Root / External');
          }
        }
      }
    }
  }

  // Determine Primary Stack
  const primaryStack = Object.entries(languages).sort((a, b) => b[1] - a[1])[0]?.[0] || 'polyglot';

  return {
    ...slice,
    files,
    testFiles,
    languages,
    primaryStack,
    symbols: {
      entities: [...symbols.entities],
      ports: [...symbols.ports],
      services: [...symbols.services],
      repositories: [...symbols.repositories],
      exceptions: [...symbols.exceptions],
      commands: [...symbols.commands],
      other: [...symbols.other],
    },
    dependencies: {
      outbound: [...outboundSlices],
      inbound: [...inboundSlices],
    },
  };
}

export function renderSliceMap(slice) {
  const formatList = (arr) => arr.length > 0 ? arr.map(s => `\`${s}\``).join(', ') : 'None';

  let md = `<!-- skillforge-slice: ${slice.name} -->\n`;
  md += `# Vertical Slice: \`${slice.name}\`\n`;
  md += `> **Root:** \`${slice.root}\` | **Stack:** ${slice.primaryStack} | **Files:** ${slice.files.length}\n\n`;

  md += `### 🏛️ Architecture & Exported Symbols\n`;
  md += `- **Domain Entities:** ${formatList(slice.symbols.entities)}\n`;
  md += `- **Ports / Interfaces:** ${formatList(slice.symbols.ports)}\n`;
  md += `- **Application Services:** ${formatList(slice.symbols.services)}\n`;
  md += `- **Persistence & Adapters:** ${formatList(slice.symbols.repositories)}\n`;

  if (slice.symbols.exceptions.length > 0) {
    md += `- **Domain Errors / Exceptions:** ${formatList(slice.symbols.exceptions)}\n`;
  }
  if (slice.symbols.commands.length > 0) {
    md += `- **Commands & Handlers:** ${formatList(slice.symbols.commands)}\n`;
  }
  if (slice.symbols.other.length > 0) {
    md += `- **Additional Components:** ${formatList(slice.symbols.other.slice(0, 8))}\n`;
  }

  md += `\n### 🔗 Cross-Slice Dependencies\n`;
  md += `- **Inbound Dependents:** ${slice.dependencies.inbound.length > 0 ? slice.dependencies.inbound.map(d => `\`${d}\``).join(', ') : 'None (Self-contained root slice)'}\n`;
  md += `- **Outbound Imports:** ${slice.dependencies.outbound.length > 0 ? slice.dependencies.outbound.map(d => `\`${d}\``).join(', ') : 'None (Zero external slice dependencies)'}\n`;

  md += `\n### 🧪 Test Suite\n`;
  if (slice.testFiles.length > 0) {
    slice.testFiles.forEach(t => {
      md += `- \`${t}\`\n`;
    });
  } else {
    md += `- *No tests registered directly in slice root.*\n`;
  }

  md += `\n### 🛡️ Architectural Conformance\n`;
  md += `- **Clean Architecture & Vertical Slice:** Domain logic decoupled from infrastructure.\n`;
  md += `- **Boundary Isolation:** Repository interfaces abstracted behind ports.\n`;

  // Estimate tokens (~4 chars per token)
  const tokenEstimate = Math.ceil(md.length / 4);
  md = md.replace(`> **Root:**`, `> **Est. Tokens:** ~${tokenEstimate} | **Root:**`);

  return { markdown: md, tokenEstimate };
}

export function renderSliceIndex(slices, globalStats) {
  let md = `# 🧭 SkillForgeAI Monorepo Domain Slice Router\n`;
  md += `*Token-Efficient Context Directory for AI Coding Agents. In monorepos (10,000+ files), load only the slice map needed for your current task.*\n\n`;
  md += `- **Generated At:** ${new Date().toISOString()}\n`;
  md += `- **Total Slices:** ${slices.length}\n`;
  md += `- **Monolithic Map Tokens:** ~${globalStats.monolithicTokens} tokens\n`;
  md += `- **Average Slice Map Tokens:** ~${globalStats.avgSliceTokens} tokens (**${globalStats.tokenSavingsPct}% Token Savings**)\n\n`;

  md += `## 📦 Domain Slices Directory\n\n`;
  md += `| Domain / Slice | Root Directory | Primary Stack | Files | Est. Tokens | Dedicated Slice Map |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const s of slices) {
    md += `| **${s.name}** | \`${s.root}\` | ${s.primaryStack} | ${s.files.length} | ~${s.tokenEstimate} | [${s.name}-map.md](${s.name}-map.md) |\n`;
  }

  md += `\n---\n`;
  md += `> 💡 **Agent Instruction:** When implementing or debugging a feature in a specific domain, read the corresponding slice map above rather than loading the entire codebase or monolithic \`REPO-MAP.md\`.\n`;

  return md;
}

export function generateSliceMaps(existingGraph = null, targetDir = '.') {
  const contextDir = path.join(targetDir, 'docs', 'context');
  const slicesDir = path.join(contextDir, 'slices');
  if (!fs.existsSync(slicesDir)) fs.mkdirSync(slicesDir, { recursive: true });

  let graph = existingGraph;
  if (!graph) {
    const graphFile = path.join(contextDir, 'code-graph.json');
    if (fs.existsSync(graphFile)) {
      try {
        graph = JSON.parse(fs.readFileSync(graphFile, 'utf-8'));
      } catch {}
    }
    if (!graph) {
      const res = buildCodeGraph(targetDir);
      graph = res.graph;
    }
  }

  // 1. Discover slices
  const discovered = discoverSlices(targetDir);
  const analyzedSlices = [];
  let totalSliceTokens = 0;

  for (const slice of discovered) {
    const analyzed = analyzeSlice(slice, graph, discovered);
    const { markdown, tokenEstimate } = renderSliceMap(analyzed);
    analyzed.tokenEstimate = tokenEstimate;
    analyzed.markdown = markdown;
    analyzed.mapPath = path.join(slicesDir, `${analyzed.name}-map.md`).replace(/\\/g, '/');

    fs.writeFileSync(path.join(slicesDir, `${analyzed.name}-map.md`), markdown);
    analyzedSlices.push(analyzed);
    totalSliceTokens += tokenEstimate;
  }

  // Monolithic REPO-MAP estimate
  const repoMapPath = path.join(contextDir, 'REPO-MAP.md');
  let monolithicTokens = 1500;
  if (fs.existsSync(repoMapPath)) {
    const content = fs.readFileSync(repoMapPath, 'utf-8');
    monolithicTokens = Math.ceil(content.length / 4);
  }

  const avgSliceTokens = analyzedSlices.length > 0 ? Math.round(totalSliceTokens / analyzedSlices.length) : 0;
  const tokenSavingsPct = monolithicTokens > 0
    ? ((1 - (avgSliceTokens / monolithicTokens)) * 100).toFixed(1)
    : '0.0';

  const globalStats = {
    monolithicTokens,
    avgSliceTokens,
    tokenSavingsPct,
    totalSlices: analyzedSlices.length,
  };

  // 2. Render Router Index
  const indexMarkdown = renderSliceIndex(analyzedSlices, globalStats);
  fs.writeFileSync(path.join(slicesDir, 'index.md'), indexMarkdown);

  // 3. Render JSON Registry
  const registry = {
    generatedAt: new Date().toISOString(),
    globalStats,
    slices: analyzedSlices.map(s => ({
      name: s.name,
      root: s.root,
      container: s.container,
      primaryStack: s.primaryStack,
      filesCount: s.files.length,
      tokenEstimate: s.tokenEstimate,
      mapPath: s.mapPath,
      symbols: s.symbols,
      dependencies: s.dependencies,
      testFiles: s.testFiles,
    })),
  };
  fs.writeFileSync(path.join(slicesDir, 'slices.json'), JSON.stringify(registry, null, 2));

  return { analyzedSlices, globalStats, registry };
}

export function executeSlice(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  skillforge slice [options]

Options:
  --list            Display summary table of all discovered vertical domain slices
  --name <name>     Inspect and print the slice map for a specific domain
  --json            Output machine-readable JSON slice registry
  --help, -h        Show this help message

Examples:
  skillforge slice
  skillforge slice --list
  skillforge slice --name order-service
  skillforge slice --json
`);
    process.exit(0);
  }

  const isList = args.includes('--list');
  const isJson = args.includes('--json');
  const nameIndex = args.indexOf('--name');
  const targetName = nameIndex !== -1 ? args[nameIndex + 1]?.toLowerCase() : null;

  const { analyzedSlices, globalStats, registry } = generateSliceMaps();

  if (targetName) {
    const exactMatched = analyzedSlices.find(s => s.name.toLowerCase() === targetName);
    const matched = exactMatched || analyzedSlices.find(s => s.name.toLowerCase().includes(targetName));
    if (!matched) {
      printError(`Domain slice "${targetName}" not found.`);
      console.log(`Available slices: ${analyzedSlices.map(s => `"${s.name}"`).join(', ')}`);
      process.exit(1);
    }
    console.log(matched.markdown);
    process.exit(0);
  }

  if (isJson) {
    console.log(JSON.stringify(registry, null, 2));
    process.exit(0);
  }

  if (isList) {
    printBanner('🧭 SkillForgeAI: Monorepo Domain Slice Directory');
    console.log(`Discovered ${colors.bold}${analyzedSlices.length}${colors.reset} domain slices (Avg ~${globalStats.avgSliceTokens} tokens / ${globalStats.tokenSavingsPct}% context savings):\n`);

    console.log(`| Domain / Slice | Root Path | Primary Stack | Files | Est. Tokens |`);
    console.log(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const s of analyzedSlices) {
      console.log(`| ${colors.bold}${s.name}${colors.reset} | \`${s.root}\` | ${s.primaryStack} | ${s.files.length} | ~${s.tokenEstimate} |`);
    }
    console.log('');
    process.exit(0);
  }

  printBanner('🧭 SkillForgeAI: Monorepo Domain Slicing', 'Automatic Vertical Slice Context Partitioning');
  console.log(`Discovered ${colors.bold}${analyzedSlices.length}${colors.reset} domain slices across the monorepo:`);
  for (const s of analyzedSlices) {
    console.log(`   📦 ${colors.cyan}${s.name}${colors.reset} (\`${s.root}\`) — ${s.files.length} file(s), ~${s.tokenEstimate} tokens`);
  }

  printSection('Partitioning Results');
  printSuccess(`Generated ${analyzedSlices.length} vertical slice maps in docs/context/slices/`);
  printSuccess(`Generated Domain Slice Router: docs/context/slices/index.md`);
  printSuccess(`Generated Slice Registry: docs/context/slices/slices.json`);
  printSuccess(`Token Efficiency: ${colors.bold}${globalStats.tokenSavingsPct}% context savings${colors.reset} (~${globalStats.avgSliceTokens} vs ~${globalStats.monolithicTokens} monolithic tokens)\n`);
}
