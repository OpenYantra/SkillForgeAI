#!/usr/bin/env node
/**
 * Script wrapper: generate the symbol-level code graph.
 * The engine lives in `src/core/code-graph.mjs` and is shared with the CLI.
 */

import path from 'node:path';
import { buildCodeGraph, writeGraphArtifacts } from '../src/core/code-graph.mjs';

const target = process.argv[2] || '.';

console.log(`\n🔍 Generating Symbol-Level Code Graph for "${target}"...`);
const { graph, files } = buildCodeGraph(target);
const { graphFile, repoMapFile } = writeGraphArtifacts(graph, path.join('docs', 'context'));

console.log(`   ✅ Wrote ${graphFile} (${files.length} nodes)`);
console.log(`   ✅ Wrote ${repoMapFile} (Token-efficient symbol directory)`);
console.log('\n🎉 Symbol-level code graph complete!\n');
