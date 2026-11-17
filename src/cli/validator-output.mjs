/**
 * Shared rendering for skill validator CLI wrappers.
 *
 * Keeps the human-readable output stable while the actual checks live in
 * `src/core/validators`.
 */

/**
 * @param {{
 *   title: string,
 *   target: string,
 *   result: {passed: boolean, errors: string[], warnings: string[], details?: object},
 *   extraLines?: string[],
 *   successLines?: string[],
 *   failureHint?: string,
 * }} options
 */
export function printValidatorReport(options) {
  const { title, target, result, extraLines = [], successLines = [], failureHint = '' } = options;

  console.log('\n========================================');
  console.log(`${title}: ${target}`);
  console.log('========================================');
  for (const line of extraLines) console.log(line);

  if (result.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    result.warnings.forEach((warning) => console.log(`   - ${warning}`));
  }

  if (result.errors.length > 0) {
    console.log('\n❌ FAILED:');
    result.errors.forEach((error) => console.log(`   - ${error}`));
    if (failureHint) console.log(`\n${failureHint}\n`);
  } else {
    console.log('\n✅ PASSED');
    successLines.forEach((line) => console.log(`   ${line}`));
    console.log('');
  }
}

/**
 * Run a validator CLI and exit with the appropriate status code.
 * @param {(target: string) => object|Promise<object>} validate
 * @param {{
 *   script: string,
 *   usage: string,
 *   title: string,
 *   extraLines?: (result: object) => string[],
 *   successLines?: (result: object) => string[],
 *   failureHint?: string,
 * }} options
 */
export async function runValidatorCli(validate, options) {
  const target = process.argv[2];

  if (!target) {
    console.error(`❌ Error: Please specify ${options.usage}.\nUsage: node ${options.script} <target>`);
    process.exit(1);
  }

  const result = await validate(target);
  printValidatorReport({
    title: options.title,
    target,
    result,
    extraLines: options.extraLines ? options.extraLines(result) : [],
    successLines: options.successLines ? options.successLines(result) : [],
    failureHint: options.failureHint,
  });
  process.exit(result.passed ? 0 : 1);
}
