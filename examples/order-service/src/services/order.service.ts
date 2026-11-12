import { OrderEntity, type OrderItem } from '../domain/entities/order.entity.ts';
import type { IOrderRepository } from '../domain/ports/order.repository.ts';

export class OrderNotFoundError extends Error {
  constructor(id: string) {
    super(`Order with ID "${id}" was not found.`);
    this.name = 'OrderNotFoundError';
  }
}

export class OrderService {
  private repository: IOrderRepository;

  constructor(repository: IOrderRepository) {
    this.repository = repository;
  }

  public async createOrder(customerId: string, items: OrderItem[]): Promise<OrderEntity> {
    const order = OrderEntity.create(customerId, items);
    await this.repository.save(order);
    return order;
  }

  public async getOrderById(id: string): Promise<OrderEntity> {
    const order = await this.repository.findById(id);
    if (!order) {
      throw new OrderNotFoundError(id);
    }
    return order;
  }

  public async cancelOrder(id: string): Promise<OrderEntity> {
    const order = await this.getOrderById(id);
    order.cancel();
    await this.repository.save(order);
    return order;
  }
}
