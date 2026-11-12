import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  DomainValidationError,
  InvalidStateTransitionError,
} from '../src/domain/entities/order.entity.ts';
import {
  OrderService,
  OrderNotFoundError,
} from '../src/services/order.service.ts';
import { InMemoryOrderRepository } from '../src/repositories/in-memory-order.repository.ts';

describe('OrderService Unit Tests', () => {
  let repository: InMemoryOrderRepository;
  let service: OrderService;

  beforeEach(() => {
    // Arrange: Fresh in-memory repository and service for isolation
    repository = new InMemoryOrderRepository();
    service = new OrderService(repository);
  });

  describe('createOrder', () => {
    it('should successfully create and persist order with calculated total (FR-001)', async () => {
      // Arrange
      const customerId = 'cust-101';
      const items = [
        { sku: 'ITEM-A', quantity: 2, unitPrice: 25.5 },
        { sku: 'ITEM-B', quantity: 1, unitPrice: 10.0 },
      ];

      // Act
      const order = await service.createOrder(customerId, items);
      const props = order.toJSON();

      // Assert
      assert.ok(props.id, 'Expected order to have an ID');
      assert.equal(props.customerId, customerId);
      assert.equal(props.status, 'PENDING');
      assert.equal(props.totalAmount, 61.0); // (2 * 25.5) + (1 * 10.0) = 51 + 10 = 61.0

      // Verify persisted state
      const saved = await repository.findById(props.id);
      assert.notEqual(saved, null);
    });

    it('should round floating point total safely to two decimal places (EC-003)', async () => {
      // Arrange
      const customerId = 'cust-102';
      const items = [
        { sku: 'ITEM-X', quantity: 3, unitPrice: 1.111 },
      ];

      // Act
      const order = await service.createOrder(customerId, items);

      // Assert
      assert.equal(order.toJSON().totalAmount, 3.33);
    });

    it('should reject order creation when items list is empty (EC-001)', async () => {
      // Arrange
      const customerId = 'cust-103';
      const emptyItems: any[] = [];

      // Act & Assert
      await assert.rejects(
        async () => {
          await service.createOrder(customerId, emptyItems);
        },
        DomainValidationError
      );
    });
  });

  describe('cancelOrder', () => {
    it('should transition order status to CANCELLED (FR-002)', async () => {
      // Arrange
      const created = await service.createOrder('cust-201', [
        { sku: 'ITEM-1', quantity: 1, unitPrice: 50 },
      ]);

      // Act
      const cancelled = await service.cancelOrder(created.toJSON().id);

      // Assert
      assert.equal(cancelled.toJSON().status, 'CANCELLED');

      const saved = await repository.findById(created.toJSON().id);
      assert.equal(saved?.toJSON().status, 'CANCELLED');
    });

    it('should throw InvalidStateTransitionError when cancelling an already cancelled order (EC-002)', async () => {
      // Arrange
      const created = await service.createOrder('cust-202', [
        { sku: 'ITEM-2', quantity: 1, unitPrice: 30 },
      ]);
      await service.cancelOrder(created.toJSON().id);

      // Act & Assert
      await assert.rejects(
        async () => {
          await service.cancelOrder(created.toJSON().id);
        },
        InvalidStateTransitionError
      );
    });
  });

  describe('getOrderById', () => {
    it('should fetch order by valid ID (FR-003)', async () => {
      // Arrange
      const created = await service.createOrder('cust-301', [
        { sku: 'ITEM-3', quantity: 1, unitPrice: 15 },
      ]);

      // Act
      const fetched = await service.getOrderById(created.toJSON().id);

      // Assert
      assert.equal(fetched.toJSON().id, created.toJSON().id);
    });

    it('should throw OrderNotFoundError when order ID does not exist (FR-003)', async () => {
      // Arrange
      const nonExistentId = 'non-existent-id';

      // Act & Assert
      await assert.rejects(
        async () => {
          await service.getOrderById(nonExistentId);
        },
        OrderNotFoundError
      );
    });
  });
});
