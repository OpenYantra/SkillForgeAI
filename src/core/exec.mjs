/**
 * Safe process execution helpers.
 * Uses execFileSync (argument array, no shell) to avoid shell-injection and
 * quoting problems when running Node validator scripts.
 */

import { execFileSync } from 'node:child_process';

/**
 * Run a Node script in a child process.
 * @param {string} script path to the .mjs validator
 * @param {string[]} [args] arguments passed to the script
 * @param {object} [opts] extra execFileSync options
 * @returns {string} captured stdout
 */
export function runNode(script, args = [], opts = {}) {
  return execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf-8',
    stdio: 'pipe',
    ...opts,
  });
}
