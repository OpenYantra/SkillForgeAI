/**
 * Test suite criteria & sanity validator (Phase 5).
 */

import fs from 'node:fs';
import path from 'node:path';
import { emptyResult, finalize } from './common.mjs';
import { getParser, grammarForFile } from '../parsers/tree-sitter-loader.mjs';

function scanTestFiles(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!/^(bin|obj|node_modules|\.git)$/.test(entry.name)) scanTestFiles(fullPath, list);
    } else if (isTestFile(entry.name)) {
      list.push(fullPath);
    }
  }
  return list;
}

function isTestFile(name) {
  return (
    /\.(spec|test)\.(ts|js|mjs|tsx|jsx)$/i.test(name) ||
    /Tests?\.cs$/i.test(name) ||
    /(^test_.*|.*_test)\.py$/i.test(name) ||
    /.*_test\.go$/i.test(name)
  );
}

function walk(node, visitor) {
  visitor(node);
  for (const child of node.namedChildren) walk(child, visitor);
}

function countJsAstTests(content, file) {
  const grammar = grammarForFile(file);
  const parser = grammar ? getParser(grammar) : null;
  if (!parser) return null;

  let tests = 0;
  let assertions = 0;
  try {
    const tree = parser.parse(content);
    walk(tree.rootNode, (node) => {
      if (node.type !== 'call_expression') return;
      const fn = node.childForFieldName('function');
      if (!fn) return;
      if (fn.type === 'identifier' && (fn.text === 'it' || fn.text === 'test')) {
        tests++;
      } else if (fn.type === 'identifier' && fn.text === 'expect') {
        assertions++;
      } else if (fn.type === 'identifier' && fn.text === 'assert') {
        assertions++;
      } else if (fn.type === 'member_expression') {
        const object = fn.childForFieldName('object');
        if (object && object.type === 'identifier' && object.text === 'assert') assertions++;
      }
    });
    return { tests, assertions };
  } catch {
    return null;
  }
}

function countHeuristicTests(content, file) {
  const isJs = /\.(ts|js|mjs|tsx|jsx)$/i.test(file);
  if (isJs) {
    const tests = (content.match(/\b(it|test)\s*\(/g) || []).length;
    const assertions =
      (content.match(/\bexpect\s*\(/g) || []).length + (content.match(/\bassert(?:\.\w+)?\s*\(/g) || []).length;
    return { tests, assertions };
  }

  const tests = (content.match(/\[Fact\]|\[Theory\]|\bdef\s+test_\w+|\bfunc\s+Test\w+/g) || []).length;
  const assertions = (
    content.match(/Assert\.\w+\s*\(|^\s*assert\b|\.should\b|t\.(?:Error|Errorf|Fatal|Fatalf)\s*\(/gm) || []
  ).length;
  return { tests, assertions };
}

/**
 * @param {string} target test file or directory
 */
export function verifyCoverageCriteria(target) {
  const result = emptyResult();
  if (!target || !fs.existsSync(target)) {
    result.errors.push(target ? `Target not found at "${target}".` : 'Please specify a test file or directory.');
    return finalize(result);
  }

  const testFiles = fs.statSync(target).isDirectory() ? scanTestFiles(target) : [target].filter(isTestFile);
  if (testFiles.length === 0) {
    result.errors.push('No test files (*.spec.*, *Tests.cs, test_*.py, *_test.go) found.');
    return finalize(result);
  }

  let totalTests = 0;
  let totalAssertions = 0;
  let requirementsCited = 0;

  for (const file of testFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.basename(file);

    const jsCounts = /\.(ts|js|mjs|tsx|jsx)$/i.test(file) ? countJsAstTests(content, file) : null;
    const counts = jsCounts || countHeuristicTests(content, file);
    totalTests += counts.tests;
    totalAssertions += counts.assertions;

    if (counts.tests === 0) {
      result.warnings.push(`File "${relativePath}" does not contain recognized test case declarations.`);
    }
    if (counts.assertions === 0) {
      result.errors.push(`File "${relativePath}" has 0 assertions! Tests must assert outcomes.`);
    }

    const citations = content.match(/(?:^|[^a-zA-Z0-9])(FR-?\d{3}|EC-?\d{3})(?:$|[^a-zA-Z0-9])/gi) || [];
    requirementsCited += citations.length;
    if (citations.length === 0) {
      result.warnings.push(`File "${relativePath}" does not cite any requirement IDs (e.g. FR-001, EC-001).`);
    }
  }

  result.details = {
    testFiles: testFiles.length,
    tests: totalTests,
    assertions: totalAssertions,
    requirementsCited,
  };
  return finalize(result);
}
