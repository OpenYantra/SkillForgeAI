/**
 * OpenAPI 3.x contract validator (Phase 2/3).
 *
 * Parses YAML/JSON for real, then performs structural checks. When the optional
 * `@apidevtools/swagger-parser` dependency is installed, the document is also
 * validated against the OpenAPI meta-schema.
 */

import { parse as parseYaml } from 'yaml';
import { emptyResult, finalize, readTarget } from './common.mjs';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} content
 * @returns {{document: Record<string, any>|null, error: string|null}}
 */
export function parseOpenApiDocument(content) {
  const trimmed = content.trim();
  try {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return { document: JSON.parse(trimmed), error: null };
    }
    return { document: parseYaml(content), error: null };
  } catch (err) {
    return { document: null, error: err.message };
  }
}

async function validateWithSwaggerParser(document, result) {
  let swaggerParser;
  try {
    /** @type {any} */
    const mod = await import('@apidevtools/swagger-parser');
    swaggerParser = mod.default ?? mod;
  } catch {
    result.warnings.push(
      'Full OpenAPI meta-schema validation skipped (optional dependency @apidevtools/swagger-parser is not installed).',
    );
    return;
  }

  try {
    await swaggerParser.validate(structuredClone(document));
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    result.errors.push(`OpenAPI schema validation failed: ${message}`);
  }
}

/**
 * @param {string} target
 */
export async function validateOpenApi(target) {
  const result = emptyResult();
  const content = readTarget(target, result);
  if (content === null) return finalize(result);

  const { document, error } = parseOpenApiDocument(content);
  if (error || !isObject(document)) {
    result.errors.push(`Invalid YAML/JSON: ${error || 'document root must be an object.'}`);
    return finalize(result);
  }

  const version = typeof document.openapi === 'string' ? document.openapi : '';
  if (!/^3\.[01]\.\d+/.test(version)) {
    result.errors.push('Missing or invalid "openapi: 3.0.x | 3.1.x" version declaration.');
  }

  if (!isObject(document.info) || !document.info.title || !document.info.version) {
    result.errors.push('Missing mandatory "info.title" and "info.version" fields.');
  }

  if (!isObject(document.paths) || Object.keys(document.paths).length === 0) {
    result.errors.push('Missing mandatory non-empty "paths" section.');
  }

  const operations = [];
  for (const [pathKey, pathItem] of Object.entries(document.paths || {})) {
    if (!pathKey.startsWith('/') || !isObject(pathItem)) continue;
    for (const method of HTTP_METHODS) {
      if (!isObject(pathItem[method])) continue;
      operations.push({ path: pathKey, method, operation: pathItem[method] });
    }
  }
  if (operations.length === 0) {
    result.errors.push('No HTTP operations (get, post, put, patch, delete) found in paths.');
  }

  for (const { path: pathKey, method, operation } of operations) {
    const label = `${method.toUpperCase()} ${pathKey}`;
    if (!isObject(operation.responses) || Object.keys(operation.responses).length === 0) {
      result.errors.push(`Operation ${label} has no responses.`);
    }
  }

  if (!isObject(document.components) || !isObject(document.components.schemas)) {
    result.errors.push('Contract should declare reusable data structures under "components.schemas".');
  }

  const responseCodes = operations.flatMap(({ operation }) => Object.keys(operation.responses || {}));
  const hasErrorResponse = responseCodes.some((code) => /^(4|5)\d\d$/.test(code)) || content.includes('ProblemDetails');
  if (!hasErrorResponse) {
    result.warnings.push('No standard RFC 7807 error responses or 4xx status codes detected.');
  }

  if (!isObject(document.components) || !isObject(document.components.securitySchemes)) {
    result.warnings.push('No security schemes (e.g. BearerAuth) declared in components.');
  }

  await validateWithSwaggerParser(document, result);

  result.details = {
    version,
    title: document.info && document.info.title,
    operations: operations.map(({ path: p, method }) => `${method.toUpperCase()} ${p}`),
  };
  return finalize(result);
}
