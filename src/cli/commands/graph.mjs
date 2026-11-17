/**
 * SkillForge CLI: Graph Command
 * CLI rendering for the shared code-graph engine (`src/core/code-graph.mjs`).
 */

import path from 'node:path';
import { printBanner, printSuccess, colors } from '../ui.mjs';
import { generateSliceMaps } from './slice.mjs';
import { checkContextArtifacts } from '../context-check.mjs';
import {
  IGNORED_DIRS,
  scanFiles,
  detectLanguage,
  extractSymbolsAndImports,
  buildCodeGraph,
  buildMermaidDiagram,
  generateRepoMapMarkdown,
  writeGraphArtifacts,
} from '../../core/code-graph.mjs';

export {
  IGNORED_DIRS,
  scanFiles,
  detectLanguage,
  extractSymbolsAndImports,
  buildCodeGraph,
  buildMermaidDiagram,
  generateRepoMapMarkdown,
};

export function executeGraph(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  skillforge graph [options]

Options:
  --format <md|json|mermaid>  Output format (default: all saved to docs/context/)
  --output <path>             Custom output file destination
  --detect-orphans            Highlight unreferenced classes/interfaces
  --check                     Verify docs/context is up to date without writing
  --help, -h                  Show this help message

Parsing:
  TypeScript/JavaScript, C#, Python and Go are parsed with tree-sitter.
  If a grammar binding is unavailable the tool falls back to a documented
  heuristic scan and labels those nodes accordingly.

Examples:
  skillforge graph
  skillforge graph --format mermaid
  skillforge graph --format json
`);
    process.exit(0);
  }

  const formatIndex = args.indexOf('--format');
  const format = formatIndex !== -1 ? args[formatIndex + 1]?.toLowerCase() : 'all';

  if (args.includes('--check')) {
    const result = checkContextArtifacts('.');
    if (result.ok) {
      printSuccess(`Context artifacts are up to date (${result.checked} files checked).`);
      process.exit(0);
    }

    console.error(`${colors.red}❌ Generated context is stale (${result.stale.length} file(s)):${colors.reset}`);
    for (const entry of result.stale) {
      console.error(`   - ${entry.file}: ${entry.reason}`);
      if (entry.expected !== undefined || entry.actual !== undefined) {
        console.error(`     committed: ${entry.expected}`);
        console.error(`     generated: ${entry.actual}`);
      }
    }
    console.error('\nRun "node bin/skillforge.mjs graph" to regenerate docs/context.\n');
    process.exit(1);
  }

  const { graph, files } = buildCodeGraph('.');

  const contextDir = path.join('docs', 'context');
  writeGraphArtifacts(graph, contextDir);

  if (format === 'mermaid') {
    console.log(buildMermaidDiagram(graph));
    process.exit(0);
  } else if (format === 'json') {
    console.log(JSON.stringify(graph, null, 2));
    process.exit(0);
  } else if (format === 'markdown' || format === 'md') {
    console.log(generateRepoMapMarkdown(graph));
    process.exit(0);
  }

  printBanner('🔍 SkillForgeAI: Symbol-Level Code Graph');
  console.log(
    `Scanned ${colors.bold}${files.length}${colors.reset} total source files across: ${Object.entries(graph.languages)
      .map(([l, c]) => `${l} (${c})`)
      .join(', ')}`,
  );
  console.log(
    `Parsers: ${Object.entries(graph.parsers)
      .map(([p, c]) => `${p} (${c})`)
      .join(', ')}`,
  );
  printSuccess(`Wrote ${path.join(contextDir, 'code-graph.json')}`);
  printSuccess(`Wrote ${path.join(contextDir, 'REPO-MAP.md')} (Token-efficient symbol directory)`);

  const { analyzedSlices, globalStats } = generateSliceMaps(graph);
  printSuccess(
    `Partitioned ${analyzedSlices.length} domain slices in docs/context/slices/ (${globalStats.tokenSavingsPct}% context savings)\n`,
  );
}
