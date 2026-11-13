/**
 * SkillForgeAI: Zero-Dependency Terminal UI Helper
 * Provides ANSI styling, status indicators, and formatted tables
 * with automatic fallback for non-TTY / CI environments.
 */

const isColorSupported = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);

export const colors = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
};

export const icons = {
  pass: `${colors.green}✔${colors.reset}`,
  fail: `${colors.red}✖${colors.reset}`,
  warn: `${colors.yellow}⚠️${colors.reset}`,
  info: `${colors.cyan}ℹ${colors.reset}`,
  bullet: `${colors.dim}•${colors.reset}`,
  shield: '🛡️',
  rocket: '🚀',
  package: '📦',
  graph: '🔍',
  heal: '🔄',
  mcp: '🔌',
};

export function printBanner(title, subtitle = '') {
  const line = '═'.repeat(60);
  console.log(`\n${colors.cyan}${line}${colors.reset}`);
  console.log(`${colors.bold}${title}${colors.reset}`);
  if (subtitle) {
    console.log(`${colors.dim}${subtitle}${colors.reset}`);
  }
  console.log(`${colors.cyan}${line}${colors.reset}\n`);
}

export function printSection(title) {
  console.log(`\n${colors.bold}${title}${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(50)}${colors.reset}`);
}

export function printSuccess(message) {
  console.log(`${icons.pass} ${colors.green}${message}${colors.reset}`);
}

export function printError(message) {
  console.error(`${icons.fail} ${colors.red}${message}${colors.reset}`);
}

export function printWarning(message) {
  console.warn(`${icons.warn} ${colors.yellow}${message}${colors.reset}`);
}

export function printInfo(message) {
  console.log(`${icons.info} ${message}`);
}
