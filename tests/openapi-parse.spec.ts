/**
 * Test Suite: real YAML/JSON OpenAPI validation.
 * Covers improvement.md #9 (parse specs instead of regexing headers).
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseOpenApiDocument, validateOpenApi } from '../src/core/validators/openapi.mjs';
import { makeTempDir, removeDir } from './helpers/workspace.ts';

const VALID = `openapi: 3.0.3
info:
  title: Example API
  version: 1.0.0
paths:
  /items:
    get:
      summary: List items
      responses:
        '200':
          description: OK
        '400':
          $ref: '#/components/responses/BadRequest'
components:
  schemas:
    Item:
      type: object
      properties:
        id:
          type: string
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
  responses:
    BadRequest:
      description: Bad request
`;

function writeSpec(dir: string, name: string, content: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return file;
}

describe('parseOpenApiDocument', () => {
  it('parses YAML and JSON', () => {
    assert.equal(parseOpenApiDocument(VALID).document?.openapi, '3.0.3');
    assert.equal(parseOpenApiDocument('{"openapi":"3.1.0","paths":{}}').document?.openapi, '3.1.0');
  });

  it('reports parse errors', () => {
    const parsed = parseOpenApiDocument('paths: [\n');
    assert.equal(parsed.document, null);
    assert.ok(parsed.error);
  });
});

describe('validateOpenApi', () => {
  const dir = makeTempDir('openapi');
  after(() => removeDir(dir));

  it('accepts a valid specification with full schema validation', async () => {
    const file = writeSpec(dir, 'valid.yaml', VALID);
    const result = await validateOpenApi(file);
    assert.equal(result.passed, true, result.errors.join('\n'));
    assert.equal(result.details.version, '3.0.3');
  });

  it('rejects unsupported versions', async () => {
    const file = writeSpec(dir, 'v2.yaml', 'openapi: 2.0.0\ninfo: {title: T, version: 1.0.0}\npaths: {}\n');
    const result = await validateOpenApi(file);
    assert.equal(result.passed, false);
    assert.ok(result.errors.some((error) => /3\.0\.x/.test(error)));
  });

  it('rejects operations without responses', async () => {
    const spec = VALID.replace(
      "      responses:\n        '200':\n          description: OK\n        '400':\n          $ref: '#/components/responses/BadRequest'\n",
      '',
    );
    const file = writeSpec(dir, 'no-responses.yaml', spec);
    const result = await validateOpenApi(file);
    assert.equal(result.passed, false);
    assert.ok(result.errors.some((error) => /has no responses/.test(error)));
  });

  it('rejects missing component schemas and warns on missing security', async () => {
    const spec = `openapi: 3.0.3
info:
  title: Example
  version: 1.0.0
paths:
  /items:
    get:
      responses:
        '200':
          description: OK
`;
    const file = writeSpec(dir, 'no-schemas.yaml', spec);
    const result = await validateOpenApi(file);
    assert.equal(result.passed, false);
    assert.ok(result.errors.some((error) => /components\.schemas/.test(error)));
    assert.ok(result.warnings.some((warning) => /security schemes/.test(warning)));
  });

  it('reports invalid YAML as a structural error', async () => {
    const file = writeSpec(dir, 'broken.yaml', 'paths: [\n');
    const result = await validateOpenApi(file);
    assert.equal(result.passed, false);
    assert.ok(result.errors.some((error) => /Invalid YAML\/JSON/.test(error)));
  });

  it('handles missing files', async () => {
    const result = await validateOpenApi(path.join(dir, 'nope.yaml'));
    assert.equal(result.passed, false);
    assert.ok(result.errors.some((error) => /not found/i.test(error)));
  });
});
