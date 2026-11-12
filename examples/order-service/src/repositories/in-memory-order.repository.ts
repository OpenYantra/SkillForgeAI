import { OrderEntity } from '../domain/entities/order.entity.ts';
import type { IOrderRepository } from '../domain/ports/order.repository.ts';

export class InMemoryOrderRepository implements IOrderRepository {
  private readonly store = new Map<string, OrderEntity>();

  async findById(id: string): Promise<OrderEntity | null> {
    return this.store.get(id) || null;
  }

  async save(order: OrderEntity): Promise<void> {
    this.store.set(order.toJSON().id, order);
  }
}
