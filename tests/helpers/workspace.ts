import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const REPO_ROOT = path.resolve('.');
export const CLI = path.join(REPO_ROOT, 'bin', 'skillforge.mjs');

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `sfa-${prefix}-`));
}

export function removeDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function writeFiles(root: string, files: Record<string, string>): void {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
}

export function runNode(script: string, args: string[] = [], cwd = REPO_ROOT, input?: string): RunResult {
  const result: SpawnSyncReturns<string> = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf-8',
    input,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function runCli(args: string[] = [], cwd = REPO_ROOT): RunResult {
  return runNode(CLI, args, cwd);
}

export function runGit(args: string[], cwd: string): RunResult {
  const result: SpawnSyncReturns<string> = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function initGitRepo(dir: string): void {
  runGit(['init', '-b', 'main'], dir);
  runGit(['config', 'user.email', 'tests@example.com'], dir);
  runGit(['config', 'user.name', 'SkillForge Tests'], dir);
}

export function commitAll(dir: string, message = 'test: initial commit'): void {
  runGit(['add', '.'], dir);
  runGit(['commit', '-m', message], dir);
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}
