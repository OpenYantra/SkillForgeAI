/**
 * Safe process execution helpers.
 * Uses argument arrays (no shell interpolation) to avoid shell-injection and
 * quoting problems, including paths that contain spaces.
 */

import { execFileSync, spawnSync } from 'node:child_process';

/** Commands that are batch files on Windows and require the `.cmd` suffix. */
const WINDOWS_CMD_SHIMS = new Set(['npm', 'npx', 'pnpm', 'yarn']);

/**
 * Resolve a command name to an executable that can be spawned without a shell.
 * @param {string} command
 * @returns {string}
 */
export function resolveCommand(command) {
  if (process.platform === 'win32' && WINDOWS_CMD_SHIMS.has(command)) return `${command}.cmd`;
  return command;
}

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

/**
 * Run a command without a shell and return a spawnSync result.
 * @param {string} command
 * @param {string[]} [args]
 * @param {object} [opts]
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 */
export function runCommand(command, args = [], opts = {}) {
  return spawnSync(resolveCommand(command), args, { encoding: 'utf-8', ...opts });
}

/**
 * Run a command and throw a structured error when it fails.
 * @param {string} command
 * @param {string[]} [args]
 * @param {object} [opts]
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 */
export function runCommandOrThrow(command, args = [], opts = {}) {
  const result = runCommand(command, args, opts);
  const spawnError = /** @type {NodeJS.ErrnoException|undefined} */ (result.error);
  if (spawnError && spawnError.code === 'ENOENT') throw spawnError;
  if (result.status !== 0) {
    const error = /** @type {Error & {status: number|null, stdout: string, stderr: string}} */ (
      new Error(`Command failed (${result.status}): ${command} ${args.join(' ')}`.trim())
    );
    error.status = result.status;
    error.stdout = result.stdout || '';
    error.stderr = result.stderr || '';
    throw error;
  }
  return result;
}
