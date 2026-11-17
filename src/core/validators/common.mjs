/**
 * Shared helpers for core validators.
 * Every validator returns `{ passed, errors, warnings, details }` and performs
 * no console output, so gates can run them in-process.
 */

import fs from 'node:fs';

/**
 * @returns {{passed: boolean, errors: string[], warnings: string[], details: Record<string, any>}}
 */
export function emptyResult() {
  return { passed: false, errors: [], warnings: [], details: {} };
}

/**
 * @param {{passed?: boolean, errors: string[], warnings: string[], details: Record<string, any>}} result
 */
export function finalize(result) {
  result.passed = result.errors.length === 0;
  return result;
}

/**
 * Read a target file, recording a structured error when it is unavailable.
 * @param {string} target
 * @param {ReturnType<typeof emptyResult>} result
 * @returns {string|null}
 */
export function readTarget(target, result) {
  if (!target) {
    result.errors.push('Please specify a target path.');
    return null;
  }
  if (!fs.existsSync(target)) {
    result.errors.push(`Target not found at "${target}".`);
    return null;
  }
  if (fs.statSync(target).isDirectory()) {
    result.errors.push(`Expected a file but "${target}" is a directory.`);
    return null;
  }
  return fs.readFileSync(target, 'utf-8');
}

/**
 * @param {string} target
 * @param {ReturnType<typeof emptyResult>} result
 * @returns {boolean}
 */
export function requireDirectory(target, result) {
  if (!target) {
    result.errors.push('Please specify a target directory.');
    return false;
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    result.errors.push(`Directory not found at "${target}".`);
    return false;
  }
  return true;
}
