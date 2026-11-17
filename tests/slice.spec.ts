/**
 * Test Suite: Monorepo domain slicing.
 * Covers improvement.md #5 (safety net for `slice`).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeSlice, discoverSlices, generateSliceMaps, renderSliceMap } from '../src/cli/commands/slice.mjs';
import { buildCodeGraph } from '../src/cli/commands/graph.mjs';
import { makeTempDir, removeDir, writeFiles } from './helpers/workspace.ts';

const FILES = {
  'services/orders/domain/order.entity.ts': 'export class OrderEntity {}\n',
  'services/orders/services/order.service.ts': [
    "import { OrderEntity } from '../domain/order.entity.ts';",
    'export class OrderService {}',
    '',
  ].join('\n'),
  'services/orders/repositories/order.repository.ts':
    "import type { OrderEntity } from '../domain/order.entity.ts';\nexport class OrderRepository {}\n",
  'services/billing/domain/invoice.entity.ts': 'export class InvoiceEntity {}\n',
  'services/billing/services/invoice.service.ts': [
    "import { OrderEntity } from '../../orders/domain/order.entity.ts';",
    'export class InvoiceService {}',
    '',
  ].join('\n'),
  'services/orders/tests/order.service.spec.ts': "import { OrderService } from '../services/order.service.ts';\n",
};

describe('slice discovery and analysis', () => {
  it('discovers vertical slices and classifies symbols/dependencies', () => {
    const dir = makeTempDir('slice');
    const previous = process.cwd();
    try {
      writeFiles(dir, FILES);
      process.chdir(dir);

      const slices = discoverSlices('.');
      assert.deepEqual(slices.map((slice: { name: string }) => slice.name).sort(), ['billing', 'orders']);

      const { graph } = buildCodeGraph('.');
      const orders = slices.find((slice: { name: string }) => slice.name === 'orders');
      assert.ok(orders);
      const analyzed = analyzeSlice(orders, graph, slices);

      assert.ok(analyzed.symbols.entities.includes('OrderEntity'));
      assert.ok(analyzed.symbols.services.includes('OrderService'));
      assert.ok(analyzed.symbols.repositories.includes('OrderRepository'));
      assert.ok(!analyzed.dependencies.outbound.includes('billing'));

      const billing = slices.find((slice: { name: string }) => slice.name === 'billing');
      assert.ok(billing);
      const billingAnalysis = analyzeSlice(billing, graph, slices);
      assert.ok(billingAnalysis.dependencies.outbound.includes('orders'));

      const markdown = renderSliceMap(analyzed).markdown;
      assert.match(markdown, /Vertical Slice: `orders`/);
      assert.match(markdown, /OrderEntity/);
      assert.match(markdown, /order\.service\.spec\.ts/);
    } finally {
      process.chdir(previous);
      removeDir(dir);
    }
  });

  it('generates slice maps, router index, and JSON registry', () => {
    const dir = makeTempDir('slice-generate');
    const previous = process.cwd();
    try {
      writeFiles(dir, FILES);
      process.chdir(dir);

      const { analyzedSlices, registry, globalStats } = generateSliceMaps();
      assert.equal(analyzedSlices.length, 2);
      assert.equal(registry.slices.length, 2);
      assert.ok(globalStats.monolithicTokens > 0);

      const slicesDir = path.join(dir, 'docs', 'context', 'slices');
      assert.ok(fs.existsSync(path.join(slicesDir, 'orders-map.md')));
      assert.ok(fs.existsSync(path.join(slicesDir, 'billing-map.md')));
      assert.ok(fs.existsSync(path.join(slicesDir, 'index.md')));
      assert.ok(fs.existsSync(path.join(slicesDir, 'slices.json')));

      const saved = JSON.parse(fs.readFileSync(path.join(slicesDir, 'slices.json'), 'utf-8'));
      assert.ok(saved.slices.some((slice: { name: string }) => slice.name === 'orders'));
    } finally {
      process.chdir(previous);
      removeDir(dir);
    }
  });
});
